import React,{useEffect,useMemo,useRef,useState} from 'react';
import Dialog from './Dialog.jsx';
import {salesApi} from './SalesSession.jsx';
import {normalizeId,shortIdMap} from './presentation.js';
import {normalizeMarketingLabPlan} from '../../shared.marketing_lab.js';
import './marketing-lab.css';

let fallbackDevice=null;
function deviceId(){
 try{let id=localStorage.getItem('sales-device-id');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'')){id=crypto.randomUUID();localStorage.setItem('sales-device-id',id);}return id;}catch{fallbackDevice ||= crypto.randomUUID();return fallbackDevice;}
}
const font='"Noto Sans CJK SC","Microsoft YaHei","PingFang SC",sans-serif';
const palettes={cream:{bg:'#fff8f1',light:'#fff1ea',pink:'#f17895',ink:'#46333b',sub:'#8c7078',accent:'#f5bb77',pale:'#ffe1da'},pink:{bg:'#fff3f7',light:'#ffecf3',pink:'#ef729d',ink:'#43303e',sub:'#926b7d',accent:'#f3be7c',pale:'#ffc9e0'},mint:{bg:'#eff9f5',light:'#e2f5ed',pink:'#e48191',ink:'#304c44',sub:'#64897e',accent:'#a6d6c1',pale:'#d5f0e3'},bold:{bg:'#191621',light:'#302936',pink:'#ff6d9e',ink:'#fff8fa',sub:'#e4cdd5',accent:'#ffdc5a',pale:'#4c3349'}};
function renderPlanToCanvas(canvas,plan,photos){
 const g=canvas.getContext('2d');
 const roundRect=(x,y,w,h,r=0)=>{g.beginPath();g.roundRect(x,y,w,h,r);};
 const fillRound=(x,y,w,h,r,color)=>{g.fillStyle=color;roundRect(x,y,w,h,r);g.fill();};
 const fillText=(str,x,y,size=40,color='#222',weight=700,align='left')=>{g.fillStyle=color;g.font=`${weight} ${size}px ${font}`;g.textAlign=align;g.textBaseline='alphabetic';g.fillText(String(str),x,y);};
 const wrapped=(text,x,y,maxWidth,lineHeight,size,color,weight=700,maxLines=3)=>{g.font=`${weight} ${size}px ${font}`;let pieces=[],line='';for(const ch of String(text)){if(ch==='\n'){pieces.push(line);line='';continue;}if(g.measureText(line+ch).width>maxWidth&&line){pieces.push(line);line=ch;}else line+=ch;}if(line)pieces.push(line);if(pieces.length>maxLines){pieces=pieces.slice(0,maxLines);while(g.measureText(pieces.at(-1)+'…').width>maxWidth)pieces[pieces.length-1]=pieces.at(-1).slice(0,-1);pieces[pieces.length-1]+='…';}for(let i=0;i<pieces.length;i++)fillText(pieces[i],x,y+i*lineHeight,size,color,weight);return pieces.length*lineHeight;};
 const ellipse=(x,y,rx,ry,col)=>{g.fillStyle=col;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();};
 const paw=(x,y,col,scale=1)=>{g.save();g.translate(x,y);g.scale(scale,scale);ellipse(0,23,20,15,col);[[-25,-3],[-8,-15],[12,-13],[27,-1]].forEach(([xx,yy])=>ellipse(xx,yy,8,10,col));g.restore();};
 const heart=(x,y,size,col)=>{g.save();g.translate(x,y);g.scale(size/45,size/45);g.beginPath();g.moveTo(0,15);g.bezierCurveTo(-55,-8,-15,-35,0,-12);g.bezierCurveTo(15,-35,55,-8,0,15);g.fillStyle=col;g.fill();g.restore();};
 const pill=(text,x,y,{bg='#fff',fg='#694b53',height=56,sz=26,pad=28}={})=>{g.font=`700 ${sz}px ${font}`;const width=Math.min(820,g.measureText(String(text)).width+pad*2);fillRound(x,y,width,height,height/2,bg);fillText(text,x+pad,y+height/2+sz*.34,sz,fg,700);return width;};
 const base=(theme,w,h)=>{const p=palettes[theme]||palettes.cream;g.fillStyle=p.bg;g.fillRect(0,0,w,h);ellipse(w-70,130,270,270,p.light);ellipse(45,h-75,240,215,p.light);paw(w-108,180,p.pale,1.4);paw(84,h-162,p.pale,1.2);return p;};
 const photo=(img,x,y,w,h,{radius=44,position=.5}={})=>{g.save();roundRect(x,y,w,h,radius);g.clip();g.fillStyle='#f5e6e4';g.fillRect(x,y,w,h);const ratio=Math.max(w/img.naturalWidth,h/img.naturalHeight),iw=img.naturalWidth*ratio,ih=img.naturalHeight*ratio;g.drawImage(img,x-(iw-w)*position,y-(ih-h)*.5,iw,ih);g.restore();};
 const whiteFooter=(x,y,w,height,text,p)=>{fillRound(x,y,w,height,height/2,p.pink);fillText(text,x+w/2,y+height/2+12,32,'#fff',750,'center');};
 const brandmark=(y,p,dark=false)=>{pill('✦  CAT DAILY',73,y,{bg:dark?'#ffffff26':'#ffffffdd',fg:dark?'#fff':p.ink,height:60,sz:25});};
 const list=(plan.tags||[]).slice(0,3);
 if(plan.template==='douyin_cover'){
  const w=1080,h=1920;canvas.width=w;canvas.height=h;const p=palettes.bold;g.fillStyle='#1a1620';g.fillRect(0,0,w,h);ellipse(970,290,400,330,'#4c2e3d');paw(92,385,'#493343',2);heart(930,470,94,p.pink);pill('▶  DOUYIN COVER',70,67,{bg:'#e85378',fg:'#fff',height:74,sz:28});wrapped(plan.headline,72,318,935,126,110,'#fff6f9',950,3);fillRound(77,361,180,13,6,p.accent);wrapped(plan.subtitle,80,445,900,67,46,'#ffda61',800,2);g.shadowColor='#00000080';g.shadowBlur=40;g.shadowOffsetY=15;photo(photos[plan.photoSlots[0]||0],plan.layout==='minimal'?30:64,550,plan.layout==='minimal'?1020:952,plan.layout==='minimal'?1090:1040,{radius:plan.layout==='minimal'?12:56});g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0;const grad=g.createLinearGradient(0,1280,0,1770);grad.addColorStop(0,'#1a162000');grad.addColorStop(1,'#1a1620');g.fillStyle=grad;g.fillRect(0,1250,w,540);list.forEach((t,i)=>pill(t,80+i*275,1630,{bg:'#ffffff27',fg:'#fff',height:66,sz:27,pad:26}));fillRound(75,1796,930,91,46,'#f26c95');fillText(plan.cta,540,1855,33,'#fff',800,'center');return;
 }
 if(plan.template==='grid_4'){
  const w=1080,h=1440;canvas.width=w;canvas.height=h;const p=base(plan.theme,w,h);brandmark(52,p);wrapped(plan.headline,75,218,955,88,70,p.ink,900,2);fillRound(78,239,148,9,5,p.pink);wrapped(plan.subtitle,78,301,930,44,30,p.sub,550,2);const places=[[72,370],[554,370],[72,822],[554,822]];places.forEach(([x,y],i)=>{const im=photos[plan.photoSlots[i%plan.photoSlots.length]%photos.length];if(plan.layout==='sticker'){g.save();const cx=x+225,cy=y+200;g.translate(cx,cy);g.rotate(i%2===0?-.028:.028);fillRound(-231,-221,462,444,35,'#fff');photo(im,-225,-215,450,384,{radius:18});fillRound(-215,105,210,55,27,'#ffffffed');fillText(`萌猫日常 0${i+1}`,-198,145,27,p.ink,700);g.restore();}else{fillRound(x-4,y-4,462,444,plan.layout==='minimal'?8:35,'#fff');photo(im,x,y,450,384,{radius:plan.layout==='minimal'?8:30});if(plan.layout!=='minimal'){fillRound(x+15,y+320,208,54,27,'#ffffffed');fillText(`可爱小猫 0${i+1}`,x+30,y+357,27,p.ink,700);}}});list.forEach((t,i)=>pill(t,76+i*250,1280,{bg:p.light,fg:p.ink,height:54,sz:25,pad:24}));whiteFooter(78,1361,924,65,plan.cta,p);return;
 }
 if(plan.template==='cat_profile'){
  const w=1080,h=1440;canvas.width=w;canvas.height=h;const p=base(plan.theme,w,h);brandmark(58,p);wrapped(plan.headline,72,230,960,90,73,p.ink,900,2);wrapped(plan.subtitle,78,295,960,44,31,p.sub,550,2);fillRound(70,354,940,806,41,'#fff');photo(photos[plan.photoSlots[0]||0],90,374,900,plan.layout==='minimal'?730:603,{radius:plan.layout==='minimal'?12:29});if(plan.layout==='sticker'){heart(925,490,92,p.pink);pill('♡ 今日主角',715,400,{bg:'#fff8f4',fg:p.ink,height:62,sz:30});}if(plan.layout!=='minimal'){fillText('CAT MOMENT',109,1044,50,p.ink,850);fillText('实拍分享 · 记录可爱',111,1094,30,p.sub,500);}else fillText('CAT MOMENT  /  REAL PHOTOS',115,1132,40,p.ink,800);list.forEach((t,i)=>pill(t,76+i*257,1198,{bg:p.light,fg:p.ink,height:59,sz:27,pad:25}));whiteFooter(80,1325,920,78,plan.cta,p);return;
 }
 const w=1080,h=1440;canvas.width=w;canvas.height=h;const p=base(plan.theme,w,h);brandmark(66,p);heart(937,145,66,p.pink);wrapped(plan.headline,75,252,935,93,80,p.ink,900,2);fillRound(76,322,150,10,5,p.pink);wrapped(plan.subtitle,75,378,930,48,33,p.sub,550,2);const pos=plan.layout==='minimal'?[55,410,970,830]:plan.layout==='sticker'?[105,455,870,665]:[70,425,940,715];g.shadowColor='#634e5740';g.shadowBlur=35;g.shadowOffsetY=18;photo(photos[plan.photoSlots[0]||0],...pos,{radius:plan.layout==='minimal'?18:48});g.shadowColor='transparent';g.shadowBlur=0;g.shadowOffsetY=0;if(plan.layout==='sticker'){g.save();g.translate(890,1090);g.rotate(.13);fillRound(-168,-48,322,98,22,p.accent);fillText('✦ 猫咪日常 ✦',-135,17,36,p.ink,850);g.restore();heart(930,465,65,p.pink);}if(plan.layout==='minimal')fillRound(55,1160,970,7,3,p.pink);if(plan.layout!=='minimal'){fillRound(108,1023,500,84,42,'#fffffff0');fillText('♡ 今天的猫咪日常',136,1079,34,p.ink,750);}list.forEach((t,i)=>pill(t,80+i*245,1174,{bg:p.light,fg:p.ink,height:62,sz:27,pad:23}));whiteFooter(76,1296,928,84,plan.cta,p);paw(932,1212,p.pale,1.5);
}
async function loadImages(cats){return Promise.all(cats.map(cat=>new Promise((resolve,reject)=>{const image=new Image();image.crossOrigin='anonymous';image.onload=()=>resolve(image);image.onerror=()=>reject(new Error(`图片无法读取：${cat.id||'unknown'}`));image.src=(Array.isArray(cat.images)&&cat.images[0])||cat.image;})));}

