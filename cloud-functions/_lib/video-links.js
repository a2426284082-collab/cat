import { getMediaDownloadLink } from './feishu.js';

// Refresh well before Feishu's documented 24-hour expiry. Cache failure briefly
// too, so missing permissions do not trigger a new link request on every play.
const LINK_TTL = 60 * 60 * 1000;
const FAILURE_TTL = 30 * 1000;
const MAX_ENTRIES = 256;
const entries = new Map();
const pending = new Map();

function validLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      ['feishu.cn', 'feishucdn.com'].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}

function remember(key, entry) {
  entries.delete(key);
  while (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value);
  entries.set(key, entry);
  return entry.url;
}

async function sharedKey(requestUrl, scope, fileToken) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope));
  const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = new URL(requestUrl);
  key.pathname = `/.internal-cache/feishu-video-links/v1/${digest}/${encodeURIComponent(fileToken)}`;
  key.search = '';
  key.hash = '';
  return new Request(key.href);
}

export async function getTemporaryVideoLink(env, fileToken, requestUrl) {
  const scope = JSON.stringify([env.FEISHU_APP_ID, env.FEISHU_APP_SECRET, env.FEISHU_APP_TOKEN, env.FEISHU_TABLE_ID]);
  const key = `${scope}:${fileToken}`;
  const existing = entries.get(key);
  if (existing?.until > Date.now()) return existing.url;
  if (pending.has(key)) return pending.get(key);

  const work = (async () => {
    // Cloudflare's Cache API shares links between isolates at the same edge
    // location. Other platforms safely use the bounded in-memory cache only.
    let cache, cacheKey;
    try {
      cache = globalThis.caches?.default;
      if (cache && requestUrl) {
        cacheKey = await sharedKey(requestUrl, scope, fileToken);
        const response = await cache.match(cacheKey);
        if (response) {
          const entry = await response.json();
          if (Number.isFinite(entry.until) && entry.until > Date.now() &&
              entry.until <= Date.now() + LINK_TTL && (entry.url === null || validLink(entry.url))) {
            return remember(key, entry);
          }
        }
      }
    } catch { /* Cache availability must not decide whether a video plays. */ }

    let url = null;
    try {
      const value = await getMediaDownloadLink(env, fileToken);
      if (validLink(value)) url = value;
    } catch { /* Use the original proxy if Feishu denies or times out. */ }
    const ttl = url ? LINK_TTL : FAILURE_TTL;
    const entry = { url, until: Date.now() + ttl };
    remember(key, entry);
    if (cache && cacheKey) {
      try {
        await cache.put(cacheKey, new Response(JSON.stringify(entry), {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl / 1000}` },
        }));
      } catch { /* Memory cache remains usable when shared caching fails. */ }
    }
    return url;
  })();
  pending.set(key, work);
  try { return await work; }
  finally { pending.delete(key); }
}
