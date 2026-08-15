# dsh-auth

dsh web 的应用层认证插件：为公网部署的 dsh web 实例提供登录门（随机 token →
账号口令 → OTP），保护 agent 平面、会话库与 LLM 凭据不被未授权访问。

- 可行性规划与分阶段路线：[docs/dsh-auth-plan.md](docs/dsh-auth-plan.md)
- M1/M2/M3 实施规格（executable spec，编码代理的唯一执行依据）：
  [docs/impl-m1.md](docs/impl-m1.md) / [docs/impl-m2.md](docs/impl-m2.md) /
  [docs/impl-m3.md](docs/impl-m3.md)
- 交接文档：[docs/handoff-m2.md](docs/handoff-m2.md)
- 开发规范与工程门禁：[docs/development.md](docs/development.md)
- 供 AI 编码代理的仓库规则：[AGENTS.md](AGENTS.md)

## 快速开始

```bash
npm install
npm run verify   # format:check + lint + type-check + test:coverage（80% 红线）
npm run build    # tsc 产物输出到 lib/
```

Node ≥ 22.19；提交受 husky + commitlint 约束（Conventional Commits）。

## 配置

插件行 config（`cordis.patch.yml` 的 `dsh-auth` 行）：

| 字段           | 默认               | 说明                                                                         |
| -------------- | ------------------ | ---------------------------------------------------------------------------- |
| `mode`         | `"token"`          | `"token"`（M2 共享 token 门）或 `"password"`（M3 账号口令门）                |
| `sessionTtl`   | `604800`           | 会话 TTL（秒），自创建起固定过期                                             |
| `cookieName`   | `"dsh_auth"`       | 会话 cookie 名                                                               |
| `tokenRef`     | `"DSH_AUTH_TOKEN"` | token 模式：credentials 引用名（环境变量名）                                 |
| `cookieSecure` | `true`             | 生产保持 `true`；http 测试/开发环境关（`false` 省略 `; Secure`）             |
| `usersFile`    | `""`               | password 模式：users.yaml 路径；`""` = `${DSH_HOME:-~/.dsh}/auth/users.yaml` |

两模式二选一（不可并存）。password 模式下 `tokenRef` 被忽略、不访问 credentials 服务。

## password 模式（M3）

- 凭证文件 `$DSH_HOME/auth/users.yaml`（`version: 1` + `users` 映射，`chmod 600`）；
  **该文件归 `dsh-auth` CLI 管**——CLI 重写时注释不保留，勿手写注释/手工编辑哈希。
- 管理 CLI（与插件同一安装，bin 名 `dsh-auth`）：

  ```bash
  dsh-auth user add admin --password-stdin            # 从 stdin 读一行口令
  dsh-auth user list                                   # 用户名（禁用带标记）
  dsh-auth user disable admin                          # 禁用（只拦新登录）
  # 全部子命令支持 --file <path> 指定 users.yaml
  ```

- 登录：`GET /auth/login` 自包含页面；`POST /auth/login`（`username`/`password`）成功
  发持久化会话 cookie（subject = 用户名，审计用）；`Authorization: Bearer <会话 token>`
  直接通过守卫（会话查表，可吊销可过期；脚本可从登录响应的 cookie 里取 token）。
- 登录限速：IP + 账号双桶，5 次失败后指数退避锁定（30s 起、900s 封顶），锁定返回
  `429 + retry-after`；限速与计数**内存态，重启清零**。
- 口令哈希：`node:crypto` scrypt（N=2¹⁶, r=8, p=1, 32 字节 key），存储格式
  `scrypt$<N>$<r>$<p>$<salt b64url>$<hash b64url>`；未知用户/错口令/禁用用户统一 401
  （防枚举，未知用户做恒时占位验证）。

## 已知局限

- 禁用用户只拦新登录：已发会话在 TTL 内继续有效（无 `revokeBySubject`）。
- 限速不跨进程/重启；IP 取 socket 直连地址，不信任 `X-Forwarded-For`（反代部署时
  限速按反代出口 IP 聚合）。
- 无登录 CSRF token（单门模型无用户间隔离，`SameSite=Lax` 已覆盖大部分；残余风险
  留 M4 评估）。
- 认证后的 `client` 半边（GUI 登出按钮）尚未实现。
