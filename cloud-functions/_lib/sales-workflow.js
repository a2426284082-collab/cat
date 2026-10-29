// Pure, bounded stock selection shared by the workflow planner and the poster UI.
// Hard filters never silently turn into suggestions when a cat has missing facts.
import {parseDemandLocally} from './smart-search.js';
// Kept browser-safe: do not import sales-engine (which requires server-only node:crypto).
const normalizeId=value=>String(value||'').trim().replace(/^#+\s*/,'').toUpperCase();

const containsNegative=(text,term)=>{
 const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(`(?:不要|不想要|排除|别要|不考虑|避开|不选)[^，。；,;]{0,8}${escaped}`).test(text);
};
export function filterSalesCats(cats,need=''){
 const text=String(need).normalize('NFKC').slice(0,200);
 const breeds=[...new Set(cats.map(c=>c.breed).filter(Boolean))],colors=[...new Set(cats.map(c=>c.color).filter(Boolean))];
 const f=parseDemandLocally(text,{breeds,colors}).filters;
 const excludedBreeds=breeds.filter(v=>containsNegative(text,v)||containsNegative(text,v.replace(/猫$/,'')));
 const excludedColors=colors.filter(v=>containsNegative(text,v));
 const negativeGender=/(?:不要|别要|不考虑|避开|不选).{0,4}(?:母猫|妹妹|女孩)/.test(text)?'母':/(?:不要|别要|不考虑|避开|不选).{0,4}(?:公猫|弟弟|男孩)/.test(text)?'公':'';
 const explicitIds=[...text.matchAll(/#\s*([a-z0-9][a-z0-9_-]{0,39})/gi)].map(m=>normalizeId(m[1]));
 return cats.filter(c=>{
  if(c.status&&c.status!=='在售')return false;
  if(explicitIds.length&&!explicitIds.includes(normalizeId(c.id)))return false;
  if(excludedBreeds.includes(c.breed)||excludedColors.includes(c.color)||(negativeGender&&negativeGender===c.gender))return false;
  if(f.breed&&c.breed!==f.breed||f.color&&c.color!==f.color||f.gender&&c.gender!==f.gender)return false;
  if(f.max&&(c.price==null||!Number.isFinite(Number(c.price))||Number(c.price)>Number(f.max)))return false;
  if(f.min&&(c.price==null||!Number.isFinite(Number(c.price))||Number(c.price)<Number(f.min)))return false;
  const age=Number.parseFloat(c.age);
  if((f.minAge||f.maxAge)&&(!Number.isFinite(age)||f.minAge&&age<Number(f.minAge)||f.maxAge&&age>Number(f.maxAge)))return false;
  return true;
 });
}
export function chooseSalesCats(cats,need,count=2,{requireImage=false}={}){
 const limit=Math.max(1,Math.min(9,Number(count)||2));
 return filterSalesCats(cats,need).filter(c=>!requireImage||!!c.image)
  .sort((a,b)=>(a.price==null?Infinity:Number(a.price))-(b.price==null?Infinity:Number(b.price))||normalizeId(a.id).localeCompare(normalizeId(b.id)))
  .slice(0,limit);
}
export function selectionSummary(cats,count,need,{hidePrices=false,markup=800}={}){
 const ageLabel=value=>{
  const v=String(value??'').trim();
  if(!v||/待确认|未知/.test(v))return '月龄待确认';
  if(/^\d+(?:\.\d+)?$/.test(v))return `${v}个月`;
  if(/个月个月/.test(v))return `${v.replace(/(?:个月){2,}/g,'个月')}（源数据写法异常，请核对）`;
  if(/岁.*个月/.test(v))return `${v}（请核对源数据的月龄单位）`;
  return v;
 };
 const list=cats.map(c=>{
  const floor=c.price==null?null:Number(c.price);
  const quoted=Number.isFinite(floor)&&Number.isFinite(Number(markup))?floor+Number(markup):null;
  const pricing=hidePrices?'售价不显示（对客报价待核对）':quoted==null?'价格待核对':
   `内部合作底价¥${floor} · 按当前加价参考客户价¥${quoted}（成交前核实）${floor<200?' · 价格明显偏低，请核对库存录入':''}`;
  return `#${normalizeId(c.id)} · ${c.breed||'品种待确认'} · ${c.gender||'性别待确认'} · ${ageLabel(c.age)} · ${pricing}`;
 }).join('\n');
 return `${cats.length<count?`只找到${cats.length}/${count}只符合条件的猫，未放宽客户要求。`:`已从在售库找到${cats.length}只符合条件的猫。`}\n${list}${list?'\n成交前请再次核实库存。':''}`;
}
