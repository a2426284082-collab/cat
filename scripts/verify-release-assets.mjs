import {readFileSync,existsSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve('dist');
const entries=['index.html','cats/index.html','forward/index.html','p/index.html','admin/index.html','admin-sales/index.html','assistant/index.html','training/index.html','manuals/index.html','guide/index.html','guide-sales/index.html'];
let references=0;
for(const file of entries){
  const html=readFileSync(resolve(root,file),'utf8');
  assert.doesNotMatch(html,/AI营销出图实验室|marketing-lab/);
  for(const match of html.matchAll(/(?:src|href)=["'](\/[^"'#?]+)(?:[?#][^"']*)?["']/g)){
    // Navigation destinations are checked through the explicit entry list.
    if(!/\.(?:js|css|svg|png|jpg|jpeg|webp|ico)$/i.test(match[1]))continue;
    const target=resolve(root,'.'+decodeURIComponent(match[1]));
    assert.ok(target.startsWith(root+'/')&&existsSync(target),`${file}: missing asset ${match[1]}`);references++;
  }
}
for(const file of readdirSync(resolve(root,'assets')).filter(f=>f.endsWith('.js'))){
  assert.doesNotMatch(readFileSync(resolve(root,'assets',file),'utf8'),/AI营销出图实验室|\/api\/marketing-lab/);
}
console.log(`PASS: ${entries.length} production HTML entries, ${references} local asset references, removed lab absent from production bundles`);
