// ADMIN_CONTROL_PATCH_V1
import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';
import {render,screen,waitFor,cleanup,within,configure,fireEvent} from '@testing-library/react';import userEvent from '@testing-library/user-event';import {MemoryRouter} from 'react-router-dom';
import WorkbenchSettingsAdmin from '../src/components/WorkbenchSettingsAdmin.jsx';
import {WorkspaceContent} from '../src/SalesWorkspace.jsx';import {drawSinglePoster} from '../src/workspace/CatTools.jsx';import SalesRiskAdmin from '../src/components/SalesRiskAdmin.jsx';import worker from '../cloudflare-worker.js';import {createSessionCookie} from '../cloud-functions/_lib/admin-auth.js';import {newKey,activate,cookie} from '../cloud-functions/_lib/sales-store.js';import {makeDB} from './sales-db.mjs';
configure({asyncUtilTimeout:5000});
const cats=[{id:'CAT-2026-000017',breed:'布偶猫',color:'蓝双',gender:'母',age:'3',price:2600,description:'甜美亲人，合作底价2600元'},{id:'CAT-2026-000018',breed:'英短',color:'金渐层',gender:'公',age:'4',price:1800,description:'温顺安静'}];
function fixture({signed=true,remaining=20,stockCats=cats,accountId=101,retryAfter=0}={}){localStorage.clear();sessionStorage.clear();const original=globalThis.fetch;let activated=signed,stock=0;const calls=[];let account={id:accountId,sales_name:'测试销售',remaining,daily_limit:20,retry_after:retryAfter};globalThis.fetch=async(path,options={})=>{if(String(path).includes('/api/public-images/'))return new Response(new Uint8Array([1,2,3]),{headers:{'Content-Type':'image/png'}});if(path==='/api/public-cats'||String(path).startsWith('/api/agent/catalog')){stock++;return Response.json({success:true,data:path==='/api/public-cats'?stockCats.map(({price,description,...cat})=>cat):stockCats});}if(path==='/api/ai/session')return activated?Response.json({success:true,user:account}):Response.json({success:false},{status:401});if(path==='/api/ai/guest'){activated=true;account={...account,is_guest:true,sales_name:'免费访客'};return Response.json({success:true,user:account});}if(path==='/api/ai/activate'){const b=JSON.parse(options.body);assert.match(b.device_id,/^[a-f0-9-]{36}$/);if(b.key_code!=='ABCD-EF01-2345-6789')return Response.json({success:false,message:'激活码无效'},{status:403});activated=true;account={...account,is_guest:false};return Response.json({success:true,user:account});}if(path==='/api/ai/ask'){const b=JSON.parse(options.body);calls.push(b);if(b.action==='cat_only'){account={...account,remaining:account.remaining-1,retry_after:0};const selected=[cats[0].id];return Response.json({success:true,user:account,data:{kind:'cat_only',used_ai:true,matched_ids:selected.map(id=>'#'+id),reply_text:'已按预算找到在售布偶猫。',cat_context:{cat_ids:selected,need:b.prompt,excluded_ids:[]}}});}if(b.action==='catalog_match')return Response.json({success:true,user:account,data:{kind:'inventory',used_ai:false,matched_ids:['#'+cats[0].id],reply_text:'库存资料：#'+cats[0].id+'，预算范围内的在售猫。'}});if(b.action==='handbook')return Response.json({success:true,user:account,data:{kind:'handbook',used_ai:false,matched_ids:[],reply_text:'按手册：登记猫咪编号、收猫时间和视频资料，提交负责人确认。',sources:[{title:'常用话术与售后',manual:'基础与成交手册',href:'/guide/#tools'}]}});account={...account,remaining:account.remaining-1,retry_after:15};const selected=b.cat_ids||[cats[0].id];return Response.json({success:true,user:account,data:{used_ai:true,matched_ids:selected.map(id=>'#'+id),reply_text:selected.map(id=>'#'+id).join(' 与 ')+'，资料甜美亲人，2600元，可以先看视频。'}});}if(path==='/api/ai/logout'){activated=false;return Response.json({success:true});}throw new Error('Unexpected request '+path);};return{calls,stock:()=>stock,restore(){globalThis.fetch=original;}};}
function mount(path='/cats/'){return render(<MemoryRouter initialEntries={[path]}><WorkspaceContent/></MemoryRouter>);}
function menu(name){return within(screen.getByRole('navigation',{name:'销售工作台主导航'})).getByRole('link',{name:new RegExp(name)});}
async function ready(){await screen.findByRole('article',{name:'#017 布偶猫'});await screen.findByText(/今日剩余:/);}
test('two destinations, three matching capsules and shared sidebar tools, 4000-character composer and no top notification',async()=>{const m=fixture(),u=userEvent.setup({delay:null});try{mount();await ready();assert.equal(within(screen.getByRole('navigation',{name:'销售工作台主导航'})).getAllByRole('link').length,2);assert.equal(document.querySelectorAll('.sales-ai-quick button').length,3);assert.equal(screen.getByLabelText('客户选猫需求').maxLength,4000);assert.equal(screen.queryByRole('note'),null);assert.equal(screen.queryByText(/销售接单3步曲/),null);assert.ok(screen.getByRole('region',{name:'猫源筛选'}));assert.ok(screen.getByRole('combobox',{name:'品种'}));assert.ok(screen.getByRole('combobox',{name:'性别'}));assert.equal(screen.getByRole('button',{name:'更多筛选'}).getAttribute('aria-expanded'),'false');assert.equal(document.querySelectorAll('.catalog-tools button').length,1);assert.equal(screen.queryByRole('combobox',{name:'猫源排序'}),null);assert.ok(document.querySelector('.workspace-sidebar .sidebar-art-tools'));assert.equal(document.querySelectorAll('.sidebar-art-tools>button').length,1);assert.ok(document.querySelector('.workspace-sidebar .customer-display-controls'));assert.equal(document.querySelector('.sales-ai-quick').textContent.includes('海报'),false);await u.click(screen.getByRole('button',{name:/粘贴客户需求挑猫/}));assert.match(screen.getByLabelText('客户选猫需求').value,/客户预算/);assert.equal(m.calls.length,0);}finally{cleanup();m.restore();}});
test('guest cat finder works without activation and sends only the dedicated cat-only action',async()=>{
 const m=fixture({signed:false}),u=userEvent.setup({delay:null});try{mount();await ready();await screen.findByText('访客免费使用');
 await u.type(screen.getByLabelText('客户选猫需求'),'预算3000元，布偶妹妹');await u.click(screen.getByRole('button',{name:'发送客户需求'}));
 const dialog=await screen.findByRole('dialog',{name:'智能找猫 · 对话'});await within(dialog).findByText('找猫说明');
 assert.equal(m.calls.length,1);assert.equal(m.calls[0].action,'cat_only');assert.equal(m.calls[0].mode,'match');assert.equal(screen.queryByLabelText('销售激活码'),null);
 }finally{cleanup();m.restore();}
});
test('cat card offers two actions and sends the full ID directly without navigating or changing the top draft',async()=>{const m=fixture(),u=userEvent.setup({delay:null});try{mount();await ready();const input=screen.getByLabelText('客户选猫需求');await u.type(input,'预算3000元');const card=screen.getByRole('article',{name:'#017 布偶猫'});await u.click(within(card).getByRole('button',{name:'写话术'}));assert.equal(m.calls.length,0);await u.click(screen.getByRole('button',{name:'夸这只猫骨相甜美'}));const dialog=await screen.findByRole('dialog',{name:'猫咪推荐话术'});await within(dialog).findByText('找猫结果');assert.equal(m.calls.length,1);assert.equal(m.calls[0].action,'praise');assert.deepEqual(m.calls[0].cat_ids,['CAT-2026-000017']);assert.equal(input.value,'预算3000元');assert.ok(menu('在售猫源库').getAttribute('aria-current'));}finally{cleanup();m.restore();}});
test('two selected cards produce a comparison only after explicit send and preserve both full IDs',async()=>{const m=fixture(),u=userEvent.setup({delay:null});try{mount();await ready();const buttons=screen.getAllByRole('button',{name:'加入对比/拼图'});await u.click(buttons[0]);assert.equal(screen.queryByRole('button',{name:/AI生成双猫对比/}),null);await u.click(buttons[1]);const bar=screen.getByLabelText('选猫操作台');assert.match(bar.textContent,/#017/);assert.match(bar.textContent,/#018/);assert.equal(m.calls.length,0);await u.click(within(bar).getByRole('button',{name:/AI生成双猫对比逼单话术/}));await screen.findByRole('dialog',{name:'双猫对比话术'});await screen.findByText('找猫结果');assert.deepEqual(new Set(m.calls[0].cat_ids),new Set(cats.map(c=>c.id)));assert.equal(m.calls[0].action,'compare');}finally{cleanup();m.restore();}});
test('customer mode applies markup and hides internal tools, while zero markup removes prices and survives reload',async()=>{
 const m=fixture(),u=userEvent.setup({delay:null});try{mount();await ready();const markup=screen.getByRole('spinbutton',{name:'对客加价金额'});
 assert.equal(markup.value,'800');await u.click(screen.getByRole('switch',{name:'对客模式'}));let card=screen.getByRole('article',{name:'#017 布偶猫'});
 assert.match(card.textContent,/售价¥3,400/);assert.doesNotMatch(card.textContent,/底价|2600|写话术|加入对比/);
 await u.clear(markup);await u.type(markup,'0');assert.equal(card.querySelector('.catalog-price>span').textContent,'');assert.equal(card.querySelector('.workspace-card-actions'),null);
 await u.click(within(card).getByRole('button',{name:'查看资料'}));const detail=await screen.findByRole('dialog',{name:'猫咪资料'});assert.doesNotMatch(detail.textContent,/2600|2,600|底价|隐藏/);
 cleanup();mount();await ready();assert.equal(screen.getByRole('spinbutton',{name:'对客加价金额'}).value,'0');assert.equal(screen.getByRole('switch',{name:'对客模式'}).getAttribute('aria-checked'),'true');assert.equal(m.calls.length,0);
 }finally{cleanup();m.restore();}
});
test('manuals provide categorized accordion answers and copy without any AI request, while filters persist',async()=>{const m=fixture({remaining:0}),u=userEvent.setup({delay:null});let copied='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{copied=value;}},configurable:true});try{mount();await ready();await u.click(screen.getByRole('button',{name:'更多筛选'}));await u.type(screen.getByPlaceholderText('短编号、品种、花色'),'017');await u.click(menu('销冠手册与售后'));await screen.findByRole('heading',{name:'高频问题一键速查'});assert.equal(document.querySelectorAll('.workspace-tool').length,2);assert.equal(screen.queryByLabelText('合作或售后问题'),null);assert.equal(screen.getAllByRole('tab').length,4);await u.click(screen.getByRole('tab',{name:/发货与物流/}));const question=screen.getByRole('button',{name:'客户问异地怎么运输'});assert.equal(question.getAttribute('aria-expanded'),'false');await u.click(question);assert.equal(question.getAttribute('aria-expanded'),'true');const answer=screen.getByRole('region',{name:'客户问异地怎么运输'});assert.match(answer.textContent,/收货城市/);await u.click(within(answer).getByRole('button',{name:'复制对客解释话术'}));assert.match(copied,/实际运费/);assert.equal(m.calls.length,0);await u.click(screen.getByRole('tab',{name:/售后保障与话术/}));assert.equal(screen.queryByRole('button',{name:'客户问异地怎么运输'}),null);await u.click(screen.getByRole('button',{name:'客户反馈售后问题'}));assert.match(screen.getByRole('region',{name:'客户反馈售后问题'}).textContent,/收猫时间/);await u.click(menu('在售猫源库'));assert.equal(screen.getByPlaceholderText('短编号、品种、花色').value,'017');assert.equal(m.stock(),1);}finally{cleanup();m.restore();}});
test('legacy assistant URL returns to stock without showing hidden training',async()=>{const m=fixture();try{mount('/assistant/');await ready();assert.equal(within(screen.getByRole('navigation',{name:'销售工作台主导航'})).getAllByRole('link').length,2);assert.equal(screen.queryByRole('link',{name:/新手模拟带练/}),null);assert.ok(menu('在售猫源库').getAttribute('aria-current'));assert.equal(m.calls.length,0);}finally{cleanup();m.restore();}});

test('admin component works with real authorization, D1 create/log/reset/ban and emergency stop APIs',async()=>{
  const db=makeDB(),original=globalThis.fetch;
  const env={SALES_DB:db,ADMIN_USERNAME:'qa',ADMIN_PASSWORD_HASH:'120000.dGVzdA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',ADMIN_SESSION_SECRET:'component-only-session-secret-more-than-32-characters'};
  const adminCookie=createSessionCookie(env).split(';')[0];const key=await newKey(db,'已有销售',20);
  let generatedCode='';
  globalThis.fetch=async(path,options={})=>{
    const response=await worker.fetch(new Request('https://component.example'+path,{method:options.method||'GET',headers:{Origin:'https://component.example','Content-Type':'application/json',Cookie:adminCookie},...(options.body?{body:options.body}:{})}),env,{waitUntil(){}});
    if(options.method==='POST'&&path.endsWith('/keys'))generatedCode=(await response.clone().json()).data?.key_code;
    return response;
  };
  window.confirm=()=>true;const user=userEvent.setup({delay:null});try{
    render(<SalesRiskAdmin/>);await screen.findByText('已有销售');
    await user.type(screen.getByLabelText('销售姓名',{exact:true}),'新销售');await user.click(screen.getByRole('button',{name:'生成销售激活码'}));
    await screen.findByText('新销售');assert.match(generatedCode,/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
    assert.equal(db.sql.prepare('SELECT COUNT(*) n FROM sales_keys').get().n,2);
    const row=screen.getByText('已有销售').closest('tr');
    const buttons=[...row.querySelectorAll('button')];await user.click(buttons.find(x=>x.textContent==='查看记录'));await screen.findByRole('dialog',{name:'销售最近聊天记录'});
    await screen.findByText('暂无调用记录');await user.click(screen.getByRole('button',{name:'关闭聊天记录'}));
    await user.click(buttons.find(x=>x.textContent==='重置设备'));await waitFor(()=>assert.equal(db.sql.prepare('SELECT auth_version FROM sales_keys WHERE id=?').get(key.id).auth_version,2));
    await waitFor(()=>assert.equal(buttons.find(x=>x.textContent==='封禁').disabled,false));await user.click(buttons.find(x=>x.textContent==='封禁'));
    await waitFor(()=>assert.equal(db.sql.prepare('SELECT status FROM sales_keys WHERE id=?').get(key.id).status,0));
    await waitFor(()=>assert.equal(screen.getByRole('button',{name:'立即暂停 AI'}).disabled,false));await user.click(screen.getByRole('button',{name:'立即暂停 AI'}));
    await screen.findByText('AI 服务已暂停');assert.equal(db.sql.prepare('SELECT enabled FROM ai_settings').get().enabled,0);
  }finally{cleanup();globalThis.fetch=original;db.close();}
});

const marketingStock=Array.from({length:10},(_,i)=>({...cats[i%2],id:'CAT-2026-'+String(17+i).padStart(6,'0'),price:600+i*100,image:'/api/public-images/demo-'+i}));
function stubCanvas(){
 const oldURL=window.HTMLCanvasElement.prototype.toDataURL,oldImage=globalThis.Image,oldContext=window.HTMLCanvasElement.prototype.getContext,oldBlob=window.HTMLCanvasElement.prototype.toBlob,oldCreate=URL.createObjectURL,oldRevoke=URL.revokeObjectURL,oldClick=window.HTMLAnchorElement.prototype.click;let downloads=0;
 globalThis.Image=class{naturalWidth=1200;naturalHeight=800;set src(value){if(value)queueMicrotask(()=>this.onload?.());}};
 const ctx=new Proxy({measureText:text=>({width:String(text).length*20}),createLinearGradient:()=>({addColorStop(){}})},{get:(obj,key)=>key in obj?obj[key]:()=>{},set(obj,key,value){obj[key]=value;return true;}});
 window.HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/jpeg;base64,AA==';window.HTMLCanvasElement.prototype.getContext=()=>ctx;window.HTMLCanvasElement.prototype.toBlob=function(fn,type){if(type==='image/png')assert.equal(this.width,1080);else{assert.equal(type,'image/jpeg');assert.ok(this.width<=960&&this.height<=960);}fn(new Blob(['test'],{type}));};URL.createObjectURL=()=> 'blob:test-png';URL.revokeObjectURL=()=>{};window.HTMLAnchorElement.prototype.click=()=>{downloads++;};
 return{downloads:()=>downloads,restore(){window.HTMLCanvasElement.prototype.toDataURL=oldURL;globalThis.Image=oldImage;window.HTMLCanvasElement.prototype.getContext=oldContext;window.HTMLCanvasElement.prototype.toBlob=oldBlob;URL.createObjectURL=oldCreate;URL.revokeObjectURL=oldRevoke;window.HTMLAnchorElement.prototype.click=oldClick;}};
}
test('marketing capsule composes locally, updates prices/copy, downloads PNG and charges only on explicit AI generation',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});try{mount();await ready();await u.click(screen.getByRole('button',{name:/一键生成引流拼图 & 文案/}));const dialog=await screen.findByRole('dialog',{name:'营销拼图与文案'});assert.equal(dialog.querySelectorAll('.marketing-cat-prices label').length,9);const visual=within(dialog).getByRole('region',{name:'海报预览与下载'}),controls=within(dialog).getByRole('region',{name:'海报设置与文案'});assert.ok(within(visual).getByRole('button',{name:'下载高清PNG'}));assert.ok(within(controls).getByLabelText('统一加价（元）'));assert.equal(within(dialog).queryByRole('textbox',{name:'所在城市'}),null);assert.equal(within(dialog).queryByRole('textbox',{name:'猫舍 / 店铺名'}),null);assert.ok(controls.querySelector('.marketing-cat-prices'));assert.equal(visual.querySelector('.marketing-cat-prices'),null);assert.equal(m.calls.length,0);await waitFor(()=>assert.equal(within(dialog).getByRole('button',{name:'下载高清PNG'}).disabled,false));const markup=within(dialog).getByLabelText('统一加价（元）');assert.equal(markup.value,'800');await u.clear(markup);await u.type(markup,'900');await waitFor(()=>assert.equal(within(dialog).getByRole('button',{name:'下载高清PNG'}).disabled,false));assert.doesNotMatch(within(dialog).getByLabelText('基础文案 · 可编辑').value,/\d{4}|售价|底价/);await u.click(within(dialog).getByRole('button',{name:'下载高清PNG'}));await waitFor(()=>assert.equal(canvas.downloads(),1));assert.equal(m.calls.length,0);await u.click(within(dialog).getByRole('button',{name:'AI生成文案（1次）'}));await waitFor(()=>assert.equal(m.calls.length,1));assert.equal(m.calls[0].action,'marketing');assert.equal(m.calls[0].cat_ids.length,9);assert.equal(m.calls[0].marketing.prices[0],Number(marketingStock.find(c=>c.id===m.calls[0].cat_ids[0]).price)+900);await within(dialog).findByLabelText('AI种草文案');assert.match(screen.getByText(/今日剩余:/).textContent,/19\/20/);await u.click(within(dialog).getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}));assert.equal(within(dialog).getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}).checked,true);await u.type(within(dialog).getByRole('textbox',{name:'所在城市'}),'杭州');await u.click(within(dialog).getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}));assert.equal(within(dialog).queryByRole('textbox',{name:'所在城市'}),null);await u.click(within(dialog).getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}));assert.equal(within(dialog).getByRole('textbox',{name:'所在城市'}).value,'杭州');assert.equal(within(dialog).queryByRole('combobox',{name:/换套海报皮肤/}),null);await u.click(within(dialog).getByRole('button',{name:'换一批猫'}));assert.equal(m.calls.length,1);}finally{cleanup();canvas.restore();m.restore();}
});
test('selection basket accepts up to nine and routes four/nine manually chosen cats into the studio',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});try{mount();await ready();const buttons=screen.getAllByRole('button',{name:'加入对比/拼图'});for(let i=0;i<4;i++)await u.click(buttons[i]);let basket=screen.getByLabelText('选猫操作台');assert.equal(within(basket).queryByRole('button',{name:/AI生成双猫/}),null);await u.click(within(basket).getByRole('button',{name:/一键合成为报价拼图/}));let studio=await screen.findByRole('dialog',{name:'营销拼图与文案'});assert.equal(studio.querySelectorAll('.marketing-cat-prices label').length,4);assert.equal(studio.querySelectorAll('.marketing-cat-prices label').length,4);await u.click(within(studio).getByRole('button',{name:'关闭结果窗口'}));for(let i=4;i<10;i++)await u.click(buttons[i]);basket=screen.getByLabelText('选猫操作台');assert.match(basket.textContent,/已选9只/);await screen.findByText('最多选择9只，请先移除一只');await u.click(within(basket).getByRole('button',{name:/一键合成为报价拼图/}));studio=await screen.findByRole('dialog',{name:'营销拼图与文案'});assert.equal(studio.querySelectorAll('.marketing-cat-prices label').length,9);assert.equal(m.calls.length,0);}finally{cleanup();canvas.restore();m.restore();}
});
test('changing the shop during a pending marketing request discards stale AI copy without retrying',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null}),base=globalThis.fetch;let release;
 globalThis.fetch=(path,opts)=>path==='/api/ai/ask'?new Promise(resolve=>{release=async()=>resolve(await base(path,opts));}):base(path,opts);
 try{mount();await ready();await u.click(screen.getByRole('button',{name:/一键生成引流拼图 & 文案/}));const studio=await screen.findByRole('dialog',{name:'营销拼图与文案'});
 fireEvent.click(within(studio).getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}));
 fireEvent.click(within(studio).getByRole('button',{name:'AI生成文案（1次）'}));await waitFor(()=>assert.equal(typeof release,'function'));
 fireEvent.change(within(studio).getByRole('textbox',{name:'猫舍 / 店铺名'}),{target:{value:'新店名'}});await release();
 await waitFor(()=>assert.equal(m.calls.length,1));await screen.findByText(/今日剩余: 19\/20/);
 assert.equal(within(studio).queryByLabelText('AI种草文案'),null);assert.match(within(studio).getByLabelText('基础文案 · 可编辑').value,/新店名/);
 }finally{await release?.();cleanup();canvas.restore();m.restore();}
});

