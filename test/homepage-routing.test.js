import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('recruitment homepage cannot open or preload the business workspace', () => {
  const html = read('index.html');
  assert.match(html, /奶茶猫/);
  assert.match(html, /wxid_i1f7e9abeyk322/);
  assert.doesNotMatch(html, /<iframe\b|<script\b[^>]*\bsrc\s*=|<script\b[^>]*type=["']module["']/i);
  assert.doesNotMatch(html, /\/api\/|\/src\/|rel=["'](?:modulepreload|prefetch|preload)["']/i);
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map(match => match[1]);
  assert.ok(links.length > 0);
  assert.ok(links.every(href => href.startsWith('#')), 'homepage buttons should stay within the landing page');
  const images = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["']/gi)].map(match => match[1]);
  assert.ok(images.length >= 5);
  assert.ok(images.every(src => src.startsWith('data:image/')), 'homepage images should not load cat API attachments');
});

test('catalogue keeps its React entry and noindex under the new build route', () => {
  const catalogue = read('cats/index.html');
  assert.match(catalogue, /src=["']\/src\/main\.jsx["']/);
  assert.match(catalogue, /name=["']robots["'][^>]*noindex/);
  assert.match(read('vite.config.js'), /cats:\s*resolve\(process\.cwd\(\),\s*'cats\/index\.html'\)/);
});

test('sales routes boot the same workspace and learning links stay inside it', () => {
  for(const path of ['manuals','guide','guide-sales','training']){
    const html=read(`${path}/index.html`);
    assert.match(html,/src=["']\/src\/main\.jsx["']/);
    assert.match(html,/noindex/);
    assert.match(read('vite.config.js'),new RegExp(`${path}/index\\.html`));
  }
  for(const path of ['src/main.jsx','src/assistant-main.jsx'])assert.match(read(path),/SalesWorkspace/);
  for(const path of ['src/learning/basics.html','src/learning/methods.html','src/learning/training.html']){
    assert.doesNotMatch(read(path),/href=["']\/["']/);
    assert.doesNotMatch(read(path),/<script\b/);
  }
  assert.match(read('src/SalesWorkspace.jsx'),/BrowserRouter/);
  assert.match(read('src/SalesWorkspace.jsx'),/CatalogProvider/);
});
