import type { AuthContext } from "./context.ts";
/**
 * dsh-auth-gate client 半边：认证后在**设置面板**（设置 → 通用设置 页底部）挂一
 * 个醒目的「退出登录 / Sign out」按钮——`settings.general.item`（root 作用域、
 * 可追加列表槽，由 ui-settings-general 的 General 页堆叠渲染，order 30 排在
 * 现有设置行（Agent 预设/权限/语言/外观/Enter 行为）之后、页面最底部）。
 *
 * 换槽对比：不再往会话页 `conversation.session.header.utilities`、新会话页
 * `shell.overlay` 注册（右上角两处入口已移除），也不占侧边栏 footer 脚区。
 * 文案挂进 dsh 现有的 locale 机制（与「设置」里的语言切换同一套）：注册 `auth`
 * 词典（zh/en），再以 `locale: "auth"` 给注册条目注入 `t` seat，按钮文字随界面
 * 语言在「退出登录」/ "Sign out" 间实时切换。不改任何服务端端点/会话语义。
 */
export declare const inject: string[];
export declare function apply(ctx: AuthContext): void;
//# sourceMappingURL=index.d.ts.map