test('guest can edit and export a collage locally; optional seller login uses existing activation',async()=>{
 const m=fixture({signed:false,stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});try{mount();await ready();await u.click(screen.getByRole('button',{name:/一键生成引流拼图 & 文案/}));
 const studio=await screen.findByRole('dialog',{name:'营销拼图与文案'});await waitFor(()=>assert.equal(within(studio).getByRole('button',{name:'下载高清PNG'}).disabled,false));
 await u.click(within(studio).getByRole('button',{name:'下载高清PNG'}));await waitFor(()=>assert.equal(canvas.downloads(),1));assert.equal(m.calls.length,0);
 await u.click(within(studio).getByRole('button',{name:'关闭结果窗口'}));await u.click(screen.getByRole('button',{name:'切换销售账号'}));
 const login=await screen.findByRole('dialog',{name:'销售账号登录（可选）'});await u.type(within(login).getByLabelText('销售激活码'),'ABCD-EF01-2345-6789');await u.click(within(login).getByRole('button',{name:'登录销售账号'}));
 await waitFor(()=>assert.equal(screen.queryByRole('dialog',{name:'销售账号登录（可选）'}),null));assert.ok(screen.getByRole('button',{name:'退出销售账号'}));assert.equal(m.calls.length,0);
 }finally{cleanup();canvas.restore();m.restore();}
});

