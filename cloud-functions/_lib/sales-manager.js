// A small, auditable manager contract over existing specialist executors.
// The manager owns GOALS and dependencies, not the implementation of a tool.
// No untrusted model output can invent a specialist, goal, or executable tool.
import {validateAgentPlan} from './agent-schema.js';
import {designBrief} from './specialist-design.js';

export const SPECIALIST_OPERATIONS=Object.freeze({
 inventory:['select'],design:['collage'],copy:['marketing_copy','compare'],quote:['quote']
});
const has=(s,re)=>re.test(s);
const withoutNegation=(s,re,negative)=>has(s,re)&&!has(s,negative);

// The ledger is an independently checkable safety net for clearly stated goals.
// Unrecognized requests use the model-driven legacy route rather than being
// silently classified into an invented goal. A model cannot mark goals complete.
export function createManagerGoals(goal,context={}){
 const s=String(goal||'').normalize('NFKC');
 const selection=has(s,/(?:找|选|挑|推荐|筛选|匹配|看看|给我).{0,26}(?:[猫咪]|布偶|英短|美短|缅因|渐层)|(?:猫咪|猫源).{0,12}(?:推荐|筛选|匹配)/);
 const picture=withoutNegation(s,/(?:做图|作图|拼图|海报|宣传图|朋友圈图|合成图片|制作图片|出图)/,/(?:不要|不做|无需|不用)(?:再)?(?:做图|作图|拼图|海报)/);
 const caption=withoutNegation(s,/(?:话术|文案|推荐语|介绍词)/,/(?:不要|不写|无需|不用)(?:再)?(?:话术|文案|推荐语)/);
 const comparison=has(s,/(?:比较|对比).{0,18}(?:猫|只|第一|第二)|(?:猫|前两只|两只).{0,18}(?:比较|对比)/);
 const quote=has(s,/(?:核算|计算|算算).{0,10}(?:报价|售价|利润|差价)|(?:整理|生成|给出|做).{0,10}(?:报价|报价单)|(?:内部报价|报价建议)/);
 // Existing edit-specific state machine ensures exact position preservation.
 if(has(s,/(?:只换|替换|换掉|换成).{0,10}第[一二三四五六七八九1-9][只个]|第[一二三四五六七八九1-9][只个].{0,10}(?:换掉|替换|换成|只换)/))return [];
 // Never hide an objective handled by the general tool coordinator.
 if(has(s,/(?:手册|售后|退款|锁猫|订单|发货|物流|运输|下载|保存到本地|视频|发微信|提醒|跟进|客户档案|审批|发票|开票|备忘|联系人|分享|群发|发布|上架|下架|支付|收款|定金|合同|订金|审核)/))return [];
 const expectsCats=picture||caption||comparison||quote;
 const mustFind=selection||expectsCats&&!(context.cat_ids?.length>=2);
 const goals=[];const add=(specialist,operation,deps=[],label='')=>{
  const id=`g${goals.length+1}`;
  goals.push({id,specialist,operation,depends_on:[...deps],label,status:'pending',attempts:0,receipt:null});return id;
 };
 const inventory=mustFind?add('inventory','select',[],'筛选符合要求的真实在售猫'):null;
 // When the user requested multiple separate pictures, do not falsely certify
 // a single mutable browser preview as multiple saved assets.
 const multiPicture=picture&&/(?:[2-9二两三四五六七八九]张|多张|两套|多套).{0,15}(?:图|拼图|海报|风格)|(?:图|拼图|海报).{0,12}(?:[2-9二两三四五六七八九]张|两套|多套)/.test(s);
 if(multiPicture)return []; // Leave complex multi-artifact work to model, not a false one-image ledger.
 const design=picture?add('design','collage',inventory?[inventory]:[],'制作并验证拼图预览'):null;
 if(caption&&((picture||context.cat_ids?.length>=2)))add('copy','marketing_copy',[inventory,design].filter(Boolean),'生成与选中猫对应的推荐文案');
 if(comparison)add('copy','compare',inventory?[inventory]:[],'比较已经选中的猫咪');
 if(quote)add('quote','quote',inventory?[inventory]:[],'核算选中猫咪的参考报价');
 // A single-goal request can still use the old model routing, including tools
 // outside these four modules (handbook, downloads, order, etc.).
 return goals.length>=2?goals:[];
}
export function managerProgress(goals=[]){
 const list=Array.isArray(goals)?goals:[];
 const done=list.filter(g=>g.status==='done').length;
 return {total:list.length,done,remaining:list.length-done,complete:list.length>0&&done===list.length};
}
export function nextManagerGoal(goals=[]){
 const unfinished=goals.filter(g=>g.status!=='done');
 return unfinished.find(g=>g.depends_on.every(id=>goals.some(prior=>prior.id===id&&prior.status==='done')))||null;
}
export function validateDelegation(value,goals=[]){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['action','goal_id','specialist','params'].includes(k)))throw Error('invalid_delegation');
 const goal=goals.find(g=>g.id===value.goal_id&&g.status!=='done');
 if(!goal||value.specialist!==goal.specialist||!(SPECIALIST_OPERATIONS[goal.specialist]||[]).includes(goal.operation))throw Error('invalid_delegation');
 if(value.params!==undefined&&(!value.params||typeof value.params!=='object'||Array.isArray(value.params)))throw Error('invalid_delegation');
 return {action:'delegate',goal_id:goal.id,specialist:goal.specialist,params:value.params||{}};
}
// The specialist adapter produces a legacy tool command only AFTER the manager
// has chosen a typed goal. This keeps the existing browser and Worker APIs stable.
export function specialistHandoff(goal,state,allowedIds,modelParams={}){
 const stored=state.context?.cat_ids||[];
 const goalText=state.goal||'';
 let value;
 switch(`${goal.specialist}:${goal.operation}`){
  case 'inventory:select':{
   const count=state.demand?.quantity?.count||4;
   value={tool:'match',params:count>=2?{count}:{},query:goalText.slice(0,200),demand:state.demand};break;
  }
  case 'design:collage':{
   const settings=designBrief({goal:goalText}).settings;
   const count=stored.length>=2?stored.length:state.demand?.quantity?.count||4;
   value={tool:'poster',cat_ids:stored,params:{count,...settings},query:goalText.slice(0,200)};break;
  }
  case 'copy:marketing_copy':value={tool:'poster',cat_ids:stored,params:{operation:'generate'},query:''};break;
  case 'copy:compare':value={tool:'compare',cat_ids:stored.slice(0,2),params:{},query:'对比选中猫咪的真实资料，不能编造健康与性格保证'};break;
  case 'quote:quote':{
   // Quote module returns a verified summary for the selected real cats;
   // its data result does not claim a freight quote or payment.
   if(!stored.length)throw Error('报价前需要有已核实的猫咪编号，请先选猫');
   value={tool:'calculator',cat_ids:stored,params:{},query:''};break;
  }
  default:throw Error('未知专业任务');
 }
 // Manager-supplied optional settings may only affect a compatible graphic
 // command; they cannot inject inventory conditions or price overrides.
 if(goal.specialist==='design'){
  for(const k of ['borderless','includePrices','bannerEnabled','mirrorEnabled','height','platform'])
   if(Object.hasOwn(modelParams,k)&&!Object.hasOwn(value.params,k))value.params[k]=modelParams[k];
 }
 return validateAgentPlan(value,allowedIds);
}
export function recordManagerReceipt(goals=[],goalId,status,receipt){
 const item=goals.find(g=>g.id===goalId);
 if(!item)return false;
 item.attempts=(item.attempts||0)+1;
 if(status==='success'){item.status='done';item.receipt={status:'success',text:String(receipt||'').slice(0,180)};}
 else {item.status='pending';item.receipt={status:'error',text:String(receipt||'').slice(0,180)};}
 return true;
}
export function managerSummary(goals=[]){
 const done=goals.filter(g=>g.status==='done').map(g=>g.label);
 const pending=goals.filter(g=>g.status!=='done').map(g=>g.label);
 return `${done.length?'已完成：'+done.join('、'):'尚无已确认完成的目标'}${pending.length?'；待完成：'+pending.join('、'):''}。素材下载和外部发送仍需销售核对。`;
}
