# 喵星猫咪对外展示版

独立的公开只读项目：React 静态页面 + EdgeOne Makers Node Functions。飞书多维表格是唯一数据源。公开接口只返回“在售”记录的猫咪 ID、品种、花色、性别、年龄、价格和一张图片；没有修改接口。

## 本地运行

1. 安装 Node.js 和 npm；在本目录执行 `npm install`。
2. 把 `.env.example` 复制为 `.env`，填写飞书应用的四项配置。请给**对外项目单独的飞书只读应用**授权目标多维表格以及图片读取权限，勿使用管理端有写权限的凭证。
3. 开两个终端分别执行 `npm run dev:api` 和 `npm run dev`，访问终端提示的 Vite 本地地址。图片经本地只读接口读取。
4. `npm test` 可运行接口权限检查；`npm run build` 可检查前端构建。

## 部署到 EdgeOne Makers

1. 将**本目录内容**放到一个独立 GitHub 仓库；不要提交 `.env`、`node_modules` 或 `dist`，也不要把原管理端的 `main.py` 放进这个公开仓库。
2. EdgeOne Makers 创建项目并连接该仓库。根目录选择仓库根目录，框架为 Vite，构建命令 `npm run build`，静态输出目录 `dist`。仓库根目录的 `cloud-functions/api/public-cats.js` 和 `cloud-functions/api/public-images/[token].js` 分别映射到同名 `/api` 路由。
3. 在平台的**服务端环境变量**填写 `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_APP_TOKEN`、`FEISHU_TABLE_ID`，并部署。不能把密钥写进 `VITE_` 变量或网页代码。
4. 在飞书开放平台给只读应用开通读取多维表格及下载附件所需权限，发布/审批应用版本，并确保目标多维表格对该应用可访问。
5. 部署后访问 `/api/public-cats`，确认只看到在售猫咪且没有内部字段；再打开网页检查图片。若接口 502，检查平台环境变量、飞书授权和对应应用日志。

## 数据更新和权限

页面打开时和每五分钟检查一次；云函数在单实例中缓存飞书数据五分钟。因此飞书的更改通常在数分钟后可见。图片响应可被缓存五分钟；已售或下架图片短时间内可能仍被浏览器或 CDN 缓存。

对外项目没有 `POST`、`PATCH` 或 `DELETE` 路由；服务端按状态过滤、明确列出可公开字段，并只代理当前在售猫咪的图片。公开网站上的数据和图片会被访问者看到，请勿在这些列中放私密信息。

**现有管理端不能直接公开部署。** 原 `main.py` 的 `PATCH /api/cats/{cat_id}` 尚无登录鉴权。如果之后要让多人通过网页修改飞书，需要先给管理端加服务端登录和权限校验；仅隐藏按钮无法保护修改接口。
