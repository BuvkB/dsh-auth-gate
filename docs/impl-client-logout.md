# GUI 登出入口（client 半边）实施规格

> 范围：dsh-auth-gate 的 client 半边（browser 插件）。登出入口最初挂在会话头部右上角
> （`conversation.session.header.utilities`）与新会话页右上角浮动（`shell.overlay`），
> 本规格把它们统一移动到**侧边栏底部 footer**（`sidebar.footer.action`，与「设置」同一
> 脚组），并把文案接入 dsh 现有 locale 机制（随界面语言在「登出」/ "Sign out" 间切换）。
> 服务端端点（`POST /auth/logout`、`GET /auth/status`）M2/M3 已冻结并发布，本规格只动
> 渲染层、打包层与文档。

---

## 1. 背景与目标

关闭登出闭环：认证后在 GUI 内一键登出。第一版（0.6.5）把入口放右上角（会话头部 +
新会话页浮动图标）；用户回退到「右上角不再出现登出按钮」，改为侧边栏底部一行
（图标 + 本地化文字），位置与「设置」同一脚组。

挂载契约（dsh 0.1.0-rc.7，本机 harness 与生产同为该版本）已实测核实：

- **新挂载点 `sidebar.footer.action`**（ui-sidebar 声明、root 作用域、**list** 槽、
  `replaceRisk: none`）：侧边栏 footer 的可追加 action 槽，与 `sidebar.settings`（设置
  触发行）同一 `footArea` 分组——shell 固定顺序是 footer actions **在「设置」上方**、
  不加分隔线。注册契约 `{ id, order, label }` + `locale`（命名 `t` seat）；owner props
  = `SidebarFooterActionOwnerProps { wide }`（窄栏只显示图标列）。生产既有先例：
  `dsh-client-ui-cordis` 的 Cordis 面板行（同 42px 徽章式行、hover 同 token）。
- **移除两处旧挂载**：`conversation.session.header.utilities`（会话头部右上角）与
  `shell.overlay`（新会话页浮动）。此后**右上角不再出现登出按钮**。
- **i18n**：文案经 `ctx.locale`（`dsh-client-locale` 的 LocaleRuntime）注册 `auth`
  命名词典（zh/en 双语），槽位注册带 `locale: "auth"` → 渲染器给组件注入 `t` seat
  （与「设置」里语言切换同一套机制；lookup 链 = 命名域 → common → 键自身）。语言切换
  时 ledger 版本 bumped，`t` 读取活动语言即时跟随。
- **端点约束（不变）**：`POST /auth/logout?next=/`（GET → 405，M22：next 仅从 query
  取，校验回落 `/`）；`GET /auth/status` → `{"authenticated":true|false}`（只认 cookie）。

## 2. 冻结决策

| #   | 决策                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 单处注册：`sidebar.footer.action`，id `dsh-auth-gate-logout`，`order: 1`（排在同槽 Cordis 行默认 0 之后），`locale: "auth"`，`label` 为 thunk（`() => t("logout")`，投影跟随语言）。**移除** `conversation.session.header.utilities` 与 `shell.overlay` 两处注册（会话页/新会话页右上角不再有登出按钮）。                                                                                                                                                       |
| D2  | 登出仍走原生 `<form method="post" action="/auth/logout?next=/">`（零 JS 依赖；302 回落 `/` → 门禁 → 登录页）                                                                                                                                                                                                                                                                                                                                                    |
| D3  | 会话状态：组件挂载时 `fetch("/auth/status")` 一次；`authenticated: true` 才渲染，否则渲染 null（无残留 UI）                                                                                                                                                                                                                                                                                                                                                     |
| D4  | 视觉：**普通列表行**（不再 32px 圆形图标按钮）——16px 方块+箭头 SVG（viewBox 24 不变，仅 width/height 16）+ 本地化文字；`display:flex; align-items:center; gap:9px; padding:9px 8px; border-radius:8px`；图标色/文字色 `--dsw-alias-label-primary`、hover 背景 `var(--dsw-alias-interactive-bg-hover)`（浅 `rgba(38,49,72,.06)` / 深 `rgba(255,255,255,.08)`，随主题自适应），与侧边栏交互行同表面语言。内联 style，不引 CSS 文件、不引 primitives（依赖最小化） |
| D5  | i18n：`apply` 内 `ctx.effect(() => [ctx.locale.register("auth","zh",{logout:"登出"}), ctx.locale.register("auth","en",{logout:"Sign out"})], ...)`（双语词典挂纤维卸载级联）；槽位注册 `locale: "auth"` 注入 `t` seat；行文字与 `aria-label`/`title` 都用 `t("logout")`。不新建语言切换 UI（切换已存在于设置——General 的 Language 行）                                                                                                                          |
| D6  | 类型：延续本地结构镜像（`src/client/context.ts`，新增 `AuthLocaleService` + `effect` 面），不 import 任何 `@deepseek-ai/*` 运行时值；manifest inject 不变（`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-slots`）；服务面 inject 从 `["slots"]` 扩为 `["slots", "locale"]`（locale 是 dsh 客户端内置服务，设置页语言行同源）                                                                                                                   |
| D7  | 构建：不变（tsdown 单入口 `src/client/index.tsx` → `lib/client.js`，ModuleLoader id = 包名；client 声明通道生成 `lib/client/index.d.ts`）                                                                                                                                                                                                                                                                                                                       |
| D8  | 测试：jsdom（`@vitest-environment jsdom`）单测覆盖 apply 注册（新增 `sidebar.footer.action`、双语词典注册、`locale`/`order`/thunk label）与组件分支（authenticated 真/假、文字标签 zh/en、form action/method、可访问名、hover token）；fetch mock。**删除** HeroLogoutAction 相关测试。                                                                                                                                                                         |
| D9  | 范围外：右上角两处入口复现、登出确认弹窗、`/auth/status` 轮询（仅挂载时一次）、client 登出后在 SPA 内的无痕刷新（302 整页跳转）、除行文字外的任何新 i18n。不改服务端端点/门禁/会话语义。                                                                                                                                                                                                                                                                        |

