import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('calculator is in the existing sidebar tool section, not a hidden mobile nav cell',()=>{
 const sidebar=file('src/workspace/SidebarUtilities.jsx');
 const workspace=file('src/SalesWorkspace.jsx');
 assert.match(sidebar, /sidebar-art-tools[\s\S]*打开运费与收款速算器/);
 assert.match(sidebar, /config\.calculatorEnabled&&!customerDisplay\.enabled/);
 assert.doesNotMatch(workspace, /calculatorLaunch/);
 assert.doesNotMatch(workspace, /侧边栏打开运费与收款速算器/);
});
test('heavy poster and calculator bundles are lazy-loaded',()=>{
 const sidebar=file('src/workspace/SidebarUtilities.jsx');
 const workspace=file('src/SalesWorkspace.jsx');
 assert.match(sidebar, /lazy\(\(\)=>import\('\.\/CatTools\.jsx'\)/);
 assert.match(workspace, /const MarketingStudio=lazy\(\(\)=>import\('\.\/workspace\/MarketingStudio\.jsx'\)\)/);
 assert.match(workspace, /const CatTools=lazy\(\(\)=>import\('\.\/workspace\/CatTools\.jsx'\)\)/);
});
test('catalog refresh is not a five-minute loop, and failure preserves last known data',()=>{
 const source=file('src/workspace/catalog.jsx');
 assert.match(source, /CATALOG_AUTO_REFRESH_MS=15\*60\*1000/);
 assert.match(source, /if\(!document.hidden\)refresh\(\)/);
 assert.match(source, /当前仍显示上次成功同步的猫源/);
 assert.match(source, /FEISHU_TIMEOUT/);
 assert.match(source, /return \{ok:false,reason\}/);
 assert.match(source, /localStorage\.setItem\(KEY,JSON\.stringify\(\{data:publicRows\(body\.data\)/);
});
test('backend agent stock API exposes only safe failure codes and does not claim every failure is a D1 migration',()=>{
 const server=file('cloud-functions/_lib/proposals-api.js');
 assert.match(server, /safeCodes=new Set\(\['FEISHU_TIMEOUT'/);
 assert.match(server, /飞书猫源暂时无法读取/);
 assert.match(server, /if\(!error.status\)console.error\('proposal_service_failed',code\|\|'SERVICE_ERROR'\)/);
});
