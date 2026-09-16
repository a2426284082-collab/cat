import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { onRequestGet as list } from '../cloud-functions/api/public-cats.js';
import { onRequestGet as image } from '../cloud-functions/api/public-images/[token].js';
import { onRequestGet as video } from '../cloud-functions/api/public-videos/[token].js';

// Local-only adapter; the deployed project uses EdgeOne's cloud-functions.
try {
  const lines = readFileSync(new URL('../.env', import.meta.url), 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*(FEISHU_[A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
} catch {
  // Environment variables may already be set in the shell.
}

createServer(async (req, res) => {
  let result;
  const path = new URL(req.url, 'http://localhost').pathname;
  if (req.method !== 'GET') result = new Response(null, { status: 405 });
  else if (path === '/api/public-cats') result = await list({ env: process.env });
  else if (/^\/api\/public-images\/[A-Za-z0-9_-]{1,200}$/.test(path)) {
    result = await image({ env: process.env, params: { token: path.split('/').pop() } });
  } else if (/^\/api\/public-videos\/[A-Za-z0-9_-]{1,200}$/.test(path)) {
    result = await video({ env: process.env, params: { token: path.split('/').pop() }, request: new Request(`http://localhost${path}`, { headers: req.headers }) });
  } else result = new Response(null, { status: 404 });
  res.writeHead(result.status, Object.fromEntries(result.headers));
  res.end(Buffer.from(await result.arrayBuffer()));
}).listen(8787, '127.0.0.1', () => {
  console.log('本地只读接口：http://127.0.0.1:8787');
});
