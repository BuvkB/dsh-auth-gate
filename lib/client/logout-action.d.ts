/** sidebar.footer.action 的 owner props（契约见 Slots 目录：wide=false 为 56px rail）。 */
export interface LogoutActionProps {
    wide: boolean;
}
/**
 * 侧边栏底部登出入口。挂载时 fetch /auth/status 一次（只认 cookie），仅
 * authenticated:true 时渲染；登出走原生 form POST（零 JS 依赖，302 回落
 * / → 门禁 → 登录页）。
 */
export declare function LogoutAction({ wide }: LogoutActionProps): import("react").JSX.Element | null;
//# sourceMappingURL=logout-action.d.ts.map