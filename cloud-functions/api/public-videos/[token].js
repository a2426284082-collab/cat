import { getCatalog, getVideoChunk } from '../../_lib/feishu.js';

const CHUNK_SIZE = 4 * 1024 * 1024;

export async function onRequestGet({ env, params, request }) {
  const fileToken = params?.token ?? '';
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(fileToken)) return new Response(null, { status: 404 });
  const range = request?.headers.get('range');
  const match = range ? /^bytes=(\d+)-(\d*)$/.exec(range) : null;
  if (range && !match) return new Response(null, { status: 416 });
  const start = match ? Number(match[1]) : 0;
  const requestedEnd = match?.[2] ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return new Response(null, { status: 416 });
  }
  const end = Math.min(requestedEnd, start + CHUNK_SIZE - 1);
  try {
    const catalog = await getCatalog(env);
    const type = catalog.videoTokens.get(fileToken);
    if (!type) return new Response(null, { status: 404 });
    const chunk = await getVideoChunk(env, fileToken, start, end, type);
    if (!chunk) return new Response(null, { status: 416 });
    return new Response(chunk.bytes, {
      status: 206,
      headers: {
        'Content-Type': chunk.type,
        'Content-Range': chunk.contentRange,
        'Content-Length': String(chunk.bytes.byteLength),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=60',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response(null, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}
