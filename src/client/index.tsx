import type { AuthContext } from "./context.ts";
import { SidebarLogoutAction } from "./logout-action.tsx";

/** 本插件文案的词典命名域（locale 服务按 (ns, locale) 分开注册）。 */
const AUTH_NS = "auth";
/** 命名词典里登出键。 */
const LOGOUT_KEY = "logout";

/**
 * dsh-auth-gate client 半边：认证后在**侧边栏 footer**（「设置」同一脚组）挂一
 * 行「登出 / Sign out」入口——`sidebar.footer.action`（root 作用域、可追加列表槽，
 * 由 ui-sidebar 在侧边栏脚区渲染，与 `sidebar.settings` 的触发行同一分组、不加分隔线）。
 *
 * 换槽对比：不再往会话页 `conversation.session.header.utilities` 和新会话页
 * `shell.overlay` 注册（右上角两处纯图标入口已移除）。文案挂进 dsh 现有的 locale
 * 机制（与「设置」里的语言切换同一套）：注册 `auth` 词典（zh/en），再以
 * `locale: "auth"` 给注册条目注入 `t` seat，行文字随界面语言在「登出」/ "Sign out"
 * 间实时切换。不改任何服务端端点/会话语义。
 */
export const inject = ["slots", "locale"];

export function apply(ctx: AuthContext): void {
  // 词典注册（zh/en 双语，挂 fiber 卸载级联）。
  ctx.effect(
    () => [
      ctx.locale.register(AUTH_NS, "zh", { [LOGOUT_KEY]: "登出" }),
      ctx.locale.register(AUTH_NS, "en", { [LOGOUT_KEY]: "Sign out" }),
    ],
    "auth: logout dictionary",
  );

  // 绑定 translate：读取活动语言（thunk 每次投影重读，跟随语言切换）。
  const t = ctx.locale.bind(AUTH_NS);

  ctx.slots.inject("sidebar.footer.action", () =>
    ctx.slots.register(
      {
        name: "sidebar.footer.action",
        id: "dsh-auth-gate-logout",
        locale: AUTH_NS,
        order: 1,
        label: () => t(LOGOUT_KEY),
      },
      SidebarLogoutAction,
    ),
  );
}