test('marketing closes only on its explicit X, never on drag, double-click, backdrop or Escape; random layout and photo-order controls stay usable',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});try{mount();await ready();await u.click(screen.getByRole('button',{name:/一键生成引流拼图 & 文案/}));const studio=await screen.findByRole('dialog',{name:'营销拼图与文案'}),overlay=studio.parentElement,tip=within(studio).getByText(/改猫咪或改店名后/);await u.dblClick(tip);fireEvent.mouseDown(tip);fireEvent.mouseMove(overlay);fireEvent.mouseUp(overlay);await u.click(overlay);await u.dblClick(overlay);await u.keyboard('{Escape}');assert.ok(screen.getByRole('dialog',{name:'营销拼图与文案'}));assert.equal(within(studio).queryByRole('combobox',{name:/换套海报皮肤/}),null);await u.click(within(studio).getByRole('button',{name:/随机换排版/}));await u.click(within(studio).getByRole('button',{name:'打乱顺序'}));assert.equal(m.calls.length,0);await u.click(within(studio).getByRole('button',{name:'关闭结果窗口'}));assert.equal(screen.queryByRole('dialog',{name:'营销拼图与文案'}),null);}finally{cleanup();canvas.restore();m.restore();}
});
test('every manual basket size 2–9 opens a collage, with comparison remaining exclusive to two',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});try{mount();await ready();const buttons=screen.getAllByRole('button',{name:'加入对比/拼图'});await u.click(buttons[0]);for(let n=2;n<=9;n++){await u.click(buttons[n-1]);const basket=screen.getByLabelText('选猫操作台');assert.equal(Boolean(within(basket).queryByRole('button',{name:/AI生成双猫/})),n===2);await u.click(within(basket).getByRole('button',{name:/一键合成为报价拼图/}));const studio=await screen.findByRole('dialog',{name:'营销拼图与文案'});assert.equal(studio.querySelectorAll('.marketing-cat-prices label').length,n);await u.click(within(studio).getByRole('button',{name:'关闭结果窗口'}));}assert.equal(m.calls.length,0);}finally{cleanup();canvas.restore();m.restore();}
});
test('fast downloads reuse the preview; optional variation repaints without AI charges or duplicate memo rows',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});const original=window.HTMLCanvasElement.prototype.getContext;const crops=[];window.HTMLCanvasElement.prototype.getContext=function(...args){const ctx=original.apply(this,args);return new Proxy(ctx,{get(obj,key){if(key==='drawImage')return (...values)=>{if(values.length===9)crops.push(values.slice(1,5));return obj.drawImage(...values);};return obj[key];},set(obj,key,value){obj[key]=value;return true;}});};
 try{mount();await ready();await u.click(screen.getByRole('button',{name:/一键生成引流拼图 & 文案/}));const studio=await screen.findByRole('dialog',{name:'营销拼图与文案'});await waitFor(()=>assert.equal(within(studio).getByRole('button',{name:'下载高清PNG'}).disabled,false));const first=crops.slice(-9);await u.click(within(studio).getByRole('button',{name:'下载高清PNG'}));await waitFor(()=>assert.equal(canvas.downloads(),1));const second=crops.slice(-9);assert.deepEqual(first,second);await u.click(within(studio).getByText('更多出图选项与说明'));await u.click(within(studio).getByRole('checkbox',{name:'下载时重新微调构图（稍慢）'}));await u.click(within(studio).getByRole('button',{name:'下载高清PNG'}));await waitFor(()=>assert.equal(canvas.downloads(),2));assert.notDeepEqual(second,crops.slice(-9));assert.equal(localStorage.getItem('sales-followups-v1'),null);assert.equal(m.calls.length,0);assert.equal(studio.querySelector('canvas').hidden,false);}finally{cleanup();canvas.restore();m.restore();}
});

