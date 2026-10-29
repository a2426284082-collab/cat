import React,{useState} from 'react';
import {adminApi} from '../admin-api.js';

const money=value=>value===null||value===undefined?'待确认':`¥${Number(value).toLocaleString('zh-CN')}`;
const inputClass='w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-orange-500 focus:outline-none';

function CatCheck({item}){
 if(!item.found&&item.found!==undefined)return <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm" key={item.lookup}><b>#{item.lookup.replace(/^#/, '')}</b>：{item.message}{item.matches?.length?`（${item.matches.join('、')}）`:''}</div>;
 return <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><b>#{item.id} · {item.breed||'品种未知'} · {item.gender||'性别未知'}</b><span className={item.eligible?'text-emerald-700':'text-amber-700'}>{item.eligible?'全部硬条件通过':'存在未通过的条件'}</span></div>
  <div className="mb-3 text-xs text-slate-600">原始月龄：{item.ageRaw||'空'} → 解析：{item.ageMonths===null?'未知':item.ageMonths+'个月'} · 库存标价：{money(item.basePrice)} · 当前参考客户价：{money(item.referencePrice)} · 照片：{item.hasPhoto?'有':'无'}</div>
  <div className="flex flex-wrap gap-1.5">{Object.entries(item.checks).filter(([key])=>key!=='active').map(([key,rule])=><span key={key} className={`rounded-md px-2 py-1 text-xs ${rule.passed?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-800'}`}>{rule.passed?'✓':'✕'} {rule.label}</span>)}</div>
 </div>;
}

