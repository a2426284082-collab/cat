import { authenticateCredentials, clearLoginFailures, createSessionCookie, json, loginAllowed, recordLoginFailure, sameOrigin } from '../../_lib/admin-auth.js';

export async function onRequestPost({ env, request }) {
  if (!sameOrigin(request)) return json({ success: false, message: '请求来源无效' }, 403);
  if (!loginAllowed(request)) return json({ success: false, message: '登录失败次数过多，请15分钟后再试' }, 429);
  let body;
  try { body = await request.json(); } catch { return json({ success: false, message: '请求格式错误' }, 400); }
  if (!authenticateCredentials(env, body?.username, body?.password)) {
    recordLoginFailure(request);
    return json({ success: false, message: '账号或密码错误' }, 401);
  }
  clearLoginFailures(request);
  return json({ success: true, user: { username: String(env.ADMIN_USERNAME).trim() } }, 200, { 'Set-Cookie': createSessionCookie(env) });
}
