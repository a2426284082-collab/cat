// Data-only contract between the planner and inventory tools. No price is
// deemed suspicious merely because it is low: stock facts are authoritative.
import {extractAgeIntent,extractGenderIntent,coatEvidence,coatMentionedAsCat,ageValue,intentConflicts} from './sales-language.js';

const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v,name)=>{if(v===null||v===undefined)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000)throw new Error(`需求参数${name}无效`);return v;};
const str=v=>typeof v==='string'&&v.trim().length<=80&&v.trim().length>0;
const uniq=values=>[...new Set(values)];
const list=(v,name)=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>12||v.some(x=>!str(x)))throw new Error(`需求参数${name}无效`);return uniq(v.map(x=>x.trim()));};
const nullableString=(v,name)=>{if(v===undefined||v===null||v==='')return null;if(!str(v))throw new Error(`需求参数${name}无效`);return v.trim();};
const allowed=(v,fields)=>{if(!obj(v)||Object.keys(v).some(k=>!fields.includes(k)))throw new Error('需求参数存在未知字段');};
const PRICE_MODES=['none','target','ceiling','floor','range','cheapest'];
export function validateSalesDemand(raw){
 allowed(raw,['price','hard','preferences','quantity']);
 const p=raw.price??{},h=raw.hard??{},pref=raw.preferences??{},q=raw.quantity??{};
 allowed(p,['mode','target','min','max','basis']);allowed(h,['breeds','excludeBreeds','colors','excludeColors','gender','minAgeMonths','maxAgeMonths','requirePhoto']);allowed(pref,['gender','keywords','ageTargetMonths']);allowed(q,['count','exact']);
 const mode=p.mode??'none';if(!PRICE_MODES.includes(mode))throw new Error('价格意图不合法');
 const basis=p.basis??'customer';if(!['customer','wholesale'].includes(basis))throw new Error('价格口径不合法');
 const target=num(p.target,'target'),min=num(p.min,'min'),max=num(p.max,'max');
 if((mode==='target'&&(!target||target<=0))||(mode==='ceiling'&&(!max||max<=0))||(mode==='floor'&&(!Number.isFinite(min)||min<0))||(mode==='range'&&(!Number.isFinite(min)||!Number.isFinite(max)||min>max)))throw new Error('价格区间不完整');
 const gender=nullableString(h.gender,'gender'),preferredGender=nullableString(pref.gender,'preferred_gender');
 if(gender&&!['母','公'].includes(gender)||preferredGender&&!['母','公'].includes(preferredGender))throw new Error('猫咪性别参数错误');
 const minAge=num(h.minAgeMonths,'minAgeMonths'),maxAge=num(h.maxAgeMonths,'maxAgeMonths');
 if(minAge!==null&&maxAge!==null&&minAge>maxAge)throw new Error('月龄区间不正确');
 if(h.requirePhoto!==undefined&&typeof h.requirePhoto!=='boolean')throw new Error('照片条件无效');
 const count=q.count??4;if(!Number.isInteger(count)||count<1||count>9)throw new Error('猫咪数量需要1至9只');
 if(q.exact!==undefined&&typeof q.exact!=='boolean')throw new Error('数量是否必需必须是布尔值');
 return {price:{mode,target,min,max,basis},hard:{breeds:list(h.breeds,'breeds'),excludeBreeds:list(h.excludeBreeds,'excludeBreeds'),colors:list(h.colors,'colors'),excludeColors:list(h.excludeColors,'excludeColors'),gender,minAgeMonths:minAge,maxAgeMonths:maxAge,requirePhoto:h.requirePhoto===true},preferences:{gender:preferredGender,keywords:list(pref.keywords,'keywords'),ageTargetMonths:num(pref.ageTargetMonths,'ageTargetMonths')},quantity:{count,exact:q.exact===true}};
}
const escape=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const negative=(text,word)=>new RegExp(`(?:不要|不想要|不喜欢|排除|除了|别要|不考虑|避开|不选|别推荐)[^，。；,;]{0,8}${escape(word)}|${escape(word)}\\s*(?:不要|不考虑|不选|别推荐)`).test(text);
const breedAliases={'英国短毛猫':['英短','英国短毛'],'英短':['英国短毛猫','英国短毛'],
 '美国短毛猫':['美短','美国短毛'],'美短':['美国短毛猫','美国短毛'],
 '布偶':['布偶猫'],'布偶猫':['布偶'],'缅因猫':['缅因'],'缅因':['缅因猫'],
 '德文卷毛猫':['德文'],'德文':['德文卷毛猫']};
