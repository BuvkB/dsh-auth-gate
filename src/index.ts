import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { noopGate, type Gate } from "./gate.js";
import { wrapServer, type WrappableServer } from "./guard.js";
import { assertGuarded } from "./self-check.js";
import { sessionDomainSpec, SessionStore } from "./session-store.js";

/** 稳定 Cordis 插件名（host 组合行 id）。 */
export const name = "dsh-auth";

/** 硬依赖：守卫包装 webServer 的路由表；storageDomain 软读（见 apply）。 */
export const inject = ["webServer"] as const;

export interface AuthConfig {
  /** 认证流：token（M2）/ password（M3）。M1 只进 schema。 */
  mode: "token" | "password";
  /** 会话 TTL（秒）。 */
  sessionTtl: number;
  /** 会话 cookie 名。 */
  cookieName: string;
}

export const Config: z<AuthConfig> = z.object({
  mode: z.union([z.const("token"), z.const("password")]).default("token"),
  sessionTtl: z.natural().default(604800),
  cookieName: z.string().default("dsh_auth"),
});

/** 本插件提供的 auth 服务：门（可换流/测试注入）+ 会话层。 */
export interface AuthService {
  /** storageDomain 缺失时为 undefined（会话不可用但守卫照常挂载）。 */
  sessions: SessionStore | undefined;
  /** 可写：M2 换 token 门、测试注入假门。 */
  gate: Gate;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    auth?: AuthService;
  }
}

/**
 * 应用 auth 门：提供 auth 服务 → 软接会话层（storage domain）→ 包装 webServer
 * 四类入口 → 启动自检（未全覆盖 = fail loud，fiber 启动失败即裸奔可见）。
 */
export function apply(ctx: Context, config: AuthConfig): void {
  // M2/M3 消费 mode/cookieName，M2 起按 sessionTtl 建会话；M1 门惰性，无消费方。
  void config;
  const server = ctx.get("webServer") as unknown as WrappableServer | undefined;
  if (server === undefined) return;
  const log = ctx.logger("dsh-auth");
  const auth: AuthService = { sessions: undefined, gate: noopGate };
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

  const failures = assertGuarded(server);
  if (failures.length > 0) {
    for (const failure of failures) log.error(`unwrapped entry: ${failure}`);
    throw new Error(`dsh-auth: guard self-check failed: ${failures.join(", ")}`);
  }
}
