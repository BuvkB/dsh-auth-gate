# dsh-auth 部署与验收清单

本文档描述如何把 dsh-auth（password 模式，M3）部署到一个公网 dsh web 实例，并完成
**部署验收**。适用于：实例已跑通 dsh web（`dsh --profile web`），需要加认证门。

设计依据：`docs/dsh-auth-plan.md` §7/§8（无上游 PR 通道的限制、纵深防御）；
规格：`docs/impl-m2.md`（token 模式）、`docs/impl-m3.md`（password 模式）。
**两个模式二选一**：下面按 password 模式（推荐，M3）编写；token 模式只需跳过
"建用户"一步并配置 `tokenRef`。

---

## 0. 前置条件

- **TLS 前置终结**（Nginx/Caddy 反代或 LB）：`cookieSecure: true` 依赖 https，否则浏览器
  不保存会话 cookie（curl/脚本不受影响）。http-only 环境只能 `cookieSecure: false`（仅测试）。
- **`--trusted-host` 与认证正交**：`--trusted-host` 只是 DNS-rebinding 防栏，不是认证；
  两者都需配置。公网实例：`--trusted-host <域名>` 指到你的域名。
- **低权限 OS 用户**运行 dsh（无 sudo、无其他项目文件）——plan §8 纵深防御第 1 条。
- **服务器有 Node ≥ 22.19**（与部署一致）与 pnpm（`dsh plugin` 转发 pnpm）。实测：npm 默认
  global prefix 是 `/usr`（无 root 权限装不了），用
  `npm i -g pnpm --prefix ~/.npm-global` 并 `export PATH="$HOME/.npm-global/bin:$PATH"`
  （`dsh` 本身也装在这个 prefix，见 `docs/handoff-m2.md` §3.2）。

---

## 1. 安装 dsh-auth（一次性）

包已发布到 npm（`dsh-auth-gate`），一条命令装进目标 profile：

```bash
# 服务器（$DSH_HOME 指向目标实例，如 ~/.dsh 或隔离目录）：
export PATH="$HOME/.npm-global/bin:$PATH"
dsh plugin --profile web add dsh-auth-gate   # 转发 pnpm，从公共 npm 解析（实测）
```

- 安装后 `$DSH_HOME/profiles/web/package.json` 的 `dependencies` 含 `dsh-auth-gate`；
  依赖（`yaml`、`@deepseek-ai/*`）自动从公共 npm 解析。
- 升级：重跑同一命令（pnpm 拉新版本）。
- 卸载：`dsh plugin --profile web remove dsh-auth-gate`（同时删 overlay 行）。

## 2. 配置

1. **建管理员**（`users.yaml` 自动创建于 `$DSH_HOME/auth/users.yaml`，0600）：
   ```bash
   printf '%s\n' '<强口令>' | dsh-auth user add admin --password-stdin
   dsh-auth user list                    # 确认
   ```
   多管理员：重复 `user add`；禁用：`dsh-auth user disable <name>`。
2. **overlay**：把仓库 `deploy/cordis.patch.yml` 复制为 `$DSH_HOME/cordis.patch.yml`，
   按需调整（`cookieSecure` 必须与 TLS 环境一致；非默认路径才设 `usersFile`）。
3. 确认无其他行占用 `dsh-auth` id（patch 栈按 id 覆盖）。

## 3. 启动与健康检查

```bash
cd "$DSH_HOME" && DSH_HOME="$DSH_HOME" setsid dsh --profile web --port 3081 \
  > ~/dsh.log 2>&1 < /dev/null &                         # 等 ~25s
tail -f ~/dsh.log                                        # 期望：无 error
```

（实测：SSH 会话里 `nohup ... &` 可能因子进程持有 fd 让 ssh 挂起 2 分钟——**挂起不代表失败**，
`setsid` 可立即返回；启动后另开连接检查 `pgrep` 与端口。停止：
`pkill -f "[d]sh --profile web"`——括号技巧防自杀，kill 与启动分两个连接。）

启动自检（M1）：四类入口未全覆盖会 **fail loud**（进程启动失败并报
`guard self-check failed`）——启动成功即守卫在位。日志应出现
`session domain opened: dsh_auth_sessions`；无 `user store unavailable` /
`users file not found`（首次登录前该 warn 正常——文件缺失=空用户集，fail-closed）。

## 4. 验收清单（部署后逐项执行）

服务器本机（或经 SSH 隧道）执行。`jar` 是 curl cookie jar；`<TOKEN>` 是登录响应
`set-cookie` 里的 `dsh_auth` 值（43 字符）。