test('hidden training URL returns to stock while preserving saved progress',async()=>{const m=fixture();const saved=JSON.stringify({step:3,reached:3});localStorage.setItem('cat-sales-guided-practice-v4',saved);try{mount('/training/');await ready();assert.equal(document.querySelector('.workspace-training'),null);assert.equal(localStorage.getItem('cat-sales-guided-practice-v4'),saved);assert.ok(menu('在售猫源库').getAttribute('aria-current'));}finally{cleanup();m.restore();}});

test('customer display preserves selected work and persisted markup through toggles and reload',async()=>{
 const m=fixture({stockCats:marketingStock}),u=userEvent.setup({delay:null});try{mount();await ready();await u.click(screen.getAllByRole('button',{name:'加入对比/拼图'})[0]);const input=screen.getByRole('spinbutton',{name:'对客加价金额'});await u.clear(input);await u.type(input,'1200');await u.click(screen.getByRole('switch',{name:'对客模式'}));assert.equal(screen.queryByLabelText('选猫操作台'),null);assert.equal(screen.queryByRole('dialog'),null);await u.click(screen.getByRole('switch',{name:'对客模式'}));assert.match(screen.getByLabelText('选猫操作台').textContent,/已选1只/);cleanup();mount();await ready();assert.equal(screen.getByRole('spinbutton',{name:'对客加价金额'}).value,'1200');assert.equal(screen.getByRole('switch',{name:'对客模式'}).getAttribute('aria-checked'),'false');}finally{cleanup();m.restore();}
});

