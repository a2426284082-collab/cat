import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {previewControl,resolveCatReferences,mergeMatchNeed,readAgentSession,writeAgentSession,AGENT_STORAGE,AGENT_TTL,validateAgentPlan} from './agent.js';
import {normalizeId} from './presentation.js';
import {answerHandbook} from '../../cloud-functions/_lib/sales-handbook.js';
export const AgentContext=createContext(null);
export const useAgentContext=()=>useContext(AgentContext);
const empty=()=>({task:'help',cat_ids:[],params:{},need:''}),paid=new Set(['match','praise','price','compare']);
const message=text=>({kind:'tool',used_ai:false,matched_ids:[],reply_text:text});
export function useWorkspaceAgent({cats,session,execute,onReset}){
 const {ask,epoch,listingIdentity,checking}=session,[context,setContext]=useState(empty),[messages,setMessages]=useState([]),[result,setResult]=useState(null),[pending,setPending]=useState(false),[storageFailed,setStorageFailed]=useState(false),[conversationOpen,setConversationOpen]=useState(false),[phase,setPhase]=useState('idle');
 const state=useRef({context,messages}),owner=useRef(null),generation=useRef(0),lock=useRef(false),alive=useRef(true),priorEpoch=useRef(epoch),lastTouch=useRef(Date.now());state.current={context,messages};const renderedOwner=owner.current;
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[]);
 function remember(patch){lastTouch.current=Date.now();setContext(old=>{const next={...old,...patch,cat_ids:(patch.cat_ids??old.cat_ids).map(normalizeId).slice(0,9)};return JSON.stringify(next)===JSON.stringify(old)?old:next;});}
 function reset(){generation.current++;lock.current=false;setPending(false);setConversationOpen(false);setPhase('idle');setContext(empty());setMessages([]);setResult(null);onReset?.();try{if(owner.current)sessionStorage.removeItem(AGENT_STORAGE+owner.current);}catch{}}
 useEffect(()=>{
  if(checking)return;const next=listingIdentity,prior=owner.current;
  if(prior===next)return;
  owner.current=next;
  // Explicit activation may finish the pending guest request; keep that one flow intact.
  if(prior?.startsWith('device:')&&next.startsWith('sales:'))return;
  if(prior){generation.current++;lock.current=false;setPending(false);setConversationOpen(false);setResult(null);try{sessionStorage.removeItem(AGENT_STORAGE+prior);}catch{}}
  let saved;try{saved=readAgentSession(sessionStorage,next);}catch{}
  if(saved){setContext(saved.context);setMessages(saved.messages);}else if(prior){setContext(empty());setMessages([]);}
 },[listingIdentity,checking]);
 useEffect(()=>{if(priorEpoch.current!==epoch){priorEpoch.current=epoch;generation.current++;lock.current=false;setPending(false);setConversationOpen(false);setPhase('idle');setContext(empty());setMessages([]);setResult(null);}},[epoch]);
 useEffect(()=>{if(!checking&&owner.current===listingIdentity&&renderedOwner===listingIdentity){try{setStorageFailed(!writeAgentSession(sessionStorage,listingIdentity,{context,messages}));}catch{setStorageFailed(true);}}},[context,messages,listingIdentity,checking]);
 function append(role,text){setMessages(old=>[...old,{role,text:String(text).slice(0,600)}].slice(-16));}
 async function perform(plan,text,version,serverResult,semantic=false){
  if(plan.tool==='reset'){reset();return message('已开始新任务。下一位客户的需求不会沿用上一位。');}
  if(plan.tool==='chat')return message(plan.message||'你可以继续说客户的情况，我会帮你整理下一步。');
  if(plan.tool==='help'&&plan.message)return message(plan.message);
  if(plan.tool==='help')return message('我能挑猫、做2至9图拼图、写单猫或双猫话术、看资料、准备素材下载、算报价和查手册。可以接着说“换成四只”“不要价格”“看第二只”；说“新任务”清空这次上下文。');
  if(plan.tool==='clarify')return message(plan.message||'请补充需要操作的猫咪编号或具体任务。');
  if(plan.tool==='handbook'&&!/打开.*手册|去.*手册|查看手册/.test(plan.query||text)){const answer=answerHandbook(plan.query||text);if(answer){remember({task:'handbook'});return answer;}}
  if(paid.has(plan.tool)){
   if(semantic){if(plan.tool==='match')setConversationOpen(false);if(!serverResult)throw new Error('任务结果不完整，未重复调用AI。');if(serverResult.used_ai)remember({task:plan.tool,cat_ids:(serverResult.matched_ids||[]).map(normalizeId),need:plan.tool==='match'?(plan.query||text):state.current.context.need,params:{},focus_id:null});return serverResult;}
   const refs=plan.cat_ids?.length?plan.cat_ids:state.current.context.focus_id?[state.current.context.focus_id]:state.current.context.cat_ids,need=mergeMatchNeed(state.current.context.need,plan.query||text,cats,state.current.context.cat_ids);
   if(plan.tool!=='match'&&refs.length!==(plan.tool==='compare'?2:1))return message(plan.tool==='compare'?'请明确选择两只猫，或输入两个短编号。':'请明确是哪一只猫，例如“给 #017 写保价话术”。');
   const payload=plan.tool==='match'?{mode:'match',prompt:need,hide_prices:session.hidePrices}:{mode:'script',action:plan.tool,cat_ids:refs,hide_prices:session.hidePrices};
   const taskRevision=JSON.stringify(state.current.context),output=await ask(payload);if(version!==generation.current)return null;if(JSON.stringify(state.current.context)!==taskRevision)return message('请求期间任务已经变化，原结果未覆盖当前任务；本次模型请求的扣次以工号显示为准。');
   if(plan.tool==='match')setConversationOpen(false);
   remember({task:plan.tool,cat_ids:(output.matched_ids||[]).map(normalizeId),need:plan.tool==='match'?need:state.current.context.need,params:{},focus_id:null});return output;
  }
  setPhase('executing');setConversationOpen(false);
  const output=await execute(plan,state.current.context,{caption:serverResult?.kind==='marketing_copy'?serverResult.reply_text:undefined});
  if(version!==generation.current)return null;if(output?.context)remember(output.context);return output?.result||message(output?.text||'已打开对应工具。');
 }
 async function run(text,{source='free',tool}={}){
  text=String(text||'').trim().slice(0,200);if(lock.current||!text)return;if(Date.now()-lastTouch.current>AGENT_TTL){reset();state.current={context:empty(),messages:[]};}lastTouch.current=Date.now();lock.current=true;setPending(true);setPhase('understanding');const version=generation.current;append('user',text);
  try{
   let plan,serverResult;const quick=source==='quick'&&tool==='match';
   if(/^(新客户|新任务|重新开始|清空对话|开始新对话)[。!！\s]*$/.test(text))plan={tool:'reset',cat_ids:[],params:{}};
   else if(/^(你好|谢谢|感谢|好的|收到)[。!！\s]*$/.test(text))plan={tool:'help',cat_ids:[],params:{}};
   else if(previewControl(text,state.current.context))plan=previewControl(text,state.current.context);
   else if(quick){if(/【\s*(?:#\s*)?】/.test(text))plan={tool:'clarify',cat_ids:[],params:{},message:'填好模板里的客户信息后再发送，也可以切换自由输入直接描述。'};else plan={tool:'match',cat_ids:[],params:{},query:text};}
   else{
    const c=state.current.context,refs=resolveCatReferences(text,cats,c);
    if(refs.unknown.length)plan={tool:'clarify',cat_ids:[],params:{},message:'没有找到 '+refs.unknown.join('、')+'，请核对编号，或先选猫。'};
    else{
     const fingerprint=JSON.stringify(c),agent_context={task:c.task||'help',cat_ids:c.cat_ids||[],reference_ids:refs.ids,focus_id:c.focus_id||null,quotes:c.quotes||{},need:c.need||'',params:c.params||{},recent_users:state.current.messages.filter(r=>r.role==='user').slice(-2).map(r=>r.text.slice(0,80))};
     const response=await ask({mode:'match',action:'agent_run',prompt:text,agent_context,hide_prices:session.hidePrices});if(version!==generation.current||!alive.current)return;
     if(JSON.stringify(state.current.context)!==fingerprint){const output=message('操作期间任务已变化，原指令未覆盖当前内容。请按现在的预览继续；本次计次以工号显示为准。');setResult(output);append('assistant',output.reply_text);return;}
     if(response.kind!=='agent_run')throw new Error('助手接口版本不一致，请确认前后端已一起更新。');
     plan=validateAgentPlan(response.plan,new Set(cats.map(c=>normalizeId(c.id))));serverResult=response.result;
    }
   }
   const output=await perform(plan,text,version,serverResult,!quick);if(!output||!alive.current||plan.tool!=='reset'&&version!==generation.current)return;
   setPhase('done');setResult(output);append('assistant',output.reply_text);
  }catch(e){if(alive.current&&version===generation.current&&!e.cancelled){setPhase('error');const output=message(e.message||'这次操作没能完成，请重试。');setResult(output);append('assistant',output.reply_text);}}
  finally{if(alive.current&&(version===generation.current||!lock.current)){lock.current=false;setPending(false);}}
 }
 return {context,messages,result,pending,phase,conversationOpen,openConversation:()=>setConversationOpen(true),closeConversation:()=>setConversationOpen(false),storageFailed,remember,reset,send:run};
}
