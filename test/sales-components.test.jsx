import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import SalesAI from '../src/components/SalesAI.jsx';
import SalesRiskAdmin from '../src/components/SalesRiskAdmin.jsx';
import {WorkspaceContent} from '../src/SalesWorkspace.jsx';
import {MemoryRouter} from 'react-router-dom';
import worker from '../cloudflare-worker.js';
import { createSessionCookie } from '../cloud-functions/_lib/admin-auth.js';
import { makeDB } from './sales-db.mjs';
import { newKey } from '../cloud-functions/_lib/sales-store.js';
const {render,screen,waitFor,cleanup,configure,within}=await import('@testing-library/react');
const {default:userEvent}=await import('@testing-library/user-event');
configure({asyncUtilTimeout:15000});
function mockSalesAPI({initialUser=null,askFails=false}={}){
  let activated=Boolean(initialUser),calls=0;
  const user={id:1,sales_name:'组件测试销售',remaining:20,daily_limit:20,used_today:0,retry_after:0};
  const original=globalThis.fetch;
  globalThis.fetch=async(path,options={})=>{
    if(path==='/api/ai/session')return activated?Response.json({success:true,user}):Response.json({success:false}, {status:401});
    if(path==='/api/ai/activate'){
      const body=JSON.parse(options.body);assert.match(body.device_id,/^[a-f0-9-]{36}$/);
      if(body.key_code!=='ABCD-EF01-2345-6789')return Response.json({success:false,message:'激活码无效或已被管理员封禁'},{status:403});
      activated=true;return Response.json({success:true,user});
    }
    if(path==='/api/ai/ask'){
      calls++;assert.equal(activated,true);const body=JSON.parse(options.body);assert.ok(body.device_id);assert.equal(body.mode,'match');
      if(askFails)return Response.json({success:false,message:'已请求模型，计入1次',user:{...user,remaining:19},retry_after:15},{status:502});
      return Response.json({success:true,user:{...user,remaining:19,retry_after:15},data:{matched_ids:['#A01'],reply_text:'#A01 圆脸亲人，可以先看视频。',used_ai:true}});
    }
    throw new Error(`Unexpected path ${path}`);
  };
  return{restore(){globalThis.fetch=original;},count:()=>calls};
}
test('composer activation continues exactly once, shows quota/cooldown, copies and opens real card',async()=>{
  localStorage.clear();const mock=mockSalesAPI(),user=userEvent.setup({delay:null});let detail=null,clipboard='';
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async x=>{clipboard=x;}},configurable:true});
  try{
    render(<SalesAI cats={[{id:'A01',breed:'布偶猫',price:2600,gender:'母'}]} onDetail={cat=>{detail=cat;}}/>);
    await screen.findByRole('button',{name:'工号: 未激活 / 剩余: -- 次'});
    await user.click(screen.getByRole('button',{name:/预算\+品种挑猫/}));
    const input=screen.getByLabelText('客户需求或猫咪编号');assert.equal(input.maxLength,200);assert.match(input.value,/客户预算/);
    await user.clear(input);await user.type(input,'客户预算3000元，布偶妹妹');
    await user.click(screen.getByRole('button',{name:'发送客户需求'}));
    await screen.findByRole('dialog',{name:'请输入内部销售激活码'});
    await user.type(screen.getByLabelText('销售激活码'),'WRONG');await user.click(screen.getByRole('button',{name:'激活并继续'}));
    await screen.findByText('激活码无效或已被管理员封禁');
    await user.clear(screen.getByLabelText('销售激活码'));await user.type(screen.getByLabelText('销售激活码'),'ABCD-EF01-2345-6789');
    await user.click(screen.getByRole('button',{name:'激活并继续'}));
    await screen.findByText('#A01 圆脸亲人，可以先看视频。');assert.equal(mock.count(),1);
    assert.match(screen.getByRole('button',{name:/工号: 组件测试销售/}).textContent,/19/);
    assert.equal(screen.getByRole('button',{name:/请等待\d+秒/}).disabled,true);
    await user.click(screen.getByRole('button',{name:/一键复制微信话术/}));await screen.findByRole('button',{name:/已复制/});assert.match(clipboard,/#A01/);
    await user.click(screen.getByRole('button',{name:/A01 · 布偶猫/}));assert.equal(detail.id,'A01');
    assert.ok(localStorage.getItem('sales-device-id'));assert.ok(!JSON.stringify({...localStorage}).includes('ABCD'));
  }finally{cleanup();mock.restore();}
});
test('quick commands change mode, Escape closes activation, paid error updates quota',async()=>{
  const mock=mockSalesAPI({initialUser:true,askFails:true}),user=userEvent.setup({delay:null});try{
    render(<SalesAI/>);await screen.findByRole('button',{name:/工号: 组件测试销售/});
    await user.click(screen.getByRole('button',{name:/两只猫对比/}));assert.equal(screen.getByRole('button',{name:'💬 写话术'}).getAttribute('aria-pressed'),'true');
    await user.click(screen.getByRole('button',{name:/工号: 组件测试销售/}));await screen.findByRole('dialog');await user.keyboard('{Escape}');assert.equal(screen.queryByRole('dialog'),null);
    await user.click(screen.getByRole('button',{name:'⚡ 秒配猫'}));const input=screen.getByLabelText('客户需求或猫咪编号');await user.clear(input);await user.type(input,'预算3000元，布偶猫');
    await user.click(screen.getByRole('button',{name:'发送客户需求'}));await screen.findByRole('alert');
    assert.match(screen.getByRole('alert').textContent,/计入1次/);assert.match(screen.getByRole('button',{name:/工号: 组件测试销售/}).textContent,/19/);
  }finally{cleanup();mock.restore();}
});
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

