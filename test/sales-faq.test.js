import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {JSDOM} from 'jsdom';import {salesFaqs} from '../src/workspace/sales-faq-data.js';
test('FAQ answers and customer copy are sourced verbatim from the actual manual',()=>{
 const dom=new JSDOM(readFileSync(new URL('../src/learning/basics.html',import.meta.url),'utf8'));const replies=[...dom.window.document.querySelectorAll('#tools details')];
 for(const [i,node] of replies.entries()){const faq=salesFaqs.find(x=>x.id==='reply-'+i),copy=node.querySelector('.script').cloneNode(true);copy.querySelectorAll('button').forEach(x=>x.remove());const expected=copy.textContent.replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim();assert.equal(faq.question,node.querySelector('summary').textContent.trim());assert.equal(faq.answer,expected);assert.equal(faq.reply_text,expected);}
 assert.equal(new Set(salesFaqs.map(x=>x.id)).size,salesFaqs.length);assert.deepEqual(new Set(salesFaqs.map(x=>x.category)),new Set(['pricing','shipping','aftersale']));dom.window.close();
});
test('internal settlement examples are not included in the customer-facing clipboard text',()=>{
 const faq=salesFaqs.find(x=>x.id==='earnings');assert.match(faq.answer,/1000/);assert.doesNotMatch(faq.reply_text,/1000|1100|1150|10%|15%/);assert.ok(faq.copy_note);assert.equal(faq.reply_text,salesFaqs.find(x=>x.id==='reply-7').reply_text);
});
