# 销售 AI 导购助手与账号风控 · 开发及部署说明

版本：3.3.0，2026-10-27。以本文件为准；压缩包中早期说明里的飞书销售账号、月额度及 deepseek-chat 配置不适用于本次新助手。

## 交付范围

- `/cats/`：在猫源页顶部新增蓝紫渐变 AI 输入区，秒配猫 / 写话术切换、四个模板胶囊、200字输入上限、激活弹窗、剩余额度与冷却提示、微信话术复制、猫咪缩略卡片与原有详情弹窗。
- `/assistant/`：改为同一套新助手，避免继续使用旧聊天工作流。
- `/admin-sales` 或 `/admin-sales/`：销售授权与风控。沿用 `/admin/` 的管理员账号及安全登录，不新增明文管理员密码配置。
- `/admin/` 的“销售账号与风控”页签也可进入。
- `/` 仍为现有招商介绍页。未更改域名、SEO介绍页或发布线上版本。
- 库存继续读取当前飞书猫源，只使用“在售”记录；销售授权、设备、额度和审计均由 Cloudflare D1 独立保存，无需飞书销售账号表。

## 设计审核与实际行为

原提示词假定的 Python / FastAPI 和本地 `sales_auth.db` 不符合附件的 React + Worker 架构。本版全部使用现有 JavaScript Worker，数据库使用 D1 的 SQLite SQL 接口，不需要额外购买或维护 Python 服务器。

### 库存与话术

1. 本地校验业务输入、识别预算、品种、花色、性别、月龄及常见已录入特征。
2. “秒配猫”由代码按明确条件筛选最多两只。无匹配时不调用模型，不放宽预算或性别来凑结果。
3. “写话术”必须提供1至2个有效在售编号。编号不存在、已售、需要对比却只填一个编号时，返回补充提示。
4. 未填写的模板、模糊或不支持的条件会要求补充；首版采用保守规则解析，不能声称理解全部自然语言。排除条件、多个备选品种需拆开查询，中文金额请写成数字。
5. 仅发送候选的编号、品种、性别、价格和最多100字描述给模型，不传图片、视频、整库和对话历史。
6. 单次 Chat Completions 请求，默认 `deepseek-flash`、`thinking: {type:"disabled"}`、`max_tokens:280`、`temperature:0.3`、JSON模式；25秒超时，不自动重试。
7. 模型输出检查完整结束、JSON格式、160字长度、编号白名单、文本编号一致性与数字报价。不直接渲染HTML，禁止自行编造健康保证、骨相性格、降价、血统或虚假稀缺性。
8. 关键词及提示词约束不能证明彻底杜绝注入或杜绝所有事实错误；它们配合服务端候选限制、输出检查、有限配额和审计来限制影响。销售仍须审核发给客户的话术。

**模型配置更新**：DeepSeek官方已宣布 `deepseek-chat` / `deepseek-reasoner` 于2026-07-24停止使用。当前采用官方推荐的 `deepseek-flash`，并明确关闭默认开启的思考模式。`SALES_AI_MODEL` 可覆盖模型名，但须确认仍支持本请求参数，不能沿用已失效的旧别名。

### 授权和配额

