import type { Context } from "@deepseek-ai/cordis";
/** Stable Cordis plugin name (the host composition row id). */
export declare const name = "dsh-auth";
/** Hard dependencies: the guard wraps the HTTP carrier's route tables. */
export declare const inject: string[];
/** Plugin configuration. M1 freezes the exact schema (mode, session TTL, ...). */
export interface AuthConfig {
    /** Authentication flow: shared token (M2) or per-admin credentials (M3). */
    mode: "token" | "password";
}
/**
 * Apply the auth gate.
 *
 * M1 scope (see docs/dsh-auth-plan.md §4/§5):
 * - wrap the webServer exact/prefixes/upgrades tables and the fallback seat;
 * - wrap register/registerUpgrade/registerFallback for future registrations;
 * - startup self-check that every entry point is actually guarded (fail loud);
 * - persist sessions through the storage domain, keyed by token digest.
 */
export declare function apply(ctx: Context, config: AuthConfig): void;
//# sourceMappingURL=index.d.ts.map