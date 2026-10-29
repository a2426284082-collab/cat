// Professional inventory specialist. Owns customer constraints, never artwork style.
import {resolveSalesDemand,evaluateSalesCandidates,verifySalesSelection,validateSalesDemand} from './sales-demand.js';

const designAction=/(?:做|作|生成|制作|设计|排版|绘制|输出|修改|调整|更新|重做|来张|来一张|搞张|做成).{0,12}(?:拼图|海报|宣传图|朋友圈图|图片|长图|封面)|(?:拼图|海报|宣传图|朋友圈图).{0,8}(?:无框|黑框|边框|价格|价签|背景)/;
const contentAction=/(?:写|生成|拟|编辑|修改|更新).{0,12}(?:话术|文案|推荐语|朋友圈文案|介绍词)|(?:话术|文案).{0,8}(?:生成|修改|更新)/;
const designTerms=/(?:无黑框|不带黑框|不要黑框|不显示黑框|黑色边框|白色背景|无边框|无框|不要黑边|隐藏价签|不显示价格|去水印|图片不带价格|海报不带价格|拼图不带价格)/g;
const clauses=text=>text.split(/(?=[。；;\n]|然后|接着|随后|顺便|最后|再帮我|再给我)/).map(s=>s.trim()).filter(Boolean);
export function inventoryOnlyText(goal){
 const text=String(goal||'').normalize('NFKC');
 const pieces=clauses(text);
 const inventory=[];
 for(const clause of pieces){
  // A clause exclusively describing design or copy must never be parsed as a
  // breed, coat color, age or customer-price restriction.
  const containsInventory=/(?:[猫咪]|布偶|英短|美短|缅因|品种|月龄|性别|母猫|公猫|预算|价位|元以内|售价在|价格在|毛色|花色|只换|替换)/.test(clause);
  if((designAction.test(clause)||contentAction.test(clause))&&!containsInventory)continue;
  inventory.push(clause.replace(designTerms,' '));
 }
 return (inventory.join(' ')||text.replace(designTerms,' ')).trim();
}
export function inventoryBrief({goal,modelDemand=null,catalog=[]}={}){
 const evidence=inventoryOnlyText(goal);
 const demand=resolveSalesDemand(evidence,modelDemand,catalog);
 return Object.freeze({specialist:'inventory',source:evidence,demand:validateSalesDemand(demand)});
}
export function selectInventory({brief,catalog,markup=0,requireImage=false,count=undefined}){
 if(!brief||brief.specialist!=='inventory')throw new Error('选猫模块收到错误的任务协议');
 const evaluated=evaluateSalesCandidates(catalog,brief.demand,{markup,requireImage});
 const amount=brief.demand.quantity.exact?brief.demand.quantity.count:count??brief.demand.quantity.count;
 if(!Number.isInteger(amount)||amount<1||amount>9)throw new Error('选猫数量不合法');
 const cats=evaluated.cats.slice(0,amount);
 verifySalesSelection(cats,catalog,brief.demand,{markup,requireImage});
 return {...evaluated,cats,requested:amount,complete:cats.length===amount,
  receipt:{specialist:'inventory',verified:true,requested:amount,selected:cats.length,matched_ids:cats.map(c=>String(c.id).toUpperCase())}};
}
