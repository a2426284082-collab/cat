import {inventoryResult} from './sales-engine.js';
import {parseDemandLocally} from './smart-search.js';
import {chooseSalesCats,filterSalesCats,selectionSummary} from './sales-workflow.js';
import {answerHandbook} from './sales-handbook.js';
import {readWorkbench} from './workbench-control.js';
// One bounded conversational task: prepare data steps, dispatch UI steps, charge one sales quota.
import {getCatalog} from './feishu.js';
import {planningInput,generateAgentPlan} from './sales-agent.js';
import {selectCandidates,generateReply,marketingOptions,normalizeId} from './sales-engine.js';
import {accountView,preflight,reserve,finish,resolveSession,fail,auditLocal} from './sales-store.js';
const paid=new Set(['match','praise','price','compare']);
const toolResult=text=>({kind:'tool',used_ai:false,matched_ids:[],reply_text:text});
// Execute safe data tools before handing browser-only operations to the UI. A later
// step may depend on real IDs returned by an earlier step, never IDs invented by AI.
// A blocked step stops the workflow; no fallback quietly widens a client's filters.
export async function prepareWorkflowSteps({steps,catalog,context,env,hidePrices=false,allowed,controls}){
 const stock=new Map(catalog.map(c=>[normalizeId(c.id),c]));
 // '2000块的猫' describes the buyer's budget, not an internal wholesale
 // price. Exclude candidates whose default customer quote exceeds it.
 const customerAffordable=(list,need,markup)=>{
  if(/(?:合作底价|成本价|拿货价|进价)/.test(need))return list;
  const {filters}=parseDemandLocally(need);const budget=Number(filters.max);
  if(!Number.isFinite(budget)||budget<=0)return list;
  return list.filter(cat=>Number.isFinite(Number(cat.price))&&Number(cat.price)+Number(markup)<=budget);
 };

 let ids=context.reference_ids.length?context.reference_ids:context.cat_ids;
 const prepared=[],usage={input_tokens:0,output_tokens:0};
 let currentNeed=context.need||'',posterSettings={...context.params},quotes={...context.quotes};
 for(let index=0;index<steps.length;index++){
  const original=steps[index],plan={...original,params:{...original.params},cat_ids:[...original.cat_ids]};
  let result=null,status='ready',reason='';
  const fallbackIds=plan.cat_ids.length?plan.cat_ids:ids;
  if(plan.tool==='match'){
   const need=plan.query||currentNeed;
   if(!need){status='blocked';reason='没有可用于找猫的客户要求，请补充预算、品种或性别。';}
   else{
    const amount=plan.params.count||2;
    const needsPoster=steps.slice(index+1).some(step=>step.tool==='poster');
    const selected=chooseSalesCats(customerAffordable(catalog,need,posterSettings.markup??800),need,amount,{requireImage:needsPoster});
    ids=selected.map(cat=>normalizeId(cat.id));currentNeed=need;
    result={kind:'inventory',used_ai:false,matched_ids:ids.map(id=>'#'+id),reply_text:selectionSummary(selected,amount,need,{hidePrices})};
    if(selected.length<amount){status='blocked';reason=`按客户预算和当前销售加价，可用的猫只有${selected.length}/${amount}只。原条件未放宽，请调整要求后继续。`;}
   }
  }else if(plan.tool==='poster'){
   if(!controls.posterEnabled){status='blocked';reason='管理员暂时关闭了拼图工具。';}
   else if(plan.params.operation==='replace'){status='blocked';reason='多步骤任务暂不自动替换某个位置的猫，以免后续文案引用替换前的猫。请先完成替换，再单独生成文案。';}
   else if(plan.params.operation==='generate'){
    const selected=fallbackIds.map(id=>stock.get(id)).filter(Boolean);
    if(selected.length<2){status='blocked';reason='文案生成需要至少2只已经确认的猫，尚未找到足够猫咪。';}
    else{
     const setting={...posterSettings,...plan.params},prices=selected.map(cat=>{
       const floor=Number(cat.price);
       const quoted=quotes[normalizeId(cat.id)];
       return Number.isFinite(quoted)&&quoted>=floor?quoted:Math.max(0,Math.round(floor+(setting.markup??800)));
     });
     const options=marketingOptions({marketing:{template:setting.includePrices===false?'sign':'price',platform:setting.platform||'xhs',city:setting.city||'',shop:setting.shop||'同城靠谱猫舍',prices}},selected);
     await allowed();
     try{
      const out=await generateReply(env,selected,'根据当前选猫和宣传图设置生成对客文案','script',{marketing:options});
      usage.input_tokens+=out.input_tokens;usage.output_tokens+=out.output_tokens;
      result={kind:'marketing_copy',reply_text:out.reply_text,matched_ids:out.matched_ids,used_ai:true};
      plan.cat_ids=selected.map(cat=>normalizeId(cat.id));
     }catch{status='blocked';reason='文案服务未能返回合格内容，前面的选猫和拼图步骤仍可执行；本次不会自动重试生成。';}
    }
   }else{
    const need=plan.query||currentNeed||'';
    const pool=filterSalesCats(customerAffordable(catalog,need,posterSettings.markup??800),need).filter(c=>c.image);
    const allowedPool=new Set(pool.map(cat=>normalizeId(cat.id)));
    let selected=fallbackIds.filter(id=>allowedPool.has(id));
    const followingMatch=prepared.some(step=>step.plan.tool==='match');
    const expected=plan.params.count||selected.length||Math.min(4,pool.length);
    selected=selected.slice(0,expected);
    if(!followingMatch)for(const cat of pool)if(selected.length<expected&&!selected.includes(normalizeId(cat.id)))selected.push(normalizeId(cat.id));
    if(selected.length<2||plan.params.count&&selected.length<plan.params.count){status='blocked';reason=`符合条件且有照片的在售猫只有${selected.length}只，无法满足本次拼图要求（需要${expected}只）。`;}
    else{
     ids=selected;currentNeed=need;posterSettings={...posterSettings,...plan.params,count:selected.length};
     plan.cat_ids=[...ids];plan.query=need;
     result={kind:'tool',used_ai:false,matched_ids:ids.map(id=>'#'+id),reply_text:`已核实${ids.length}只在售猫及图片，准备创建拼图。`};
    }
   }
  }else if(paid.has(plan.tool)){
   const required=plan.tool==='compare'?2:1;
   if(fallbackIds.length!==required||fallbackIds.some(id=>!stock.has(id))){status='blocked';reason=required===2?'请明确需要对比的两只猫。':'请明确需要写话术的那一只猫。';}
   else{
    plan.cat_ids=[...fallbackIds];
    await allowed();
    try{
     const out=await generateReply(env,fallbackIds.map(id=>stock.get(id)),plan.query||'根据已录入的真实资料生成销售话术','script',{hidePrices,expectedCount:required===2?2:undefined});
     usage.input_tokens+=out.input_tokens;usage.output_tokens+=out.output_tokens;
     result={...out,used_ai:true};
    }catch{status='blocked';reason='话术服务未能返回合格内容，前面的步骤已保留，本次不自动重复请求模型。';}
   }
  }else if(plan.tool==='handbook'){
   result=answerHandbook(plan.query||'合作售后政策')||toolResult('没有找到对应条款，请在手册中核实。');
  }else if(['details','downloads','single_poster','calculator','order'].includes(plan.tool)){
   if(fallbackIds.length!==1){status='blocked';reason='请指明要处理的猫咪编号，不能猜是哪一只。';}
   else plan.cat_ids=[...fallbackIds];
  }
  prepared.push({plan,result,status,...(reason?{reason}:{})});
  if(status==='blocked')break;
 }
 return {prepared,usage,complete:prepared.length===steps.length&&prepared.every(s=>s.status==='ready')};
}
export async function runAgentTask(db,env,request,body,key){
 let input;try{input=planningInput(body.prompt,body.agent_context);}catch(error){await auditLocal(db,key,'match',String(body.prompt||'').slice(0,200),error.audit||'blocked',error.message);throw error;}
 await preflight(db,key.id);
 let catalog;try{catalog=await getCatalog(env);}catch{throw fail('库存暂时读取失败，本次未扣次数，请稍后重试',503);}
 const stock=new Map();for(const cat of catalog.cats){if(cat.status&&cat.status!=='在售')continue;const id=normalizeId(cat.id);if(stock.has(id))throw fail('库存编号重复，请联系运营核对',503);stock.set(id,cat);}
 const c=input.context,known=[...c.cat_ids,...c.reference_ids];if(known.some(id=>!stock.has(id)))throw fail('任务中的猫咪已不在当前在售库，请刷新或开始新任务',409);
 if(!env.DEEPSEEK_API_KEY)throw fail('AI 服务尚未配置，本次未扣次数',503);
 const reservation=await reserve(db,key,'match',`[agent_run] ${input.prompt}`);let stage='understand',dispatched=false,usage={input_tokens:0,output_tokens:0};
 async function allowed(){const current=await resolveSession(db,request,body.device_id);const row=await db.prepare('SELECT enabled FROM ai_settings WHERE id=1').first();if(current.auth_version!==key.auth_version||!row?.enabled)throw fail('授权已变更或 AI 服务已暂停',403);}
 try{
  await allowed();dispatched=true;
  const understood=await generateAgentPlan(env,input.prompt,c,new Set(known));usage={input_tokens:understood.input_tokens,output_tokens:understood.output_tokens};
  const plan=understood.plan;let result=null;stage='tool_setup';const controls=await readWorkbench(db,{fresh:true});
  if(understood.steps.length>1){
   stage='workflow';const workflow=await prepareWorkflowSteps({steps:understood.steps,catalog:[...stock.values()],context:c,env,hidePrices:body.hide_prices===true,allowed,controls});
   usage.input_tokens+=workflow.usage.input_tokens;usage.output_tokens+=workflow.usage.output_tokens;
   await finish(db,reservation,{...usage,status:'success',matched_ids:[],reply_text:`工作流准备了${workflow.prepared.length}步${workflow.complete?'':'，存在待处理的条件'}`});
   const current=await resolveSession(db,request,body.device_id);
   return {data:{kind:'agent_run',plan,steps:workflow.prepared,preparation_complete:workflow.complete,planner_source:understood.source,used_ai:true},user:accountView(current),catalog_updated_at:catalog.updatedAt};
  }if(plan.tool==='poster'&&!controls.posterEnabled)throw fail('营销拼图功能已被管理员暂停',403);
  const ids=plan.cat_ids.length?plan.cat_ids:c.reference_ids.length?c.reference_ids:c.focus_id?[c.focus_id]:c.cat_ids;
  if(paid.has(plan.tool)){
   let chosen;
   if(plan.tool==='match')result=inventoryResult([...stock.values()],plan.query||input.prompt);
   else if(ids.length!==(plan.tool==='compare'?2:1))result=toolResult(plan.tool==='compare'?'要对比哪两只？可以点选两只，或告诉我卡片上的编号。':'你想处理哪一只？可以告诉我编号，或说“刚才第二只”。');
   else chosen={cats:ids.map(id=>stock.get(id))};
   if(chosen&&!chosen.cats.length)result=toolResult(chosen.message||'当前没有符合需求的在售猫，可以调整条件后继续。');
   if(chosen?.cats.length){stage='generate';await allowed();const out=await generateReply(env,chosen.cats,plan.query||input.prompt,plan.tool==='match'?'match':'script',{hidePrices:body.hide_prices===true,expectedCount:plan.tool==='compare'?2:undefined});usage.input_tokens+=out.input_tokens;usage.output_tokens+=out.output_tokens;result={...out,used_ai:true};}
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
  return {data:{kind:'agent_run',plan,result,planner_source:understood.source,used_ai:true},user:accountView(current),catalog_updated_at:catalog.updatedAt};
 }catch(error){
  // Do not bill a salesperson when the model never returned an executable plan.
  // Provider API cost and the salesperson's daily allowance are distinct.
  const malformed=stage==='understand'&&error.reason_code&&error.reason_code!=='MODEL_HTTP';
  const refund=!dispatched||stage==='understand'||stage==='tool_setup'||malformed||error.refund_user_quota===true;
  const failure=stage==='understand'?'AI规划未能生成可用步骤':stage==='tool_setup'?'工具配置校验失败':stage==='workflow'?'工作流准备未完成':'话术服务处理失败';
  const code=error.reason_code|| (stage==='tool_setup'?'TOOL_SETUP':stage==='workflow'?'WORKFLOW_PREPARE':'GENERATION_FAILED');
  await finish(db,reservation,{...usage,status:dispatched?'upstream_error':'cancelled',reply_text:`${failure} (${code})`},{refund});
  const row=await db.prepare('SELECT * FROM sales_keys WHERE id=?').bind(key.id).first();
  const notice=dispatched?`${failure}（错误码 ${code}）。${refund?'本次未扣销售配额。':'本次模型调用已计入1次。'}可以直接重试完整需求，无需拆成简单指令。`:error.message;
  throw fail(notice,error.status||502,{user:row?accountView(row):undefined});
 }
}
