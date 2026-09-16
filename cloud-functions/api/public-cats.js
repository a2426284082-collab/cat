import { getCatalog } from '../_lib/feishu.js';

export async function onRequestGet({ env }) {
  try {
    const { cats, updatedAt } = await getCatalog(env);
    return new Response(JSON.stringify({ success: true, data: cats, updatedAt }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false, message: '暂时无法读取猫咪资料，请稍后重试' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
