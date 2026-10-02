import { parseDemand } from '../_lib/smart-search.js';

const buckets = new Map();
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clientIp = request => request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

function allowed(request) {
  const now = Date.now(), day = new Date().toISOString().slice(0, 10), key = `${day}:${clientIp(request)}`;
  for (const [savedKey, value] of buckets) if (value.expires < now) buckets.delete(savedKey);
  const current = buckets.get(key) || { count: 0, last: 0, expires: now + 86400000 };
  if (now - current.last < 2500) return { ok: false, retry: true };
  if (current.count >= 60) return { ok: false, retry: false };
  current.count += 1; current.last = now; buckets.set(key, current); return { ok: true };
}

export async function onRequestPost({ env, request }) {
  const limit = allowed(request);
  if (!limit.ok) return json({ success: false, message: limit.retry ? '操作太快，请稍后再试' : '今日智能整理次数已用完，请使用下方筛选条件' }, 429);
  let body; try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  const text = String(body?.text || '').trim();
  const breeds = Array.isArray(body?.breeds) ? body.breeds.map(String).slice(0, 80) : [];
  const colors = Array.isArray(body?.colors) ? body.colors.map(String).slice(0, 80) : [];
  if (text.length < 2 || text.length > 300) return json({ success: false, message: '请输入2至300字的客户需求' }, 400);
  try { return json({ success: true, data: await parseDemand(env, { text, breeds, colors }) }); }
  catch { return json({ success: false, message: '暂时无法智能整理，请直接使用下方筛选条件' }, 502); }
}