export default function DeepseekMarketingLab({allCats,initialCatIds=[],close}){
 const labels=useMemo(()=>shortIdMap(allCats),[allCats]);
 const candidates=useMemo(()=>allCats.filter(cat=>cat.image).slice(0,24),[allCats]);
 const [selectedIds,setSelectedIds]=useState(()=>{const seed=(initialCatIds.length?initialCatIds:candidates.slice(0,4).map(cat=>cat.id)).slice(0,4);return seed.map(v=>String(v));});
 const [template,setTemplate]=useState('xhs_cover');
 const [prompt,setPrompt]=useState('做一张适合小红书发布的猫咪营销图，风格温柔治愈，突出真实猫咪照片。');
 const [status,setStatus]=useState('请选择1到4只猫，再点“AI出图”。');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [plan,setPlan]=useState(null);
 const [planText,setPlanText]=useState('');
 const [resultCats,setResultCats]=useState([]);
 const canvasRef=useRef(null);
 useEffect(()=>{if(!selectedIds.length&&candidates.length)setSelectedIds(candidates.slice(0,4).map(cat=>String(cat.id)));},[candidates,selectedIds.length]);
 async function draw(nextPlan,nextCats){
  const canvas=canvasRef.current;if(!canvas)throw new Error('画布未准备好');
  const images=await loadImages(nextCats);
  renderPlanToCanvas(canvas,nextPlan,images);
 }
 async function run(){
  if(busy)return;
  setBusy(true);setError('');setStatus('正在调用 DeepSeek 设计版式…');
  try{
   const response=await salesApi('/api/marketing-lab',{method:'POST',body:JSON.stringify({device_id:deviceId(),prompt,template,cat_ids:selectedIds})});
   const nextPlan=normalizeMarketingLabPlan(response.data.plan,{preferredTemplate:template,photoCount:response.data.cats.length});
   setStatus(`DeepSeek 已返回方案，模型：${response.data.model}；正在绘制…`);
   await draw(nextPlan,response.data.cats);
   setPlan(nextPlan);setPlanText(JSON.stringify(nextPlan,null,2));setResultCats(response.data.cats);setStatus('已完成：这是网站内真实可用的 AI 营销出图实验室。你可以下载 PNG，或改 JSON 后重绘。');
  }catch(e){setError(e.message);setStatus('出图失败');}
  finally{setBusy(false);}
 }
 async function rerender(){
  if(!planText.trim())return;
  setBusy(true);setError('');
  try{const nextPlan=normalizeMarketingLabPlan(JSON.parse(planText),{preferredTemplate:template,photoCount:resultCats.length||selectedIds.length});await draw(nextPlan,resultCats.length?resultCats:candidates.filter(cat=>selectedIds.includes(String(cat.id))).slice(0,4));setPlan(nextPlan);setStatus('已按当前 JSON 重新绘制。');}
  catch(e){setError(e.message);}
  finally{setBusy(false);}
 }
 function toggleCat(id){setSelectedIds(list=>{const key=String(id);return list.includes(key)?list.filter(v=>v!==key):list.length>=4?list:[...list,key];});}
 function download(){const canvas=canvasRef.current;if(!canvas)return;canvas.toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ai_marketing_${Date.now()}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);},'image/png');}
 return <Dialog title="AI营销出图实验室（测试）" close={close}><div className="marketing-lab">
  <div className="marketing-lab-panel">
   <p className="marketing-lab-tip">这是管理员可开关的测试功能：DeepSeek 负责生成排版方案，网站前端直接用 Canvas 真实绘图。</p>
   <label>出图要求<textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows={4} maxLength={1200} placeholder="例如：做一张适合小红书的新手养猫分享封面，突出可爱、真实和治愈感。"/></label>
   <label>模板类型<select value={template} onChange={e=>setTemplate(e.target.value)}><option value="xhs_cover">小红书封面</option><option value="grid_4">四宫格拼图</option><option value="cat_profile">单猫资料卡</option><option value="douyin_cover">抖音封面</option></select></label>
   <div className="marketing-lab-picked"><b>已选猫咪（{selectedIds.length}/4）</b><div>{selectedIds.length?selectedIds.map(id=><span key={id}>{labels.get(normalizeId(id))||id}</span>):<small>请在下面选择</small>}</div></div>
   <div className="marketing-lab-cats">{candidates.map(cat=>{const active=selectedIds.includes(String(cat.id));return <button type="button" key={cat.id} className={active?'is-active':''} onClick={()=>toggleCat(cat.id)}><img src={cat.image} alt={cat.breed||'cat'}/><b>{labels.get(normalizeId(cat.id))||cat.id}</b><small>{cat.breed||'在售猫咪'}</small></button>;})}</div>
   <div className="marketing-lab-actions"><button className="workspace-primary" disabled={busy||selectedIds.length<1} onClick={run}>{busy?'处理中…':'AI出图'}</button><button disabled={busy||!planText.trim()} onClick={rerender}>按当前JSON重绘</button><button disabled={!plan} onClick={download}>下载PNG</button></div>
   {error&&<p className="sales-ai-error" role="alert">{error}</p>}
   <p role="status" className="marketing-lab-status">{status}</p>
   <label>绘图 JSON<textarea value={planText} onChange={e=>setPlanText(e.target.value)} rows={10} placeholder='生成后会显示 JSON 方案，可手改后重绘。'/></label>
  </div>
  <div className="marketing-lab-preview"><canvas ref={canvasRef}/>{plan&&<div className="marketing-lab-meta"><span>{plan.template}</span><span>{plan.theme}</span><span>{plan.layout}</span></div>}</div>
 </div></Dialog>;
}
