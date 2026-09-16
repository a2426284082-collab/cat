import { getCatalog, getImage } from '../../_lib/feishu.js';

export async function onRequestGet({ env, params }) {
  const fileToken = params?.token ?? '';
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(fileToken)) return new Response(null, { status: 404 });
  try {
    const catalog = await getCatalog(env);
    if (!catalog.imageTokens.has(fileToken)) return new Response(null, { status: 404 });
    const { bytes, type } = await getImage(env, fileToken);
    return new Response(bytes, {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=300, s-maxage=300', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
