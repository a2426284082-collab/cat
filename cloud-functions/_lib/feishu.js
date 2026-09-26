const FEISHU = 'https://open.feishu.cn/open-apis';
const CACHE_MS = 5 * 60 * 1000;

// These caches live only for the lifetime of one function instance. They are an
// optimization; correctness never depends on a shared process or a timer.
let tokenCache = { key: '', value: '', until: 0 };
let catalogCache = { key: '', value: null, until: 0, pending: null };

function config(env) {
  const keys = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'FEISHU_APP_TOKEN', 'FEISHU_TABLE_ID'];
  if (keys.some(key => !env?.[key])) throw new Error('missing configuration');
  return env;
}

async function feishuJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Feishu HTTP error');
  const result = await response.json();
  if (result.code !== 0) throw new Error('Feishu API error');
  return result.data ?? result;
}

async function accessToken(env) {
  const key = `${env.FEISHU_APP_ID}:${env.FEISHU_APP_SECRET}`;
  if (tokenCache.key === key && Date.now() < tokenCache.until) return tokenCache.value;
  const result = await feishuJson(`${FEISHU}/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.FEISHU_APP_ID, app_secret: env.FEISHU_APP_SECRET }),
  });
  if (!result.tenant_access_token) throw new Error('Feishu token missing');
  tokenCache = {
    key,
    value: result.tenant_access_token,
    until: Date.now() + Math.max(0, (Number(result.expire) || 7200) - 300) * 1000,
  };
  return tokenCache.value;
}

function stringValue(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map(stringValue).filter(Boolean).join('');
  if (typeof value === 'object') return stringValue(value.text ?? value.name ?? '');
  return String(value).trim();
}

const VIDEO_TYPES = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm' };

function videoAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    const extension = name.split('.').pop()?.toLowerCase();
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(item?.file_token ?? '') || !VIDEO_TYPES[extension]) return [];
    const displayName = name.length > 120 ? `${name.slice(0, 110)}.${extension}` : name;
    return [{ name: displayName, url: `/api/public-videos/${encodeURIComponent(item.file_token)}` }];
  });
}

function publicCat(record) {
  const fields = record.fields ?? {};
  if (stringValue(fields['状态']) !== '在售') return null;
  const id = stringValue(fields['猫咪ID']);
  if (!id) return null;
  const images = Array.isArray(fields['图片'])
    ? fields['图片'].filter(item => /^[A-Za-z0-9_-]{1,200}$/.test(item?.file_token ?? ''))
      .map(item => `/api/public-images/${encodeURIComponent(item.file_token)}`)
    : [];
  const rawPrice = fields['价格'] == null || stringValue(fields['价格']) === '' ? NaN : Number(fields['价格']);
  return {
    id,
    breed: stringValue(fields['品种']),
    color: stringValue(fields['毛色/花色']),
    gender: stringValue(fields['性别']),
    age: stringValue(fields['年龄']),
    vaccine: stringValue(fields['疫苗']),
    description: stringValue(fields['描述']),
    price: Number.isFinite(rawPrice) && rawPrice >= 0 ? rawPrice : null,
    image: images[0] ?? null,
    images,
    videos: videoAttachments(fields['视频']),
  };
}

async function loadCatalog(env) {
  const token = await accessToken(env);
  const url = `${FEISHU}/bitable/v1/apps/${encodeURIComponent(env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(env.FEISHU_TABLE_ID)}/records`;
  const items = [];
  let pageToken = '';
  do {
    const pageUrl = new URL(url);
    pageUrl.searchParams.set('page_size', '100');
    if (pageToken) pageUrl.searchParams.set('page_token', pageToken);
    const data = await feishuJson(pageUrl, { headers: { Authorization: `Bearer ${token}` } });
    items.push(...(data.items ?? []));
    if (items.length > 5000) throw new Error('catalog too large');
    pageToken = data.has_more ? data.page_token : '';
    if (data.has_more && !pageToken) throw new Error('pagination token missing');
  } while (pageToken);
  const cats = items.map(publicCat).filter(Boolean);
  return {
    cats,
    imageTokens: new Set(cats.flatMap(cat => cat.images.map(image => image.split('/').pop()))),
    videoTokens: new Map(cats.flatMap(cat => cat.videos.map(video => [video.url.split('/').pop(), VIDEO_TYPES[video.name.split('.').pop().toLowerCase()]]))),
    updatedAt: new Date().toISOString(),
  };
}

export async function getCatalog(envInput) {
  const env = config(envInput);
  const key = [env.FEISHU_APP_ID, env.FEISHU_APP_SECRET, env.FEISHU_APP_TOKEN, env.FEISHU_TABLE_ID].join(':');
  if (catalogCache.key !== key) catalogCache = { key, value: null, until: 0, pending: null };
  if (catalogCache.value && Date.now() < catalogCache.until) return catalogCache.value;
  if (!catalogCache.pending) {
    catalogCache.pending = loadCatalog(env).then(value => {
      catalogCache.value = value;
      catalogCache.until = Date.now() + CACHE_MS;
      return value;
    }).finally(() => { catalogCache.pending = null; });
  }
  return catalogCache.pending;
}

export async function getImage(envInput, fileToken) {
  const env = config(envInput);
  const token = await accessToken(env);
  const response = await fetch(`${FEISHU}/drive/v1/medias/${encodeURIComponent(fileToken)}/download`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('Feishu media error');
  const type = response.headers.get('content-type')?.split(';')[0]?.toLowerCase();
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowed.includes(type)) throw new Error('unsupported image');
  if (Number(response.headers.get('content-length')) > 10 * 1024 * 1024) throw new Error('image too large');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error('image too large');
  return { bytes, type };
}

export async function getVideoChunk(envInput, fileToken, start, end, type) {
  const env = config(envInput);
  const token = await accessToken(env);
  const response = await fetch(`${FEISHU}/drive/v1/medias/${encodeURIComponent(fileToken)}/download`, {
    headers: { Authorization: `Bearer ${token}`, Range: `bytes=${start}-${end}`, 'Accept-Encoding': 'identity' },
    signal: AbortSignal.timeout(20000),
  });
  if (response.status === 416) return null;
  // Some Feishu media downloads ignore Range and respond with the whole file.
  // Read only the requested window and cancel the upstream stream afterwards.
  if (response.status === 200) {
    const total = Number(response.headers.get('content-length'));
    if (!Number.isSafeInteger(total) || total <= 0 || start >= total || !response.body) {
      if (start >= total && Number.isSafeInteger(total) && total > 0) return null;
      throw new Error('video size unavailable');
    }
    const to = Math.min(end, total - 1);
    const bytes = new Uint8Array(to - start + 1);
    const reader = response.body.getReader();
    let offset = 0;
    try {
      while (offset <= to) {
        const { done, value } = await reader.read();
        if (done) throw new Error('video stream ended early');
        const from = Math.max(start - offset, 0);
        const until = Math.min(to - offset + 1, value.byteLength);
        if (until > from) bytes.set(value.subarray(from, until), offset + from - start);
        offset += value.byteLength;
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return { bytes, contentRange: `bytes ${start}-${to}/${total}`, type };
  }
  if (response.status !== 206) throw new Error('Feishu video download error');
  const contentRange = response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/i);
  if (!contentRange) throw new Error('missing video content range');
  const [, from, to, total] = contentRange.map(Number);
  if (from !== start || to > end || to < from || total <= to || to - from + 1 > 4 * 1024 * 1024) {
    throw new Error('invalid video content range');
  }
  if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024) throw new Error('video chunk too large');
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== to - from + 1) throw new Error('video chunk length mismatch');
  return { bytes, contentRange: `bytes ${from}-${to}/${total}`, type };
}
