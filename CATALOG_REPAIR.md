# 猫源列表读取排查与部署变量保护 · 2026-10-15

本补丁接在视频直连版本之后使用，保留首页、播放器和直连逻辑，只更新部署配置与猫源读取的诊断。

## 操作

1. 解压后，把 `wrangler.jsonc` 和 `cloud-functions`、`test` 文件夹合并上传到 GitHub 项目根目录，覆盖同名文件、添加新文件，保留其余文件。
2. 等待 Cloudflare 自动部署成功。
3. 到 Workers & Pages → cat → Settings → Runtime variables and secrets → Production，确认 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_APP_TOKEN`、`FEISHU_TABLE_ID` 仍存在。缺失时从原 EdgeOne 配置恢复，建议使用 Secret 类型，再部署该运行时设置。
4. 打开 `https://www.petcloud88.top/api/public-cats`。如果仍失败，把返回的 JSON 发回排查；不要提供密钥值。

## 本次修复的配置风险

Wrangler 配置补上 `"keep_vars": true`，以保留在 Cloudflare 后台填写的普通环境变量。Cloudflare 官方说明：部署时普通变量可能被 Wrangler 配置覆盖，Secret 不会因普通部署被删除。

注意：这项配置只保护后续部署，不会自动找回已经丢失的值。此次线上 502 的具体原因尚未从账户配置或错误码确认，因此不能保证仅上传本补丁就能恢复。

参考：https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth

## 新增的安全错误码

| code | 含义 |
|---|---|
| CONFIG_MISSING | 运行时配置缺失，missing 会列出缺失变量名称 |
| FEISHU_API_ERROR | 飞书业务接口拒绝，可结合 stage 和数字 feishuCode 定位 |
| FEISHU_HTTP_ERROR | 飞书返回非成功 HTTP 状态，upstreamStatus 为状态码 |
| FEISHU_TIMEOUT | 连接飞书超时 |
| FEISHU_NETWORK_ERROR | 连接飞书失败 |
| FEISHU_INVALID_RESPONSE | 飞书响应不是有效 JSON |
| FEISHU_TOKEN_MISSING | 飞书认证响应没有返回访问令牌 |
| CATALOG_READ_FAILED | 其他列表处理错误 |

stage 只使用固定标签：auth（应用认证）、records（表格记录）、media（附件）。返回和日志都不会包含应用密钥、访问令牌、完整飞书 URL 或飞书返回的原始错误消息。

验证：34 项自动测试通过；部署打包检查通过。不包含真实 Cloudflare/飞书账户配置检查或线上部署。