export default function SalesInventoryDiagnostics(){
 const [goal,setGoal]=useState('帮我找4只客户售价500到1000元之间、有照片、三个月以内的猫，不要英短，优先母猫。');
 const [ids,setIds]=useState('#099 #449');
 const [markup,setMarkup]=useState('0');
 const [taskId,setTaskId]=useState('');
 const [refresh,setRefresh]=useState(true);
 const [report,setReport]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[showSamples,setShowSamples]=useState(false),[copied,setCopied]=useState(false);
 async function run(event){
  event.preventDefault();setBusy(true);setError('');setReport(null);setCopied(false);
  try{
   const names=ids.split(/[\s,，、;；]+/).filter(Boolean);
   const result=await adminApi('/api/sales-admin/inventory-diagnostics',{
    method:'POST',body:JSON.stringify({goal,markup:Number(markup),task_id:taskId.trim()||undefined,ids:names,refresh}),timeoutMs:30000});
   setReport(result.data);
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 async function copyReport(){
  if(!report)return;
  const summary={dataTime:report.catalogUpdatedAt,markup:report.markup,priceExplanation:report.priceExplanation,
   effectiveDemand:report.effectiveDemand,counts:report.counts,
   requested:report.requested.map(c=>({id:c.id||c.lookup,ageRaw:c.ageRaw,ageMonths:c.ageMonths,basePrice:c.basePrice,referencePrice:c.referencePrice,hasPhoto:c.hasPhoto,eligible:c.eligible,failures:c.failures||[],message:c.message||''})),
   topMatchIds:report.topMatches.map(c=>c.id)};
  try{await navigator.clipboard.writeText(JSON.stringify(summary,null,2));setCopied(true);}
  catch{setError('复制失败，可以直接选中文本或截图发给我。');}
 }
 const independent=report?.counts?.independent||{};
 return <section className="space-y-5">
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
   <h2 className="text-lg font-bold">内部选猫诊断</h2>
   <p className="mt-1 text-sm text-slate-600">仅管理员可用。读取真实在售猫源、复用 Agent 筛选规则；不修改库存、不调用 DeepSeek、不消耗销售 AI 配额。</p>
   <form onSubmit={run} className="mt-5 grid gap-4">
    <label className="text-sm font-medium">需要诊断的客户原话
     <textarea rows={4} maxLength={1200} value={goal} disabled={Boolean(taskId.trim())} onChange={e=>setGoal(e.target.value)} className={inputClass+' mt-1.5'} placeholder="粘贴上次找不到猫的原话"/>
    </label>
    <div className="grid gap-3 md:grid-cols-3">
     <label className="text-sm font-medium">指定猫咪编号（可选）<input className={inputClass+' mt-1.5'} value={ids} onChange={e=>setIds(e.target.value)} placeholder="#099 #449"/></label>
     <label className="text-sm font-medium">网站对客加价（元）<input type="number" min={0} max={100000} step={1} className={inputClass+' mt-1.5'} value={markup} onChange={e=>setMarkup(e.target.value)} disabled={Boolean(taskId.trim())}/></label>
     <label className="text-sm font-medium">云端任务ID（可选）<input className={inputClass+' mt-1.5'} value={taskId} onChange={e=>setTaskId(e.target.value)} placeholder="粘贴完整任务UUID"/></label>
    </div>
    <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={refresh} onChange={e=>setRefresh(e.target.checked)} /> 强制从飞书重新读取猫源（不使用最多5分钟的缓存）</label>
    <p className="text-xs text-slate-500">填写云端任务ID时，会使用该任务保存的客户原话、AI结构化需求和原对客加价；否则按左侧输入重新解析。照片条件在诊断中强制开启，以模拟准备拼图的选猫过程。</p>
    <div className="flex items-center justify-end"><button type="submit" disabled={busy||(!taskId.trim()&&!goal.trim())} className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy?'正在读取并诊断…':'检查真实库存'}</button></div>
   </form>
   {error&&<p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
  </div>
  {report&&<>
   <div className="rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">筛选条件核对</h3><p className="mt-1 text-sm text-slate-600">{report.priceExplanation}，当前加价 {money(report.markup)}，照片必须存在</p></div><span className="text-xs text-slate-500">读取于 {report.catalogUpdatedAt?new Date(report.catalogUpdatedAt).toLocaleString('zh-CN'):'当前会话'}</span></div>
    <button onClick={copyReport} className="mt-3 rounded-lg border border-orange-200 px-3 py-2 text-sm font-semibold text-orange-700">{copied?'诊断摘要已复制':'复制诊断摘要（不包含客户原话）'}</button>
    <details className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">查看真实生效的完整条件（用于查 AI 是否传错参数）</summary>
     <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(report.effectiveDemand,null,2)}</pre>
     <p className="mt-2 text-xs text-slate-500">左边是实际生效参数；以下是仅从用户原话解析的参数，供对比：</p>
     <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words text-xs">{JSON.stringify(report.inferredDemand,null,2)}</pre>
    </details>
   </div>
   <div className="rounded-2xl border bg-white p-5 shadow-sm">
    <h3 className="font-bold">独立条件统计</h3>
    <p className="mt-1 text-sm text-slate-600">读取 {report.counts.total} 只，当前在售 {report.counts.active} 只；全部条件同时满足 <b className="text-emerald-700">{report.counts.eligible} 只</b>。月龄无法解析 {report.counts.unknownAge} 只。</p>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(independent).filter(([k])=>k!=='active').map(([key,v])=><div key={key} className="rounded-lg border bg-slate-50 px-3 py-3 text-sm"><div className="font-semibold">{v.label}</div><div className="mt-1 text-xs"><span className="text-emerald-700">通过 {v.pass}</span><span className="mx-2 text-slate-300">|</span><span className="text-red-700">未通过 {v.fail}</span></div></div>)}</div>
    <p className="mt-3 text-xs text-slate-500">以上每个条件均独立统计，以在售猫为基数。与旧版“前一步0，后续全显示0”的累积统计不同。</p>
    <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">查看原有按顺序筛选统计</summary><p className="mt-2 text-slate-600">硬条件后 {report.counts.hard} → 照片后 {report.counts.photo} → 价格有效 {report.counts.priced} → 最终 {report.counts.eligible}</p></details>
   </div>
   <div className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="mb-3 font-bold">指定猫咪逐项检查</h3><div className="grid gap-3 lg:grid-cols-2">{report.requested.length?report.requested.map(item=><CatCheck key={item.id||item.lookup} item={item}/>):<p className="text-sm text-slate-500">输入例如 #099 #449 可以检查具体猫咪。</p>}</div></div>
   <div className="rounded-2xl border bg-white p-5 shadow-sm"><h3 className="mb-3 font-bold">按当前条件排在前面的真实猫咪（最多12只）</h3><div className="grid gap-3 lg:grid-cols-2">{report.topMatches.length?report.topMatches.map(c=><CatCheck key={c.id} item={c}/>):<p className="text-sm text-red-700">没有猫咪同时满足所有硬条件。请查看上方独立统计与下方失败样本。</p>}</div></div>
   <div className="rounded-2xl border bg-white p-5 shadow-sm"><button className="text-sm font-semibold text-orange-700" onClick={()=>setShowSamples(v=>!v)}>{showSamples?'收起':'展开'}未通过条件的样本（最多12只）</button>{showSamples&&<div className="mt-3 grid gap-3 lg:grid-cols-2">{report.sampleFailures.map(c=><CatCheck key={c.id} item={c}/>)}</div>}</div>
  </>}
 </section>;
}
