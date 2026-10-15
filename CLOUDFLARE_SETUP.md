# Cloudflare 部署补丁 · 2026-10-15

## 本次解决的问题

日志已显示依赖安装和 `vite build` 成功，失败来自 Wrangler 自动配置要求 Vite >= 6。这个补丁提供显式配置，继续使用目前能成功构建的 Vite 4，不需要升级前端。

新增 `wrangler.jsonc` 和 `cloudflare-worker.js`。Worker 入口调用现有 `cloud-functions/api` 下的 18 个接口文件；保留管理登录、销售助手登录、猫源、图片与视频等原有业务逻辑。原 `cloud-functions` 目录必须保留。

## 上传到 GitHub

1. 解压补丁，把 `wrangler.jsonc`、`cloudflare-worker.js` 上传到 `cat` 仓库根目录，与 `package.json`、`index.html` 同级。两个文件都必须上传，文件内容中的导入路径依赖原有 `cloud-functions` 目录。
2. `CLOUDFLARE_SETUP.md` 是说明，可一并上传。`test/cloudflare-worker.test.js` 为可选验证文件，上传时保持 `test/` 路径。
3. 不要把补丁 ZIP 本身上传到仓库，也不要把文件粘贴到控制台默认的 Hello World 编辑器中。

首页和其他前端页面不需要替换。`.nvmrc` 继续保留已设置的 `22`。

## Cloudflare 的构建设置

项目名称为 `cat`。如果项目名称改变，请同步修改 `wrangler.jsonc` 的 `name`。

在项目 Settings → Build 设置：

| 设置 | 内容 |
| --- | --- |
| Build command | `npm ci --ignore-scripts=false --foreground-scripts --no-audit --no-fund && npm run build` |
| Deploy command | `npx wrangler@4.151.0 deploy` |
| Root directory | 含有 `package.json` 和 `wrangler.jsonc` 的目录；当前仓库这两个文件直接在根目录时留空 |

在 Build Variables and Secrets 中保留：

```
NODE_VERSION = 22
SKIP_DEPENDENCY_INSTALL = 1
```

不要把部署命令填到 Build command 一栏。提交新增文件后，部署日志应直接读取 `wrangler.jsonc`，不再执行 Vite 自动配置。

## 运行时密钥

飞书、管理登录及 AI 的配置不会从 EdgeOne 自动转移。请把原站对应配置复制到 Cloudflare 项目 Settings → Variables & Secrets（运行时配置）。敏感值使用 Secret 类型，不提交 GitHub，不写进 `wrangler.jsonc`，也不添加 `VITE_` 前缀。

- 猫源必需：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_APP_TOKEN`、`FEISHU_TABLE_ID`。
- 管理端必需：`ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH`、`ADMIN_SESSION_SECRET`。
- 已使用销售助手时继续复制：`ASSISTANT_SESSION_SECRET`、`FEISHU_SALES_TABLE_ID`、`FEISHU_AI_LOG_TABLE_ID`、`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`；如果原站配置过 `DEEPSEEK_API_URL`，也一并复制。

原密码哈希和邀请码格式保持不变。部署成功与真实业务可用是两项检查：缺少环境变量时首页仍可能正常，而猫源接口或管理登录会失败。

## 验证范围与上线检查

- Node 下的 19 项测试通过，包括原有业务测试和 6 项 Cloudflare 入口集成检查。
- 使用日志相同版本 Wrangler 4.151.0 完成 `deploy --dry-run`：配置读取、后端打包和静态文件识别通过，不再出现 Vite 自动配置错误。
- 没有访问你的 Cloudflare 账号、提交 GitHub、绑定域名或执行真实部署。
- 没有真实飞书/DeepSeek 凭证，真实猫源读取、管理写入、AI 调用、视频播放和并发额度需部署后验证。
- Workers 免费版仍有请求量与 CPU 等额度限制；本补丁没有开启付费计划，也不保证任意流量或所有登录计算均在免费额度内。
- 视频仍由现有接口从飞书转发，本次没有迁移到 R2，也没有改变飞书限流。

先检查 `/`、`/cats/`、`/api/public-cats`、`/admin/`，再实际测试登录、图片和短视频。原 EdgeOne 站点可以继续运行，验证后再切换正式域名。

## 官方资料

- 显式配置跳过自动适配：https://developers.cloudflare.com/workers/framework-guides/automatic-configuration/#skipping-automatic-configuration
- 静态资源与 Worker：https://developers.cloudflare.com/workers/static-assets/
- Node.js crypto 兼容：https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/
