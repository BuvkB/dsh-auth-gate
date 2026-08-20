import { useEffect, useState, type CSSProperties } from "react";

/** 登出目标：POST-only（M22：next 仅从 query 取，校验回落 /）。 */
const LOGOUT_TARGET = "/auth/logout?next=/";

/**
 * 登出图标：16px 列表行图标（viewBox 24 不变，只设 width/height 16）。
 * 沿用原 32px 圆形按钮的同一个 SVG（方框 + 箭头）。
 */
function renderLogoutIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
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

/**
 * hover 态背景色：与侧边栏其他交互行同主题 token
 * `var(--dsw-alias-interactive-bg-hover)`（浅主题 rgba(38,49,72,.06)，
 * 深主题 rgba(255,255,255,.08)）。
 */
const HOVER_BACKGROUND = "var(--dsw-alias-interactive-bg-hover)";

/**
 * 侧边栏 footer 登出行的基础样式：普通列表行（与「设置」同一行语言）——
 * 16px 图标 + 文字标签，display:flex；align-items:center；gap:9px；
 * padding:9px 8px；border-radius:8px。
 */
const ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 9,
  padding: "9px 8px",
  borderRadius: 8,
  width: "100%",
  boxSizing: "border-box",
  color: "var(--dsw-alias-label-primary)",
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: 14,
  lineHeight: 20,
  textAlign: "left",
};

const labelWrapStyle: CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const formStyle: CSSProperties = {
  display: "contents",
};

/**
 * 会话状态门控：挂载时 fetch /auth/status 一次（只认 cookie）。
 * @returns authenticated：null = 未知（第一次请求前），true/false。
 */
function useAuthenticated(): boolean | null {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
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
  return authenticated;
}

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
export function SidebarLogoutAction({ t }: SidebarLogoutActionProps) {
  const authenticated = useAuthenticated();
  const [hovered, setHovered] = useState(false);
  if (authenticated !== true) return null;
  const label = typeof t === "function" ? t("logout") : "Sign out";
  return (
    <form method="post" action={LOGOUT_TARGET} style={formStyle}>
      <button
        type="submit"
        aria-label={label}
        title={label}
        style={{
          ...ROW_STYLE,
          background: hovered ? HOVER_BACKGROUND : "transparent",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {renderLogoutIcon()}
        <span style={labelWrapStyle}>{label}</span>
      </button>
    </form>
  );
}
