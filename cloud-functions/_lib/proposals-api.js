import {randomBytes} from 'node:crypto';
import {database,resolveSession,isGuest,digest,fail,rateLimit,nowSeconds} from './sales-store.js';
import {checkKeyExpiry,readWorkbench} from './workbench-control.js';
import {getCatalog,getImage} from './feishu.js';

const TOKEN=/^[A-Za-z0-9_-]{24}$/;
const headers={'Cache-Control':'private, no-store','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const json=(value,status=200,extra={})=>Response.json(value,{status,headers:{...headers,...extra}});
const norm=value=>String(value??'').replace(/^#+/,'').trim().toUpperCase();
const snapshotImageToken=value=>/^\/api\/public-images\/([A-Za-z0-9_-]{1,200})$/.exec(String(value||''))?.[1]||null;
// A snapshot is allowed to reference only images attached to that exact cat.
const snapshotImages=cat=>[...new Set([cat.image,...(Array.isArray(cat.images)?cat.images:[])].filter(v=>snapshotImageToken(v)))].slice(0,6);
const savedImages=cat=>[...new Set([cat.image,...(Array.isArray(cat.images)?cat.images:[])].filter(v=>snapshotImageToken(v)))].slice(0,6);
const photoPath=(id,source)=>{const token=snapshotImageToken(source);return token?`/api/proposals/${id}/photo/${token}`:null;};
function text(value,max,label,required=false){if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail(`${label}格式无效`);const result=value.trim();if(required&&!result)throw fail(`请填写${label}`);return result;}
function money(value,label='售价'){if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1000000||Math.abs(value*100-Math.round(value*100))>1e-6)throw fail(`${label}须为0至1000000元，最多两位小数`);return Math.round(value*100)/100;}
function methods(request,allowed){if(!allowed.includes(request.method))throw fail('请求方法不支持',405,{allow:allowed.join(', ')});}
async function bodyJson(request,limit){
 if(request.headers.get('origin')!==new URL(request.url).origin)throw fail('请求来源无效',403);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw fail('请使用 JSON 请求',415);
 if(Number(request.headers.get('content-length'))>limit)throw fail('请求内容过长',413);
 const reader=request.body?.getReader();if(!reader)throw fail('请求内容无效');let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw fail('请求内容过长',413);}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}let body;
 try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw fail('请求格式错误');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw fail('请求格式错误');return body;
}
async function agent(db,request,body){const user=await resolveSession(db,request,body?.device_id);if(isGuest(user))throw fail('请先使用代理激活码登录，再创建专属转发页',403);return user;}
const profileView=row=>({name:row.name,brand:row.brand,wechat:row.wechat,default_markup:row.default_markup,qr_url:row.qr_id?`/api/agent/profile/qr?v=${row.qr_id}`:null,updated_at:row.updated_at});
async function readProfile(db,env,user){const row=await db.prepare('SELECT * FROM sales_agent_profiles WHERE owner_id=?').bind(user.id).first();if(row)return row;const config=await readWorkbench(db);return {owner_id:user.id,name:user.sales_name,brand:'',wechat:'',default_markup:config.defaultMarkup,qr_id:null,updated_at:0};}
function qrImage(data){
 if(typeof data!=='string'||data.length>420000)throw fail('二维码过大，请使用300KB以内图片',413);
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);if(!match||match[2].length%4)throw fail('请上传 PNG、JPEG 或 WebP 二维码');
 const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));if(bytes.length>300*1024||bytes.length<12)throw fail('二维码文件大小无效',413);
 const png=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b),jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255,webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP';
 if(!(match[1]==='png'&&png||match[1]==='jpeg'&&jpeg||match[1]==='webp'&&webp))throw fail('二维码文件格式与内容不一致');
 return {bytes,mime:'image/'+match[1],encoded:match[2]};
}
async function updateProfile(db,env,user,body){
 const current=await readProfile(db,env,user),name=text(body.name,30,'顾问称呼',true),brand=text(body.brand,40,'工作室名称',true),wechat=text(body.wechat??'',60,'微信号'),markup=money(body.default_markup??800,'默认加价');
 let qr=current.qr_id,upload=null;
 if(body.qr_data===null)qr=null;
 else if(body.qr_data!==undefined){upload=qrImage(body.qr_data);qr=digest(`${user.id}:${upload.encoded}`).slice(0,40);await rateLimit(db,`proposal-qr:${user.id}`,15,86400);}
 if(!wechat&&!qr)throw fail('请至少填写微信号或上传二维码');
 const statements=[];if(upload)statements.push(db.prepare('INSERT OR IGNORE INTO sales_proposal_qr(id,owner_id,mime,data,created_at) VALUES(?,?,?,?,?)').bind(qr,user.id,upload.mime,upload.bytes,nowSeconds()));
 statements.push(db.prepare(`INSERT INTO sales_agent_profiles(owner_id,name,brand,wechat,default_markup,qr_id,updated_at) SELECT id,?,?,?,?,?,? FROM sales_keys WHERE id=? AND status=1 AND auth_version=?
 ON CONFLICT(owner_id) DO UPDATE SET name=excluded.name,brand=excluded.brand,wechat=excluded.wechat,default_markup=excluded.default_markup,qr_id=excluded.qr_id,updated_at=excluded.updated_at`).bind(name,brand,wechat,markup,qr,nowSeconds(),user.id,user.auth_version));
 await db.batch(statements);await agent(db,body._request,body);
 return readProfile(db,env,user);
}
function expiry(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw fail('请设置报价有效期');
 const at=Date.parse(value+'T23:59:59+08:00')/1000,now=nowSeconds(),max=new Date((now+8*3600+30*86400)*1000).toISOString().slice(0,10);
 if(!Number.isFinite(at)||new Date((at+8*3600)*1000).toISOString().slice(0,10)!==value||at<=now||value>max)throw fail('报价有效期须在今天至30天内');return at;
}
async function freshCatalog(env){let timer;try{return await Promise.race([getCatalog(env,{fresh:true}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('stock timeout')),20000);})]);}catch{throw fail('暂时无法核验最新猫源，请稍后重试',503);}finally{clearTimeout(timer);}}
function catalogMap(cats){const map=new Map();for(const c of cats){const id=norm(c.id);if(!id)continue;map.set(id,map.has(id)?null:c);}return map;}
function snapshot(cat,price){
 const images=snapshotImages(cat),image=images[0]||null;
 const videos=(cat.videos||[]).filter(v=>/^\/api\/public-videos\/[A-Za-z0-9_-]{1,200}$/.test(v.url||'')).slice(0,3).map(v=>({url:v.url}));
 // Free-form descriptions and attachment names may contain internal costs. Never copy them.
 return {id:String(cat.id),breed:String(cat.breed||'').slice(0,80),color:String(cat.color||'').slice(0,80),gender:String(cat.gender||'').slice(0,20),age:String(cat.age||'').slice(0,40),vaccine:String(cat.vaccine||'').slice(0,200),image,images,videos,price};
}

