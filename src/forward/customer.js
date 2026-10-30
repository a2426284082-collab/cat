import './proposal-page.css';
import {api,esc,money,dateLabel,validatePublic} from './shared.js';
const photoChoices=cat=>[...new Set([cat.image,...(Array.isArray(cat.images)?cat.images:[])].filter(Boolean))];
const app=document.querySelector('#proposal-app'),modal=document.querySelector('#contact-modal');let proposal=null,timer;
function notify(text){const el=document.querySelector('#proposal-toast');el.textContent=text;el.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('visible'),3000);}
const token=/^\/p\/([A-Za-z0-9_-]{24})\/?$/.exec(location.pathname)?.[1];
let refreshing=false,lastStockCheck=0,stockError='',stockChecking=false;
function adapt(raw){const data=validatePublic(raw);return {customer:data.customer_name,expires:dateLabel(data.expires_at),expires_at:data.expires_at,note:data.note,agent:data.advisor.name,brand:data.advisor.brand,wechat:data.advisor.wechat,qr:/^\/api\/proposals\/[A-Za-z0-9_-]{24}\/qr$/.test(data.advisor.qr_url||'')?data.advisor.qr_url:'',checked:data.inventory_checked_at,cats:data.cats.map(c=>({...c,name:'#'+c.id,video:c.videos[0]?.url||null}))};}
function stockLabel(cat){return cat.stock==='available'?'已核验在售':cat.stock==='unavailable'?'已不在售':'库存暂未核实';}
function stockClass(cat){return cat.stock==='available'?'stock-available':cat.stock==='unavailable'?'stock-unavailable':'stock-unverified';}
function checkLabel(){return proposal.checked?'库存数据同步于 '+new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(proposal.checked*1000))+' · 成交前仍需核对':stockChecking?'正在后台核验库存，不影响查看方案…':stockError?'库存核验暂不可用，请联系顾问确认':'库存待核验，请勿直接据此下单';}
function failPage(message){for(const video of document.querySelectorAll('video'))video.pause();if(modal.open)modal.close();proposal=null;app.innerHTML=`<section class="error-page"><span>✳</span><h1>这份方案暂时无法打开</h1><p>${esc(message)}</p><p>请回到原微信对话，联系选猫顾问获取最新方案。</p></section>`;}
async function start(){
 try{
  if(!token)throw new Error('方案链接不完整');
  proposal=adapt((await api('/api/proposals/'+token,{timeout:12000})).data);
  render(); // First paint depends only on D1; no Feishu crawl/video download here.
  refreshStock(true).catch(()=>{});
 }catch(error){failPage(error.message);}
}
async function refreshStock(force=false){
 if(!token||!proposal||refreshing||document.hidden)return;
 if(!force&&Date.now()-lastStockCheck<3*60*1000)return;
 refreshing=true;stockChecking=true;stockError='';lastStockCheck=Date.now();updateStock();
 try{
  const data=(await api('/api/proposals/'+token+'/stock',{timeout:12000})).data;
  if(!proposal)return;
  const byId=new Map((data.cats||[]).map(c=>[String(c.id).toUpperCase(),c.stock]));
  proposal.checked=data.inventory_checked_at||null;
  proposal.cats.forEach(c=>{c.stock=byId.get(String(c.id).toUpperCase())||'unknown';});
 }catch(error){
  if(!proposal)return;
  if([404,410].includes(error.status)){failPage(error.message);return;}
  proposal.checked=null;proposal.cats.forEach(c=>c.stock='unknown');stockError=error.message||'核验失败';
 }finally{refreshing=false;stockChecking=false;updateStock();}
}
function updateStock(){
 if(!proposal)return;
 for(const el of document.querySelectorAll('[data-stock]')){
  const cat=proposal.cats.find(c=>c.id===el.dataset.stock);
  if(!cat)continue;
  el.className=stockClass(cat);el.innerHTML='<i></i>'+stockLabel(cat);
  const box=el.closest('.proposal-cat');const btn=box?.querySelector('[data-action="play-video"]');
  if(cat.stock==='unavailable')box?.querySelector('video')?.pause();
  if(btn){btn.disabled=cat.stock==='unavailable';btn.textContent=cat.stock==='unavailable'?'库存已变动':'▶ 点击播放视频';}
 }
 const line=document.querySelector('.inventory-check-label');if(line)line.textContent=checkLabel();
}

