AI营销出图实验室（管理员可关闭）补丁

功能说明：
1. 管理员端新增开关：AI营销出图实验室（默认关闭）。
2. 销售工作台左侧“做图与设置”中，管理员开启后会出现“AI营销出图实验室”。
3. 该实验室调用 DeepSeek 生成排版 JSON，再由网站前端 Canvas 直接绘图并导出 PNG。
4. 关闭开关后，销售端入口立即隐藏；接口 /api/marketing-lab 也会返回关闭提示。

使用方法：
1. 覆盖同名文件到项目根目录。
2. 确保环境变量 DEEPSEEK_API_KEY 已配置。
3. 登录管理员后台 -> 工作台内容与功能设置 -> 打开“AI营销出图实验室”。
4. 进入销售工作台，在“做图与设置”里测试该功能。
5. 测试完成后，在管理员后台关闭该开关即可。

本补丁修改文件：
- shared.marketing_lab.js
- cloud-functions/_lib/marketing-lab.js
- cloud-functions/_lib/workbench-schema.js
- cloud-functions/_lib/sales-api.js
- src/components/WorkbenchSettingsAdmin.jsx
- src/workspace/DeepseekMarketingLab.jsx
- src/workspace/marketing-lab.css
- src/workspace/SidebarUtilities.jsx
- src/SalesWorkspace.jsx

备注：
- 由于当前容器依赖安装不完整，这里未跑完整前端构建；但补丁逻辑和文件结构已按现有项目接入。
- 如果你需要，我下一步可以继续帮你把它做成“完整可运行版 zip”。
