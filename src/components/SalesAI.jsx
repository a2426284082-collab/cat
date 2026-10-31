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
export function AIResult({result,cats=[],hidePrices=false,customerDisplay={enabled:hidePrices,markup:0},onDetail,guest=false}){
 const [copied,setCopied]=useState(false),[copyError,setCopyError]=useState('');const timer=useRef(null);useEffect(()=>()=>clearTimeout(timer.current),[]);useEffect(()=>setCopied(false),[result,hidePrices]);if(!result)return null;
 const text=displayText(result.reply_text,cats,hidePrices||guest),labels=shortIdMap(cats),matched=(result.matched_ids||[]).map(id=>cats.find(c=>normalizeId(c.id)===normalizeId(id))).filter(Boolean),priceChanged=result.kind==='inventory'&&result.applied_markup!=null&&Number(result.applied_markup)!==Number(customerDisplay.markup??0);
 async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);clearTimeout(timer.current);timer.current=setTimeout(()=>setCopied(false),2200);}catch{setCopyError('复制失败，请手动选择文字复制。');}}
 return <div className="sales-ai-result" aria-live="polite"><div className="sales-ai-result-title"><b>{result.kind==='inventory'?'在售猫咪查询结果':result.kind==='handbook'?'手册答疑':result.kind==='tool'?'助手执行结果':result.kind==='copy'?'查库口令':result.kind==='cat_only'?'找猫说明':'找猫结果'}</b>{!priceChanged&&(result.used_ai||result.kind==='handbook'||result.kind==='copy')&&result.reply_text!=='指令无效'&&<button onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?'已复制':result.kind==='handbook'?'复制答复':result.kind==='copy'?'复制报单口令':'复制内部选猫记录'}</button>}</div><p className="sales-ai-reply">{text}</p>{priceChanged&&<small role="status">此结果按加价¥{result.applied_markup}筛选；当前加价已是¥{customerDisplay.markup}。请重新发送找猫要求，旧结果不会自动更新。</small>}{copyError&&<p role="alert">{copyError}</p>}{result.kind==='inventory'&&!hidePrices&&!guest&&<small>含网站基准价和销售加价，仅供内部核对，请勿直接转发给客户。</small>}{(result.kind==='handbook'||result.sources?.length>0)&&<div className="sales-ai-sources"><b>{result.sources?.length?'手册出处':'资料情况'}</b>{result.sources?.map(s=><a key={s.href+s.title} href={s.href}>{s.manual} · {s.title} ›</a>)}<small>{result.used_ai?(result.sources?.length?'AI已结合手册回答，本轮计入1次额度；具体订单约定仍需核实。':'AI未查到明确手册依据，本轮计入1次额度；请向负责人核实。'):'手册原文查询不扣AI次数。'}</small></div>}{matched.length>0&&<div className="sales-ai-cats">{matched.map(cat=><button key={cat.id} disabled={guest} onClick={()=>{if(!guest)onDetail?.(cat);}} className="sales-ai-cat">{cat.image?<SmartImage src={cat.image} sources={cat.images} retryable={false} alt={cat.breed||'猫咪'}/>:<span className="sales-ai-noimage"><ImageOff size={22}/></span>}<span><b>{labels.get(normalizeId(cat.id))} · {cat.breed}</b><small>{cat.gender} · {cat.color}</small>{!guest&&!priceChanged&&displayedPrice(cat,customerDisplay)!=null&&<strong>{hidePrices?'对客参考价 ':'网站基准价 '}{money(displayedPrice(cat,customerDisplay))}</strong>}{!guest&&!priceChanged&&!hidePrices&&cat.price!=null&&Number.isFinite(Number(cat.price))&&<small>加价后参考客户价 {money(Number(cat.price)+Number(customerDisplay.markup??0))}</small>}</span>{!guest&&<small className="sales-ai-detail">查看资料 ›</small>}</button>)}</div>}</div>;
}
function InlineMarkup({settings,onChange,defaultMarkup=0}){
 const [draft,setDraft]=useState(String(settings.markup??0));
 useEffect(()=>setDraft(String(settings.markup??0)),[settings.markup]);
 const update=value=>{
  setDraft(value);
  if(!/^\d{1,6}$/.test(value))return;
  const amount=Number(value);
  if(Number.isInteger(amount)&&amount>=0&&amount<=100000)onChange({...settings,markup:amount});
 };
 return <div className="sales-ai-markup-control"><label>对客加价 <input type="number" inputMode="numeric" min="0" max="100000" step="1" aria-label="找猫对客加价" value={draft} onChange={e=>update(e.target.value)} onBlur={()=>setDraft(String(settings.markup??0))}/> 元</label><button type="button" onClick={()=>onChange({...settings,markup:defaultMarkup})} disabled={Number(settings.markup??0)===defaultMarkup}>恢复默认</button></div>;
}
export default function SalesAI({cats=[],onDetail,hidePrices=false,customerDisplay={enabled:hidePrices,markup:0},onCustomerDisplay}){
 const {config:workbenchConfig}=useWorkbenchConfig();
 const {checking,busy,cooldown,epoch,user}=useSalesSession(),agent=useAgentContext();const [prompt,setPrompt]=useState(''),[quickTask,setQuickTask]=useState(null);const input=useRef(null),hadConversation=useRef(false);
 useEffect(()=>{setPrompt('');setQuickTask(null);},[epoch]);
 useEffect(()=>{if(!agent.messages.length&&hadConversation.current)setPrompt('');hadConversation.current=agent.messages.length>0;},[agent.messages.length]);
 async function send(e){e.preventDefault();agent.openConversation();await agent.send(prompt,quickTask?{source:'quick',tool:'match'}:{});}
 const selectedCount=agent.context.cat_ids.length;
 return <section className="sales-ai sales-ai-compact" aria-label="销售工具助手"><div className="sales-ai-heading"><h2>{workbenchConfig.heroTitle} <span>{workbenchConfig.heroHighlight} <Sparkles aria-hidden="true"/></span></h2><p className="sales-ai-filter-guide">常用条件可直接在下方筛选；也可粘贴找猫需求，或问合作、发货与售后规则。</p></div><form className="sales-ai-glow" onSubmit={send}><div className="sales-ai-composer"><label className="sr-only" htmlFor="sales-ai-prompt">客户选猫需求</label><textarea id="sales-ai-prompt" ref={input} rows={2} maxLength={4000} value={prompt} onChange={e=>{const value=e.target.value.slice(0,4000);setPrompt(value);if(quickTask&&!/客户预算【.*】元，想看【.*】品种，要求【.*】|客户是第一次养猫的新手，预算【.*】元左右，推荐两只性格温顺好养的猫|客户想找性价比高、品相甜美的捡漏小猫，请从库里挑2只最好卖的/.test(value))setQuickTask(null);}} disabled={agent.pending||busy} placeholder={workbenchConfig.aiPlaceholder}/><div className="sales-ai-toolbar">{quickTask&&<button type="button" className="agent-input-mode" onClick={()=>setQuickTask(null)}>快捷挑猫 · 切换自由输入</button>}<span className="sales-ai-count">{prompt.length}/4000</span><button type="submit" className="sales-ai-send" aria-label="发送客户需求" disabled={agent.pending||busy||checking||!prompt.trim()}>{agent.pending||busy?<span className="sales-ai-spinner"/>:<ArrowUp size={21}/>}</button></div></div></form><details className="sales-ai-common"><summary className="catalog-more-filters">常用需求</summary>{onCustomerDisplay&&!user?.is_guest&&<InlineMarkup settings={customerDisplay} onChange={onCustomerDisplay} defaultMarkup={workbenchConfig.defaultMarkup}/>}<div className="sales-ai-quick">{commands.map(([emoji,label,text])=><button aria-label={emoji+' '+label} key={label} disabled={agent.pending||busy} onClick={()=>{setQuickTask(label);setPrompt(text);input.current?.focus();}}><span>{emoji}</span>{({'粘贴客户需求挑猫':'需求挑猫','推荐新手粘人猫':'新手推荐','盘点今日高性价比捡漏':'高性价比'})[label]}</button>)}</div></details>
  {(selectedCount>0||cooldown>0||agent.messages.length>0)&&<div className="agent-task-bar"><span>{selectedCount>0?`已选${selectedCount}只猫`:''}{cooldown>0?`${selectedCount>0?' · ':''}冷却${cooldown}秒`:''}</span><button onClick={agent.reset}>新任务</button></div>}
  {!agent.conversationOpen&&<AIResult result={agent.result} cats={cats} hidePrices={hidePrices} guest={user?.is_guest} customerDisplay={customerDisplay} onDetail={onDetail}/>}

  {agent.messages.length>0&&!agent.conversationOpen&&<button className="agent-open-conversation" onClick={agent.openConversation}>打开对话继续处理</button>}
  {agent.conversationOpen&&<AgentConversation cats={cats} hidePrices={hidePrices||user?.is_guest} agent={agent} pricingControl={onCustomerDisplay&&!user?.is_guest?<InlineMarkup settings={customerDisplay} onChange={onCustomerDisplay} defaultMarkup={workbenchConfig.defaultMarkup}/>:null} renderResult={()=> <AIResult result={agent.result} cats={cats} hidePrices={hidePrices} guest={user?.is_guest} customerDisplay={customerDisplay} onDetail={cat=>{agent.closeConversation();onDetail?.(cat);}}/>}/>}
  {!agent.conversationOpen&&!hidePrices&&!user?.is_guest&&agent.messages.length>0&&<details className="agent-history"><summary>本次对话 · 最近{Math.ceil(agent.messages.length/2)}轮</summary><ol>{agent.messages.map((row,i)=><li key={i} className={row.role}><b>{row.role==='user'?'你':'助手'}</b><p>{displayText(row.text,cats,false)}</p></li>)}</ol><small>仅当前浏览器标签页保留最近对话，30分钟过期；更换客户请点击新任务。</small></details>}
  {agent.storageFailed&&<small className="agent-storage-warning">当前浏览器未保存会话，刷新后需要重新描述任务。</small>}
 </section>;
}
