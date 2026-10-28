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
 return <div className="sales-ai-result" aria-live="polite"><div className="sales-ai-result-title"><b>{result.kind==='handbook'?'手册答疑':result.kind==='tool'?'助手执行结果':result.kind==='copy'?'查库口令':result.used_ai?'微信推荐话术':'选猫提示'}</b>{(result.used_ai||result.kind==='handbook'||result.kind==='copy')&&result.reply_text!=='指令无效'&&<button onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'已复制':result.kind==='handbook'?'复制答复':result.kind==='copy'?'复制报单口令':'一键复制微信话术'}</button>}</div><p className="sales-ai-reply">{text}</p>{copyError&&<p role="alert">{copyError}</p>}{result.kind==='handbook'&&<div className="sales-ai-sources"><b>手册出处</b>{result.sources?.map(s=><a key={s.href+s.title} href={s.href}>{s.manual} · {s.title} ›</a>)}<small>手册查询不扣AI次数，具体订单约定请向负责人确认。</small></div>}{matched.length>0&&<div className="sales-ai-cats">{matched.map(cat=><button key={cat.id} onClick={()=>onDetail?.(cat)} className="sales-ai-cat">{cat.image?<SmartImage src={cat.image} retryable={false} alt={cat.breed||'猫咪'}/>:<span className="sales-ai-noimage"><ImageOff size={22}/></span>}<span><b>{labels.get(normalizeId(cat.id))} · {cat.breed}</b><small>{cat.gender} · {cat.color}</small>{displayedPrice(cat,customerDisplay)!=null&&<strong>{hidePrices?'售价 ':''}{money(displayedPrice(cat,customerDisplay))}</strong>}</span><small className="sales-ai-detail">查看资料 ›</small></button>)}</div>}</div>;
}
export default function SalesAI({cats=[],onDetail,hidePrices=false,customerDisplay={enabled:hidePrices,markup:0}}){
 const {user,checking,busy,cooldown,epoch}=useSalesSession(),agent=useAgentContext();const [prompt,setPrompt]=useState('');const input=useRef(null),hadConversation=useRef(false);
 useEffect(()=>{setPrompt('');},[epoch]);
 useEffect(()=>{if(!agent.messages.length&&hadConversation.current)setPrompt('');hadConversation.current=agent.messages.length>0;},[agent.messages.length]);
 async function send(e){e.preventDefault();await agent.send(prompt);}
 const context=agent.context,taskLabel=context.task==='poster'?`${context.cat_ids.length}只猫的拼图`:context.cat_ids.length?`${context.cat_ids.length}只已选猫咪`:'销售任务';
 return <section className="sales-ai sales-ai-compact" aria-label="销售工具助手"><div className="sales-ai-heading"><h2>把客户需求变成 <span>销冠方案 <Sparkles aria-hidden="true"/></span></h2></div><form className="sales-ai-glow" onSubmit={send}><div className="sales-ai-composer"><label className="sr-only" htmlFor="sales-ai-prompt">客户选猫需求</label><textarea id="sales-ai-prompt" ref={input} rows={2} maxLength={200} value={prompt} onChange={e=>setPrompt(e.target.value.slice(0,200))} disabled={agent.pending||busy} placeholder="说客户需求，或说“挑4只做小红书图”；可以接着说“不要价格”“看第二只”"/><div className="sales-ai-toolbar"><span className="sales-ai-count">{prompt.length}/200</span><button type="submit" className="sales-ai-send" aria-label="发送客户需求" disabled={agent.pending||busy||checking||!prompt.trim()}>{agent.pending||busy?<span className="sales-ai-spinner"/>:<ArrowUp size={21}/>}</button></div></div></form><div className="sales-ai-quick">{commands.map(([emoji,label,text])=><button key={label} disabled={agent.pending||busy} onClick={()=>{setPrompt(text);input.current?.focus();}}><span>{emoji}</span>{label}</button>)}</div>
  <div className="agent-task-bar"><span>{context.task!=='help'?`接着处理：${taskLabel}`:'可连续处理当前任务'} · 本地工具免费，AI生成/复杂理解按次计费{cooldown?` · AI冷却${cooldown}秒`:''}</span><button onClick={agent.reset}>新任务</button></div>
  <AIResult result={agent.result} cats={cats} hidePrices={hidePrices} customerDisplay={customerDisplay} onDetail={onDetail}/>
  {agent.queued&&<button className="agent-queued" disabled={agent.pending||busy||cooldown>0||user?.remaining===0} onClick={agent.executeQueued}>{cooldown?`等待${cooldown}秒后执行`:'执行已识别任务（1次）'}</button>}
  {!hidePrices&&agent.messages.length>0&&<details className="agent-history"><summary>本次对话 · 最近{Math.ceil(agent.messages.length/2)}轮</summary><ol>{agent.messages.map((row,i)=><li key={i} className={row.role}><b>{row.role==='user'?'你':'助手'}</b><p>{displayText(row.text,cats,false)}</p></li>)}</ol><small>仅当前浏览器标签页保留，最多8轮，30分钟过期；新任务或退出账号会清空。发送模型时只带有限任务摘要。</small></details>}
  {agent.storageFailed&&<small className="agent-storage-warning">当前浏览器未保存会话，刷新后需要重新描述任务。</small>}
 </section>;
}
