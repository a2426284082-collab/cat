import assert from 'node:assert/strict';
import test from 'node:test';
import { requireAssistant, sessionCookie } from '../cloud-functions/_lib/assistant-auth.js';
import { hashSecret, verifySecret } from '../cloud-functions/_lib/assistant-store.js';
import { draftReply, matchKnowledge } from '../cloud-functions/_lib/sales-assistant.js';

const code='sales-only-code',env={ASSISTANT_SESSION_SECRET:'assistant-session-secret-longer-than-thirty-two-characters'},seller={salesId:'S123',recordId:'rec1'};
test('assistant invite hash and signed seller session authenticate safely',()=>{const hash=hashSecret(code);assert.equal(verifySecret(code,hash),true);assert.equal(verifySecret('wrong',hash),false);const cookie=sessionCookie(env,seller).split(';')[0],session=requireAssistant(new Request('https://cats.example/assistant/',{headers:{cookie}}),env);assert.equal(session.salesId,'S123');});
test('difficult questions match guarded answers without AI',async()=>{assert.equal(matchKnowledge('能保证绝对健康吗').risk,'高');const result=await draftReply({}, {message:'这只猫能保证绝对健康吗',tone:'亲切自然',cat:null});assert.equal(result.riskLevel,'高');assert.match(result.reply,/不能|不适合/);assert.equal(result.usedAI,false);});
