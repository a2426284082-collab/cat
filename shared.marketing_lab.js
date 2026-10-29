export const marketingLabTemplates = ['xhs_cover','grid_4','cat_profile','douyin_cover'];
export const marketingLabThemes = ['cream','pink','mint','bold'];
export const marketingLabLayouts = ['editorial','sticker','minimal'];
const forbidden=/(?:¥|￥|人民币|元起|\d+(?:\.\d+)?\s*元|\d+\s*块|合作价|进货价|底价|成本|利润|稳赚|包健康|包治|包疫苗|保健康|保证温顺|绝不生病|百分百健康)/i;
const allowedTags=new Set(['可看猫咪','萌宠日常','新手养猫','实拍分享','猫咪日常','萌猫合集','品种介绍','选猫建议','猫咪写真','猫咪图鉴','暖心陪伴','真实照片','看看小猫','日常记录','猫咪上新']);
const clean=(s,n=65)=>String(s??'').replace(/[\r\n\t]+/g,' ').replace(/[\u0000-\u001f]/g,'').trim().slice(0,n);
const safe=(s,n,fallback='')=>{const value=clean(s,n);return forbidden.test(value)?fallback:value;};
export function normalizeMarketingLabPlan(source,{preferredTemplate='xhs_cover',photoCount=4}={}){
 if(!source||typeof source!=='object'||Array.isArray(source))throw new Error('AI没有返回有效的绘图方案');
 const template=marketingLabTemplates.includes(source.template)?source.template:(marketingLabTemplates.includes(preferredTemplate)?preferredTemplate:'xhs_cover');
 const theme=marketingLabThemes.includes(source.theme)?source.theme:'cream';
 const layout=marketingLabLayouts.includes(source.layout)?source.layout:'editorial';
 const defaults={xhs_cover:['店里有可爱的小猫啦','一起看看今天的萌猫','欢迎了解更多猫咪'],grid_4:['猫咪日常大集合','每一只都有自己的可爱','喜欢哪只可以聊聊'],cat_profile:['今天的猫咪主角','真实猫咪日常分享','一起了解它的小档案'],douyin_cover:['今天被小猫治愈了','满屏都是小可爱','来看看这些萌猫']}[template];
 const headline=safe(source.headline,22,defaults[0])||defaults[0];
 const subtitle=safe(source.subtitle,32,defaults[1])||defaults[1];
 const cta=safe(source.cta,36,defaults[2])||defaults[2];
 const tags=(Array.isArray(source.tags)?source.tags:[]).map(v=>safe(v,10)).filter(v=>allowedTags.has(v)).slice(0,4);
 const slots=Array.isArray(source.photoSlots)?source.photoSlots:[];
 const maxPhotos=Math.max(1,Math.min(4,Number(photoCount)||4));
 const needed=template==='grid_4'?Math.min(4,maxPhotos):1;
 const photoSlots=Array.from({length:needed},(_,i)=>{const value=Number(slots[i]);return Number.isInteger(value)&&value>=0&&value<maxPhotos?value:i%maxPhotos;});
 const lines=(Array.isArray(source.lines)?source.lines:[]).map(v=>safe(v,18)).filter(Boolean).slice(0,3);
 return {template,theme,layout,headline,subtitle,cta,tags:tags.length?tags:['萌宠日常','真实照片'],photoSlots,lines:lines.length?lines:['真实照片','猫咪日常','欢迎了解'],version:1};
}
export function makeMarketingLabMessages({prompt,template='xhs_cover',photoCount=4}){
 const system=`你是一位专业的中文宠物生活方式视觉编排设计师。你只设计排版方案，绝不虚构猫咪身份、品种、健康、疫苗、性格、在售状态、地理位置或服务承诺。照片会由前端直接提供，但你不能依赖未给出的事实。不要报价或出现任何金额。营销内容偏向自然分享而非强推销售。\n只回复一个JSON对象，严格使用下列字段（不要加其他字段）：\n{"template":"xhs_cover","theme":"cream","layout":"editorial","headline":"店里有可爱的小猫啦","subtitle":"真实照片记录这些小可爱","cta":"喜欢的话欢迎聊聊～","tags":["萌宠日常","真实照片"],"photoSlots":[0],"lines":["真实照片","猫咪日常"]}\n参数约束：template只能是xhs_cover、grid_4、cat_profile、douyin_cover之一；theme只能是cream、pink、mint、bold之一；layout只能是editorial(杂志感)、sticker(贴纸感)、minimal(极简大图)之一。headline最多22字，subtitle最多32字，cta最多36字，tags最多4个，只能从[可看猫咪,萌宠日常,新手养猫,实拍分享,猫咪日常,萌猫合集,品种介绍,选猫建议,猫咪写真,猫咪图鉴,暖心陪伴,真实照片,看看小猫,日常记录,猫咪上新]选择；lines最多3条，内容须是无未经证实属性的短词。photoSlots是0开始的照片索引，范围0到${Math.max(0,photoCount-1)}。不要写raw canvas代码，也不要SVG/HTML。你必须输出有效JSON。`;
 return [{role:'system',content:system},{role:'user',content:`用户的营销需求：${clean(prompt,600)}。用户偏好的模板：${template}；提供${photoCount}张猫咪照片。请生成一份合法JSON绘图方案。`}];
}
