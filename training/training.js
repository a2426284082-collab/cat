// Standalone, local-only practice. No messages, payments or orders are submitted.
(() => {
'use strict';
const KEY='cat-sales-guided-practice-v4';
const $=s=>document.querySelector(s);
const money=n=>`¥${Number(n).toLocaleString('zh-CN')}`;
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cats=[{id:'C-102',name:'海双布偶妹妹',age:'2 个月',cost:900},{id:'C-118',name:'蓝双布偶妹妹',age:'3 个月',cost:1050},{id:'C-126',name:'海双布偶妹妹',age:'2 个月',cost:1150},{id:'C-139',name:'重点色布偶妹妹',age:'3 个月',cost:980}];
const lessons=[['看一条示范','看看别人怎么发'],['照着发一次','文案已帮你填好'],['找想买的人','谁在认真找猫？'],['聊第一句','先回应她的需求'],['听懂客户','看清她的五个要求'],['挑 3 只猫','给客户几个选择'],['给客户报价','别超预算，别低于成本'],['发给客户看','图片和价格一起发'],['接住客户回复','看她还有什么顾虑'],['成交前确认','记住要核对的四件事']];
const tips=['跟着做一次就好，不用背话术。点错了，也可以再试。','先帮第一次养猫的人解决一个小问题，她才愿意继续看。','素材和文案已经备好。先看一眼，点一次模拟发布就行。','先找主动问价格、说出想要什么的人。','先回应她说过的话，再问一个简单的问题。','记住她要什么，后面选猫就有方向了。','先给三个选择。太多了，客户反而不好选。','报价要在客户预算内，也不能低于进货价。还要留意运费。','发图片和报价，再问她更喜欢哪只。','她有顾虑，我们就先弄清楚她担心什么。','客户想买了，也要先核对猫咪、健康资料、费用和售后。'];
const defaultTitle='新手养布偶猫的 5 个实用小技巧 🐱';
const defaultCaption='从饮食、环境到互动，帮你少走弯路，让小猫咪健康快乐成长～';
const initial=()=>({step:0,reached:0,done:[],observed:[],publishChecks:[],title:defaultTitle,caption:defaultCaption,topics:['布偶猫','新手养猫','养猫攻略'],visibility:'public',published:false,lead:false,reply:false,demand:[],selected:[],prices:{},budget:1500,materialsSent:false,branch:'',visited:[],healthAnswered:false,checked:[],finished:false});
let state=initial(),storageAvailable=true;
const cleanList=(a,max)=>[...new Set((Array.isArray(a)?a:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<max))];
try {
 const raw=JSON.parse(localStorage.getItem(KEY)||'null');
 if(raw&&typeof raw==='object'&&Number.isInteger(raw.step)&&raw.step>=0&&raw.step<=10){
  state={...initial(),...raw};
  ['published','lead','reply','materialsSent','healthAnswered','finished'].forEach(k=>state[k]=raw[k]===true);
  state.done=cleanList(raw.done,11).filter(n=>n>0);state.observed=cleanList(raw.observed,3);state.publishChecks=cleanList(raw.publishChecks,3);state.demand=cleanList(raw.demand,5);
  state.selected=cleanList(raw.selected,4).sort((a,b)=>a-b).slice(0,3);state.checked=cleanList(raw.checked,4);state.budget=raw.budget===1400?1400:1500;
  state.topics=(Array.isArray(raw.topics)?raw.topics:[]).filter(t=>['布偶猫','新手养猫','养猫攻略'].includes(t));
  state.title=typeof raw.title==='string'?raw.title.slice(0,40):defaultTitle;state.caption=typeof raw.caption==='string'?raw.caption.slice(0,500):defaultCaption;
  state.visibility=raw.visibility==='private'?'private':'public';
  state.prices=Object.fromEntries(Object.entries(raw.prices&&typeof raw.prices==='object'?raw.prices:{}).filter(([i,n])=>/^[0-3]$/.test(i)&&Number.isFinite(n)&&n>0&&n<100000));
  state.visited=(Array.isArray(raw.visited)?raw.visited:[]).filter(v=>['no','ask','yes'].includes(v));state.branch=['no','ask'].includes(raw.branch)&&raw.step===9?raw.branch:'';
  let available=1;while(available<10&&state.done.includes(available))available++;
  state.reached=Math.min(available,Number.isInteger(raw.reached)?Math.max(0,raw.reached):0);state.step=Math.min(state.step,state.reached);
  if(state.step>=7&&state.selected.length!==3){state.step=6;state.reached=6;state.done=state.done.filter(n=>n<6);}
  if(state.step>=8&&!state.selected.every(validPrice)){state.step=7;state.reached=7;state.done=state.done.filter(n=>n<7);}
  state.finished=state.finished&&state.step===10&&state.checked.length===4&&state.done.includes(10);
 }
}catch{storageAvailable=false;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));storageAvailable=true;}catch{storageAvailable=false;}$('#saveStatus').textContent=storageAvailable?'进度保存在当前浏览器':'当前进度可练习，但浏览器未能保存';}
let toastTimer;
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3200);}
const arrow='<span aria-hidden="true">→</span>';
const primary=(text,action='next',disabled=false)=>`<button class="button primary" data-action="${action}" ${disabled?'disabled':''}>${text}${arrow}</button>`;
const actions=(text,disabled=false,action='next')=>`<div class="panel-actions"><button class="back-button" data-action="prev">‹ 上一步</button>${primary(text,action,disabled)}</div>`;
const note=(text,warm=false)=>`<div class="tip-card ${warm?'warm':''}"><span class="tip-symbol">${warm?'!':'💡'}</span><div><b>${warm?'温馨提示':'小贴士'}</b><p>${text}</p></div></div>`;
const task=text=>`<div class="task-line"><span>这一步做什么</span><b>${text}</b></div>`;
const feedback=(id,text='',good=false)=>`<p class="feedback ${good?'good':''}" id="${id}" role="status" ${text?'':'hidden'}>${text}</p>`;
const photo=(i,cls='')=>`<span class="cat-photo crop-${i} ${cls}"><img src="/training-assets/selection-reference.png" alt="${cats[i].name}的模拟图片" draggable="false"></span>`;
const reference=(file,label='查看对应示范图')=>`<details class="reference"><summary>${label}<span>↗</span></summary><img src="/training-assets/${file}" alt="本步界面参考图" loading="lazy"></details>`;
function shell(title,lead,body){const phase=state.step<=4?'获客带练':'成交带练',n=state.step<=4?state.step:state.step-4;$('#panel').innerHTML=`<div class="panel-heading" tabindex="-1"><span class="step-kicker">${phase} · 第 ${n} 步</span><h2>第 ${n} 步：${title}</h2><p class="panel-lead">${lead}</p></div>${body}`;}
function invalidate(from){state.done=state.done.filter(n=>n<from);state.reached=Math.min(state.reached,from);state.finished=false;if(from<=6){state.prices={};state.checked=[];state.materialsSent=false;}if(from<=7){state.checked=[];state.materialsSent=false;}if(from<=8)state.checked=[];}
function updateNavigation(){
 const done=state.done.length;$('#lessonPercent').textContent=`${done*10}%`;$('#lessonProgress').style.width=`${done*10}%`;
 $('#steps').innerHTML=lessons.map(([title,sub],i)=>`${i===0||i===4?`<div class="phase-label">${i===0?'01 找到客户':'02 接待客户'}</div>`:''}<button class="lesson-step ${state.step===i+1?'active':''} ${state.done.includes(i+1)?'completed':''}" data-step="${i+1}" ${i+1>state.reached?'disabled':''} ${state.step===i+1?'aria-current="step"':''}><span class="step-number">${state.done.includes(i+1)?'✓':String(i+1).padStart(2,'0')}</span><span><b>${title}</b><small>${sub}</small></span></button>`).join('');
 $('#phaseTitle').textContent=state.finished?'本次练习完成':state.step===0?'新手实战带练':state.step<=4?`获客带练 (${state.step}/4)`:`成交带练 (${state.step-4}/6)`;
 $('#phaseProgress').style.width=`${state.finished?100:state.step===0?0:state.step<=4?state.step/4*100:(state.step-4)/6*100}%`;$('#topBack').disabled=state.step===0;
 $('#stepStatus').textContent=state.finished?'练习完成 · 10 / 10 步':state.step?`第 ${state.step} / 10 步 · ${lessons[state.step-1][0]}`:'准备开始';
 $('#coachTip').textContent=state.finished?'你已经把完整流程走过一次了。以后遇到类似场景，可以先想：这一步，我要确认什么？':tips[state.step];
}
function updateChat(){
 let messages=[];
 if(state.step===0)messages=[{system:true,text:'今天先认识获客流程，再和小林完成一次模拟接待。'}];
 else if(state.step<=2)messages=[{system:true,text:'先把作品发出去。下一步，我们一起到评论区找有需求的人。'}];
 else if(state.step===3)messages=[{text:'请问这种猫大概多少钱？第一次养，想找只妹妹。'}];
 else if(state.step===4){messages=[{text:'请问布偶猫大概多少钱呀？'},{text:'第一次养，想找只妹妹。'}];if(state.reply)messages.push({me:true,text:'你好呀，看到你说第一次养、想找只妹妹。你喜欢布偶，还是想看看其他品种？'});}
 else{
  messages=[{text:`你好，想买一只布偶妹妹，最好两三个月，预算${state.budget}左右，可以发杭州吗？`}];
  if(state.step>=6)messages.push({me:true,text:'好的，我按你的预算和要求先筛几只，杭州的运输安排也会再确认。'});
  if(state.materialsSent||state.step>=9)messages.push({me:true,text:'按你的要求挑了 3 只，你看看哪只更有眼缘？喜欢哪只，我再帮你确认最新状态。'});
  if(state.step===9&&state.branch==='no')messages.push({text:'这几只都不太喜欢，最好能在1400以内呢？'});
  if(state.step===9&&state.branch==='ask')messages.push({text:'可以保证没有猫癣、到家一定健康吗？'});
  if(state.step>=10)messages.push({text:'我喜欢第二只，今天能买吗？'});
  if(state.finished)messages.push({me:true,text:'我先核对这只的编号与库存、健康资料、最终费用和书面约定，再和你确认下一步。'});
 }
 $('#customerStage').textContent=state.step<3?'完成获客后，她会来咨询':state.step<=4?'先接住她已经表达的需求':'布偶妹妹 · 杭州 · '+money(state.budget);
 $('#chat').innerHTML=messages.map(m=>`<div class="chat-message ${m.me?'me':''} ${m.system?'system':''}">${m.system?'':`<small>${m.me?'你':'小林'}</small>`}<p>${esc(m.text)}</p></div>`).join('');
}
function canNext(){switch(state.step){case 1:return true;case 2:return state.published;case 3:return state.lead;case 4:return state.reply;case 5:return state.demand.length===5;case 6:return state.selected.length===3;case 7:return state.selected.length===3&&state.selected.every(validPrice);case 8:return state.materialsSent;default:return false;}}
function render(focus=false){
 updateNavigation();updateChat();
 if(state.finished){$('#panel').innerHTML=`<div class="completion"><span class="complete-seal">✓</span><span class="eyebrow">这一次，你做到了</span><h2 tabindex="-1" class="panel-heading">第一次接待，练习完成。</h2><p>从作品发布，到成交前核对。<br>你已经亲手走过一条完整的路线。</p><div class="recap"><div><strong>10</strong><span>个步骤已完成</span></div><div><strong>3</strong><span>只猫咪已推荐</span></div><div><strong>${new Set(state.visited).size}</strong><span>种反馈已体验</span></div></div><div class="recap-note"><b>下次遇到客户，记住这三件事</b><p>先听需求 · 给有限的选择 · 核实后再承诺</p></div>${primary('再练一次','restart')}<button class="back-button" data-action="review">回看成交前核对</button><div class="completion-links"><a href="/">去猫源库熟悉真实猫源 →</a><a href="/assistant/" target="_blank" rel="noopener">需要起草回复？打开 AI 助手 ↗</a></div></div>`;}
 else if(state.step===0){$('#panel').innerHTML=`<div class="welcome"><span class="welcome-icon">✦</span><span class="eyebrow">不用背话术，先跟着做</span><h2 class="panel-heading" tabindex="-1">先练一遍，<br>再从容开口。</h2><p class="panel-lead">今天，我们陪你找到一位潜在客户，<br>再把她的第一次咨询接住。</p><div class="welcome-route"><div><span>01</span><b>找到客户</b><p>看作品 → 发一次 → 找评论 → 聊第一句</p></div><div><span>02</span><b>完成接待</b><p>听需求 → 挑猫 → 报价 → 确认成交</p></div></div><div class="welcome-promise"><span>✓ 每次一个小任务</span><span>✓ 点错有解释</span><span>✓ 暂停可接着练</span></div>${primary(state.reached?'从第一步开始回看':'开始我的第一次带练','start')}<small>这里是模拟练习，请放心尝试。</small></div>`;}
 else if(state.step===1){
  shell('看一条示范','看这条作品：用清楚的猫咪图片，分享第一次养猫的小知识。',`<div class="demo-layout"><figure class="demo-figure"><div class="demo-crop"><img src="/training-assets/demo-work.png" alt="示范作品：第一次养猫的5个注意事项"></div><figcaption>示范图片，不是视频</figcaption></figure><div class="learn-cards">${[['封面','一眼知道在讲什么','图片清楚，标题直接说“第一次养猫的 5 个注意事项”。'],['内容','先帮新人解决问题','分享饮食、环境和互动的小知识，让人觉得有用。'],['话题','和作品内容有关','带上“新手养猫”“养猫攻略”，让想养猫的人更容易找到你。']].map(([title,sub,detail],i)=>`<div class="learn-card static"><span class="learn-number">${i+1}</span><b>${title}</b><strong>${sub}</strong><p>${detail}</p></div>`).join('')}</div></div>${note('实际发布时，换成你有权使用的猫咪图片和核实过的内容。')}${actions('看懂了，照着发一次')}`);
 }
 else if(state.step===2){
  shell('照着发一次','图片和文案已经帮你准备好了。看一眼，就可以模拟发布。',`<div class="publish-editor"><div class="mock-toolbar"><b>准备发布的作品</b><span>这里只练习，不会真的发出去</span></div><div class="publish-photos">${[0,1,3].map(i=>photo(i)).join('')}</div><div class="post-preview"><h3>${esc(state.title)}</h3><p>${esc(state.caption)}</p><div class="preview-topics">${state.topics.map(t=>`<span>#${t}</span>`).join('')}</div><small>谁能看到：${state.visibility==='public'?'所有人':'仅自己'}</small></div><details class="optional-edit" id="postEdit"><summary>想改文案或设置？点这里 <span>可选</span></summary><label class="field-label" for="postTitle">标题</label><input class="text-input" id="postTitle" data-post="title" maxlength="40" value="${esc(state.title)}"><label class="field-label" for="postCaption">正文</label><textarea id="postCaption" data-post="caption" maxlength="500" rows="3">${esc(state.caption)}</textarea><div class="topic-options">${['布偶猫','新手养猫','养猫攻略'].map(t=>`<button class="topic ${state.topics.includes(t)?'selected':''}" data-topic="${t}" aria-pressed="${state.topics.includes(t)}">#${t}</button>`).join('')}</div><label class="visibility">谁能看到<select id="visibility"><option value="public" ${state.visibility==='public'?'selected':''}>所有人</option><option value="private" ${state.visibility==='private'?'selected':''}>仅自己</option></select></label></details>${feedback('publishFeedback')}</div>${actions('模拟发布，去找客户',false,'publish')}${reference('publish-real.png','想对照发布界面？点这里')}`);
 }
 else if(state.step===3){
  shell('找想买的人','看看谁在认真找猫。优先和说清自己想要什么的人聊。',`${task('谁最值得先聊聊？点一条评论。')}<div class="comments-demo"><div class="comment-cover"><img src="/training-assets/comments-real.png" alt="猫咪作品的评论区示范"></div><div class="comment-sheet"><div class="mock-toolbar"><b>作品评论</b><span>点击一条，练习判断</span></div>${[['甜','糖糖不甜','好可爱！毛好顺，是什么品种呀？','236'],['栗','小栗子','请问这种猫大概多少钱？第一次养，想找只妹妹','892'],['月','月亮与六便士','我家也有一只布偶，真的太黏人了～','126'],['芝','芝士奶盖','可以上门看吗？坐标南京','318']].map(([a,n,t,l],i)=>`<button class="comment-row ${state.lead&&i===1?'picked':''}" data-lead="${i}" aria-pressed="${state.lead&&i===1}"><span class="comment-avatar avatar-${i}">${a}</span><span class="comment-text"><span>${n}<small> · ${i+2} 小时前</small></span><b>${t}</b>${state.lead&&i===1?'<em>✓ 优先跟进 · 价格 + 新手 + 性别偏好</em>':'<small>回复</small>'}</span><span class="likes">♡ ${l}</span></button>`).join('')}</div></div>${feedback('leadFeedback',state.lead?'✓ 选对了！她同时说了价格、第一次养和性别偏好。这位用户就是下一步的模拟客户小林。':'',state.lead)}${note('询问品种、上门看猫也是兴趣信号。这次优先选需求最完整的人，先正常沟通，再了解更多。')}${actions('选好了，聊第一句',!canNext())}`);
 }
 else if(state.step===4){
  shell('聊第一句','她说是第一次养，想找只妹妹。选一句自然的开场。',`${task('你会怎么回她？选一句。')}<div class="dm-demo"><div class="dm-top"><span class="customer-avatar">林</span><div><b>客户小林</b><small>模拟聊天</small></div><span>•••</span></div><div class="dm-body"><span class="chat-time">今天 14:20</span><p class="dm-bubble">请问布偶猫大概多少钱呀？</p><p class="dm-bubble">第一次养，想找只妹妹。</p>${state.reply?'<p class="dm-bubble outgoing">你好呀，看到你说第一次养、想找只妹妹。你喜欢布偶，还是想看看其他品种？</p><small class="sent-note">✓ 已模拟回复</small>':''}</div></div><div class="reply-choices"><button class="choice-card" data-dm="bad">你好，我们这里有很多猫，价格便宜，需要买吗？</button><button class="choice-card ${state.reply?'picked':''}" data-dm="good">你好呀，看到你说第一次养、想找只妹妹。你喜欢布偶，还是想看看其他品种？${state.reply?'<em>✓ 先回应需求，再了解偏好</em>':''}</button></div>${feedback('dmFeedback',state.reply?'✓ 很自然！接下来，小林会把品种、年龄、预算和城市告诉你。':'',state.reply)}${reference('dm-real.png','看看私信示范图')}${actions('这样聊就好，看看她要什么',!canNext())}`);
 }
 else if(state.step===5){
  shell('听懂客户要什么','小林把需求说清楚了，我们已经帮你整理好。记住这五件事，就能开始选猫。',`<div class="customer-quote"><span class="customer-avatar">林</span><div><small>小林</small><p>想买一只布偶妹妹，最好两三个月，预算${state.budget}左右，可以发杭州吗？</p></div></div><div class="demand-list">${[['♧','品种','布偶猫','purple'],['♀','性别','妹妹 / 母','pink'],['▦','年龄','2—3 个月','mint'],['¥','预算',money(state.budget)+' 左右','yellow'],['⌖','收货城市','杭州','blue']].map(([ic,k,v,color])=>`<div class="demand-row ${color}"><span class="color-symbol">${ic}</span><span><small>${k}</small><b>${v}</b></span></div>`).join('')}</div>${note('客户没说清的，再补问一句；已经说清的，就不用重复问。')}${actions('明白了，挑 3 只猫',false,'confirm-demand')}${reference('demand-reference.png')}`);
 }
 else if(state.step===6){
  shell('挑 3 只猫','按她的要求挑三只就好，别一次发太多。点图片选，再点一次取消。',`${task('选三只给小林看看。')}<div class="selection-toolbar"><div class="filter-tags"><span class="purple">♧ 布偶妹妹</span><span class="mint">▦ 2—3 个月</span><span class="yellow">¥ 预算 ${money(state.budget)}</span></div><b id="selectionCount">已选 <strong>${state.selected.length}</strong> / 3 只</b></div><div class="cat-grid">${cats.map((c,i)=>`<button class="cat-card ${state.selected.includes(i)?'picked':''}" data-pick="${i}" aria-pressed="${state.selected.includes(i)}" aria-label="${c.id} ${c.name} ${c.age} 进货价${c.cost}元"><span class="selection-mark">${state.selected.includes(i)?'✓':''}</span>${photo(i)}<span class="cat-info"><b>${c.name}</b><small>${c.age} · 母</small><span><small>${c.id}</small><span>进货 <strong>${money(c.cost)}</strong></span></span></span></button>`).join('')}</div>${feedback('selectionFeedback',state.selected.length===3?'✓ 三只选择刚刚好。下一步，我们来算报价。':'',true)}${note('先挑选，再核实。猫咪实际状态、库存和运输方式，都需要在真实成交前确认。')}${actions('挑好了，给客户报价',!canNext())}<p class="helper">当前图片和进货价为练习示例。</p>`);
 }
 else if(state.step===7){
  state.selected.forEach((i,n)=>{if(!Number.isFinite(state.prices[i]))state.prices[i]=Math.min([1299,1399,1499][n],state.budget);});
  shell('给客户报价',`参考报价已填好。看一眼：别超过 ${money(state.budget)}，也别低于进货价。`,`${task('觉得价格合适就继续，想改也可以。')}<div class="price-list">${state.selected.map(i=>`<div class="price-item">${photo(i)}<div class="price-cat"><b>${cats[i].name}</b><small>${cats[i].id} · 进货 ${money(cats[i].cost)}</small><span class="mini-tags"><span>${cats[i].age}</span><span>杭州</span></span></div><label for="price-${i}">客户报价 (¥)<span class="price-input"><span>¥</span><input type="number" id="price-${i}" data-price="${i}" min="${cats[i].cost}" max="${state.budget}" step="1" inputmode="numeric" value="${state.prices[i]}" aria-describedby="priceError"></span></label></div>`).join('')}</div><div class="budget-card"><div><span>客户预算</span><strong>${money(state.budget)} / 只</strong></div><small>卖价减去进货价，<br>还要扣运费等费用。</small></div>${feedback('priceError')}${note('发给客户的资料只显示报价。实际卖猫前，记得把运费等费用算进去。')}${reference('quote-reference.png')}${actions('报价合适，看看客户资料',!canNext())}`);validatePrices();
 }
 else if(state.step===8){
  shell('发给客户看','把图片、编号和报价放在一起，客户更好选。下面就是她会看到的资料。',`<div class="material-list">${state.selected.map(i=>`<article class="material-card">${photo(i)}<div><h3>${cats[i].name} · <strong>${money(state.prices[i])}</strong></h3><p>${cats[i].id} · ${cats[i].age}</p><small>健康资料和最新状态，买之前再核对。</small></div></article>`).join('')}</div><div class="reply-example"><span>可以配上这句话</span><p>按你的要求挑了 3 只，你看看更喜欢哪只？喜欢哪只，我再帮你确认最新状态和运输安排。</p><button class="text-button" data-action="copy">复制这句话</button></div>${actions('模拟发送，看看回复',false,'send')}${reference('materials-reference.png')}`);
 }
 else if(state.step===9&&!state.branch){
  shell('客户回复了，怎么接？','想直接走完？选“已经选中”。也可以试试另外两种回复。',`${task('点一种回复，看看下一步。')}<div class="branch-list">${[['no','☏','还不满意，想再看看','先问清哪里不合适，再调整筛选条件。','pink'],['ask','✓','担心健康或售后','先核实资料，避免做绝对承诺。','blue'],['yes','♧','已经选中，想购买','确认库存和交易条件，再推进成交。','purple']].map(([type,ic,t,d,c])=>`<button class="branch-card ${c}" data-branch="${type}"><span class="color-symbol">${ic}</span><span><b>${t}</b><small>${d}</small>${state.visited.includes(type)?'<em>✓ 已体验</em>':''}</span><span class="branch-arrow">›</span></button>`).join('')}</div>${note('先听她担心什么，再决定是换猫、解释资料，还是确认购买。')}${reference('feedback-reference.png')}<div class="panel-actions"><button class="back-button" data-action="prev">‹ 上一步</button><span class="helper">点选上方一种回复</span></div>`);
 }
 else if(state.step===9&&state.branch==='no'){
  shell('她想再便宜一点','小林的新预算是 1400 元。我们按新预算重新挑，不直接乱降价。',`<div class="customer-quote"><span class="customer-avatar">林</span><div><small>小林 · 客户</small><p>这几只都不太喜欢，最好能在1400以内呢？</p></div></div><div class="reply-example"><span>可以这样接住她</span><p>可以的，那我先按 1400 以内重新挑一轮。品种和年龄要求先保持不变，你对花色还有特别的偏好吗？</p></div><div class="refilter-summary"><span>保留：布偶妹妹 · 2—3 个月 · 杭州</span><b>更新预算：¥1,400 以内</b></div>${note('我们会回到选猫和报价这两步。不要在没核算费用的情况下，直接给所有猫降价。')}<div class="panel-actions"><button class="back-button" data-action="feedback">‹ 返回其他反馈</button>${primary('按新预算，重新挑选','refilter')}</div>`);
 }
 else if(state.step===9&&state.branch==='ask'){
  shell('她担心猫咪健康','先查资料，再说清楚。选一句你会回复的话。',`<div class="customer-quote"><span class="customer-avatar">林</span><div><small>小林 · 客户</small><p>可以保证没有猫癣、到家一定健康吗？</p></div></div>${task('怎么回，才不会随口保证？')}<div class="reply-choices"><button class="choice-card" data-health="bad">放心，绝对健康，保证到家没有任何问题！</button><button class="choice-card ${state.healthAnswered?'picked':''}" data-health="good">我先按猫咪编号核对健康资料和最新状态，运输安排也会再确认。具体售后，我们在成交前把书面约定说清楚。</button></div>${feedback('healthFeedback',state.healthAnswered?'✓ 这样更有依据。先核实可核实的资料，再说明书面约定。':'',state.healthAnswered)}${note('练习中的回复是沟通示例。真实健康资料、运输与售后内容，都需要逐项确认。',true)}<a class="assistant-link" href="/assistant/" target="_blank" rel="noopener">需要帮助起草？在新窗口打开 AI 助手 ↗</a><div class="panel-actions"><button class="back-button" data-action="feedback">‹ 返回其他反馈</button>${primary('明白了，看看其他反馈','feedback',!state.healthAnswered)}</div>`);
 }
 else if(state.step===10){
  const i=state.selected[1];
  shell('成交前再确认','小林想买第二只。先别急着收款，这四件事要核对清楚。',`<div class="order-summary">${photo(i)}<div><b>${cats[i].id} · ${cats[i].name}</b><small>报价 ${money(state.prices[i])} · 收货城市 杭州</small></div></div><div class="confirm-list">${[['♧','是不是这只？还在售吗？','核对猫咪编号，再确认能不能出售。','purple'],['✚','健康资料核对了吗？','查看现有资料和最新状态，不随口保证。','pink'],['¥','价格和运输说清了吗？','确认总费用、怎么送、什么时候送。','yellow'],['▤','售后和付款说清了吗？','让客户看清书面约定，再推进付款。','blue']].map(([ic,t,d,c])=>`<div class="confirm-row ${c}"><span class="color-symbol">${ic}</span><span><b>${t}</b><small>${d}</small></span></div>`).join('')}</div><label class="finish-ack"><input type="checkbox" data-finish-ack ${state.checked.length===4?'checked':''}><span>我记住了：真正成交前，要把这四件事核对清楚。</span></label>${actions('记住了，完成练习',state.checked.length!==4,'finish')}${reference('confirm-reference.png')}`);
 }

 save();
 if(focus){$('.panel-heading')?.focus({preventScroll:true});if(matchMedia('(max-width:900px)').matches){$('.lesson-workspace').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});const nav=$('#steps'),active=nav.querySelector('[aria-current="step"]');if(active)nav.scrollLeft+=active.getBoundingClientRect().left-nav.getBoundingClientRect().left-(nav.clientWidth-active.offsetWidth)/2;}}
}
function updatePostPreview(){const el=$('.post-preview');if(el)el.innerHTML=`<h3>${esc(state.title)}</h3><p>${esc(state.caption)}</p><div class="preview-topics">${state.topics.map(t=>`<span>#${t}</span>`).join('')}</div><small>谁能看到：${state.visibility==='public'?'所有人':'仅自己'}</small>`;}
function validPrice(i){return Number.isInteger(state.prices[i])&&state.prices[i]>=cats[i].cost&&state.prices[i]<=state.budget;}
function validatePrices(){const errors=[];state.selected.forEach(i=>{const n=state.prices[i],input=$(`[data-price="${i}"]`);input?.setAttribute('aria-invalid',String(!validPrice(i)));if(!Number.isInteger(n)||n<=0)errors.push(`${cats[i].id}：请输入有效的正整数报价。`);else if(n<cats[i].cost)errors.push(`${cats[i].id}：低于进货价，请重新核算。`);else if(n>state.budget)errors.push(`${cats[i].id}：超出本次练习预算 ${money(state.budget)}。`);});const el=$('#priceError');if(el){el.textContent=errors.join(' ');el.hidden=!errors.length;}$('[data-action="next"]')?.toggleAttribute('disabled',!canNext());}
function go(step){if(step>=7&&state.selected.length!==3){step=6;toast('先挑选三只猫咪，我们再继续。');}if(step>=8&&!state.selected.every(validPrice)){step=7;toast('先核对报价，我们再继续。');}state.step=step;state.reached=Math.max(state.reached,step);state.branch='';state.finished=false;render(true);}
function next(){if(!canNext())return;if(!state.done.includes(state.step))state.done.push(state.step);go(state.step+1);}
function requestReset(){if(state.step===0&&state.reached===0){state=initial();go(1);}else $('#resetDialog').showModal();}
function showFeedback(id,text,good=false){const el=$(id);if(!el)return;el.textContent=text;el.hidden=false;el.classList.toggle('good',good);}
function handleAction(action){
 if(action==='confirm-demand'){state.demand=[0,1,2,3,4];return next();}if(action==='start')return go(1);if(action==='next')return next();if(action==='prev')return go(Math.max(0,state.step-1));if(action==='restart')return requestReset();
 if(action==='review'){state.finished=false;return go(10);}if(action==='feedback'){state.branch='';return render(true);}if(action==='refilter'){state.budget=1400;state.selected=[];state.healthAnswered=false;invalidate(6);return go(6);}
 if(action==='publish'){
  if(!state.title.trim()||!state.caption.trim()||state.topics.length<1||state.visibility!=='public')$('#postEdit').open=true;
  if(!state.title.trim()||!state.caption.trim())return showFeedback('#publishFeedback','先补上标题和正文。让看到作品的人知道你想分享什么。');
  if(state.topics.length<1)return showFeedback('#publishFeedback','先选一个相关话题，帮助想养猫的人找到内容。');
  if(state.visibility!=='public')return showFeedback('#publishFeedback','这次练习是让潜在客户看到作品，请把公开设置改为“所有人可见”。');
  state.published=true;next();toast('模拟发布好了，我们去找想买的人。');return;
 }
 if(action==='send'){state.materialsSent=true;next();toast('资料已模拟发送，看看小林怎么回。');return;}
 if(action==='copy'){const text='按你的要求挑了 3 只，你看看更喜欢哪只？喜欢哪只，我再帮你确认最新状态和运输安排。';if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('推荐话术已复制')).catch(()=>toast('复制未成功，可长按或选中上方话术复制'));else{const selection=getSelection(),range=document.createRange();range.selectNodeContents($('.reply-example p'));selection.removeAllRanges();selection.addRange(range);toast('已选中推荐话术，请复制');}return;}
 if(action==='finish'&&state.checked.length===4){if(!state.done.includes(10))state.done.push(10);state.finished=true;render(true);}
}
document.addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button||button.disabled)return;if(button.dataset.action)return handleAction(button.dataset.action);
 if(button.dataset.step){const n=Number(button.dataset.step);if(n<=state.reached)go(n);return;}
 if(button.dataset.topic){const t=button.dataset.topic;state.topics=state.topics.includes(t)?state.topics.filter(v=>v!==t):[...state.topics,t];state.published=false;invalidate(2);render();$('#postEdit').open=true;return;}
 if(button.hasAttribute('data-lead')){if(button.dataset.lead==='1'){state.lead=true;render();}else if(button.dataset.lead==='3')showFeedback('#leadFeedback','这条也有明确意向，可以继续沟通。本题先选信息最完整的一条：还有谁同时提到了价格、新手和性别偏好？');else if(button.dataset.lead==='0')showFeedback('#leadFeedback','她在了解品种，有兴趣，但还没说明购买偏好。再找找需求信息更完整的那一条。');else showFeedback('#leadFeedback','她在分享养猫经历，目前没有提出购买需求。再看看其他评论。');return;}
 if(button.dataset.dm){if(button.dataset.dm==='good'){state.reply=true;render();}else showFeedback('#dmFeedback','这句有点像广告。试着先回应她“第一次养、想找妹妹”的需求，再问一个小问题。');return;}
 if(button.hasAttribute('data-pick')){const i=Number(button.dataset.pick);if(state.selected.includes(i))state.selected=state.selected.filter(n=>n!==i);else if(state.selected.length<3)state.selected.push(i);else{toast('先取消一只，再选择新的。给客户三个选择就够啦。');return;}state.selected.sort((a,b)=>a-b);invalidate(6);return render();}
 if(button.dataset.branch){const type=button.dataset.branch;if(!state.visited.includes(type))state.visited.push(type);if(type==='yes'){if(!state.done.includes(9))state.done.push(9);go(10);}else{state.branch=type;state.healthAnswered=false;render(true);}return;}
 if(button.dataset.health){if(button.dataset.health==='good'){state.healthAnswered=true;render();}else showFeedback('#healthFeedback','先别做“绝对健康”的承诺。我们需要核实健康资料、最新状态和实际售后约定。');}
});
document.addEventListener('input',e=>{
 if(e.target.matches('[data-post]')){state[e.target.dataset.post]=e.target.value;state.published=false;invalidate(2);$('#publishFeedback').hidden=true;updatePostPreview();updateNavigation();save();}
 if(e.target.matches('[data-price]')){const i=Number(e.target.dataset.price);state.prices[i]=e.target.value===''?null:Number(e.target.value);invalidate(7);validatePrices();updateNavigation();save();}
});
document.addEventListener('change',e=>{
 if(e.target.id==='visibility'){state.visibility=e.target.value;state.published=false;invalidate(2);$('#publishFeedback').hidden=true;updatePostPreview();updateNavigation();save();}
 if(e.target.matches('[data-finish-ack]')){state.checked=e.target.checked?[0,1,2,3]:[];state.done=state.done.filter(n=>n!==10);$('[data-action="finish"]').disabled=state.checked.length!==4;updateNavigation();save();}
});
$('#restart').addEventListener('click',requestReset);$('#topBack').addEventListener('click',()=>handleAction('prev'));
$('#resetDialog').addEventListener('close',()=>{if($('#resetDialog').returnValue==='reset'){state=initial();go(1);toast('新一轮练习开始，我继续陪你。');}});
render();
})();