// Check the actual first usable photo while the seller creates the share,
// instead of leaving the customer to discover a missing/broken attachment.
// At most two attempts per cat; this runs only on creation, never on page views.
async function verifySharePhoto(env,cat){
 const candidates=snapshotImages(cat);
 if(!candidates.length)throw fail(`猫咪 #${cat.id} 没有照片，请先在飞书补充图片再分享`,409);
 for(const source of candidates.slice(0,2)){
  try{
   const photo=await getImage(env,snapshotImageToken(source),{timeoutMs:8000});
   return {cat:{...cat,image:source,images:[source,...candidates.filter(x=>x!==source)]},photo};
  }catch{}
 }
 throw fail(`猫咪 #${cat.id} 的照片当前无法读取，请在飞书重新上传有效照片或换一只猫`,409);
}
// Share-specific edge cache may be prewarmed by the validated photo above.
// It is never publicly readable without the proposal's active authorization.
async function sharePhotoCacheKey(env,request,token){
 const scope=JSON.stringify([env.FEISHU_APP_ID,env.FEISHU_APP_SECRET,env.FEISHU_APP_TOKEN]);
 const hashed=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(scope));
 const keyHash=Array.from(new Uint8Array(hashed),b=>b.toString(16).padStart(2,'0')).join('');
 const url=new URL(request.url);url.pathname=`/.internal-cache/share-photo/v1/${keyHash}/${token}`;url.search='';
 return new Request(url);
}
async function warmSharePhotos(env,request,verified){
 const cache=globalThis.caches?.default;if(!cache)return;
 await Promise.all(verified.map(async ({cat,photo})=>{
  try{const key=await sharePhotoCacheKey(env,request,snapshotImageToken(cat.image));
   await cache.put(key,new Response(photo.bytes,{headers:{'Content-Type':photo.type,'Cache-Control':'public, max-age=21600'}}));
  }catch{}
 }));
}

