// Dedicated intelligent cat finder. The previous cross-tool coordinator is
// intentionally disconnected from this chat entry, not deleted from the repo.
import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {normalizeId} from './presentation.js';
import {isSalesStatsQuestion} from '../../cloud-functions/_lib/sales-language.js';
export const AgentContext=createContext(null);
export const useAgentContext=()=>useContext(AgentContext);
const KEY='cat-finder-only-v1:';
const ttl=30*60*1000;
const empty=()=>({task:'match',cat_ids:[],need:'',excluded_ids:[]});
const msg=(text)=>({kind:'tool',used_ai:false,matched_ids:[],reply_text:text});
const cleanIds=(ids,limit=9)=>Array.isArray(ids)?[...new Set(ids.map(normalizeId).filter(Boolean))].slice(0,limit):[];
const persisted=(id)=>{try{const state=JSON.parse(sessionStorage.getItem(KEY+id)||'null');if(!state||Date.now()-state.at>ttl||state.at>Date.now()+60000)return null;return state;}catch{return null;}};
export function useWorkspaceAgent({cats,session}){
 const {ask,epoch,listingIdentity,checking,markup,hidePrices}=session;
 const [context,setContext]=useState(empty),[messages,setMessages]=useState([]),[result,setResult]=useState(null),[pending,setPending]=useState(false),[phase,setPhase]=useState('idle'),[conversationOpen,setConversationOpen]=useState(false),[storageFailed,setStorageFailed]=useState(false);
 const current=useRef({context,messages}),owner=useRef(null),generation=useRef(0),lock=useRef(false),epochRef=useRef(epoch),live=useRef(true);
 current.current={context,messages};
 useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++;};},[]);
 useEffect(()=>{
  if(checking||!listingIdentity||owner.current===listingIdentity)return;
  const prior=owner.current;owner.current=listingIdentity;generation.current++;lock.current=false;
  if(prior?.startsWith('device:')&&listingIdentity.startsWith('sales:'))return;
  const saved=persisted(listingIdentity);const next=saved?.context&&typeof saved.context==='object'?{
   task:'match',cat_ids:cleanIds(saved.context.cat_ids),need:String(saved.context.need||'').slice(0,4000),excluded_ids:cleanIds(saved.context.excluded_ids,32)
  }:empty();
  current.current={context:next,messages:Array.isArray(saved?.messages)?saved.messages.slice(-16):[]};
  setContext(next);setMessages(current.current.messages);setResult(saved?.result||null);setPending(false);setPhase('idle');setConversationOpen(false);
 },[listingIdentity,checking]);
 useEffect(()=>{if(epochRef.current!==epoch){epochRef.current=epoch;generation.current++;lock.current=false;current.current={context:empty(),messages:[]};setContext(empty());setMessages([]);setResult(null);setPending(false);setPhase('idle');}},[epoch]);
 useEffect(()=>{if(checking||owner.current!==listingIdentity||!listingIdentity)return;
  try{sessionStorage.setItem(KEY+listingIdentity,JSON.stringify({at:Date.now(),context,messages:messages.slice(-16),result}));setStorageFailed(false);}catch{setStorageFailed(true);}
 },[context,messages,result,checking,listingIdentity]);
 function reset(){generation.current++;lock.current=false;const next=empty();current.current={context:next,messages:[]};setContext(next);setMessages([]);setResult(null);setPending(false);setPhase('idle');setConversationOpen(false);try{if(owner.current)sessionStorage.removeItem(KEY+owner.current);}catch{}}
 function append(role,text,extra={}){const item={id:crypto.randomUUID(),role,text:String(text||'').slice(0,8000),...extra};setMessages(old=>{const rows=[...old,item].slice(-16);current.current={...current.current,messages:rows};return rows;});return item;}
 async function send(input){const text=String(input||'').trim();if(!text||lock.current)return;
  if([...text].length>4000){setResult(msg('最多输入4000字找猫需求。'));return;}
  if(/^(?:新客户|新任务|重新开始|清空对话|开始新对话)[\s。!！]*$/.test(text)){reset();return;}
  lock.current=true;const version=++generation.current;setPending(true);setPhase('understanding');setConversationOpen(true);append('user',text);
  try{
   // The previous inventory result already has a real screening audit. A
   // follow-up asking about its counts needs neither Feishu nor an AI call.
   // Label these as PREVIOUS counts; a new search is required to refresh them.
   if(isSalesStatsQuestion(text)){
    const last=[...current.current.messages].reverse().find(row=>row?.role==='assistant'&&row.result?.stats&&Number.isInteger(row.result.stats.eligible))?.result;
    const stats=last?.stats;
    if(stats){
     const female=Number(stats.female??0),male=Number(stats.male??0),unknown=Number(stats.unknown??0);
     const explanation=`根据上一次找猫筛选记录：库存共${stats.total}只，满足全部硬条件${stats.eligible}只，其中母猫${female}只、公猫${male}只、性别未知${unknown}只。这是当时的合格候选统计，不代表库存中只有${female}只母猫。母猫优先属于排序偏好，原先没有推荐合格母猫也不能简单归因为“母猫少”。如果刚修改过筛选逻辑或库存，请重新提交找猫要求，再以新结果核对。`;
     const cached={kind:'cat_only',used_ai:false,matched_ids:last.matched_ids||[],reply_text:explanation,stats};
     setResult(cached);append('assistant',explanation,{result:cached});setPhase('done');return;
    }
   }

   const old=current.current.context;
   // No agent_autopilot/agent_run, no browser tool dispatcher and no popup.
   const response=await ask({mode:'match',action:'cat_only',prompt:text,hide_prices:hidePrices===true,
    cat_context:{cat_ids:old.cat_ids||[],need:old.need||'',excluded_ids:old.excluded_ids||[],markup:Number(markup??0)}});
   if(version!==generation.current||!live.current)return;
   // Record the exact quoted markup, so later price changes cannot make old selections appear current.
   const pricedResponse={...response,applied_markup:Number(markup??0)};
   if(response.cat_context){const next={task:'match',cat_ids:cleanIds(response.cat_context.cat_ids),need:String(response.cat_context.need||'').slice(0,4000),excluded_ids:Array.isArray(response.cat_context.excluded_ids)?cleanIds(response.cat_context.excluded_ids,32):[]};current.current={...current.current,context:next};setContext(next);}
   setResult(pricedResponse);append('assistant',response.reply_text,{result:pricedResponse,action:response.matched_ids?.length?{tool:'match',context:{task:'match',cat_ids:cleanIds(response.matched_ids),need:response.cat_context?.need||old.need,params:{}}}:undefined});setPhase('done');
  }catch(e){if(version===generation.current&&live.current&&!e.cancelled){const output=msg(e.message||'找猫失败，请重新试一次。');setResult(output);append('assistant',output.reply_text);setPhase('error');}}
  finally{if(version===generation.current&&live.current){lock.current=false;setPending(false);}}
 }
 function reopen(row){if(!row?.result)return;setResult(row.result);setConversationOpen(true);}
 // Manual tools remain independent: they do not modify the chat's selection,
 // receive agent directives or appear in the cat-finder conversation.
 function remember(){return current.current.context;}
 function recordTask(){}
 function capturePreview(){}
 return {context,messages,result,pending,phase,mediaProgress:null,ownerIdentity:listingIdentity,
  workflowProgress:[],pendingWorkflow:null,durableTask:null,recentTasks:[],storageFailed,
  conversationOpen,openConversation:()=>setConversationOpen(true),closeConversation:()=>setConversationOpen(false),
  reopen,remember,recordTask,capturePreview,reset,send,resumeWorkflow:()=>{},resumeDurableTask:()=>{},openSavedTask:()=>{}};
}
