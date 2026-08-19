/** 会话头部右上角登出入口（conversation.session.header.utilities，session 作用域）。 */
export declare function LogoutAction(): import("react").JSX.Element | null;
/**
 * 会话快照的本地最小镜像（root 槽位 shell.overlay 的 standard hook 输入）。
 * 见 SessionListState：`current` 为持久化的当前会话选择；`byId[id].blank` 为空
 * 会话标记（Empty-log bit——New Session 复用一个 blank 会话作为 current）。
 */
interface HeroSessionsState {
    current?: string;
    byId?: Record<string, {
        blank?: boolean;
    }>;
}
/**
 * 新会话页（hero 空态 / 空白会话，还没有输入与响应）右上角的浮动登出入口：
 * root 级 shell.overlay 注册。仅当 **不是真实会话**（无当前会话，或当前会话仍为
 * blank）且已认证时渲染——因为 blank 会话的 session header 是隐藏的（头部按钮
 * 不可见），此时由本浮动按钮补齐；一旦存在真实（非空）会话则交回会话头部入口。
 */
export interface HeroLogoutActionProps {
    /** root 槽位 standard hook：selector 读取会话快照。缺席或非函数时按 hero 处理。 */
    useSessions?: (selector: (state: HeroSessionsState) => unknown) => unknown;
}
export declare function HeroLogoutAction({ useSessions }: HeroLogoutActionProps): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=logout-action.d.ts.map