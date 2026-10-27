import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { unlinkSync } from 'node:fs';
const output=new URL('../test/.sales-components.generated.mjs',import.meta.url);
try{
  await build({entryPoints:[new URL('../test/sales-components.test.jsx',import.meta.url).pathname],outfile:output.pathname,bundle:true,platform:'node',format:'esm',packages:'external',loader:{'.css':'empty'}});
  const result=spawnSync(process.execPath,['--test',output.pathname],{stdio:'inherit'});process.exitCode=result.status??1;
}finally{try{unlinkSync(output);}catch{}}
