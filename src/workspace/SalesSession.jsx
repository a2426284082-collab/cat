// Free guest cat-finder access; legacy seller activation remains optional.
import {useWorkbenchConfig} from './WorkbenchConfig.jsx';
import React,{createContext,useContext,useEffect,useRef,useState} from 'react';
import {LogOut,ShieldCheck,X} from 'lucide-react';
import {isHandbookQuestion} from '../../cloud-functions/_lib/sales-intent.js';
import {salesApi} from './sales-request.js';
export {salesApi} from './sales-request.js';
const Context=createContext(null);
let fallbackDevice=null;
function deviceId(){
 try{let id=localStorage.getItem('sales-device-id');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'')){id=crypto.randomUUID();localStorage.setItem('sales-device-id',id);}return id;}
 catch{fallbackDevice ||= crypto.randomUUID();return fallbackDevice;}
}
export function SalesSessionProvider({children}){
 const {config:workbenchConfig}=useWorkbenchConfig();
 const [browserId]=useState(()=>deviceId());
 const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false),[cooldown,setCooldown]=useState(0),[epoch,setEpoch]=useState(0);
 const [open,setOpen]=useState(false),[code,setCode]=useState(''),[error,setError]=useState(''),[activating,setActivating]=useState(false);
 const knownUser=useRef(null),lock=useRef(false),register=useRef(null),generation=useRef(0),keyInput=useRef(null);
 knownUser.current=user;
 const accept=account=>{setUser(account);setCooldown(account?.retry_after||0);};
 async function guest({signal}={}){
  if(register.current)return register.current;
  const job=salesApi('/api/ai/guest',{method:'POST',body:JSON.stringify({device_id:deviceId()}),signal}).then(r=>{accept(r.user);return r.user;});
  register.current=job;
  try{return await job;}finally{if(register.current===job)register.current=null;}
 }
 useEffect(()=>{
  let active=true;
  const controller=new AbortController();
  const deadline=setTimeout(()=>controller.abort(),12000);
  salesApi('/api/ai/session',{signal:controller.signal})
   .then(r=>{if(active)accept(r.user);})
   .catch(e=>{if(active&&e.status===401)return guest({signal:controller.signal});})
   .catch(()=>{})
   .finally(()=>{clearTimeout(deadline);if(active)setChecking(false);});
  const refresh=async()=>{
   if(document.hidden||lock.current||register.current)return;
   try{const r=await salesApi('/api/ai/session');if(active)accept(r.user);}
   catch(e){if(active&&e.status===401){try{await guest();if(active)setEpoch(v=>v+1);}catch{}}}
  };
  const timer=setInterval(refresh,60000);
  window.addEventListener('focus',refresh);
  return()=>{active=false;clearTimeout(deadline);controller.abort();clearInterval(timer);window.removeEventListener('focus',refresh);};
 },[]);
 useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(v=>Math.max(0,v-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
 useEffect(()=>{if(!open)return;const previous=document.activeElement;keyInput.current?.focus();const escape=e=>{if(e.key==='Escape')setOpen(false);};window.addEventListener('keydown',escape);return()=>{window.removeEventListener('keydown',escape);previous?.focus();};},[open]);
 async function execute(payload){
  if(lock.current)throw new Error('正在查询，请稍候');
  lock.current=true;setBusy(true);
  try{
   const action=payload.action;
   const task=['agent_autopilot','agent_next','agent_cancel'].includes(action);
   const op=action==='agent_autopilot'?'start':action==='agent_next'?'next':action==='agent_cancel'?'cancel':action;
   const response=await salesApi(task?'/api/ai/task':'/api/ai/ask',{method:'POST',body:JSON.stringify({...payload,action:op,device_id:deviceId()})});
   if(response.user)accept(response.user);
   return response.data;
  }catch(e){if(e.user)accept(e.user);if(e.retry_after)setCooldown(e.retry_after);if(e.status===401){accept(null);setEpoch(v=>v+1);}throw e;}
  finally{lock.current=false;setBusy(false);}
 }
 async function ask(payload){
  if(checking)throw new Error('正在连接找猫服务，请稍候');
  const local=payload.action==='catalog_match'||payload.action==='handbook'||(!payload.action&&isHandbookQuestion(payload.prompt));
  if(busy||lock.current)throw new Error('正在查询，请稍候');
  if(!local&&cooldown)throw new Error(`请等待${cooldown}秒后再试`);
  if(!knownUser.current)await guest();
  return execute(payload);
 }
 async function taskRead(id){if(!knownUser.current||knownUser.current.is_guest)return null;const response=await salesApi('/api/ai/task'+(id==='list'?'?list=1':id?'?task_id='+encodeURIComponent(id):''));return response.data;}
 async function activate(e){
  e.preventDefault();if(activating)return;setActivating(true);setError('');
  try{const response=await salesApi('/api/ai/activate',{method:'POST',body:JSON.stringify({key_code:code,device_id:deviceId()})});accept(response.user);setCode('');setOpen(false);setEpoch(v=>v+1);}
  catch(e){setError(e.message);}finally{setActivating(false);}
 }
 async function logout(){
  if(lock.current)return;
  try{await salesApi('/api/ai/logout',{method:'POST',body:JSON.stringify({device_id:deviceId()})});accept(null);setEpoch(v=>v+1);await guest();}
  catch(e){setError(e.message);}
 }
 return <Context.Provider value={{user,listingIdentity:user?.id!=null?`sales:${user.id}`:`device:${browserId}`,checking,busy,cooldown,epoch,ask,
  taskNext:()=>Promise.reject(new Error('旧版复杂任务已停用')),taskRead,taskCancel:async()=>null,logout,
  activate:()=>{setError('');setOpen(true);}}}>
  {children}
  {open&&<div className="sales-ai-overlay" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><form className="sales-ai-modal" role="dialog" aria-modal="true" aria-labelledby="sales-activation-title" onSubmit={activate}>
   <button className="sales-ai-close" aria-label="关闭登录窗口" type="button" disabled={activating} onClick={()=>setOpen(false)}><X size={19}/></button>
   <span className="sales-ai-modal-icon"><ShieldCheck size={25}/></span>
   <h3 id="sales-activation-title">销售账号登录（可选）</h3>
   <p>不登录也能免费找猫。已有销售账号可使用原激活码登录，享受管理员分配的额度。最多绑定{workbenchConfig.maxDevices}台浏览器。</p>
   <label className="sr-only" htmlFor="sales-activation-code">销售激活码</label>
   <input id="sales-activation-code" ref={keyInput} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={24} autoComplete="off" placeholder="XXXX-XXXX-XXXX-XXXX" required disabled={activating}/>
   {error&&<p className="sales-ai-error" role="alert">{error}</p>}
   <button className="sales-ai-activate" disabled={activating||!code.trim()}>{activating?'验证中…':'登录销售账号'}</button>
  </form></div>}
 </Context.Provider>;
}
export function useSalesSession(){const value=useContext(Context);if(!value)throw new Error('SalesSessionProvider missing');return value;}
export function SalesAccount(){
 const {user,checking,busy,activate,logout}=useSalesSession();
 return <div className="workspace-account"><button disabled={busy||checking} onClick={activate} aria-label="切换销售账号">
  <span>{checking?'正在连接…':user?.is_guest?'访客免费使用':user?.sales_name||'免费找猫'}</span>
  <b>今日剩余: {user?user.remaining:'--'}/{user?.daily_limit||15}</b>
  <small>{user?.is_guest?'有销售账号？可选登录':user?'切换销售账号':'无需激活码'}</small>
 </button>{user&&!user.is_guest&&<button onClick={logout} disabled={busy} aria-label="退出销售账号"><LogOut size={14}/>退出</button>}</div>;
}
