import { json, requireAdmin } from '../../_lib/admin-auth.js';
import { getAdminCats } from '../../_lib/feishu.js';

export async function onRequestGet({ env, request }) {
  if (!requireAdmin(request, env)) return json({ success: false, message: '请先登录' }, 401);
  try { return json({ success: true, data: await getAdminCats(env) }); }
  catch { return json({ success: false, message: '读取飞书猫源失败' }, 502); }
}
