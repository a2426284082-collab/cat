// Local, reversible source update. Does not execute deploy or remote APIs.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,targetArg=process.argv[2];
if(!targetArg){console.error('Usage: node apply-update.cjs "PATH_TO_YOUR_CAT_MAIN"');process.exit(1);}
const target=path.resolve(targetArg),manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8'));
const approvedBackend=new Set(["cloud-functions/_lib/sales-api.js", "cloud-functions/_lib/sales-engine.js", "cloud-functions/_lib/sales-handbook-data.js", "cloud-functions/_lib/sales-handbook.js", "cloud-functions/_lib/sales-intent.js"]);
const forbidden=['wrangler.jsonc','cloudflare-worker.js','.env','.dev.vars'];
function destination(rel){
 if(typeof rel!=='string'||path.isAbsolute(rel)||rel.split(/[\\/]/).includes('..')||forbidden.includes(rel)||/^migrations(\/|$)/.test(rel)||(/^cloud-functions(\/|$)/.test(rel)&&!approvedBackend.has(rel)))throw new Error('Unsafe update path: '+rel);
 const result=path.resolve(target,rel);if(!result.startsWith(target+path.sep))throw new Error('Path escaped target');return result;
}
let pkg;
try{pkg=JSON.parse(fs.readFileSync(path.join(target,'package.json'),'utf8'));}catch{console.error('Target is not an existing cat project.');process.exit(1);}
if(!/^3\.[345]\./.test(pkg.version)||!fs.existsSync(path.join(target,'cloudflare-worker.js'))){console.error('This update needs the existing 3.3.x/3.4.x/3.5.x cat project. No files changed.');process.exit(1);}
for(const entry of manifest.files){
 destination(entry.path);
 const source=path.join(base,'payload',entry.path),actual=crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex');
 if(actual!==entry.sha256)throw new Error('Update integrity check failed: '+entry.path);
}
for(const rel of manifest.deleted)destination(rel);
const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid;
const backup=path.join(target,'workspace-backups',stamp),records=[];
function remember(rel){
 const output=destination(rel),existed=fs.existsSync(output);
 if(existed){if(!fs.statSync(output).isFile()||fs.lstatSync(output).isSymbolicLink())throw new Error('Unexpected target type: '+rel);const old=path.join(backup,rel);fs.mkdirSync(path.dirname(old),{recursive:true});fs.copyFileSync(output,old);}
 records.push({path:rel,existed});return output;
}
try{
 fs.mkdirSync(backup,{recursive:true});
 for(const entry of manifest.files){
  const output=remember(entry.path);fs.mkdirSync(path.dirname(output),{recursive:true});
  if(entry.path==='.gitignore'&&records.at(-1).existed){const current=fs.readFileSync(output,'utf8'),next=fs.readFileSync(path.join(base,'payload',entry.path),'utf8');const lines=[...new Set([...current.split(/\r?\n/),...next.split(/\r?\n/)])];fs.writeFileSync(output,lines.join('\n')+'\n');}
  else fs.copyFileSync(path.join(base,'payload',entry.path),output);
 }
 for(const rel of manifest.deleted){const output=remember(rel);if(fs.existsSync(output))fs.unlinkSync(output);}
 fs.writeFileSync(path.join(backup,'restore-manifest.json'),JSON.stringify(records,null,2));
 console.log('Updated local source successfully.');console.log('Backup: '+backup);
 console.log('Only approved sales backend modules changed. Database, other backend modules, credentials and wrangler.jsonc were preserved.');
 console.log('Next, in your project folder: npm ci, npm test, npm run test:components, npm run build.');
 console.log('No deployment or remote database operation was performed.');
}catch(error){
 for(const record of records.reverse()){const output=destination(record.path);try{if(record.existed)fs.copyFileSync(path.join(backup,record.path),output);else if(fs.existsSync(output))fs.unlinkSync(output);}catch{console.error('Manual restore may be needed for '+record.path+' from '+backup);}}
 console.error('Update failed; rollback attempted: '+error.message);process.exitCode=1;
}
