// The planner supplies typed demand; inventory selection is deterministic.
// Very cheap stock is real stock. No undocumented minimum price exclusion.
import {inferSalesDemand,resolveSalesDemand,evaluateSalesCandidates,verifySalesSelection,parseAgeMonths} from './sales-demand.js';
export {inferSalesDemand,resolveSalesDemand,evaluateSalesCandidates,verifySalesSelection} from './sales-demand.js';
export const requiresPriceReview=cat=>cat?.price==null||!Number.isFinite(Number(cat.price))||Number(cat.price)<0;
export function filterSalesCats(cats,need='',options={}){
 const demand=options.demand||inferSalesDemand(need,cats);
 return evaluateSalesCandidates(cats,demand,{markup:options.markup??0,requireImage:options.requireImage??false}).cats;
}
export function chooseSalesCats(cats,need='',count=2,{requireImage=false,markup=0,demand=null}={}){
 const selected=evaluateSalesCandidates(cats,demand||inferSalesDemand(need,cats),{requireImage,markup}).cats;
 return selected.slice(0,Math.max(1,Math.min(9,Number(count)||2)));
}
export function selectionSummary(cats,count,need,{hidePrices=false,markup=0,demand=null}={}){
 const d=demand||inferSalesDemand(need,cats);
 const ageLabel=value=>{const months=parseAgeMonths(value);if(months===null)return '月龄待确认';return /(?:个月){2,}/.test(String(value))?`${months}个月（源数据写法异常，请核对）`:`${months}个月`;};
 const prices=cats.map(c=>{
  const floor=c.price==null?null:Number(c.price);
  const customer=floor===null||!Number.isFinite(floor)?null:floor+Number(markup??0);
  const pricing=hidePrices?'对客价格已隐藏':customer===null?'价格待核对':
    `内部合作底价¥${floor} · 按当前加价参考客户价¥${customer}（成交前核实）`;
  return `#${String(c.id).replace(/^#+/,'').trim().toUpperCase()} · ${c.breed||'品种待确认'} · ${c.gender||'性别待确认'} · ${ageLabel(c.age)} · ${pricing}`;
 }).join('\n');
 const header=cats.length<count?`只找到${cats.length}/${count}只符合条件的猫，未放宽客户要求。`:`从在售库推荐${cats.length}只符合条件的猫。`;
 return `${header}\n${prices}${prices?'\n成交前请再次核实库存、对客加价和最终售价。':''}`;
}
