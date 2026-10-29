import {test,expect} from '@playwright/test';
import {createHash} from 'node:crypto';

test('desktop compact first screen, activation, shared quota and screenshot redaction',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.setViewportSize({width:1366,height:900});await page.goto('/cats/');
 await expect(page.locator('.workspace-stock-card').first()).toBeVisible();await expect(page.getByRole('navigation',{name:'销售工作台主导航'}).getByRole('link')).toHaveCount(2);await expect(page.locator('#sales-ai-prompt')).toHaveAttribute('maxlength','4000');
 const first=await page.locator('.workspace-stock-card').first().boundingBox();expect(first.y).toBeLessThan(720);
 await page.getByRole('button',{name:'切换销售账号'}).click();await page.getByLabel('销售激活码').fill('A1B2-C3D4-E5F6-0718');await page.getByRole('button',{name:'登录销售账号'}).click();await page.locator('#sales-ai-prompt').fill('客户预算4000元，布偶妹妹，三个月');await page.getByRole('button',{name:'发送客户需求'}).click();await expect(page.locator('.sales-ai-reply')).toContainText('#A01');await expect(page.locator('.workspace-account')).toContainText('19/20');
 await page.getByRole('spinbutton',{name:'对客加价金额'}).fill('0');await page.getByRole('switch',{name:'对客模式'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.locator('.sales-ai-reply')).not.toContainText('2600');await expect(page.getByRole('button',{name:'复制内部选猫记录'})).toHaveCount(0);
});
test('mobile keeps two destinations and the tools drawer, two-line demand entry and direct card options',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/cats/');await expect(page.locator('.workspace-stock-card').first()).toBeVisible();const first=await page.locator('.workspace-stock-card').first().boundingBox();expect(first.y).toBeLessThan(750);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('#sales-ai-prompt')).toHaveAttribute('rows','2');await page.getByRole('button',{name:'做图与设置'}).click();await expect(page.getByRole('button',{name:'一键生成引流拼图 & 文案'})).toBeVisible();await expect(page.getByRole('spinbutton',{name:'对客加价金额'})).toBeVisible();await page.getByRole('button',{name:'做图与设置'}).click();await page.getByRole('article',{name:'#A01 布偶猫'}).getByRole('button',{name:'写话术'}).click();await expect(page.getByRole('button',{name:'夸这只猫骨相甜美'})).toBeVisible();await page.getByRole('button',{name:'客户嫌贵保价逼单'}).click();await expect(page.getByRole('dialog',{name:'猫咪推荐话术'})).toContainText('免费体验仅开放智能找猫功能');await page.getByRole('button',{name:'关闭结果窗口'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('sales navigation preserves the document, expanded filters and top draft',async({page})=>{
 await page.goto('/cats/');await page.getByRole('button',{name:'更多筛选'}).click();await page.getByPlaceholder('短编号、品种、花色').fill('A01');await page.locator('#sales-ai-prompt').fill('预算3000元，客户喜欢圆脸');await page.evaluate(()=>window.__workspaceDocumentMarker='same-document');
 await page.getByRole('navigation',{name:'销售工作台主导航'}).getByRole('link',{name:/销冠手册与售后/}).click();await expect(page.getByRole('heading',{name:'销冠手册与售后'})).toBeVisible();await expect(page.locator('.workspace-tool')).toHaveCount(2);await page.goBack();await expect(page.getByPlaceholder('短编号、品种、花色')).toHaveValue('A01');await expect(page.locator('#sales-ai-prompt')).toHaveValue('预算3000元，客户喜欢圆脸');expect(await page.evaluate(()=>window.__workspaceDocumentMarker)).toBe('same-document');
});

