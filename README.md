# 3.13.0 专属转发接入

本版基于 `cat-main (17).zip`。上线前请先阅读 [部署说明](FORWARD_DEPLOY.md) 和 [验收记录](FORWARD_VALIDATION.md)。新增 D1 迁移必须先执行，再部署源码。入口 `/forward/`，客户短链接 `/p/<随机标识>`。

## 原网站功能与安装

保留原网站结构，保留官网、智能找猫、访客额度、销售账号、管理员、手动拼图、资料卡和手册。AI 营销出图实验室已删除。

先读 `FORWARD_DEPLOY.md`。本包是完整源码，不含 `dist/`、`node_modules/`；正式部署会重新构建。

## 安装和验证

推荐 Node.js 22（至少 22.13），并安装完整开发依赖：

```bash
npm ci
npm run verify:release
```

验证命令依次运行 Node 测试、React 组件测试、生产构建、Worker 部署预检和静态资源检查；不会发布网站。

```bash
npm run test:d1  # 本地 workerd / D1 集成验证，不访问线上数据库
npm run deploy   # 真正部署到现有 Cloudflare Worker；需你自己的账号权限
```

`wrangler.jsonc` 的 `build.command` 保证每次部署前运行 `npm run build`。既有 Worker 名称、D1 绑定及数据库 ID、Cron 和 `keep_vars` 均保留。

## 开发

`npm run dev` 启动 Vite；`npm run dev:api` 仅提供飞书只读本地 API，不能代替完整 Worker。完整 Worker 使用 `npm run dev:worker` 并按需配置本地 D1/密钥。

`npm run test:ui` 是浏览器测试入口，需另行具备 Playwright 浏览器；本次环境未运行它。源码中的离线预览/测试服务只供开发，不要用作生产入口。

## 维护

- 前端：`src/`；后端：`cloud-functions/`；Worker 路由：`cloudflare-worker.js`。
- 数据库迁移：`migrations/`；本次新增 `0004_sales_proposals.sql`，先迁移再部署，不要清空原数据库。
- AI 营销出图已删除；DeepSeek 密钥仍用于智能找猫等保留功能。
- 旧跨工具 Agent 保持冻结，历史任务只读/取消兼容仍在；本次没有将其重新启用。
- 已删除无引用的历史增量补丁引擎，日常更新直接维护源码。
- 不要提交 `.env`、`.dev.vars`、API Key 或 Cloudflare 登录资料。

验证结果与限制见 `VALIDATION.md`；历史说明与本版冲突时，以本 README、上线替换说明及当前源码为准。
