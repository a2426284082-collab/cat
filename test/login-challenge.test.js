import test from 'node:test';
import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { createLoginChallenge, passwordParameters, tokenHash, verifyLoginProof } from '../cloud-functions/_lib/login-challenge.js';
import { loginProof } from '../src/login-proof.js';
import worker from '../cloudflare-worker.js';

const origin='https://auth.example', secret='session-secret-kept-from-the-existing-installation';
const encoded=(password,rounds)=>`${rounds}.${Buffer.from('existing-salt').toString('base64url')}.${pbkdf2Sync(password,'existing-salt',rounds,32,'sha256').toString('base64url')}`;
const args=(scope='admin',hash=encoded('old-password',210000))=>({request:new Request(`${origin}/api/${scope}/challenge`),secret,scope,subject:scope==='admin'?'admin':'S123',encoded:hash});
function withCookie(start,scope='admin') {return new Request(`${origin}/api/${scope}/login`,{headers:{cookie:start.cookie.split(';')[0]}});}

test('existing 210k admin passwords and 120k invitations work without changing stored values',async()=>{
 for(const [scope,rounds] of [['admin',210000],['assistant',120000]]){
  const options=args(scope,encoded('old-password',rounds)), start=createLoginChallenge(options), proof=await loginProof(start.data,'old-password');
  assert.equal(start.data.iterations,rounds);
  assert.equal(start.data.hash,undefined);
  assert.ok(!JSON.stringify(start.data).includes(options.encoded.split('.')[2]));
  assert.equal(verifyLoginProof({...options,request:withCookie(start,scope),challenge:start.data.challenge,proof}),true);
 }
});

test('proofs reject wrong password, missing cookie, wrong origin/scope/subject, tampering and replay',async()=>{
 const options=args(),start=createLoginChallenge(options), request=withCookie(start), proof=await loginProof(start.data,'old-password');
 const valid={...options,request,challenge:start.data.challenge,proof};
 assert.equal(verifyLoginProof({...valid,proof:await loginProof(start.data,'wrong-password')}),false);
 assert.equal(verifyLoginProof({...valid,request:new Request(`${origin}/api/admin/login`)}),false);
 assert.equal(verifyLoginProof({...valid,request:new Request('https://evil.example/api/admin/login',{headers:{cookie:start.cookie.split(';')[0]}})}),false);
 assert.equal(verifyLoginProof({...valid,scope:'assistant'}),false);
 assert.equal(verifyLoginProof({...valid,subject:'someone-else'}),false);
 assert.equal(verifyLoginProof({...valid,challenge:`${start.data.challenge}x`}),false);
 assert.equal(verifyLoginProof(valid),true);
 assert.equal(verifyLoginProof(valid),false);
});

test('expired challenges fail and new random invitation hashes use the lightweight token path',async()=>{
 const options=args('assistant',tokenHash('random-invite-secret')),start=createLoginChallenge(options), proof=await loginProof(start.data,'random-invite-secret');
 assert.equal(start.data.algorithm,'sha256-token');
 const now=Date.now;
 try {const fixed=now();Date.now=()=>fixed+91_000;assert.equal(verifyLoginProof({...options,request:withCookie(start,'assistant'),challenge:start.data.challenge,proof}),false);}
 finally{Date.now=now;}
 assert.equal(verifyLoginProof({...options,request:withCookie(start,'assistant'),challenge:start.data.challenge,proof}),true);
 assert.equal(passwordParameters(options.encoded),null,'token hash must never be accepted as an admin password');
});

test('Cloudflare refuses outdated raw-password clients rather than executing a costly KDF',async()=>{
 const response=await worker.fetch(new Request(`${origin}/api/admin/login`,{method:'POST',body:JSON.stringify({username:'admin',password:'old-password'})}),{}, {waitUntil(){}});
 assert.equal(response.status,409);assert.equal((await response.json()).code,'AUTH_REFRESH_REQUIRED');
});

test('cross-site challenges are blocked and missing admin configuration returns safe names',async()=>{
 const run=originHeader=>worker.fetch(new Request(`${origin}/api/admin/challenge`,{method:'POST',headers:{Origin:originHeader},body:JSON.stringify({username:'admin'})}),{}, {waitUntil(){}});
 assert.equal((await run('https://evil.example')).status,403);
 const response=await run(origin), body=await response.json();
 assert.equal(response.status,503);assert.equal(body.code,'CONFIG_MISSING');
 assert.deepEqual(body.missing,['ADMIN_USERNAME','ADMIN_PASSWORD_HASH','ADMIN_SESSION_SECRET']);
});
