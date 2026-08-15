# dsh-auth

[English](README.md) | **简体中文**

面向 [DeepSeek Harness](https://github.com/deepseek-ai/dsh) web 表面的应用层认证插件：包装
`webServer` 路由表为登录门，公网部署的 dsh 实例在 agent 平面、会话库与 LLM 凭据可达之前
先被认证门保护。

让 agent 帮你部署：打包 → 装进 dsh profile（`dsh plugin --profile web add <tarball>`）→
用随包 CLI 建 `users.yaml` 凭证 → 挂生产 overlay → 对活实例跑验收清单——
见 [docs/deployment.md](docs/deployment.md)。

## 提供什么

**覆盖 `webServer` 四类入口的守卫**（exact 路由、前缀、fallback、WS 升级），启动自检
fail loud（任何入口未包装即启动失败）。无有效会话的请求被拒绝：浏览器导航 302 到登录页、
API/WS 401/拒握手。**单门模型**：过门 = 完整访问，无用户间隔离
（见 [docs/dsh-auth-plan.md](docs/dsh-auth-plan.md)）。

**两种互斥登录流**（`mode` 二选一）：

| 模式                  | 凭证                                                                        | Bearer 通道                                              | 入口                                                            |
| --------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------- |
| `"token"`（默认，M2） | `$DSH_HOME/.credentials.yaml` 的共享随机 token（env 引用 `DSH_AUTH_TOKEN`） | `Authorization: Bearer <token>`（恒时比较）              | `GET/POST /auth/login`、`POST /auth/logout`、`GET /auth/status` |
| `"password"`（M3）    | `$DSH_HOME/auth/users.yaml` 的用户名/口令（scrypt 哈希）                    | `Authorization: Bearer <会话 token>`（会话查表，可吊销） | 同上四个端点 + `dsh-auth` CLI                                   |

**安全特性**（两模式共有）：

- `HttpOnly; Secure; SameSite=Lax` 会话 cookie（`cookieSecure` 可关，供 http 测试环境）；
  会话 token 只存 SHA-256 摘要；256-bit 随机签发、每次登录新会话（防固定）；
- password 模式：scrypt（`node:crypto`，N=2¹⁶ / r=8 / p=1）、恒时验证 + 未知用户占位哈希
  路径（防枚举）、未知/错口令/禁用统一 401、users 文件每次登录现读（免重启）、0600 权限纪律；
- 登录限速：IP + 账号双桶、指数退避（30s 起、15min 封顶）、锁定期 `429 + retry-after`；
- fail-closed：凭证/users 文件缺失、文件不可解析、会话存储缺失一律拒绝而非静默放行；
  守卫自检未全覆盖即中止启动。

**CLI**（`dsh-auth`，随包 bin）：

```sh
dsh-auth user add admin --password-stdin     # 建用户，哈希写入 users.yaml
dsh-auth user list                            # 列出用户（禁用带标记）
dsh-auth user disable admin                   # 禁用（只拦新登录；已发会话 TTL 内有效）
# 所有子命令支持 --file <path>
```

## 示例流程

典型部署流程（你或你的 agent 执行）：

1. **打包安装** — `npm pack` → `scp dsh-auth-*.tgz server:/tmp/` →
   `dsh plugin --profile web add /tmp/dsh-auth-*.tgz`（转发 pnpm）。
2. **建管理员** — `printf '%s\n' '<强口令>' | dsh-auth user add admin --password-stdin`。
3. **配置** — 把 [deploy/cordis.patch.yml](deploy/cordis.patch.yml) 复制为
   `$DSH_HOME/cordis.patch.yml`；设 `mode: "password"`，TLS 环境保持 `cookieSecure: true`。
4. **验收** — 重启后跑 [docs/deployment.md](docs/deployment.md) §4 序列：未认证请求被拒、
   登录发会话 cookie、Bearer 会话 token 过门、WS 升级需 cookie、登出吊销、连续失败后
   限速返回 `429 + retry-after`。

## 前置条件

- Node ≥ 22.19（与目标 dsh 部署一致）；`dsh plugin add` 需要 pnpm（服务器 npm 全局 prefix
  可能需要 `--prefix ~/.npm-global`）；
- 可用的 dsh web profile；`cookieSecure: true` 需前置 TLS 终结（curl/脚本不受 `Secure` 影响）；
- `--trusted-host` 与认证**正交**：它只是 DNS-rebinding 防栏，不是认证——公网实例两者都要配。

## 安装

包未发布 npm（UNLICENSED），从 tarball 安装：

```sh
# 源机器
npm pack                                  # 产出 dsh-auth-<version>.tgz
scp dsh-auth-<version>.tgz server:/tmp/

# 服务器
dsh plugin --profile web add /tmp/dsh-auth-<version>.tgz
```

升级：重新打包再 add；卸载：`dsh plugin --profile web remove dsh-auth`（并删 overlay 行）。

## 配置

插件行 config（`$DSH_HOME/cordis.patch.yml`）：

| 字段           | 默认               | 说明                                                                         |
| -------------- | ------------------ | ---------------------------------------------------------------------------- |
| `mode`         | `"token"`          | `"token"`（M2 共享 token）或 `"password"`（M3）                              |
| `sessionTtl`   | `604800`           | 会话 TTL（秒），自创建起固定过期                                             |
| `cookieName`   | `dsh_auth`         | 会话 cookie 名                                                               |
| `tokenRef`     | `"DSH_AUTH_TOKEN"` | token 模式：credentials 引用名（环境变量名）                                 |
| `cookieSecure` | `true`             | 加 `; Secure`；仅 http 测试环境关                                            |
| `usersFile`    | `""`               | password 模式：users.yaml 路径；`""` = `${DSH_HOME:-~/.dsh}/auth/users.yaml` |

## 文档

- 路线图与威胁模型：[docs/dsh-auth-plan.md](docs/dsh-auth-plan.md)
- 实施规格（实施唯一权威）：
  [docs/impl-m1.md](docs/impl-m1.md) / [docs/impl-m2.md](docs/impl-m2.md) /
  [docs/impl-m3.md](docs/impl-m3.md)
- 部署与验收清单：[docs/deployment.md](docs/deployment.md) +
  [deploy/cordis.patch.yml](deploy/cordis.patch.yml)
- 开发规范：[docs/development.md](docs/development.md)

## 已知局限

- 禁用用户只拦新登录；已发会话在 TTL 内有效（暂无 `revokeBySubject`）。
- 限速内存态（重启清零），按键为 socket 直连地址——故意不信任 `X-Forwarded-For`，反代部署
  时限速按反代出口 IP 聚合。
- 登录无 CSRF token（单门模型无用户间隔离；`SameSite=Lax` 已覆盖大部分；残余风险 M4 再评估）。
- 暂无 client 半边 GUI（登出按钮）。
