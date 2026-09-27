import { json, requireAdmin, sameOrigin } from '../../../_lib/admin-auth.js';
import { updateAdminCat } from '../../../_lib/feishu.js';

export async function onRequestPatch({ env, request, params }) {
  if (!requireAdmin(request, env)) return json({ success: false, message: '请先登录' }, 401);
  if (!sameOrigin(request)) return json({ success: false, message: '请求来源无效' }, 403);
  const recordId = String(params?.recordId || '');
  if (!/^rec[A-Za-z0-9]{5,80}$/.test(recordId)) return json({ success: false, message: '记录编号无效' }, 400);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  try { return json({ success: true, data: await updateAdminCat(env, recordId, body) }); }
  catch (error) { return json({ success: false, message: error?.message === 'invalid fields' ? '提交字段格式不正确' : '更新飞书记录失败' }, error?.message === 'invalid fields' ? 400 : 502); }
}
