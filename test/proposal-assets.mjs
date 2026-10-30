// Local Worker + Cloudflare Assets routing. Run npm run build first.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
const output=await build({entryPoints:['cloudflare-worker.js'],bundle:true,write:false,format:'esm',platform:'browser',external:['node:*'],target:'es2022'});
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:output.outputFiles[0].text,compatibilityDate:'2026-10-15',compatibilityFlags:['nodejs_compat'],assets:{directory:'dist',binding:'ASSETS',routerConfig:{has_user_worker:true},run_worker_first:['/api/*','/p/*']}}));
try{
 const response=await mf.dispatchFetch('https://local.test/p/abcdefghijklmnopqrstuvwx');assert.equal(response.status,200,await response.clone().text());assert.equal(response.headers.get('location'),null);assert.match(response.headers.get('content-type'),/text\/html/);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);const html=await response.text();assert.match(html,/给你的专属选猫方案/);assert.doesNotMatch(html,/workspace-sidebar|代理激活码/);
 const forward=await mf.dispatchFetch('https://local.test/forward/');assert.equal(forward.status,200);assert.match(await forward.text(),/forward-app/);
 const head=await mf.dispatchFetch('https://local.test/p/abcdefghijklmnopqrstuvwx',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 const api=await mf.dispatchFetch('https://local.test/api/proposals/abcdefghijklmnopqrstuvwx');assert.equal(api.status,503);assert.match(api.headers.get('content-type'),/application\/json/);
 console.log('PASS: actual local Worker/Assets short-link routing returns standalone customer HTML without redirect; forward entry and HEAD work, APIs never fall back to HTML');
}finally{await mf.dispose();}
