import { json, requireAdmin, sameOrigin } from '../../_lib/admin-auth.js';
import { createSeller, logs, sellers } from '../../_lib/assistant-store.js';
import { serviceFailure } from '../../_lib/service-errors.js';

export async function onRequestGet({ env, request }) {
  if (!requireAdmin(request, env)) return json({ success: false, message: '请先登录' }, 401);
  try {
    const list = await sellers(env), rows = await logs(env), month = new Date().toISOString().slice(0, 7);
    const counts = new Map();
    for (const row of rows) if ((row.month || row.time.slice(0, 7)) === month) counts.set(row.salesId, (counts.get(row.salesId) || 0) + 1);
    const data = list.map(({ inviteHash, ...seller }) => ({ ...seller, used: counts.get(seller.salesId) || 0 }));
    return json({ success: true, data });
  } catch (error) { return serviceFailure(error, '读取销售账号失败，请检查两张AI表配置', 502); }
}
export async function onRequestPost({ env, request }) {
  if (!requireAdmin(request, env)) return json({ success: false, message: '请先登录' }, 401);
  if (!sameOrigin(request)) return json({ success: false, message: '请求来源无效' }, 403);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  if (!String(body?.name || '').trim()) return json({ success: false, message: '请填写销售姓名' }, 400);
  try { return json({ success: true, data: await createSeller(env, body) }, 201); }
  catch (error) { return serviceFailure(error, '创建失败，请检查销售账号表字段', 502); }
}
