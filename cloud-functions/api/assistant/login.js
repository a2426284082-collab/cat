import { clearFailures, failLogin, json, loginAllowed, sessionCookie } from '../../_lib/assistant-auth.js';
import { sameOrigin } from '../../_lib/admin-auth.js';
import { authenticateInvite, authenticateInviteProof, usageFor } from '../../_lib/assistant-store.js';
import { serviceFailure } from '../../_lib/service-errors.js';

export async function onRequestPost({ env, request, runtime }) {
  if (!loginAllowed(request)) return json({ success: false, message: '尝试次数过多，请15分钟后再试' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  if (runtime === 'cloudflare' && !body?.challenge) return json({ success: false, code: 'AUTH_REFRESH_REQUIRED', message: '登录页面已更新，请刷新后重新登录' }, 409);
  if (body?.challenge && !sameOrigin(request)) return json({ success: false, message: '请求来源无效' }, 403);
  try {
    const seller = body?.challenge ? await authenticateInviteProof(env, request, body) : await authenticateInvite(env, body?.code);
    if (!seller) { failLogin(request); return json({ success: false, message: '邀请码无效或已停用' }, 401); }
    const used = await usageFor(env, seller.salesId);
    const cookie = sessionCookie(env, seller);
    clearFailures(request);
    return json({ success: true, user: { salesId: seller.salesId, name: seller.name, quota: seller.quota, used } }, 200, { 'Set-Cookie': cookie });
  } catch (error) { return serviceFailure(error, '销售助手登录失败，请联系运营检查配置'); }
}