## 3. 文件蓝图

| 文件                                                   | 动作     | 说明                                                                                                                                                                      |
| ------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/client/context.ts`                                | 改       | 镜像新增 `AuthLocaleService`（register/bind）与 `AuthContext.effect`；`AuthSlotRegisterOptions` 增 `locale?: string`                                                      |
| `src/client/logout-action.tsx`                         | 改       | 删 `HeroLogoutAction`；`LogoutAction` 改为 `SidebarLogoutAction`（接受 `{wide?, t?}`）：`useAuthenticated` 门控 + `<form>` + 行样式按钮（16px 图标 + `t("logout")` 文字） |
| `src/client/index.tsx`                                 | 改       | 注册词典（zh/en）→ `ctx.slots.inject("sidebar.footer.action", ...)` 单处注册（`locale`/`order`/thunk label）；移除两处旧注册；`inject = ["slots","locale"]`               |
| `src/client/logout-action.test.tsx`                    | 改       | apply 断言：双语词典注册 + 单槽注册；组件断言：zh/en 文字、无认证隐藏、hover token（见 D8）                                                                               |
| `docs/impl-client-logout.md`                           | 改       | 本规格（即此文件）                                                                                                                                                        |
| `docs/deployment.md` / `_zh`、`README`、`README.zh.md` | 改       | 「右上角登出按钮」描述 → 侧边栏底部登出行（含设计预览链接）；删除过时截图 `docs/demo/logout-hero-blank.png`、`logout-conversation-en.png`                                 |
| `lib/client.js`、`lib/client/index.d.ts`               | 构建产物 | 与 src 同批提交                                                                                                                                                           |

## 4. 验证步骤

1. `npm run verify`（format:check + lint + type-check（含 client 通道）+ test:coverage
   - lock:check）全绿，覆盖率 ≥80%。
2. `npm run build`：`tsc -p tsconfig.build.json` + `tsdown` + client 声明通道；
   `git diff --exit-code -- lib` 通过（产物同批提交）。
3. 部署到生产（tencent-cloud，`dsh-web.service`）后真实浏览器验证：登录 → 侧边栏
   底部（「设置」同一脚组）出现「登出 / Sign out」行 → 切换设置里语言 → 行文字在
   「登出」/ "Sign out" 间切换 → 点击 → 302 回落登录页 → 未带 cookie 的 SPA 请求被
   门禁拦截。**会话头部右上角与新会话页右上角不再有登出按钮**。按 `docs/development.md`
   "GUI demos"约定配演示（截图 + 说明证明了什么）。
4. 提交 development → PR → main（`feat:` → release-please）。

## 5. 明确不做的事

- 不引入任何第三方运行时资源；client bundle 仍只依赖平台模块表（react）。
- 不改动任何服务端端点/门禁/会话语义。
- 不替换 `sidebar.settings` 等 single 槽（触发行仍归 ui-settings-general）；只用
  **可追加**的 `sidebar.footer.action`——不整列替换 sidebar、不碰侧边栏 shell。
- 不在侧边栏之外新增语言切换控件（切换已存在于设置的 General → Language 行，这次只
  让登出行文字跟随）。
- 不做 i18n 之外的 UI 改动（确认弹窗、暗色模式专用样式等）。

## 6. DoD（完成定义）

1. §3 文件全部落地，`npm run verify` 全绿，`lib/` 与 `src/` 同批提交。
2. 生产部署后真实浏览器验证登出闭环（位置、双语文字、右上角无残留），演示/预览已附
   （`docs/design/**/Logout Under Settings.dc.html` 为交互预览）。
3. 提交信息符合 commitlint（`feat(client): move sign-out to sidebar footer with
localized label`），未在未经用户指示的情况下 push。
