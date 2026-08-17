import type { AuthContext } from "./context.ts";
import { LogoutAction } from "./logout-action.tsx";

/**
 * dsh-auth-gate client 半边：认证后在 GUI 侧边栏底部（sidebar.footer.action，
 * root 级恒显示、可追加）挂一个登出入口。登出语义全部复用服务端冻结端点
 * （POST /auth/logout、GET /auth/status），本半边只负责渲染与门控。
 */
export const inject = ["slots"];

export function apply(ctx: AuthContext): void {
  ctx.slots.inject("sidebar.footer.action", () =>
    ctx.slots.register(
      {
        name: "sidebar.footer.action",
        id: "dsh-auth-gate-logout",
        order: 0,
        label: "Sign out",
      },
      LogoutAction,
    ),
  );
}
