// All records below are fictional practice data; this page never submits orders.
const KEY = 'cat-sales-practice-v3-acquisition';
const cats = [
  { id: 'C-102', name: '海双布偶妹妹', age: '2 个月', cost: 900, mask: '#a58d76' },
  { id: 'C-118', name: '蓝双布偶妹妹', age: '3 个月', cost: 1050, mask: '#8d9da5' },
  { id: 'C-126', name: '海双布偶妹妹', age: '2 个月', cost: 1150, mask: '#9d927b' },
  { id: 'C-139', name: '重点色布偶妹妹', age: '3 个月', cost: 980, mask: '#9a8172' }
];
const lessons = [ ['看示范','知道作品怎么发'], ['模拟发布','亲手走一次发布'], ['评论找人','识别潜在客户'], ['自然私信','完成获客开场'], ['接住需求','听清客户想要什么'], ['筛选猫咪','给出有限的选择'], ['设置报价','算清每一笔报价'], ['整理资料','让客户看得明白'], ['处理反馈','接住不同的回复'], ['确认成交','先核实，再成交'] ];
const initial = () => ({ step: 0, reached: 0, selected: [], prices: {}, budget: 1500, branch: '', checked: [], finished: false, visited: [], acquisitionDone: [] });
let state = initial();
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (saved && Number.isInteger(saved.step) && saved.step >= 0 && saved.step <= 10) {
    state = { ...initial(), ...saved };
    state.selected = [...new Set((Array.isArray(saved.selected) ? saved.selected : []).filter(i => Number.isInteger(i) && i >= 0 && i < cats.length))].slice(0, 3);
    state.prices = Object.fromEntries(Object.entries(saved.prices || {}).filter(([i, n]) => /^[0-3]$/.test(i) && Number.isFinite(n) && n > 0));
    state.checked = [...new Set((Array.isArray(saved.checked) ? saved.checked : []).filter(i => Number.isInteger(i) && i >= 0 && i < 4))];
    state.visited = [...new Set((Array.isArray(saved.visited) ? saved.visited : []).filter(v => ['no','ask','yes'].includes(v)))];
    state.branch = ['no','ask'].includes(saved.branch) && state.step === 9 ? saved.branch : '';
    state.budget = saved.budget === 1400 ? 1400 : 1500;
    state.reached = Math.max(state.step, Math.min(10, Number.isInteger(saved.reached) ? saved.reached : 0));
    state.finished = saved.finished === true && state.step === 10 && state.checked.length === 4;
    if (state.step >= 7 && state.selected.length !== 3) state = initial();
    state.acquisitionDone = [...new Set((Array.isArray(saved.acquisitionDone) ? saved.acquisitionDone : []).filter(i => Number.isInteger(i) && i >= 1 && i <= 4))];
  }
} catch { storageAvailable = false; }
const $ = s => document.querySelector(s);
const panel = $('#panel');
const money = n => `¥${Number(n).toLocaleString('zh-CN')}`;
const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="/ui-assets/sales-icons.svg#${name}"/></svg>`;
const button = (label, action, secondary = false, disabled = false) => `<button class="button ${secondary ? 'secondary' : 'primary'}" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}${icon('arrow')}</button>`;
const back = action => `<button class="text-button" data-action="${action}">${icon('back')} 上一步</button>`;
const actions = (left, right) => `<div class="panel-actions">${left}${right}</div>`;
const notice = (text, warm = false) => `<div class="training-notice ${warm ? 'warm' : ''}">${icon(warm ? 'shield' : 'compass')}<div>${text}</div></div>`;
function catArt(i) {
  const c = cats[i];
  return `<svg class="cat-illustration" viewBox="0 0 160 140" aria-hidden="true"><ellipse cx="80" cy="125" rx="47" ry="6" fill="#60734d" opacity=".08"/><path d="M44 115c-5-21 7-41 17-47h37c17 15 23 29 20 47Z" fill="#f9f7ef"/><path d="m39 55 5-34 30 20h13l29-20 7 35v25c0 21-18 32-42 32S39 100 39 81Z" fill="#f8f5e9"/><path d="m39 57 6-34 27 19-12 30-17 12Z" fill="${c.mask}"/><path d="m122 57-7-34-27 19 12 30 17 12Z" fill="${c.mask}"/><path d="m48 33 15 11-14 9Z" fill="#d9b6a7" opacity=".8"/><path d="m112 33-15 11 14 9Z" fill="#d9b6a7" opacity=".8"/><ellipse cx="61" cy="70" rx="6" ry="7" fill="#9ebdc3"/><ellipse cx="101" cy="70" rx="6" ry="7" fill="#9ebdc3"/><ellipse cx="61" cy="70" rx="2" ry="5" fill="#455b5a"/><ellipse cx="101" cy="70" rx="2" ry="5" fill="#455b5a"/><path d="m76 84 5 4 5-4" fill="#c79986" stroke="#c79986" stroke-width="2" stroke-linecap="round"/><path d="M81 89v3m0 0c-4 4-8 4-10 2m10-2c4 4 8 4 10 2" stroke="#b8ab97" fill="none" stroke-width="1.5" stroke-linecap="round"/><path d="m39 86 17 2m-16 8 16-3m67-7-17 2m16 8-16-3" stroke="#c4bda9" stroke-width="1.3" stroke-linecap="round"/></svg>`;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageAvailable = true; } catch { storageAvailable = false; }
  $('#saveStatus').textContent = storageAvailable ? '进度保存在当前浏览器' : '当前浏览器无法保存进度';
}
let toastTimer;
function toast(message) { clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => $('#toast').hidden = true, 3000); }
function shell(label, title, lead, body) {
  panel.innerHTML = `<div class="panel-eyebrow">${icon(state.finished ? 'check' : 'compass')}${label}</div>${title ? `<div class="panel-heading" tabindex="-1"><h2>${title}</h2></div>` : ''}${lead ? `<p class="panel-lead">${lead}</p>` : ''}${body}`;
}
function updateSidebar() {
  const complete = state.finished ? 10 : Math.max(0, state.step - 1);
  $('#lessonPercent').textContent = `${Math.round(complete / 10 * 100)}%`;
  $('#lessonProgress').style.width = `${complete / 10 * 100}%`;
  $('#steps').innerHTML = lessons.map(([title, subtitle], i) => `<button class="lesson-step ${state.step === i + 1 && !state.finished ? 'active' : ''} ${i < complete ? 'completed' : ''}" data-step="${i+1}" ${i+1 > state.reached ? 'disabled' : ''} ${state.step === i+1 ? 'aria-current="step"' : ''}><span class="step-number">${i<complete ? icon('check') : String(i+1).padStart(2,'0')}</span><span><span class="step-title">${title}</span><small class="step-subtitle">${subtitle}</small></span></button>`).join('');
  $('#stepStatus').textContent = state.finished ? '练习已完成 · 可以再次练习' : state.step ? `第 ${state.step} / 10 步 · ${lessons[state.step-1][0]}` : '准备开始';
}
function updateChat() {
  const inAcquisition = state.step > 0 && state.step <= 4;
  const m = inAcquisition
    ? [{ text: state.step < 3 ? '先完成作品发布，客户才有机会看到你。' : state.step === 3 ? '评论区里有人问：“第一次养，想找只妹妹，大概多少钱？”' : '你已经找到一个有明确兴趣的人，先自然聊需求。' }]
    : [{ text: '你好，想买一只布偶妹妹，最好两三个月，预算1500左右，可以发杭州吗？' }];
  if (!inAcquisition && state.step >= 6) m.push({ me: true, text: '好的，我按你的预算和要求先筛几只比较合适的。运输安排也会按杭州的收货地址再确认。' });
  if (!inAcquisition && state.budget === 1400) m.push({ text: '预算想再降一点，最好1400以内，其他要求不变。' });
  if (!inAcquisition && state.step >= 8) m.push({ me: true, text: '按你的要求先挑了 3 只布偶妹妹，年龄和预算都比较接近。你看看哪只更有眼缘，喜欢哪只我再帮你确认最新状态。' });
  if (state.step === 9 && state.branch === 'no') m.push({ text: '这几只都不太喜欢，能不能再便宜一点，1400以内呢？' });
  if (state.step === 9 && state.branch === 'ask') m.push({ text: '可以保证没有猫癣、到家一定健康吗？' });
  if (!inAcquisition && state.step >= 10) m.push({ text: '我喜欢第二只，就要这只了，今天能买吗？' });
  if (state.finished) m.push({ me: true, text: '这只目前确认还在。我再和你核对一下猫咪编号、最终价格、运输和售后内容，确认没有问题后再进行下一步。' });
  $('#chat').innerHTML = `<div class="chat-time">${inAcquisition?'获客练习':'模拟接待 · 客户小林'}</div>` + m.map(x => `<div class="chat-message ${x.me?'me':''}"><span class="chat-speaker">${x.me?'你 · 销售':inAcquisition?'带练提示':'小林 · 客户'}</span><div class="chat-bubble">${x.text}</div></div>`).join('');
  $('#chat').scrollTop = $('#chat').scrollHeight;
  $('#customerBudget').textContent = `预算约 ${money(state.budget)}`;
  const mobileChat = $('#mobileChat');
  if (mobileChat) {
    const recent = m.slice(-3);
    mobileChat.innerHTML = recent.map(x => `<div class="mobile-message ${x.me?'me':''}"><span>${x.me?'你':inAcquisition?'带练提示':'客户小林'}</span><p>${x.text}</p></div>`).join('');
    mobileChat.scrollTop = mobileChat.scrollHeight;
  }
  const mobileBudget = $('#mobileCustomerBudget');
  if (mobileBudget) mobileBudget.textContent = inAcquisition ? '先完成获客练习 · 第 5 步开始进入成交接待' : `布偶妹妹 · 2—3个月 · 预算约 ${money(state.budget)} · 杭州`;
}

function render(focus = false) {
  updateSidebar(); updateChat();
  if (state.finished) {
    shell('PRACTICE COMPLETE','', '', `<div class="completion panel-heading" tabindex="-1"><div class="complete-seal">${icon('check')}</div><h2>第一次接待，练习完成。</h2><p class="panel-lead">从听懂需求，到确认成交条件。<br>你已经亲手走过了一次完整的接待过程。</p><div class="completion-recap"><div><strong>6</strong><span>个步骤已完成</span></div><div><strong>3</strong><span>只猫咪已推荐</span></div><div><strong>${state.visited.length}</strong><span>种反馈已体验</span></div></div><div class="completion-links"><a href="/">去猫源库，熟悉真实猫源 ${icon('arrow-up')}</a><a href="/assistant/">遇到难题，让 AI 助手一起想 ${icon('arrow-up')}</a></div></div>${actions('<a class="text-button" href="/manuals/">返回支持中心</a>', button('再练习一次','restart'))}`);
  } else if (state.step === 0) {
    shell('FIRST CONVERSATION · 新手实战带练','先练一遍，再从容开口。','先学会把潜在客户找出来，再接住真实咨询。你会先完成一次作品发布、评论区找人和私信开场，然后无缝进入原来的成交带练。', `<div class="welcome-illustration"><span class="welcome-symbol">${icon('message')}</span>${icon('arrow')}<span class="welcome-symbol">${icon('cat')}</span>${icon('arrow')}<span class="welcome-symbol">${icon('check')}</span></div><div class="intro-map"><div><span class="intro-map-number">01</span><div><b>先获客</b><p>看示范、发作品、去评论区找人，再完成一次自然私信。</p></div></div><div><span class="intro-map-number">02</span><div><b>再接待</b><p>客户回复后，沿用现在的流程听需求、选猫和报价。</p></div></div><div><span class="intro-map-number">03</span><div><b>最后成交</b><p>处理客户反馈，并完成成交前的核实事项。</p></div></div></div>${notice('这里是模拟练习，不会发送真实消息，也不会产生订单。')}${actions('<span class="panel-helper">随时暂停，下次接着练。</span>',button('开始获客带练','start'))}`);
  } else if (state.step === 1) {
    shell('获客 01 / 04 · 看示范作品','先看一条能直接照着发的作品。','新人最难的不是“知道要发内容”，而是不知道发什么。这里先给你一条完整示范：画面、标题和正文都配好。',`<div class="acq-demo-post"><div class="acq-post-art">${catArt(0)}<strong>第一次养猫<br>千万不要只看价格</strong><span>✓ 看健康状态　✓ 看成长环境　✓ 看售后保障</span></div><div class="acq-copy"><span>示范文案</span><p><b>第一次养猫，千万不要只看价格。</b><br>先看猫咪精神状态和成长环境，再确认健康资料与售后约定。喜欢布偶的可以先做功课，不急着下决定。</p></div></div>${notice('重点不是硬卖猫，而是先让真正有养猫需求的人愿意停下来、评论或私信。')}${actions(back('intro'),button('看懂了，模拟发布','next'))}`);
  } else if (state.step === 2) {
    shell('获客 02 / 04 · 模拟发布','按一次“发布”，走完新人第一条作品。','这里不会真的发到抖音。我们把真实发布动作缩成一个练习：选好示范作品，确认文案，然后点击发布。',`<div class="publish-sim"><div class="publish-preview"><div class="publish-thumb">${catArt(0)}<span>第一次养猫<br>千万不要只看价格</span></div><div><b>作品已准备好</b><small>竖版猫咪内容 · 示例素材</small></div></div><label class="publish-caption">发布文案<textarea readonly>第一次养猫，千万不要只看价格。先看健康状态、成长环境，再确认健康资料和售后约定。#布偶猫 #新手养猫</textarea></label><button class="mock-publish-button" data-acq="publish">${state.acquisitionDone.includes(2)?'✓ 已模拟发布':'模拟点击发布'}</button></div>${actions(back('prev'),button('发布完成，去找潜在客户','next',false,!state.acquisitionDone.includes(2)))}`);
  } else if (state.step === 3) {
    shell('获客 03 / 04 · 评论区找人','不是每条评论都值得私信。','看下面这条热门养猫内容的模拟评论区，点出最像“有购买需求”的人。',`<div class="comment-sim"><div class="comment-video"><div>${catArt(1)}</div><b>布偶猫到家后的第一周</b><small>模拟热门作品 · 1,862 条评论</small></div><div class="comment-list"><button data-lead="0"><span class="comment-avatar">A</span><span><b>太可爱了哈哈哈</b><small>2小时前</small></span></button><button data-lead="1" class="${state.acquisitionDone.includes(3)?'lead-picked':''}"><span class="comment-avatar">林</span><span><b>请问这种猫大概多少钱？第一次养，想找只妹妹</b><small>38分钟前</small></span><em>${state.acquisitionDone.includes(3)?'✓ 意向明显':'点我判断'}</em></button><button data-lead="2"><span class="comment-avatar">B</span><span><b>我家也有一只，一模一样</b><small>1小时前</small></span></button></div></div><p class="inline-error" id="leadHint"></p>${notice('优先找主动问价格、品种、地区、年龄，或明确说“想养/准备养”的人；不要机械骚扰所有评论用户。')}${actions(back('prev'),button('找到意向客户，练习私信','next',false,!state.acquisitionDone.includes(3)))}`);
  } else if (state.step === 4) {
    shell('获客 04 / 04 · 自然私信','第一句不要直接推销。','你刚找到一位明确说“第一次养、想找妹妹”的潜在客户。选择更自然的第一句话。',`<div class="dm-sim"><div class="dm-profile"><span class="comment-avatar">林</span><div><b>小林爱猫</b><small>刚刚在评论区询问布偶猫价格</small></div></div><button data-dm="bad">你好，我们这里有很多猫，价格便宜，需要买吗？</button><button data-dm="good" class="${state.acquisitionDone.includes(4)?'dm-good':''}">你好呀，刚看到你说第一次养、想找只妹妹。你比较喜欢布偶这种，还是还在看看不同品种？</button><p id="dmHint">${state.acquisitionDone.includes(4)?'✓ 对。先接住对方已经表达的需求，再自然了解偏好。':'选一句你认为更适合的开场。'}</p></div>${notice('获客不是群发广告。目标是找到已经表现出兴趣的人，用正常聊天把需求接出来。')}${actions(back('prev'),button('完成获客，进入成交带练','next',false,!state.acquisitionDone.includes(4)))}`);
  } else if (state.step === 5) {
    shell('STEP 01 / 06 · 接住需求','先听清楚，客户想要什么。','从客户的原话里找出五个关键信息。有了这些，后面的推荐才更有方向。', `<div class="requirement-grid">${[['品种','布偶猫'],['性别','妹妹 / 母'],['年龄','2—3 个月'],['预算',`${money(state.budget)} 左右`],['收货城市','杭州']].map(([k,v])=>`<div class="requirement"><span>${k}${icon('check')}</span><b>${v}</b></div>`).join('')}</div>${notice('需求没说全时，先补问；这次客户已经说明了五项要求，可以开始筛选。')}${actions(back('intro'),button('需求清楚了，去选猫','next'))}`);
  } else if (state.step === 6) {
    shell('STEP 02 / 06 · 筛选猫咪','不用发太多，先挑 3 只。','根据品种、年龄和预算，选出合适的猫咪。点击卡片选择，再次点击可以取消。', `<div class="selection-toolbar"><div class="filter-tags"><span>布偶妹妹</span><span>2—3 个月</span><span>预算 ${money(state.budget)}</span></div><span class="selection-count" id="selectionCount" aria-live="polite"></span></div><div class="cat-grid">${cats.map((c,i)=>`<button class="practice-cat" data-pick="${i}" aria-pressed="${state.selected.includes(i)}" aria-label="${c.id} ${c.name} ${c.age} 供货价${c.cost}元"><span class="cat-selection">${icon('check')}</span><div class="cat-art variant-${i}">${catArt(i)}<small>模拟猫咪插画</small></div><div class="cat-info"><h3>${c.name}</h3><p>${c.age} · 母</p><div class="cat-info-bottom"><span>${c.id}</span><b>供货 ${money(c.cost)}</b></div></div></button>`).join('')}</div>${notice('先挑选，再核实。猫咪实际状态、库存和运输方式，都需要在真实成交前确认。')}${actions(back('prev'),button('选好了，设置报价','next',false,state.selected.length!==3))}<p class="panel-helper">请选择 3 只；当前价格为练习中的模拟供货价。</p>`);
    updateSelection();
  } else if (state.step === 7) {
    state.selected.forEach((i,n)=>{if (!Number.isFinite(state.prices[i])) state.prices[i]=Math.min([1299,1399,1499][n],state.budget);});
    shell('STEP 03 / 06 · 设置报价','算清报价，让选择更合适。',`为选中的 3 只猫设置最终报价。客户预算约 ${money(state.budget)}，也要留意供货价和运输费用。`, `<div class="price-list">${state.selected.map(i=>`<div class="price-item"><div><h3>${cats[i].name}</h3><p>${cats[i].id} · 供货 ${money(cats[i].cost)}</p></div><label for="price-${i}">客户报价<div class="price-input-wrap"><span>¥</span><input id="price-${i}" type="number" min="1" step="1" inputmode="numeric" data-price="${i}" value="${state.prices[i]}" aria-label="${cats[i].id} 客户报价" aria-describedby="priceError"></div></label></div>`).join('')}</div><div class="price-summary"><span>客户预算 <b>${money(state.budget)}</b> / 只</span><span>报价差额不等于最终利润，运费等需另行核实。</span></div><p class="inline-error" id="priceError" role="status"></p>${notice('客户资料只显示最终报价，不展示供货成本。真实报价要结合实际费用和确认后的交易条件。')}${actions(back('prev'),button('预览客户资料','next'))}`);
    validatePrices();
  } else if (state.step === 8) {
    shell('STEP 04 / 06 · 整理资料','让客户看得清楚，也好选择。','这是客户将看到的推荐资料。确认编号、价格和信息，再给出清楚的下一步。',`<div class="material-list">${state.selected.map(i=>`<article class="material-card"><div class="material-image">${catArt(i)}</div><div><h3>${cats[i].name} · <strong>${money(state.prices[i])}</strong></h3><p>${cats[i].id} · ${cats[i].age}<br>疫苗信息与最新状态，成交前再次核对。</p></div></article>`).join('')}</div><div class="reply-example"><span>配合资料的一句话</span><p>按你的要求先挑了 3 只布偶妹妹，你看看哪只更有眼缘。喜欢哪只，我再帮你确认最新状态和运输安排。</p></div>${actions(back('prev'),button('模拟发送，看看反馈','next'))}<p class="panel-helper">这里不会向真实客户发送消息。</p>`);
  } else if (state.step === 9 && !state.branch) {
    shell('STEP 05 / 06 · 处理反馈','客户怎么说，我们怎么接。','选一种客户回复，练习下一步。可以回来体验其他情况，选择“已经选中”继续成交确认。',`<div class="branch-list">${[['no','sliders','还不满意，想再看看','先问清哪里不合适，再调整筛选条件。'],['ask','message','对健康和售后有疑问','先核实资料，避免做绝对承诺。'],['yes','check','已经选中，想购买','确认库存和交易条件，再推进成交。']].map(([type,ic,t,d])=>`<button class="branch-button" data-branch="${type}"><span class="branch-icon">${icon(ic)}</span><span><b>${t}</b><small>${d}</small></span>${icon(state.visited.includes(type)?'check':'arrow')}</button>`).join('')}</div>${notice('没有固定的一句万能话术。先理解客户卡在哪里，再决定接下来的行动。')}${actions(back('prev'),'<span class="panel-helper">点选上方一种回复</span>')}`);
  } else if (state.step === 9 && state.branch === 'no') {
    shell('客户反馈 A · 调整需求','不喜欢？先弄清哪里不合适。','小林希望价格再低一点，最好在 1400 元以内。保留其他要求，按新的预算重新推荐。',`<div class="requirement-grid"><div class="requirement"><span>保留条件</span><b>布偶妹妹</b></div><div class="requirement"><span>年龄与城市</span><b>2—3 个月 · 杭州</b></div><div class="requirement"><span>新的预算</span><b>¥1,400 以内</b></div></div><div class="reply-example"><span>可以这样接住客户</span><p>可以的，你更在意价格，那我按 1400 以内再帮你筛一轮，品种和年龄要求先保持不变。</p></div>${actions(back('feedback'),button('按新预算重新选猫','refilter'))}`);
  } else if (state.step === 9 && state.branch === 'ask') {
    shell('客户反馈 B · 处理疑问','先核实，让承诺有依据。','小林担心猫咪健康。不要直接保证“绝对没问题”，可以先说明要核实哪些资料。',`<div class="reply-example"><span>建议回复 · 发送前仍需核对实际资料</span><p>活体不适合口头承诺“绝对不会出现问题”。我可以按猫咪编号核对目前的健康资料和最新状态，具体售后以成交前确认的书面约定为准。</p></div>${notice('遇到健康、运输或退款问题，AI 可以帮你起草；实际信息和承诺内容，仍需要你确认。',true)}<div class="completion-links"><a href="/assistant/" target="_blank" rel="noopener">打开 AI 助手（新窗口，保留练习） ${icon('arrow-up')}</a></div>${actions(back('feedback'),button('明白了，看看其他反馈','feedback'))}`);
  } else if (state.step === 10) {
    const i=state.selected[1];
    shell('STEP 06 / 06 · 确认成交','先确认清楚，再往前一步。','客户选中了第二只。模拟核对以下四项，记住真实成交前需要确认的内容。',`<div class="order-summary">${icon('cat')}<div><strong>${cats[i].id} · ${cats[i].name}</strong><small>意向报价 ${money(state.prices[i])} · 收货城市 杭州</small></div></div><div class="checklist">${[['猫咪编号与库存','确认是客户选中的猫，并再次核实仍可出售。'],['健康资料与最新状态','核对现有健康资料，不以聊天代替实际检查。'],['最终价格与运输安排','确认费用、方式、时间和交接要求。'],['售后约定与付款流程','让客户看清书面约定，再推进付款。']].map(([t,d],i)=>`<label><input type="checkbox" data-check="${i}" ${state.checked.includes(i)?'checked':''}><span><strong>${t}</strong><small>${d}</small></span></label>`).join('')}</div>${notice('此处勾选仅表示已学习核对事项，不代表真实库存或交易条件已确认。',true)}${actions(back('prev'),button('模拟确认完成','finish',false,state.checked.length!==4))}<p class="panel-helper" id="checkCount">已学习 ${state.checked.length} / 4 项成交前核对事项</p>`);
  }
  save();
  syncMobileView();
  if (focus) {
    $('.panel-heading')?.focus({preventScroll:true});
    const top = $('.lesson-workspace').getBoundingClientRect().top;
    if (top < 0 || matchMedia('(max-width:900px)').matches) $('.lesson-workspace').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'});
  }
}
function updateSelection() {
  $('#selectionCount').textContent = `已选 ${state.selected.length} / 3 只`;
  document.querySelectorAll('[data-pick]').forEach(el => {
    const selected=state.selected.includes(Number(el.dataset.pick));
    el.setAttribute('aria-pressed',String(selected));
    el.disabled=!selected && state.selected.length===3;
  });
  $('[data-action="next"]').disabled=state.selected.length!==3;
}
function validPrice(i) { return Number.isInteger(state.prices[i]) && state.prices[i] > 0 && state.prices[i] <= state.budget && state.prices[i] >= cats[i].cost; }
function validatePrices() {
  const messages=[];
  state.selected.forEach(i=>{
    const n=state.prices[i];
    $(`[data-price="${i}"]`).setAttribute('aria-invalid',String(!validPrice(i)));
    if(!Number.isInteger(n)||n<=0)messages.push(`${cats[i].id}：请输入有效的正整数报价。`);
    else if(n<cats[i].cost)messages.push(`${cats[i].id}：低于供货价，请重新核算。`);
    else if(n>state.budget)messages.push(`${cats[i].id}：超出本次练习预算 ${money(state.budget)}。`);
  });
  $('#priceError').textContent=messages.join(' ');
  $('[data-action="next"]').disabled=messages.length>0;
  return !messages.length;
}
function go(n) { state.step=n; state.reached=Math.max(state.reached,n);state.branch='';state.finished=false;render(true); }
function reset() { state=initial();go(1);toast('已开始新的一轮模拟练习'); }
function requestReset() { if(state.step===0){reset();return;} $('#resetDialog').showModal(); }
function handleAction(a) {
  if(a==='start'){go(1);return;}
  if(a==='restart'){requestReset();return;}
  if(a==='intro'){go(0);return;}
  if(a==='prev'){go(Math.max(0,state.step-1));return;}
  if(a==='feedback'){go(9);return;}
  if(a==='refilter'){state.budget=1400;state.selected=[];state.prices={};state.checked=[];state.reached=6;go(6);return;}
  if(a==='next'){
    if(state.step===6 && state.selected.length!==3)return;
    if(state.step===7 && !validatePrices())return;
    go(Math.min(10,state.step+1));return;
  }
  if(a==='finish' && state.checked.length===4){state.finished=true;render(true);}
}
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-action]');if(action&&!action.disabled){handleAction(action.dataset.action);return;}
  const acq=e.target.closest('[data-acq]');
  if(acq){if(!state.acquisitionDone.includes(2))state.acquisitionDone.push(2);render(false);toast('模拟发布完成');return;}
  const lead=e.target.closest('[data-lead]');
  if(lead){if(lead.dataset.lead==='1'){if(!state.acquisitionDone.includes(3))state.acquisitionDone.push(3);render(false);toast('判断正确：这条评论购买意向更明显');}else{const h=$('#leadHint');if(h)h.textContent='这条评论暂时没有明确购买意向，再看看其他人。';}return;}
  const dm=e.target.closest('[data-dm]');
  if(dm){if(dm.dataset.dm==='good'){if(!state.acquisitionDone.includes(4))state.acquisitionDone.push(4);render(false);toast('开场正确：先聊需求，不急着推销');}else{const h=$('#dmHint');if(h)h.textContent='这句太像广告。先从对方已经表达的需求聊起，会更自然。';}return;}
  const pick=e.target.closest('[data-pick]');
  if(pick&&!pick.disabled){const i=Number(pick.dataset.pick);if(state.selected.includes(i))state.selected=state.selected.filter(v=>v!==i);else if(state.selected.length<3)state.selected.push(i);state.reached=6;state.prices={};state.checked=[];updateSelection();updateSidebar();save();return;}
  const step=e.target.closest('[data-step]');
  if(step&&!step.disabled){const n=Number(step.dataset.step);if(n>7 && !state.selected.every(validPrice)){go(7);toast('请先完成有效报价');return;}go(n);return;}
  const branch=e.target.closest('[data-branch]');
  if(branch){const type=branch.dataset.branch;if(!state.visited.includes(type))state.visited.push(type);if(type==='yes'){go(10);}else{state.branch=type;render(true);}return;}
});
document.addEventListener('input',e=>{
  if(e.target.matches('[data-price]')){const i=Number(e.target.dataset.price);state.prices[i]=e.target.value===''?null:Number(e.target.value);state.checked=[];state.reached=Math.min(state.reached,7);validatePrices();updateSidebar();save();}
});
document.addEventListener('change',e=>{
  if(e.target.matches('[data-check]')){const i=Number(e.target.dataset.check);state.checked=state.checked.filter(v=>v!==i);if(e.target.checked)state.checked.push(i);$('[data-action="finish"]').disabled=state.checked.length!==4;$('#checkCount').textContent=`已学习 ${state.checked.length} / 4 项成交前核对事项`;save();}
});
$('#restart').addEventListener('click',requestReset);
$('#resetDialog').addEventListener('close',()=>{if($('#resetDialog').returnValue==='reset')reset();});
const mobile=matchMedia('(max-width:900px)');
function syncMobileLayout() {
  if (!mobile.matches) return;
  const nav=$('#steps'),active=nav.querySelector('[aria-current="step"]');
  if(active) nav.scrollLeft += active.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth-active.offsetWidth)/2;
}
mobile.addEventListener('change',syncMobileLayout);
function updatePracticeViewport(){
  const v=window.visualViewport;
  const inset=mobile.matches && v ? Math.max(0,window.innerHeight-v.height-v.offsetTop) : 0;
  document.body.style.setProperty('--practice-keyboard-inset',`${inset}px`);
}
window.visualViewport?.addEventListener('resize',updatePracticeViewport);
window.visualViewport?.addEventListener('scroll',updatePracticeViewport);
window.addEventListener('resize',updatePracticeViewport);
updatePracticeViewport();
syncMobileLayout();
render();