async function existingRequest(db,user,key,hash){const row=await db.prepare('SELECT * FROM sales_proposals WHERE owner_id=? AND request_key=?').bind(user.id,key).first();if(!row)return null;if(row.request_hash!==hash)throw fail('本次提交内容已变化，请重新生成',409);if(row.revoked_at||row.expires_at<=nowSeconds())throw fail('本次提案已失效，请重新生成',409);return row;}
async function createProposal(db,env,user,body,request){
 const name=text(body.customer_name,30,'客户可见称呼',true),note=text(body.note??'',500,'给客户的话'),until=expiry(body.expires);
 if(!Array.isArray(body.items)||body.items.length<1||body.items.length>3)throw fail('请选择1至3只猫咪');
 const items=body.items.map(item=>({id:norm(text(item?.id,80,'猫咪编号',true)),price:money(item?.price),expected_base:item?.expected_base==null?null:money(item.expected_base,'已核对供货价')}));if(new Set(items.map(x=>x.id)).size!==items.length)throw fail('不能重复选择同一只猫咪');
 const key=text(body.request_key,80,'提交标识',true);if(!/^[A-Za-z0-9_-]{16,80}$/.test(key))throw fail('提交标识无效');
 const hash=digest(JSON.stringify({name,note,until,items})),prior=await existingRequest(db,user,key,hash);if(prior)return prior;
 const profile=await readProfile(db,env,user);if(!profile.name||!profile.brand||!profile.wechat&&!profile.qr_id)throw fail('请先保存顾问称呼、工作室名称和联系方式');
 await rateLimit(db,`proposal-create:${user.id}`,20,60);await rateLimit(db,`proposal-day:${user.id}`,300,86400);
 const catalog=await freshCatalog(env),stock=catalogMap(catalog.cats),rawCats=items.map(item=>{const cat=stock.get(item.id);if(!cat)throw fail('所选猫咪已不在售或编号重复，请刷新重新选择',409);if(cat.price==null||!Number.isFinite(Number(cat.price)))throw fail('所选猫咪供货价待核实，请联系运营确认',409);if(item.expected_base!==null&&Number(cat.price)!==item.expected_base)throw fail('供货价格已变化，请返回刷新猫源并重新确认售价',409);return snapshot(cat,item.price);});
 // Validate photos before publishing. Fail closed instead of sending blank cat cards.
 const verified=await Promise.all(rawCats.map(cat=>verifySharePhoto(env,cat)));
 const cats=verified.map(x=>x.cat);
 await agent(db,request,body);
 const id=randomBytes(18).toString('base64url'),publicProfile={name:profile.name,brand:profile.brand,wechat:profile.wechat,qr_id:profile.qr_id};
 await db.prepare(`INSERT INTO sales_proposals(id,owner_id,customer_name,note,profile_json,cats_json,created_at,expires_at,request_key,request_hash)
 SELECT ?,id,?,?,?,?,?,?,?,? FROM sales_keys WHERE id=? AND status=1 AND auth_version=? ON CONFLICT(owner_id,request_key) DO NOTHING`).bind(id,name,note,JSON.stringify(publicProfile),JSON.stringify(cats),nowSeconds(),until,key,hash,user.id,user.auth_version).run();
 const row=await existingRequest(db,user,key,hash);if(!row)throw fail('代理身份已变化，请重新登录',401);await warmSharePhotos(env,request,verified);return row;
}
function ownerSummary(row){return {id:row.id,customer_name:row.customer_name,created_at:row.created_at,expires_at:row.expires_at,revoked_at:row.revoked_at,url:`/p/${row.id}`,cats:JSON.parse(row.cats_json).map(c=>({id:c.id,breed:c.breed,price:c.price,image:c.image}))};}
async function activeProposal(db,id){
 if(!TOKEN.test(id))throw fail('方案不存在或已失效',404);
 const row=await db.prepare('SELECT p.* FROM sales_proposals p JOIN sales_keys k ON k.id=p.owner_id WHERE p.id=? AND k.status=1').bind(id).first();
 if(!row)throw fail('方案不存在或已失效',404);if(row.revoked_at||row.expires_at<=nowSeconds())throw fail('这份方案已撤回或到期，请联系顾问',410);
 try{await checkKeyExpiry(db,row.owner_id);}catch{throw fail('这份方案暂不可用，请联系顾问',410);}return row;
}
// Client-facing content is a D1 snapshot. Do not block the first paint on Feishu.
// Availability is always explicitly unknown until /stock verifies it.
async function publicRead(db,id){
 const row=await activeProposal(db,id),saved=JSON.parse(row.cats_json),profile=JSON.parse(row.profile_json);
 return {id:row.id,customer_name:row.customer_name,note:row.note,created_at:row.created_at,expires_at:row.expires_at,
  advisor:{name:profile.name,brand:profile.brand,wechat:profile.wechat,qr_url:profile.qr_id?`/api/proposals/${id}/qr`:null},
  inventory_checked_at:null,
  cats:saved.map(c=>({...c,image:photoPath(id,c.image),images:savedImages(c).map(source=>photoPath(id,source)).filter(Boolean),stock:'unknown'})),
  notices:[{title:'健康与记录',text:'疫苗资料按已录入信息展示，检测记录、健康协议范围和售后条件请在付款前与顾问逐项确认。'},
   {title:'报价与预留',text:'报价在标注期限内有效，打开页面不会锁定猫咪。定金金额、预留及交接条件请先与顾问确认。'},
   {title:'运输与费用',text:'运输方式、费用和接猫时间需根据城市与实际安排确认，页面售价不默认包含运费。'}]};
}
// Lightweight, separately requested verification. Keep the cache in getCatalog:
// forcing a fresh full-table Feishu crawl on every customer page view was the
// primary cause of 10-20 second blank pages and upstream request spikes.
async function publicStock(db,env,id){
 const row=await activeProposal(db,id);
 const saved=JSON.parse(row.cats_json);
 let catalog;
 try{catalog=await getCatalog(env);}catch{throw fail('库存暂时无法核验，请联系顾问确认最新状态',503);}
 await activeProposal(db,id);
 const map=catalogMap(catalog.cats),checked=Math.floor(new Date(catalog.updatedAt).getTime()/1000);
 return {inventory_checked_at:Number.isFinite(checked)?checked:nowSeconds(),
  cats:saved.map(c=>({id:c.id,stock:map.get(norm(c.id))?'available':'unavailable'}))};
}


