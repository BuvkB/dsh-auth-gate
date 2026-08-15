import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import type { Gate, GuardKind } from "./gate.js";

/** 挂在被包装 handler/方法上的守卫标记（幂等重包装 + 自检共用）。 */
export const GUARDED: unique symbol = Symbol.for("dsh-auth.guarded");

/** 登录页路径（拒绝时 302 的目标）。 */
export const LOGIN_PATH = "/auth/login";

/** auth 公共路径前缀（TokenGate 白名单，M4）。 */
export const AUTH_PATH_PREFIX = "/auth";

export type HttpHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export type UpgradeHandler = (
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer,
) => void | Promise<void>;

export interface WrappableRoute {
  kind: "exact" | "prefix";
  path: string;
  handler: HttpHandler;
}

export interface WrappableUpgradeRoute {
  path: string;
  handler: UpgradeHandler;
}

/** webServer 运行时形状的结构镜像（impl-m1.md §2.1）；真实实例运行时满足它。 */
export interface WrappableServer {
  exact: Map<string, WrappableRoute>;
  prefixes: Map<string, WrappableRoute>;
  upgrades: Map<string, WrappableUpgradeRoute>;
  fallback: HttpHandler | undefined;
  register(route: WrappableRoute): () => void;
  registerUpgrade(route: WrappableUpgradeRoute): () => void;
  registerFallback(handler: HttpHandler): () => void;
}

/** 守卫日志的最小表面（自检/诊断用）。 */
export interface GuardLog {
  error(message: unknown): void;
}

interface GuardedFn {
  [GUARDED]?: true;
}

export function isGuarded(target: (...args: never[]) => unknown): boolean {
  return (target as unknown as GuardedFn)[GUARDED] === true;
}

/**
 * 给一个 HTTP handler 套守卫。已守卫（幂等）则原样返回；deny 由守卫写
 * 302/401，不调用原 handler；错误不捕获（交给 webserver 统一处理）。
 */
export function guardHttp(gate: () => Gate, kind: GuardKind, handler: HttpHandler): HttpHandler {
  if (isGuarded(handler)) return handler;
  const guarded = (async (req: IncomingMessage, res: ServerResponse) => {
    const pathname = new URL(req.url ?? "/", "http://x").pathname;
    const decision = await gate().decide(req, kind, pathname);
    if (decision === "allow") {
      await handler(req, res);
      return;
    }
    denyHttp(req, res);
  }) as HttpHandler & GuardedFn;
  guarded[GUARDED] = true;
  return guarded;
}

/**
 * 给一个 upgrade handler 套守卫。deny 在 ws 协商前直接拒握手，不进入
 * 原 handler，也不为 socket 附加任何监听器。
 */
export function guardUpgrade(gate: () => Gate, handler: UpgradeHandler): UpgradeHandler {
  if (isGuarded(handler)) return handler;
  const guarded = (async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const pathname = new URL(req.url ?? "/", "http://x").pathname;
    const decision = await gate().decide(req, "upgrade", pathname);
    if (decision === "allow") {
      await handler(req, socket, head);
      return;
    }
    denyUpgrade(socket);
  }) as UpgradeHandler & GuardedFn;
  guarded[GUARDED] = true;
  return guarded;
}

/**
 * 拒绝一个 HTTP 请求：浏览器导航（GET 且 Accept 含 text/html）→ 302 登录页
 * （带 next 回跳）；其余 → 401。两者都禁缓存。
 */
export function denyHttp(req: IncomingMessage, res: ServerResponse): void {
  res.setHeader("cache-control", "no-store");
  const pathname = new URL(req.url ?? "/", "http://x").pathname;
  const wantsPage = req.method === "GET" && String(req.headers.accept ?? "").includes("text/html");
  if (wantsPage) {
    res.writeHead(302, {
      location: `${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`,
    });
    res.end();
    return;
  }
  res.writeHead(401, { "content-type": "text/plain" });
  res.end("unauthorized");
}

/** 拒绝一个 WS 升级：写 401 响应行后销毁 socket，不进入 ws 协商。 */
export function denyUpgrade(socket: Duplex): void {
  socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
  socket.destroy();
}

const unwrappers = new WeakMap<WrappableServer, () => void>();

/**
 * 包装一个 WrappableServer：存量表 + fallback 原地换守卫，三个注册方法替换为
 * 守卫版本（增量保险，apply 顺序无关）。幂等：同一 server 第二次调用返回同一
 * unwrap。返回的 unwrap 整体回滚（快照 + 原方法）。
 */
export function wrapServer(server: WrappableServer, gate: () => Gate, log: GuardLog): () => void {
  // 规格冻结签名：log 预留给诊断；包装/还原本身静默（自检在 index.ts 负责）。
  void log;
  const existing = unwrappers.get(server);
  if (existing !== undefined) return existing;

  const original = {
    register: server.register.bind(server),
    registerUpgrade: server.registerUpgrade.bind(server),
    registerFallback: server.registerFallback.bind(server),
  };
  const snapshot = {
    exact: new Map(server.exact),
    prefixes: new Map(server.prefixes),
    upgrades: new Map(server.upgrades),
    fallback: server.fallback,
  };

  for (const [path, route] of server.exact) {
    server.exact.set(path, { ...route, handler: guardHttp(gate, "exact", route.handler) });
  }
  for (const [path, route] of server.prefixes) {
    server.prefixes.set(path, {
      ...route,
      handler: guardHttp(gate, route.kind, route.handler),
    });
  }
  for (const [path, route] of server.upgrades) {
    server.upgrades.set(path, { ...route, handler: guardUpgrade(gate, route.handler) });
  }
  if (server.fallback !== undefined) {
    server.fallback = guardHttp(gate, "fallback", server.fallback);
  }

  const register = ((route: WrappableRoute) =>
    original.register({
      ...route,
      handler: guardHttp(gate, route.kind, route.handler),
    })) as WrappableServer["register"] & GuardedFn;
  const registerUpgrade = ((route: WrappableUpgradeRoute) =>
    original.registerUpgrade({
      ...route,
      handler: guardUpgrade(gate, route.handler),
    })) as WrappableServer["registerUpgrade"] & GuardedFn;
  const registerFallback = ((handler: HttpHandler) =>
    original.registerFallback(
      guardHttp(gate, "fallback", handler),
    )) as WrappableServer["registerFallback"] & GuardedFn;
  register[GUARDED] = true;
  registerUpgrade[GUARDED] = true;
  registerFallback[GUARDED] = true;
  server.register = register;
  server.registerUpgrade = registerUpgrade;
  server.registerFallback = registerFallback;

  const unwrap = () => {
    server.exact.clear();
    for (const [path, route] of snapshot.exact) server.exact.set(path, route);
    server.prefixes.clear();
    for (const [path, route] of snapshot.prefixes) server.prefixes.set(path, route);
    server.upgrades.clear();
    for (const [path, route] of snapshot.upgrades) server.upgrades.set(path, route);
    server.fallback = snapshot.fallback;
    server.register = original.register;
    server.registerUpgrade = original.registerUpgrade;
    server.registerFallback = original.registerFallback;
    unwrappers.delete(server);
  };
  unwrappers.set(server, unwrap);
  return unwrap;
}