const visibleOrder=()=>[...document.querySelectorAll('.workspace-stock-card')].map(el=>el.getAttribute('aria-label'));
test('daily distribution stays stable with no sort selector, and manual reshuffle preserves the draft and filter',async()=>{const m=fixture({stockCats:marketingStock}),u=userEvent.setup({delay:null});try{mount();await ready();const initial=visibleOrder();assert.equal(screen.queryByRole('combobox',{name:'猫源排序'}),null);await u.type(screen.getByLabelText('客户选猫需求'),'客户预算3000元');await u.click(screen.getByRole('button',{name:'更多筛选'}));await u.type(screen.getByPlaceholderText('短编号、品种、花色'),'猫');await u.clear(screen.getByPlaceholderText('短编号、品种、花色'));await u.click(screen.getByRole('button',{name:'🔀 随机换一批'}));const manual=visibleOrder();assert.notDeepEqual(manual,initial);assert.equal(screen.getByLabelText('客户选猫需求').value,'客户预算3000元');assert.equal(m.stock(),1);assert.equal(m.calls.length,0);cleanup();mount();await ready();assert.deepEqual(visibleOrder(),manual);assert.ok(localStorage.getItem('sales-catalog-rounds-v1'));}finally{cleanup();m.restore();}});

test('account identity changes distribution while a guest keeps its stored browser identity across reloads',async()=>{
 let m=fixture({stockCats:marketingStock,accountId:12});try{mount();await ready();const first=visibleOrder();cleanup();m.restore();m=fixture({stockCats:marketingStock,accountId:13});mount();await ready();assert.notDeepEqual(visibleOrder(),first);cleanup();m.restore();m=fixture({signed:false,stockCats:marketingStock});mount();await ready();const guest=visibleOrder(),device=localStorage.getItem('sales-device-id');cleanup();mount();await ready();assert.deepEqual(visibleOrder(),guest);assert.equal(localStorage.getItem('sales-device-id'),device);}finally{cleanup();m.restore();}
});
test('procedural style, photo order, mirror and banner controls are independent, preserve per-cat prices and never spend AI quota',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});try{mount();await ready();await u.click(screen.getByRole('button',{name:/一键生成引流拼图 & 文案/}));const studio=await screen.findByRole('dialog',{name:'营销拼图与文案'}),first=studio.querySelector('.marketing-cat-prices input'),label=first.getAttribute('aria-label');await u.clear(first);await u.type(first,'9900');const before=[...studio.querySelectorAll('.marketing-cat-prices input')].map(el=>el.getAttribute('aria-label'));await u.click(within(studio).getByRole('button',{name:'打乱顺序'}));const after=[...studio.querySelectorAll('.marketing-cat-prices input')].map(el=>el.getAttribute('aria-label'));assert.notDeepEqual(after,before);assert.equal(within(studio).getByRole('spinbutton',{name:label}).value,'9900');const caption=within(studio).getByLabelText('基础文案 · 可编辑');await u.clear(caption);await u.type(caption,'自己修改的对客文案');await u.click(within(studio).getByRole('button',{name:/随机换排版/}));assert.equal(caption.value,'自己修改的对客文案');const mirror=within(studio).getByRole('checkbox',{name:'允许照片随机镜像'});assert.equal(mirror.checked,true);await u.click(mirror);assert.equal(mirror.checked,false);await u.click(within(studio).getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}));assert.ok(within(studio).getByRole('textbox',{name:/招牌文字/}));assert.equal(m.calls.length,0);assert.equal(m.stock(),1);}finally{cleanup();canvas.restore();m.restore();}
});

test('hidden notes survive shared-sidebar image repair without showing favorites or memo tools',async()=>{const m=fixture(),u=userEvent.setup({delay:null}),saved=JSON.stringify([{id:'client-1',catId:cats[0].id,note:'杭州客户',quote:1350}]);localStorage.setItem('sales-followups-v1',saved);try{mount();await ready();assert.equal(screen.queryByRole('button',{name:/今日跟进备忘录|收藏/}),null);assert.equal(document.querySelector('.catalog-bookmark'),null);const sidebar=document.querySelector('.workspace-sidebar');await u.click(within(sidebar).getByRole('button',{name:'修复图片缓存'}));await screen.findByText('已重新请求图片与库存；激活信息和备忘录已保留。');assert.equal(localStorage.getItem('sales-followups-v1'),saved);assert.equal(document.querySelector('.catalog-tools .sidebar-repair-link'),null);cleanup();mount();await ready();assert.equal(localStorage.getItem('sales-followups-v1'),saved);}finally{cleanup();m.restore();}});

