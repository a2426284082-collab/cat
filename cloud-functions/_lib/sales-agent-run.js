// One conversational task: understand once, dispatch at most one generation, charge one task.
import {getCatalog} from './feishu.js';
import {planningInput,generateAgentPlan} from './sales-agent.js';
import {selectCandidates,generateReply,marketingOptions,normalizeId} from './sales-engine.js';
import {accountView,preflight,reserve,finish,resolveSession,fail,auditLocal} from './sales-store.js';
const paid=new Set(['match','praise','price','compare']);
const toolResult=text=>({kind:'tool',used_ai:false,matched_ids:[],reply_text:text});
export async function runAgentTask(db,env,request,body,key){
 let input;try{input=planningInput(body.prompt,body.agent_context);}catch(error){await auditLocal(db,key,'match',String(body.prompt||'').slice(0,200),error.audit||'blocked',error.message);throw error;}
 await preflight(db,key.id);
 let catalog;try{catalog=await getCatalog(env);}catch{throw fail('库存暂时读取失败，本次未扣次数，请稍后重试',503);}
 const stock=new Map();for(const cat of catalog.cats){if(cat.status&&cat.status!=='在售')continue;const id=normalizeId(cat.id);if(stock.has(id))throw fail('库存编号重复，请联系运营核对',503);stock.set(id,cat);}
 const c=input.context,known=[...c.cat_ids,...c.reference_ids];if(known.some(id=>!stock.has(id)))throw fail('任务中的猫咪已不在当前在售库，请刷新或开始新任务',409);
 if(!env.DEEPSEEK_API_KEY)throw fail('AI 服务尚未配置，本次未扣次数',503);
 const reservation=await reserve(db,key,'match',`[agent_run] ${input.prompt}`);let dispatched=false,usage={input_tokens:0,output_tokens:0};
 async function allowed(){const current=await resolveSession(db,request,body.device_id);const row=await db.prepare('SELECT enabled FROM ai_settings WHERE id=1').first();if(current.auth_version!==key.auth_version||!row?.enabled)throw fail('授权已变更或 AI 服务已暂停',403);}
 try{
  await allowed();dispatched=true;
  const understood=await generateAgentPlan(env,input.prompt,c,new Set(known));usage={input_tokens:understood.input_tokens,output_tokens:understood.output_tokens};
  const plan=understood.plan;let result=null;
  const ids=plan.cat_ids.length?plan.cat_ids:c.reference_ids.length?c.reference_ids:c.focus_id?[c.focus_id]:c.cat_ids;
  if(paid.has(plan.tool)){
   let chosen;
   if(plan.tool==='match')chosen=selectCandidates([...stock.values()],plan.query||input.prompt,'match');
   else if(ids.length!==(plan.tool==='compare'?2:1))result=toolResult(plan.tool==='compare'?'要对比哪两只？可以点选两只，或告诉我卡片上的编号。':'你想处理哪一只？可以告诉我编号，或说“刚才第二只”。');
   else chosen={cats:ids.map(id=>stock.get(id))};
   if(chosen&&!chosen.cats.length)result=toolResult(chosen.message||'当前没有符合需求的在售猫，可以调整条件后继续。');
   if(chosen?.cats.length){await allowed();const out=await generateReply(env,chosen.cats,plan.query||input.prompt,plan.tool==='match'?'match':'script',{hidePrices:body.hide_prices===true,expectedCount:plan.tool==='compare'?2:undefined});usage.input_tokens+=out.input_tokens;usage.output_tokens+=out.output_tokens;result={...out,used_ai:true};}
  }else if(plan.tool==='poster'&&plan.params.operation==='generate'){
   // Generate only for the cats actually in the current preview, never invent a new billed batch.
   const chosen=c.task==='poster'?c.cat_ids.map(id=>stock.get(id)):[];
   if(chosen.length>=2){const settings={...c.params,...plan.params},prices=chosen.map(cat=>settings.markup!==c.params.markup?Math.round(Number(cat.price)+(settings.markup??800)):c.quotes[normalizeId(cat.id)]??Math.round(Number(cat.price)+(settings.markup??800)));
    const options=marketingOptions({marketing:{template:settings.includePrices===false?'sign':'price',platform:settings.platform||'xhs',city:settings.city||'',shop:settings.shop||'同城靠谱猫舍',prices}},chosen);
    await allowed();const out=await generateReply(env,chosen,input.prompt,'script',{marketing:options});usage.input_tokens+=out.input_tokens;usage.output_tokens+=out.output_tokens;result={kind:'marketing_copy',reply_text:out.reply_text,matched_ids:out.matched_ids,used_ai:true};
   }else{delete plan.params.operation;plan.message='先为你准备拼图和基础文案，选好猫后可继续让我润色。';}
  }
  const output={...usage,status:'success',matched_ids:result?.matched_ids||[],reply_text:result?.reply_text||`[${plan.tool}] ${plan.message||''}`};await finish(db,reservation,output);
  const current=await resolveSession(db,request,body.device_id);
  return {data:{kind:'agent_run',plan,result,used_ai:true},user:accountView(current),catalog_updated_at:catalog.updatedAt};
 }catch(error){await finish(db,reservation,{...usage,status:dispatched?'upstream_error':'cancelled',reply_text:dispatched?'任务请求未取得可用结果，已计入1次；未自动重试':'模型调用前取消'},{refund:!dispatched});const row=await db.prepare('SELECT * FROM sales_keys WHERE id=?').bind(key.id).first();throw fail(dispatched?'这次任务未能完成，已计入1次，请稍后重试':error.message,error.status||502,{user:row?accountView(row):undefined});}
}
