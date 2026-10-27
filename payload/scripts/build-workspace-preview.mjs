import {build} from 'esbuild';
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),publicRoot=resolve(root,'public');
const placeholder='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="390" viewBox="0 0 720 390"><rect width="720" height="390" rx="18" fill="#f4eadb"/><rect x="90" y="65" width="540" height="260" rx="16" fill="white" stroke="#d3bda3"/><rect x="122" y="100" width="200" height="20" rx="6" fill="#c2a07d"/><rect x="122" y="148" width="476" height="90" rx="9" fill="#eee0cc"/><rect x="122" y="260" width="290" height="12" rx="5" fill="#ded0b9"/><text x="360" y="198" text-anchor="middle" font-size="18" font-family="sans-serif" fill="#916d46">操作示意素材 · 正式页面保留原图</text></svg>');
function imageURL(url){
 if(url.startsWith('/training-assets/'))return placeholder;
 if(!url.startsWith('/ui-assets/'))return url;
 const file=resolve(publicRoot,'.'+url);if(!file.startsWith(publicRoot)||!existsSync(file))return url;
 const type={'.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml'}[extname(file)];
 return type?'data:'+type+';base64,'+readFileSync(file).toString('base64'):url;
}
function embed(text){return text.replace(/(?:\/ui-assets\/|\/training-assets\/)[A-Za-z0-9_.-]+/g,imageURL);}
const result=await build({entryPoints:[resolve(root,'src/workspace/preview.jsx')],absWorkingDir:root,bundle:true,write:false,outfile:'preview.js',platform:'browser',format:'iife',minify:true,
 define:{'import.meta.env.VITE_SALES_MODE':'"false"','process.env.NODE_ENV':'"production"'},loader:{'.css':'empty'},
 plugins:[{name:'raw-learning-content',setup(build){build.onResolve({filter:/\?raw$/},args=>({path:resolve(args.resolveDir,args.path.replace(/\?raw$/,'')),namespace:'raw'}));build.onLoad({filter:/.*/,namespace:'raw'},args=>({contents:'export default '+JSON.stringify(embed(readFileSync(args.path,'utf8'))),loader:'js'}));}}],
});
const js=embed(result.outputFiles.find(f=>f.path.endsWith('.js')).text);
const cssFiles=readdirSync(resolve(root,'dist/assets')).filter(name=>/^index-.*\.css$/.test(name));
if(!cssFiles.length)throw new Error('Run npm run build first');
const css=cssFiles.map(file=>readFileSync(resolve(root,'dist/assets',file),'utf8')).join('\n')+'\n'+readFileSync(resolve(root,'src/workspace/workspace.css'),'utf8');
// Illustrations are only demo placeholders; the deployed catalogue uses real photos.
const portraits=['#d3c2ab','#c9a66b','#a9a89c','#b6a397'].map((coat,index)=>'data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="580" viewBox="0 0 640 580"><rect width="640" height="580" fill="${['#e8ddcc','#ebe0ca','#e0dfd4','#e5d9ca'][index]}"/><path d="M182 580C175 471 213 420 253 402L387 402C430 428 465 487 458 580" fill="${coat}"/><path d="M201 242L196 100L277 172Q320 156 363 172L444 100L439 242Q468 290 451 348C439 404 388 440 320 442C251 440 201 405 189 348Q172 290 201 242Z" fill="${coat}" stroke="#7c6750" stroke-width="3" stroke-linejoin="round"/><path d="M211 216L211 136L263 183M429 216L429 136L377 183" fill="#e6c5ad" stroke="#9c8166" stroke-width="2"/><path d="M270 351Q320 318 370 351L374 386Q320 421 266 386Z" fill="#f7f0e4"/><ellipse cx="264" cy="285" rx="27" ry="31" fill="#f8f3e9"/><ellipse cx="376" cy="285" rx="27" ry="31" fill="#f8f3e9"/><ellipse cx="266" cy="285" rx="14" ry="24" fill="${index===0?'#809aa1':'#8f946d'}"/><ellipse cx="374" cy="285" rx="14" ry="24" fill="${index===0?'#809aa1':'#8f946d'}"/><ellipse cx="267" cy="284" rx="7" ry="20" fill="#4a4034"/><ellipse cx="373" cy="284" rx="7" ry="20" fill="#4a4034"/><circle cx="270" cy="275" r="4" fill="#fff9ec"/><circle cx="376" cy="275" r="4" fill="#fff9ec"/><path d="M307 342L320 353L333 342Z" fill="#bb8b75"/><path d="M320 354V369M320 369Q309 380 297 371M320 369Q331 380 343 371M250 350L140 333M247 365L130 375M390 350L500 333M393 365L510 375" stroke="#8a725a" stroke-width="2" fill="none" stroke-linecap="round"/><text x="320" y="538" text-anchor="middle" fill="#8f7960" font-size="13" letter-spacing="5" font-family="Georgia,serif">PETCLOUD / SPECIMEN 0${index+1}</text></svg>`));
const image=portraits[0];
const banner='.workspace-preview-banner{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:#e3d5bf;border-bottom:1px solid #c4aa87;color:#674731;padding:9px 22px;font:12px system-ui,sans-serif}.workspace-preview-banner>span{margin-right:auto}.workspace-preview-banner button{border:0;border-radius:2px;background:#fff9;padding:5px 10px;color:#674731;font:inherit;cursor:pointer}';
const output=resolve(root,'../sales-workspace-clear-preview.html');
writeFileSync(output,`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>销售工作台 · 清晰版预览</title><style>${css}\n${banner}</style></head><body><div id="root"></div><script>globalThis.WORKSPACE_PREVIEW_IMAGE=${JSON.stringify(image)};globalThis.WORKSPACE_PREVIEW_IMAGES=${JSON.stringify(portraits)};${js.replace(/<\/script/gi,'<\\/script')}</script></body></html>`);
console.log(output);
