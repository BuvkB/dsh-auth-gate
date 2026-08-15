const HTML_ESCAPES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}
/** 登录卡片样式（token/password 两版共用；零第三方资源）。 */
const CARD_STYLE = `
  body { font-family: system-ui, sans-serif; background: #f4f4f5; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 32px; width: 320px; box-shadow: 0 1px 3px rgb(0 0 0 / 8%); }
  h1 { font-size: 18px; margin: 0 0 16px; }
  label { display: block; font-size: 14px; margin-bottom: 12px; }
  input { width: 100%; box-sizing: border-box; padding: 8px; margin-top: 4px; border: 1px solid #d4d4d8; border-radius: 4px; }
  button { width: 100%; padding: 8px; border: 0; border-radius: 4px; background: #2563eb; color: #fff; font-size: 14px; cursor: pointer; }
  .error { color: #b91c1c; font-size: 13px; margin: 0 0 12px; }
`;
/**
 * 渲染自包含登录页（内联样式，零第三方资源）。next/error 全部 HTML-escape。
 * `error` 非空时渲染错误行（M2 端点不传 error——该分支保留给后续版本，测试直接覆盖）。
 */
export function loginPageHtml(next, error) {
    const errorHtml = error === undefined ? "" : `<p class="error">${escapeHtml(error)}</p>`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unlock</title>
<style>${CARD_STYLE}</style>
</head>
<body>
<main class="card">
<h1>Unlock</h1>
${errorHtml}<form method="post" action="/auth/login">
<input type="hidden" name="next" value="${escapeHtml(next)}">
<label>Token<input type="password" name="token" autocomplete="current-password" required autofocus></label>
<button type="submit">Unlock</button>
</form>
</main>
</body>
</html>
`;
}
/** password 模式登录页（P13）：username + password 两字段，同款内联样式。 */
export function passwordLoginPageHtml(next, error) {
    const errorHtml = error === undefined ? "" : `<p class="error">${escapeHtml(error)}</p>`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in</title>
<style>${CARD_STYLE}</style>
</head>
<body>
<main class="card">
<h1>Sign in</h1>
${errorHtml}<form method="post" action="/auth/login">
<input type="hidden" name="next" value="${escapeHtml(next)}">
<label>Username<input type="text" name="username" autocomplete="username" required></label>
<label>Password<input type="password" name="password" autocomplete="current-password" required autofocus></label>
<button type="submit">Sign in</button>
</form>
</main>
</body>
</html>
`;
}
//# sourceMappingURL=login-page.js.map