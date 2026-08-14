import z from "@deepseek-ai/schemastery";
import { noopGate } from "./gate.js";
import { wrapServer } from "./guard.js";
import { assertGuarded } from "./self-check.js";
import { sessionDomainSpec, SessionStore } from "./session-store.js";
/** 稳定 Cordis 插件名（host 组合行 id）。 */
export const name = "dsh-auth";
/** 硬依赖：守卫包装 webServer 的路由表；storageDomain 软读（见 apply）。 */
export const inject = ["webServer"];
export const Config = z.object({
    mode: z.union([z.const("token"), z.const("password")]).default("token"),
    sessionTtl: z.natural().default(604800),
    cookieName: z.string().default("dsh_auth"),
});
/**
 * 应用 auth 门：提供 auth 服务 → 软接会话层（storage domain）→ 包装 webServer
 * 四类入口 → 启动自检（未全覆盖 = fail loud，fiber 启动失败即裸奔可见）。
 */
export function apply(ctx, config) {
    // M2/M3 消费 mode/cookieName，M2 起按 sessionTtl 建会话；M1 门惰性，无消费方。
    void config;
    const server = ctx.get("webServer");
    if (server === undefined)
        return;
    const log = ctx.logger("dsh-auth");
    const auth = { sessions: undefined, gate: noopGate };
    ctx.provide("auth", auth);
    // storageDomain 类型来自 @deepseek-ai/dsh-storage-domain 的 cordis 增强。
    const storageDomain = ctx.get("storageDomain");
    if (storageDomain === undefined) {
        log.error("storage-domain is unavailable: session persistence is disabled (guards stay mounted)");
    }
    else {
        ctx.effect(() => {
            let closed = false;
            const opening = storageDomain.open(sessionDomainSpec);
            const ready = opening.then((domain) => {
                if (closed) {
                    void domain.close();
                    return;
                }
                auth.sessions = new SessionStore(domain.table("sessions"));
                log.info("session domain opened: dsh_auth_sessions");
            }, (error) => {
                log.error(`session domain open failed: ${error instanceof Error ? error.message : String(error)}`);
            });
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
        for (const failure of failures)
            log.error(`unwrapped entry: ${failure}`);
        throw new Error(`dsh-auth: guard self-check failed: ${failures.join(", ")}`);
    }
}
//# sourceMappingURL=index.js.map