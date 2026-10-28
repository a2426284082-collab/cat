'use strict';
function replace(s,old,next,{optional=false,all=false}={}){if(!s.includes(old)){if(optional)return s;throw new Error('Source anchor missing: '+old.slice(0,100));}if(!all&&s.indexOf(old)!==s.lastIndexOf(old))throw new Error('Source anchor ambiguous: '+old.slice(0,80));return all?s.split(old).join(next):s.replace(old,next);}
const transforms={
 'cloud-functions/_lib/sales-store.js':s=>{
  s="import {readWorkbench,checkKeyExpiry,createManagedKey} from './workbench-control.js';\n"+s;
  s=replace(s,'  return row;\n}\nexport function accountView',"  await checkKeyExpiry(db,row.id);row._cooldownSeconds=(await readWorkbench(db,{fresh:true})).cooldownSeconds;\n  return row;\n}\nexport function accountView");
  s=replace(s,'Math.max(0, 15 - (now - row.last_call_timestamp))','Math.max(0, (row._cooldownSeconds??15) - (now - row.last_call_timestamp))');
  s=replace(s,'  const token = secretToken();',"  await checkKeyExpiry(db,key.id);const policy=await readWorkbench(db,{fresh:true});key._cooldownSeconds=policy.cooldownSeconds;\n  const token = secretToken();");
  s=replace(s,'< 2`).bind(hashedDevice, now, key.id, key.auth_version, key.id)', '< ?`).bind(hashedDevice, now, key.id, key.auth_version, key.id,policy.maxDevices)');
  s=replace(s,"throw fail('该激活码绑定设备已达上限（最多2台），或授权已变更，请联系管理员', 403)","throw fail(`该激活码绑定设备已达上限（最多${policy.maxDevices}台），或授权已变更，请联系管理员`, 403)");
  s=replace(s,'  const now = nowSeconds(), view = accountView(key, now);', '  await checkKeyExpiry(db,key.id);key._cooldownSeconds=(await readWorkbench(db,{fresh:true})).cooldownSeconds;\n  const now = nowSeconds(), view = accountView(key, now);');
  s=replace(s,'now-15,now,day)', 'now-(key._cooldownSeconds??15),now,day)');
  s=replace(s,'export async function newKey(db, name, limit) {','export async function newKey(db, name, limit, env) {\n  if(env)return createManagedKey(db,env,name,limit);');return s;
 },
 'cloud-functions/_lib/sales-api.js':s=>{
  s="import {readWorkbench,ensureControlTables,decorateKeys,encryptSalesCode,vaultStatement,adminEventStatement,checkKeyExpiry} from './workbench-control.js';\nimport {handleWorkbenchAdmin} from './workbench-admin.js';\n"+s;
  s=replace(s,"  if(path==='/api/sales-admin/settings') {", "  if(path==='/api/sales-admin/control')return handleWorkbenchAdmin(db,env,request,path,body);\n  if(path==='/api/sales-admin/settings') {");
  s=replace(s,'newKey(db,name,limitValue(body.daily_limit??20))','newKey(db,name,limitValue(body.daily_limit??(await readWorkbench(db)).defaultDailyLimit),env)');
  s=replace(s,'    await housekeeping(db);\n    const rows=', '    const rows=');
  s=replace(s,'return json({success:true,data:rows.results});\n  }\n  const match=', 'return json({success:true,data:await decorateKeys(db,rows.results)});\n  }\n  const match=');
  s=replace(s,'(\\/logs)?$/','(\\/logs|\\/reveal)?$/');
  s=replace(s,'  if(match[2]) {',"  if(match[2]==='/reveal')return handleWorkbenchAdmin(db,env,request,path,body,key);\n  if(match[2]) {");
  s=replace(s,"  if(body.action==='status') {", "  if(['name','expiry','profile'].includes(body.action))return handleWorkbenchAdmin(db,env,request,path,body,key);\n  if(body.action==='status') {");
  const anchor="const code=crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase();";
  s=replace(s,anchor,anchor+"\n    await ensureControlTables(db);const encrypted=await encryptSalesCode(env,code.match(/.{4}/g).join('-'));");
  const needle="db.prepare('UPDATE sales_keys SET key_hash=?,key_hint=?,auth_version=auth_version+1 WHERE id=?').bind(digest(cleanCode(code)),`••••-${code.slice(-4)}`,id),";
  s=replace(s,needle,needle+"\n      vaultStatement(db,id,encrypted),adminEventStatement(db,'admin','rotate_code',id),");
  // Keep paid generation paths, including the 3.12 planner, intact.
  const point="  const action=body.action";if(!s.includes(point))throw new Error('Paid-action anchor missing');
  s=replace(s,'    dispatched=true;', '    await checkKeyExpiry(db,key.id);\n    dispatched=true;');
  s=replace(s,"  const presets={praise:", "  if(action==='marketing'&&!(await readWorkbench(db)).posterEnabled)throw fail('营销拼图功能已被管理员暂停',403);\n  const presets={praise:");
  return s;
 },
 'cloud-functions/api/public-cats.js':s=>{
  s="import {readWorkbench} from '../_lib/workbench-control.js';\n"+s;
  return replace(s,'{ success: true, data: cats, updatedAt }','{ success: true, data: cats, updatedAt, settings:await readWorkbench(env.SALES_DB) }');
 },
 'cloud-functions/_lib/feishu.js':s=>{
  s=replace(s,"let catalogCache = { key: '', value: null, until: 0, pending: null };", "let catalogCache = { key: '', value: null, until: 0, pending: null };\nlet adminCatalogCache={key:'',value:null,until:0,pending:null,revision:0};");
  s=replace(s,"export async function getAdminCats(envInput) {\n  const env = config(envInput);\n  return (await loadRecords(env)).map(adminCat).filter(cat => cat.recordId && cat.id);\n}", "export async function getAdminCats(envInput,{fresh=false}={}) {\n  const env=config(envInput),key=JSON.stringify([env.FEISHU_APP_ID,env.FEISHU_APP_SECRET,env.FEISHU_APP_TOKEN,env.FEISHU_TABLE_ID]);if(adminCatalogCache.key!==key)adminCatalogCache={key,value:null,until:0,pending:null,revision:0};\n  const current=adminCatalogCache;if(!fresh&&current.value&&current.until>Date.now())return current.value;if(current.pending)return current.pending;const revision=current.revision;const job=loadRecords(env).then(rows=>{const data=rows.map(adminCat).filter(cat=>cat.recordId&&cat.id);if(adminCatalogCache===current&&current.revision===revision){current.value=data;current.until=Date.now()+15000;}return data;}).finally(()=>{if(current.pending===job)current.pending=null;});current.pending=job;return job;\n}");
  const old="  return adminCat(data.record ?? { record_id: recordId, fields: { ...fields, '猫咪ID': input?.id || '' } });";
  const patch="  const changed=Object.fromEntries([...mappings.map(([k])=>k),'age','price','costPrice'].filter(k=>Object.hasOwn(input||{},k)).map(k=>[k,input[k]]));\n  const cacheKey=JSON.stringify([env.FEISHU_APP_ID,env.FEISHU_APP_SECRET,env.FEISHU_APP_TOKEN,env.FEISHU_TABLE_ID]);if(adminCatalogCache.key===cacheKey){adminCatalogCache.revision++;adminCatalogCache.pending=null;if(adminCatalogCache.value){adminCatalogCache.value=adminCatalogCache.value.map(row=>row.recordId===recordId?{...row,...changed}:row);adminCatalogCache.until=Date.now()+15000;}}\n"+old;
  return replace(s,old,patch);
 },
 'cloud-functions/api/admin/cats.js':s=>replace(s,'getAdminCats(env)',"getAdminCats(env,{fresh:new URL(request.url).searchParams.get('refresh')==='1'})"),
 'src/workspace/catalog.jsx':s=>replace(s,"const savedAt=Date.now();setCats(body.data);", "if(body.settings)window.dispatchEvent(new CustomEvent('workbench-settings',{detail:body.settings}));\n        const savedAt=Date.now();setCats(body.data);"),
 'src/SalesWorkspace.jsx':s=>{
  s="import {WorkbenchConfigProvider,useWorkbenchConfig,WorkbenchNotice} from './workspace/WorkbenchConfig.jsx';\n"+s;
  s=replace(s,'function Workspace(){','function Workspace(){\n  const {config:workbenchConfig,ready:configReady}=useWorkbenchConfig();');
  s=replace(s,'  const hidePrices=customerDisplay.enabled;',"  const configDefaults=useRef(false);useEffect(()=>{if(configReady&&!configDefaults.current){configDefaults.current=true;try{if(!localStorage.getItem('sales-customer-display')&&!localStorage.getItem('sales-hide-prices'))setCustomerDisplay(old=>({...old,markup:workbenchConfig.defaultMarkup}));}catch{}}},[configReady]);\n  const hidePrices=customerDisplay.enabled;",{optional:true});
  // 3.12 adds other refs on the same line; the stable prefix is preserved.
  if(!s.includes('const configDefaults='))s=replace(s,'  const hidePrices=customerDisplay.enabled,',"  const configDefaults=useRef(false);useEffect(()=>{if(configReady&&!configDefaults.current){configDefaults.current=true;try{if(!localStorage.getItem('sales-customer-display')&&!localStorage.getItem('sales-hide-prices'))setCustomerDisplay(old=>({...old,markup:workbenchConfig.defaultMarkup}));}catch{}}},[configReady]);\n  const hidePrices=customerDisplay.enabled,");
  s=replace(s,"  function openMarketing(template='price',ids){", "  function openMarketing(template='price',ids){\n    if(!workbenchConfig.posterEnabled){setNotice('营销拼图功能已被管理员暂停');return;}");
  s=replace(s,':pickMarketingCats(cats);',':pickMarketingCats(cats).slice(0,workbenchConfig.defaultPosterCount);');
  s=replace(s,'<b>猫咪合作平台</b><small>合作销售工作台</small>','<b>{workbenchConfig.brandName}</b><small>{workbenchConfig.brandSubtitle}</small>');
  s=replace(s,'<footer className="workspace-footer">','<WorkbenchNotice/><footer className="workspace-footer">');
  s=replace(s,"<button onClick={()=>openMarketing('price',compare)}>","<button data-workbench-tool=\"poster\" onClick={()=>openMarketing('price',compare)}>",{optional:true});
  s=replace(s,'return <SalesSessionProvider><FollowupProvider>','return <WorkbenchConfigProvider><SalesSessionProvider><FollowupProvider>');
  s=replace(s,'</FollowupProvider></SalesSessionProvider>;', '</FollowupProvider></SalesSessionProvider></WorkbenchConfigProvider>;');
  if(s.includes('async function executeAgent(plan,current){'))s=replace(s,'async function executeAgent(plan,current){',"async function executeAgent(plan,current){\n    const switches={poster:'posterEnabled',downloads:'downloadsEnabled',single_poster:'singlePosterEnabled',calculator:'calculatorEnabled'};if(switches[plan.tool]&&!workbenchConfig[switches[plan.tool]])return {text:'这项功能已被管理员暂停。'};");
  if(s.includes('async function executeAgent(plan,current){')){s=replace(s,"platform:'xhs',height:1080,mirrorEnabled:true","platform:'xhs',height:workbenchConfig.defaultPosterHeight,mirrorEnabled:true",{optional:true,all:true});s=replace(s,'ids.length||9','ids.length||workbenchConfig.defaultPosterCount',{optional:true,all:true});}
  return s;
 },
 'src/components/SalesAI.jsx':s=>{
  s="import {useWorkbenchConfig} from '../workspace/WorkbenchConfig.jsx';\n"+s;
  s=s.replace(/(export default function SalesAI\([^\n]+\)\{\n)/,'$1 const {config:workbenchConfig}=useWorkbenchConfig();\n');
  if(!s.includes('config:workbenchConfig'))throw new Error('SalesAI signature changed');
  s=replace(s,'<h2>把客户需求变成 <span>销冠方案 <Sparkles','<h2>{workbenchConfig.heroTitle} <span>{workbenchConfig.heroHighlight} <Sparkles');
  const pattern=/(<textarea id="sales-ai-prompt"[\s\S]*?placeholder=)"[^"]*"/;if(!pattern.test(s))throw new Error('Composer placeholder changed');s=s.replace(pattern,'$1{workbenchConfig.aiPlaceholder}');return s;
 },
 'src/workspace/MarketingStudio.jsx':s=>{
  s="import {useWorkbenchConfig} from './WorkbenchConfig.jsx';\n"+s;
  s=s.replace(/(export default function MarketingStudio\([^\n]+\)\{\n)/,'$1 const {config:workbenchConfig}=useWorkbenchConfig();\n');
  s=replace(s,'useState(1080)','useState(workbenchConfig.defaultPosterHeight)',{optional:true});
  s=replace(s,'useState(initialSettings.height||1080)','useState(initialSettings.height||workbenchConfig.defaultPosterHeight)',{optional:true});
  s=replace(s,'  if(!valid){setRenderState',"  if(!workbenchConfig.posterEnabled){setRenderState('error');setRenderError('营销拼图已被管理员暂停');return()=>abort.abort();}\n  if(!valid){setRenderState");
  s=replace(s,'[fingerprint,renderRetry,valid]','[fingerprint,renderRetry,valid,workbenchConfig.posterEnabled]');return s;
 },
 'src/workspace/CatTools.jsx':s=>{
  s="import {useWorkbenchConfig} from './WorkbenchConfig.jsx';\n"+s;
  s=s.replace(/(export default function CatTools\([^\n]+\)\{\n)/,'$1 const {config:workbenchConfig}=useWorkbenchConfig();\n');
  s=replace(s,"onClick={()=>setTool('download')}","disabled={!workbenchConfig.downloadsEnabled} onClick={()=>setTool('download')}");
  s=replace(s,'disabled={!cat.image} onClick', 'disabled={!cat.image||!workbenchConfig.singlePosterEnabled} onClick');
  s=replace(s,"onClick={()=>setTool('freight')}","disabled={!workbenchConfig.calculatorEnabled} onClick={()=>setTool('freight')}");
  for(const [field,tool,text] of [['downloadsEnabled','download','⬇️ 下载原视频与高清图'],['calculatorEnabled','freight','🚚 运费与收款速算器']]){const button=`<button disabled={!workbenchConfig.${field}} onClick={()=>setTool('${tool}')}>${text}</button>`;s=replace(s,button,`{workbenchConfig.${field}&&${button}}`);}
  const posterButton=`<button disabled={!cat.image||!workbenchConfig.singlePosterEnabled} onClick={()=>setTool('poster')}>🖼️ 生成单猫详情海报（零售价）</button>`;s=replace(s,posterButton,`{workbenchConfig.singlePosterEnabled&&${posterButton}}`);
  s=replace(s,"{tool==='download'&&", "{tool==='download'&&workbenchConfig.downloadsEnabled&&");
  s=replace(s,"{tool==='poster'&&", "{tool==='poster'&&workbenchConfig.singlePosterEnabled&&");
  s=replace(s,"{tool==='freight'&&!customerView&&", "{tool==='freight'&&!customerView&&workbenchConfig.calculatorEnabled&&");return s;
 },
 'src/workspace/SalesSession.jsx':s=>{
  s="import {useWorkbenchConfig} from './WorkbenchConfig.jsx';\n"+s;
  s=replace(s,'export function SalesSessionProvider({children}){','export function SalesSessionProvider({children}){\n const {config:workbenchConfig}=useWorkbenchConfig();');
  s=replace(s,'每个账号最多绑定两个浏览器。','每个账号最多绑定{workbenchConfig.maxDevices}个浏览器。');return s;
 },
 'test/sales-components.test.jsx':s=>s+"\nimport './admin-controls.components.jsx';\n"
};
exports.transform=(path,text)=>{if(text.includes('// ADMIN_CONTROL_PATCH_V1'))return text;const fn=transforms[path];if(!fn)throw new Error('Unknown patch path: '+path);return '// ADMIN_CONTROL_PATCH_V1\n'+fn(text);};
exports.paths=Object.keys(transforms);
