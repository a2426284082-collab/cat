// Data-only contract between the planner and inventory tools. No price is
// deemed suspicious merely because it is low: stock facts are authoritative.
import {parseDemandLocally} from './smart-search.js';

const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
const num=(v,name)=>{if(v===null||v===undefined)return null;if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000)throw new Error(`需求参数${name}无效`);return v;};
const str=v=>typeof v==='string'&&v.trim().length<=80&&v.trim().length>0;
const uniq=values=>[...new Set(values)];
const list=(v,name)=>{if(v===undefined)return [];if(!Array.isArray(v)||v.length>12||v.some(x=>!str(x)))throw new Error(`需求参数${name}无效`);return uniq(v.map(x=>x.trim()));};
const nullableString=(v,name)=>{if(v===undefined||v===null||v==='')return null;if(!str(v))throw new Error(`需求参数${name}无效`);return v.trim();};
const allowed=(v,fields)=>{if(!obj(v)||Object.keys(v).some(k=>!fields.includes(k)))throw new Error('需求参数存在未知字段');};
const PRICE_MODES=['none','target','ceiling','range','cheapest'];
export function validateSalesDemand(raw){
 allowed(raw,['price','hard','preferences','quantity']);
 const p=raw.price??{},h=raw.hard??{},pref=raw.preferences??{},q=raw.quantity??{};
 allowed(p,['mode','target','min','max','basis']);allowed(h,['breeds','excludeBreeds','colors','excludeColors','gender','minAgeMonths','maxAgeMonths','requirePhoto']);allowed(pref,['gender','keywords']);allowed(q,['count','exact']);
 const mode=p.mode??'none';if(!PRICE_MODES.includes(mode))throw new Error('价格意图不合法');
 const basis=p.basis??'customer';if(!['customer','wholesale'].includes(basis))throw new Error('价格口径不合法');
 const target=num(p.target,'target'),min=num(p.min,'min'),max=num(p.max,'max');
 if((mode==='target'&&(!target||target<=0))||(mode==='ceiling'&&(!max||max<=0))||(mode==='range'&&(!Number.isFinite(min)||!Number.isFinite(max)||min>max)))throw new Error('价格区间不完整');
 const gender=nullableString(h.gender,'gender'),preferredGender=nullableString(pref.gender,'preferred_gender');
 if(gender&&!['母','公'].includes(gender)||preferredGender&&!['母','公'].includes(preferredGender))throw new Error('猫咪性别参数错误');
 const minAge=num(h.minAgeMonths,'minAgeMonths'),maxAge=num(h.maxAgeMonths,'maxAgeMonths');
 if(minAge!==null&&maxAge!==null&&minAge>maxAge)throw new Error('月龄区间不正确');
 if(h.requirePhoto!==undefined&&typeof h.requirePhoto!=='boolean')throw new Error('照片条件无效');
 const count=q.count??4;if(!Number.isInteger(count)||count<1||count>9)throw new Error('猫咪数量需要1至9只');
 if(q.exact!==undefined&&typeof q.exact!=='boolean')throw new Error('数量是否必需必须是布尔值');
 return {price:{mode,target,min,max,basis},hard:{breeds:list(h.breeds,'breeds'),excludeBreeds:list(h.excludeBreeds,'excludeBreeds'),colors:list(h.colors,'colors'),excludeColors:list(h.excludeColors,'excludeColors'),gender,minAgeMonths:minAge,maxAgeMonths:maxAge,requirePhoto:h.requirePhoto===true},preferences:{gender:preferredGender,keywords:list(pref.keywords,'keywords')},quantity:{count,exact:q.exact===true}};
}
const escape=v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const negative=(text,word)=>new RegExp(`(?:不要|不想要|排除|别要|不考虑|避开|不选)[^，。；,;]{0,8}${escape(word)}`).test(text);
const breedAliases={'英国短毛猫':['英短','英国短毛'],'英短':['英国短毛猫','英国短毛'],
 '美国短毛猫':['美短','美国短毛'],'美短':['美国短毛猫','美国短毛'],
 '布偶':['布偶猫'],'布偶猫':['布偶'],'缅因猫':['缅因'],'缅因':['缅因猫'],
 '德文卷毛猫':['德文'],'德文':['德文卷毛猫']};
