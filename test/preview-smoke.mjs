import assert from 'node:assert/strict';
import {JSDOM,VirtualConsole} from 'jsdom';
import {readFileSync} from 'node:fs';
const errors=[];const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
const html=readFileSync(new URL('../../sales-workspace-clear-preview.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'https://offline-preview.example/review.html',runScripts:'dangerously',virtualConsole:console,pretendToBeVisual:true,beforeParse(window){
  Object.assign(window,{TextEncoder,TextDecoder,Response,Request,Headers});
  window.scrollTo=()=>{};window.HTMLElement.prototype.scrollIntoView=function(){};
  window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
}});
async function until(fn){const deadline=Date.now()+20000;while(!fn()){if(Date.now()>deadline)throw new Error('Preview did not reach expected state: '+dom.window.document.body.textContent.slice(-500));await new Promise(resolve=>setTimeout(resolve,30));}}
try{
 const doc=dom.window.document;
 await until(()=>doc.body.textContent.includes('DEMO01')&&doc.body.textContent.includes('演示销售'));
 assert.equal(doc.querySelectorAll('.workspace-sidebar nav a').length,4);
 [...doc.querySelectorAll('.sales-ai-quick button')].find(x=>x.textContent.includes('查合作与售后')).click();
 await until(()=>doc.querySelector('#sales-ai-prompt').value.includes('合作')&&!doc.querySelector('.sales-ai-send').disabled);
 doc.querySelector('.sales-ai-send').click();
 await until(()=>doc.querySelector('.sales-ai-sources a'));
 assert.match(doc.querySelector('.sales-ai-reply').textContent,/售后|兼职/);
 assert.match(doc.querySelector('.sales-ai-account').textContent,/剩余: 20/);
 doc.querySelector('.workspace-sidebar a[href="/manuals/"]').click();
 await until(()=>[...doc.querySelectorAll('.workspace-pane:not([hidden]) h1')].some(el=>el.textContent.includes('每一次接待')));
 doc.querySelector('.workspace-tool[href="/guide/"]').click();
 await until(()=>doc.querySelector('.workspace-basics #theme-toggle'));
 assert.ok(doc.querySelector('.workspace-basics #theme-toggle').textContent.includes('模式'));
 doc.querySelector('.workspace-sidebar a[href="/training/"]').click();
 await until(()=>doc.querySelector('.workspace-training [data-action="start"]'));
 doc.querySelector('.workspace-training [data-action="start"]').click();
 await until(()=>doc.querySelector('.workspace-training #panel').textContent.includes('看一条示范'));
 assert.deepEqual(errors,[]);
 process.stdout.write('PASS: standalone HTML mounts its real bundled UI, loads sample stock, and switches through support, handbook and interactive practice without external APIs\n');
}finally{dom.window.close();}
