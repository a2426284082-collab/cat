import { json, requireAdmin } from '../../_lib/admin-auth.js';

export async function onRequestGet({ env, request }) {
  const admin = requireAdmin(request, env);
  return admin ? json({ success: true, user: admin }) : json({ success: false }, 401);
}