test('guest focus checks no longer dismiss the free poster studio or lose edited shop text',async()=>{
 const m=fixture({signed:false,stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});try{mount();await ready();await u.click(screen.getByRole('button',{name:/一键生成引流拼图 & 文案/}));const studio=await screen.findByRole('dialog',{name:'营销拼图与文案'});await u.click(within(studio).getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}));await u.clear(within(studio).getByRole('textbox',{name:'猫舍 / 店铺名'}));await u.type(within(studio).getByRole('textbox',{name:'猫舍 / 店铺名'}),'杭州猫舍');fireEvent(window,new window.Event('focus'));await waitFor(()=>assert.equal(within(studio).getByRole('button',{name:'下载高清PNG'}).disabled,false));assert.ok(screen.getByRole('dialog',{name:'营销拼图与文案'}));assert.equal(within(studio).getByRole('textbox',{name:'猫舍 / 店铺名'}).value,'杭州猫舍');assert.equal(m.calls.length,0);}finally{cleanup();canvas.restore();m.restore();}
});
test('cat detail copies an unambiguous stock-check command, exposes native full-file downloads and hides internal tools in client view',async()=>{
 const stock=marketingStock.map((c,i)=>i?c:{...c,videos:[{url:'/api/public-videos/demo-video',name:'play.mp4'}]}),m=fixture({stockCats:stock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});let text='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{text=value;}},configurable:true});try{mount();await ready();await u.click(within(screen.getByRole('article',{name:'#017 布偶猫'})).getByRole('button',{name:'查看资料'}));const detail=await screen.findByRole('dialog',{name:'猫咪销售资料'});await u.click(within(detail).getByRole('button',{name:/复制报单口令/}));assert.match(text,/CAT-2026-000017/);assert.match(text,/合作底价：¥600/);await u.click(within(detail).getByRole('button',{name:/下载原视频与高清图/}));const files=await screen.findByRole('dialog',{name:'下载原始图片与视频'});assert.match(within(files).getByRole('link',{name:/原视频/}).getAttribute('href'),/download=1/);assert.equal(m.calls.length,0);await u.click(within(files).getByRole('button',{name:'关闭结果窗口'}));await u.click(within(detail).getByRole('button',{name:'关闭结果窗口'}));await u.click(screen.getByRole('switch',{name:'对客模式'}));await u.click(within(screen.getByRole('article',{name:'#017 布偶猫'})).getByRole('button',{name:'查看资料'}));const publicDetail=await screen.findByRole('dialog',{name:'猫咪资料'});assert.equal(within(publicDetail).queryByRole('button',{name:/复制报单口令/}),null);assert.equal(within(publicDetail).queryByRole('button',{name:/速算器/}),null);}finally{cleanup();canvas.restore();m.restore();}
});
test('manual freight estimates produce an auditable margin and customer-only prepayment text without invented rates',async()=>{
 const m=fixture({stockCats:marketingStock}),canvas=stubCanvas(),u=userEvent.setup({delay:null});let text='';Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{text=value;}},configurable:true});try{mount();await ready();await u.click(within(screen.getByRole('article',{name:'#017 布偶猫'})).getByRole('button',{name:'查看资料'}));await u.click(screen.getByRole('button',{name:/运费与收款速算器/}));const tool=await screen.findByRole('dialog',{name:'运费与收款速算器'});assert.equal(within(tool).getByRole('spinbutton',{name:'预估运费及检疫（元）'}).value,'');await u.selectOptions(within(tool).getByRole('combobox',{name:'客户所在省份'}),'浙江');await u.type(within(tool).getByRole('spinbutton',{name:'预估运费及检疫（元）'}),'200');await u.clear(within(tool).getByRole('spinbutton',{name:'你的对客报价（元）'}));await u.type(within(tool).getByRole('spinbutton',{name:'你的对客报价（元）'}),'1400');await u.type(within(tool).getByRole('spinbutton',{name:'拟收预付款（元）'}),'300');assert.match(tool.textContent,/总拿货成本：¥800/);assert.match(tool.textContent,/预计价差收益：¥600/);await u.click(within(tool).getByRole('button',{name:/复制预付款/}));assert.match(text,/余款1100元/);assert.doesNotMatch(text,/底价|净赚|保证/);assert.match(localStorage.getItem('sales-freight-estimates-v1'),/200/);assert.equal(m.calls.length,0);}finally{cleanup();canvas.restore();m.restore();}
});
test('single-cat poster includes retail price and stock facts, never prints base-price descriptions and survives nested Escape',async()=>{
 const m=fixture({stockCats:marketingStock.map((c,i)=>i?c:{...c,vaccine:'2针'})}),canvas=stubCanvas(),u=userEvent.setup({delay:null});const ctx=window.HTMLCanvasElement.prototype.getContext(),texts=[],fill=ctx.fillText;ctx.fillText=(text,...args)=>{texts.push(text);return fill(text,...args);};try{mount();await ready();await u.click(within(screen.getByRole('article',{name:'#017 布偶猫'})).getByRole('button',{name:'查看资料'}));const detail=await screen.findByRole('dialog',{name:'猫咪销售资料'});await u.click(within(detail).getByRole('button',{name:/生成单猫详情海报/}));const poster=await screen.findByRole('dialog',{name:'单猫详情海报'});await waitFor(()=>assert.equal(within(poster).getByRole('button',{name:'下载1080×1600详情海报'}).disabled,false));assert.match(texts.join('|'),/¥ 1,400/);assert.doesNotMatch(texts.join('|'),/售价/);assert.match(texts.join('|'),/疫苗2针/);assert.doesNotMatch(texts.join('|'),/底价|2600|2,600/);await u.keyboard('{Escape}');assert.ok(screen.getByRole('dialog',{name:'单猫详情海报'}));assert.ok(screen.getByRole('dialog',{name:'猫咪销售资料'}));await u.click(within(poster).getByRole('button',{name:'下载1080×1600详情海报'}));await waitFor(()=>assert.equal(canvas.downloads(),1));assert.equal(m.calls.length,0);}finally{cleanup();canvas.restore();m.restore();}
});


import './admin-controls.components.jsx';


test('saved admin title and highlight render in the finder immediately and after remount',async()=>{
 const m=fixture(),base=globalThis.fetch,db=makeDB(),u=userEvent.setup({delay:null});
 const env={SALES_DB:db,ADMIN_USERNAME:'title-admin',ADMIN_PASSWORD_HASH:'120000.dGVzdA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',ADMIN_SESSION_SECRET:'title-settings-test-session-secret-longer-than-32'};
 const session=createSessionCookie(env).split(';')[0];
 globalThis.fetch=(path,options={})=>String(path).startsWith('/api/sales-admin/')?worker.fetch(new Request('https://component.example'+path,{method:options.method||'GET',headers:{Origin:'https://component.example','Content-Type':'application/json',Cookie:session},...(options.body?{body:options.body}:{})}),env,{waitUntil(){}}):base(path,options);
 try{
  render(<MemoryRouter initialEntries={['/cats/']}><WorkbenchSettingsAdmin/><WorkspaceContent/></MemoryRouter>);await ready();
  const prefix=await screen.findByLabelText('AI标题前半句'),highlight=screen.getByLabelText('AI标题高亮词');
  await u.clear(prefix);await u.type(prefix,'帮你找到');await u.clear(highlight);await u.type(highlight,'心动小猫');
  await u.click(screen.getByRole('button',{name:'保存工作台设置'}));await screen.findByText('设置已保存。');
  const heading=screen.getByRole('heading',{level:2,name:'帮你找到 心动小猫'});assert.equal(heading.querySelector('span').textContent.trim(),'心动小猫');
  const saved=JSON.parse((await db.prepare('SELECT value FROM workbench_config WHERE id=1').first()).value);
  assert.equal(saved.heroTitle,'帮你找到');assert.equal(saved.heroHighlight,'心动小猫');
  cleanup();mount();await ready();assert.ok(screen.getByRole('heading',{level:2,name:'帮你找到 心动小猫'}));assert.equal(m.calls.length,0);
 }finally{cleanup();m.restore();db.close();}
});


test('common filters update inventory immediately without model calls, preserve criteria and clear individually',async()=>{
 const m=fixture(),u=userEvent.setup({delay:null});try{mount();await ready();
 await u.selectOptions(screen.getByRole('combobox',{name:'品种'}),'布偶猫');
 assert.equal(document.querySelectorAll('.workspace-stock-card').length,1);assert.match(document.querySelector('.catalog-filter-summary').textContent,/找到 1 只猫咪/);
 await u.selectOptions(screen.getByRole('combobox',{name:'性别'}),'公');
 assert.equal(document.querySelectorAll('.workspace-stock-card').length,0);assert.ok(screen.getByText('没有符合这些条件的在售猫咪，请调整筛选条件。'));
 await u.click(screen.getByRole('button',{name:'移除筛选：性别：公'}));assert.equal(document.querySelectorAll('.workspace-stock-card').length,1);
 await u.click(screen.getByRole('button',{name:'更多筛选'}));assert.equal(screen.getByRole('button',{name:'收起更多筛选'}).getAttribute('aria-expanded'),'true');
 await u.type(screen.getByRole('textbox',{name:'编号或关键词'}),'017');await u.click(screen.getByRole('button',{name:'收起更多筛选'}));
 assert.ok(screen.getByRole('button',{name:'移除筛选：关键词：017'}));
 await u.click(screen.getByRole('button',{name:'清空筛选'}));assert.equal(document.querySelectorAll('.workspace-stock-card').length,2);
 assert.equal(screen.getByRole('combobox',{name:'品种'}).value,'');assert.equal(document.querySelectorAll('.catalog-filter-chips button').length,0);assert.equal(m.calls.length,0);assert.equal(m.stock(),1);
 }finally{cleanup();m.restore();}
});

