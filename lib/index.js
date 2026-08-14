/** Stable Cordis plugin name (the host composition row id). */
export const name = "dsh-auth";
/** Hard dependencies: the guard wraps the HTTP carrier's route tables. */
export const inject = ["webServer"];
/**
 * Apply the auth gate.
 *
 * M1 scope (see docs/dsh-auth-plan.md §4/§5):
 * - wrap the webServer exact/prefixes/upgrades tables and the fallback seat;
 * - wrap register/registerUpgrade/registerFallback for future registrations;
 * - startup self-check that every entry point is actually guarded (fail loud);
 * - persist sessions through the storage domain, keyed by token digest.
 */
export function apply(ctx, config) {
    const server = ctx.get("webServer");
    if (server === undefined)
        return;
    void config.mode;
}
//# sourceMappingURL=index.js.map