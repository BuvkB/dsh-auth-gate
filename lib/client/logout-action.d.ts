/** 槽位渲染器按注册 `locale` 注入的 translate 形（本插件 `auth` 词典的 `logout` 键）。 */
export type LogoutTranslate = (key: string, params?: Record<string, unknown>) => string;
/** 侧边栏 footer 登出行组件（sidebar.footer.action 槽，root 作用域）。 */
export interface SidebarLogoutActionProps {
    /** 侧边栏显示态：宽列（false = 56px rail，只画图标列）。 */
    wide?: boolean;
    /** 注入的本地化 translate（locale seat）。 */
    t?: LogoutTranslate;
}
/**
 * 可复用的登出提交行：原生 form POST（零 JS 依赖）+ 16px 方块图标 + 本地化文字 + 主题 hover。
 * 渲染进 `sidebar.footer.action`（侧边栏 footer 的可追加列表槽）——「设置」同一脚组。
 */
export declare function SidebarLogoutAction({ t }: SidebarLogoutActionProps): import("react").JSX.Element | null;
//# sourceMappingURL=logout-action.d.ts.map