const breedForms=name=>[name,name.replace(/猫$/,''),...(breedAliases[name]||[])];
// A sales request may mix inventory requirements with artwork instructions.
// A visual color (e.g. 无黑框, 白色背景) is NOT a cat's coat color.
// Remove only identifiable presentation *phrases*, preserving genuine coat
// requests such as 黑猫、黑色的猫、不要黑色猫 in the same sentence.
// This scoped source is used for BOTH local extraction and model grounding.
export function inventoryColorEvidence(goal){return coatEvidence(goal);}
export function salesIntentConflicts(goal,catalog=[]){
 const names=[...new Set(catalog.flatMap(c=>c.breed?breedForms(c.breed):[]).filter(Boolean))];
 const issues=intentConflicts(goal,names),price=explicitPrice(goal);
 if(price.mode==='range'&&price.min>price.max)issues.push('最低售价高于最高售价');
 return issues;
}

function moneyValue(value){
 const s=String(value||'').replace(/\s+/g,'').replace(/[¥￥元块钱]/g,'');
 const k=s.match(/^(\d+(?:\.\d+)?)(千|k|K|万)$/);
 if(k)return Number(k[1])*(k[2]==='万'?10000:1000);
 const cn=s.match(/^([一二两三四五六七八九])千([一二两三四五六七八九]?)(百)?$/);
 if(cn){const map={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};return map[cn[1]]*1000+(cn[2]?map[cn[2]]*(cn[3]?100:100):0);}
 return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null;
}
function explicitPrice(source){
 const text=String(source||'').normalize('NFKC');
 const number='(?:\\d{2,6}(?:\\.\\d+)?|\\d+(?:\\.\\d+)?\\s*[千kK万]|[一二两三四五六七八九]千[一二三四五六七八九]?(?:百)?)';
 const ignored=/(?:运费|邮费|定金|尾款|佣金|提成|利润|加价|服务费|订金)/;
 const customer=/(?:客户|对客|零售|预算|客户售价|销售价|最终售价|实际售价)/;
 const wholesale=/(?:合作底价|拿货价|成本价|进价|进货价|采购价)/;
 const relevant=/(?:预算|售价|价格|价位|价钱|报价|拿货|成本|进价|进货|采购|客户|零售|卖价|找|推荐|要|想买|希望)/;
 // Min and max can be stated separately, not only in one "500到1000" phrase.
 const minPattern=new RegExp(`(?:最低|下限|至少|不低于|不少于)\\s*(?:价格|售价|预算|客户价|是|为)?\\s*(${number})\\s*(?:元|块(?:钱)?)?|(${number})\\s*(?:元|块(?:钱)?)?\\s*(?:以上|及以上|起步)`);
 const maxPattern=new RegExp(`(?:最高|上限|至多|不超过|别超过|不高于|封顶|最多)\\s*(?:价格|售价|预算|客户价|是|为)?\\s*(${number})\\s*(?:元|块(?:钱)?)?|(${number})\\s*(?:元|块(?:钱)?)?\\s*(?:以内|以下)`);
 const minHit=text.match(minPattern),maxHit=text.match(maxPattern);
 const low=minHit?moneyValue(minHit[1]||minHit[2]):null;
 const high=maxHit?moneyValue(maxHit[1]||maxHit[2]):null;
 // Do not combine a supplier cost floor with a customer-price ceiling.
 const sameBasis=!(wholesale.test(text)&&customer.test(text));
 if(sameBasis&&(low!==null||high!==null)){
  const basis=wholesale.test(text)?'wholesale':'customer';
  if(low!==null&&high!==null)return {mode:'range',target:null,min:low,max:high,basis};
  if(low!==null)return {mode:'floor',target:null,min:low,max:null,basis};
  return {mode:'ceiling',target:null,min:null,max:high,basis};
 }
 const clauses=text.split(/[，,。；;\n]/).filter(Boolean);
 const weighted=clauses.map((s,i)=>({s,i,score:(customer.test(s)?20:0)+(relevant.test(s)?8:0)+(wholesale.test(s)?2:0)-(ignored.test(s)?25:0)})).sort((a,b)=>b.score-a.score||a.i-b.i);
 // A product budget must not be confused with a freight or a commission amount.
 const candidates=weighted.filter(x=>x.score>=0);
 for(const {s} of candidates){
  const basis=wholesale.test(s)&&!customer.test(s)?'wholesale':'customer';
  if(/(?:最便宜|越便宜越好|价格最低|低价优先|省钱优先)/.test(s))return {mode:'cheapest',target:null,min:null,max:null,basis};
  const range=s.match(new RegExp(`(${number})\\s*(?:元|块(?:钱)?)?\\s*(?:到|至|[-~—–])\\s*(${number})\\s*(?:元|块(?:钱)?)?`));
  if(range){const a=moneyValue(range[1]),b=moneyValue(range[2]);if(a!==null&&b!==null&&a>0&&b>0)return {mode:'range',target:null,min:Math.min(a,b),max:Math.max(a,b),basis};}
  let hit=s.match(new RegExp(`(${number})\\s*(?:元|块(?:钱)?|的猫|左右|上下|以内|以下|封顶|附近|多)?`));
  if(!hit)continue;
  if(hit.index===0&&!relevant.test(s)&&!/(?:的猫|以内|以下|左右)/.test(s))continue;
  const price=moneyValue(hit[1]);if(price===null||price<=0)continue;
  const surrounding=s.slice(Math.max(0,hit.index-20),hit.index+hit[0].length+18);
  if(ignored.test(s)&&!customer.test(s)&&!wholesale.test(s))continue;
  if((/(?:以内|以下|封顶|不超过|至多|上限|最多|最高|控制在|别超过)/.test(surrounding)||/(?:预算|最高预算)/.test(s))&&!/(?:左右|上下|大约|大概|附近)/.test(surrounding))return {mode:'ceiling',target:null,min:null,max:price,basis};
  return {mode:'target',target:price,min:null,max:null,basis};
 }
 if(/(?:最便宜|越便宜越好|价格最低|低价优先|省钱优先)/.test(text))return {mode:'cheapest',target:null,min:null,max:null,basis:'customer'};
 return {mode:'none',target:null,min:null,max:null,basis:'customer'};
}
export function inferSalesDemand(goal,catalog=[]){
 const text=String(goal||'').normalize('NFKC').slice(0,4000);
 const breeds=[...new Set(catalog.map(c=>c.breed).filter(Boolean))],colors=[...new Set(catalog.map(c=>c.color).filter(Boolean))];
 const excludedBreeds=breeds.filter(b=>breedForms(b).some(form=>negative(text,form)));
 const positiveBreeds=breeds.filter(b=>breedForms(b).some(form=>text.includes(form))).filter(b=>!excludedBreeds.includes(b));
 const positiveColors=colors.filter(c=>coatMentionedAsCat(text,c)&&!negative(coatEvidence(text),c));
 const excludedColors=colors.filter(c=>coatMentionedAsCat(text,c)&&negative(coatEvidence(text),c));
 const age=extractAgeIntent(text),sex=extractGenderIntent(text);
 const matchCount=text.match(/(?:找|挑|选|推荐|要|来|看)(?:出|给我|一下|个)?\s*([1-9一二两三四五六七八九])\s*只/);
 const numberMap={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 const count=matchCount?(numberMap[matchCount[1]]||Number(matchCount[1])):4;
 const exact=!!matchCount||/(?:必须|至少|一定要|凑齐)\s*(?:[1-9一二三四五六七八九])\s*只/.test(text);
 const alternates=/(?:或者|都可以|都行|任意|任选|都接受|二选一)/.test(text);
 const positives=positiveBreeds.length===1||positiveBreeds.length>1&&alternates?positiveBreeds:[];
 const photoNecessary=/(?:必须有|一定要有|只要有|得有|要有|不能没有|必须带|需要|有)\s*(?:清晰|真实|实际)?\s*(?:图片|照片)|不要没有(?:图片|照片)|(?:图片|照片)(?:必须|一定|要有|不能缺)/.test(text);
 const photoOptional=/(?:照片|图片)(?:无所谓|可有可无|不限)|(?:没有|无)(?:图片|照片)(?:也行|也可以|无所谓)|(?:不需要|不要求|不用提供|可以没有|可不带)(?:图片|照片)|(?:图片|照片)(?:最好有|有最好)/.test(text);
 return validateSalesDemand({price:explicitPrice(text),hard:{breeds:positives,excludeBreeds:excludedBreeds,colors:positiveColors.length===1?positiveColors:[],excludeColors:excludedColors,gender:sex.hard,minAgeMonths:age.min,maxAgeMonths:age.max,requirePhoto:photoNecessary&&!photoOptional},preferences:{gender:sex.prefer,ageTargetMonths:age.target,keywords:[...['圆脸','可爱','温顺','亲人','活泼','安静','适合新手'].filter(x=>text.includes(x))]},quantity:{count,exact}});
}

// Lock explicit objective requirements extracted from the source, even when
// the model neglects or changes them. Vague requests can be refined by model.
export function resolveSalesDemand(goal,modelDemand,catalog=[]){
 const explicit=inferSalesDemand(goal,catalog);
 if(modelDemand==null)return explicit;
 const ai=validateSalesDemand(modelDemand);
 const price=explicit.price;
 const rawText=String(goal||'').normalize('NFKC');
 const hard={...ai.hard,
  breeds:ai.hard.breeds.filter(value=>explicit.hard.breeds.includes(value)),
  colors:ai.hard.colors.filter(value=>explicit.hard.colors.includes(value)),
  excludeBreeds:[...explicit.hard.excludeBreeds],
  excludeColors:[...explicit.hard.excludeColors]};
 for(const key of ['breeds','colors','gender','minAgeMonths','maxAgeMonths']){
  const v=explicit.hard[key];if(Array.isArray(v)?v.length>0:v!==null)hard[key]=v;
 }
 // The model may add useful recognized synonyms, but cannot turn a stated
 // preference into a hard exclusion or invent a different strict gender.
 // No newly invented strict gender, age or exclusion based only on model
 // interpretation. These fields require explicit user evidence.
 hard.gender=explicit.hard.gender;
 hard.minAgeMonths=explicit.hard.minAgeMonths;
 hard.maxAgeMonths=explicit.hard.maxAgeMonths;
 for(const excluded of hard.excludeBreeds)hard.breeds=hard.breeds.filter(v=>v!==excluded);
 for(const excluded of hard.excludeColors)hard.colors=hard.colors.filter(v=>v!==excluded);
 hard.requirePhoto=explicit.hard.requirePhoto;
 // Only explicit wholesale language authorizes pricing by wholesale cost.
 price.basis=explicit.price.basis;
 return validateSalesDemand({price,hard,preferences:{gender:explicit.preferences.gender,ageTargetMonths:explicit.preferences.ageTargetMonths,keywords:uniq([...ai.preferences.keywords.filter(value=>rawText.includes(value)),...explicit.preferences.keywords])},quantity:{count:explicit.quantity.count,exact:explicit.quantity.exact}});
}
export function demandPriceLabel(d){
 const p=d.price,prefix=p.basis==='wholesale'?'合作底价':'参考客户价';
 if(p.mode==='target')return `按${prefix}约¥${p.target}的接近程度排序（目标价不是硬上限）`;
 if(p.mode==='ceiling')return `${prefix}不超过¥${p.max}`;
 if(p.mode==='floor')return `${prefix}不低于¥${p.min}`;
 if(p.mode==='range')return `${prefix}在¥${p.min}–¥${p.max}之间`;
 if(p.mode==='cheapest')return `${prefix}由低到高排序`;
 return '未设定价格条件，按已有资料推荐';
}
export function priceOfCat(cat,d,markup=0){
 const floor=Number(cat.price);if(cat.price==null||!Number.isFinite(floor)||floor<0)return null;
 return floor+(d.price.basis==='customer'?Number(markup??0):0);
}
export function parseAgeMonths(value){
 const text=String(value??'').normalize('NFKC').trim();if(!text)return null;
 if(/^\d+(?:\.\d+)?$/.test(text))return Number(text);
 if(text==='半年'||text==='半岁')return 6;
 const numeric=[...text.matchAll(/([\d零一二两三四五六七八九十]+(?:\.\d+)?(?:个?半)?)\s*(岁|年|个?月)/g)];
 if(numeric.length){
  const years=numeric.filter(m=>/岁|年/.test(m[2]));
  const months=numeric.filter(m=>/月/.test(m[2]));
  // Never silently parse a free-form age range or unverifiable text as one fact.
  if(years.length>1||months.length>1||/(?:到|至|左右|约|大概|以上|以下|以内)/.test(text))return null;
  let sum=numeric.reduce((n,m)=>n+ageValue(m[1],/岁|年/.test(m[2])?'岁':'月'),0);
  if(numeric.some(m=>/岁|年/.test(m[2]))&&/(?:岁|年)半(?!个?月)/.test(text))sum+=6;
  return Number.isFinite(sum)?sum:null;
 }
 return null;
}
// Shared predicate: the real selector and admin-only diagnostics MUST use the
// same field interpretations. A failed field never implies other fields fail.
export function inspectSalesCandidate(cat,d,{markup=0,requireImage=false}={}){
 const h=d.hard,ageMonths=parseAgeMonths(cat.age),price=priceOfCat(cat,d,markup),mode=d.price.mode;
 const checks={
  active:!cat.status||cat.status==='在售',
  breed:!h.breeds.length||h.breeds.includes(cat.breed),
  excludedBreed:!h.excludeBreeds.includes(cat.breed),
  color:!h.colors.length||h.colors.includes(cat.color),
  excludedColor:!h.excludeColors.includes(cat.color),
  gender:!h.gender||h.gender===cat.gender,
  age:(h.minAgeMonths===null&&h.maxAgeMonths===null)||(ageMonths!==null&&(h.minAgeMonths===null||ageMonths>=h.minAgeMonths)&&(h.maxAgeMonths===null||ageMonths<=h.maxAgeMonths)),
  photo:!(requireImage||h.requirePhoto)||Boolean(cat.image),
  priceValid:mode==='none'||price!==null,
  priceRange:mode==='none'||mode==='target'||mode==='cheapest'||(price!==null&&(mode!=='ceiling'||price<=d.price.max)&&(mode!=='floor'||price>=d.price.min)&&(mode!=='range'||price>=d.price.min&&price<=d.price.max)),
 };
 return {checks,ageMonths,price,eligible:Object.values(checks).every(Boolean)};
}
export function evaluateSalesCandidates(catalog,demand,{markup=0,requireImage=false}={}){
 const d=validateSalesDemand(demand),count={total:0,active:0,hard:0,photo:0,priced:0,eligible:0};
 const accepted=[];
 for(const cat of catalog){count.total++;
  const inspected=inspectSalesCandidate(cat,d,{markup,requireImage}),f=inspected.checks;
  if(!f.active)continue;count.active++;
  if(!f.breed||!f.excludedBreed||!f.color||!f.excludedColor||!f.gender||!f.age)continue;
  count.hard++;
  if(!f.photo)continue;count.photo++;
  if(!f.priceValid)continue;
  if(inspected.price!==null)count.priced++;
  if(!f.priceRange)continue;
  count.eligible++;accepted.push({cat,price:inspected.price});
 }
 const preference=d.preferences;
 accepted.sort((a,b)=>{
  // A target price is the primary ranking signal: a soft preference may not
  // turn a ¥2000 request into a list of ¥50 cats. A ceiling is just a bound.
  if(d.price.mode==='target'){
   const diff=Math.abs(a.price-d.price.target)-Math.abs(b.price-d.price.target);if(diff)return diff;
  }
  if(d.price.mode==='cheapest'&&a.price!==b.price)return a.price-b.price;
  const fit=cat=>{
   const facts=[cat.description,cat.color,cat.breed,cat.tags,cat.personality].filter(v=>typeof v==='string').join(' ');
   return (preference.gender&&cat.gender===preference.gender?2:0)+preference.keywords.filter(k=>facts.includes(k)).length;
  };
  const preferenceDiff=fit(b.cat)-fit(a.cat);if(preferenceDiff)return preferenceDiff;
  if(preference.ageTargetMonths!==null){
   const ageA=parseAgeMonths(a.cat.age),ageB=parseAgeMonths(b.cat.age);
   const distanceA=ageA===null?Infinity:Math.abs(ageA-preference.ageTargetMonths);
   const distanceB=ageB===null?Infinity:Math.abs(ageB-preference.ageTargetMonths);
   if(distanceA!==distanceB)return distanceA-distanceB;
  }
  if(d.price.mode==='ceiling'||d.price.mode==='range'||d.price.mode==='floor'){
   // Among equally preferred cats, use more of the customer's allowed range.
   if(a.price!==b.price)return b.price-a.price;
  }
  return String(a.cat.id).localeCompare(String(b.cat.id));
 });
 return {cats:accepted.map(x=>x.cat),stats:count,interpretation:demandPriceLabel(d)};
}
export function verifySalesSelection(selection,catalog,demand,opts={}){
 const result=evaluateSalesCandidates(catalog,demand,opts),allowed=new Set(result.cats.map(c=>String(c.id).toUpperCase()));
 const unique=new Set();for(const cat of selection){const id=String(cat.id).toUpperCase();if(unique.has(id)||!allowed.has(id))throw new Error('选猫结果不满足客户需求，已停止执行');unique.add(id);}
 return true;
}
