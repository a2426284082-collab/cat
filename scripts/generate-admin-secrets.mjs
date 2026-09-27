import { pbkdf2Sync, randomBytes } from 'node:crypto';

const username = 'admin';
const password = randomBytes(18).toString('base64url');
const iterations = 210000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, iterations, 32, 'sha256');

console.log('\n请把下面三项分别添加到 EdgeOne 环境变量：\n');
console.log(`ADMIN_USERNAME=${username}`);
console.log(`ADMIN_PASSWORD_HASH=${iterations}.${salt.toString('base64url')}.${hash.toString('base64url')}`);
console.log(`ADMIN_SESSION_SECRET=${randomBytes(48).toString('base64url')}`);
console.log(`\n首次登录账号：${username}`);
console.log(`首次登录密码：${password}`);
console.log('\n请把密码保存到密码管理器；源码和 EdgeOne 中只保存密码哈希。\n');
