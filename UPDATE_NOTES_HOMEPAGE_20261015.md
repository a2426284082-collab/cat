# 首页更新：欢迎语与咖啡色自述

- 首屏标题第一行改为“欢迎各位猫咪代理们”。
- 在首屏左栏合作特点下方、用户截图红框的位置，加入咖啡色自述卡片。
- 按用户提供的经历整理为四段，保留负债、尝试多份兼职、朋友建立宠物繁殖基地、负责运营和销售、去年约还三十万元及今年继续努力的叙述。仅调整标点、分段和少量语序。
- 自述标题、咖啡色底、左侧强调线及末段重点文字提高可见度；手机端自动排版。
- 保留后续四个优势、分工、收益、工具展示、问答和联系内容；二维码和微信号不变。

## 两个平台部署

本包同时保留 EdgeOne 原 `cloud-functions` 和 Cloudflare 的 `wrangler.jsonc`、`cloudflare-worker.js`。代码支持两种部署入口，不能据此确认两个线上项目均已正确配置或所有功能已经实测通过。

如果之前已上传 Cloudflare 补丁，只需把本包 `cat-main/index.html` 替换到 GitHub 仓库根目录同名文件，再按原配置部署即可。若尚未上传 Cloudflare 补丁，还需上传 `wrangler.jsonc` 和 `cloudflare-worker.js`；不要覆盖已经在控制台设置的运行时密钥。

EdgeOne：构建 `npm run build`，输出 `dist`，保留 `cloud-functions`。
Cloudflare：构建及部署设置见 `CLOUDFLARE_SETUP.md`。

源码首页为根目录 `index.html`；`cats/index.html` 是猫源子页面，不是宣传首页。

## 验证

构建成功；19 项现有测试通过；自述位置、图标、锚点、二维码截图保留及首页无业务接口引用检查通过。未执行线上部署或真实浏览器视觉预览。
