import React,{useState} from 'react';
import {useCatalog} from './catalog.jsx';
import {clearPreviewCache} from './media.js';
import CustomerDisplay from './CustomerDisplay.jsx';
import {SalesAccount} from './SalesSession.jsx';

export default function SidebarUtilities({customerDisplay,onCustomerDisplay,onMarketing,onMarketingLab,marketingLabEnabled}){
 const {refresh}=useCatalog(),[repairing,setRepairing]=useState(false),[status,setStatus]=useState('');
 async function repair(){
  if(repairing)return;setRepairing(true);setStatus('正在修复图片缓存…');
  try{await clearPreviewCache();await refresh({manual:true});setStatus('已重新请求图片与库存；激活信息和备忘录已保留。');}
  catch{setStatus('网络仍不可用，可点单张照片重试。');}finally{setRepairing(false);}
 }
 return <>
  <section className="sidebar-art-tools" aria-label="引流做图工具"><h2>🛠️ 引流做图工具</h2>
   <button aria-label="一键生成引流拼图 & 文案" onClick={()=>onMarketing('price')}><span className="sidebar-art-icon" aria-hidden="true">🎨</span><span><b>一键生成引流拼图 &amp; 文案</b><small>多图无框拼贴 / 朋友圈报价单</small></span></button>
   {marketingLabEnabled&&<button aria-label="打开AI营销出图实验室" onClick={onMarketingLab}><span className="sidebar-art-icon" aria-hidden="true">🧪</span><span><b>AI营销出图实验室</b><small>管理员可关闭 · DeepSeek 设计 + 网站内真实绘图</small></span></button>}
  </section>
  <section className="sidebar-quote-settings" aria-label="对客报价设置"><h2>⚙️ 对客报价设置</h2><CustomerDisplay settings={customerDisplay} onChange={onCustomerDisplay}/><small>加价设为0，对客模式只展示资料、不显示价格。</small></section>
  <SalesAccount/>
  <button className="sidebar-repair-link" disabled={repairing} onClick={repair}>{repairing?'正在修复图片缓存…':'修复图片缓存'}</button>
  {status&&<p className="sidebar-repair-status" role="status">{status}</p>}
 </>;
}
