import AgentConversation from '../workspace/AgentConversation.jsx';
// ADMIN_CONTROL_PATCH_V1
import {useWorkbenchConfig} from '../workspace/WorkbenchConfig.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {ArrowUp,Check,Copy,ImageOff,Sparkles} from 'lucide-react';
import {useSalesSession} from '../workspace/SalesSession.jsx';
import {useAgentContext} from '../workspace/AgentContext.jsx';
import {displayText,money,normalizeId,shortIdMap,displayedPrice} from '../workspace/presentation.js';
import './sales-ai.css';
import SmartImage from '../workspace/SmartImage.jsx';
export {salesApi} from '../workspace/SalesSession.jsx';
const commands=[['🎯','粘贴客户需求挑猫','客户预算【 】元，想看【 】品种，要求【 】'],['🏠','推荐新手粘人猫','客户是第一次养猫的新手，预算【 】元左右，推荐两只性格温顺好养的猫'],['🔥','盘点今日高性价比捡漏','客户想找性价比高、品相甜美的捡漏小猫，请从库里挑2只最好卖的']];
export function AIResult({result,cats=[],hidePrices=false,customerDisplay={enabled:hidePrices,markup:0},onDetail}){
 const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState('');const timer=useRef(null);useEffect(()=>()=>clearTimeout(timer.current),[]);useEffect(()=>setCopied(false),[result,hidePrices]);if(!result)return null;
 const text=displayText(result.reply_text,cats,hidePrices),labels=shortIdMap(cats),matched=(result.matched_ids||[]).map(id=>cats.find(c=>normalizeId(c.id)===normalizeId(id))).filter(Boolean);
 async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),2200);}catch{setCopyError('复制失败，请手动选择文字复制。');}}
 return <div className="sales-ai-result" aria-live="polite"><div className="sales-ai-result-title"><b>{result.kind==='inventory'?'在售猫咪查询结果':result.kind==='handbook'?'手册答疑':result.kind==='tool'?'助手执行结果':result.kind==='copy'?'查库口令':result.used_ai?'微信推荐话术':'选猫提示'}</b>{(result.used_ai||result.kind==='handbook'||result.kind==='copy')&&result.reply_text!=='指令无效'&&<button onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'已复制':result.kind==='handbook'?'复制答复':result.kind==='copy'?'复制报单口令':'一键复制微信话术'}</button>}</div><p className="sales-ai-reply">{text}</p>{copyError&&<p role="alert">{copyError}</p>}{result.kind==='handbook'&&<div className="sales-ai-sources"><b>手册出处</b>{result.sources?.map(s=><a key={s.href+s.title} href={s.href}>{s.manual} · {s.title} ›</a>)}<small>手册查询不扣AI次数，具体订单约定请向负责人确认。</small></div>}{matched.length>0&&<div className="sales-ai-cats">{matched.map(cat=><button key={cat.id} onClick={()=>onDetail?.(cat)} className="sales-ai-cat">{cat.image?<SmartImage src={cat.image} retryable={false} alt={cat.breed||'猫咪'}/>:<span className="sales-ai-noimage"><ImageOff size={22}/></span>}<span><b>{labels.get(normalizeId(cat.id))} · {cat.breed}</b><small>{cat.gender} · {cat.color}</small>{displayedPrice(cat,customerDisplay)!=null&&<strong>{hidePrices?'售价 ':''}{money(displayedPrice(cat,customerDisplay))}</strong>}</span><small className="sales-ai-detail">查看资料 ›</small></button>)}</div>}</div>;
}
export default function SalesAI({cats=[],onDetail,hidePrices=false,customerDisplay={enabled:hidePrices,markup:0}}){
 const {config:workbenchConfig}=useWorkbenchConfig();
 const {user,checking,busy,cooldown,epoch}=useSalesSession(),agent=useAgentContext();const [prompt,setPrompt]=useState(''),[quickTask,setQuickTask]=useState(null);const input=useRef(null),hadConversation=useRef(false);
 useEffect(()=>{setPrompt('');setQuickTask(null);},[epoch]);
 useEffect(()=>{if(!agent.messages.length&&hadConversation.current)setPrompt('');hadConversation.current=agent.messages.length>0;},[agent.messages.length]);
 async function send(e){e.preventDefault();agent.openConversation();await agent.send(prompt,quickTask?{source:'quick',tool:'match'}:{});}
 const context=agent.context,taskLabel=context.task==='poster'?`${context.cat_ids.length}只猫的拼图`:context.cat_ids.length?`${context.cat_ids.length}只已选猫咪`:'销售任务';
 return <section className="sales-ai sales-ai-compact" aria-label="销售工具助手"><div className="sales-ai-heading"><h2>{workbenchConfig.heroTitle} <span>{workbenchConfig.heroHighlight} <Sparkles aria-hidden="true"/></span></h2></div><form className="sales-ai-glow" onSubmit={send}><div className="sales-ai-composer"><label className="sr-only" htmlFor="sales-ai-prompt">客户选猫需求</label><textarea id="sales-ai-prompt" ref={input} rows={2} maxLength={200} value={prompt} onChange={e=>{const value=e.target.value.slice(0,200);setPrompt(value);if(quickTask&&!/客户预算【.*】元，想看【.*】品种，要求【.*】|客户是第一次养猫的新手，预算【.*】元左右，推荐两只性格温顺好养的猫|客户想找性价比高、品相甜美的捡漏小猫，请从库里挑2只最好卖的/.test(value))setQuickTask(null);}} disabled={agent.pending||busy} placeholder={workbenchConfig.aiPlaceholder}/><div className="sales-ai-toolbar">{quickTask&&<button type="button" className="agent-input-mode" onClick={()=>setQuickTask(null)}>快捷挑猫 · 切换自由输入</button>}<span className="sales-ai-count">{prompt.length}/200</span><button type="submit" className="sales-ai-send" aria-label="发送客户需求" disabled={agent.pending||busy||checking||!prompt.trim()}>{agent.pending||busy?<span className="sales-ai-spinner"/>:<ArrowUp size={21}/>}</button></div></div></form><div className="sales-ai-quick">{commands.map(([emoji,label,text])=><button aria-label={emoji+' '+label} key={label} disabled={agent.pending||busy} onClick={()=>{setQuickTask(label);setPrompt(text);input.current?.focus();}}><span>{emoji}</span>{({'粘贴客户需求挑猫':'需求挑猫','推荐新手粘人猫':'新手推荐','盘点今日高性价比捡漏':'高性价比'})[label]}</button>)}</div>
  <div className="agent-task-bar"><span>{context.task!=='help'?`接着处理：${taskLabel}`:'可连续处理当前任务'} · 快捷工具直接执行，自由指令理解并执行计1次{cooldown?` · AI冷却${cooldown}秒`:''}</span><button onClick={agent.reset}>新任务</button></div>
  {!agent.conversationOpen&&<AIResult result={agent.result} cats={cats} hidePrices={hidePrices} customerDisplay={customerDisplay} onDetail={onDetail}/>}

  {context.task==='poster'&&context.cat_ids.length>=2&&!agent.conversationOpen&&<button className="agent-open-conversation" disabled={agent.pending} onClick={()=>agent.reopen([...agent.messages].reverse().find(row=>row.action?.tool==='poster'))}>打开拼图预览</button>}
  {agent.messages.length>0&&!agent.conversationOpen&&<button className="agent-open-conversation" onClick={agent.openConversation}>打开对话继续处理</button>}
  {agent.conversationOpen&&<AgentConversation cats={cats} hidePrices={hidePrices} agent={agent} renderResult={()=> <AIResult result={agent.result} cats={cats} hidePrices={hidePrices} customerDisplay={customerDisplay} onDetail={cat=>{agent.closeConversation();onDetail?.(cat);}}/>}/>}
  {!agent.conversationOpen&&!hidePrices&&agent.messages.length>0&&<details className="agent-history"><summary>本次对话 · 最近{Math.ceil(agent.messages.length/2)}轮</summary><ol>{agent.messages.map((row,i)=><li key={i} className={row.role}><b>{row.role==='user'?'你':'助手'}</b><p>{displayText(row.text,cats,false)}</p></li>)}</ol><small>仅当前浏览器标签页保留，最多8轮，30分钟过期；新任务或退出账号会清空。发送模型时只带有限任务摘要。</small></details>}
  {agent.storageFailed&&<small className="agent-storage-warning">当前浏览器未保存会话，刷新后需要重新描述任务。</small>}
 </section>;
}