test('manual budget uses customer markup by default, can select wholesale, and reacts to markup changes',async()=>{
 const m=fixture(),u=userEvent.setup({delay:null});try{mount();await ready();
 assert.equal(screen.getByRole('combobox',{name:'预算价格口径'}).value,'customer');
 fireEvent.change(screen.getByRole('spinbutton',{name:'最低价格'}),{target:{value:'3000'}});fireEvent.change(screen.getByRole('spinbutton',{name:'最高价格'}),{target:{value:'3500'}});
 assert.equal(document.querySelectorAll('.workspace-stock-card').length,1);assert.ok(screen.getByRole('article',{name:'#017 布偶猫'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'找猫对客加价'}),{target:{value:'1200'}});assert.equal(document.querySelectorAll('.workspace-stock-card').length,1);assert.ok(screen.getByRole('article',{name:'#018 英短'}));
 await u.selectOptions(screen.getByRole('combobox',{name:'预算价格口径'}),'wholesale');assert.equal(document.querySelectorAll('.workspace-stock-card').length,0);
 fireEvent.change(screen.getByRole('spinbutton',{name:'最低价格'}),{target:{value:'1800'}});fireEvent.change(screen.getByRole('spinbutton',{name:'最高价格'}),{target:{value:'2000'}});assert.ok(screen.getByRole('article',{name:'#018 英短'}));
 await u.click(screen.getByRole('switch',{name:'对客模式'}));assert.equal(screen.queryByRole('combobox',{name:'预算价格口径'}),null);assert.equal(document.querySelectorAll('.workspace-stock-card').length,0);assert.equal(m.calls.length,0);
 }finally{cleanup();m.restore();}
});

test('age ranges reject unknown ages, invalid ranges are explained and zero price is a real filter',async()=>{
 const stock=[...cats,{id:'ZERO',breed:'布偶猫',price:0,age:'两个月'},{id:'UNKNOWN',breed:'布偶猫',price:null,age:'未知'},{id:'YEAR',breed:'布偶猫',price:500,age:'一岁'}];
 const m=fixture({stockCats:stock}),u=userEvent.setup({delay:null});try{mount();await ready();await u.click(screen.getByRole('button',{name:'更多筛选'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'最大月龄'}),{target:{value:'3'}});assert.equal(document.querySelectorAll('.workspace-stock-card').length,2);assert.ok(screen.getByRole('article',{name:'#ZERO 布偶猫'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'最小月龄'}),{target:{value:'4'}});assert.match(screen.getByRole('alert').textContent,/月龄下限不能高于上限/);assert.equal(document.querySelectorAll('.workspace-stock-card').length,0);
 await u.click(screen.getByRole('button',{name:'清空筛选'}));await u.selectOptions(screen.getByRole('combobox',{name:'预算价格口径'}),'wholesale');
 fireEvent.change(screen.getByRole('spinbutton',{name:'最高价格'}),{target:{value:'0'}});assert.equal(document.querySelectorAll('.workspace-stock-card').length,1);assert.ok(screen.getByRole('article',{name:'#ZERO 布偶猫'}));
 fireEvent.change(screen.getByRole('spinbutton',{name:'最低价格'}),{target:{value:'1'}});assert.match(screen.getByRole('alert').textContent,/预算下限不能高于上限/);assert.equal(m.calls.length,0);
 }finally{cleanup();m.restore();}
});

test('guest keeps free non-price filters at zero quota but public cache never includes partner prices',async()=>{
 const m=fixture({signed:false,remaining:0}),u=userEvent.setup({delay:null});try{mount();await ready();await screen.findByText('访客免费使用');assert.equal(screen.queryByRole('combobox',{name:'预算价格口径'}),null);
 assert.equal(screen.getByRole('spinbutton',{name:'最高价格'}).disabled,true);assert.equal(screen.getByRole('spinbutton',{name:'最低价格'}).disabled,true);
 await u.selectOptions(screen.getByRole('combobox',{name:'性别'}),'公');assert.equal(document.querySelectorAll('.workspace-stock-card').length,1);assert.ok(screen.getByRole('article',{name:'#018 英短'}));assert.equal(m.calls.length,0);assert.equal(m.stock(),1);
 assert.doesNotMatch(localStorage.getItem('public-cat-catalog-v3')||'',/"price":|"description":/);
 }finally{cleanup();m.restore();}
});


test('asking a handbook question between finder requests preserves the original selection and need',async()=>{
 const m=fixture(),base=globalThis.fetch,u=userEvent.setup({delay:null});
 globalThis.fetch=(path,options={})=>{const body=JSON.parse(options.body||'{}');if(path==='/api/ai/ask'&&body.prompt==='合作需要押金吗？'){m.calls.push(body);return Response.json({success:true,user:{id:101,sales_name:'测试销售',remaining:19,daily_limit:20,retry_after:0},data:{kind:'handbook',used_ai:true,model_calls:2,matched_ids:[],reply_text:'根据手册，合作不收押金；具体合作安排可以继续向负责人确认。',sources:[{title:'合作条件',manual:'基础与成交手册',href:'/guide/#job'}]}});}return base(path,options);};
 try{mount();await ready();fireEvent.change(screen.getByLabelText('客户选猫需求'),{target:{value:'找一只3000元以内的布偶猫'}});await u.click(screen.getByRole('button',{name:'发送客户需求'}));
 const dialog=await screen.findByRole('dialog',{name:'智能找猫 · 对话'});await within(dialog).findByText('找猫说明');
 fireEvent.change(within(dialog).getByLabelText('继续找猫'),{target:{value:'合作需要押金吗？'}});await u.click(within(dialog).getByRole('button',{name:'发送',exact:true}));await within(dialog).findByText('手册答疑');
 fireEvent.change(within(dialog).getByLabelText('继续找猫'),{target:{value:'只换第一只，找更便宜的'}});await u.click(within(dialog).getByRole('button',{name:'发送',exact:true}));await waitFor(()=>assert.equal(m.calls.length,3));
 assert.deepEqual(m.calls[2].cat_context.cat_ids,[cats[0].id]);assert.equal(m.calls[2].cat_context.need,'找一只3000元以内的布偶猫');assert.equal(m.calls[2].action,'cat_only');
 }finally{cleanup();m.restore();}
});


