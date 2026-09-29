import { createHmac, timingSafeEqual } from 'node:crypto';
import { json } from './admin-auth.js';
const COOKIE='cat_sales_assistant',MAX_AGE=7*24*60*60,failures=new Map();
const equal=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
const sign=(text,secret)=>createHmac('sha256',secret).update(text).digest('base64url');
const signingSecret=env=>{const value=String(env?.ASSISTANT_SESSION_SECRET||'');if(value.length<32)throw new Error('assistant auth not configured');return value;};
const ip=request=>String(request.headers.get('x-forwarded-for')||request.headers.get('x-real-ip')||'unknown').split(',')[0].trim().slice(0,100);
export function loginAllowed(request){const key=ip(request),now=Date.now(),v=failures.get(key);if(!v||now>v.until){failures.set(key,{count:0,until:now+15*60*1000});return true;}return v.count<5;}
export function failLogin(request){const key=ip(request),now=Date.now(),v=failures.get(key);failures.set(key,!v||now>v.until?{count:1,until:now+15*60*1000}:{...v,count:v.count+1});}
export function clearFailures(request){failures.delete(ip(request));}
export function sessionCookie(env,seller){const body=Buffer.from(JSON.stringify({scope:'sales-assistant',salesId:seller.salesId,recordId:seller.recordId,exp:Math.floor(Date.now()/1000)+MAX_AGE})).toString('base64url');return`${COOKIE}=${body}.${sign(body,signingSecret(env))}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${MAX_AGE}`;}
export const clearCookie=()=>`${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
export function requireAssistant(request,env){const raw=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1);if(!raw)return null;const[body,sig]=raw.split('.');try{if(!equal(sig,sign(body,signingSecret(env))))return null;const data=JSON.parse(Buffer.from(body,'base64url').toString());return data.scope==='sales-assistant'&&data.exp>Date.now()/1000?data:null;}catch{return null;}}
export {json};
