import { requireAdmin } from '../../../_lib/admin-auth.js';
import { getImage } from '../../../_lib/feishu.js';

export async function onRequestGet({ env, request, params }) {
  if (!requireAdmin(request, env)) return new Response(null, { status: 401 });
  const token = String(params?.token || '');
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(token)) return new Response(null, { status: 404 });
  try {
    const { bytes, type } = await getImage(env, token);
    return new Response(bytes, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, noimageindex' } });
  } catch { return new Response(null, { status: 502 }); }
}
