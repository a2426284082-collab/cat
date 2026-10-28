'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,arg=process.argv[2];if(!arg){console.error('用法: node apply-update.cjs "原3.12项目路径"');process.exit(1);}
const target=fs.realpathSync(path.resolve(arg)),manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json'),'utf8')),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const pkg=JSON.parse(fs.readFileSync(path.join(target,'package.json'),'utf8'));if(!/^3\.12\.[01]$/.test(pkg.version)||!fs.existsSync(path.join(target,'cloudflare-worker.js'))){console.error('此增量补丁仅适用于现有3.12.0或3.12.1项目；请先应用3.12版本。本次没有修改文件。');process.exit(1);}
function destination(rel){if(!manifest.allowed_paths.includes(rel)||rel.split(/[\\/]/).includes('..')||path.isAbsolute(rel))throw new Error('不允许的补丁路径: '+rel);let out=path.resolve(target,rel);if(!out.startsWith(target+path.sep))throw new Error('补丁路径越界');for(let p=out;p!==target;p=path.dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw new Error('补丁不写入符号链接: '+rel);return out;}
if(sha(fs.readFileSync(path.join(base,'transforms.cjs')))!==manifest.transform_sha256)throw new Error('补丁脚本校验失败');
for(const row of manifest.files)if(sha(fs.readFileSync(path.join(base,'payload',row.path)))!==row.sha256)throw new Error('文件校验失败: '+row.path);
const patch=require('./transforms.cjs'),staged=new Map();
try{
 for(const rel of patch.paths){if(rel==='test/sales-components.test.jsx'&&!fs.existsSync(destination(rel)))continue;staged.set(rel,patch.transform(rel,fs.readFileSync(destination(rel),'utf8')));}
 for(const row of manifest.files)staged.set(row.path,fs.readFileSync(path.join(base,'payload',row.path)));
 const next={...pkg,version:'3.12.1'};staged.set('package.json',JSON.stringify(next,null,2)+'\n');
 const lock=JSON.parse(fs.readFileSync(destination('package-lock.json'),'utf8'));lock.version='3.12.1';lock.packages[''].version='3.12.1';staged.set('package-lock.json',JSON.stringify(lock,null,2)+'\n');
 const readme=fs.readFileSync(destination('README.md'),'utf8'),note='\n\n<!-- ADMIN_CONTROL_PATCH_V1 -->\n管理端、工作台设置与手机紧凑布局已更新至3.12.1，见 [ADMIN_CONTROL_UPDATE.md](./ADMIN_CONTROL_UPDATE.md)。';staged.set('README.md',readme.includes('<!-- ADMIN_CONTROL_PATCH_V1 -->')?readme:readme+note+'\n');
 for(const rel of staged.keys())destination(rel);
}catch(e){console.error('合并预检失败，没有修改文件: '+e.message);process.exit(1);}
const stamp=new Date().toISOString().replace(/[:.]/g,'-')+'-'+process.pid,backup=path.join(target,'workspace-backups',stamp),records=[];
try{
 if(fs.existsSync(path.join(target,'workspace-backups'))&&fs.lstatSync(path.join(target,'workspace-backups')).isSymbolicLink())throw new Error('备份目录不能是符号链接');
 fs.mkdirSync(backup,{recursive:true});for(const [rel,data] of staged){const out=destination(rel),existed=fs.existsSync(out);if(existed){const old=path.join(backup,rel);fs.mkdirSync(path.dirname(old),{recursive:true});fs.copyFileSync(out,old);}records.push({path:rel,existed});fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,data);}
 fs.writeFileSync(path.join(backup,'restore-manifest.json'),JSON.stringify(records,null,2));console.log('3.12.1增量补丁已合并。备份: '+backup);console.log('Agent主体、Worker入口、wrangler.jsonc、迁移文件及密钥配置保持原样。');console.log('在原项目运行: npm test, npm run test:components, npm run build。之后再提交GitHub。');console.log('没有部署，也没有操作远程数据库。管理端首次访问会自动创建3张附加表，不修改原表。');
}catch(e){for(const record of records.reverse()){const out=destination(record.path);try{if(record.existed)fs.copyFileSync(path.join(backup,record.path),out);else if(fs.existsSync(out))fs.unlinkSync(out);}catch{console.error('请从备份恢复: '+record.path);}}console.error('应用失败，已尝试回退: '+e.message);process.exitCode=1;}