```bash
# A. 登录页与守卫
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3081/auth/login          # 200
curl -s http://127.0.0.1:3081/auth/login | grep -o 'name="username"'                # 命中

# B. 未认证拒绝（导航 302 / API 401）
curl -s -o /dev/null -w "%{http_code}\n" -H "Accept: text/html" http://127.0.0.1:3081/__dsh_api  # 302
curl -s -o /dev/null -w "%{http_code}\n" -H "Accept: application/json" http://127.0.0.1:3081/__dsh_api  # 401

# C. 登录（错 → 401；对 → 302 + set-cookie）
curl -s -o /dev/null -w "%{http_code}\n" -d "username=admin&password=wrong" http://127.0.0.1:3081/auth/login  # 401
curl -s -i -d "username=admin&password=<口令>" -c jar http://127.0.0.1:3081/auth/login | head -3  # 302 + set-cookie

# D. 会话 cookie 与 Bearer 会话 token
curl -s -o /dev/null -w "%{http_code}\n" -b jar http://127.0.0.1:3081/__dsh_api      # 200
curl -s -b jar http://127.0.0.1:3081/auth/status                                     # {"authenticated":true}
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <TOKEN>" http://127.0.0.1:3081/__dsh_api  # 200

# E. 路由纪律（/auth 兜底不落 SPA fallback；method 纪律）
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3081/auth/whatever         # 404
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://127.0.0.1:3081/auth/login  # 405

# F. WS 升级通道（首行状态即可；--max-time 超时退出正常）
curl --http1.1 -s -i --max-time 2 -b jar -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" -H "Sec-WebSocket-Version: 13" \
  http://127.0.0.1:3081/api/events.host | head -1                                    # 101
# 无 cookie 变体 → 首行 401

# G. 登出与吊销
curl -s -i -X POST "http://127.0.0.1:3081/auth/logout?next=/" -b jar | head -3        # 302 + Max-Age=0
curl -s -o /dev/null -w "%{http_code}\n" -b jar http://127.0.0.1:3081/__dsh_api      # 401

# H. 限速（放在最后——锁定 30s 起）
for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code}\n" -d "username=admin&password=wrong" \
  http://127.0.0.1:3081/auth/login; done       # 第 1~N 次 401，锁定后 429（IP 桶会累计此前失败）
curl -s -i -d "username=admin&password=<口令>" http://127.0.0.1:3081/auth/login | head -3  # 429 + retry-after

# I. 浏览器通路（可选，须 https 环境）：无痕窗口访问 → 302 到 /auth/login →
#    登录 → 进入实例；登出按钮未实现，URL 访问 /auth/logout?next=/ 登出。
```

预期全绿 = 部署验收通过。**全部失败路径必须是失败**（401/403 语义不吞错）——任何"静默放行"
（未认证拿到 200/101）都是部署错误。实测注：`cookieSecure: true` 只影响浏览器（curl 的
cookie jar 不检查 `Secure`，验收序列照常）；H 组的锁定次数会累计此前步骤的失败（如 C 的
`wrong` 一次）——以 `429 + retry-after` 出现为准。

## 5. 升级与回归（dsh 升级必做）

守卫包装依赖 `webServer` 非契约内部结构（plan §7）——**每次 dsh 升级后**：

1. 启动（§3）——自检 fail loud 即失败；
2. 跑验收清单 B/D/F 三组（守卫 + 会话 + WS）；
3. 检查 `boot.log` 无新增 error/warn。

## 6. 故障诊断

| 症状                               | 原因                                              | 处理                                              |
| ---------------------------------- | ------------------------------------------------- | ------------------------------------------------- |
| 启动失败 `guard self-check failed` | 包装未覆盖全部入口（dsh 版本变化）                | 升级 dsh-auth 或报告（勿绕过自检）                |
| 登录恒 401                         | 口令错误 / 用户禁用 / users.yaml 缺失（空用户集） | `dsh-auth user list`；确认 `$DSH_HOME` 与实例一致 |
| 登录 503 `user store unavailable`  | users.yaml 语法/schema 错、权限过宽（非 600）     | `chmod 600`；`dsh-auth user list` 复现错误信息    |
| 登录 429                           | 限速锁定（内存态，重启清零）                      | 等 `retry-after` 或重启实例                       |
| 浏览器登录后仍被拒                 | `cookieSecure: true` 但无 https                   | 补 TLS 前置，或临时 false（仅测试）               |
| 认证后 API 仍 401                  | 反代没透传 cookie/Authorization                   | 检查反代 header 透传配置                          |

## 7. 安全注意事项（plan §8 落地清单）

- [ ] `$DSH_HOME/.credentials.yaml` 与 `auth/users.yaml` 均 `chmod 600`（dsh-auth CLI 自动 600）。
- [ ] 会话日志视同含密材料（备份/共享同等防护）。
- [ ] 升级回归（§5）纳入运维流程；auth 行健康检查（`boot.log` + 验收 B/D/F）纳入监控。
- [ ] 口令哈希为 scrypt（`docs/impl-m3.md` P1）；文件零明文。
- [ ] 禁用用户只拦新登录（已发会话 TTL 内有效，M3 已知局限）。
- [ ] 限速内存态重启清零；反代部署时限速按出口 IP 聚合（不信任 X-Forwarded-For）。
