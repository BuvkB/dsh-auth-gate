import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import type { Gate } from "./gate.js";
import { wrapServer, type WrappableServer } from "./guard.js";
import { assertGuarded } from "./self-check.js";
import { sessionDomainSpec, SessionStore } from "./session-store.js";
import { safeEqual, TokenGate } from "./token-gate.js";
import { registerAuthEndpoints } from "./auth-endpoints.js";

/** 稳定 Cordis 插件名（host 组合行 id）。 */
export const name = "dsh-auth";

/** 硬依赖：守卫包装 webServer 的路由表；storageDomain/credentials 软读（见 apply）。 */
export const inject = ["webServer"] as const;

export interface AuthConfig {
  /** 认证流：token（M2）/ password（M3）。M2 只实现 token。 */
  mode: "token" | "password";
  /** 会话 TTL（秒）。 */
  sessionTtl: number;
  /** 会话 cookie 名。 */
  cookieName: string;
  /** 共享 token 的 credentials 引用名（环境变量名）。 */
  tokenRef: string;
  /** cookie 是否带 `; Secure`（http 测试/开发可关，M7）。 */
  cookieSecure: boolean;
}

export const Config: z<AuthConfig> = z.object({
  mode: z.union([z.const("token"), z.const("password")]).default("token"),
  sessionTtl: z.natural().default(604800),
  cookieName: z.string().default("dsh_auth"),
  // pattern 与 dsh-credentials 的 credential-ref 模式一致，同时挡住空串（M2 规格 §4.6）。
  tokenRef: z
    .string()
    .pattern(/^[A-Za-z_][A-Za-z0-9_]*$/)
    .default("DSH_AUTH_TOKEN"),
  cookieSecure: z.boolean().default(true),
});

/** 本插件提供的 auth 服务：门（可换流/测试注入）+ 会话层。 */
export interface AuthService {
  /** storageDomain 缺失时为 undefined（会话不可用但守卫照常挂载）。 */
  sessions: SessionStore | undefined;
  /** 可写：M2 为 TokenGate；测试注入假门。 */
  gate: Gate;
}

/** credentials 服务的结构镜像（spec §3.1）；本文件私有，不导出。 */
interface CredentialRefResolver {
  resolve(ref: string): Promise<{ value: string; source: string } | undefined>;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    auth?: AuthService;
  }
}

/**
 * 构造凭证解析器（每次调用惰性取服务——实测 harness 并行挂载行，credentials 行可能在
 * 本行 apply 之后才就绪；每次 resolve 现取既是 M2 的 per-operation 语义，也天然规避
 * 竞态）。服务缺失 → 首次解析时 log.error（fail-closed）；解析失败 → log.error 并返回
 * undefined（登录/门都按"无凭证"处理）。
 */
function makeTokenResolver(
  ctx: Context,
  config: AuthConfig,
  log: { error(message: unknown): void },
): () => Promise<string | undefined> {
  let warnedMissing = false;
  return async () => {
    const credentials = ctx.get("credentials") as unknown as CredentialRefResolver | undefined;
    if (credentials === undefined) {
      if (!warnedMissing) {
        warnedMissing = true;
        log.error("credentials service is unavailable: gate denies everything (fail-closed)");
      }
      return undefined;
    }
    try {
      const resolved = await credentials.resolve(config.tokenRef);
      return resolved?.value;
    } catch (error) {
      log.error(
        `token resolution failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined; // fail-closed：解析失败 = 无凭证
    }
  };
}

/**
 * 应用 auth 门：mode 校验（fail loud）→ credentials 解析器 → auth 服务（一步成型，
 * TokenGate 的 sessions 访问器闭包自引用 auth）→ 软接会话层 → 包装 webServer 四类入口 →
 * 注册 /auth 端点 → 启动自检（未全覆盖 = fail loud）。
 */
export function apply(ctx: Context, config: AuthConfig): void {
  if (config.mode === "password") {
    throw new Error("dsh-auth: password flow requires M3 (not implemented in M2)");
  }
  const server = ctx.get("webServer") as unknown as WrappableServer | undefined;
  if (server === undefined) return;
  const log = ctx.logger("dsh-auth");

  const resolveToken = makeTokenResolver(ctx, config, log);

  const auth: AuthService = {
    sessions: undefined,
    gate: new TokenGate({
      resolveToken,
      sessions: () => auth.sessions, // 访问器闭包自引用 auth（domain 异步就绪后由 open 回调赋值）
      cookieName: config.cookieName,
    }),
  };
  ctx.provide("auth", auth);

  // storageDomain 类型来自 @deepseek-ai/dsh-storage-domain 的 cordis 增强。
  const storageDomain = ctx.get("storageDomain");
  if (storageDomain === undefined) {
    log.error(
      "storage-domain is unavailable: session persistence is disabled (guards stay mounted)",
    );
  } else {
    ctx.effect(() => {
      let closed = false;
      const opening = storageDomain.open(sessionDomainSpec);
      const ready = opening.then(
        (domain) => {
          if (closed) {
            void domain.close();
            return;
          }
          auth.sessions = new SessionStore(domain.table("sessions"));
          log.info("session domain opened: dsh_auth_sessions");
        },
        (error: unknown) => {
          log.error(
            `session domain open failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      );
      return async () => {
        closed = true;
        await ready.catch(() => undefined);
        const domain = await opening.catch(() => undefined);
        await domain?.close();
      };
    }, "dsh-auth: session domain");
  }

  const unwrap = wrapServer(server, () => auth.gate, log);
  ctx.effect(() => unwrap, "dsh-auth: guard unwrap");

  ctx.effect(
    () =>
      registerAuthEndpoints({
        register: (route) => server.register(route), // 包装后的 register（增量保险路径）
        sessions: () => auth.sessions,
        cookieName: config.cookieName,
        cookieSecure: config.cookieSecure,
        sessionTtl: config.sessionTtl,
        validateToken: async (token) => {
          const stored = await resolveToken();
          return stored !== undefined && safeEqual(token, stored);
        },
        logger: log,
      }),
    "dsh-auth: auth endpoints",
  );

  const failures = assertGuarded(server);
  if (failures.length > 0) {
    for (const failure of failures) log.error(`unwrapped entry: ${failure}`);
    throw new Error(`dsh-auth: guard self-check failed: ${failures.join(", ")}`);
  }
}
