import React,{useState} from 'react';
import Dialog from './Dialog.jsx';
export default function CustomerDisplay({settings,onSave,close}){
 const [markup,setMarkup]=useState(settings.markup),valid=markup!==''&&Number.isInteger(Number(markup))&&Number(markup)>=0&&Number(markup)<=100000;
 return <Dialog title="对客展示设置" close={close}><form className="customer-display-settings" onSubmit={e=>{e.preventDefault();if(valid)onSave({enabled:true,markup:Number(markup)});}}><h2>只展示客户需要看的资料</h2><p>正数加价显示「售价」；填0时价格区域留白。卡片的写话术和选猫操作自动收起。</p><label>统一加价金额（元）<input autoFocus type="number" min="0" max="100000" step="1" value={markup} onChange={e=>setMarkup(e.target.value)}/></label><div className="customer-display-presets"><button type="button" onClick={()=>setMarkup(800)}>+800元</button><button type="button" onClick={()=>setMarkup(0)}>+0 · 纯隐藏</button></div><small>只调整页面显示，不改库存价格；原照片、视频内已有的价格文字不会自动去除。</small><footer>{settings.enabled&&<button type="button" onClick={()=>onSave({...settings,enabled:false})}>退出对客展示</button>}<button className="workspace-primary" type="submit" disabled={!valid}>应用对客展示</button></footer></form></Dialog>;
}
