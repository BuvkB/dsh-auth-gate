/**
 * 渲染自包含登录页（内联样式，零第三方资源）。next/error 全部 HTML-escape。
 * `error` 非空时渲染错误行（M2 端点不传 error——该分支保留给后续版本，测试直接覆盖）。
 */
export declare function loginPageHtml(next: string, error?: string): string;
/** password 模式登录页（P13）：username + password 两字段，同款内联样式。 */
export declare function passwordLoginPageHtml(next: string, error?: string): string;
//# sourceMappingURL=login-page.d.ts.map