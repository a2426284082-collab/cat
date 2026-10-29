// Professional copywriting specialist: facts are provided by selected cats,
// never by an invented model-selected ID. The generator itself stays existing.
import {marketingOptions} from './sales-engine.js';
import {quoteBatch} from './specialist-quote.js';
export function copyBrief({cats,settings={},quotes={},hidePrices=false}={}){
 if(!Array.isArray(cats)||cats.length<1||cats.length>9)throw new Error('话术缺少选猫依据');
 const ids=cats.map(c=>String(c.id).toUpperCase());
 if(new Set(ids).size!==ids.length)throw new Error('话术使用了重复猫咪');
 const priceRows=quoteBatch(cats,{markup:settings.markup??0,overrides:quotes});
 const prices=priceRows.map(p=>p.customerPrice);
 const template=hidePrices||settings.includePrices===false?'sign':'price';
 const marketing=marketingOptions({marketing:{template,platform:settings.platform||'xhs',city:settings.city||'',shop:settings.shop||'同城靠谱猫舍',prices}},cats);
 return {specialist:'copy',cat_ids:ids,marketing,hidePrices:template==='sign'};
}
export function verifyCopyResult(result,brief){
 if(!brief||brief.specialist!=='copy'||!result||typeof result.reply_text!=='string'||!result.reply_text.trim())throw new Error('文案工具没有返回有效内容');
 const ids=new Set(brief.cat_ids);
 // A marketing model may highlight only some selected cats, but may never
 // inject a new unrelated cat ID into a recommendation.
 for(const id of result.matched_ids||[]){
  const v=String(id).replace(/^#+/,'').toUpperCase();if(!ids.has(v))throw new Error('文案引用了未经选择的猫咪编号');
 }
 return {specialist:'copy',verified:true,cat_ids:[...brief.cat_ids]};
}
