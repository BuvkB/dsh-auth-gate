import { useEffect, useState, type CSSProperties } from "react";

/** 登出按钮的可访问名（rail 模式文字视觉隐藏，按钮仍以 aria-label 命名）。 */
const SIGN_OUT_LABEL = "Sign out";

/** 登出目标：POST-only（M22：next 仅从 query 取，校验回落 /）。 */
const LOGOUT_TARGET = "/auth/logout?next=/";

const LOGOUT_ICON = (
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

/** sidebar.footer.action 的 owner props（契约见 Slots 目录：wide=false 为 56px rail）。 */
export interface LogoutActionProps {
  wide: boolean;
}

const formStyle: CSSProperties = {
  display: "contents",
};

const buttonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  height: 32,
  padding: "0 10px",
  border: 0,
  borderRadius: 6,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  fontSize: 13,
};

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
      <button type="submit" aria-label={SIGN_OUT_LABEL} title={SIGN_OUT_LABEL} style={buttonStyle}>
        {LOGOUT_ICON}
        <span style={wide ? undefined : visuallyHiddenStyle}>{SIGN_OUT_LABEL}</span>
      </button>
    </form>
  );
}
