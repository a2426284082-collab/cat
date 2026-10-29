import {isQuickTemplate,artifactContext,cleanArtifact,REOPEN_TOOLS} from './agent-artifacts.js';
import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {resolveCatReferences,mergeMatchNeed,readAgentSession,writeAgentSession,AGENT_STORAGE,AGENT_TTL,validateAgentPlan} from './agent.js';
import {normalizeId} from './presentation.js';
import {readPosterArtifact} from './poster-artifacts.js';
import {answerHandbook} from '../../cloud-functions/_lib/sales-handbook.js';
export const AgentContext=createContext(null);
export const useAgentContext=()=>useContext(AgentContext);
const empty=()=>({task:'help',cat_ids:[],params:{},need:''}),paid=new Set(['match','praise','price','compare']);
const message=text=>({kind:'tool',used_ai:false,matched_ids:[],reply_text:text});
export function useWorkspaceAgent({cats,session,execute,onReset}){
 const {ask,taskNext,taskRead,taskCancel,epoch,listingIdentity,checking}=session,[context,setContext]=useState(empty),[messages,setMessages]=useState([]),[result,setResult]=useState(null),[pending,setPending]=useState(false),[storageFailed,setStorageFailed]=useState(false),[conversationOpen,setConversationOpen]=useState(false),[phase,setPhase]=useState('idle'),[workflowProgress,setWorkflowProgress]=useState([]),[pendingWorkflow,setPendingWorkflow]=useState(null),[durableTask,setDurableTask]=useState(null),[recentTasks,setRecentTasks]=useState([]),[mediaProgress,setMediaProgress]=useState(null);
 const activeArtifact=useRef(null);
 const state=useRef({context,messages}),owner=useRef(null),generation=useRef(0),lock=useRef(false),alive=useRef(true),priorEpoch=useRef(epoch),lastTouch=useRef(Date.now());state.current={context,messages};const renderedOwner=owner.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
 function remember(patch){lastTouch.current=Date.now();const old=state.current.context,next={...old,...patch,cat_ids:(patch.cat_ids??old.cat_ids).map(normalizeId).slice(0,9)};if(JSON.stringify(next)!==JSON.stringify(old)){state.current={...state.current,context:next};setContext(next);if(patch.task==='poster'&&activeArtifact.current)setMessages(rows=>rows.map(row=>row.id===activeArtifact.current&&row.action?.tool==='poster'?{...row,action:{...row.action,context:artifactContext(next)}}:row));}return next;}
 function capturePreview(data){if(state.current.context.task!=='poster'||typeof data!=='string'||data.length>=120000)return;const ids=state.current.context.cat_ids.join(',');setMessages(old=>{const next=[...old];for(let i=next.length-1;i>=0;i--){const a=next[i].action;if(a?.tool==='poster'&&next[i].id===activeArtifact.current&&a.context.cat_ids.join(',')===ids){next[i]={...next[i],action:{...a,context:artifactContext(state.current.context),preview:data}};break;}}return next;});}
 async function reopen(row){if(lock.current||!row?.action)return;const action=cleanArtifact(row.action),version=generation.current;if(action.context.cat_ids.some(id=>!cats.some(c=>normalizeId(c.id)===id&&(!c.status||c.status==='在售')))){setResult(message('这张任务卡中的猫咪库存已变化，请刷新核对；原记录保留。'));return;}try{activeArtifact.current=row.id;setConversationOpen(false);if(['match','praise','price','compare','order'].includes(action.tool)){await execute({tool:'show_matches'},action.context);setResult(row.result||message(row.text));}else await execute({tool:action.tool,cat_ids:action.context.cat_ids,params:action.context.params,query:action.context.need},action.context,{restore:true});if(version===generation.current)remember(action.context);}catch(e){setResult(message(e.message||'工具暂时未打开，原任务卡已保留。'));}}

 function recordTask(tool,snapshot,text){const context=remember(snapshot),output=message(text);activeArtifact.current=append('assistant',text,{result:output,action:{tool,context:artifactContext(context)}});setResult(output);}
 function reset(){if(durableTask?.task_id&&['waiting','thinking','paused'].includes(durableTask.status))taskCancel?.(durableTask.task_id).catch(()=>{});activeArtifact.current=null;generation.current++;lock.current=false;setPending(false);setConversationOpen(false);setPhase('idle');setWorkflowProgress([]);setPendingWorkflow(null);setDurableTask(null);setRecentTasks([]);setMediaProgress(null);setContext(empty());setMessages([]);setResult(null);onReset?.();try{if(owner.current)sessionStorage.removeItem(AGENT_STORAGE+owner.current);}catch{}}
 useEffect(()=>{
  if(checking)return;const next=listingIdentity,prior=owner.current;
  if(prior===next)return;
  owner.current=next;
  // Explicit activation may finish the pending guest request; keep that one flow intact.
  if(prior?.startsWith('device:')&&next.startsWith('sales:'))return;
  if(prior){generation.current++;lock.current=false;setPending(false);setConversationOpen(false);setResult(null);setWorkflowProgress([]);setPendingWorkflow(null);setDurableTask(null);try{sessionStorage.removeItem(AGENT_STORAGE+prior);}catch{}}
  let saved;try{saved=readAgentSession(sessionStorage,next);}catch{}
  if(saved){setContext(saved.context);setMessages(saved.messages);setPendingWorkflow(saved.pendingWorkflow||null);if(saved.pendingWorkflow?.length)setWorkflowProgress(saved.pendingWorkflow.map((step,i)=>({label:step.plan.tool,state:'waiting',index:i})));else setWorkflowProgress([]);}else if(prior){setContext(empty());setMessages([]);}
 },[listingIdentity,checking]);
 useEffect(()=>{if(priorEpoch.current!==epoch){priorEpoch.current=epoch;generation.current++;lock.current=false;setPending(false);setConversationOpen(false);setPhase('idle');setWorkflowProgress([]);setPendingWorkflow(null);setDurableTask(null);setRecentTasks([]);setMediaProgress(null);setContext(empty());setMessages([]);setResult(null);setWorkflowProgress([]);setPendingWorkflow(null);}},[epoch]);
 // Restore the latest durable task from Cloudflare D1, not the 30-minute session cache.
 useEffect(()=>{if(checking||!listingIdentity?.startsWith('sales:')||!taskRead)return;
  let active=true;taskRead('list').then(list=>{if(active)setRecentTasks(Array.isArray(list)?list:[]);}).catch(()=>{});
  taskRead().then(task=>{if(active&&task&&['waiting','paused','thinking'].includes(task.status)){setDurableTask(task);setPhase('paused');}}).catch(()=>{});
  return()=>{active=false;};
 },[checking,listingIdentity]);
 useEffect(()=>{if(!checking&&owner.current===listingIdentity&&renderedOwner===listingIdentity){try{setStorageFailed(!writeAgentSession(sessionStorage,listingIdentity,{context,messages,pendingWorkflow}));}catch{setStorageFailed(true);}}},[context,messages,pendingWorkflow,listingIdentity,checking]);
 function append(role,text,extra={}){const id=crypto.randomUUID();setMessages(old=>[...old,{id,role,text:String(text).slice(0,role==='user'?4000:600),...extra}].slice(-16));return id;}
 async function perform(plan,text,version,serverResult,semantic=false,workflow=false,taskMeta={}){
  if(plan.tool==='reset'){reset();return message('已开始新任务。下一位客户的需求不会沿用上一位。');}
  if(plan.tool==='chat')return message(plan.message||'你可以继续说客户的情况，我会帮你整理下一步。');
  if(plan.tool==='help'&&plan.message)return message(plan.message);
  if(plan.tool==='help')return message('我能挑猫、做2至9图拼图、写单猫或双猫话术、看资料、准备素材下载、算报价和查手册。可以接着说“换成四只”“不要价格”“看第二只”；说“新任务”清空这次上下文。');
  if(plan.tool==='clarify')return message(plan.message||'请补充需要操作的猫咪编号或具体任务。');
  if(semantic&&plan.tool==='calculator'&&serverResult?.kind==='quote_summary'){if(serverResult.verification?.verified!==true)throw new Error('报价结果未通过后端核对');return serverResult;}
  if(plan.tool==='handbook'&&!/打开.*手册|去.*手册|查看手册/.test(plan.query||text)){const answer=answerHandbook(plan.query||text);if(answer){remember({task:'handbook'});return answer;}}
  if(plan.tool==='inventory'){setPhase('executing');const output=await ask({mode:'match',action:'catalog_match',prompt:plan.query,hide_prices:session.hidePrices});if(version!==generation.current)return null;await execute({tool:'show_matches'},state.current.context);remember({task:'match',cat_ids:(output.matched_ids||[]).map(normalizeId),need:plan.query,params:{},focus_id:null});setConversationOpen(false);return output;}
  if(paid.has(plan.tool)){
   if(semantic){if(plan.tool==='match'){await execute({tool:'show_matches'},state.current.context);if(!workflow&&!semantic)setConversationOpen(false);}if(!serverResult)throw new Error('任务结果不完整，未重复调用AI。');if(serverResult.used_ai||serverResult.kind==='inventory')remember(workflow&&plan.tool!=='match'?{task:state.current.context.task}:{task:plan.tool,cat_ids:(serverResult.matched_ids||[]).map(normalizeId),need:plan.tool==='match'?(plan.query||text):state.current.context.need,params:{},focus_id:null});return serverResult;}
   const refs=plan.cat_ids?.length?plan.cat_ids:state.current.context.focus_id?[state.current.context.focus_id]:state.current.context.cat_ids,need=mergeMatchNeed(state.current.context.need,plan.query||text,cats,state.current.context.cat_ids);
   if(plan.tool!=='match'&&refs.length!==(plan.tool==='compare'?2:1))return message(plan.tool==='compare'?'请明确选择两只猫，或输入两个短编号。':'请明确是哪一只猫，例如“给 #017 写保价话术”。');
   const payload=plan.tool==='match'?{mode:'match',prompt:need,hide_prices:session.hidePrices}:{mode:'script',action:plan.tool,cat_ids:refs,hide_prices:session.hidePrices};
   const taskRevision=JSON.stringify(state.current.context),output=await ask(payload);if(version!==generation.current)return null;if(JSON.stringify(state.current.context)!==taskRevision)return message('请求期间任务已经变化，原结果未覆盖当前任务；本次模型请求的扣次以工号显示为准。');
   if(plan.tool==='match')setConversationOpen(false);
   remember({task:plan.tool,cat_ids:(output.matched_ids||[]).map(normalizeId),need:plan.tool==='match'?need:state.current.context.need,params:{},focus_id:null});return output;
  }
  setPhase('executing');if(!workflow&&!semantic)setConversationOpen(false);
  const output=await execute(plan,state.current.context,{caption:serverResult?.kind==='marketing_copy'?serverResult.reply_text:undefined,
   verifyRender:workflow,silentPoster:semantic||workflow,taskId:taskMeta.taskId,goalId:taskMeta.goalId,
   onProgress:step=>setMediaProgress({...step,taskId:taskMeta.taskId||null,goalId:taskMeta.goalId||null})});
  if(version!==generation.current)return null;if(output?.ok===false)throw new Error(output.text||'工具执行失败');if(output?.context)remember(output.context);
  if(semantic&&plan.tool==='poster'&&plan.params?.operation==='generate'&&serverResult?.kind==='marketing_copy'){
   if(!serverResult.reply_text?.trim())throw new Error('推荐文案为空，无法交付给销售');
   return {...serverResult,reply_text:`【可直接复制的推荐话术】\n${serverResult.reply_text}`};
  }
  return output?.result||(output?.artifact?{...message(output.text||'图片已生成'),artifact:output.artifact}:message(output?.text||'已打开对应工具。'));
 }
 const workflowLabels={match:'筛选在售猫',poster:'制作拼图/文案',praise:'生成推荐话术',price:'生成保价话术',compare:'对比猫咪',handbook:'核对销售手册',details:'查看资料',downloads:'打开下载',single_poster:'单猫海报',calculator:'核算报价',order:'查库核实',catalog:'筛选猫源',client_view:'对客模式'};
 function normalizeWorkflow(rows){
  if(!Array.isArray(rows)||rows.length<2||rows.length>5)throw new Error('工作流步骤数量无效');
  const stockIds=new Set(cats.map(cat=>normalizeId(cat.id)));
  return rows.map(row=>{
   if(!row||!['ready','blocked'].includes(row.status))throw new Error('工作流状态无效');
   const plan=validateAgentPlan(row.plan,stockIds);
   if(plan.cat_ids.some(id=>!cats.some(c=>normalizeId(c.id)===id&&(!c.status||c.status==='在售'))))throw new Error('当前猫咪库存状态已变化，请刷新库存并重新发起任务。');
   const result=row.result&&typeof row.result==='object'?row.result:null;
   const reason=String(row.reason||'').slice(0,180);
   return {plan,result,status:row.status,reason};
  });
 }
 function saveStepArtifact(plan,output,index){
  const task=plan.tool,ctx=state.current.context;
  const snapshot=artifactContext({...ctx,task:REOPEN_TOOLS.includes(task)?task:'match',...(['details','downloads','single_poster','calculator'].includes(task)?{cat_ids:plan.cat_ids?.length?plan.cat_ids:ctx.cat_ids,params:plan.params}:{}),...(['handbook','catalog'].includes(task)?{need:plan.query||ctx.need,params:plan.params}:{})});
  const action=REOPEN_TOOLS.includes(task)?{tool:task,context:snapshot}:null;
  const line=`第${index+1}步 · ${workflowLabels[task]||task}：${output.reply_text||'已执行'}`;
  activeArtifact.current=append('assistant',line,{result:output,...(output?.artifact?{artifact:output.artifact}:{}),...(action?{action}:{})});
 }
 async function executeWorkflow(rows,version){
  const steps=normalizeWorkflow(rows);
  setWorkflowProgress(steps.map((row,i)=>({label:workflowLabels[row.plan.tool]||row.plan.tool,state:'waiting',index:i})));
  let completed=0;
  for(let i=0;i<steps.length;i++){
   if(version!==generation.current||!alive.current)return;
   const row=steps[i];
   if(row.status==='blocked'){
    const note=`第${i+1}步暂停：${row.reason||'需要补充信息后才能继续。'}${row.result?.reply_text?'\n'+row.result.reply_text:''}`;
    setWorkflowProgress(old=>old.map((p,n)=>n===i?{...p,state:'blocked'}:p));
    const out=message(note);setResult(out);append('assistant',out.reply_text);setPendingWorkflow(null);setPhase('blocked');return;
   }
   setPhase('executing');setMediaProgress(null);setWorkflowProgress(old=>old.map((p,n)=>n===i?{...p,state:'running'}:p));
   try{
    const out=await perform(row.plan,row.plan.query||'',version,row.result,true,true);
    if(!out||version!==generation.current)return;
    completed++;
    setWorkflowProgress(old=>old.map((p,n)=>n===i?{...p,state:'done'}:p));
    saveStepArtifact(row.plan,out,i);setResult(out);
   }catch(error){
    const note=`第${i+1}步「${workflowLabels[row.plan.tool]||row.plan.tool}」未完成：${error.message||'工具执行失败'}。前${completed}步结果已保留，可点“继续未完成步骤”重试，不会再次请求AI。`;
    setWorkflowProgress(old=>old.map((p,n)=>n===i?{...p,state:'failed'}:p));
    setPendingWorkflow(steps.slice(i));const out=message(note);setResult(out);append('assistant',out.reply_text);setPhase('error');return;
   }
  }
  setPendingWorkflow(null);setPhase('done');append('assistant',`本次共${completed}步，已逐步执行并记录结果。请核对拼图、售价与库存，图片尚未自动发送给客户。`);
 }
 // The browser only acknowledges real results. Every acknowledgement is written
 // to D1 before the model can choose the next action. D1 survives reloads.
 async function followAutopilot(task,version){
  let count=0;
  while(alive.current&&version===generation.current&&count++<15){
   setDurableTask(task);
   setWorkflowProgress(task.goals?.length?task.goals.map((g,i)=>({label:g.label,state:g.status==='done'?'done':task.step?.goal_id===g.id?'waiting':g.attempts>0?'failed':'waiting',index:i})): [...task.history.map((h,i)=>({label:workflowLabels[h.tool]||h.tool,state:h.status==='success'?'done':'failed',index:i})),...(task.step?[{label:workflowLabels[task.step.plan.tool]||task.step.plan.tool,state:'waiting',index:task.history.length}]:[])]);
   if(task.context)remember(task.context);
   if(task.status==='done'||task.status==='blocked'){
    setPhase(task.status==='done'?'done':'blocked');
    const txt=task.status==='done'?`任务已结束：${task.summary||'已完成所有确认的工具步骤'}。图片、报价等请核对后再发给客户。`:`任务暂停：${task.summary||'当前条件下无法继续执行'}。已完成的步骤已保存。`;
    const output=message(txt);setResult(output);append('assistant',txt);
    taskRead('list').then(list=>{if(alive.current)setRecentTasks(Array.isArray(list)?list:[]);}).catch(()=>{});return;
   }
   if(task.status==='paused'||task.status==='thinking'){
    setPhase('paused');const txt=task.error||'任务已保存在服务器，可以点击“恢复任务”继续。';
    setResult(message(txt));return;
   }
   if(task.status!=='waiting'||!task.step){setPhase('paused');return;}
   const {id,plan,result:serverResult}=task.step;
   setPhase('executing');setMediaProgress(null);setWorkflowProgress(old=>old.map((p,i)=>(task.goals?.length?task.goals[i]?.id===task.step.goal_id:i===old.length-1)?{...p,state:'running'}:p));
   const receiptKey=AGENT_STORAGE+'receipt:'+listingIdentity;
   let receipt=null;
   try{const saved=JSON.parse(sessionStorage.getItem(receiptKey)||'null');if(saved?.task_id===task.task_id&&saved?.receipt?.step_id===id&&Date.now()-saved.at<AGENT_TTL)receipt=saved.receipt;}catch{}
   if(!receipt){
    try{
     const output=await perform(plan,plan.query||'',version,serverResult,true,true,
       {taskId:task.task_id,goalId:task.step.goal_id,stepId:id});
     if(version!==generation.current||!alive.current)return;
     if(!output)throw new Error('执行结果为空');
     const text=String((output.artifact?`图片成果 ${output.artifact.id}（${output.artifact.persisted?'已保存至此浏览器':'仅当前会话'}）；`:'')+(output.reply_text||'工具执行完毕')).slice(0,500);
     receipt={step_id:id,status:'success',text};
     saveStepArtifact(plan,output,task.history.length);setResult(output);
    }catch(error){receipt={step_id:id,status:'error',text:String(error.message||'工具执行失败').slice(0,500)};}
    // If the HTTP acknowledgement is lost, do not repeat a finished browser
    // action on reload in the same tab: replay its receipt instead.
    try{sessionStorage.setItem(receiptKey,JSON.stringify({task_id:task.task_id,receipt,at:Date.now()}));}catch{}
   }
   // A failed browser step is not a completed task. Send the exact error back
   // to the server; the planner will decide whether to retry or switch tools.
   setPhase('understanding');
   try{task=await taskNext({task_id:task.task_id,receipt});try{sessionStorage.removeItem(receiptKey);}catch{}}
   catch(error){setPhase('paused');setResult(message(`工具结果尚未确认写入服务器：${error.message||'请求失败'}。请点击恢复任务。`));return;}
  }
  setPhase('paused');setResult(message('已到前端安全执行上限，任务保留。可点击恢复任务核对状态。'));
 }
 async function openSavedTask(id){
  if(lock.current||!id)return;
  try{const task=await taskRead(id);if(!task)return;
   setDurableTask(task);setConversationOpen(true);
   if(task.context)remember(task.context);
   // Recover saved PNG metadata from the D1 step receipt, then load the actual
   // bytes from this browser's IndexedDB. No image bytes enter D1.
   const history=await Promise.all((task.history||[]).slice(-14).map(async event=>{
     const item={id:event.step_id||crypto.randomUUID(),role:'assistant',text:`${event.tool||'工具'}：${event.text||'已执行'}`};
     const found=String(event.text||'').match(/图片成果 ([a-zA-Z0-9_-]{8,110})/);
     if(found){
       const local=await readPosterArtifact({id:found[1],owner:listingIdentity});
       if(local){
         item.artifact={id:local.id,catIds:local.catIds||[],width:local.width,
           height:local.height,bytes:local.blob?.size||0,persisted:true,designSeed:local.settings?.designSeed||0};
         const reopenContext=artifactContext({task:'poster',cat_ids:local.catIds||[],
           params:local.settings||{},designSeed:local.settings?.designSeed,need:task.context?.need||''});
         item.action={tool:'poster',context:reopenContext};
       }
       else item.text+='（图片文件只保存在原浏览器，当前无法恢复预览）';
     }
     return item;
   }));
   setMessages([{id:crypto.randomUUID(),role:'user',text:task.goal||'历史任务'},...history]);
   if(['waiting','paused','thinking'].includes(task.status)){setPhase('paused');setResult(message('云端任务已找回，请点击恢复任务继续执行。'));}
   else{setPhase(task.status==='done'?'done':'blocked');setWorkflowProgress(task.goals?.length?task.goals.map((g,i)=>({label:g.label,state:g.status==='done'?'done':g.attempts>0?'failed':'waiting',index:i})):task.history.map((h,i)=>({label:workflowLabels[h.tool]||h.tool,state:h.status==='success'?'done':'failed',index:i}))); setResult(message(task.summary||'该任务已结束，历史执行记录已找回。'));}
  }catch(error){setResult(message(error.message||'读取历史任务失败'));}
 }
 async function resumeDurableTask(){
  if(lock.current||!durableTask?.task_id)return;
  lock.current=true;setPending(true);const version=generation.current;
  try{let task=await taskRead(durableTask.task_id);
   if(task.status==='paused'||task.status==='thinking')task=await taskNext({task_id:task.task_id});
   await followAutopilot(task,version);
  }catch(error){setPhase('paused');setResult(message(error.message||'恢复任务失败，服务器记录保留。'));}
  finally{lock.current=false;setPending(false);}
 }
 async function resumeWorkflow(){
  if(lock.current||!pendingWorkflow?.length)return;
  lock.current=true;setPending(true);setPhase('executing');const version=generation.current;
  try{const cached=pendingWorkflow;setPendingWorkflow(null);await executeWorkflow(cached,version);}
  catch(e){const out=message(e.message||'恢复任务失败');setResult(out);append('assistant',out.reply_text);setPhase('error');}
  finally{lock.current=false;setPending(false);}
 }
 async function run(text,{source='free',tool}={}){
  text=String(text||'').trim();if([...text].length>4000){setResult(message('任务描述最多4000字，请删除不必要的内容后再发送。'));return;}if(lock.current||!text)return;if(Date.now()-lastTouch.current>AGENT_TTL){reset();state.current={context:empty(),messages:[]};}lastTouch.current=Date.now();lock.current=true;setPending(true);setPhase('understanding');setWorkflowProgress([]);setMediaProgress(null);setPendingWorkflow(null);setDurableTask(null);const version=generation.current;append('user',text);
  try{
   let plan,serverResult;const quick=source==='quick'&&tool==='match'&&isQuickTemplate(text);
   if(quick){if(/【\s*(?:#\s*)?】/.test(text))plan={tool:'clarify',cat_ids:[],params:{},message:'填好模板中的客户信息后再发送，也可以自由描述需求。'};else plan={tool:'inventory',cat_ids:[],params:{},query:text};}
   else{
    const c=state.current.context,refs=resolveCatReferences(text,cats,c);
    {
     const fingerprint=JSON.stringify(c),agent_context={task:c.task||'help',cat_ids:c.cat_ids||[],reference_ids:refs.ids,focus_id:c.focus_id||null,quotes:c.quotes||{},need:c.need||'',params:{markup:session.markup??800,...(c.params||{})},recent_users:state.current.messages.filter(r=>r.role==='user').slice(-2).map(r=>r.text.slice(0,80))};
     const response=await ask({mode:'match',action:'agent_autopilot',prompt:text,agent_context,previous_task_id:durableTask?.task_id,hide_prices:session.hidePrices});if(version!==generation.current||!alive.current)return;
     if(JSON.stringify(state.current.context)!==fingerprint){const output=message('操作期间任务已变化，原指令未覆盖当前内容。请按现在的预览继续；本次计次以工号显示为准。');setResult(output);append('assistant',output.reply_text);return;}
     if(response.kind==='agent_task'){await followAutopilot(response,version);return;}
     if(response.kind!=='agent_run')throw new Error('助手接口版本不一致，请确认前后端已一起更新。');
     if(response.steps){await executeWorkflow(response.steps,version);return;}
     plan=validateAgentPlan(response.plan,new Set(cats.map(c=>normalizeId(c.id))));serverResult=response.result;
    }
   }
   const output=await perform(plan,text,version,serverResult,!quick);if(!output||!alive.current||plan.tool!=='reset'&&version!==generation.current)return;
   setPhase('done');setResult(output);const task=plan.tool==='inventory'?'match':plan.tool,snapshot=artifactContext({...state.current.context,task:REOPEN_TOOLS.includes(task)?task:'match',...(['details','downloads','single_poster','calculator'].includes(task)?{cat_ids:plan.cat_ids?.length?plan.cat_ids:state.current.context.focus_id?[state.current.context.focus_id]:state.current.context.cat_ids,params:plan.params}:{}),...(['handbook','catalog'].includes(task)?{need:plan.query||text,params:plan.params}:{} )});const action=REOPEN_TOOLS.includes(task)?{tool:task,context:snapshot}:null;activeArtifact.current=append('assistant',output.reply_text,{result:output,...(action?{action}:{})});
  }catch(e){if(alive.current&&version===generation.current&&!e.cancelled){setPhase('error');const output=message(e.message||'这次操作没能完成，请重试。');setResult(output);append('assistant',output.reply_text);}}
  finally{if(alive.current&&(version===generation.current||!lock.current)){lock.current=false;setPending(false);}}
 }
 return {context,messages,result,pending,phase,mediaProgress,ownerIdentity:listingIdentity,workflowProgress,pendingWorkflow,resumeWorkflow,durableTask,resumeDurableTask,recentTasks,openSavedTask,conversationOpen,openConversation:()=>setConversationOpen(true),closeConversation:()=>setConversationOpen(false),storageFailed,remember,recordTask,capturePreview,reopen,reset,send:run};
}
