import { randomBytes } from 'node:crypto';
console.log('\n请添加到 EdgeOne 环境变量：\n');
console.log(`ASSISTANT_SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
console.log('\n销售邀请码请部署后在管理端的“销售账号”页面生成。\n');
