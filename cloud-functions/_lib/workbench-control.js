import {randomBytes,createHash} from 'node:crypto';
import {WORKBENCH_DEFAULTS,validateWorkbench} from './workbench-schema.js';
const initialized=new WeakMap(),cached=new WeakMap(),error=(message,status=400)=>Object.assign(new Error(message),{status});
const missing=e=>/no such table/i.test(e?.message||'');
export async function ensureControlTables(db){
 if(!initialized.has(db)){const job=db.batch([
  db.prepare('CREATE TABLE IF NOT EXISTS workbench_config (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL, updated_at INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS sales_key_secrets (key_id INTEGER PRIMARY KEY REFERENCES sales_keys(id), key_cipher TEXT, expires_at INTEGER, updated_at INTEGER NOT NULL)'),
  db.prepare('CREATE TABLE IF NOT EXISTS workbench_admin_events (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT NOT NULL, created_at INTEGER NOT NULL)')
 ]).catch(e=>{initialized.delete(db);throw e;});initialized.set(db,job);}await initialized.get(db);
}
export async function readWorkbench(db,{fresh=false}={}){
 if(!db?.prepare)return {...WORKBENCH_DEFAULTS};const hit=cached.get(db);if(!fresh&&hit?.until>Date.now())return hit.value;
 let row;try{row=await db.prepare('SELECT value FROM workbench_config WHERE id=1').first();}catch(e){if(!missing(e))throw e;}
 let value={...WORKBENCH_DEFAULTS};if(row){try{value=validateWorkbench(JSON.parse(row.value));}catch{throw error('工作台配置格式异常，请管理员重新保存',503);}}
 cached.set(db,{value,until:Date.now()+10000});return value;
}
export async function saveWorkbench(db,input,actor){await ensureControlTables(db);const value=validateWorkbench(input);await db.batch([db.prepare('INSERT INTO workbench_config(id,value,updated_at) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(JSON.stringify(value),Math.floor(Date.now()/1000)),adminEventStatement(db,actor,'update_config','workbench')]);cached.delete(db);return value;}
export function adminEventStatement(db,actor,action,target){return db.prepare('INSERT INTO workbench_admin_events(actor,action,target,created_at) VALUES(?,?,?,?)').bind(String(actor||'admin').slice(0,60),action,String(target).slice(0,80),Math.floor(Date.now()/1000));}
async function vaultKey(env){const secret=env?.ADMIN_SESSION_SECRET;if(typeof secret!=='string'||secret.length<32)throw error('管理员会话密钥未配置，无法安全保存激活码',503);const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('petcloud-sales-vault-v1\n'+secret));return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);}
const hash=code=>createHash('sha256').update(code.replace(/[\s-]/g,'').toUpperCase()).digest('hex');
export async function encryptSalesCode(env,code){const iv=randomBytes(12),key=await vaultKey(env),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(hash(code))},key,new TextEncoder().encode(code));return 'v1.'+iv.toString('base64url')+'.'+Buffer.from(cipher).toString('base64url');}
export function vaultStatement(db,id,cipher,expiresAt){return db.prepare('INSERT INTO sales_key_secrets(key_id,key_cipher,expires_at,updated_at) VALUES(?,?,?,?) ON CONFLICT(key_id) DO UPDATE SET key_cipher=excluded.key_cipher,expires_at=COALESCE(excluded.expires_at,sales_key_secrets.expires_at),updated_at=excluded.updated_at').bind(id,cipher,expiresAt??null,Math.floor(Date.now()/1000));}
export async function keyOptions(db,id){try{return await db.prepare('SELECT key_id,expires_at,CASE WHEN key_cipher IS NOT NULL THEN 1 ELSE 0 END AS can_reveal FROM sales_key_secrets WHERE key_id=?').bind(id).first();}catch(e){if(missing(e))return null;throw e;}}
export async function checkKeyExpiry(db,id){const options=await keyOptions(db,id);if(options?.expires_at&&options.expires_at<=Date.now()/1000)throw error('销售账号已到期，请联系运营续期',401);return options;}
export async function revealSalesCode(db,env,id,actor){
 await ensureControlTables(db);const row=await db.prepare('SELECT k.key_hash,v.key_cipher FROM sales_keys k LEFT JOIN sales_key_secrets v ON v.key_id=k.id WHERE k.id=?').bind(id).first();
 if(!row)throw error('销售账号不存在',404);if(!row.key_cipher)throw error('历史激活码只保存了哈希，无法还原。需要管理员重发后重新分发给销售。',409);
 let text;try{const [version,iv,data]=row.key_cipher.split('.');if(version!=='v1')throw new Error();text=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Buffer.from(iv,'base64url'),additionalData:new TextEncoder().encode(row.key_hash)},await vaultKey(env),Buffer.from(data,'base64url')));}catch(e){if(e?.status)throw e;throw error('存档码无法解密；管理员会话密钥可能已更换，请重发该码',409);}
 await adminEventStatement(db,actor,'reveal_code',id).run();return text;
}
export async function decorateKeys(db,rows){await ensureControlTables(db);const extra=await db.prepare('SELECT key_id,expires_at,CASE WHEN key_cipher IS NOT NULL THEN 1 ELSE 0 END AS can_reveal FROM sales_key_secrets').all(),byId=new Map(extra.results.map(r=>[r.key_id,r]));return rows.map(row=>({...row,can_reveal:Boolean(byId.get(row.id)?.can_reveal),expires_at:byId.get(row.id)?.expires_at??null}));}
export async function createManagedKey(db,env,name,limit){await ensureControlTables(db);const code=randomBytes(8).toString('hex').toUpperCase().match(/.{4}/g).join('-'),normalized=code.replaceAll('-',''),digest=hash(code),cipher=await encryptSalesCode(env,code),config=await readWorkbench(db,{fresh:true}),now=Math.floor(Date.now()/1000),expires=config.defaultExpiryDays?now+config.defaultExpiryDays*86400:null;
 const result=await db.batch([db.prepare('INSERT INTO sales_keys(key_hash,key_hint,sales_name,daily_limit,created_at) VALUES(?,?,?,?,?) RETURNING id').bind(digest,'••••-'+normalized.slice(-4),name,limit,now),db.prepare('INSERT INTO sales_key_secrets(key_id,key_cipher,expires_at,updated_at) SELECT id,?,?,? FROM sales_keys WHERE key_hash=?').bind(cipher,expires,now,digest),adminEventStatement(db,'admin','create_code',name)]);return {id:result[0].results[0].id,key_code:code,key_hint:'••••-'+normalized.slice(-4),sales_name:name,daily_limit:limit,used_today:0,device_count:0,status:1,can_reveal:true,expires_at:expires};}