test('consultant sends unstructured questions and recent dialogue to the same AI endpoint, with paid handbook disclosure',async()=>{
 const m=fixture(),base=globalThis.fetch,u=userEvent.setup({delay:null});let received;
 globalThis.fetch=(path,options={})=>{const body=JSON.parse(options.body||'{}');if(path==='/api/ai/ask'){received=body;m.calls.push(body);return Response.json({success:true,user:{id:101,sales_name:'测试销售',remaining:19,daily_limit:20,retry_after:0},data:{kind:'handbook',used_ai:true,model_calls:2,matched_ids:[],reply_text:'先把库存和费用确认清楚，再按手册的收款下单流程处理。',sources:[{title:'成交和下单',manual:'基础与成交手册',href:'/guide/#deal'}]}});}return base(path,options);};
 try{mount();await ready();fireEvent.change(screen.getByLabelText('客户选猫需求'),{target:{value:'客人说钱已经给了，那边又没动静，我该咋接？'}});await u.click(screen.getByRole('button',{name:'发送客户需求'}));
 const dialog=await screen.findByRole('dialog',{name:'智能找猫 · 对话'});await within(dialog).findByText('手册答疑');assert.ok(within(dialog).getByText(/本轮计入1次额度/));
 assert.equal(received.action,'cat_only');assert.match(received.prompt,/钱已经给了/);assert.ok(Array.isArray(received.conversation));assert.equal(within(dialog).getByRole('link').getAttribute('href'),'/guide/#deal');assert.equal(m.calls.length,1);
 }finally{cleanup();m.restore();}
});

test('chat handbook questions respect AI cooldown while manual filters remain usable',async()=>{
 const m=fixture({remaining:0,retryAfter:15}),u=userEvent.setup({delay:null});try{mount();await ready();fireEvent.change(screen.getByLabelText('客户选猫需求'),{target:{value:'合作需要押金吗？'}});await u.click(screen.getByRole('button',{name:'发送客户需求'}));
 const dialog=await screen.findByRole('dialog',{name:'智能找猫 · 对话'});await within(dialog).findByText(/请等待.*秒后再试/);assert.equal(m.calls.length,0);
 await u.click(within(dialog).getByRole('button',{name:'关闭结果窗口'}));await u.selectOptions(screen.getByRole('combobox',{name:'品种'}),'布偶猫');assert.equal(document.querySelectorAll('.workspace-stock-card').length,1);
 }finally{cleanup();m.restore();}
});


test('inventory statistics in chat still reach AI instead of reusing the former local stats shortcut',async()=>{
 const m=fixture(),u=userEvent.setup({delay:null});
 sessionStorage.setItem('cat-finder-only-v1:sales:101',JSON.stringify({at:Date.now(),context:{task:'match',cat_ids:[cats[0].id],need:'找布偶猫',excluded_ids:[]},messages:[{role:'assistant',text:'旧筛选统计',result:{kind:'inventory',matched_ids:['#'+cats[0].id],stats:{total:100,eligible:10,female:2,male:8}}}],result:null}));
 try{mount();await ready();fireEvent.change(screen.getByLabelText('客户选猫需求'),{target:{value:'为什么符合条件的母猫这么少？'}});await u.click(screen.getByRole('button',{name:'发送客户需求'}));await waitFor(()=>assert.equal(m.calls.length,1));assert.equal(m.calls[0].action,'cat_only');assert.ok(m.calls[0].conversation.some(row=>row.text==='旧筛选统计'));assert.equal(document.body.textContent.includes('根据上一次找猫筛选记录'),false);
 }finally{cleanup();m.restore();}
});

test('mixed AI answers display both selected cats and handbook sources with one-turn charging disclosure',async()=>{
 const m=fixture(),base=globalThis.fetch,u=userEvent.setup({delay:null});
 globalThis.fetch=(path,options={})=>path==='/api/ai/ask'?Response.json({success:true,user:{id:101,sales_name:'测试销售',remaining:19,daily_limit:20,retry_after:0},data:{kind:'inventory',used_ai:true,model_calls:2,matched_ids:['#'+cats[0].id],reply_text:'已从库存选出合适猫咪。付款安排应先确认库存与费用，再按手册流程处理。',cat_context:{cat_ids:[cats[0].id],need:'选一只布偶猫',excluded_ids:[]},sources:[{title:'成交和下单',manual:'基础与成交手册',href:'/guide/#deal'}]}}):base(path,options);
 try{mount();await ready();fireEvent.change(screen.getByLabelText('客户选猫需求'),{target:{value:'选一只布偶猫，顺便说说钱该先给谁'}});await u.click(screen.getByRole('button',{name:'发送客户需求'}));const dialog=await screen.findByRole('dialog',{name:'智能找猫 · 对话'});
 await within(dialog).findByText('在售猫咪查询结果');assert.equal(dialog.querySelectorAll('.sales-ai-cat').length,1);assert.ok(within(dialog).getByText('手册出处'));assert.equal(within(dialog).getByRole('link').getAttribute('href'),'/guide/#deal');assert.ok(within(dialog).getByText(/本轮计入1次额度/));
 }finally{cleanup();m.restore();}
});


test('an AI answer with no retrieved section is labelled as missing evidence rather than a sourced answer',async()=>{
 const m=fixture(),base=globalThis.fetch,u=userEvent.setup({delay:null});
 globalThis.fetch=(path,options={})=>path==='/api/ai/ask'?Response.json({success:true,user:{id:101,sales_name:'测试销售',remaining:19,daily_limit:20,retry_after:0},data:{kind:'handbook',used_ai:true,model_calls:2,matched_ids:[],reply_text:'当前资料没有写明这项特殊安排，需要向负责人核实。',sources:[],needs_confirmation:true}}):base(path,options);
 try{mount();await ready();fireEvent.change(screen.getByLabelText('客户选猫需求'),{target:{value:'那种特殊情况也能办吗？'}});await u.click(screen.getByRole('button',{name:'发送客户需求'}));const dialog=await screen.findByRole('dialog',{name:'智能找猫 · 对话'});await within(dialog).findByText('资料情况');assert.equal(within(dialog).queryByText('手册出处'),null);assert.ok(within(dialog).getByText(/AI未查到明确手册依据/));assert.equal(within(dialog).queryAllByRole('link').length,0);
 }finally{cleanup();m.restore();}
});

test('photo proposal plus uses the existing selection basket and stays available at zero AI quota',async()=>{
 const m=fixture({remaining:0,retryAfter:15}),u=userEvent.setup({delay:null});try{mount();await ready();
 const first=screen.getByRole('article',{name:'#017 布偶猫'});await u.click(within(first).getByRole('button',{name:'加入提案车 #017'}));
 const basket=screen.getByLabelText('选猫操作台');assert.equal(within(basket).getByRole('button',{name:'配置专属转发页'}).disabled,false);assert.match(basket.textContent,/#017/);assert.equal(m.calls.length,0);
 assert.equal(screen.getByRole('link',{name:'专属转发 / 我的方案 ↗'}).getAttribute('href'),'/forward/');
 await u.click(within(first).getByRole('button',{name:'移出提案车 #017'}));assert.equal(screen.queryByLabelText('选猫操作台'),null);
 }finally{cleanup();m.restore();}
});
