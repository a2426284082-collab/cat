import { adminLoginChallenge, json, loginAllowed, sameOrigin } from '../../_lib/admin-auth.js';
import { serviceFailure } from '../../_lib/service-errors.js';

export async function onRequestPost({ env, request }) {
  if (!sameOrigin(request)) return json({ success: false, message: '请求来源无效' }, 403);
  if (!loginAllowed(request)) return json({ success: false, message: '登录失败次数过多，请15分钟后再试' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  if (typeof body?.username !== 'string' || body.username.length > 100) return json({ success: false, message: '请输入有效账号' }, 400);
  try {
    const challenge = adminLoginChallenge(env, request, body.username);
    return json({ success: true, data: challenge.data }, 200, { 'Set-Cookie': challenge.cookie });
  } catch (error) { return serviceFailure(error, '管理员登录配置不完整，请联系运营'); }
}
