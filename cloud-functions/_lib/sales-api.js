import {inventoryResult,inventoryQuery} from './sales-engine.js';
// ADMIN_CONTROL_PATCH_V1
import {readWorkbench,ensureControlTables,decorateKeys,encryptSalesCode,vaultStatement,adminEventStatement,checkKeyExpiry} from './workbench-control.js';
import {handleWorkbenchAdmin} from './workbench-admin.js';
import {runCatOnly} from './cat-only-agent.js';
import {readTask,listTasks,cancelTask} from './sales-agent-autopilot.js';
import { json, requireAdmin } from './admin-auth.js';
import { getCatalog } from './feishu.js';
import { diagnoseSalesInventory } from './sales-inventory-diagnostics.js';
import { accountView, activate, auditLocal, cleanCode, cookie, database, digest, fail, finish, housekeeping, newKey,
  nowSeconds, preflight, rateLimit, reserve, resolveSession, salesDay, openGuest, isGuest, guestIpGuard, GUEST_HINT } from './sales-store.js';
import { generateReply, selectCandidates, validatePrompt, normalizePrompt, marketingOptions } from './sales-engine.js';
import { answerHandbook, isHandbookQuestion } from './sales-handbook.js';
import {planningInput,generateAgentPlan} from './sales-agent.js';
import {generateMarketingLabPlan} from './marketing-lab.js';

