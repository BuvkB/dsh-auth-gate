import type { AuthContext } from "./context.ts";
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
export declare const inject: string[];
export declare function apply(ctx: AuthContext): void;
//# sourceMappingURL=index.d.ts.map