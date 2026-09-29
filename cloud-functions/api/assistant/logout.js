import { clearCookie, json } from '../../_lib/assistant-auth.js';
export async function onRequestPost(){return json({success:true},200,{'Set-Cookie':clearCookie()});}
