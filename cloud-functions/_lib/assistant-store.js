import { createHash, randomBytes, pbkdf2Sync, timingSafeEqual } from 'node:crypto';
import { createTableRecord, loadTableRecords, updateTableRecord } from './feishu.js';
import { createLoginChallenge, passwordParameters, tokenHash, verifyLoginProof } from './login-challenge.js';
import { signingSecret } from './assistant-auth.js';
import { requiredConfiguration } from './service-errors.js';
const text=value=>Array.isArray(value)?value.map(text).join(''):typeof value==='object'&&value?text(value.text??value.name??''):String(value??'').trim();
const month=date=>new Date(date).toISOString().slice(0,7), number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
function tables(env){requiredConfiguration(env,['FEISHU_SALES_TABLE_ID','FEISHU_AI_LOG_TABLE_ID']);return env;}
export function hashSecret(secret){return tokenHash(secret);}
export function verifySecret(secret,encoded){try{const parameters=passwordParameters(encoded,true);if(!parameters)return false;const actual=parameters.algorithm==='sha256-token'?createHash('sha256').update(Buffer.from(parameters.salt,'base64url')).update(String(secret)).digest():pbkdf2Sync(secret,Buffer.from(parameters.salt,'base64url'),parameters.iterations,32,'sha256'),expected=Buffer.from(parameters.hash,'base64url');return actual.length===expected.length&&timingSafeEqual(actual,expected);}catch{return false;}}
export function newInvite(salesId){const secret=randomBytes(15).toString('base64url');return{code:`${salesId}.${secret}`,hash:hashSecret(secret)};}
const sellerFrom=record=>({recordId:record.record_id,salesId:text(record.fields?.['销售ID']),name:text(record.fields?.['姓名']),inviteHash:text(record.fields?.['邀请码哈希']),quota:Math.max(0,number(record.fields?.['月额度'],100)),status:text(record.fields?.['状态'])||'启用',createdAt:text(record.fields?.['创建时间'])});
const logFrom=record=>({recordId:record.record_id,conversationId:text(record.fields?.['对话ID']),salesId:text(record.fields?.['销售ID']),sellerName:text(record.fields?.['销售姓名']),time:text(record.fields?.['时间']),month:text(record.fields?.['月份']),message:text(record.fields?.['客户问题']),catId:text(record.fields?.['猫咪编号']),reply:text(record.fields?.['建议回复']),riskLevel:text(record.fields?.['风险等级']),intent:text(record.fields?.['问题类型']),model:text(record.fields?.['模型']),inputTokens:number(record.fields?.['输入Token']),outputTokens:number(record.fields?.['输出Token'])});
export async function sellers(env){tables(env);return(await loadTableRecords(env,env.FEISHU_SALES_TABLE_ID,2000)).map(sellerFrom).filter(v=>v.salesId);}
export async function logs(env){tables(env);return(await loadTableRecords(env,env.FEISHU_AI_LOG_TABLE_ID,5000)).map(logFrom).filter(v=>v.salesId);}
export async function findSeller(env,salesId){return(await sellers(env)).find(v=>v.salesId===salesId)||null;}
export async function authenticateInvite(env,code){const dot=String(code).indexOf('.');if(dot<2)return null;const salesId=String(code).slice(0,dot),secret=String(code).slice(dot+1),seller=await findSeller(env,salesId);return seller&&seller.status==='启用'&&verifySecret(secret,seller.inviteHash)?seller:null;}
export async function assistantLoginChallenge(env,request,salesId){const secret=signingSecret(env),seller=await findSeller(env,salesId);if(!seller||seller.status!=='启用')return null;return createLoginChallenge({request,secret,scope:'assistant',subject:salesId,encoded:seller.inviteHash});}
export async function authenticateInviteProof(env,request,body){const secret=signingSecret(env),seller=await findSeller(env,String(body?.salesId||''));return seller&&seller.status==='启用'&&verifyLoginProof({request,secret,scope:'assistant',subject:seller.salesId,encoded:seller.inviteHash,challenge:body?.challenge,proof:body?.proof})?seller:null;}
export async function usageFor(env,salesId,at=Date.now()){const key=month(at);return(await logs(env)).filter(v=>v.salesId===salesId&&(v.month||v.time.slice(0,7))===key).length;}
export async function createSeller(env,{name,quota}){const salesId=`S${randomBytes(4).toString('hex').toUpperCase()}`,invite=newInvite(salesId),now=new Date().toISOString();const record=await createTableRecord(env,env.FEISHU_SALES_TABLE_ID,{'销售ID':salesId,'姓名':String(name).trim().slice(0,50),'邀请码哈希':invite.hash,'月额度':Math.max(1,Math.min(100000,number(quota,100))),'状态':'启用','创建时间':now});return{...sellerFrom(record),inviteCode:invite.code};}
export async function updateSeller(env,recordId,input){const fields={};if('name'in input)fields['姓名']=String(input.name).trim().slice(0,50);if('quota'in input)fields['月额度']=Math.max(1,Math.min(100000,number(input.quota,100)));if('status'in input){if(!['启用','停用'].includes(input.status))throw new Error('invalid status');fields['状态']=input.status;}let inviteCode;if(input.rotate){const current=(await sellers(env)).find(v=>v.recordId===recordId);if(!current)throw new Error('seller not found');const invite=newInvite(current.salesId);fields['邀请码哈希']=invite.hash;inviteCode=invite.code;}if(!Object.keys(fields).length)throw new Error('no changes');const record=await updateTableRecord(env,env.FEISHU_SALES_TABLE_ID,recordId,fields);return{...sellerFrom(record),inviteCode};}
export async function writeLog(env,{seller,conversationId,message,catId,result}){const now=new Date().toISOString();return createTableRecord(env,env.FEISHU_AI_LOG_TABLE_ID,{'对话ID':String(conversationId).slice(0,80),'销售ID':seller.salesId,'销售姓名':seller.name,'时间':now,'月份':month(now),'客户问题':String(message).slice(0,5000),'猫咪编号':String(catId||'').slice(0,100),'建议回复':String(result.reply).slice(0,5000),'风险等级':result.riskLevel,'问题类型':result.intent,'模型':result.model||'内置话术','输入Token':number(result.tokenUsage?.input),'输出Token':number(result.tokenUsage?.output)});}

// Keep usage metadata, but clear deleted conversation content without new table columns.
export async function deleteConversation(env, salesId, conversationId) {
  const rows = (await logs(env)).filter(row => row.salesId === salesId && row.conversationId === conversationId);
  for (const row of rows) {
    await updateTableRecord(env, env.FEISHU_AI_LOG_TABLE_ID, row.recordId, {
      '对话ID': `deleted_${row.recordId}`.slice(0, 80),
      '客户问题': '', '建议回复': '', '猫咪编号': '', '问题类型': '', '风险等级': ''
    });
  }
}
