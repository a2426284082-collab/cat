import { build } from 'esbuild';
import {fileURLToPath} from 'node:url';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { unlinkSync,readFileSync } from 'node:fs';
const output=new URL('../test/.sales-components.generated.mjs',import.meta.url);
try{
  await build({entryPoints:[fileURLToPath(new URL('../test/sales-components.test.jsx',import.meta.url))],outfile:fileURLToPath(output),bundle:true,platform:'node',format:'esm',packages:'external',define:{'import.meta.env.VITE_SALES_MODE':'"false"'},loader:{'.css':'empty'},plugins:[{name:'raw-content',setup(build){build.onResolve({filter:/\?raw$/},args=>({path:resolve(args.resolveDir,args.path.replace(/\?raw$/,'')),namespace:'raw-content'}));build.onLoad({filter:/.*/,namespace:'raw-content'},args=>({contents:'export default '+JSON.stringify(readFileSync(args.path,'utf8')),loader:'js'}));}}]});
  const result=spawnSync(process.execPath,['--import',new URL('../test/dom-setup.mjs',import.meta.url).href,'--test',...process.argv.slice(2),fileURLToPath(output)],{stdio:'inherit'});process.exitCode=result.status??1;
}finally{try{unlinkSync(output);}catch{}}