function workspaceFixture(){
  const original=globalThis.fetch;let stockCalls=0,paidCalls=0;
  globalThis.fetch=async(path)=>{
    if(path==='/api/public-cats'){stockCalls++;return Response.json({success:true,data:[{id:'A01',breed:'布偶猫',color:'蓝双',gender:'母',age:'3',price:2600,description:'圆脸亲人'},{id:'B02',breed:'英短',color:'金渐层',gender:'公',age:'4',price:2200,description:'安静圆脸'}]});}
    if(path==='/api/ai/session')return Response.json({success:false},{status:401});
    if(path==='/api/ai/ask'){paidCalls++;throw new Error('Navigation must never call the model');}
    throw new Error('Unexpected workspace request '+path);
  };
  return{stockCalls:()=>stockCalls,paidCalls:()=>paidCalls,restore(){globalThis.fetch=original;}};
}
function menu(label){return within(screen.getByRole('navigation',{name:'销售工作台主导航'})).getByRole('link',{name:new RegExp(label)});}
test('workspace retains catalogue filters and AI draft across client navigation with one shared stock request',async()=>{
  localStorage.clear();window.sessionStorage.clear();const mock=workspaceFixture(),user=userEvent.setup({delay:null});
  try{
    render(<MemoryRouter initialEntries={['/cats/']}><WorkspaceContent/></MemoryRouter>);
    const search=await screen.findByPlaceholderText('编号、品种、花色');await screen.findByText('A01');
    await user.type(search,'A01');await waitFor(()=>assert.match(screen.getByText(/找到 1 只猫咪/).textContent,/1/));
    await user.type(screen.getByLabelText('客户需求或猫咪编号'),'预算3000元，客户喜欢圆脸');
    await user.click(menu('销售支持'));await screen.findByRole('heading',{name:'把每一次接待，做得更从容。'});
    await user.click(menu('猫源库'));assert.equal(screen.getByPlaceholderText('编号、品种、花色').value,'A01');assert.equal(screen.getByLabelText('客户需求或猫咪编号').value,'预算3000元，客户喜欢圆脸');
    await user.click(screen.getByRole('button',{name:'写话术',exact:true}));
    await waitFor(()=>assert.match(screen.getByLabelText('客户需求或猫咪编号').value,/#A01/));
    assert.equal(screen.getByRole('button',{name:'💬 写话术'}).getAttribute('aria-pressed'),'true');
    await user.click(screen.getByRole('button',{name:'恢复上一份草稿'}));assert.equal(screen.getByLabelText('客户需求或猫咪编号').value,'预算3000元，客户喜欢圆脸');
    assert.equal(mock.stockCalls(),1);assert.equal(mock.paidCalls(),0);
  }finally{cleanup();mock.restore();}
});
test('workspace builds a two-cat comparison without spending AI quota during navigation',async()=>{
  localStorage.clear();const mock=workspaceFixture(),user=userEvent.setup({delay:null});try{
    render(<MemoryRouter initialEntries={['/cats/']}><WorkspaceContent/></MemoryRouter>);
    await screen.findByText('B02');const buttons=screen.getAllByRole('button',{name:'加入对比'});await user.click(buttons[0]);
    assert.equal(screen.getByRole('button',{name:'对比并写话术'}).disabled,true);
    await user.click(buttons[1]);await user.click(screen.getByRole('button',{name:'对比并写话术'}));
    await waitFor(()=>assert.match(screen.getByLabelText('客户需求或猫咪编号').value,/#A01.*#B02/));assert.equal(mock.paidCalls(),0);assert.equal(mock.stockCalls(),1);
  }finally{cleanup();mock.restore();}
});
test('embedded handbooks and practice preserve interactions and progress without replacing the common navigation',async()=>{
  localStorage.clear();const mock=workspaceFixture(),user=userEvent.setup({delay:null});try{
    render(<MemoryRouter initialEntries={['/manuals/']}><WorkspaceContent/></MemoryRouter>);
    await user.click(await screen.findByRole('link',{name:/基础与成交手册/}));
    await screen.findByRole('heading',{name:'线上卖猫教程'});await screen.findByRole('button',{name:'🌙 深色模式'});
    await user.click(screen.getByRole('button',{name:'🌙 深色模式'}));assert.equal(screen.getByRole('button',{name:'☀️ 浅色模式'}).getAttribute('aria-pressed'),'true');
    await user.click(menu('新手带练'));await user.click(await screen.findByRole('button',{name:'开始我的第一次带练'}));
    await screen.findByRole('heading',{name:/第 1 步：看一条示范/});
    await user.click(menu('销售支持'));await screen.findByRole('heading',{name:'把每一次接待，做得更从容。'});
    await user.click(menu('新手带练'));await screen.findByRole('heading',{name:/第 1 步：看一条示范/});
    assert.equal(screen.getAllByRole('navigation',{name:'销售工作台主导航'}).length,1);assert.equal(mock.paidCalls(),0);
  }finally{cleanup();mock.restore();}
});
