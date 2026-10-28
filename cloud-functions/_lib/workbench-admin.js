import {json,requireAdmin} from './admin-auth.js';
import {ensureControlTables,readWorkbench,saveWorkbench,revealSalesCode,adminEventStatement,keyOptions} from './workbench-control.js';
export async function handleWorkbenchAdmin(db,env,request,path,body,key){
 const admin=requireAdmin(request,env);if(!admin)throw Object.assign(new Error('请先登录管理员账号'),{status:401});const actor=admin.username||'admin';
 if(path==='/api/sales-admin/control'){
  if(!['GET','PATCH'].includes(request.method))return json({success:false,message:'请求方法不支持'},405);
  await ensureControlTables(db);if(request.method==='PATCH')await saveWorkbench(db,body,actor);
  const events=await db.prepare('SELECT actor,action,target,created_at FROM workbench_admin_events ORDER BY id DESC LIMIT 20').all();return json({success:true,data:await readWorkbench(db,{fresh:true}),events:events.results});
 }
 if(path.endsWith('/reveal')){if(request.method!=='POST')return json({success:false,message:'请求方法不支持'},405);return json({success:true,data:{key_code:await revealSalesCode(db,env,key.id,actor)}});}
 if(body.action==='profile'){
  const name=typeof body.sales_name==='string'?body.sales_name.trim():'',value=body.expires_at;if(!name||name.length>60||value!==null&&(!Number.isInteger(value)||value<=0||value>Math.floor(Date.now()/1000)+3650*86400))throw Object.assign(new Error('请检查姓名及10年内的到期日期（留空为长期）'),{status:400});
  await ensureControlTables(db);await db.batch([db.prepare('UPDATE sales_keys SET sales_name=? WHERE id=?').bind(name,key.id),db.prepare('INSERT INTO sales_key_secrets(key_id,expires_at,updated_at) VALUES(?,?,?) ON CONFLICT(key_id) DO UPDATE SET expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(key.id,value,Math.floor(Date.now()/1000)),adminEventStatement(db,actor,'update_profile',key.id)]);return json({success:true});
 }
 if(body.action==='name'){const name=typeof body.sales_name==='string'?body.sales_name.trim():'';if(!name||name.length>60)throw Object.assign(new Error('姓名须为1至60字'),{status:400});await db.prepare('UPDATE sales_keys SET sales_name=? WHERE id=?').bind(name,key.id).run();return json({success:true});}
 if(body.action==='expiry'){const value=body.expires_at;if(value!==null&&(!Number.isInteger(value)||value<=0||value>Math.floor(Date.now()/1000)+3650*86400))throw Object.assign(new Error('请填写10年内的到期时间，或设为长期'),{status:400});await ensureControlTables(db);await db.batch([db.prepare('INSERT INTO sales_key_secrets(key_id,expires_at,updated_at) VALUES(?,?,?) ON CONFLICT(key_id) DO UPDATE SET expires_at=excluded.expires_at,updated_at=excluded.updated_at').bind(key.id,value,Math.floor(Date.now()/1000)),adminEventStatement(db,actor,'set_expiry',key.id)]);return json({success:true,data:await keyOptions(db,key.id)});}
 return null;
}
