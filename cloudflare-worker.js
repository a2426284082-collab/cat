// Cloudflare entry point. Existing EdgeOne handlers remain the business source.
import * as publicCats from './cloud-functions/api/public-cats.js';
import * as publicImages from './cloud-functions/api/public-images/[token].js';
import * as publicVideos from './cloud-functions/api/public-videos/[token].js';
import * as adminChallenge from './cloud-functions/api/admin/challenge.js';
import * as assistantChallenge from './cloud-functions/api/assistant/challenge.js';
import { serviceFailure } from './cloud-functions/_lib/service-errors.js';
import * as smartSearch from './cloud-functions/api/smart-search.js';
import * as adminLogin from './cloud-functions/api/admin/login.js';
import * as adminLogout from './cloud-functions/api/admin/logout.js';
import * as adminSession from './cloud-functions/api/admin/session.js';
import * as adminCats from './cloud-functions/api/admin/cats.js';
import * as adminCat from './cloud-functions/api/admin/cats/[recordId].js';
import * as adminImage from './cloud-functions/api/admin/images/[token].js';
import * as adminSales from './cloud-functions/api/admin/sales.js';
import * as adminSeller from './cloud-functions/api/admin/sales/[recordId].js';
import * as adminLogs from './cloud-functions/api/admin/assistant-logs.js';
import * as assistantLogin from './cloud-functions/api/assistant/login.js';
import * as assistantLogout from './cloud-functions/api/assistant/logout.js';
import * as assistantSession from './cloud-functions/api/assistant/session.js';
import * as assistantHistory from './cloud-functions/api/assistant/history.js';
import * as assistantReply from './cloud-functions/api/assistant/reply.js';

const route = (path, handlers) => {
  const names = [];
  const pattern = path.split('/').map(segment => {
    if (segment.startsWith(':')) { names.push(segment.slice(1)); return '([^/]+)'; }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/');
  const methods = Object.fromEntries(Object.entries(handlers)
    .filter(([name]) => /^onRequest(?:Get|Post|Patch|Put|Delete|Options)$/.test(name))
    .map(([name, handler]) => [name.slice('onRequest'.length).toUpperCase(), handler]));
  return { pattern: new RegExp(`^${pattern}/?$`), names, methods };
};

const routes = [
  route('/api/public-cats', publicCats),
  route('/api/public-images/:token', publicImages),
  route('/api/public-videos/:token', publicVideos),
  route('/api/admin/challenge', adminChallenge),
  route('/api/assistant/challenge', assistantChallenge),
  route('/api/smart-search', smartSearch),
  route('/api/admin/login', adminLogin),
  route('/api/admin/logout', adminLogout),
  route('/api/admin/session', adminSession),
  route('/api/admin/cats', adminCats),
  route('/api/admin/cats/:recordId', adminCat),
  route('/api/admin/images/:token', adminImage),
  route('/api/admin/sales', adminSales),
  route('/api/admin/sales/:recordId', adminSeller),
  route('/api/admin/assistant-logs', adminLogs),
  route('/api/assistant/login', assistantLogin),
  route('/api/assistant/logout', assistantLogout),
  route('/api/assistant/session', assistantSession),
  route('/api/assistant/history', assistantHistory),
  route('/api/assistant/reply', assistantReply),
];

const json = (message, status, headers = {}) => Response.json(
  { success: false, message },
  { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } },
);

function platformRequest(request) {
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  // Use the public request URL for origin checks, and Cloudflare's client IP.
  headers.delete('x-forwarded-host');
  headers.set('host', url.host);
  headers.set('x-forwarded-proto', url.protocol.slice(0, -1));
  const ip = headers.get('cf-connecting-ip') || 'unknown';
  headers.set('x-forwarded-for', ip);
  headers.set('x-real-ip', ip);
  return new Request(request, { headers });
}

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;
    if (pathname !== '/api' && !pathname.startsWith('/api/')) {
      return env.ASSETS.fetch(request);
    }
    for (const current of routes) {
      const match = current.pattern.exec(pathname);
      if (!match) continue;
      const method = request.method === 'HEAD' ? 'GET' : request.method;
      const handler = current.methods[method];
      if (!handler) {
        const allowed = Object.keys(current.methods);
        if (allowed.includes('GET')) allowed.push('HEAD');
        return json('请求方法不支持', 405, { Allow: allowed.join(', ') });
      }
      const params = {};
      try {
        current.names.forEach((name, index) => {
          const value = decodeURIComponent(match[index + 1]);
          if (!value || /[/\\\u0000]/.test(value)) throw new Error('invalid parameter');
          params[name] = value;
        });
      } catch { return json('请求参数无效', 400); }
      try {
        const response = await handler({
          request: platformRequest(request), env, params, data: {}, runtime: 'cloudflare',
          waitUntil: promise => ctx.waitUntil(promise),
        });
        if (request.method === 'HEAD') {
          await response.body?.cancel();
          return new Response(null, { status: response.status, headers: response.headers });
        }
        return response;
      } catch (error) {
        // Do not expose credentials or upstream request details to browsers.
        return serviceFailure(error, '服务暂时不可用，请检查服务端配置或稍后重试');
      }
    }
    return json('接口不存在', 404);
  },
};