- 激活码为16位随机十六进制字符，按4位分组显示。数据库只保存SHA-256哈希与尾号，完整码仅生成或重发时显示。
- 激活后使用随机会话令牌，数据库仅保存令牌哈希。浏览器Cookie为 `HttpOnly; Secure; SameSite=Strict`，不将销售码或会话令牌写入localStorage。
- localStorage只保存随机UUID作为浏览器标识，服务端保存其哈希。最多绑定两个浏览器。手机中的微信内置浏览器与系统浏览器也可能占用两个名额；无痕窗口、清除存储、换浏览器可能需要重置。
- UUID不是真正的物理硬件指纹。复制整套浏览器登录资料仍可能共用身份，不能保证阻断所有外借；无需将设备限制宣传为强硬件绑定。
- 封禁、重发激活码、重置设备均立即撤销旧会话。解封后需重新激活。
- 个人默认20次/日、全站默认1000次/日。按**北京时间**零点分日，无需定时清零每个账号。
- 授权、设备、账号及全站日限额、15秒冷却、在途锁通过D1同一事务检查和占额，不能依靠同时发送请求超额。
- 同账号模型请求处理中不允许再次占额，在途锁90秒后可恢复，已占次数继续保留。模型网络请求超时为25秒。
- 本地拦截、无库存、信息待补充、缺模型密钥等未请求模型的情况不扣次数。
- **已发往模型的请求，即使超时、模型拒绝或输出校验失败，也计入1次**，因为可能已经产生费用。此规则已在页面提示，避免无限失败重试消耗算力。
- 已占额后发现封禁或暂停、且尚未发出模型请求时，安全退回占额。处理中突然封禁会阻止结果交付，但已发出的请求无法保证撤回费用。
- 紧急暂停阻止新模型请求，不终止已经发往上游的请求。全站日上限是请求次数上限，费用还取决于模型价格与tokens，不等同于人民币硬预算。
- D1持久限流：同IP激活8次/15分钟，全站激活500次/15分钟；普通销售API同IP60次/分钟；账号写操作10次/分钟。固定窗口在边界允许短时集中请求，但模型调用仍受原子配额、冷却及在途锁约束。
- 日志展示最近20条，记录本地拒绝、待补充、生成和失败。每小时定时分批清理90天前日志及过期会话、限流桶；管理员进入列表时也会进行小批清理。达到极端流量时旧数据可能需多轮清理。

### 旧入口

`/api/assistant/reply` 返回410升级提示，无法继续消耗模型费用。

`/api/smart-search` 只做本地规则提取，不再调用模型。旧版 `parseDemand` 也关闭模型回退路径。原有筛选功能继续可用，但复杂需求可能需要手工调整。

原飞书销售账号与历史数据没有删除，旧登录/历史/管理接口保留以便过渡和查旧资料。它们不能获得新的D1授权，也不能通过旧reply接口生成内容。新账号、额度和日志统一由D1管理，不自动迁移旧邀请码和月用量，需要在新后台重新发码。

## 上线步骤（Cloudflare Workers）

### 1. 更新仓库

将开发包内 `cat-main/` 的内容更新到原仓库根目录；不要把整个 `cat-main` 文件夹嵌套进原根目录。

保留你的线上环境变量和密钥。包内不含线上凭证。安装及验证：

```bash
npm ci
npm test
npm run build
```

Node使用22.13或更新的22版本（现有 `.nvmrc` 为22）；测试使用Node内置SQLite。正式Worker不依赖Node SQLite模块。

### 2. 创建并绑定D1（只需一次）

使用有权限的Cloudflare账号执行：

```bash
npx wrangler d1 create cat-sales-auth
```

复制输出的真实 `database_id`，执行：

```bash
npm run sales:configure -- 这里替换为真实的数据库UUID
```

这个脚本只修改 `wrangler.jsonc` 中名为 `SALES_DB` 的绑定，保留其他配置。提交修改后的配置到仓库。

也可参照 `wrangler.sales.example.jsonc` 手工添加绑定。示例中的字符串不是可部署的数据库ID。

```bash
npx wrangler d1 migrations apply cat-sales-auth --remote
```

首次迁移需先完成再部署；未绑定数据库或未完成迁移时，新AI接口返回503并且不调用模型。不会在每个HTTP请求中反复建表。

### 3. 运行时配置

保留现有库存配置：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_APP_TOKEN`
- `FEISHU_TABLE_ID`

沿用现有管理员配置：

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET`（至少32字符）

新AI使用：

- `DEEPSEEK_API_KEY`：Worker运行时Secret，必需。
- `SALES_AI_MODEL`：可选，默认 `deepseek-flash`。不读取旧 `DEEPSEEK_MODEL`，防止误用失效模型名。

不要将密钥放进 `VITE_` 变量或提交进Git。现有管理员密码可继续使用；已有哈希配置无需重置。

如新环境尚未有管理员配置，可用原有 `npm run admin:secrets` 工具生成，按工具说明将结果保存在Cloudflare Secrets中。

### 4. 构建与发布

在真实账号执行：

```bash
npm run build
npx wrangler deploy --dry-run
npx wrangler deploy
```

