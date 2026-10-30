import {handbookEntries} from './sales-handbook-data.js';
import {isHandbookQuestion} from './sales-intent.js';
export {isHandbookQuestion} from './sales-intent.js';
const aliases={
 'basic-job':['合作条件','怎么合作','怎么做代理','怎么做猫咪代理','如何做代理','兼职','加盟','押金','培训费','入职','底薪','平台限制'],
 'basic-earnings':['差价','利润','赚钱','收入','加价','报价','收益','佣金','提成'],
 'basic-deal':['下单','收款','结算','付款','收货信息','库存','运费'],
 'basic-customers':['有效客户','未成年','18岁','运输地区','新疆','西藏','海南','内蒙古'],
 'basic-reply-8':['运费','运输','发货','托运'],
 'basic-reply-14':['回访','收到猫','到家适应'],
 'basic-reply-15':['售后','生病','退款','退货','赔偿','定金','订金','包活','保障期','保证健康','绝对健康','到家有问题','检查资料'],
 'methods-m06':['合作方','合作对象','介绍奖励','分账','转介绍','奖励比例','客户归属'],
 'basic-start':['渠道','获客','找客户'], 'basic-week':['第一天','七天','7天','新手'],
 'methods-m01':['小红书'], 'methods-m02':['抖音','快手'], 'methods-m03':['闲鱼'], 'methods-m04':['搜索','评论'], 'methods-m05':['朋友圈','群聊','微信群'],
};
const unknownPolicy=/退款|退货|赔偿|定金|订金|包活|包退|包换|赔付|健康保障|健康保证|保障期|保证健康|绝对健康|奖励比例|提成比例|佣金比例/;
export function answerHandbook(prompt){
 if(!isHandbookQuestion(prompt))return null;
 const q=prompt.normalize('NFKC').replace(/\s+/g,'');
 const ranked=handbookEntries.map(entry=>{
  const keys=aliases[entry.id]||[];
  let score=keys.reduce((n,key)=>n+(q.includes(key)?12:0),0);
  if(q.includes('售后')&&entry.id==='basic-reply-15')score+=20;
  if(/合作流程|怎么合作|如何合作/.test(q)&&entry.id==='basic-job')score+=15;
  // Exact titles and Chinese bigrams help find a section without guessing an answer.
  if(q.includes(entry.title))score+=25;
  const pairs=new Set(q.match(/[\u4e00-\u9fff]{2}/g)||[]);
  for(const pair of pairs)if(entry.title.includes(pair))score+=3;
  return{entry,score};
 }).filter(x=>x.score>=6).sort((a,b)=>b.score-a.score);
 const chosen=ranked.slice(0,2).map(x=>x.entry);
 const sources=chosen.map(({title,manual,href})=>({title,manual,href}));
 let reply=chosen.length?'按当前销售手册：\n\n'+chosen.map((e,i)=>`${i+1}. ${e.title}\n${e.text.replace(e.title,'').trim().slice(0,540)}`).join('\n\n'):'当前手册中没有找到明确说明，请联系负责人确认后再回复客户。';
 if(unknownPolicy.test(q))reply+='\n\n当前手册没有明确列出你询问的具体期限、金额或适用条件。请向负责人核对本单书面约定，勿自行承诺。';
 if(chosen.some(e=>e.id==='basic-earnings'))reply+='\n\n手册中的金额属于计算示例，实际结算价和运费需按猫咪编号另行确认。';
 return{kind:'handbook',matched_ids:[],reply_text:reply,sources,used_ai:false};
}
