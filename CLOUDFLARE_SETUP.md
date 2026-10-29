# Cloudflare Workers 部署设置 · 3.12.7

沿用原 Cloudflare Workers 项目，不要新建 Pages 项目，也不要在控制台单文件编辑器粘贴源码。

| 设置 | 内容 |
| --- | --- |
| Node.js | 22，至少 22.13 |
| 项目根目录 | `package.json`、`wrangler.jsonc` 所在的仓库根目录 |
| Build command | `npm ci --no-audit --no-fund && npm run check` |
| Deploy command | `npx wrangler deploy` |

`wrangler.jsonc` 已设置 `build.command: npm run build`，部署命令会先生成最新 `dist/`。原来的 `npm ci && npm run build` 构建命令也可继续使用，只会多构建一次。

如原平台已设置 `SKIP_DEPENDENCY_INSTALL=1`，可保留，因为上述 Build command 已明确安装依赖。不要设置为只安装 production 依赖；Vite 等构建工具需要 devDependencies。

现有配置 `name: cat`、`SALES_DB` 绑定、数据库 ID、迁移目录、静态资源路由、Cron 和 `keep_vars: true` 均保留。直接更新原项目时不要重新建库或删除现有运行时变量。

密钥继续保存在 Cloudflare 运行时 Variables & Secrets 中，不能加 `VITE_` 前缀。保留原飞书配置、管理员密码哈希和会话密钥、DeepSeek 密钥及既有模型配置。此包没有包含真实密钥。

首次在全新账号/新数据库部署，仍须配置自己的数据库绑定、执行既有迁移并设置密钥。本包针对的是现有网站的源码覆盖，不能自动创建或验证你的线上账号配置。

完整覆盖与回滚步骤见 `上线替换说明.md`；测试证据见 `VALIDATION.md`。

配置依据：https://developers.cloudflare.com/workers/wrangler/custom-builds/