function render(){const p=proposal;document.title=`给${p.customer}的专属选猫方案`;

 app.innerHTML=`<div class="proposal-page"><header class="proposal-brand"><span class="brand-flower">✳</span><strong>${esc(p.brand)}</strong><span class="brand-caption">PERSONAL SELECTION</span></header>
 <section class="welcome"><div class="welcome-kicker">A LITTLE LOVE, JUST FOR YOU</div><h1>HI, ${esc(p.customer)} <span>👋</span></h1><p>这是为您认真挑选的 <strong>${p.cats.length}</strong> 只小朋友，<br>希望有一只，刚好与您合眼缘。</p>${p.note?`<blockquote>${esc(p.note)}</blockquote>`:''}<div class="welcome-trust"><span>✓ 专属挑选</span><span>✓ 明确对客报价</span><span>✓ 一对一顾问</span></div><div class="welcome-sign"><span class="sign-line"></span>慢慢看，不用着急<span class="sign-line"></span></div></section>
 <div class="inventory-check"><span class="inventory-check-label">${esc(checkLabel())}</span><button type="button" class="stock-refresh-button" data-action="refresh-stock">重新核验</button></div><section class="proposal-cats" aria-label="为你挑选的猫咪">${p.cats.map((c,i)=>`<article class="proposal-cat"><div class="cat-media"><span class="selection-number">NO. 0${i+1}</span>${c.image?`<img src="${esc(c.image)}" alt="${esc(c.name)}资料图片" data-cat-photo="${esc(c.id)}" data-photo-index="0" loading="${i===0?'eager':'lazy'}" decoding="async" ${i===0?'fetchpriority="high"':''}>`:`<div class="missing-cat-image">图片待补充</div>`}${c.video?`<button type="button" class="video-play-button" data-action="play-video" data-id="${esc(c.id)}" aria-label="播放${esc(c.name)}的视频">▶ 点击播放视频</button>`:''}<span class="media-caption">${c.stock==='unavailable'?'猫咪已不在当前在售列表':c.video?'真实照片 · 视频点击后加载':'图片资料展示'}</span></div><div class="cat-body"><div class="cat-heading"><div><span class="little-name">猫咪编号 · ${esc(c.id)}</span><h2>${esc(c.breed)}<span>${esc(c.color)}</span></h2></div><span class="cat-gender">${esc(c.gender)} ${c.gender==='公'?'♂':c.gender==='母'?'♀':''}</span></div><div class="cat-tags"><span>月龄 ${esc(c.age||'待确认')}</span><span>疫苗：${esc(c.vaccine||'待确认')}</span></div><div class="cat-price-row"><div><small>为您保留的报价</small><strong><span>¥</span>${money(c.price)}</strong></div><span class="${stockClass(c)}" data-stock="${esc(c.id)}"><i></i>${stockLabel(c)}</span></div><p class="price-note">运输及其他费用待确认 · 本页不锁定库存</p></div></article>`).join('')}</section>
 <section class="care-section"><span class="section-kicker">BEFORE WE MEET</span><h2>接猫之前，认真确认。</h2><p class="care-intro">把重要的事说清楚，才能安心迎接新成员。</p><div class="care-accordions"><details><summary><span><b>01</b>健康与记录</span><i>＋</i></summary><p>疫苗情况按已提供的资料展示，缺失部分需要核实。检测记录、健康协议范围和售后处理条件，请在付款前与顾问逐项确认。</p><span class="pending-tag">实际保障条款待核实</span></details><details><summary><span><b>02</b>报价与预留</span><i>＋</i></summary><p>本页展示专属对客报价，有效至 ${esc(p.expires)}。是否可预留、定金金额、交接及退还条件，需要先与顾问确认；打开页面不会锁定猫咪。</p><span class="pending-tag">定金与预留规则待确认</span></details><details><summary><span><b>03</b>运输与接猫</span><i>＋</i></summary><p>告诉顾问你的所在城市和期望接猫时间，再确认可安排的运输方式、费用和交接细节。</p><span class="pending-tag">具体方式和费用待确认</span></details></div></section>
 <section class="gentle-ending"><span>✳</span><h2>合眼缘的相遇，<br>值得多一点了解。</h2><p>有喜欢的，或者还有疑问，<br>随时回微信和${esc(p.agent)}聊聊。</p><small>报价有效至 ${esc(p.expires)}</small></section><footer class="proposal-footer">${esc(p.brand)} · 每一次推荐，都认真一点。<p>库存可能随时变化，付款前请与顾问确认猫咪、费用及交易安排。</p></footer>
 <div class="contact-dock"><div><small>你的专属顾问</small><strong>${esc(p.agent)}</strong></div><button class="contact-button" data-action="contact">选好啦，联系顾问 <span>↗</span></button></div></div>`;
}
function contact(){const p=proposal;modal.innerHTML=`<button class="modal-close" data-action="close-contact" aria-label="关闭二维码">×</button><span class="contact-kicker">LET'S TALK</span><h2>和${esc(p.agent)}聊聊</h2><p>告诉我您喜欢哪只，<br>我帮您确认下一步的资料。</p>${p.qr?`<img class="advisor-qr" src="${esc(p.qr)}" alt="${esc(p.agent)}上传的微信二维码原图"><span class="qr-instruction">长按识别二维码，告诉我您的决定</span>`:'<div class="qr-empty"><span>＋</span><p>顾问尚未上传二维码</p></div><span class="qr-instruction">可复制微信号，回到原微信对话联系</span>'}${p.wechat?`<button class="wechat-copy" data-action="copy-wechat">复制微信号：${esc(p.wechat)}</button>`:'<p class="qr-instruction">微信号待补充，请回到原对话联系顾问。</p>'}<small>二维码识别取决于微信当前页面环境，<br>如未弹出识别菜单，可使用微信号联系。</small>`;if(!modal.open)modal.showModal();}
// Never preload/auto-play Feishu videos. Start the network request only
// after a real user clicks the video on a specific cat card.
async function playCatVideo(id,button){
 const cat=proposal?.cats.find(c=>c.id===id);
 if(!cat||!cat.video||cat.stock==='unavailable')return notify('这只猫的最新库存状态需先核实');
 const box=button.closest('.cat-media');if(!box)return;
 let video=box.querySelector('video');
 if(!video){
  video=document.createElement('video');video.controls=true;video.playsInline=true;video.preload='none';video.poster=cat.image||'';
  video.setAttribute('webkit-playsinline','');video.setAttribute('aria-label',cat.name+'的视频');
  video.addEventListener('error',()=>{video.remove();button.hidden=false;notify('视频暂时无法播放，请联系顾问获取原视频');});
  box.append(video);
  video.src=cat.video;
 }
 button.hidden=true;
 try{await video.play();}catch{button.hidden=false;notify('浏览器未能自动播放，请点击视频自带的播放按钮');}
}

