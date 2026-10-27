import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Copy, ImageOff, LogOut, ShieldCheck, Sparkles, X } from 'lucide-react';
import './sales-ai.css';
import {isHandbookQuestion} from '../../cloud-functions/_lib/sales-intent.js';

const quickCommands=[
  ['🎯','预算+品种挑猫','match','客户预算【 】元，想看【 】品种，要求【 】'],
  ['✨','夸单只猫骨相','script','猫咪编号【# 】，客户喜欢甜美圆脸，请介绍这只猫已知的骨相和品相优势'],
  ['⚖️','两只猫对比','script','客户在纠结编号【# 】和【# 】两只猫，请对比已知优缺点帮他做决定'],
  ['📖','查合作与售后','match','合作流程和售后问题应该怎么处理？'],
  ['💰','嫌贵保价话术','script','客户看中编号【# 】，但觉得价格超预算了，请生成高情商保价和推荐话术'],
];
const normalizeId=value=>String(value||'').replace(/^#+\s*/,'').trim().toUpperCase();
function deviceId(){
  try {
    let value=localStorage.getItem('sales-device-id');
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value||'')){
      value=crypto.randomUUID();localStorage.setItem('sales-device-id',value);
    }
    return value;
  } catch {throw new Error('请允许网站保存设备标识后再激活');}
}
export async function salesApi(path,options={}){
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
  const result=await response.json().catch(()=>({}));
  if(!response.ok)throw Object.assign(new Error(result.message||'服务暂时不可用，请稍后重试'),{status:response.status,retry_after:result.retry_after,user:result.user});
  return result;
}
export default function SalesAI({cats=[],onDetail,command,active=true}){
  const [prompt,setPrompt]=useState(''),[mode,setMode]=useState('match'),[user,setUser]=useState(null),[checking,setChecking]=useState(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[cooldown,setCooldown]=useState(0);
  const [undo,setUndo]=useState(null);
  const [activateOpen,setActivateOpen]=useState(false),[code,setCode]=useState(''),[activationError,setActivationError]=useState(''),[activating,setActivating]=useState(false),[copied,setCopied]=useState(false);
  const input=useRef(null),keyInput=useRef(null),resultRef=useRef(null),pendingSend=useRef(false),sending=useRef(false),activationBusy=useRef(false),copyTimer=useRef(null);
  const activeRef=useRef(active);activeRef.current=active;
  useEffect(()=>{
    if(!command?.id)return;
    if(prompt.trim())setUndo({prompt,mode,result});else setUndo(null);
    setPrompt(command.prompt.slice(0,200));setMode(command.mode||'script');setResult(null);setError('');
    requestAnimationFrame(()=>{if(activeRef.current)input.current?.focus({preventScroll:true});});
  },[command?.id]);
  useEffect(()=>{
    const controller=new AbortController();
    salesApi('/api/ai/session',{signal:controller.signal}).then(r=>{setUser(r.user);setCooldown(r.user.retry_after||0);}).catch(e=>{if(e.name!=='AbortError'&&e.status!==401)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setChecking(false);});
    return()=>{controller.abort();clearTimeout(copyTimer.current);};
  },[]);
  useEffect(()=>{
    const refresh=()=>{if(document.hidden||sending.current||!activeRef.current)return;salesApi('/api/ai/session').then(r=>{if(!sending.current){setUser(r.user);setCooldown(r.user.retry_after||0);}}).catch(e=>{if(e.status===401&&!sending.current)setUser(null);});};
    const timer=setInterval(refresh,60000);window.addEventListener('focus',refresh);
    return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);};
  },[]);
  useEffect(()=>{if(!cooldown)return;const timer=setTimeout(()=>setCooldown(c=>Math.max(0,c-1)),1000);return()=>clearTimeout(timer);},[cooldown]);
  useEffect(()=>{if(!activateOpen)return;const old=document.activeElement;keyInput.current?.focus();const close=e=>{if(e.key==='Escape'&&!activationBusy.current){setActivateOpen(false);pendingSend.current=false;}};window.addEventListener('keydown',close);return()=>{window.removeEventListener('keydown',close);old?.focus();};},[activateOpen]);
  async function send(activated=false){
    if(sending.current||(!isHandbookQuestion(prompt)&&cooldown)||!prompt.trim()||checking)return;
    if(!user&&!activated){pendingSend.current=true;setActivationError('');setActivateOpen(true);return;}
    sending.current=true;setBusy(true);setError('');setCopied(false);setResult(null);
    try{
      const response=await salesApi('/api/ai/ask',{method:'POST',body:JSON.stringify({device_id:deviceId(),mode,prompt:prompt.trim()})});
      setUser(response.user);setCooldown(response.user?.retry_after||0);setResult({...response.data,updatedAt:response.catalog_updated_at});
      requestAnimationFrame(()=>{if(activeRef.current)resultRef.current?.scrollIntoView({behavior:'smooth',block:'nearest'});});
    }catch(e){
      setError(e.message);if(e.user)setUser(e.user);if(e.retry_after)setCooldown(e.retry_after);
      if(e.status===401){setUser(null);setActivationError('登录已失效，请重新输入激活码');pendingSend.current=false;setActivateOpen(true);}
    }finally{sending.current=false;setBusy(false);}
  }
  async function activate(e){
    e.preventDefault();if(activationBusy.current)return;activationBusy.current=true;setActivating(true);setActivationError('');
    try{
      const response=await salesApi('/api/ai/activate',{method:'POST',body:JSON.stringify({key_code:code,device_id:deviceId()})});
      setUser(response.user);setCooldown(response.user?.retry_after||0);setCode('');setActivateOpen(false);setError('');
      if(pendingSend.current){pendingSend.current=false;await send(true);}
    }catch(reason){setActivationError(reason.message);}
    finally{activationBusy.current=false;setActivating(false);}
  }
  async function logout(){
    if(busy)return;
    try{await salesApi('/api/ai/logout',{method:'POST',body:JSON.stringify({device_id:deviceId()})});setUser(null);setResult(null);setPrompt('');setUndo(null);}
    catch(e){if(e.status===401){setUser(null);setResult(null);setPrompt('');setUndo(null);}else setError(e.message);}
  }
  async function copy(){try{await navigator.clipboard.writeText(result.reply_text);setCopied(true);clearTimeout(copyTimer.current);copyTimer.current=setTimeout(()=>setCopied(false),2200);}catch{setError('复制失败，请长按选择下方话术复制');}}
  const matched=(result?.matched_ids||[]).map(id=>cats.find(cat=>normalizeId(cat.id)===normalizeId(id))).filter(Boolean);
  return <section className="sales-ai" aria-label="AI销售导购助手">
    <div className="sales-ai-heading"><span className="sales-ai-eyebrow"><Sparkles size={13}/> 销售专属 · AI 导购助手</span><h2>把客户需求变成 <span>销冠方案 <Sparkles aria-hidden="true"/></span></h2><p>从在售猫源挑选，让每次推荐都有据可依</p></div>
    {undo&&<div className="workspace-ai-undo"><span>已带入猫咪编号和话术模板</span><button type="button" disabled={busy} onClick={()=>{setPrompt(undo.prompt);setMode(undo.mode);setResult(undo.result);setUndo(null);}}>恢复上一份草稿</button></div>}
    <div className="sales-ai-glow"><div className="sales-ai-composer">
      <label htmlFor="sales-ai-prompt" className="sr-only">客户需求或猫咪编号</label>
      <textarea id="sales-ai-prompt" ref={input} maxLength={200} value={prompt} onChange={e=>setPrompt(e.target.value.slice(0,200))} disabled={busy} placeholder="描述客户需求或点击下方胶囊，AI 帮你快速从在售库挑猫并生成微信推荐话术"/>
      <div className="sales-ai-toolbar"><div className="sales-ai-modes" role="group" aria-label="导购模式">{[['match','⚡ 秒配猫'],['script','💬 写话术']].map(([id,label])=><button type="button" key={id} aria-pressed={mode===id} className={mode===id?'active':''} onClick={()=>setMode(id)} disabled={busy}>{label}</button>)}</div>
        <div className="sales-ai-controls"><span className="sales-ai-count">{prompt.length}/200</span><button type="button" onClick={()=>{pendingSend.current=false;setActivationError('');setActivateOpen(true);}} className="sales-ai-account" disabled={busy}>{checking?'检查授权中…':user?`工号: ${user.sales_name} / 剩余: ${user.remaining} 次`:'工号: 未激活 / 剩余: -- 次'}</button>{user&&<button type="button" title="退出销售账号" aria-label="退出销售账号" onClick={logout} disabled={busy} className="sales-ai-logout"><LogOut size={14}/></button>}<button type="button" className="sales-ai-send" aria-label={cooldown&&!isHandbookQuestion(prompt)?`请等待${cooldown}秒`:'发送客户需求'} disabled={busy||checking||(!isHandbookQuestion(prompt)&&cooldown>0)||!prompt.trim()||(!isHandbookQuestion(prompt)&&user?.remaining===0)} onClick={()=>send()}>{busy?<span className="sales-ai-spinner"/>:cooldown&&!isHandbookQuestion(prompt)?<span>{cooldown}s</span>:<ArrowUp size={21}/>}</button></div>
      </div>
    </div></div>
    <div className="sales-ai-quick">{quickCommands.map(([emoji,label,nextMode,text])=><button type="button" key={label} disabled={busy} onClick={()=>{setMode(nextMode);setPrompt(text);input.current?.focus();}}><span>{emoji}</span>{label}</button>)}</div>
    <p className="sales-ai-tip"><ShieldCheck size={13}/> 激活后使用 · 每次独立生成 · 手册查询不扣次数 · 无匹配不扣次数 · 销售输入会记录供运营审核</p>
    {error&&<p role="alert" className="sales-ai-error">{error}</p>}
    {result&&<div ref={resultRef} className="sales-ai-result" aria-live="polite"><div className="sales-ai-result-title"><b><Sparkles size={16}/>{result.kind==='handbook'?'手册答疑':result.used_ai?'微信推荐话术':'选猫提示'}</b>{(result.used_ai||result.kind==='handbook')&&result.reply_text!=='指令无效'&&<button type="button" onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'已复制':result.kind==='handbook'?'复制答复':'一键复制微信话术'}</button>}</div><p className="sales-ai-reply">{result.reply_text}</p>{result.kind==='handbook'&&<div className="sales-ai-sources"><b>手册出处</b>{result.sources?.map(source=><a key={source.href+source.title} href={source.href}>{source.manual} · {source.title} ›</a>)}<small>手册原文查询，不消耗 AI 次数；具体订单约定请向负责人确认。</small></div>}
      {matched.length>0&&<div className="sales-ai-cats">{matched.map(cat=><button type="button" key={cat.id} onClick={()=>onDetail?.(cat)} className="sales-ai-cat">{cat.images?.[0]||cat.image?<img src={cat.images?.[0]||cat.image} alt={`${cat.breed} ${cat.id}`} loading="lazy"/>:<span className="sales-ai-noimage"><ImageOff size={22}/></span>}<span><b>#{normalizeId(cat.id)} · {cat.breed||'在售猫咪'}</b><small>{cat.gender||'性别待确认'} · {cat.color||'花色待确认'}</small><strong>{cat.price==null?'价格待确认':`¥${Number(cat.price).toLocaleString('zh-CN')}`}</strong></span><small className="sales-ai-detail">查看资料 ›</small></button>)}</div>}
      {result.matched_ids?.length>matched.length&&<p className="sales-ai-tip">部分猫咪未在当前列表中，请刷新猫源后核对编号。</p>}
      {result.used_ai&&<p className="sales-ai-tip">依据最近同步库生成，成交前请确认价格、库存及猫咪情况。</p>}
    </div>}
    {activateOpen&&<div className="sales-ai-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!activating){setActivateOpen(false);pendingSend.current=false;}}}><form className="sales-ai-modal" role="dialog" aria-modal="true" aria-labelledby="sales-activation-title" onSubmit={activate} onKeyDown={e=>{if(e.key==='Tab'){const nodes=[...e.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled)')];if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1)?.focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0]?.focus();}}}}><button className="sales-ai-close" aria-label="关闭激活窗口" type="button" disabled={activating} onClick={()=>{setActivateOpen(false);pendingSend.current=false;}}><X size={19}/></button><span className="sales-ai-modal-icon"><ShieldCheck size={25}/></span><h3 id="sales-activation-title">请输入内部销售激活码</h3><p>由运营分配，每个账号最多绑定两个浏览器。<br/>请勿外借；更换设备可联系运营重置。</p><label className="sr-only" htmlFor="sales-activation-code">销售激活码</label><input id="sales-activation-code" ref={keyInput} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={24} autoComplete="off" spellCheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" required disabled={activating}/>{activationError&&<p className="sales-ai-error" role="alert">{activationError}</p>}<button className="sales-ai-activate" disabled={activating||!code.trim()}>{activating?'验证中…':'激活并继续'}</button><small>激活码不会保存在浏览器本地存储中</small></form></div>}
  </section>;
}
