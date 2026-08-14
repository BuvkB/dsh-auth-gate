# dsh-auth

dsh web 的应用层认证插件：为公网部署的 dsh web 实例提供登录门（随机 token →
账号口令 → OTP），保护 agent 平面、会话库与 LLM 凭据不被未授权访问。

- 可行性规划与分阶段路线：[docs/dsh-auth-plan.md](docs/dsh-auth-plan.md)
- 开发规范与工程门禁：[docs/development.md](docs/development.md)
- 供 AI 编码代理的仓库规则：[AGENTS.md](AGENTS.md)

## 快速开始

```bash
npm install
npm run verify   # format:check + lint + type-check + test:coverage（80% 红线）
npm run build    # tsc 产物输出到 lib/
```

Node ≥ 22.19；提交受 husky + commitlint 约束（Conventional Commits）。
