import {normalizeId} from './presentation.js';
import {agentParams,validateAgentPlan} from '../../cloud-functions/_lib/agent-schema.js';
export const REOPEN_TOOLS=['poster','match','praise','price','compare','details','downloads','single_poster','calculator','order','handbook','catalog'];
export function artifactContext(value={}){
 const task=REOPEN_TOOLS.includes(value.task)?value.task:'match',ids=(value.cat_ids||[]).map(normalizeId).slice(0,9),params=agentParams(value.params||{});delete params.operation;delete params.replaceIndex;validateAgentPlan({tool:task,cat_ids:ids,params});
 const c={task,cat_ids:ids,params,need:String(value.need||'').slice(0,200)};
 for(const [key,max]of [['caption',1600],['bannerText',60]])if(typeof value[key]==='string')c[key]=value[key].slice(0,max);
 if(Number.isInteger(value.designSeed)&&value.designSeed>=0&&value.designSeed<=4294967295)c.designSeed=value.designSeed;
 if(value.quotes){c.quotes={};for(const id of ids){const n=value.quotes[id];if(Number.isFinite(n)&&n>=0&&n<=1000000)c.quotes[id]=n;}}
 return c;
}
export function cleanArtifact(a){if(!a||!REOPEN_TOOLS.includes(a.tool))throw new Error('任务卡无效');return {tool:a.tool,context:artifactContext({...a.context,task:a.tool}),...(typeof a.preview==='string'&&a.preview.length<120000&&/^data:image\/jpeg;base64,[a-zA-Z0-9+/=]+$/.test(a.preview)?{preview:a.preview}:{})};}
export function cleanMessage(row){
 if(!row||!['user','assistant'].includes(row.role)||typeof row.text!=='string')return null;
 const out={id:typeof row.id==='string'&&/^[a-z0-9-]{1,60}$/i.test(row.id)?row.id:crypto.randomUUID(),role:row.role,text:row.text.slice(0,600)};
 if(row.role==='assistant'&&row.action){try{out.action=cleanArtifact(row.action);}catch{}}
 if(row.role==='assistant'&&row.result){const r=row.result;out.result={kind:['tool','inventory','handbook','copy','chat'].includes(r.kind)?r.kind:undefined,used_ai:r.used_ai===true,reply_text:String(r.reply_text||'').slice(0,1600),matched_ids:Array.isArray(r.matched_ids)?r.matched_ids.filter(id=>typeof id==='string'&&/^#?[a-z0-9][a-z0-9_-]{0,39}$/i.test(id)).slice(0,9):[]};}
 return out;
}
export function isQuickTemplate(text){return /^(?:客户预算【[^】]*】元，想看【[^】]*】品种，要求【[^】]*】|客户是第一次养猫的新手，预算【[^】]*】元左右，推荐两只性格温顺好养的猫|客户想找性价比高、品相甜美的捡漏小猫，请从库里挑2只最好卖的)$/.test(String(text).trim());}
