const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);
}

/**
 * 渲染自包含登录页（内联样式，零第三方资源）。next/error 全部 HTML-escape。
 * `error` 非空时渲染错误行（M2 端点不传 error——该分支保留给后续版本，测试直接覆盖）。
 */
export function loginPageHtml(next: string, error?: string): string {
  const errorHtml = error === undefined ? "" : `<p class="error">${escapeHtml(error)}</p>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Unlock</title>
<style>
  body { font-family: system-ui, sans-serif; background: #f4f4f5; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: #fff; border: 1px solid #e4e4e7; border-radius: 8px; padding: 32px; width: 320px; box-shadow: 0 1px 3px rgb(0 0 0 / 8%); }
  h1 { font-size: 18px; margin: 0 0 16px; }
  label { display: block; font-size: 14px; margin-bottom: 12px; }
  input[type="password"] { width: 100%; box-sizing: border-box; padding: 8px; margin-top: 4px; border: 1px solid #d4d4d8; border-radius: 4px; }
  button { width: 100%; padding: 8px; border: 0; border-radius: 4px; background: #2563eb; color: #fff; font-size: 14px; cursor: pointer; }
  .error { color: #b91c1c; font-size: 13px; margin: 0 0 12px; }
</style>
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
