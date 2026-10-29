// Read-only administrator inspection of the EXACT predicates used by inventory
// selection. Does not call DeepSeek, modify records or consume sales quota.
import {inferSalesDemand,resolveSalesDemand,inspectSalesCandidate,evaluateSalesCandidates,parseAgeMonths} from './sales-demand.js';
import {normalizeId} from './sales-engine.js';

const CHECKS={
 active:'当前在售',breed:'指定品种',excludedBreed:'排除品种',color:'指定毛色',
 excludedColor:'排除毛色',gender:'性别硬条件',age:'月龄范围',photo:'照片条件',
 priceValid:'价格可计算',priceRange:'预算或价格区间',
};
const validId=x=>typeof x==='string'&&/^[#a-z0-9_-]{1,42}$/i.test(x.trim());
function resolveId(value,catalog){
 const normalized=normalizeId(value),exact=catalog.filter(c=>normalizeId(c.id)===normalized);
 if(exact.length===1)return exact[0];
 // #099 is a UI short id. Permit it only when its suffix is unambiguous.
 if(/^\d{1,3}$/.test(normalized)){
  const suffix=normalized.padStart(3,'0');
  const short=catalog.filter(c=>/\d{3}$/.test(normalizeId(c.id))&&normalizeId(c.id).slice(-3)===suffix);
  if(short.length===1)return short[0];
  if(short.length>1)return {ambiguous:true,short:normalized,matches:short.map(c=>c.id).slice(0,5)};
 }
 return null;
}
function view(cat,demand,options){
 const assessed=inspectSalesCandidate(cat,demand,options);
 return {id:cat.id,breed:cat.breed,gender:cat.gender,ageRaw:cat.age,ageMonths:assessed.ageMonths,
  basePrice:cat.price,referencePrice:assessed.price,hasPhoto:!!cat.image,status:cat.status||'在售',
  eligible:assessed.eligible,
  checks:Object.fromEntries(Object.entries(assessed.checks).map(([key,passed])=>[key,{label:CHECKS[key],passed}])),
  failures:Object.keys(assessed.checks).filter(key=>!assessed.checks[key]).map(key=>CHECKS[key]),
 };
}
export function diagnoseSalesInventory(catalog,goal,{markup=0,ids=[],savedDemand=null,requireImage=true}={}){
 if(typeof goal!=='string'||goal.trim().length<2||goal.length>1200)throw new Error('诊断指令需要2至1200字');
 if(!Number.isFinite(markup)||markup<0||markup>100000)throw new Error('加价参数无效');
 if(!Array.isArray(ids)||ids.length>12||ids.some(x=>!validId(x)))throw new Error('猫咪编号格式无效（最多12只）');
 const inferred=inferSalesDemand(goal,catalog);
 const effective=resolveSalesDemand(goal,savedDemand,catalog);
 const options={markup,requireImage};
 const actual=evaluateSalesCandidates(catalog,effective,options);
 const counts=Object.fromEntries(Object.keys(CHECKS).map(k=>[k,{label:CHECKS[k],pass:0,fail:0}]));
 const sample=[];let unknownAge=0;
 for(const cat of catalog){
  const result=view(cat,effective,options);
  if(result.checks.active.passed){
   for(const [key,record] of Object.entries(result.checks))counts[key][record.passed?'pass':'fail']++;
   if(result.ageMonths===null)unknownAge++;
  }
  if(!result.eligible&&sample.length<12)sample.push(result);
 }
 const requested=ids.map(id=>{
  const cat=resolveId(id,catalog);
  if(!cat)return {lookup:id,found:false,message:'当前在售数据中没有这个编号'};
  if(cat.ambiguous)return {lookup:id,found:false,message:'短编号有多条匹配，请使用完整编号',matches:cat.matches};
  return {lookup:id,found:true,...view(cat,effective,options)};
 });
 const topMatches=actual.cats.slice(0,12).map(cat=>view(cat,effective,options));
 return {goal,markup,priceExplanation:actual.interpretation,requireImage,
  inferredDemand:inferred,effectiveDemand:effective,
  counts:{...actual.stats,independent:counts,unknownAge},
  requested,topMatches,sampleFailures:sample,
  notes:['独立统计以在售猫为基数，不会因为前一关为0就把后面全部显示为0。',
   '仅诊断并读取网站实际在售猫源；没有修改飞书数据，也没有调用或扣除AI额度。',
   '客户参考售价按现有网站加价规则计算；价格低本身不是筛除理由。']};
}
