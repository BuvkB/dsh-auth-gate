import { useEffect, useState, type CSSProperties } from "react";

/** 登出按钮的可访问名（rail 模式文字视觉隐藏，按钮仍以 aria-label 命名）。 */
const SIGN_OUT_LABEL = "Sign out";

/** 登出目标：POST-only（M22：next 仅从 query 取，校验回落 /）。 */
const LOGOUT_TARGET = "/auth/logout?next=/";

/** 登出图标：尺寸随 wide/rail 两态变化（16px / 18px），对齐 settings.trigger 图标尺寸节奏。 */
function renderLogoutIcon(size: number) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/** sidebar.footer.action 的 owner props（契约见 Slots 目录：wide=false 为 56px rail）。 */
export interface LogoutActionProps {
  wide: boolean;
}

const formStyle: CSSProperties = {
  display: "contents",
};

/** hover 态背景色，取自 settings.trigger 实测计算样式（rgba(38, 49, 72, 0.06)）。 */
const HOVER_BACKGROUND = "rgba(38, 49, 72, 0.06)";

/** 与 settings.trigger 两态实测样式对齐：wide 为通栏行按钮，rail 为 36px 圆形图标按钮。 */
function getButtonStyle(wide: boolean, hovered: boolean): CSSProperties {
  const shared: CSSProperties = {
    display: "flex",
    alignItems: "center",
    border: 0,
    background: hovered ? HOVER_BACKGROUND : "transparent",
    color: "inherit",
    cursor: "pointer",
    font: "inherit",
    fontSize: 14,
    lineHeight: "22px",
    boxSizing: "border-box",
  };
  if (wide) {
    return {
      ...shared,
      gap: 8,
      height: 34,
      width: "100%",
      padding: "6px 2px 6px 10px",
      margin: "4px -4px",
      borderRadius: 12,
    };
  }
  return {
    ...shared,
    gap: 0,
    justifyContent: "center",
    height: 36,
    width: 36,
    padding: 0,
    margin: "8px 0 10px",
    borderRadius: "50%",
  };
}

const visuallyHiddenStyle: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/**
 * 侧边栏底部登出入口。挂载时 fetch /auth/status 一次（只认 cookie），仅
 * authenticated:true 时渲染；登出走原生 form POST（零 JS 依赖，302 回落
 * / → 门禁 → 登录页）。
 */
export function LogoutAction({ wide }: LogoutActionProps) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/auth/status")
      .then((res) => res.json())
      .then((body: { authenticated?: unknown }) => {
        if (!cancelled) setAuthenticated(body.authenticated === true);
      })
      .catch(() => {
        if (!cancelled) setAuthenticated(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (authenticated !== true) return null;
  return (
    <form method="post" action={LOGOUT_TARGET} style={formStyle}>
      <button
        type="submit"
        aria-label={SIGN_OUT_LABEL}
        title={SIGN_OUT_LABEL}
        style={getButtonStyle(wide, hovered)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {renderLogoutIcon(wide ? 16 : 18)}
        <span style={wide ? undefined : visuallyHiddenStyle}>{SIGN_OUT_LABEL}</span>
      </button>
    </form>
  );
}
