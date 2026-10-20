// Run ONLY by edgeone.json, after Vite. Cloudflare keeps the normal build.
import { readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

async function markHtml(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await markHtml(path);
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = (await readFile(path, 'utf8'))
        .replace(/<meta\b(?=[^>]*\bname\s*=\s*["']robots["'])[^>]*>/gi, '');
      await writeFile(path, html.replace(/<head\b[^>]*>/i,
        '$&\n<meta name="robots" content="noindex,nofollow,noarchive">'));
    }
  }
}

await markHtml('dist');
// Google/Bing must crawl HTML to see noindex and remove any old results.
// Other crawlers, including Baiduspider, are asked not to crawl this mirror.
await writeFile('dist/robots.txt', `User-agent: Googlebot
User-agent: Bingbot
Allow: /
Disallow: /api/
Disallow: /.internal-cache/

User-agent: *
Disallow: /
`);
await rm('dist/sitemap.xml', { force: true });
console.log('EdgeOne: HTML marked noindex; mirror sitemap removed.');
