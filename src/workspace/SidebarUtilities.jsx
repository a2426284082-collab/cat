import React,{useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import {useCatalog} from './catalog.jsx';
import {clearPreviewCache} from './media.js';
import CustomerDisplay from './CustomerDisplay.jsx';
import {SalesAccount} from './SalesSession.jsx';
import {useWorkbenchConfig} from './WorkbenchConfig.jsx';
import {FreightCalculator} from './CatTools.jsx';
import {shortIdMap,normalizeId} from './presentation.js';
import Dialog from './Dialog.jsx';

export default function SidebarUtilities({customerDisplay,onCustomerDisplay,onMarketing,calculatorLaunch=0}){
 const {cats,refresh}=useCatalog(),{config}=useWorkbenchConfig(),[repairing,setRepairing]=useState(false),[status,setStatus]=useState('');
 const [calculatorSelect,setCalculatorSelect]=useState(false),[calculatorCat,setCalculatorCat]=useState(null),[calculatorFilter,setCalculatorFilter]=useState('');
 const labels=shortIdMap(cats),eligible=cats.filter(cat=>cat.price!=null&&Number.isFinite(Number(cat.price)));
 const shown=eligible.filter(cat=>[cat.id,cat.breed,cat.color].some(v=>String(v||'').toLowerCase().includes(calculatorFilter.trim().toLowerCase()))).slice(0,40);
 useEffect(()=>{if(calculatorLaunch>0&&config.calculatorEnabled&&!customerDisplay.enabled){setCalculatorCat(null);setCalculatorFilter('');setCalculatorSelect(true);}},[calculatorLaunch]);
 async function repair(){
  if(repairing)return;setRepairing(true);setStatus('正在修复图片缓存…');
  try{await clearPreviewCache();await refresh({manual:true});setStatus('已重新请求图片与库存；激活信息和备忘录已保留。');}
  catch{setStatus('网络仍不可用，可点单张照片重试。');}finally{setRepairing(false);}
 }
 return <>
  <section className="sidebar-art-tools" aria-label="引流做图工具"><h2>🛠️ 引流做图工具</h2>
   <button aria-label="一键生成引流拼图 & 文案" onClick={()=>onMarketing('price')}><span className="sidebar-art-icon" aria-hidden="true">🎨</span><span><b>一键生成引流拼图 &amp; 文案</b><small>多图无框拼贴 / 朋友圈报价单</small></span></button>
  </section>
  <section className="sidebar-quote-settings" aria-label="对客报价设置"><h2>⚙️ 对客报价设置</h2><CustomerDisplay settings={customerDisplay} onChange={onCustomerDisplay}/><small>加价设为0，对客模式只展示资料、不显示价格。</small></section>
  <SalesAccount/>
  <button className="sidebar-repair-link" disabled={repairing} onClick={repair}>{repairing?'正在修复图片缓存…':'修复图片缓存'}</button>
  {status&&<p className="sidebar-repair-status" role="status">{status}</p>}
  {calculatorSelect&&config.calculatorEnabled&&!customerDisplay.enabled&&createPortal(<Dialog title="选择猫咪 · 运费速算" close={()=>setCalculatorSelect(false)}><div className="sidebar-freight-picker"><p>先选择一只在售猫咪，速算器会自动带入这只猫的供货价；实际运费仍需向运营或承运商确认。</p><input type="search" aria-label="搜索速算器猫咪" placeholder="搜索编号、品种或毛色" value={calculatorFilter} onChange={e=>setCalculatorFilter(e.target.value)}/><div className="sidebar-freight-options">{shown.map(cat=><button type="button" key={cat.id} onClick={()=>{setCalculatorCat(cat);setCalculatorSelect(false);}}><b>{labels.get(normalizeId(cat.id))||cat.id} · {cat.breed||'猫咪'}</b><small>{cat.color||''} · 供货价 ¥{Number(cat.price).toLocaleString('zh-CN')}</small></button>)}{!shown.length&&<p>没有找到可核算的在售猫咪。</p>}</div></div></Dialog>,document.body)}
  {calculatorCat&&config.calculatorEnabled&&!customerDisplay.enabled&&createPortal(<FreightCalculator cat={calculatorCat} label={labels.get(normalizeId(calculatorCat.id))||String(calculatorCat.id)} initialQuote={Number(calculatorCat.price)+Number(customerDisplay.markup||0)} close={()=>setCalculatorCat(null)}/>,document.body)}
 </>;
}
