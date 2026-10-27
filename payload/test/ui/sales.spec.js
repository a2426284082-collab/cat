import { test, expect } from '@playwright/test';

test('desktop activation, generation, cooldown, copy and stock details',async({page,context})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await page.goto('/cats/');
  await expect(page.getByRole('heading',{name:/把客户需求变成/})).toBeVisible();
  await expect(page.getByRole('button',{name:'工号: 未激活 / 剩余: -- 次'})).toBeVisible();
  await page.getByRole('button',{name:'预算+品种挑猫'}).click();
  await expect(page.locator('#sales-ai-prompt')).toHaveAttribute('maxlength','200');
  await expect(page.locator('#sales-ai-prompt')).toHaveValue(/客户预算/);
  await page.locator('#sales-ai-prompt').fill('客户预算3000元，布偶妹妹，三个月');
  await page.getByRole('button',{name:'发送客户需求'}).click();
  await expect(page.getByRole('dialog',{name:'请输入内部销售激活码'})).toBeVisible();
  await page.locator('#sales-activation-code').fill('WRONG');
  await page.getByRole('button',{name:'激活并继续'}).click();
  await expect(page.getByRole('alert')).toContainText('激活码无效');
  await page.locator('#sales-activation-code').fill('A1B2-C3D4-E5F6-0718');
  await page.getByRole('button',{name:'激活并继续'}).click();
  await expect(page.locator('.sales-ai-reply')).toContainText('#A01');
  await expect(page.locator('.sales-ai-account')).toContainText('剩余: 19 次');
  await expect(page.locator('.sales-ai-send')).toBeDisabled();
  await page.getByRole('button',{name:'一键复制微信话术'}).click();
  await expect(page.getByRole('button',{name:'已复制',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('#A01');
  const stored=await page.evaluate(()=>({...localStorage}));
  expect(Object.keys(stored)).toContain('sales-device-id');expect(JSON.stringify(stored)).not.toContain('A1B2');
  const cookies=await context.cookies();const salesCookie=cookies.find(c=>c.name==='cat_sales_session');
  expect(salesCookie.httpOnly).toBe(true);expect(salesCookie.secure).toBe(true);
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
  await page.locator('.sales-ai-cat').click();await expect(page.getByRole('dialog',{name:'猫咪销售资料'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile composer, template mode switch and modal fit the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/cats/');
  await page.getByRole('button',{name:'两只猫对比',exact:false}).click();
  await expect(page.getByRole('button',{name:'💬 写话术',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#sales-ai-prompt')).toHaveValue(/两只猫/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
  await page.locator('#sales-ai-prompt').fill('编号 #A01，客户喜欢圆脸');
  await page.getByRole('button',{name:'发送客户需求'}).click();
  await expect(page.getByRole('dialog',{name:'请输入内部销售激活码'})).toBeVisible();
  await expect(page.locator('#sales-activation-code')).toBeFocused();
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
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
  await expect(page.getByText('生成成功 · 计入1次')).toBeVisible();
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


test('sales navigation retains the document, filter, draft and browser back history',async({page})=>{
  await page.goto('/cats/');
  await expect(page.getByPlaceholder('编号、品种、花色')).toBeVisible();
  await page.getByPlaceholder('编号、品种、花色').fill('A01');
  await page.locator('#sales-ai-prompt').fill('预算3000元，客户喜欢圆脸');
  await page.evaluate(()=>{window.__workspaceDocumentMarker='same-document';});
  const nav=page.getByRole('navigation',{name:'销售工作台主导航'});
  await nav.getByRole('link',{name:/销售支持/}).click();
  await expect(page).toHaveURL(/\/manuals\/$/);
  await expect(page.getByRole('heading',{name:'把每一次接待，做得更从容。'})).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/cats\/$/);
  await expect(page.getByPlaceholder('编号、品种、花色')).toHaveValue('A01');
  await expect(page.locator('#sales-ai-prompt')).toHaveValue('预算3000元，客户喜欢圆脸');
  expect(await page.evaluate(()=>window.__workspaceDocumentMarker)).toBe('same-document');
  await page.getByRole('button',{name:'写话术',exact:true}).click();
  await expect(page).toHaveURL(/\/assistant\/$/);
  await expect(page.locator('#sales-ai-prompt')).toHaveValue(/#A01/);
  await page.getByRole('button',{name:'恢复上一份草稿'}).click();
  await expect(page.locator('#sales-ai-prompt')).toHaveValue('预算3000元，客户喜欢圆脸');
});
