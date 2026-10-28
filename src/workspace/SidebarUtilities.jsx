import React,{useState} from 'react';
import {Image,MapPin} from 'lucide-react';
import {useCatalog} from './catalog.jsx';
import {clearPreviewCache} from './media.js';
import CustomerDisplay from './CustomerDisplay.jsx';
import {SalesAccount} from './SalesSession.jsx';

export default function SidebarUtilities({customerDisplay,onCustomerDisplay,onMarketing}){
 const {refresh}=useCatalog(),[repairing,setRepairing]=useState(false),[status,setStatus]=useState('');
 async function repair(){
  if(repairing)return;setRepairing(true);setStatus('正在修复图片缓存…');
  try{await clearPreviewCache();await refresh({manual:true});setStatus('已重新请求图片与库存；激活信息和备忘录已保留。');}
  catch{setStatus('网络仍不可用，可点单张照片重试。');}finally{setRepairing(false);}
 }
 return <>
  <section className="sidebar-art-tools" aria-label="引流做图工具"><h2>🛠️ 引流做图工具</h2>
   <button aria-label="生成小红书报价九宫格" onClick={()=>onMarketing('price')}><Image size={19}/><span><b>小红书报价九宫格</b><small>选猫配价，一键出图</small></span></button>
   <button aria-label="生成同城猫舍招牌海报" onClick={()=>onMarketing('sign')}><MapPin size={19}/><span><b>同城猫舍招牌海报</b><small>加上你的城市与店名</small></span></button>
  </section>
  <section className="sidebar-quote-settings" aria-label="对客报价设置"><h2>⚙️ 对客报价设置</h2><CustomerDisplay settings={customerDisplay} onChange={onCustomerDisplay}/><small>加价设为0，对客模式只展示资料、不显示价格。</small></section>
  <SalesAccount/>
  <button className="sidebar-repair-link" disabled={repairing} onClick={repair}>{repairing?'正在修复图片缓存…':'修复图片缓存'}</button>
  {status&&<p className="sidebar-repair-status" role="status">{status}</p>}
 </>;
}