Git联动部署继续使用原有构建设置。新增D1绑定必须写入仓库配置；不要只在控制台添加然后被后续Wrangler部署覆盖。

`keep_vars: true` 已保留；它不是自动保存所有类型绑定的保证。本版只针对Cloudflare Worker接入新接口，若仍同时维护EdgeOne，需要独立评估后者的数据库接入，不能宣称本包的新助手自动兼容EdgeOne。

### 5. 发码和验收

1. 打开 `/admin-sales`，用原管理员账号登录。
2. 先设置较小的全站日上限（例如100），生成测试销售码。
3. 在 `/cats/` 输入“预算3000元，布偶妹妹”，发送并激活。
4. 检查真实库存匹配、话术复制、缩略卡片、详情和剩余次数。
5. 用第二个浏览器激活，再用第三个验证被拒绝。
6. 验证冷却、用完限额、封禁、重置设备、重发码和全站暂停。
7. 查看日志，确认本地拦截不扣次数，已发往模型的失败计入次数。
8. 确认旧 `/api/assistant/reply` 返回410。

## 开发和维护

本地D1建表后，可通过Worker完整预览：

```bash
npx wrangler d1 migrations apply cat-sales-auth --local
npm run dev:worker
```

在本地 `.dev.vars` 配置开发凭证（已忽略Git）；用 `http://localhost:8787/cats/` 和 `/admin-sales` 测试。生产必须HTTPS。不要将本地数据当作线上数据库；本地测试不修改远程D1。

- `npm test`：原有回归及新增SQLite/HTTP风控测试。
- `npm run test:d1`：使用实际本地workerd/D1验证迁移、并发占额、设备限制与审计；不使用线上账号。
- `npm run test:components`：使用DOM模拟环境验证激活、发送、复制、额度错误和真实D1后台交互，不等于真实浏览器布局验收。
- `npm run test:ui`：Playwright桌面与手机交互测试，使用测试服务和模拟上游，不产生真实DeepSeek费用。运行前 `npx playwright install chromium`。
- `migrations/0001_sales_ai.sql`：版本化表结构，后续变更新增迁移，不编辑已应用迁移来覆盖线上数据。
- 后续迁出Cloudflare时可导出D1 SQL数据，再实现对应服务端接口；本次没有虚构一个本地 `sales_auth.db` 文件。

## 验证结果

详见 [SALES_AI_TEST_RESULTS.md](./SALES_AI_TEST_RESULTS.md)。59项后端/回归测试、3项组件交互测试、本地Cloudflare D1集成检查、生产构建及Worker打包预检通过。真实浏览器端到端测试受当前环境限制未完成，不将DOM模拟测试当作视觉验收。

## 已知边界与上线前事项

- 未连接你的Cloudflare账号、真实飞书和DeepSeek凭证，本次未发布到 `petcloud88.top`，也未执行真实付费模型调用。
- 自动化测试的上游回复为模拟内容，只验证请求、校验和扣额机制，不能替代真实模型质量、时延和账单验收。
- 复用当前猫源最多5分钟的服务端缓存；页面也可能显示本地旧缓存。结果注明以最近同步库存为准，成交前需核对。此次不改造库存实时同步架构。
- 本版不识别图片骨相；话术只能引用库存已有文字。运营应持续补全真实描述。
- 280 tokens 是输出成本限制，不等于280字；若真实模型频繁截断，需在评估费用后调节输出上限或缩短话术，不能悄悄发起第二次请求。
- IP限流可能影响共用出口的销售团队，可按真实情况调整；账号原子额度及全站硬上限应保留。
- 日志可能包含客户信息，后台仅管理员可访问，销售不要输入电话、住址等无关个人资料。

## 官方参考

- D1：https://developers.cloudflare.com/d1/
- D1事务批处理：https://developers.cloudflare.com/d1/worker-api/d1-database/
- D1迁移：https://developers.cloudflare.com/d1/reference/migrations/
- DeepSeek当前模型：https://api-docs.deepseek.com/quick_start/pricing/
- DeepSeek思考模式：https://api-docs.deepseek.com/guides/thinking_mode/
- 旧模型停用公告：https://api-docs.deepseek.com/news/news260424/
