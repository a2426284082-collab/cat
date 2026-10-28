import React,{useEffect,useState} from 'react';
import {Eye} from 'lucide-react';
export default function CustomerDisplay({settings,onChange}){
 const [draft,setDraft]=useState(String(settings.markup));
 useEffect(()=>setDraft(String(settings.markup)),[settings.markup]);
 function edit(value){setDraft(value);const number=Number(value);if(value!==''&&Number.isInteger(number)&&number>=0&&number<=100000)onChange({...settings,markup:number});}
 return <div className="customer-display-controls"><label>对客加价 <span>+ <input aria-label="对客加价金额" type="number" min="0" max="100000" step="1" inputMode="numeric" value={draft} onChange={e=>edit(e.target.value)} onBlur={()=>setDraft(String(settings.markup))}/></span> 元</label><button type="button" role="switch" aria-checked={settings.enabled} aria-label="对客模式" onClick={()=>onChange({...settings,enabled:!settings.enabled})}><Eye size={15}/><span>对客模式: {settings.enabled?'开':'关'}</span><i aria-hidden="true"/></button></div>;
}
