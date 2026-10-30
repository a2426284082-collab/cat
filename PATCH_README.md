# 3.13.0 专属转发页 · 最小覆盖包

适用基线：本次上传的 `cat-main (17).zip`（3.12.7）。如果你已替换上一份3.13.0完整包，无需重复替换。

本包仅包含相对该基线新增或修改的文件，没有未改动的大图素材、dist、node_modules 或旧版ZIP。测试文件保留，用于保证原Cloudflare构建命令中的 npm run check 能通过。

## 怎么替换

1. 解压到临时目录，将本包里的文件和目录按原路径复制到原项目根目录（与 package.json 同级），合并目录、覆盖同名文件。不要删除整个 src、test 或 cloud-functions 目录；没有列出的原文件保留。
2. **先在原 D1 数据库执行新增迁移，再部署代码。** 使用 Wrangler 管理迁移时运行：

```bash
npx wrangler d1 migrations apply cat-sales-auth --remote
```

3. 原项目根目录执行：

```bash
npm ci
npm run verify:release
npm run deploy
```

命令需在已登录你原 Cloudflare 账号的环境执行。若通过GitHub自动部署，先执行数据库迁移，再推送覆盖文件。不要新建数据库，不要重置账号或密钥。

4. 部署会自动重新构建dist，本补丁不包含dist。入口 `/forward/`，原 `/cats/` 卡片右上角加号也可进入配置；公开客户页为 `/p/<随机标识>`。

完整说明见 `FORWARD_DEPLOY.md`，测试及未验证范围见 `FORWARD_VALIDATION.md`。当前仅完成代码，未执行线上迁移/部署，仍需微信真机验收。

注意：匿名猫源不再返回合作底价，访客本地价格筛选需激活代理；其他免费筛选和AI预算找猫保留。无需另外搭建用户名密码系统。

## 修改文件（18个，覆盖同名文件）

- `CLOUDFLARE_SETUP.md`
- `README.md`
- `cloud-functions/api/public-cats.js`
- `cloudflare-worker.js`
- `package-lock.json`
- `package.json`
- `scripts/verify-release-assets.mjs`
- `src/App.jsx`
- `src/SalesWorkspace.jsx`
- `src/workspace/SalesSession.jsx`
- `src/workspace/catalog-filters.css`
- `src/workspace/catalog.jsx`
- `test/cloudflare-worker.test.js`
- `test/public-api.test.js`
- `test/sales-components.test.jsx`
- `vite.config.js`
- `wrangler.jsonc`
- `上线替换说明.md`

## 新增文件（15个，按原路径添加）

- `FORWARD_DEPLOY.md`
- `FORWARD_VALIDATION.md`
- `cloud-functions/_lib/proposals-api.js`
- `forward/index.html`
- `migrations/0004_sales_proposals.sql`
- `p/index.html`
- `src/forward/agent.js`
- `src/forward/customer.js`
- `src/forward/forward.css`
- `src/forward/proposal-page.css`
- `src/forward/shared.js`
- `test/proposal-assets.mjs`
- `test/proposal-pages.test.js`
- `test/proposals-d1.mjs`
- `test/proposals.test.js`

本说明 `PATCH_README.md` 为补丁附加说明，不参与网站运行。
