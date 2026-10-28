// Offline review entry. This file is not a production build entry and never
// connects to live inventory, authentication, messages, payments or model APIs.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {WorkspaceContent} from '../SalesWorkspace.jsx';
import {answerHandbook} from '../../cloud-functions/_lib/sales-handbook.js';
import {parseDemandLocally} from '../../cloud-functions/_lib/smart-search.js';
const image=globalThis.WORKSPACE_PREVIEW_IMAGE;
const cats=[
 {id:'CAT-2026-000017',breed:'布偶',color:'蓝双',gender:'母',age:'3',price:2600,vaccine:'2针',description:'圆脸甜美、温顺亲人，喜欢互动。资料与价格均为交互预览示例。',image,images:[image],videos:[]},
 {id:'CAT-2026-000018',breed:'英短',color:'金渐层',gender:'母',age:'3',price:1800,vaccine:'1针',description:'圆脸甜美大眼，性格温顺安静。资料与价格均为交互预览示例。',image,images:[image],videos:[]},
 {id:'CAT-2026-000019',breed:'布偶',color:'海双',gender:'公',age:'4',price:2200,vaccine:'2针',description:'毛量蓬松，亲人活泼。资料与价格均为交互预览示例。',image,images:[image],videos:[]},
 {id:'CAT-2026-000020',breed:'德文卷毛猫',color:'乳白',gender:'公',age:'3',price:3800,vaccine:'2针',description:'活泼，喜欢互动。资料与价格均为交互预览示例。',image,images:[image],videos:[]},
].map((cat,index)=>({...cat,image:globalThis.WORKSPACE_PREVIEW_IMAGES?.[index]||image,images:[globalThis.WORKSPACE_PREVIEW_IMAGES?.[index]||image]}));
let signedIn=true,used=0,last=0;
const user=()=>({id:0,sales_name:'演示销售',daily_limit:20,used_today:used,remaining:20-used,retry_after:Math.max(0,15-Math.floor((Date.now()-last)/1000))});
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
window.fetch=async(input,options={})=>{
 const path=new URL(typeof input==='string'?input:input.url,'https://preview.local').pathname;
 if(options.signal?.aborted)throw new DOMException('Aborted','AbortError');
 if(path==='/api/public-cats')return response({success:true,data:cats,updatedAt:new Date().toISOString()});
 if(path==='/api/ai/session')return signedIn?response({success:true,user:user()}):response({success:false,message:'预览模式：点击工号可输入 PREVIEW 重新激活' },401);
 if(path==='/api/ai/logout'){signedIn=false;return response({success:true});}
 if(path==='/api/ai/activate'){
   const body=JSON.parse(options.body||'{}');
   if(body.key_code!=='PREVIEW')return response({success:false,message:'交互预览请输入 PREVIEW，无需真实激活码'},403);
   signedIn=true;return response({success:true,user:user()});
 }
 if(path==='/api/smart-search'){
  const body=JSON.parse(options.body||'{}');return response({success:true,data:{...parseDemandLocally(body.text,{breeds:body.breeds,colors:body.colors}),usedAI:false}});
 }
 if(path==='/api/ai/ask'){
  if(!signedIn)return response({success:false,message:'请先激活'},401);
  const body=JSON.parse(options.body||'{}'),prompt=String(body.prompt||'');
  if(/【\s*(#\s*)?】/.test(prompt))return response({success:false,message:'请先填写模板中的预算、品种或编号'},400);
  const handbook=answerHandbook(prompt);if(handbook||body.action==='handbook')return response({success:true,user:user(),data:handbook||{kind:'handbook',used_ai:false,matched_ids:[],sources:[],reply_text:'请输入合作或售后规则问题。'}});
  const ids=body.cat_ids||[...new Set([...prompt.matchAll(/#\s*([a-z0-9_-]+)/ig)].map(x=>x[1].toUpperCase()))];
  let selected=ids.length?cats.filter(c=>ids.includes(c.id)):cats;
  if(!ids.length){const f=parseDemandLocally(prompt,{breeds:[...new Set(cats.map(c=>c.breed))],colors:cats.map(c=>c.color)}).filters;selected=selected.filter(c=>(!f.breed||c.breed===f.breed)&&(!f.gender||c.gender===f.gender)&&(!f.max||c.price<=+f.max));}
  selected=selected.slice(0,2);
  if(ids.some(id=>!cats.some(c=>c.id===id))||!selected.length)return response({success:true,user:user(),data:{used_ai:false,matched_ids:[],reply_text:'示例库暂无匹配。可以试试：预算3000元，布偶妹妹，或用卡片的“写话术”按钮带入示例编号。'}});
  if(body.mode==='script'&&!ids.length)return response({success:false,message:'请先填写编号，例如 #CAT-2026-000017'},400);
  if(used>=20||user().retry_after)return response({success:false,user:user(),retry_after:user().retry_after,message:used>=20?'演示额度已用完，重新打开预览即可重置':'演示冷却中，请稍候'},429);
  used++;last=Date.now();
  const text=selected.map(c=>`#${c.id} ${c.breed}${c.gender==='母'?'妹妹':'弟弟'}，${body.hide_prices?'资料已核对':c.price+'元'}`).join('；')+'。可以先看看它们的资料，告诉我你更喜欢哪只，我再帮你确认细节。（示例话术）';
  return response({success:true,user:user(),data:{used_ai:true,matched_ids:selected.map(c=>'#'+c.id),reply_text:text}});
 }
 return response({success:false,message:'此交互预览不连接线上服务'},503);
};
function Preview(){const navigate=useNavigate();return <><div className="workspace-preview-banner"><span>交互预览 · 示例猫源与话术，不影响线上</span><button onClick={()=>navigate(-1)}>← 上一页</button><button onClick={()=>navigate(1)}>下一页 →</button></div><WorkspaceContent/></>;}
createRoot(document.getElementById('root')).render(<MemoryRouter initialEntries={['/cats/']}><Preview/></MemoryRouter>);
