import type { IncomingHttpHeaders } from "node:http";

/**
 * 从 Accept-Language 头判断登录页语言（zh 开头 => 中文）。
 * 注意：Node 的 IncomingHttpHeaders 值可能为 string[]（同一个头出现多次），
 * 必须取首个值再匹配（否则 TS 类型接不住，且运行时字符串数组会被正则
 * 隐式转成逗号串导致误判）。
 */
export function langOf(req: { headers?: IncomingHttpHeaders }): string {
  const header = req.headers?.["accept-language"];
  const first = Array.isArray(header) ? (header[0] ?? "") : (header ?? "");
  if (/^\s*zh/i.test(first) || /,\s*zh/i.test(first)) return "zh";
  return "en";
}
