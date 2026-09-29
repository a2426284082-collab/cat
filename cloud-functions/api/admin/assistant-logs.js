import { json, requireAdmin } from '../../_lib/admin-auth.js';
import { logs } from '../../_lib/assistant-store.js';
export async function onRequestGet({env,request}){if(!requireAdmin(request,env))return json({success:false,message:'请先登录'},401);try{return json({success:true,data:(await logs(env)).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,500)});}catch{return json({success:false,message:'读取AI对话记录失败'},502);}}
