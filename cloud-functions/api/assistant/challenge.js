import { failLogin, json, loginAllowed } from '../../_lib/assistant-auth.js';
import { sameOrigin } from '../../_lib/admin-auth.js';
import { assistantLoginChallenge } from '../../_lib/assistant-store.js';
import { serviceFailure } from '../../_lib/service-errors.js';

export async function onRequestPost({ env, request }) {
  if (!sameOrigin(request)) return json({ success: false, message: '请求来源无效' }, 403);
  if (!loginAllowed(request)) return json({ success: false, message: '尝试次数过多，请15分钟后再试' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  if (!/^[A-Za-z0-9_-]{2,80}$/.test(body?.salesId || '')) return json({ success: false, message: '邀请码格式不正确' }, 400);
  try {
    const challenge = await assistantLoginChallenge(env, request, body.salesId);
    if (!challenge) { failLogin(request); return json({ success: false, message: '邀请码无效或已停用' }, 401); }
    return json({ success: true, data: challenge.data }, 200, { 'Set-Cookie': challenge.cookie });
  } catch (error) { return serviceFailure(error, '无法读取销售账号，请联系运营检查配置'); }
}
