#!/usr/bin/env node
export interface CliIo {
    out(line: string): void;
    err(line: string): void;
    /** stdin 一行，去尾部 `\r\n`；EOF → ""。 */
    readLine(): Promise<string>;
}
/** 返回进程退出码。所有参数/IO 经 argv/io 注入（可测，禁 console.*）。 */
export declare function main(argv: string[], io: CliIo): Promise<number>;
//# sourceMappingURL=cli.d.ts.map