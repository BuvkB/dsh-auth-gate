# dsh-auth-gate

[English](README.md) | **简体中文**

给 [DeepSeek Harness](https://github.com/deepseek-ai/dsh)（dsh）网页版加一道登录门。部署到
公网 dsh 实例前面之后，不登录就没人能碰到你的 agent、聊天会话和 LLM 凭证。

## 它能做什么

- **所有访问都要先登录。** 每个页面、每个 API 调用、每条 WebSocket 连接都会检查；
  没有有效会话的访客会被带到简单的登录页（API/脚本请求则返回 `401`）。
- **两种登录方式**（配置里二选一）：
  - **密码**（推荐）：每个管理员一个用户名和密码。
  - **令牌**：整个实例共用一个秘密令牌。
- **浏览器和脚本都能用。** 浏览器走登录页；脚本和 curl 直接带
  `Authorization: Bearer <token>` 就能跳过登录页。
- **默认就安全。** 密码只存哈希、登录有限速（反复输错会临时锁定该地址）、会话 cookie
  带安全属性，而且配置缺失或损坏时**拒绝访问而不是悄悄开门**。
- **一个管理用户的小命令行工具**：

  ```sh
  dsh-auth user add admin --password-stdin   # 添加用户
  dsh-auth user list                          # 查看用户
  dsh-auth user disable admin                 # 禁止某用户今后登录
  ```

## 快速开始

```sh
# 1. 从 npm 装进你的 dsh profile
dsh plugin --profile web add dsh-auth-gate

# 2. 创建管理员账号
printf '%s\n' '选一个强密码' | dsh-auth user add admin --password-stdin

# 3. 开启密码登录：在 $DSH_HOME/cordis.patch.yml 里加 dsh-auth 行
#    （仓库自带现成模板 deploy/cordis.patch.yml，见下方"配置"）

# 4. 重启 dsh，打开你的站点——会先要求登录。
```

## 效果预览

未登录的访客会被带到登录页：

![登录页](docs/demo/login-page.png)

登录后进入你的实例：

![dsh 实例](docs/demo/dashboard.png)

## 配置

编辑 `$DSH_HOME/cordis.patch.yml`（复制仓库里的模板 `deploy/cordis.patch.yml`），
`dsh-auth` 行：

```yaml
- insert:
    - id: dsh-auth
      name: dsh-auth-gate
      config:
        mode: "password" # "password"（推荐）或 "token"
        cookieSecure: true # 使用 https 时保持 true
```

| 选项           | 默认值             | 作用                                                         |
| -------------- | ------------------ | ------------------------------------------------------------ |
| `mode`         | `"token"`          | `"password"` = 用户名密码登录；`"token"` = 一个共享秘密      |
| `sessionTtl`   | `604800`           | 一次登录持续多久（秒），到期需重新登录                       |
| `cookieName`   | `dsh_auth`         | 会话 cookie 的名字（很少需要改）                             |
| `tokenRef`     | `"DSH_AUTH_TOKEN"` | 仅令牌模式：共享秘密存在哪个环境变量里                       |
| `cookieSecure` | `true`             | 只在纯 http 测试环境设为 `false`                             |
| `usersFile`    | `""`               | 密码模式：用户列表文件位置。默认 `$DSH_HOME/auth/users.yaml` |

## 环境要求

- 服务器上需要 Node ≥ 22.19 和 pnpm。
- dsh 的 `web` profile 正常运行（`dsh --profile web`）。
- 如果 `cookieSecure` 是 `true`，站点必须走 https（浏览器在纯 http 下会拒绝安全 cookie）。

## 注意事项与局限

- 禁用用户只阻止**新**登录；已经登录的会话要等它自然过期。
- 登录限速在服务器重启后清零。
- 反代部署时，限速按反代出口地址统计。
- dsh 界面里还没有登出按钮——访问 `/auth/logout?next=/` 即可登出。
- 本插件只保护 dsh 的网页入口，不能替代服务器层面的安全：请保持服务器系统用户最小权限、
  配置文件私密（`.credentials.yaml` 和 `auth/users.yaml` 创建时即为 `0600` 权限）。
