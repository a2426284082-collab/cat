import {normalizeMarketingLabPlan,makeMarketingLabMessages} from '../../shared.marketing_lab.js';
import {fail} from './sales-store.js';

export async function generateMarketingLabPlan(env,{prompt,template,photoCount}){
 if(!env?.DEEPSEEK_API_KEY)throw fail('AI 服务尚未配置，暂时不能使用营销实验室',503);
 const response=await fetch('https://api.deepseek.com/chat/completions',{
  method:'POST',
  headers:{Authorization:`Bearer ${env.DEEPSEEK_API_KEY}`,'Content-Type':'application/json'},
  body:JSON.stringify({
   model:env.SALES_AI_MODEL||'deepseek-flash',
   messages:makeMarketingLabMessages({prompt,template,photoCount}),
   response_format:{type:'json_object'},
   temperature:0.3,
   max_tokens:420,
   thinking:{type:'disabled'}
  }),
  signal:AbortSignal.timeout(25000)
 });
 if(!response.ok){
  let text='';
  try{text=await response.text();}catch{}
  throw fail(`营销实验室调用失败（${response.status}）`,502,{detail:text.slice(0,200)});
 }
 let payload;
 try{payload=await response.json();}catch{throw fail('营销实验室返回了无效JSON',502);}
 const raw=payload?.choices?.[0]?.message?.content;
 if(typeof raw!=='string' || !raw.trim())throw fail('营销实验室没有返回可用方案',502);
 let plan;
 try{plan=normalizeMarketingLabPlan(JSON.parse(raw),{preferredTemplate:template,photoCount});}
 catch{throw fail('营销实验室返回的方案格式不正确',502);}
 return {plan,model:env.SALES_AI_MODEL||'deepseek-flash'};
}
