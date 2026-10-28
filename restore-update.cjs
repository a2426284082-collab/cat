'use strict';
const fs=require('node:fs'),path=require('node:path');
const targetArg=process.argv[2],backupArg=process.argv[3];if(!targetArg||!backupArg){console.error('用法: node restore-update.cjs "原项目路径" "更新器显示的备份路径"');process.exit(1);}
try{const target=fs.realpathSync(path.resolve(targetArg)),backup=fs.realpathSync(path.resolve(backupArg)),prefix=path.join(target,'workspace-backups')+path.sep;if(!backup.startsWith(prefix))throw new Error('请选择该项目workspace-backups内的备份');const manifest=JSON.parse(fs.readFileSync(path.join(backup,'restore-manifest.json'),'utf8')),plan=[];
 for(const row of manifest){if(typeof row.path!=='string'||path.isAbsolute(row.path)||row.path.split(/[\\/]/).includes('..'))throw new Error('无效备份路径');const out=path.resolve(target,row.path);if(!out.startsWith(target+path.sep))throw new Error('路径越界');for(let p=out;p!==target;p=path.dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw new Error('不写入符号链接');plan.push({out,data:row.existed?fs.readFileSync(path.join(backup,row.path)):null});}
 for(const row of plan){if(row.data===null){if(fs.existsSync(row.out))fs.unlinkSync(row.out);}else{fs.mkdirSync(path.dirname(row.out),{recursive:true});fs.writeFileSync(row.out,row.data);}}console.log('已恢复到本次增量更新前的源文件；没有修改线上数据库。之后请重新构建。');
}catch(e){console.error('恢复失败: '+e.message);process.exitCode=1;}
