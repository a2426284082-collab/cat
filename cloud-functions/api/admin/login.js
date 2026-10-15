import { authenticateAdminProof, authenticateCredentials, clearLoginFailures, createSessionCookie, json, loginAllowed, recordLoginFailure, sameOrigin } from '../../_lib/admin-auth.js';
import { serviceFailure } from '../../_lib/service-errors.js';

export async function onRequestPost({ env, request, runtime }) {
  if (!loginAllowed(request)) return json({ success: false, message: '登录失败次数过多，请15分钟后再试' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  if (runtime === 'cloudflare' && !body?.challenge) return json({ success: false, code: 'AUTH_REFRESH_REQUIRED', message: '登录页面已更新，请刷新后重新登录' }, 409);
  if (body?.challenge && !sameOrigin(request)) return json({ success: false, message: '请求来源无效' }, 403);
  let authenticated;
  try { authenticated = body?.challenge ? authenticateAdminProof(env, request, body) : authenticateCredentials(env, body?.username, body?.password); }
  catch (error) { return serviceFailure(error, '管理员登录配置不完整，请联系运营'); }
  if (!authenticated) {
    recordLoginFailure(request);
    return json({ success: false, message: '账号或密码错误' }, 401);
  }
  clearLoginFailures(request);
  return json({ success: true, user: { username: String(env.ADMIN_USERNAME).trim() } }, 200, { 'Set-Cookie': createSessionCookie(env) });
}