test('admin reuses existing login and manages D1 accounts, audit and emergency stop',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/admin-sales/');
  await page.getByLabel('账号',{exact:true}).fill('qa-admin');
  await page.getByLabel('密码',{exact:true}).fill('sample-admin-password');
  await page.getByRole('button',{name:'登录',exact:true}).click();
  await expect(page.getByRole('heading',{name:'销售授权与 AI 风控'})).toBeVisible();
  await expect(page.getByRole('cell',{name:'测试销售',exact:false})).toBeVisible();
  await page.getByLabel('销售姓名',{exact:true}).fill('UI新增销售');
  await page.getByRole('button',{name:'生成销售激活码'}).click();
  await expect(page.locator('code')).toHaveText(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){3}$/);
  await expect(page.getByRole('cell',{name:'UI新增销售',exact:false})).toBeVisible();
  const existing=page.getByRole('row').filter({has:page.getByRole('cell',{name:'测试销售',exact:false})});
  await existing.getByRole('button',{name:'查看记录'}).click();
  await expect(page.getByRole('dialog',{name:'销售最近聊天记录'})).toBeVisible();
  await expect(page.getByRole('dialog',{name:'销售最近聊天记录'})).toBeVisible();
  await page.getByRole('button',{name:'关闭聊天记录'}).click();
  page.on('dialog',dialog=>dialog.accept());
  await existing.getByRole('button',{name:'重置设备'}).click();
  await expect(existing.getByRole('cell',{name:'0 / 2',exact:true})).toBeVisible();
  await existing.getByRole('button',{name:'封禁',exact:true}).click();
  await expect(existing.getByRole('button',{name:'解封',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'立即暂停 AI'}).click();
  await expect(page.getByText('AI 服务已暂停',{exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/admin.png',fullPage:true});
  expect(errors).toEqual([]);
});

test('Canvas marketing exports real PNGs at both sizes without invoking AI',async({page})=>{
 const stock=Array.from({length:9},(_,i)=>({id:'CAT-2026-'+String(17+i).padStart(6,'0'),breed:['布偶','英短','德文'][i%3],price:600+i*100,image:'/api/public-images/marketing-'+i,description:'在售猫咪',videos:[]}));let aiCalls=0;
 await page.route('**/api/public-cats',route=>route.fulfill({json:{success:true,data:stock}}));await page.route('**/api/ai/session',route=>route.fulfill({json:{success:true,user:{sales_name:'拼图测试',daily_limit:20,remaining:20,retry_after:0}}}));
 await page.route('**/api/public-images/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200"><rect width="800" height="1200" fill="#d6b790"/><circle cx="400" cy="600" r="230" fill="#fff0d8"/></svg>'}));await page.route('**/api/ai/ask',route=>{aiCalls++;return route.fulfill({status:500,json:{success:false}});});
 await page.goto('/cats/');await expect(page.locator('.workspace-onboarding')).toHaveCount(0);await page.getByRole('button',{name:/一键生成引流拼图 & 文案/}).click();const studio=page.getByRole('dialog',{name:'营销拼图与文案'});await expect(studio.getByRole('button',{name:'下载高清PNG'})).toBeEnabled();
 await studio.getByText('更多出图选项与说明').click();await studio.getByRole('checkbox',{name:'下载时重新微调构图（稍慢）'}).check();
 let lastHash='';for(const height of [1080,1440,1440]){await studio.getByLabel('导出尺寸').selectOption(String(height));await expect(studio.getByRole('button',{name:'下载高清PNG'})).toBeEnabled();const downloaded=page.waitForEvent('download');await studio.getByRole('button',{name:'下载高清PNG'}).click();const download=await downloaded,stream=await download.createReadStream(),chunks=[];for await(const chunk of stream)chunks.push(chunk);const png=Buffer.concat(chunks);expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(height);const hash=createHash('sha256').update(png).digest('hex');expect(hash).not.toBe(lastHash);lastHash=hash;}
 await studio.getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}).check();await studio.getByLabel('猫舍 / 店铺名').fill('杭州猫舍');await expect(studio.getByRole('button',{name:'下载高清PNG'})).toBeEnabled();expect(aiCalls).toBe(0);
});