const breedForms=name=>[name,name.replace(/猫$/,''),...(breedAliases[name]||[])];
function explicitPrice(source){
 const text=source.normalize('NFKC');
 const number='(?:\\d{2,6}(?:\\.\\d+)?|\\d+(?:\\.\\d+)?\\s*[千kK])';
 const amount=value=>{const n=Number(value.replace(/[千kK]/g,'').trim());return /[千kK]/.test(value)?n*1000:n;};
 const range=text.match(new RegExp(`(${number})\\s*(?:元|块(?:钱)?)?\\s*(?:到|至|[-~—])\\s*(${number})\\s*(?:元|块(?:钱)?)?`));
 const candidate=text.match(new RegExp(`(?:预算|售价|价位|价格|合作底价|成本价|拿货价|进价|大概|约|近|找|推荐|想要|要)?[^\\d]{0,6}(${number})\\s*(?:元|块(?:钱)?|的猫|左右|上下|以内|以下|封顶)`));
 const wholesale=/(?:合作底价|拿货价|成本价|进价)/.test(text);
 if(/(?:最便宜|越便宜越好|价格最低|低价优先|省钱优先)/.test(text))return {mode:'cheapest',target:null,min:null,max:null,basis:wholesale?'wholesale':'customer'};
 if(range){const a=amount(range[1]),b=amount(range[2]);return {mode:'range',target:null,min:Math.min(a,b),max:Math.max(a,b),basis:wholesale?'wholesale':'customer'};}
 const value=candidate?amount(candidate[1]):null;
 if(!Number.isFinite(value)||value<=0)return {mode:'none',target:null,min:null,max:null,basis:wholesale?'wholesale':'customer'};
 // Match words immediately around the number, not a remote clause about other prices.
 const around=text.slice(Math.max(0,candidate.index-16),candidate.index+candidate[0].length+12);
 if(/(?:以内|以下|封顶|不超过|至多|上限|最多|最高|控制在|别超过)/.test(around)&&!/(?:左右|上下|大约|大概)/.test(around))return {mode:'ceiling',target:null,min:null,max:value,basis:wholesale?'wholesale':'customer'};
 return {mode:'target',target:value,min:null,max:null,basis:wholesale?'wholesale':'customer'};
}
export function inferSalesDemand(goal,catalog=[]){
 const text=String(goal||'').normalize('NFKC').slice(0,1200);
 const breeds=[...new Set(catalog.map(c=>c.breed).filter(Boolean))],colors=[...new Set(catalog.map(c=>c.color).filter(Boolean))];
 const {filters}=parseDemandLocally(text,{breeds,colors});
 const excludedBreeds=breeds.filter(b=>breedForms(b).some(form=>negative(text,form)));
 const excludedColors=colors.filter(c=>negative(text,c));
 const positiveBreeds=breeds.filter(b=>breedForms(b).some(form=>text.includes(form))).filter(b=>!excludedBreeds.includes(b));
 if(filters.breed&&!excludedBreeds.includes(filters.breed)&&!positiveBreeds.includes(filters.breed))positiveBreeds.push(filters.breed);
 const positiveColors=colors.filter(c=>text.includes(c)).filter(c=>!excludedColors.includes(c));
 if(filters.color&&!excludedColors.includes(filters.color)&&!positiveColors.includes(filters.color))positiveColors.push(filters.color);
 const mentionedPreferGender=/(?:优先|尽量|最好|更喜欢).{0,6}(?:母猫|妹妹|女孩|公猫|弟弟|男孩)/.test(text);
 const gender=filters.gender||null;
 const matchCount=text.match(/(?:找|挑|选|推荐|做|要|来|看)(?:出|给我|一下|个)?\s*([1-9一二两三四五六七八九])\s*只/);
 const numberMap={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
 const count=matchCount?(numberMap[matchCount[1]]||Number(matchCount[1])):4;
 const exact=!!matchCount||/(?:必须|至少|一定要|凑齐)\s*(?:[1-9一二三四五六七八九])\s*只/.test(text);
 return validateSalesDemand({price:explicitPrice(text),hard:{breeds:positiveBreeds.length===1||positiveBreeds.length>1&&/(?:或者|都可以|都行|任意|任选|都接受|二选一)/.test(text)?positiveBreeds:[],excludeBreeds:excludedBreeds,colors:positiveColors.length===1?positiveColors:[],excludeColors:excludedColors,gender:mentionedPreferGender?null:gender,minAgeMonths:filters.minAge?Number(filters.minAge):null,maxAgeMonths:filters.maxAge?Number(filters.maxAge):null,requirePhoto:/(?:要|必须|只要|得有|要有|不能没有|有|带|能看).{0,8}(?:图片|照片)|不要没有照片/.test(text)},preferences:{gender:mentionedPreferGender?gender:null,keywords:[...['圆脸','可爱','温顺','亲人','活泼','安静','适合新手'].filter(x=>text.includes(x))]},quantity:{count,exact}});
}
// Lock explicit objective requirements extracted from the source, even when
// the model neglects or changes them. Vague requests can be refined by model.
export function resolveSalesDemand(goal,modelDemand,catalog=[]){
 const explicit=inferSalesDemand(goal,catalog);
 if(modelDemand==null)return explicit;
 const ai=validateSalesDemand(modelDemand);
 const price=explicit.price.mode!=='none'?explicit.price:ai.price;
 const rawText=String(goal||'').normalize('NFKC');
 const grounded=(values,known)=>values.filter(value=>rawText.includes(value)||known.includes(value));
 const hard={...ai.hard,
  breeds:grounded(ai.hard.breeds,explicit.hard.breeds),
  colors:grounded(ai.hard.colors,explicit.hard.colors),
  excludeBreeds:uniq([...grounded(ai.hard.excludeBreeds,explicit.hard.excludeBreeds),...explicit.hard.excludeBreeds]),
  excludeColors:uniq([...grounded(ai.hard.excludeColors,explicit.hard.excludeColors),...explicit.hard.excludeColors])};
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
 hard.requirePhoto=hard.requirePhoto||explicit.hard.requirePhoto;
 // Only explicit wholesale language authorizes pricing by wholesale cost.
 price.basis=explicit.price.basis;
 return validateSalesDemand({price,hard,preferences:{gender:explicit.preferences.gender,keywords:uniq([...ai.preferences.keywords.filter(value=>rawText.includes(value)),...explicit.preferences.keywords])},quantity:{count:explicit.quantity.exact?explicit.quantity.count:ai.quantity.count,exact:explicit.quantity.exact}});
}
export function demandPriceLabel(d){
 const p=d.price,prefix=p.basis==='wholesale'?'合作底价':'参考客户价';
 if(p.mode==='target')return `按${prefix}约¥${p.target}的接近程度排序（目标价不是硬上限）`;
 if(p.mode==='ceiling')return `${prefix}不超过¥${p.max}`;
 if(p.mode==='range')return `${prefix}在¥${p.min}–¥${p.max}之间`;
 if(p.mode==='cheapest')return `${prefix}由低到高排序`;
 return '未设定价格条件，按已有资料推荐';
}
export function priceOfCat(cat,d,markup=0){
 const floor=Number(cat.price);if(cat.price==null||!Number.isFinite(floor)||floor<0)return null;
 return floor+(d.price.basis==='customer'?Number(markup??0):0);
}
export function parseAgeMonths(value){
 const text=String(value??'').trim();if(!text)return null;
 if(/^\d+(?:\.\d+)?$/.test(text))return Number(text);
 const months=text.match(/(\d+(?:\.\d+)?)\s*个?月/),years=text.match(/(\d+(?:\.\d+)?)\s*岁/);
 if(months||years)return (years?Number(years[1])*12:0)+(months?Number(months[1]):0);
 const chineseYears={'一岁半':18,'一岁':12,'两岁':24,'二岁':24,'半岁':6};
 for(const [name,num] of Object.entries(chineseYears))if(text.startsWith(name))return num;
 return null;
}
export function evaluateSalesCandidates(catalog,demand,{markup=0,requireImage=false}={}){
 const d=validateSalesDemand(demand),count={total:0,active:0,hard:0,photo:0,priced:0,eligible:0};
 const accepted=[];
 for(const cat of catalog){count.total++;
  if(cat.status&&cat.status!=='在售')continue;count.active++;
  const h=d.hard;
  if(h.breeds.length&&!h.breeds.includes(cat.breed)||h.excludeBreeds.includes(cat.breed)||h.colors.length&&!h.colors.includes(cat.color)||h.excludeColors.includes(cat.color)||h.gender&&cat.gender!==h.gender)continue;
  const age=parseAgeMonths(cat.age);
  if((h.minAgeMonths!==null||h.maxAgeMonths!==null)&&(age===null||h.minAgeMonths!==null&&age<h.minAgeMonths||h.maxAgeMonths!==null&&age>h.maxAgeMonths))continue;
  count.hard++;
  if((requireImage||h.requirePhoto)&&!cat.image)continue;count.photo++;
  const price=priceOfCat(cat,d,markup);
  const p=d.price;if(price===null&&p.mode!=='none')continue;
  if(price!==null)count.priced++;
  if(p.mode==='ceiling'&&price>p.max||p.mode==='range'&&(price<p.min||price>p.max))continue;
  count.eligible++;accepted.push({cat,price});
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
  if(d.price.mode==='ceiling'||d.price.mode==='range'){
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
