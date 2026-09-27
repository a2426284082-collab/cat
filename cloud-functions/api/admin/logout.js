import { clearSessionCookie, json, sameOrigin } from '../../_lib/admin-auth.js';

export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ success: false }, 403);
  return json({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() });
}
