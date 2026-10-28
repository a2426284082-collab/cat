import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {localAgentPlan,mergeMatchNeed,readAgentSession,writeAgentSession,AGENT_STORAGE,AGENT_TTL,validateAgentPlan} from './agent.js';
import {normalizeId} from './presentation.js';
import {answerHandbook} from '../../cloud-functions/_lib/sales-handbook.js';
export const AgentContext=createContext(null);
export const useAgentContext=()=>useContext(AgentContext);
const empty=()=>({task:'help',cat_ids:[],params:{},need:''}),paid=new Set(['match','praise','price','compare']);
const message=text=>({kind:'tool',used_ai:false,matched_ids:[],reply_text:text});
export function useWorkspaceAgent({cats,session,execute,onReset}){
 const {ask,epoch,listingIdentity,checking}=session,[context,setContext]=useState(empty),[messages,setMessages]=useState([]),[result,setResult]=useState(null),[pending,setPending]=useState(false),[queued,setQueued]=useState(null),[storageFailed,setStorageFailed]=useState(false);
 const state=useRef({context,messages}),owner=useRef(null),generation=useRef(0),lock=useRef(false),alive=useRef(true),priorEpoch=useRef(epoch),lastTouch=useRef(Date.now());state.current={context,messages};const renderedOwner=owner.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
 function remember(patch){lastTouch.current=Date.now();setContext(old=>{const next={...old,...patch,cat_ids:(patch.cat_ids??old.cat_ids).map(normalizeId).slice(0,9)};return JSON.stringify(next)===JSON.stringify(old)?old:next;});}
 function reset(){generation.current++;lock.current=false;setPending(false);setContext(empty());setMessages([]);setResult(null);setQueued(null);onReset?.();try{if(owner.current)sessionStorage.removeItem(AGENT_STORAGE+owner.current);}catch{}}
 useEffect(()=>{
  if(checking)return;const next=listingIdentity,prior=owner.current;
  if(prior===next)return;
  owner.current=next;
  // Explicit activation may finish the pending guest request; keep that one flow intact.
  if(prior?.startsWith('device:')&&next.startsWith('sales:'))return;
  if(prior){generation.current++;lock.current=false;setPending(false);setResult(null);setQueued(null);try{sessionStorage.removeItem(AGENT_STORAGE+prior);}catch{}}
  let saved;try{saved=readAgentSession(sessionStorage,next);}catch{}
  if(saved){setContext(saved.context);setMessages(saved.messages);}else if(prior){setContext(empty());setMessages([]);}
 },[listingIdentity,checking]);
 useEffect(()=>{if(priorEpoch.current!==epoch){priorEpoch.current=epoch;generation.current++;lock.current=false;setPending(false);setContext(empty());setMessages([]);setResult(null);setQueued(null);}},[epoch]);
 useEffect(()=>{if(!checking&&owner.current===listingIdentity&&renderedOwner===listingIdentity){try{setStorageFailed(!writeAgentSession(sessionStorage,listingIdentity,{context,messages}));}catch{setStorageFailed(true);}}},[context,messages,listingIdentity,checking]);
 function append(role,text){setMessages(old=>[...old,{role,text:String(text).slice(0,600)}].slice(-16));}
 async function perform(plan,text,version){
  if(plan.tool==='reset'){reset();return message('已开始新任务。下一位客户的需求不会沿用上一位。');}
  if(plan.tool==='help')return message('我能挑猫、做2至9图拼图、写单猫或双猫话术、看资料、准备素材下载、算报价和查手册。可以接着说“换成四只”“不要价格”“看第二只”；说“新任务”清空这次上下文。');
  if(plan.tool==='clarify')return message(plan.message||'请补充需要操作的猫咪编号或具体任务。');
  if(plan.tool==='handbook'&&!/打开.*手册|去.*手册|查看手册/.test(plan.query||text)){const answer=answerHandbook(plan.query||text);if(answer){remember({task:'handbook'});return answer;}}
  if(paid.has(plan.tool)){
   const refs=plan.cat_ids?.length?plan.cat_ids:state.current.context.focus_id?[state.current.context.focus_id]:state.current.context.cat_ids,need=mergeMatchNeed(state.current.context.need,plan.query||text,cats,state.current.context.cat_ids);
   if(plan.tool!=='match'&&refs.length!==(plan.tool==='compare'?2:1))return message(plan.tool==='compare'?'请明确选择两只猫，或输入两个短编号。':'请明确是哪一只猫，例如“给 #017 写保价话术”。');
   const payload=plan.tool==='match'?{mode:'match',prompt:need,hide_prices:session.hidePrices}:{mode:'script',action:plan.tool,cat_ids:refs,hide_prices:session.hidePrices};
   const taskRevision=JSON.stringify(state.current.context),output=await ask(payload);if(version!==generation.current)return null;if(JSON.stringify(state.current.context)!==taskRevision)return message('请求期间任务已经变化，原结果未覆盖当前任务；本次模型请求的扣次以工号显示为准。');
   remember({task:plan.tool,cat_ids:(output.matched_ids||[]).map(normalizeId),need:plan.tool==='match'?need:state.current.context.need,params:{},focus_id:null});return output;
  }
  const output=await execute(plan,state.current.context);
  if(version!==generation.current)return null;if(output?.context)remember(output.context);return output?.result||message(output?.text||'已打开对应工具。');
 }
 async function run(text,{model=false,approvedPlan}={}){
  text=String(text||'').trim().slice(0,200);if(lock.current||!text)return;if(Date.now()-lastTouch.current>AGENT_TTL){reset();state.current={context:empty(),messages:[]};}lastTouch.current=Date.now();lock.current=true;setPending(true);setQueued(null);const version=generation.current;append('user',text);
  try{
   let plan=approvedPlan||localAgentPlan(text,cats,state.current.context);
   if(model||plan.tool==='understand'){
    const c=state.current.context,taskRevision=JSON.stringify(c),agent_context={task:c.task||'help',cat_ids:c.cat_ids||[],need:c.need||'',params:c.params||{},recent_users:state.current.messages.filter(r=>r.role==='user').slice(-3).map(r=>r.text.slice(0,120))};
    const response=await ask({mode:'match',action:'agent_plan',prompt:text,agent_context});if(version!==generation.current||!alive.current)return;if(JSON.stringify(state.current.context)!==taskRevision){const output=message('当前任务已经变化，识别结果未执行，请按新任务重新描述。');setResult(output);append('assistant',output.reply_text);return;}
    plan=validateAgentPlan(response.plan,new Set(cats.map(c=>normalizeId(c.id))));
    // A planner request never cascades into a second billed model request.
    if(paid.has(plan.tool)||plan.params?.operation==='generate'){
     setQueued({plan,text:plan.query||text});const output=message('已理解任务。进一步生成AI话术还需1次，等冷却结束后可点击“执行已识别任务”；也可以直接调整本地工具。');setResult(output);append('assistant',output.reply_text);return;
    }
   }
   const output=await perform(plan,text,version);if(!output||!alive.current||plan.tool!=='reset'&&version!==generation.current)return;
   setResult(output);append('assistant',output.reply_text);
  }catch(e){if(alive.current&&version===generation.current&&!e.cancelled){const output=message(e.message||'这次操作没能完成，请重试。');setResult(output);append('assistant',output.reply_text);}}
  finally{if(alive.current&&(version===generation.current||!lock.current)){lock.current=false;setPending(false);}}
 }
 return {context,messages,result,pending,queued,storageFailed,remember,reset,send:run,executeQueued:()=>queued&&run(queued.text,{approvedPlan:queued.plan})};
}
