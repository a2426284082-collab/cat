// Shared data-only tool contract. Models never return executable code, arbitrary URLs or administrator actions.
export const AGENT_TOOLS=['poster','match','praise','price','compare','handbook','details','downloads','single_poster','calculator','order','client_view','catalog','help','clarify','reset'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),object=o=>o&&typeof o==='object'&&!Array.isArray(o);
const fail=()=>{throw new Error('工具指令格式无效');};
export function agentParams(value={}){
 if(!object(value))fail();const out={};
 for(const [key,v] of Object.entries(value)){
  if(['includePrices','bannerEnabled','mirrorEnabled','enabled','clear','refresh','shuffle'].includes(key)){if(typeof v!=='boolean')fail();out[key]=v;}
  else if(['count','height','markup','quote','freight','advance','other'].includes(key)){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>1000000)fail();if(key==='count'&&(!Number.isInteger(v)||v<2||v>9))fail();if(key==='height'&&![1080,1440].includes(v))fail();if(key==='markup'&&(!Number.isInteger(v)||v>100000))fail();out[key]=v;}
  else if(key==='replaceIndex'){if(!Number.isInteger(v)||v<0||v>8)fail();out[key]=v;}
  else if(key==='platform'){if(!['xhs','moments'].includes(v))fail();out[key]=v;}
  else if(key==='operation'){if(!['style','shuffle','batch','download','copy','generate','replace'].includes(v))fail();out[key]=v;}
  else if(['city','shop','province','transport'].includes(key)){const max=key==='shop'?20:12;if(typeof v!=='string'||!v.trim()||[...v].length>max||/[<>\r\n\x00-\x1f]/.test(v))fail();if(key==='transport'&&!['汽运','空运','同城闪送'].includes(v))fail();out[key]=v.trim();}
  else fail();
 }
 return out;
}
export function validateAgentPlan(value,allowedIds){
 if(!object(value)||Object.keys(value).some(k=>!['tool','cat_ids','params','query','message'].includes(k))||!AGENT_TOOLS.includes(value.tool))fail();
 const ids=value.cat_ids??[];if(!Array.isArray(ids)||ids.length>9||ids.some(id=>typeof id!=='string'||!/^[a-z0-9][a-z0-9_-]{0,39}$/i.test(id)))fail();
 const clean=[...new Set(ids.map(id=>id.toUpperCase()))];if(clean.length!==ids.length||allowedIds&&clean.some(id=>!allowedIds.has(id)))fail();
 const out={tool:value.tool,cat_ids:clean,params:agentParams(value.params??{})};
 for(const key of ['query','message'])if(own(value,key)){const max=key==='query'?200:180;if(typeof value[key]!=='string'||[...value[key]].length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value[key]))fail();out[key]=value[key].trim();}
 return out;
}
export function cleanAgentContext(value={}){
 if(!object(value)||Object.keys(value).some(k=>!['task','cat_ids','reference_ids','focus_id','quotes','need','recent_users','params'].includes(k)))fail();
 const task=value.task??'help';if(!AGENT_TOOLS.includes(task))fail();
 const plan=validateAgentPlan({tool:task,cat_ids:value.cat_ids??[],params:value.params??{}});
 const need=typeof value.need==='string'?value.need.slice(0,200):'';
 const recent=value.recent_users??[];if(!Array.isArray(recent)||recent.length>4||recent.some(s=>typeof s!=='string'||[...s].length>120))fail();
 const references=validateAgentPlan({tool:task,cat_ids:value.reference_ids??[]}).cat_ids;
 const focus=value.focus_id??null;if(focus!==null&&(!plan.cat_ids.includes(focus)))fail();
 const quotes={};if(value.quotes!=null){if(!object(value.quotes)||Object.keys(value.quotes).length>9)fail();for(const [id,n] of Object.entries(value.quotes)){if(!plan.cat_ids.includes(id)||typeof n!=='number'||!Number.isFinite(n)||n<0||n>1000000)fail();quotes[id]=n;}}
 return {...plan,task,need,recent_users:recent,reference_ids:references,focus_id:focus,quotes};
}