document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;if(b.dataset.action==='contact')contact();else if(b.dataset.action==='close-contact')modal.close();else if(b.dataset.action==='copy-wechat'){try{await navigator.clipboard.writeText(proposal.wechat);notify('微信号已复制，返回微信即可联系');}catch{let input=document.querySelector('#wechat-fallback');if(!input){input=document.createElement('input');input.id='wechat-fallback';input.readOnly=true;input.value=proposal.wechat;input.setAttribute('aria-label','可手动复制的微信号');modal.append(input);}input.focus();input.select();notify('请长按输入框，手动复制微信号');}}else if(b.dataset.action==='play-video')await playCatVideo(b.dataset.id,b);else if(b.dataset.action==='refresh-stock')refreshStock(true).catch(()=>{});});
modal.addEventListener('click',e=>{if(e.target!==modal)return;const r=modal.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)modal.close();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const video of document.querySelectorAll('video'))video.pause();});
document.addEventListener('error',e=>{const image=e.target;if(image.tagName!=='IMG')return;if(image.closest('.cat-media')){
 const cat=proposal?.cats.find(c=>c.id===image.dataset.catPhoto);
 const choices=cat?photoChoices(cat):[];
 const next=(Number(image.dataset.photoIndex)||0)+1;
 if(next<choices.length){image.dataset.photoIndex=String(next);image.src=choices[next];return;}
 image.hidden=true;const box=image.closest('.cat-media');if(!box.querySelector('.missing-cat-image')){const label=document.createElement('div');label.className='missing-cat-image';label.textContent='照片暂无法显示，请联系顾问补发实拍图';box.append(label);}
 }else if(image.classList.contains('advisor-qr')){image.hidden=true;notify('二维码暂时无法读取，请复制微信号联系');}},true);
// A cheap D1 check on return catches revoked/expired links without reloading Feishu.
let checkingLink=false,lastLinkCheck=0;
async function checkLinkOnReturn(){
 if(!proposal||checkingLink||document.hidden||Date.now()-lastLinkCheck<10000)return;
 checkingLink=true;lastLinkCheck=Date.now();
 try{await api('/api/proposals/'+token,{timeout:7000});}
 catch(error){if([404,410].includes(error.status))failPage(error.message);}
 finally{checkingLink=false;}
}
window.addEventListener('focus',()=>{checkLinkOnReturn().catch(()=>{});refreshStock().catch(()=>{});});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkLinkOnReturn().catch(()=>{});refreshStock().catch(()=>{});}});
start();
