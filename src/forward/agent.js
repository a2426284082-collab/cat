import './forward.css';
import {api,esc,money,day,dateLabel,safeMedia,shareCopy} from './shared.js';
import {readSharePreferences,saveSharePreferences,shareExpiryDays} from './preferences.js';
const app=document.querySelector('#forward-app'),modal=document.querySelector('#forward-modal');
let qrLoading=false,qrVersion=0;
let user=null,profile=null,catalog=[],step=1,breed='',result=null,history=null,busy=false,timer,qrPending,requestKey=null,requestShape='';
let draft={ids:[],prices:{},name:'',note:'',expires:day(7)};
let defaults={note:'',days:7};
function device(){try{let id=localStorage.getItem('sales-device-id');if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id||'')){id=crypto.randomUUID();localStorage.setItem('sales-device-id',id);}return id;}catch{return null;}}
const deviceId=device()||crypto.randomUUID();
function notify(text){const el=document.querySelector('#forward-toast');el.textContent=text;el.classList.add('visible');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('visible'),4000);}
function stash(){if(!user)return;try{sessionStorage.setItem('proposal-draft:'+user.id,JSON.stringify(draft));}catch{}}
function selected(){return draft.ids.map(id=>catalog.find(c=>c.id===id)).filter(Boolean);}
function authPage(message=''){
 user=null;profile=null;catalog=[];result=null;history=null;defaults={note:'',days:7};qrPending=undefined;qrLoading=false;qrVersion++;
 app.innerHTML=`<header class="forward-header"><a href="/cats/" class="logo">猫源库<span>专属转发</span></a></header><main class="forward-main"><section class="intro"><span class="kicker">YOUR PERSONAL SELECTION</span><h1>先确认，这份推荐属于谁。</h1><p>使用原代理激活码进入即可，<br>生成转发页不调用 AI，也不扣 AI 次数。</p></section><form id="login-form" class="config-panel login-panel"><label>代理激活码<input name="code" required maxlength="24" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off"></label><p class="field-hint">${esc(message||'客户打开收到的方案不需要登录。未激活代理仍可回猫源库免费找猫。')}</p><button class="primary full" type="submit">验证代理身份</button><a class="return-link" href="/cats/">返回猫源库</a></form></main>`;
}
async function start(){
 try{const session=await api('/api/ai/session');if(!session.user||session.user.is_guest)return authPage();user=session.user;await loadAgent();}
 catch(error){authPage([401,403].includes(error.status)?'请用代理激活码进入。':error.message);}
}
async function loadAgent(){
 app.innerHTML='<p class="forward-loading">正在读取顾问名片与猫源…</p>';
 const [p,c]=await Promise.all([api('/api/agent/profile'),api('/api/agent/catalog')]);profile=p.data;catalog=c.data;history=null;defaults=readSharePreferences(user.id,localStorage);
 draft={ids:[],prices:{},name:'',note:defaults.note,expires:day(defaults.days)};
 try{const saved=JSON.parse(sessionStorage.getItem('proposal-draft:'+user.id));if(saved&&Array.isArray(saved.ids)&&saved.prices)draft={...draft,...saved};}catch{}
 if(!draft.expires||draft.expires<day()||draft.expires>day(30))draft.expires=day(defaults.days);
 const raw=new URLSearchParams(location.search).get('ids');if(raw){const ids=raw.split(',').map(id=>id.trim()).filter(Boolean);if(ids.length>3)notify('转发页最多推荐3只，已保留前3只');draft.ids=[...new Set(ids)].slice(0,3);window.history.replaceState(null,'','/forward/');}
 const missing=draft.ids.some(id=>!catalog.some(c=>c.id===id&&safeMedia(c.image)));draft.ids=draft.ids.filter(id=>catalog.some(c=>c.id===id&&safeMedia(c.image))).slice(0,3);
 for(const c of selected())if(draft.prices[c.id]==null&&Number.isFinite(c.price))draft.prices[c.id]=Math.round((c.price+profile.default_markup)*100)/100;
 if(missing)notify('部分猫咪已下架或没有照片，已从分享方案中移除，请核对');stash();render();
}
function render(){if(!user||!profile)return;
 app.innerHTML=`<header class="forward-header"><a href="/cats/" class="logo">猫源库<span>专属转发</span></a><div class="forward-header-actions"><button data-action="history">我的方案</button><button data-action="logout">退出代理</button></div></header><main class="forward-main"><div class="stepper">${['挑选猫咪','称呼与报价','预览与转发'].map((label,i)=>`<span class="${step===i+1?'active':step>i+1?'completed':''}"><b>${step>i+1?'✓':i+1}</b>${label}</span>`).join('')}</div>${history?historyPage():step===1?selectionPage():step===2?configurePage():resultPage()}</main>${!history&&step===1?`<div class="forward-dock"><div><strong>已为【${esc(draft.name||'新建客户')}】挑选 ${draft.ids.length} 只</strong><small>最多3只 · 生成前会再次核对库存</small></div><button class="primary" data-action="configure" ${draft.ids.length?'':'disabled'}>配置方案 →</button></div>`:''}`;
}
function selectionPage(){const breeds=[...new Set(catalog.map(c=>c.breed).filter(Boolean))].sort();return `<section class="intro"><span class="kicker">A SELECTION, JUST FOR YOU</span><h1>把好猫，认真推荐给 TA。</h1><p>选1–3只，填称呼和对客价。<br>不需要先建客户档案。</p></section><div class="breed-tabs">${['',...breeds].map(v=>`<button class="${breed===v?'active':''}" data-action="breed" data-value="${esc(v)}">${esc(v||'全部猫源')}</button>`).join('')}<button data-action="refresh-stock">刷新猫源</button></div><div class="forward-cats">${catalog.filter(c=>!breed||c.breed===breed).map(c=>`<article class="pick-card ${draft.ids.includes(c.id)?'picked':''}"><div class="pick-photo">${safeMedia(c.image)?`<img src="${esc(c.image)}" alt="${esc(c.breed)}资料图片" loading="lazy">`:'<div class="missing-photo">图片待补充</div>'}<span>${c.videos?.length?'视频资料已录入':'视频待补充'}</span><button class="pick-plus" data-action="pick" data-id="${esc(c.id)}" ${safeMedia(c.image)?'':'disabled title="无照片不可加入分享方案"'} aria-label="${draft.ids.includes(c.id)?'移除':'选择'}${esc(c.id)}" aria-pressed="${draft.ids.includes(c.id)}">${draft.ids.includes(c.id)?'✓':'＋'}</button></div><div class="pick-copy"><h2>${esc(c.breed||'品种待确认')} · ${esc(c.color)}</h2><p>${esc(c.gender||'性别待确认')} · 月龄 ${esc(c.age||'待确认')} · 疫苗 ${esc(c.vaccine||'待确认')}</p><div><strong>#${esc(c.id)}</strong><small>供货 ¥${c.price==null?'待核实':money(c.price)}</small></div></div></article>`).join('')||'<p class="page-note">当前没有可选猫源，请稍后刷新。</p>'}</div><p class="page-note">这里展示在售列表，生成方案时会重新核验；页面选择不代表锁定库存。</p>`;}
function gapText(c){const price=draft.prices[c.id];if(price===''||price==null||!Number.isFinite(Number(price)))return '填写售价后计算';if(c.price==null)return '供货价待核实';const gap=Math.round((Number(price)-c.price)*100)/100;return gap<0?`低于供货价 ¥${money(-gap)}`:`预计价差 ¥${money(gap)}`;}
function configurePage(){return `<section class="intro compact"><span class="kicker">MAKE IT PERSONAL</span><h1>一份专属，比一串素材更用心。</h1><p>客户只看到对客售价，<br>不会收到供货底价和预计价差。</p></section><form id="proposal-form"><section class="config-panel"><label class="big-label">客户可见称呼<input name="customer" maxlength="30" required placeholder="例如：李女士（不要带入内部微信备注）" value="${esc(draft.name)}"></label><p class="field-hint">客户页会显示「HI, <span id="visible-name-preview">${esc(draft.name||'李女士')}</span> 👋」</p></section><div class="quote-list">${selected().map(c=>`<article class="quote-card"><div class="quote-cat">${c.image?`<img src="${esc(c.image)}" alt="${esc(c.id)}图片">`:''}<div><h2>${esc(c.breed||'猫咪')} · ${esc(c.color)}</h2><p>#${esc(c.id)} · ${esc(c.gender)} · 月龄 ${esc(c.age||'待确认')}</p></div></div><div class="internal-price"><span>供货底价 <b>${c.price==null?'待核实':'¥'+money(c.price)}</b></span><small>仅顾问可见 · 不进入客户页面</small></div><label class="price-label">对客售价<div class="price-input"><span>¥</span><input name="price-${esc(c.id)}" data-price="${esc(c.id)}" type="number" inputmode="decimal" min="0" max="1000000" step="0.01" required value="${esc(draft.prices[c.id]??'')}" aria-label="${esc(c.id)}对客售价"></div></label><div class="gap-line" data-gap="${esc(c.id)}">${gapText(c)}</div><p class="cost-note">价差未扣除运输、手续费及售后等成本。</p></article>`).join('')}</div><section class="config-panel"><label>想对客户说的话（选填）<textarea name="note" rows="3" maxlength="500" placeholder="按你的预算和喜好，先挑了这几只，慢慢看看。">${esc(draft.note)}</textarea></label><label>报价有效至<input type="date" name="expires" min="${day()}" max="${day(30)}" required value="${esc(draft.expires)}"></label><p class="field-hint">常用留言、报价有效天数可以和顾问名片一起保存，下次创建方案自动带入；不会保存客户称呼或单只猫报价。</p><details class="profile-details" ${profile.updated_at?'':'open'}><summary>顾问名片与微信二维码（保存后可复用）</summary><label>顾问称呼<input name="agent" maxlength="30" value="${esc(profile.name)}"></label><label>工作室名称<input name="brand" maxlength="40" value="${esc(profile.brand)}"></label><label>微信号<input name="wechat" maxlength="60" value="${esc(profile.wechat)}"></label><label>默认加价金额<input name="markup" type="number" min="0" max="1000000" step="0.01" value="${profile.default_markup}"></label><label>上传微信二维码原图<input type="file" id="profile-qr" accept="image/png,image/jpeg,image/webp"></label><p class="field-hint">300KB以内，保留原文件。至少填写微信号或上传二维码。</p><div id="qr-preview">${(qrPending===null?null:qrPending||profile.qr_url)?`<img src="${esc(qrPending||profile.qr_url)}" alt="顾问二维码"><button type="button" data-action="remove-qr">移除二维码</button>`:'<p class="field-hint">尚未上传二维码</p>'}</div></details><div class="save-defaults-row"><button type="button" data-action="save-defaults">💾 保存常用设置</button><small>顾问名片及默认加价：账号云端保存；常用留言及有效期：此浏览器按代理账号保存</small></div></section><p class="page-note">请核对称呼、售价和名片。健康、定金与运输条件需要另行确认，生成页面不锁定库存。</p><div class="config-actions"><button type="button" data-action="back-select">← 继续挑选</button><button class="primary" type="submit" ${busy?'disabled':''}>${busy?'正在核验库存并保存…':'生成专属转发页 →'}</button></div></form>`;}
function link(row=result){return location.origin+row.url;}
function resultPage(){return `<section class="intro compact"><span class="success-mark">✓</span><span class="kicker">READY TO SHARE</span><h1>给${esc(result.customer_name)}的方案，准备好了。</h1><p>${result.cats.length}只推荐 · 已保存对客报价 · 有效至${dateLabel(result.expires_at)}</p></section><div class="result-card"><div class="result-photos">${result.cats.filter(c=>c.image).map(c=>`<img src="${esc(c.image)}" alt="${esc(c.id)}资料图片">`).join('')}</div><h2>HI, ${esc(result.customer_name)} 👋</h2><p>客户打开链接不需要登录。</p><a class="primary full button-link" href="${esc(result.url)}" target="_blank" rel="noopener noreferrer">预览客户页面 ↗</a><button class="full" data-action="copy-forward">复制转发文案与链接</button><button class="full subtle" data-action="copy-link">只复制短链接</button><input class="share-url" readonly aria-label="专属方案短链接" value="${esc(link())}"></div><p class="page-note result-note">对客报价保留生成时的金额，不锁定上游供货价或库存。客户打开页面会重新核验；已售、下架或核验失败会明确提示。</p><button class="text-button" data-action="edit-result">← 按当前内容再生成一份</button><button class="primary full new-proposal-button" data-action="new-proposal">＋ 按保存的常用设置新建方案</button>`;}
function historyPage(){return `<section class="intro compact"><h1>我的专属方案</h1><p>仅展示当前代理最近50份，撤回后原链接立即失效。</p></section><div class="proposal-history">${history.map(row=>{const inactive=row.revoked_at||row.expires_at<=Date.now()/1000;return `<article><div><strong>给${esc(row.customer_name)}的方案</strong><small>${row.cats.length}只 · ${row.revoked_at?'已撤回':row.expires_at<=Date.now()/1000?'已到期':'有效至'+dateLabel(row.expires_at)}</small></div><div class="history-actions"><a href="${esc(row.url)}" target="_blank" rel="noopener noreferrer">预览</a><button data-action="history-copy" data-id="${row.id}" ${inactive?'disabled':''}>复制链接</button><button data-action="revoke" data-id="${row.id}" ${inactive?'disabled':''}>撤回</button></div></article>`;}).join('')||'<p class="page-note">还没有保存的方案。</p>'}</div><button class="primary full" data-action="back-select">继续选猫</button>`;}
function showError(error){if([401,403].includes(error.status)){authPage(error.message);return;}notify(error.message||'操作未能完成，请稍后重试');}
async function copy(value){try{await navigator.clipboard.writeText(value);notify('已复制');}catch{modal.innerHTML=`<h2>手动复制</h2><textarea rows="7" readonly>${esc(value)}</textarea><button data-action="close-modal">关闭</button>`;modal.showModal();}}
function readForm(form){const data=Object.fromEntries(new FormData(form));draft.name=String(data.customer||'').trim();draft.note=String(data.note||'');draft.expires=data.expires;for(const c of selected())draft.prices[c.id]=data[`price-${c.id}`];return data;}

function reusablePreferences(){return {note:draft.note,days:shareExpiryDays(draft.expires,day())};}
async function saveProfileFromForm(data){
 if(!data.agent?.trim()||!data.brand?.trim()||!data.wechat?.trim()&&!qrPending&&!profile.qr_url)throw new Error('请先填写顾问称呼、工作室和至少一种联系方式');
 const markup=Number(data.markup);
 if(!Number.isFinite(markup)||markup<0||markup>1000000||Math.abs(Math.round(markup*100)-markup*100)>1e-6)throw new Error('默认加价须为0至1000000元，最多两位小数');
 const next=(await api('/api/agent/profile',{method:'PUT',body:{name:data.agent.trim(),brand:data.brand.trim(),wechat:(data.wechat||'').trim(),default_markup:markup,...(qrPending!==undefined?{qr_data:qrPending}:{}),device_id:deviceId}})).data;
 profile=next;qrPending=undefined;
 return next;
}
function resetForNewCustomer(){
 defaults=readSharePreferences(user.id,localStorage);
 draft={ids:[],prices:{},name:'',note:defaults.note,expires:day(defaults.days)};
 requestKey=null;requestShape='';history=null;result=null;step=1;
 stash();render();window.scrollTo(0,0);
}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b||b.disabled||busy)return;const action=b.dataset.action;
 try{
  if(action==='pick'){const id=b.dataset.id;if(draft.ids.includes(id))draft.ids=draft.ids.filter(x=>x!==id);else{if(draft.ids.length>=3)return notify('每份转发页最多选3只');const c=catalog.find(c=>c.id===id);if(!c||!safeMedia(c.image))return notify('这只猫没有可用照片，请先让管理员在飞书补充图片');draft.ids.push(id);if(draft.prices[id]==null&&c.price!=null)draft.prices[id]=Math.round((c.price+profile.default_markup)*100)/100;}stash();render();}
  else if(action==='breed'){breed=b.dataset.value;render();}
  else if(action==='configure'){step=2;render();window.scrollTo(0,0);}
  else if(action==='back-select'){const form=document.querySelector('#proposal-form');if(form){const values=readForm(form);profile={...profile,name:values.agent,brand:values.brand,wechat:values.wechat,default_markup:Number(values.markup)};}history=null;step=1;stash();render();window.scrollTo(0,0);}
  else if(action==='history'){const r=await api('/api/agent/proposals');history=r.data;render();window.scrollTo(0,0);}
  else if(action==='refresh-stock'){const r=await api('/api/agent/catalog?fresh=1');catalog=r.data;const missing=draft.ids.some(id=>!catalog.some(c=>c.id===id));draft.ids=draft.ids.filter(id=>catalog.some(c=>c.id===id));stash();render();notify(missing?'已移除不在售的选择，请重新核对':'猫源已重新核验');}
  else if(action==='copy-forward')await copy(shareCopy(result.customer_name,result.cats.length,link()));
  else if(action==='copy-link')await copy(link());
  else if(action==='history-copy'){const row=history.find(r=>r.id===b.dataset.id);if(row)await copy(link(row));}
  else if(action==='edit-result'){requestKey=null;requestShape='';history=null;step=2;render();window.scrollTo(0,0);}
  else if(action==='new-proposal'){resetForNewCustomer();}
  else if(action==='save-defaults'){
   if(qrLoading)return notify('二维码还在读取，请稍候');
   const form=document.querySelector('#proposal-form');if(!form)return;const data=readForm(form);stash();
   const prefs=reusablePreferences();
   busy=true;b.disabled=true;b.textContent='正在保存…';
   let saved=false;
   try{await saveProfileFromForm(data);defaults=saveSharePreferences(user.id,prefs,localStorage);saved=true;notify('常用设置已保存，下次新建方案自动使用');}
   finally{busy=false;if(saved)render();else if(b.isConnected){b.disabled=false;b.textContent='💾 保存常用设置';}}
  }
  else if(action==='remove-qr'){qrPending=null;profile.qr_url=null;qrLoading=false;qrVersion++;document.querySelector('#qr-preview').innerHTML='<p class="field-hint">生成时将移除二维码，请确保已填写微信号。</p>';}
  else if(action==='revoke'){modal.innerHTML=`<h2>撤回这份方案？</h2><p>客户再次打开原链接将看到失效提示。已经保存的图片和截图无法远程删除。</p><button class="primary" data-action="confirm-revoke" data-id="${b.dataset.id}">确认撤回</button><button data-action="close-modal">取消</button>`;modal.showModal();}
  else if(action==='confirm-revoke'){await api(`/api/agent/proposals/${b.dataset.id}/revoke`,{method:'POST',body:{device_id:deviceId}});modal.close();history=(await api('/api/agent/proposals')).data;render();notify('已撤回，原链接不再提供方案资料');}
  else if(action==='close-modal')modal.close();
  else if(action==='logout'){await api('/api/ai/logout',{method:'POST',body:{device_id:deviceId}});authPage('已退出，请使用代理激活码重新进入。');}
 }catch(error){showError(error);}
});
document.addEventListener('input',e=>{const el=e.target;if(!user)return;if(el.dataset.price){draft.prices[el.dataset.price]=el.value;const c=catalog.find(c=>c.id===el.dataset.price);for(const line of document.querySelectorAll('[data-gap]'))if(line.dataset.gap===c.id)line.textContent=gapText(c);}else if(el.name==='customer'){draft.name=el.value;document.querySelector('#visible-name-preview').textContent=el.value||'李女士';}else if(el.name==='note')draft.note=el.value;else if(el.name==='expires')draft.expires=el.value;else return;stash();});
document.addEventListener('change',e=>{if(e.target.id!=='profile-qr'||!e.target.files?.[0])return;const file=e.target.files[0];if(file.size>300*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))return notify('请上传300KB以内的PNG、JPEG或WebP图片');qrLoading=true;const version=++qrVersion;const reader=new FileReader();reader.onload=()=>{if(version!==qrVersion)return;qrLoading=false;qrPending=reader.result;const preview=document.querySelector('#qr-preview');if(!preview)return;preview.innerHTML=`<img src="${esc(qrPending)}" alt="待保存的二维码原图"><button type="button" data-action="remove-qr">移除二维码</button>`;};reader.onerror=()=>{qrLoading=false;notify('图片读取失败，请重试');};reader.readAsDataURL(file);});
document.addEventListener('submit',async e=>{
 if(!['login-form','proposal-form'].includes(e.target.id))return;e.preventDefault();if(busy)return;if(qrLoading)return notify('二维码还在读取，请稍候');const form=e.target;
 if(form.id==='login-form'){busy=true;const button=form.querySelector('button');button.disabled=true;try{const data=new FormData(form);await api('/api/ai/activate',{method:'POST',body:{key_code:data.get('code'),device_id:deviceId}});await start();}catch(error){notify(error.message);button.disabled=false;}finally{busy=false;}return;}
 const data=readForm(form);stash();
 if(!data.agent?.trim()||!data.brand?.trim()||!data.wechat?.trim()&&!qrPending&&!profile.qr_url){document.querySelector('.profile-details').open=true;return notify('请填写顾问称呼、工作室和至少一种联系方式');}
 if(selected().some(c=>!safeMedia(c.image)))return notify('所选猫咪缺少照片，请返回选猫页更换');const items=selected().map(c=>({id:c.id,price:draft.prices[c.id]===''?NaN:Number(draft.prices[c.id]),expected_base:c.price}));if(!draft.name||items.length!==draft.ids.length||items.some(c=>!Number.isFinite(c.price)||c.price<0||c.price>1000000))return notify('请核对客户称呼、在售选择和每只猫的售价');
 busy=true;const button=form.querySelector('button[type="submit"]');button.disabled=true;button.textContent='正在核验库存、猫咪照片并保存…';
 try{await saveProfileFromForm(data);
  const payload={customer_name:draft.name,note:draft.note,expires:draft.expires,items,device_id:deviceId},shape=JSON.stringify(payload);if(shape!==requestShape||!requestKey){requestShape=shape;requestKey=crypto.randomUUID();}
  result=(await api('/api/agent/proposals',{method:'POST',body:{...payload,request_key:requestKey},timeout:55000})).data;try{sessionStorage.removeItem('proposal-draft:'+user.id);}catch{}step=3;history=null;render();window.scrollTo(0,0);
 }catch(error){showError(error);}finally{busy=false;if(button.isConnected){button.disabled=false;button.textContent='生成专属转发页 →';}}
});
let checkingSession=false;async function checkSession(){if(!user||busy||checkingSession||document.hidden)return;checkingSession=true;try{const r=await api('/api/ai/session');if(!r.user||r.user.is_guest||r.user.id!==user.id)authPage('代理身份已变化，请重新进入。');}catch(error){if([401,403].includes(error.status))authPage('代理身份已失效，请重新进入。');}finally{checkingSession=false;}}
window.addEventListener('focus',checkSession);setInterval(checkSession,60000);start();
