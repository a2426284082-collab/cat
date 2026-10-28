import {normalizeId} from './presentation.js';
export const provinces=['北京','天津','河北','山西','内蒙古','辽宁','吉林','黑龙江','上海','江苏','浙江','安徽','福建','江西','山东','河南','湖北','湖南','广东','广西','海南','重庆','四川','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆','香港','澳门','台湾'];
export function calculateDeal({base,quote,freight,other=0,advance,customerPaysFreight=false}){
 const values=[base,quote,freight,other,advance];if(values.some(x=>x===''||x==null||!Number.isFinite(Number(x))||Number(x)<0||Number(x)>1000000))return null;
 const [b,q,f,o,a]=values.map(value=>Math.round(Number(value)*100)),payable=q+(customerPaysFreight?f:0);if(a>payable)return null;return {cost:(b+f+o)/100,receivable:payable/100,margin:(payable-b-f-o)/100,balance:(payable-a)/100};
}
export function orderCommand(cat,label){return `【查库锁猫】编号：${label}（完整编号：${normalizeId(cat.id)}）（${cat.breed||'品种待确认'}${cat.color||''}·${cat.gender||'性别待确认'}）| 合作底价：${cat.price==null?'待确认':'¥'+cat.price} | 请确认是否在售并拍今日实时视频`;}
export function paymentScript({label,quote,freight,advance,balance,province,transport,node,customerPaysFreight}){return `这只${label}的报价是${quote}元，${province}${transport}的运费预估${freight}元${customerPaysFreight?'（另外结算）':'（已按本报价方案计入，由我方按约承担）'}，以最终确认为准。请先核对猫咪、健康资料和书面协议；按双方确认的方案先付预付款${advance}元，余款${balance}元于${node||'书面协议约定的节点'}支付。具体保障和退款按书面约定办理。`;}
export function assetDownloadURL(src,name){const url=new URL(src,globalThis.location?.origin||'https://preview.local');if(!/^\/api\/public-(?:images|videos)\/[a-z0-9_-]+$/i.test(url.pathname)||url.origin!==(globalThis.location?.origin||'https://preview.local'))return null;url.searchParams.set('download','1');url.searchParams.set('name',String(name).replace(/[^a-z0-9_-]/gi,'').slice(0,60));return url.pathname+url.search;}
export const commentTips=[
 '这只的照片和资料在本页，喜欢的话可以先看看视频，再告诉我想了解哪个编号。',
 '可以在站内私信告诉我预算、品种和所在城市，我按实际库存帮你核对价格与运输。',
 '第一次养猫也不用急着决定，先聊清性格、照顾方式和售后约定，再看适不适合。',
];

export const dealMoney=value=>`¥${Number(value).toLocaleString('zh-CN',{maximumFractionDigits:2})}`;
