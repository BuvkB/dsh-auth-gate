#!/usr/bin/env node
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";
import { hashPassword } from "./password.js";
import {
  compareNames,
  defaultUsersFilePath,
  loadUsersFile,
  USERNAME_RE,
  UsersFileError,
  writeUsersFile,
  type UsersSnapshot,
} from "./users-file.js";

export interface CliIo {
  out(line: string): void;
  err(line: string): void;
  /** stdin 一行，去尾部 `\r\n`；EOF → ""。 */
  readLine(): Promise<string>;
}

const USAGE = `Usage:
  dsh-auth user add <name> --password-stdin [--disabled] [--file <path>]
  dsh-auth user list [--file <path>]
  dsh-auth user disable <name> [--file <path>]`;

const defaultIo: CliIo = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
  readLine: async () => {
    // asyncIterator 顺序保证：once 监听器在"数据先于 createInterface 到达并 EOF"时
    // close 可能先于 line（实测管道输入偶发返回空串——M3 服务器冒烟踩坑）。
    const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    for await (const line of lines) return line;
    return "";
  },
};

/** 返回进程退出码。所有参数/IO 经 argv/io 注入（可测，禁 console.*）。 */
export async function main(argv: string[], io: CliIo): Promise<number> {
  const file = pickFile(argv);
  if (file === undefined) {
    io.err(USAGE);
    return 1;
  }
  const tokens = argv.filter((token) => token !== "--file");
  const sub = tokens[0];
  if (sub !== "user") {
    io.err(USAGE);
    return 1;
  }
  const command = tokens[1];
  if (command === "add")
    return addUser(
      file,
      tokens[2],
      argv.includes("--password-stdin"),
      argv.includes("--disabled"),
      io,
    );
  if (command === "list") return listUsers(file, io);
  if (command === "disable") return disableUser(file, tokens[2], io);
  io.err(USAGE);
  return 1;
}

/** 扫描 `--file <path>`；缺失 → 默认路径；`--file` 后无值 → undefined（usage 错误）。 */
function pickFile(argv: string[]): string | undefined {
  const at = argv.indexOf("--file");
  if (at === -1) return defaultUsersFilePath();
  const value = argv[at + 1];
  if (value === undefined || value.startsWith("--")) return undefined;
  return value;
}

async function addUser(
  file: string,
  name: string | undefined,
  hasStdin: boolean,
  disabled: boolean,
  io: CliIo,
): Promise<number> {
  if (name === undefined || !USERNAME_RE.test(name)) {
    io.err(USAGE);
    return 1;
  }
  if (!hasStdin) {
    io.err(USAGE);
    return 1;
  }
  const snapshot = await loadSnapshot(file, io);
  if (snapshot === undefined) return 1;
  if (snapshot.users.has(name)) {
    io.err(`user ${name} already exists`);
    return 1;
  }
  const password = await io.readLine();
  if (password === "") {
    io.err("empty password");
    return 1;
  }
  try {
    snapshot.users.set(name, { passwordHash: await hashPassword(password), disabled });
    await writeUsersFile(file, snapshot);
  } catch (error) {
    io.err(errorMessage(error));
    return 1;
  }
  io.out(`user ${name} added`);
  return 0;
}

async function listUsers(file: string, io: CliIo): Promise<number> {
  const snapshot = await loadSnapshot(file, io);
  if (snapshot === undefined) return 1;
  const names = [...snapshot.users.keys()].sort(compareNames);
  for (const name of names) {
    const user = snapshot.users.get(name);
    io.out(user?.disabled === true ? `${name} (disabled)` : name);
  }
  return 0;
}

async function disableUser(file: string, name: string | undefined, io: CliIo): Promise<number> {
  if (name === undefined) {
    io.err(USAGE);
    return 1;
  }
  const snapshot = await loadSnapshot(file, io);
  if (snapshot === undefined) return 1;
  const user = snapshot.users.get(name);
  if (user === undefined) {
    io.err(`user not found`);
    return 1;
  }
  try {
    snapshot.users.set(name, { ...user, disabled: true });
    await writeUsersFile(file, snapshot);
  } catch (error) {
    io.err(errorMessage(error));
    return 1;
  }
  io.out(`user ${name} disabled`);
  return 0;
}

async function loadSnapshot(file: string, io: CliIo): Promise<UsersSnapshot | undefined> {
  try {
    return (await loadUsersFile(file)).snapshot;
  } catch (error) {
    io.err(errorMessage(error));
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof UsersFileError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main(process.argv.slice(2), defaultIo).then((code) => {
    process.exitCode = code;
  });
}
