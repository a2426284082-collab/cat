import { readFileSync, writeFileSync } from 'node:fs';
const id=process.argv[2];
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id||'')){
  console.error('用法：npm run sales:configure -- <创建 D1 后返回的真实 database_id>');process.exit(1);
}
const file=new URL('../wrangler.jsonc',import.meta.url),config=JSON.parse(readFileSync(file,'utf8'));
const others=(config.d1_databases||[]).filter(x=>x.binding!=='SALES_DB');
config.d1_databases=[...others,{binding:'SALES_DB',database_name:'cat-sales-auth',database_id:id,migrations_dir:'migrations'}];
writeFileSync(file,JSON.stringify(config,null,2)+'\n');
console.log('已将 SALES_DB 绑定写入 wrangler.jsonc。下一步：npx wrangler d1 migrations apply cat-sales-auth --remote');
