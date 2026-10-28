import {test,expect} from '@playwright/test';

test('desktop compact first screen, activation, shared quota and screenshot redaction',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await page.setViewportSize({width:1366,height:900});await page.goto('/cats/');
 await expect(page.locator('.workspace-stock-card').first()).toBeVisible();await expect(page.getByRole('navigation',{name:'销售工作台主导航'}).getByRole('link')).toHaveCount(3);await expect(page.locator('#sales-ai-prompt')).toHaveAttribute('maxlength','60');
 const first=await page.locator('.workspace-stock-card').first().boundingBox();expect(first.y).toBeLessThan(720);
 await page.locator('#sales-ai-prompt').fill('客户预算3000元，布偶妹妹，三个月');await page.getByRole('button',{name:'发送客户需求'}).click();await page.getByLabel('销售激活码').fill('A1B2-C3D4-E5F6-0718');await page.getByRole('button',{name:'激活并继续'}).click();await expect(page.locator('.sales-ai-reply')).toContainText('#A01');await expect(page.locator('.workspace-account')).toContainText('19/20');
 await page.getByRole('button',{name:'隐藏底价(截图模式)'}).click();await expect(page.locator('.sales-ai-reply')).not.toContainText('2600');await page.getByRole('button',{name:'一键复制微信话术'}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).not.toContain('2600');
});
test('mobile keeps three clear destinations, two-line demand entry and direct card options',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/cats/');await expect(page.locator('.workspace-stock-card').first()).toBeVisible();const first=await page.locator('.workspace-stock-card').first().boundingBox();expect(first.y).toBeLessThan(750);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator('#sales-ai-prompt')).toHaveAttribute('rows','2');await page.locator('.workspace-stock-card').first().getByRole('button',{name:'写话术'}).click();await expect(page.getByRole('button',{name:'夸这只猫骨相甜美'})).toBeVisible();await page.getByRole('button',{name:'客户嫌贵保价逼单'}).click();await expect(page.getByRole('dialog',{name:'请输入内部销售激活码'})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('sales navigation preserves the document, expanded filters and top draft',async({page})=>{
 await page.goto('/cats/');await page.getByRole('button',{name:'筛选条件'}).click();await page.getByPlaceholder('短编号、品种、花色').fill('A01');await page.locator('#sales-ai-prompt').fill('预算3000元，客户喜欢圆脸');await page.evaluate(()=>window.__workspaceDocumentMarker='same-document');
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