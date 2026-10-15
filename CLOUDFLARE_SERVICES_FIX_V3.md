# Cloudflare 管理端与销售助手修复包 V3

本包包含当前版本的完整 `cloud-functions`、`src` 和测试代码，以及 Worker 入口和配置。不需要再叠加之前的视频直连或猫源诊断补丁。

## 上传与部署

1. 解压 `cat-cloudflare-services-fix-v3-20261015.zip`，把内容合并上传到 GitHub 项目根目录，也就是 `package.json` 所在层级。覆盖同名文件、添加新文件，保留其他文件。
2. Cloudflare → Workers & Pages → cat → Settings → Build 中，Build command 保持原来的成功配置。建议 Deploy command 使用：

   ```bash
   npx wrangler@4.151.0 deploy --config ./wrangler.jsonc --keep-vars
   ```

3. 提交代码后等待部署成功。管理端和销售助手页面执行强制刷新（Windows 通常 Ctrl+F5），然后用原账号密码、原邀请码重新登录。

不需要执行 `admin:secrets`、`assistant:secrets` 或重新生成任何密钥。不需要删除或重新创建 Worker，也不需要清空环境变量。本包不包含 `.env`、任何用户环境变量值、账号重置脚本、Node 版本文件或构建依赖配置。

### 保留已配置的变量

`wrangler.jsonc` 已设置 `"keep_vars": true`，配置中没有 `vars` 覆盖列表；部署命令中的 `--keep-vars` 再次明确要求保留后台变量。已配置的 Secret 继续由 Cloudflare 保留。修复代码不会修改任何环境变量，也不会自动轮换密码、会话密钥或既有邀请码。

如果确实有某项变量尚未恢复，新的错误响应会列出缺失的变量名称；需要补齐该项原值，代码不能猜测或找回丢失的值。

## 本次修复

### 登录验证兼容 Cloudflare

旧版管理员密码哈希通常使用 210,000 次 PBKDF2，旧版邀请码使用 120,000 次。Cloudflare 生产环境对 PBKDF2 有迭代限制，免费 Worker 也有较短的 CPU 预算。仅在 Node 或本地 workerd 中通过旧登录测试，不能证明生产环境兼容。

新登录流程保留原哈希值：浏览器通过 Web Crypto 完成原迭代次数的密码推导，再发送 HMAC 登录证明；Worker 只验证证明并签发原格式的会话 Cookie。挑战响应不包含存储哈希，登录请求不发送明文密码，也不需要更改现有 `ADMIN_PASSWORD_HASH`。

登录证明使用 90 秒签名挑战，绑定用途、账号、来源域名和 HttpOnly/Secure/SameSite=Strict 挑战 Cookie。工作实例还维护短期已用 nonce 记录。实例之间不共享这张记录，因此不是全局严格的一次性令牌；使用 HTTPS 和浏览器绑定 Cookie，避免将证明作为可长期复用的凭据。服务端会拒绝已过期、被篡改、账号不匹配、跨用途或缺少浏览器 Cookie 的证明。

旧邀请码继续按原 PBKDF2 哈希在浏览器验证。新生成的邀请码使用 120 位随机秘密，采用带随机盐的 SHA-256 令牌哈希，以免在 Worker 内生成邀请码时再次进行高成本密码推导。此方案只用于随机邀请码；管理员的人类密码仍使用原 PBKDF2 验证信息。更新后的共享后端同时支持两种邀请码格式。若 EdgeOne 部署也使用这些新邀请码，其后端也应使用本包共享代码；原来的邀请码没有被改动。

旧版已缓存的 Cloudflare 登录页面会收到“请刷新后重新登录”，而不会执行不兼容的同步密码计算。

### 管理端和销售助手业务

- 管理员登录和会话、猫源读取与编辑、销售账号列表、创建及轮换邀请码。
- 旧邀请码与新邀请码登录、会话检查、额度读取、生成回复、历史查看与删除。
- 销售账号列表只读取一次日志表，再统计每个账号的用量，避免每个账号都重新读取整张日志表。
- AI 外部接口失败时，降级使用已有内置话术并明确提示人工核对；飞书日志写入失败仍会报错，避免假装保存成功。
- 列表分页发现缺失下一页令牌时停止，避免异常响应导致重复读取。
- 增加安全错误码，区分缺少配置、哈希格式错误、飞书权限/限流、连接失败与超时。不返回或打印密钥、访问令牌及原始上游错误正文。
- 保留视频临时链接直连、缓存、过期更新和备用播放方式；首页没有修改。

## 验证

- 39 项 Node 自动测试通过，包括原密码和旧邀请码兼容、挑战过期、篡改、跨域、错误密码、缺失 Cookie 和重放拒绝。
- 真实 React 登录表单的 DOM 交互模拟通过：管理员及销售助手均走完整挑战、密码推导、证明验证并进入工作区，登录请求不包含明文密码或完整邀请码。
- Miniflare/workerd 本地运行时完整流程通过：公开猫源、原 21 万次密码登录、原 12 万次邀请码登录、管理端读取及编辑、创建新邀请码并登录、销售账号查询、AI 故障降级、历史保存/删除及用量保留、轮换邀请码、停用账号、视频直连。
- Vite 构建及 Wrangler 4.151.0 `deploy --dry-run --keep-vars` 打包检查通过。

测试使用模拟飞书和 AI 服务，没有更改用户真实账号、表格、环境变量或云端部署。本地 workerd 不执行全部生产 CPU/密码迭代限制，因此新登录路径刻意不在 Worker 内调用高迭代 PBKDF2。真实账户权限、线路和生产配额仍需上传后验收。

## 上线后验收

1. `/cats/`：猫源资料及一条视频。
2. `/admin/`：原账号密码登录，查看和编辑猫源。
3. 管理端“销售账号”：查看已有账号，按实际需要再创建新邀请码；无需重置已有邀请码。
4. `/assistant/`：原邀请码登录，生成一次回复，检查历史与用量。

如果仍失败，在 Cloudflare Observability 日志或失败请求 JSON 中查看 `code`、`missing`、`stage`、`upstreamStatus`、`feishuCode`。只需提供这些字段，不需要提供密钥值。

参考：

- https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth
- https://github.com/cloudflare/workerd/issues/1346
- https://developers.cloudflare.com/workers/platform/limits/