// Scoped photo URL: an image token must belong to this exact saved proposal.
// This skips the slow full-table Feishu catalog lookup in /api/public-images.
// The share's active/revoked/expired check happens BEFORE the edge cache lookup.
async function publicPhoto(db,env,request,id,photoToken,waitUntil){
 if(!/^[A-Za-z0-9_-]{1,200}$/.test(photoToken))throw fail('图片不存在',404);
 const row=await activeProposal(db,id);
 const cats=JSON.parse(row.cats_json);
 if(!cats.some(c=>savedImages(c).some(src=>snapshotImageToken(src)===photoToken)))throw fail('图片不存在',404);
 const key=await sharePhotoCacheKey(env,request,photoToken),cache=globalThis.caches?.default;
 let hit=null;try{hit=await cache?.match(key);}catch{}
 if(hit)return new Response(hit.body,{status:200,headers:{'Content-Type':hit.headers.get('Content-Type')||'image/jpeg','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, noimageindex'}});
 let image;try{image=await getImage(env,photoToken);}catch{throw fail('猫咪照片暂时无法读取',503);}
 const responseHeaders={'Content-Type':image.type,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, noimageindex'};
 if(cache){
  const saved=new Response(image.bytes,{headers:{...responseHeaders,'Cache-Control':'public, max-age=21600'}});
  const work=cache.put(key,saved).catch(()=>{});
  if(waitUntil)waitUntil(work);else await work;
 }
 return new Response(image.bytes,{status:200,headers:responseHeaders});
}

async function qrResponse(db,owner,id){const row=id?await db.prepare('SELECT mime,data FROM sales_proposal_qr WHERE id=? AND owner_id=?').bind(id,owner).first():null;if(!row)return new Response(null,{status:404,headers:{'Cache-Control':'no-store'}});const bytes=Array.isArray(row.data)?Uint8Array.from(row.data):ArrayBuffer.isView(row.data)?new Uint8Array(row.data.buffer,row.data.byteOffset,row.data.byteLength):row.data instanceof ArrayBuffer?new Uint8Array(row.data):null;if(!bytes)throw fail('二维码暂时无法读取',503);return new Response(bytes,{headers:{...headers,'Content-Type':row.mime,'Content-Security-Policy':"default-src 'none'",'Content-Disposition':'inline','Content-Length':String(bytes.byteLength)}});}
export async function handleProposals({request,env,waitUntil}){
 try{
  const path=new URL(request.url).pathname.replace(/\/$/,''),db=database(env),publicMatch=/^\/api\/proposals\/([^/]+)(\/qr|\/stock)?$/.exec(path),photoMatch=/^\/api\/proposals\/([A-Za-z0-9_-]{24})\/photo\/([A-Za-z0-9_-]{1,200})$/.exec(path);
  const write=!['GET','HEAD'].includes(request.method),body=write?await bodyJson(request,path==='/api/agent/profile'?450000:12000):{};
  if(photoMatch){methods(request,['GET','HEAD']);await rateLimit(db,`proposal-public:${digest(request.headers.get('cf-connecting-ip')||'unknown').slice(0,24)}`,120,60);return await publicPhoto(db,env,request,photoMatch[1],photoMatch[2],waitUntil);}
  if(publicMatch){methods(request,['GET','HEAD']);await rateLimit(db,`proposal-public:${digest(request.headers.get('cf-connecting-ip')||'unknown').slice(0,24)}`,120,60);const id=publicMatch[1];
   if(publicMatch[2]==='/qr'){const row=await activeProposal(db,id),profile=JSON.parse(row.profile_json);return qrResponse(db,row.owner_id,profile.qr_id);}
   if(publicMatch[2]==='/stock')return json({success:true,data:await publicStock(db,env,id)});
   return json({success:true,data:await publicRead(db,id)});
  }
  const user=await agent(db,request,body);
  if(write)await rateLimit(db,`proposal-write:${user.id}`,40,60);
  if(path==='/api/agent/catalog'){methods(request,['GET','HEAD']);await rateLimit(db,`proposal-catalog:${user.id}`,60,60);const catalog=await getCatalog(env,{fresh:new URL(request.url).searchParams.get('fresh')==='1'});return json({success:true,data:catalog.cats,updatedAt:catalog.updatedAt,settings:await readWorkbench(db)});}
  if(path==='/api/agent/profile'){methods(request,['GET','HEAD','PUT']);return json({success:true,data:profileView(request.method==='PUT'?await updateProfile(db,env,user,{...body,_request:request}):await readProfile(db,env,user))});}
  if(path==='/api/agent/profile/qr'){methods(request,['GET','HEAD']);const p=await readProfile(db,env,user);return qrResponse(db,user.id,p.qr_id);}
  if(path==='/api/agent/proposals'){
   methods(request,['GET','HEAD','POST']);if(request.method==='POST'){const row=await createProposal(db,env,user,body,request);return json({success:true,data:ownerSummary(row)},201);}
   const rows=await db.prepare('SELECT * FROM sales_proposals WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 50').bind(user.id).all();return json({success:true,data:rows.results.map(ownerSummary)});
  }
  const revoke=/^\/api\/agent\/proposals\/([A-Za-z0-9_-]{24})\/revoke$/.exec(path);
  if(revoke){methods(request,['POST']);const result=await db.prepare('UPDATE sales_proposals SET revoked_at=COALESCE(revoked_at,?) WHERE id=? AND owner_id=? RETURNING id').bind(nowSeconds(),revoke[1],user.id).first();if(!result)throw fail('方案不存在',404);return json({success:true});}
  throw fail('接口不存在',404);
 }catch(error){
  const safeCodes=new Set(['FEISHU_TIMEOUT','FEISHU_NETWORK_ERROR','FEISHU_HTTP_ERROR','FEISHU_API_ERROR','FEISHU_INVALID_RESPONSE','FEISHU_TOKEN_MISSING','CONFIG_MISSING']);
  const code=safeCodes.has(error?.code)?error.code:null;
  if(!error.status)console.error('proposal_service_failed',code||'SERVICE_ERROR');
  const message=error.status?error.message:code?'飞书猫源暂时无法读取，请稍后重试或联系管理员检查飞书连接':'代理服务暂时不可用，请管理员检查数据库连接及迁移';
  return json({success:false,message,...(code?{code}:{}),...(code&&['auth','records'].includes(error?.stage)?{stage:error.stage}:{})},error.status||503,error.allow?{Allow:error.allow}:{});
 }
}
export async function cleanupProposals(db){const before=nowSeconds()-90*86400;await db.prepare('DELETE FROM sales_proposals WHERE id IN (SELECT id FROM sales_proposals WHERE expires_at<? OR revoked_at<? LIMIT 100)').bind(before,before).run();await db.prepare(`DELETE FROM sales_proposal_qr WHERE id IN (SELECT q.id FROM sales_proposal_qr q WHERE q.created_at<? AND NOT EXISTS(SELECT 1 FROM sales_agent_profiles a WHERE a.qr_id=q.id) AND NOT EXISTS(SELECT 1 FROM sales_proposals p WHERE json_extract(p.profile_json,'$.qr_id')=q.id) LIMIT 50)`).bind(nowSeconds()-86400).run();}
