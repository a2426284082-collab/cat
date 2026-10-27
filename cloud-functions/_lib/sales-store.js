// All security decisions persist in D1, never in an isolate-local Map or KV.
import { createHash, randomBytes } from 'node:crypto';

export const nowSeconds = () => Math.floor(Date.now() / 1000);
export const salesDay = (now = nowSeconds()) => new Date((now + 8 * 3600) * 1000).toISOString().slice(0, 10);
export const digest = value => createHash('sha256').update(String(value)).digest('hex');
export const secretToken = () => randomBytes(32).toString('base64url');
export const fail = (message, status = 400, extra = {}) => Object.assign(new Error(message), { status, ...extra });
export const COOKIE = 'cat_sales_session';
export const cookie = token => `${COOKIE}=${token}; Path=/api/; HttpOnly; Secure; SameSite=Strict; Max-Age=${token ? 30 * 86400 : 0}`;
export const deviceHash = id => {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw fail('设备标识无效，请刷新页面');
  return digest(id.toLowerCase());
};
export const cleanCode = value => String(value || '').toUpperCase().replace(/[\s-]/g, '');
export function database(env) {
  if (!env?.SALES_DB?.prepare) throw fail('销售服务尚未配置，请联系管理员', 503);
  // Deliberately use primary queries; no eventually stale auth/quota reads.
  return env.SALES_DB;
}
export async function rateLimit(db, bucket, limit, seconds, now = nowSeconds()) {
  const key = `${bucket}:${Math.floor(now / seconds)}`;
  const row = await db.prepare(`INSERT INTO sales_rate_limits(bucket,hits,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET hits=hits+1 WHERE hits < ? RETURNING hits`).bind(key, now + seconds * 2, limit).first();
  if (!row) throw fail('操作太频繁，请稍后再试', 429, { retry_after: seconds - now % seconds });
}
export async function resolveSession(db, request, suppliedDevice) {
  const token = (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail('请先输入内部销售激活码', 401);
  const row = await db.prepare(`SELECT k.*,s.device_hash FROM sales_sessions s JOIN sales_keys k ON k.id=s.key_id
    JOIN sales_devices d ON d.key_id=k.id AND d.device_hash=s.device_hash
    WHERE s.token_hash=? AND s.expires_at>? AND s.auth_version=k.auth_version`).bind(digest(token), nowSeconds()).first();
  if (!row || row.status !== 1) throw fail('登录已失效或账号已封禁，请重新激活', 401);
  if (suppliedDevice && row.device_hash !== deviceHash(suppliedDevice)) throw fail('设备登录已失效，请重新激活', 401);
  return row;
}
export function accountView(row, now = nowSeconds()) {
  const used = row.last_call_date === salesDay(now) ? row.used_today : 0;
  return { id: row.id, sales_name: row.sales_name, daily_limit: row.daily_limit, used_today: used,
    remaining: Math.max(0, row.daily_limit - used), retry_after: Math.max(0, 15 - (now - row.last_call_timestamp)) };
}
export async function activate(db, code, device) {
  const normalized = cleanCode(code), hashedDevice = deviceHash(device), now = nowSeconds();
  if (!/^[A-Z0-9]{16}$/.test(normalized)) throw fail('激活码无效或已被管理员封禁', 403);
  const key = await db.prepare('SELECT * FROM sales_keys WHERE key_hash=? AND status=1').bind(digest(normalized)).first();
  if (!key) throw fail('激活码无效或已被管理员封禁', 403);
  const token = secretToken();
  // The count check and insertion share one write transaction: simultaneous
  // activations cannot turn a two-browser limit into three devices.
  const results = await db.batch([
    db.prepare(`INSERT OR IGNORE INTO sales_devices(key_id,device_hash,created_at)
      SELECT id,?,? FROM sales_keys WHERE id=? AND status=1 AND auth_version=?
      AND (SELECT COUNT(*) FROM sales_devices WHERE key_id=?) < 2`).bind(hashedDevice, now, key.id, key.auth_version, key.id),
    db.prepare('DELETE FROM sales_sessions WHERE key_id=? AND device_hash=?').bind(key.id, hashedDevice),
    db.prepare(`INSERT INTO sales_sessions(token_hash,key_id,device_hash,auth_version,expires_at)
      SELECT ?,k.id,?,k.auth_version,? FROM sales_keys k WHERE k.id=? AND k.status=1 AND k.auth_version=?
      AND EXISTS(SELECT 1 FROM sales_devices d WHERE d.key_id=k.id AND d.device_hash=?) RETURNING token_hash`)
      .bind(digest(token), hashedDevice, now + 30 * 86400, key.id, key.auth_version, hashedDevice),
  ]);
  if (!results[2].results?.length) throw fail('该激活码绑定设备已达上限（最多2台），或授权已变更，请联系管理员', 403);
  return { token, user: accountView(key) };
}
export async function preflight(db, keyId) {
  const key = await db.prepare('SELECT * FROM sales_keys WHERE id=?').bind(keyId).first();
  if (!key || key.status !== 1) throw fail('账号已被管理员封禁', 403);
  const now = nowSeconds(), view = accountView(key, now);
  if (!view.remaining) throw fail(`今日 AI 配额已用完（${view.used_today}/${view.daily_limit}），请明日再试`, 429, { user: view });
  if (view.retry_after || key.in_flight_until > now) throw fail('操作太频繁，请稍后再试', 429, { retry_after: Math.max(view.retry_after, Math.min(15, key.in_flight_until - now)), user: view });
  const settings = await db.prepare('SELECT * FROM ai_settings WHERE id=1').first();
  if (!settings?.enabled) throw fail('AI 服务已被管理员暂停', 503);
  return key;
}
export async function auditLocal(db, key, mode, prompt, status, message) {
  await db.prepare(`INSERT INTO ai_call_logs(request_id,key_id,sales_name,device_hash,mode,user_input,ai_output,status,charged,call_date,created_at,completed_at)
    VALUES(?,?,?,?,?,?,?,?,0,?,?,?)`).bind(crypto.randomUUID(),key.id,key.sales_name,key.device_hash,mode,prompt,message,status,salesDay(),nowSeconds(),nowSeconds()).run();
}
export async function reserve(db, key, mode, prompt) {
  const now = nowSeconds(), day = salesDay(now), id = crypto.randomUUID();
  // One D1 batch = one SQL transaction. The INSERT decides authorization,
  // device validity, account/global quota, cooldown and in-flight lock together.
  const results = await db.batch([
    db.prepare('INSERT OR IGNORE INTO ai_daily_usage(call_date,used) VALUES(?,0)').bind(day),
    db.prepare(`INSERT INTO ai_call_logs(request_id,key_id,sales_name,device_hash,mode,user_input,status,charged,call_date,created_at)
      SELECT ?,k.id,k.sales_name,?,?,?,'reserved',1,?,? FROM sales_keys k,ai_settings a
      WHERE k.id=? AND k.status=1 AND k.auth_version=? AND a.id=1 AND a.enabled=1
      AND EXISTS(SELECT 1 FROM sales_devices d WHERE d.key_id=k.id AND d.device_hash=?)
      AND (CASE WHEN k.last_call_date=? THEN k.used_today ELSE 0 END)<k.daily_limit
      AND k.last_call_timestamp<=? AND k.in_flight_until<=?
      AND (SELECT used FROM ai_daily_usage WHERE call_date=?)<a.daily_limit RETURNING request_id`)
      .bind(id,key.device_hash,mode,prompt,day,now,key.id,key.auth_version,key.device_hash,day,now-15,now,day),
    db.prepare(`UPDATE sales_keys SET used_today=(CASE WHEN last_call_date=? THEN used_today ELSE 0 END)+1,
      last_call_date=?,last_call_timestamp=?,in_flight_token=?,in_flight_until=?
      WHERE id=? AND EXISTS(SELECT 1 FROM ai_call_logs WHERE request_id=?)`).bind(day,day,now,id,now+90,key.id,id),
    db.prepare(`UPDATE ai_daily_usage SET used=used+1 WHERE call_date=? AND EXISTS(SELECT 1 FROM ai_call_logs WHERE request_id=?)`).bind(day,id),
  ]);
  if (!results[1].results?.length) {
    await preflight(db,key.id);
    throw fail('全站 AI 配额已达上限或授权已变更，请稍后再试',429,{retry_after:15});
  }
  return { id, day, keyId:key.id };
}
export async function finish(db, reservation, result, { refund = false } = {}) {
  // Refund only a reservation for which fetch was never attempted. Network
  // timeouts and malformed model output may already have incurred real costs.
  await db.batch([
    db.prepare(`UPDATE sales_keys SET
      used_today=MAX(0,used_today-CASE WHEN ?=1 AND last_call_date=? THEN 1 ELSE 0 END),
      in_flight_token=NULL,in_flight_until=0 WHERE id=? AND in_flight_token=?`)
      .bind(Number(refund),reservation.day,reservation.keyId,reservation.id),
    db.prepare(`UPDATE ai_daily_usage SET used=MAX(0,used-?) WHERE call_date=? AND EXISTS(
      SELECT 1 FROM ai_call_logs WHERE request_id=? AND status='reserved')`).bind(Number(refund),reservation.day,reservation.id),
    db.prepare(`UPDATE ai_call_logs SET ai_output=?,matched_ids=?,status=?,charged=?,completed_at=?,input_tokens=?,output_tokens=?
      WHERE request_id=? AND status='reserved'`).bind(result.reply_text || '',JSON.stringify(result.matched_ids || []),result.status,
        refund?0:1,nowSeconds(),result.input_tokens || 0,result.output_tokens || 0,reservation.id),
  ]);
}
export async function newKey(db, name, limit) {
  const plain = randomBytes(10).toString('hex').toUpperCase().slice(0,16);
  const shown = plain.match(/.{4}/g).join('-');
  const row = await db.prepare(`INSERT INTO sales_keys(key_hash,key_hint,sales_name,daily_limit,created_at)
    VALUES(?,?,?,?,?) RETURNING id`).bind(digest(plain),`••••-${plain.slice(-4)}`,name,limit,nowSeconds()).first();
  return { id:row.id, key_code:shown };
}
export async function housekeeping(db, batchSize=500) {
  // Bounded maintenance runs from authenticated admin requests and scheduled cleanup.
  const now=nowSeconds();
  await db.batch([
    db.prepare('DELETE FROM sales_rate_limits WHERE bucket IN (SELECT bucket FROM sales_rate_limits WHERE expires_at<? LIMIT ?)').bind(now,batchSize),
    db.prepare('DELETE FROM sales_sessions WHERE token_hash IN (SELECT token_hash FROM sales_sessions WHERE expires_at<? LIMIT ?)').bind(now,batchSize),
    db.prepare('DELETE FROM ai_call_logs WHERE id IN (SELECT id FROM ai_call_logs WHERE created_at<? LIMIT ?)').bind(now-90*86400,batchSize),
  ]);
}