const isWrite = request => !['GET','HEAD'].includes(request.method);
function originCheck(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw fail('请求来源无效',403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw fail('请使用 JSON 请求',415);
}
async function bodyJson(request, limit=8192) {
  if (Number(request.headers.get('content-length'))>limit) throw fail('请求内容过长',413);
  const reader=request.body?.getReader();
  if (!reader) throw fail('请求内容无效');
  let size=0;const chunks=[];
  while(true) {
    const {value,done}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>limit){await reader.cancel();throw fail('请求内容过长',413);}
    chunks.push(value);
  }
  const bytes=new Uint8Array(size);let pos=0;
  for(const chunk of chunks){bytes.set(chunk,pos);pos+=chunk.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('请求格式错误');}
  if (!body||Array.isArray(body)||typeof body!=='object') throw fail('请求格式错误');
  return body;
}
function limitValue(value) {
  const limit=Number(value);
  if(!Number.isInteger(limit)||limit<1||limit>1000)throw fail('每日限额须为1至1000的整数');
  return limit;
}
const methodCheck=(request,methods)=>{if(!methods.includes(request.method))throw fail('请求方法不支持',405,{allow:methods.join(', ')});};
async function userIpLimit(db,request,activation=false) {
  // Cloudflare entry point overwrites forwarded IP headers from platform data.
  const ip=digest(request.headers.get('cf-connecting-ip')||request.headers.get('x-real-ip')||'unknown').slice(0,32);
  await rateLimit(db,`${activation?'activation':'sales-api'}:${ip}`,activation?8:60,activation?900:60);
  if(activation)await rateLimit(db,'activation-global',500,900);
}
async function userSession(db, request, body, taskAction=false) {
  const user=await resolveSession(db,request,body?.device_id);
  if (isWrite(request))await rateLimit(db,taskAction?`agent-task:${user.id}`:`account:${user.id}`,taskAction?45:10,60);
  return user;
}
async function ask(db,env,request,body) {
  const key=await userSession(db,request,body);
  if(!['match','script'].includes(body.mode))throw fail('请选择秒配猫或写话术');
  if(isGuest(key)&&!(body.mode==='match'&&body.action==='cat_only'))throw fail('免费体验仅开放智能找猫功能',403);
  if(body.hide_prices!=null&&typeof body.hide_prices!=='boolean')throw fail('截图模式参数无效');
  if(body.action==='catalog_match'){const query=validatePrompt(inventoryQuery(body.prompt));const catalog=await getCatalog(env);const data=inventoryResult(catalog.cats,query);await auditLocal(db,key,'match',query,'inventory',data.reply_text);return json({success:true,data,user:accountView(key),catalog_updated_at:catalog.updatedAt});}
  if(body.action==='cat_only'){
    // Guest cannot request or receive wholesale price/markup even by forging JSON.
    const safe=isGuest(key)?{...body,hide_prices:true,cat_context:{...body.cat_context,markup:0}}:body;
    return json({success:true,...await runCatOnly(db,env,request,safe,key,isGuest(key))});
  }
  if(body.action==='agent_run'||body.action==='agent_plan')throw fail('旧版跨工具规划 Agent 已冻结，请刷新网页使用智能找猫助手。',410);
  const action=body.action,planning=action==='agent_plan';
  const scripts=['praise','price','compare'],marketing=action==='marketing',structured=scripts.includes(action)||marketing;
  if(action!=null&&!structured&&!planning&&action!=='handbook')throw fail('操作类型无效');
  if(structured&&body.mode!=='script')throw fail('卡片话术操作类型无效');
  if(body.hide_prices!=null&&typeof body.hide_prices!=='boolean')throw fail('截图模式参数无效');
  if(action==='marketing'&&!(await readWorkbench(db)).posterEnabled)throw fail('营销拼图功能已被管理员暂停',403);
  const presets={praise:'请根据已录入资料，夸这只猫已知的骨相甜美与性格优势，生成微信推荐话术',price:'客户觉得这只猫价格偏高，请根据真实资料生成保价话术，不擅自降价',compare:'客户纠结这两只猫，请对比已知优缺点，生成自然的微信推荐话术',marketing:'请根据在售猫咪资料生成营销推荐文案'};
  let selectedIds=[];
  if(structured){
    if(!Array.isArray(body.cat_ids)||(marketing?body.cat_ids.length<2||body.cat_ids.length>9:body.cat_ids.length!==(action==='compare'?2:1))||body.cat_ids.some(id=>typeof id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(id)))throw fail('请在猫咪卡片中选择正确的完整编号');
    selectedIds=body.cat_ids.map(id=>id.toUpperCase());if(new Set(selectedIds).size!==selectedIds.length)throw fail('请选择不同的猫咪');
  }
  // Paid checks remain before any inventory/model call. Local handbook answers are free.
  const effectiveInput=typeof body.prompt==='string'?(planning?body.prompt:normalizePrompt(body.prompt)):body.prompt;
  const handbook=!planning&&(action==='handbook'||(!structured&&isHandbookQuestion(effectiveInput)));
  if(!handbook)await preflight(db,key.id);
  let prompt,agentContext;
  try {if(planning){const input=planningInput(effectiveInput,body.agent_context);prompt=input.prompt;agentContext=input.context;}else prompt=validatePrompt(structured?presets[action]:effectiveInput);}
  catch(error){
    await auditLocal(db,key,body.mode,String(body.prompt || '').slice(0,200),error.audit || 'blocked',error.message);
    throw error;
  }
  if(handbook){
    const data=answerHandbook(prompt)||{kind:'handbook',matched_ids:[],reply_text:'这里查询合作与售后规则。选猫请回到在售猫源库输入客户需求。',sources:[],used_ai:false};
    await auditLocal(db,key,body.mode,prompt,'handbook',data.reply_text);
    return json({success:true,data,user:accountView(key)});
  }
  let catalog;try{catalog=await getCatalog(env);}catch{throw fail('库存暂时读取失败，本次未扣次数，请稍后重试',503);}
  let selected;
  if(planning){
    const stockIds=new Set(catalog.cats.map(cat=>String(cat.id).replace(/^#+/,'').trim().toUpperCase()));
    if(agentContext.cat_ids.some(id=>!stockIds.has(id)))throw fail('任务中的猫咪已不在当前在售库，请刷新或开始新任务',409);
    selected={cats:[]};
  }else if(marketing){
    const stock=new Map();
    for(const cat of catalog.cats){if(cat.status&&cat.status!=='在售')continue;const id=String(cat.id).replace(/^#+/,'').trim().toUpperCase();if(stock.has(id))throw fail('库存编号重复，请联系运营核对',503);stock.set(id,cat);}
    selected={cats:selectedIds.map(id=>stock.get(id)).filter(Boolean)};
  }else selected=selectCandidates(catalog.cats,structured?selectedIds.map(id=>'#'+id).join(' ')+(action==='compare'?' 对比':'' ):prompt,body.mode);
  if(marketing&&selected.cats.length!==selectedIds.length)throw fail('所选猫咪已不在售，请刷新猫源并重新选猫',409);
  const marketingConfig=marketing?marketingOptions(body,selected.cats):null;
  const audited=planning?`[agent_plan] ${prompt}`:marketing?`[marketing] ${selectedIds.join(', ')} ${JSON.stringify(marketingConfig)}`:structured?`[${action}] ${selectedIds.join(', ')} ${prompt}`:prompt;
  if(!planning&&!selected.cats.length){
    await auditLocal(db,key,body.mode,audited,'no_match',selected.message);
    return json({success:true,data:{matched_ids:[],reply_text:selected.message,used_ai:false},user:accountView(await preflight(db,key.id)),catalog_updated_at:catalog.updatedAt});
  }
  if(!env.DEEPSEEK_API_KEY)throw fail('AI 服务尚未配置，本次未扣次数',503);
  const reservation=await reserve(db,key,body.mode,audited);
  let dispatched=false;
  try {
    // Emergency stop / ban could be changed while inventory was loading.
    const stillAllowed=await db.prepare(`SELECT 1 FROM sales_keys k,ai_settings a WHERE k.id=? AND k.status=1
      AND k.auth_version=? AND a.id=1 AND a.enabled=1 AND EXISTS(SELECT 1 FROM sales_devices d WHERE d.key_id=k.id AND d.device_hash=?)`)
      .bind(key.id,key.auth_version,key.device_hash).first();
    if(!stillAllowed)throw fail('授权已变更或 AI 服务已暂停',403);
    await checkKeyExpiry(db,key.id);
    dispatched=true; // Never auto-retry a potentially billed upstream request.
    const output=planning?await generateAgentPlan(env,prompt,agentContext,new Set(catalog.cats.map(cat=>String(cat.id).replace(/^#+/,'').trim().toUpperCase()))):await generateReply(env,selected.cats,prompt,body.mode,{marketing:marketingConfig,hidePrices:body.hide_prices===true,expectedCount:action==='compare'?2:undefined});
    await finish(db,reservation,output);
    const current=await resolveSession(db,request,body.device_id);
    return json({success:true,data:planning?{kind:'agent_plan',plan:output.plan,used_ai:true}:{matched_ids:output.matched_ids,reply_text:output.reply_text,used_ai:true},user:accountView(current),catalog_updated_at:catalog.updatedAt});
  } catch(error) {
    // finish is idempotent for reservations, including a successful call whose
    // session was revoked before the result was delivered.
    const refund=!dispatched||Boolean(planning&&error.reason_code)||error.refund_user_quota===true;
    await finish(db,reservation,{status:dispatched?'upstream_error':'cancelled',reply_text:dispatched?`模型任务规划失败（${error.reason_code||'UNKNOWN'}）`:'请求在调用模型前取消'}, {refund});
    const current=await db.prepare('SELECT * FROM sales_keys WHERE id=?').bind(key.id).first();
    throw fail(dispatched?`未取得可执行的 AI 任务计划（${error.reason_code||'SERVICE_ERROR'}）。${refund?'本次未扣销售配额。':'本次已计入1次。'}`:error.message,error.status||502,{user:current?accountView(current):undefined});
  }
}

async function marketingLab(db,env,request,body){
  if(request.method==='GET')return json({success:true,data:{ready:Boolean(env.DEEPSEEK_API_KEY),enabled:Boolean((await readWorkbench(db,{fresh:true})).marketingLabEnabled)}});
  if(request.method!=='POST')throw fail('请求方法不支持',405,{allow:'GET, POST'});
  if(!body.device_id)throw fail('设备标识不能为空');
  // The feature gate is checked on every call, not from the 10-second config cache.
  // An admin switching it off must stop new billable requests on the server.
  const config=await readWorkbench(db,{fresh:true});
  if(!config.marketingLabEnabled)throw fail('AI营销出图实验室已被管理员关闭',403);
  const key=await userSession(db,request,body);
  const prompt=String(body.prompt||'').trim();
  if(prompt.length<2||prompt.length>1200)throw fail('请输入2到1200字的出图要求',400);
  const template=typeof body.template==='string'?body.template.trim():'xhs_cover';
  if(!['xhs_cover','grid_4','cat_profile','douyin_cover'].includes(template))throw fail('模板类型无效',400);
  if(!Array.isArray(body.cat_ids)||body.cat_ids.length<1||body.cat_ids.length>4||body.cat_ids.some(v=>typeof v!=='string'||v.length>42))throw fail('请选择1到4只带照片的在售猫咪',400);
  const normalized=body.cat_ids.map(id=>String(id).replace(/^#+/,'').trim().toUpperCase());
  if(new Set(normalized).size!==normalized.length)throw fail('不能重复选择同一只猫咪',400);
  if(!env.DEEPSEEK_API_KEY)throw fail('AI 服务尚未配置，本次未扣次数',503);
  await preflight(db,key.id);
  const catalog=await getCatalog(env);
  const pool=new Map();
  for(const cat of catalog.cats){
    if(cat.status&&cat.status!=='在售')continue;
    const id=String(cat.id).replace(/^#+/,'').trim().toUpperCase();
    if(cat.image&&!pool.has(id))pool.set(id,cat);
  }
  const cats=normalized.map(id=>pool.get(id)).filter(Boolean);
  if(cats.length!==normalized.length)throw fail('所选猫咪已变化，或有猫咪缺少照片，请刷新后重试',409);
  // Reuse the same per-account and global D1 quota as the existing cat finder.
  if(isGuest(key))await guestIpGuard(db,request);
  const reservation=await reserve(db,key,'script',`[marketing_lab] ${template} ${prompt.slice(0,500)}`);
  try{
    const result=await generateMarketingLabPlan(env,{prompt,template,photoCount:cats.length});
    await finish(db,reservation,{status:'success',reply_text:'营销排版方案已生成',matched_ids:normalized});
    return json({success:true,data:{...result,cats:cats.map(cat=>({id:cat.id,breed:cat.breed,color:cat.color,gender:cat.gender,age:cat.age,image:cat.image,images:Array.isArray(cat.images)?cat.images:[cat.image].filter(Boolean)}))},user:accountView(await resolveSession(db,request,body.device_id))});
  }catch(error){
    await finish(db,reservation,{status:'upstream_error',reply_text:'营销排版生成失败'});
    throw error;
  }
}

async function admin(db,env,request,path,body) {
  if(!requireAdmin(request,env))throw fail('请先登录管理员账号',401);
  const now=nowSeconds(),day=salesDay(now);
  if(path==='/api/sales-admin/inventory-diagnostics'){
    methodCheck(request,['POST']);
    // Admin session is verified in handleSales before loading D1 or stock.
    const taskId=body.task_id;
    if(taskId!==undefined&&(typeof taskId!=='string'||!/^[0-9a-f-]{36}$/i.test(taskId)))throw fail('云端任务编号无效',400);
    let saved=null;
    if(taskId){
      const row=await db.prepare('SELECT state_json FROM sales_agent_tasks WHERE id=?').bind(taskId).first();
      if(!row)throw fail('未找到云端任务',404);
      try{saved=JSON.parse(row.state_json);}catch{throw fail('云端任务内容损坏',409);}
    }
    const goal=saved?(saved.edit?(saved.context?.need||saved.goal):saved.goal):body.goal;
    const markup=taskId?Number(saved.context?.params?.markup??0):Number(body.markup??0);
    if(typeof goal!=='string'||goal.trim().length<2||goal.length>1200)throw fail('请填写2至1200字的销售需求',400);
    if(!Number.isFinite(markup)||markup<0||markup>100000)throw fail('加价参数无效',400);
    if(body.ids!==undefined&&(!Array.isArray(body.ids)||body.ids.length>12||body.ids.some(x=>typeof x!=='string'||x.length>42)))throw fail('指定猫咪编号无效',400);
    if(body.refresh!==undefined&&typeof body.refresh!=='boolean')throw fail('刷新参数无效',400);
    let catalog;try{catalog=await getCatalog(env,{fresh:body.refresh===true});}catch{throw fail('在售猫源读取失败，请确认飞书连接',503);}
    let report;
    try{report=diagnoseSalesInventory(catalog.cats,goal,{markup,ids:body.ids||[],savedDemand:saved?.demand||null,requireImage:true});}
    catch(error){throw fail(error.message||'需求参数无法诊断',400);}
    return json({success:true,data:{...report,taskId:taskId||null,catalogUpdatedAt:catalog.updatedAt}});
  }
  if(path==='/api/sales-admin/control')return handleWorkbenchAdmin(db,env,request,path,body);
  if(path==='/api/sales-admin/settings') {
    methodCheck(request,['GET','PATCH']);
    if(request.method==='PATCH'){
      if(typeof body.enabled!=='boolean'||!Number.isInteger(body.daily_limit)||body.daily_limit<1||body.daily_limit>100000)throw fail('请填写有效的全站每日限额');
      await db.prepare('UPDATE ai_settings SET enabled=?,daily_limit=? WHERE id=1').bind(Number(body.enabled),body.daily_limit).run();
    }
    const row=await db.prepare('SELECT * FROM ai_settings WHERE id=1').first();
    const usage=await db.prepare('SELECT used FROM ai_daily_usage WHERE call_date=?').bind(day).first();
    return json({success:true,data:{enabled:Boolean(row.enabled),daily_limit:row.daily_limit,used_today:usage?.used||0,date:day}});
  }
  if(path==='/api/sales-admin/keys') {
    methodCheck(request,['GET','POST']);
    if(request.method==='POST'){
      const name=typeof body.sales_name==='string'?body.sales_name.trim():'';
      if(!name||name.length>60)throw fail('销售姓名或备注须为1至60字');
      return json({success:true,data:await newKey(db,name,limitValue(body.daily_limit??(await readWorkbench(db)).defaultDailyLimit),env)},201);
    }
    const rows=await db.prepare(`SELECT k.id,k.sales_name,k.key_hint,k.status,k.daily_limit,
      CASE WHEN k.last_call_date=? THEN k.used_today ELSE 0 END AS used_today,
      (SELECT COUNT(*) FROM sales_devices d WHERE d.key_id=k.id) AS device_count
      FROM sales_keys k WHERE k.key_hint<>? ORDER BY k.id DESC LIMIT 1000`).bind(day,GUEST_HINT).all();
    return json({success:true,data:await decorateKeys(db,rows.results)});
  }
  const match=path.match(/^\/api\/sales-admin\/keys\/(\d+)(\/logs|\/reveal)?$/);
  if(!match)throw fail('接口不存在',404);
  const id=Number(match[1]);
  const key=await db.prepare('SELECT * FROM sales_keys WHERE id=?').bind(id).first();
  if(!key)throw fail('销售账号不存在',404);
  if(match[2]==='/reveal')return handleWorkbenchAdmin(db,env,request,path,body,key);
  if(match[2]) {
    methodCheck(request,['GET']);
    const rows=await db.prepare(`SELECT id,mode,user_input,ai_output,status,charged,matched_ids,created_at,input_tokens,output_tokens
      FROM ai_call_logs WHERE key_id=? ORDER BY id DESC LIMIT 20`).bind(id).all();
    return json({success:true,data:rows.results});
  }
  methodCheck(request,['PATCH']);
  if(['name','expiry','profile'].includes(body.action))return handleWorkbenchAdmin(db,env,request,path,body,key);
  if(body.action==='status') {
    if(![0,1].includes(body.status))throw fail('账号状态无效');
    await db.batch([
      db.prepare('UPDATE sales_keys SET status=?,auth_version=auth_version+1 WHERE id=?').bind(body.status,id),
      db.prepare('DELETE FROM sales_sessions WHERE key_id=?').bind(id),
    ]);
  } else if(body.action==='devices') {
    await db.batch([
      db.prepare('UPDATE sales_keys SET auth_version=auth_version+1 WHERE id=?').bind(id),
      db.prepare('DELETE FROM sales_sessions WHERE key_id=?').bind(id),
      db.prepare('DELETE FROM sales_devices WHERE key_id=?').bind(id),
    ]);
  } else if(body.action==='limit') {
    await db.prepare('UPDATE sales_keys SET daily_limit=? WHERE id=?').bind(limitValue(body.daily_limit),id).run();
  } else if(body.action==='rotate') {
    // Same account and quotas; revoke all old sessions and browser bindings.
    const code=crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase();
    await ensureControlTables(db);const encrypted=await encryptSalesCode(env,code.match(/.{4}/g).join('-'));
    await db.batch([
      db.prepare('UPDATE sales_keys SET key_hash=?,key_hint=?,auth_version=auth_version+1 WHERE id=?').bind(digest(cleanCode(code)),`••••-${code.slice(-4)}`,id),
      vaultStatement(db,id,encrypted),adminEventStatement(db,'admin','rotate_code',id),
      db.prepare('DELETE FROM sales_sessions WHERE key_id=?').bind(id),
      db.prepare('DELETE FROM sales_devices WHERE key_id=?').bind(id),
    ]);
    return json({success:true,data:{key_code:code.match(/.{4}/g).join('-')}});
  } else throw fail('操作无效');
  return json({success:true});
}
export async function handleSales({request,env}) {
  const path=new URL(request.url).pathname.replace(/\/$/,'');
  try {
    const adminPath=path.startsWith('/api/sales-admin/');
    // Authenticate administrators even if D1 is missing; never reveal settings.
    if(adminPath&&!requireAdmin(request,env))throw fail('请先登录管理员账号',401);
    if(isWrite(request))originCheck(request);
    const db=database(env);
    const body=isWrite(request)?await bodyJson(request,path==='/api/ai/ask'?32768:8192):{};
    if(adminPath)return await admin(db,env,request,path,body);
    await userIpLimit(db,request,path==='/api/ai/activate');
    if(path==='/api/ai/guest'){
      methodCheck(request,['POST']);
      const device=body.device_id;
      // Avoid creating a new guest if an authenticated session exists.
      try{const existing=await resolveSession(db,request,device);return json({success:true,user:accountView(existing)});}catch(e){if(e.status!==401)throw e;}
      const addr=request.headers.get('CF-Connecting-IP')||'unknown';
      await rateLimit(db,`guest-create:${digest(addr).slice(0,32)}`,15,3600);
      const session=await openGuest(db,device);
      return json({success:true,user:session.user},200,{'Set-Cookie':cookie(session.token)});
    }
    if(path==='/api/ai/activate'){
      methodCheck(request,['POST']);
      const result=await activate(db,body.key_code,body.device_id);
      return json({success:true,user:result.user},200,{'Set-Cookie':cookie(result.token)});
    }
    if(path==='/api/ai/session'){
      methodCheck(request,['GET']);
      return json({success:true,user:accountView(await userSession(db,request))});
    }
    if(path==='/api/ai/logout'){
      methodCheck(request,['POST']);
      const user=await userSession(db,request,body);
      await db.prepare('DELETE FROM sales_sessions WHERE key_id=? AND device_hash=?').bind(user.id,user.device_hash).run();
      return json({success:true},200,{'Set-Cookie':cookie('')});
    }
    if(path==='/api/ai/task'){
      methodCheck(request,['GET','POST']);
      if(request.method==='GET'){const key=await userSession(db,request);const query=new URL(request.url).searchParams;return json({success:true,data:query.get('list')==='1'?await listTasks(db,key):await readTask(db,key,query.get('task_id'))});}
      if(!body.device_id)throw fail('设备标识不能为空');
      const key=await userSession(db,request,body,body.action==='next');
      if(isGuest(key))throw fail('免费体验不支持旧版历史任务',403);
      if(body.action==='start'||body.action==='next')throw fail('旧版复杂任务 Agent 已冻结；历史任务保留但不再自动执行。',410);
      // Old task data may still be read or cancelled, but cannot resume.
      if(body.action==='cancel')return json({success:true,...await cancelTask(db,body,key)});
      throw fail('任务操作无效');
    }
    if(path==='/api/marketing-lab'){
      methodCheck(request,['GET','POST']);
      return await marketingLab(db,env,request,body);
    }
    if(path==='/api/ai/ask'){
      methodCheck(request,['POST']);
      if(!body.device_id)throw fail('设备标识不能为空');
      return await ask(db,env,request,body);
    }
    throw fail('接口不存在',404);
  } catch(error){
    if(!error.status)console.error('sales_service_failed'); // no secrets, prompts, or DB error details
    return json({success:false,message:error.status?error.message:'销售服务暂时不可用，请确认数据库迁移已完成',retry_after:error.retry_after,user:error.user},error.status||503,
      {...(error.retry_after?{'Retry-After':String(error.retry_after)}:{}),...(error.allow?{Allow:error.allow}:{})});
  }
}