test('marketing text selection, backdrop clicks and Escape preserve work; only the X closes',async({page})=>{
 await page.route('**/api/public-cats',route=>route.fulfill({json:{success:true,data:Array.from({length:3},(_,i)=>({id:'M'+i,breed:'布偶',price:600+i*100,image:'/api/public-images/test'}))}}));await page.route('**/api/public-images/test*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#d8c2a5"/></svg>'}));await page.goto('/cats/');await page.getByRole('button',{name:/一键生成引流拼图 & 文案/}).click();const studio=page.getByRole('dialog',{name:'营销拼图与文案'});await studio.getByText(/改猫咪或改店名后/).dblclick();const box=await studio.boundingBox();await page.mouse.move(box.x+30,box.y+70);await page.mouse.down();await page.mouse.move(2,2);await page.mouse.up();await page.mouse.click(2,2);await page.keyboard.press('Escape');await expect(studio).toBeVisible();await expect(studio.getByRole('button',{name:/随机换排版/})).toBeVisible();await expect(studio.getByRole('button',{name:'打乱顺序'})).toBeVisible();await studio.getByRole('button',{name:'关闭结果窗口'}).click();await expect(studio).toHaveCount(0);
});


test('studio keeps preview visible while only controls scroll, and folds banner fields',async({page})=>{
 await page.route('**/api/public-cats',route=>route.fulfill({json:{success:true,data:Array.from({length:9},(_,i)=>({id:'LAYOUT'+i,breed:'布偶',price:800,image:'/api/public-images/layout'+i}))}}));await page.route('**/api/public-images/*',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#d8c2a5"/></svg>'}));await page.goto('/cats/');await page.getByRole('button',{name:'一键生成引流拼图 & 文案'}).click();const studio=page.getByRole('dialog',{name:'营销拼图与文案'}),preview=studio.getByRole('region',{name:'海报预览与下载'}),controls=studio.getByRole('region',{name:'海报设置与文案'});await expect(studio.getByRole('button',{name:'下载高清PNG'})).toBeEnabled();await expect(studio.getByRole('textbox',{name:'所在城市'})).toHaveCount(0);await studio.getByRole('checkbox',{name:'叠加猫舍招牌贴纸'}).check();await expect(studio.getByRole('textbox',{name:'所在城市'})).toBeVisible();const before=await preview.boundingBox();await controls.evaluate(el=>el.scrollTop=el.scrollHeight);const after=await preview.boundingBox();expect(Math.abs(before.y-after.y)).toBeLessThan(2);await expect(preview.getByRole('button',{name:'下载高清PNG'})).toBeInViewport();await expect(studio.getByRole('button',{name:'复制文案'})).toBeVisible();
});

test('artwork request remains in the finder conversation and never automatically opens tools',async({page})=>{
 let calls=0;await page.route('**/api/ai/ask',async route=>{
  const body=route.request().postDataJSON();expect(body.action).toBe('cat_only');calls++;
  await route.fulfill({json:{success:true,user:{id:1,is_guest:true,remaining:15,daily_limit:15},data:{kind:'cat_only',used_ai:false,matched_ids:[],reply_text:'智能找猫只负责找猫；图片请使用旁边的手动工具。'}}});
 });
 await page.goto('/cats/');await page.getByLabel('客户选猫需求').fill('帮我生成图片和朋友圈文案');await page.getByRole('button',{name:'发送客户需求'}).click();
 await expect(page.getByRole('dialog',{name:'智能找猫 · 对话'})).toContainText('手动工具');await expect(page.getByRole('dialog',{name:'营销拼图与文案'})).toHaveCount(0);expect(calls).toBe(1);
});


test('mobile exposes breed, budget and gender while extra age and keyword fields fold',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/cats/');const filters=page.getByRole('region',{name:'猫源筛选'});
 await expect(filters.getByRole('combobox',{name:'品种',exact:true})).toBeVisible();await expect(filters.getByRole('combobox',{name:'性别',exact:true})).toBeVisible();await expect(filters.getByRole('spinbutton',{name:'最高价格'})).toBeVisible();
 await expect(filters.getByRole('spinbutton',{name:'最大月龄'})).toBeHidden();await expect(filters.getByRole('textbox',{name:'编号或关键词'})).toBeHidden();
 await filters.getByRole('button',{name:'更多筛选',exact:true}).click();await expect(filters.getByRole('spinbutton',{name:'最大月龄'})).toBeVisible();await expect(filters.getByRole('textbox',{name:'编号或关键词'})).toBeVisible();
 await expect(page.getByRole('button',{name:'发送客户需求'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
