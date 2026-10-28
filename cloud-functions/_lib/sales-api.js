import { json, requireAdmin } from './admin-auth.js';
import { getCatalog } from './feishu.js';
import { accountView, activate, auditLocal, cleanCode, cookie, database, digest, fail, finish, housekeeping, newKey,
  nowSeconds, preflight, rateLimit, reserve, resolveSession, salesDay } from './sales-store.js';
import { generateReply, selectCandidates, validatePrompt } from './sales-engine.js';
import { answerHandbook, isHandbookQuestion } from './sales-handbook.js';

const isWrite = request => !['GET','HEAD'].includes(request.method);
function originCheck(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw fail('请求来源无效',403);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw fail('请使用 JSON 请求',415);
}
async function bodyJson(request) {
  if (Number(request.headers.get('content-length'))>4096) throw fail('请求内容过长',413);
  const reader=request.body?.getReader();
  if (!reader) throw fail('请求内容无效');
  let size=0;const chunks=[];
  while(true) {
    const {value,done}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>4096){await reader.cancel();throw fail('请求内容过长',413);}
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
async function userSession(db, request, body) {
  const user=await resolveSession(db,request,body?.device_id);
  if (isWrite(request))await rateLimit(db,`account:${user.id}`,10,60);
  return user;
}
async function ask(db,env,request,body) {
  const key=await userSession(db,request,body);
  if(!['match','script'].includes(body.mode))throw fail('请选择秒配猫或写话术');
  const action=body.action;
  const scripts=['praise','price','compare'],structured=scripts.includes(action);
  if(action!=null&&!structured&&action!=='handbook')throw fail('操作类型无效');
  if(structured&&body.mode!=='script')throw fail('卡片话术操作类型无效');
  if(body.hide_prices!=null&&typeof body.hide_prices!=='boolean')throw fail('截图模式参数无效');
  const presets={praise:'请根据已录入资料，夸这只猫已知的骨相甜美与性格优势，生成微信推荐话术',price:'客户觉得这只猫价格偏高，请根据真实资料生成保价话术，不擅自降价',compare:'客户纠结这两只猫，请对比已知优缺点，生成自然的微信推荐话术'};
  let selectedIds=[];
  if(structured){
    if(!Array.isArray(body.cat_ids)||body.cat_ids.length!==(action==='compare'?2:1)||body.cat_ids.some(id=>typeof id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(id)))throw fail('请在猫咪卡片中选择正确的完整编号');
    selectedIds=body.cat_ids.map(id=>id.toUpperCase());if(new Set(selectedIds).size!==selectedIds.length)throw fail('请选择两只不同的猫');
  }
  // Paid checks remain before any inventory/model call. Local handbook answers are free.
  const handbook=action==='handbook'||(!structured&&isHandbookQuestion(body.prompt));
  if(!handbook)await preflight(db,key.id);
  let prompt;
  try {prompt=validatePrompt(structured?presets[action]:body.prompt);}
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
  const selected=selectCandidates(catalog.cats,structured?selectedIds.map(id=>'#'+id).join(' ')+(action==='compare'?' 对比':'' ):prompt,body.mode);
  const audited=structured?`[${action}] ${selectedIds.join(', ')} ${prompt}`:prompt;
  if(!selected.cats.length){
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
    dispatched=true; // Never auto-retry a potentially billed upstream request.
    const output=await generateReply(env,selected.cats,prompt,body.mode,{hidePrices:body.hide_prices===true,expectedCount:action==='compare'?2:undefined});
    await finish(db,reservation,output);
    const current=await resolveSession(db,request,body.device_id);
    return json({success:true,data:{matched_ids:output.matched_ids,reply_text:output.reply_text,used_ai:true},user:accountView(current),catalog_updated_at:catalog.updatedAt});
  } catch(error) {
    // finish is idempotent for reservations, including a successful call whose
    // session was revoked before the result was delivered.
    await finish(db,reservation,{status:dispatched?'upstream_error':'cancelled',reply_text:dispatched?'模型请求未取得可用结果；可能已产生费用，已计入次数':'请求在调用模型前取消'}, {refund:!dispatched});
    const current=await db.prepare('SELECT * FROM sales_keys WHERE id=?').bind(key.id).first();
    throw fail(dispatched?'未取得可用 AI 结果。此次已请求模型，计入1次，请稍后再试':error.message,error.status||502,{user:current?accountView(current):undefined});
  }
}
async function admin(db,env,request,path,body) {
  if(!requireAdmin(request,env))throw fail('请先登录管理员账号',401);
  const now=nowSeconds(),day=salesDay(now);
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
      return json({success:true,data:await newKey(db,name,limitValue(body.daily_limit??20))},201);
    }
    await housekeeping(db);
    const rows=await db.prepare(`SELECT k.id,k.sales_name,k.key_hint,k.status,k.daily_limit,
      CASE WHEN k.last_call_date=? THEN k.used_today ELSE 0 END AS used_today,
      (SELECT COUNT(*) FROM sales_devices d WHERE d.key_id=k.id) AS device_count
      FROM sales_keys k ORDER BY k.id DESC LIMIT 1000`).bind(day).all();
    return json({success:true,data:rows.results});
  }
  const match=path.match(/^\/api\/sales-admin\/keys\/(\d+)(\/logs)?$/);
  if(!match)throw fail('接口不存在',404);
  const id=Number(match[1]);
  const key=await db.prepare('SELECT * FROM sales_keys WHERE id=?').bind(id).first();
  if(!key)throw fail('销售账号不存在',404);
  if(match[2]) {
    methodCheck(request,['GET']);
    const rows=await db.prepare(`SELECT id,mode,user_input,ai_output,status,charged,matched_ids,created_at,input_tokens,output_tokens
      FROM ai_call_logs WHERE key_id=? ORDER BY id DESC LIMIT 20`).bind(id).all();
    return json({success:true,data:rows.results});
  }
  methodCheck(request,['PATCH']);
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
    await db.batch([
      db.prepare('UPDATE sales_keys SET key_hash=?,key_hint=?,auth_version=auth_version+1 WHERE id=?').bind(digest(cleanCode(code)),`••••-${code.slice(-4)}`,id),
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
    const body=isWrite(request)?await bodyJson(request):{};
    if(adminPath)return await admin(db,env,request,path,body);
    await userIpLimit(db,request,path==='/api/ai/activate');
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
