import { json, requireAssistant } from '../../_lib/assistant-auth.js';
import { logs } from '../../_lib/assistant-store.js';
export async function onRequestGet({env,request}){const session=requireAssistant(request,env);if(!session)return json({success:false,message:'请先登录'},401);try{const data=(await logs(env)).filter(v=>v.salesId===session.salesId).sort((a,b)=>b.time.localeCompare(a.time)).slice(0,30);return json({success:true,data});}catch{return json({success:false,message:'读取历史失败'},502);}}
