import test from 'node:test';import assert from 'node:assert/strict';
import {displayText,shortIdMap} from '../src/workspace/presentation.js';
import {compressedCats,modelMessages,selectCandidates,validateOutput,validatePrompt} from '../cloud-functions/_lib/sales-engine.js';
const cats=[{id:'CAT-2026-000017',breed:'布偶猫',gender:'母',price:2600,description:'甜美温顺亲人'},{id:'CAT-2026-000018',breed:'英短',gender:'公',price:1800,description:'圆脸安静'}];
test('short labels stay unique and screenshot text redacts old replies without corrupting identifiers',()=>{
 assert.equal(shortIdMap(cats).get(cats[0].id),'#017');
 const collision=[...cats,{...cats[0],id:'CAT-2025-000017'}];assert.equal(new Set(shortIdMap(collision).values()).size,3);
 const result=displayText('#CAT-2026-000017 2600元；底价¥1,800；两千六百元',cats,true);assert.match(result,/#017/);assert.doesNotMatch(result,/2600|1,800|两千六百/);
 assert.match(displayText('#CAT-2026-000600',[{id:'CAT-2026-000600',price:600}],true),/#600/);
});
test('matching accepts the three compact scenes, while never inventing gentle personality facts',()=>{
 assert.equal(validatePrompt('猫'.repeat(200)).length,200);assert.equal(validatePrompt('猫'.repeat(250)).length,200);
 assert.deepEqual(selectCandidates(cats,'客户是第一次养猫的新手，预算3000元左右，推荐两只性格温顺好养的猫','match').cats.map(c=>c.id),[cats[1].id,cats[0].id]);
 assert.equal(selectCandidates(cats,'客户想找性价比高、品相甜美的捡漏小猫，请从库里挑2只最好卖的','match').cats[0].id,cats[0].id);
 assert.equal(selectCandidates([{...cats[0],description:''}],'新手预算3000元，找性格温顺的猫','match').cats.length,0);
});
test('screenshot model requests omit base prices and reject a returned currency quote',()=>{
 const messages=modelMessages(cats,'客户想看猫','script',{hidePrices:true});assert.doesNotMatch(messages[1].content,/2600|1800/);assert.match(messages[0].content,/不得输出任何价格/);
 assert.doesNotMatch(compressedCats(cats,{hidePrices:true}),/2600|1800/);
 const response={choices:[{finish_reason:'stop',message:{content:JSON.stringify({matched_ids:['#'+cats[0].id],reply_text:'#'+cats[0].id+' 2600元，亲人'})}}]};assert.throws(()=>validateOutput(response,cats,{hidePrices:true}),/截图模式/);assert.throws(()=>validateOutput(response,cats,{expectedCount:2}),/两只猫/);
});
