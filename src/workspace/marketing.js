// Local image composition; no model calls, uploads or third-party image proxy.
export const FONT='-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
export const DEFAULT_SELLING_POINTS=['真实在售，支持看视频','多种猫咪，资料逐只确认','售后按订单约定'];
export const OPTIONAL_PROMISES=['疫苗接种，终身售后','品种齐全，购宠签约','365天重疾保障'];
export const validPrice=value=>value!==''&&value!=null&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000000;
export const retailPrice=(cat,markup=800)=>validPrice(cat.price)&&validPrice(markup)?Math.round(Number(cat.price)+Number(markup)):null;
export function pickMarketingCats(cats,exclude=[]){
 const available=[...new Map(cats.filter(c=>c.image&&(!c.status||c.status==='在售')).map(c=>[c.id,c])).values()];
 const size=available.length>=2?Math.min(9,available.length):0;
 if(!size)return [];
 // Randomized, breed-diverse selection uses recorded stock fields, not imagined photo ratings.
 const shuffled=available.map(cat=>({cat,rank:Math.random(),recent:exclude.includes(cat.id)})).sort((a,b)=>Number(a.recent)-Number(b.recent)||a.rank-b.rank);
 const chosen=[],breeds=new Set();
 for(const {cat} of shuffled)if(!breeds.has(cat.breed)){chosen.push(cat);breeds.add(cat.breed);if(chosen.length===size)return chosen;}
 for(const {cat} of shuffled)if(!chosen.includes(cat)){chosen.push(cat);if(chosen.length===size)break;}
 return chosen;
}
export function squareCrop(width,height){const side=Math.min(width,height);return [(width-side)/2,(height-side)/2,side,side];}
export const POSTER_SKINS=[
 {id:'classic',name:'经典爆款',background:'#FFFFFF',gap:4,inset:0,radius:0},
 {id:'cream',name:'奶油杂志',background:'#F5EBE1',gap:24,inset:42,radius:22},
 {id:'blackgold',name:'潮酷黑金',background:'#1C1917',gap:20,inset:30,radius:4},
 {id:'polaroid',name:'拍立得手账',background:'#E9DED0',gap:25,inset:46,radius:0},
 {id:'local',name:'同城大字报',background:'#FFFFFF',gap:4,inset:0,radius:0},
];
export const validPhotoCount=count=>Number.isInteger(count)&&count>=2&&count<=9;
export function randomSeed(){const bytes=new Uint32Array(1);globalThis.crypto.getRandomValues(bytes);return bytes[0];}
function seededRandom(seed){return ()=>{seed+=0x6D2B79F5;let n=seed;n=Math.imul(n^n>>>15,n|1);n^=n+Math.imul(n^n>>>7,n|61);return ((n^n>>>14)>>>0)/4294967296;};}
export function createVariation(count,seed=randomSeed()){
 const random=seededRandom(seed),signed=()=> (2+2*random())*(random()<.5?-1:1);
 return {seed,gapDelta:random()*1.4-.7,photos:Array.from({length:count},()=>({zoom:1.01+.02*random(),dx:signed(),dy:signed(),rotation:(random()*3-1.5)*Math.PI/180,borderDelta:random()*1.6-.8}))};
}
const rowsByCount={2:[[2,1]],3:[[1,.56],[2,.44]],4:[[2,.5],[2,.5]],5:[[2,.55],[3,.45]],6:[[3,.5],[3,.5]],7:[[1,.44],[3,.28],[3,.28]],8:[[2,.38],[3,.31],[3,.31]],9:[[3,1/3],[3,1/3],[3,1/3]]};
export function gridCells(count,width=1080,height=1080,gap=4,inset=0){
 if(!validPhotoCount(count)||width!==1080||![1080,1440].includes(height))throw new Error('请选择2至9只有照片的猫咪');
 const rows=rowsByCount[count],area=width-2*inset,rowSpace=area-gap*(rows.length-1),cells=[];let y=(height-width)/2+inset;
 for(const [columns,weight] of rows){const h=rowSpace*weight,w=(area-gap*(columns-1))/columns;for(let column=0;column<columns;column++)cells.push({x:inset+column*(w+gap),y,width:w,height:h});y+=h+gap;}
 return cells;
}
export function coverCrop(imageWidth,imageHeight,cellWidth,cellHeight,{zoom=1,dx=0,dy=0}={}){
 if(![imageWidth,imageHeight,cellWidth,cellHeight,zoom].every(n=>Number.isFinite(n)&&n>0))throw new Error('照片尺寸无效');
 const ratio=cellWidth/cellHeight;let width=imageWidth,height=width/ratio;
 if(height>imageHeight){height=imageHeight;width=height*ratio;}width/=zoom;height/=zoom;
 return [Math.max(0,Math.min(imageWidth-width,(imageWidth-width)/2+dx)),Math.max(0,Math.min(imageHeight-height,(imageHeight-height)/2+dy)),width,height];
}
export function marketingDraft(cats,{template,city='',shop='同城靠谱猫舍',prices,platform='xhs',points=DEFAULT_SELLING_POINTS}){
 const breeds=[...new Set(cats.map(c=>c.breed).filter(Boolean))].join(' / ');
 const title=template==='sign'?`🐾 ${city}${shop}｜来看看今天在售的小猫`:'🐾 今日猫咪图鉴｜把心动的小猫带回家';
 const quote=template==='price'?cats.map((c,i)=>`${i+1}. ${c.breed||'猫咪'} ${prices[c.id]==null?'私聊确认价格':'¥'+prices[c.id]}`).join('\n'):points.map(p=>'✅ '+p).join('\n');
 return `${title}\n\n${breeds}\n${quote}\n\n喜欢哪只可以私信我，发你对应照片和视频，库存与最终费用下单前确认。${platform==='xhs'?`\n\n#猫咪 #选猫日记 #猫咪日常${city?' #'+city+'猫咪':''}`:''}`;
}
function abortError(){return new DOMException('已取消','AbortError');}
export function loadCanvasImage(src,{signal}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return;}
  const image=new Image();image.crossOrigin='anonymous';image.decoding='async';
  const timer=setTimeout(()=>done(new Error('照片加载超时，请换图或重试')),20000);
  const abort=()=>{done(abortError());image.src='';};
  function done(error){clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=null;image.onerror=null;error?reject(error):resolve(image);}
  image.onload=()=>image.naturalWidth&&image.naturalHeight?done():done(new Error('照片尺寸无效'));
  image.onerror=()=>done(new Error('照片无法读取，请刷新猫源或更换照片后重试'));
  signal?.addEventListener('abort',abort,{once:true});image.src=src;
 });
}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function fitText(ctx,text,maxWidth,size,min=20){ctx.font=`700 ${size}px ${FONT}`;while(size>min&&ctx.measureText(text).width>maxWidth){size-=2;ctx.font=`700 ${size}px ${FONT}`;}return size;}
function outlined(ctx,text,x,y,size,maxWidth){fitText(ctx,text,maxWidth,size);ctx.lineJoin='round';ctx.lineWidth=7;ctx.strokeStyle='#1C1917';ctx.fillStyle='#fff';ctx.strokeText(text,x,y);ctx.fillText(text,x,y);}
// Drawn money bag and checkmark avoid platform-dependent emoji glyph failures in exported PNGs.
function bag(ctx,x,y,size){ctx.save();ctx.translate(x,y);ctx.scale(size/50,size/50);ctx.shadowColor='rgba(0,0,0,.35)';ctx.shadowBlur=3;ctx.fillStyle='#FACC15';ctx.strokeStyle='#78350F';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(16,11);ctx.lineTo(12,2);ctx.lineTo(24,5);ctx.lineTo(36,2);ctx.lineTo(32,12);ctx.bezierCurveTo(52,30,45,48,25,48);ctx.bezierCurveTo(5,48,-2,30,16,11);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(15,13);ctx.lineTo(33,13);ctx.stroke();ctx.font=`700 24px ${FONT}`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#92400E';ctx.fillText('¥',25,32);ctx.restore();}
function check(ctx,x,y,size){ctx.save();ctx.fillStyle='#16A34A';rounded(ctx,x,y,size,size,7);ctx.fill();ctx.strokeStyle='white';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x+size*.23,y+size*.52);ctx.lineTo(x+size*.43,y+size*.73);ctx.lineTo(x+size*.79,y+size*.26);ctx.stroke();ctx.restore();}
function imageTile(ctx,image,cell,variation,radius=0){
 ctx.save();rounded(ctx,cell.x,cell.y,cell.width,cell.height,radius);ctx.clip();
 const crop=coverCrop(image.naturalWidth||image.width,image.naturalHeight||image.height,cell.width,cell.height,variation);
 ctx.drawImage(image,...crop,cell.x,cell.y,cell.width,cell.height);ctx.restore();
}
function priceSticker(ctx,price,cell,skin,variation){
 const text=String(price),size=Math.min(66,Math.max(37,cell.width*.14)),left=cell.x+14,bottom=cell.y+cell.height-17;
 ctx.save();ctx.textBaseline='alphabetic';ctx.textAlign='left';
 if(skin.id==='classic'){
  const font=fitText(ctx,text,cell.width-89,size),tw=ctx.measureText(text).width,x=cell.x+(cell.width-tw-53)/2,y=bottom-5;
  const shade=ctx.createLinearGradient(0,y-75,0,cell.y+cell.height);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.46)');ctx.fillStyle=shade;ctx.fillRect(cell.x,y-75,cell.width,cell.height-(y-75-cell.y));bag(ctx,x,y-42,43);outlined(ctx,text,x+53,y,font,cell.width-80);
 }else if(skin.id==='cream'){
  fitText(ctx,'¥ '+text,cell.width-68,size-3,24);const w=ctx.measureText('¥ '+text).width+34,h=size+23;rounded(ctx,left,bottom-h+7,w,h,Math.min(h/2,29));ctx.fillStyle='#7C4A2D';ctx.fill();ctx.fillStyle='#FFF9F0';ctx.fillText('¥ '+text,left+17,bottom-7);
 }else if(skin.id==='blackgold'){
  fitText(ctx,'¥ '+text,cell.width-62,size,24);const w=ctx.measureText('¥ '+text).width+30,h=size+25;ctx.fillStyle='rgba(28,25,23,.94)';ctx.fillRect(left,bottom-h+5,w,h);ctx.strokeStyle='#D4AF37';ctx.lineWidth=1.5+variation.borderDelta;ctx.strokeRect(left,bottom-h+5,w,h);ctx.fillStyle='#F4D988';ctx.fillText('¥ '+text,left+15,bottom-9);
 }
 ctx.restore();
}
function goldCorners(ctx,cell,variation){
 ctx.save();ctx.strokeStyle='#D4AF37';ctx.lineWidth=2.8+variation.borderDelta;const d=24;
 for(const [x,y,sx,sy] of [[cell.x+8,cell.y+8,1,1],[cell.x+cell.width-8,cell.y+8,-1,1],[cell.x+8,cell.y+cell.height-8,1,-1],[cell.x+cell.width-8,cell.y+cell.height-8,-1,-1]]){ctx.beginPath();ctx.moveTo(x,y+sy*d);ctx.lineTo(x,y);ctx.lineTo(x+sx*d,y);ctx.stroke();}ctx.restore();
}
function polaroid(ctx,image,cell,variation,price){
 ctx.save();ctx.translate(cell.x+cell.width/2,cell.y+cell.height/2);ctx.rotate(variation.rotation);ctx.scale(.97,.97);
 const paper={x:-cell.width/2,y:-cell.height/2,width:cell.width,height:cell.height},edge=11+variation.borderDelta,bottom=Math.min(68,cell.height*.23);
 ctx.fillStyle='#FFFFFF';ctx.shadowColor='rgba(61,43,26,.16)';ctx.shadowBlur=9;ctx.shadowOffsetY=4;ctx.fillRect(paper.x,paper.y,paper.width,paper.height);ctx.shadowBlur=0;ctx.shadowOffsetY=0;
 imageTile(ctx,image,{x:paper.x+edge,y:paper.y+edge,width:paper.width-2*edge,height:paper.height-bottom-edge},variation);
 ctx.textAlign='center';ctx.textBaseline='middle';let font=Math.min(48,cell.width*.12);const text='¥ '+price;ctx.font=`600 ${font}px "Kaiti SC","STKaiti","Comic Sans MS",cursive`;while(font>22&&ctx.measureText(text).width>cell.width-30){font-=2;ctx.font=`600 ${font}px "Kaiti SC","STKaiti","Comic Sans MS",cursive`;}ctx.fillStyle='#594635';ctx.fillText(text,0,paper.y+paper.height-bottom/2+2);ctx.restore();
}
function localSign(ctx,width,height,options){
 const w=870,x=(width-w)/2,y=(height-width)/2+width*.17,h=205;
 ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=14;ctx.shadowOffsetY=7;rounded(ctx,x,y,w,h,28);ctx.fillStyle='#FACC15';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineWidth=6;ctx.strokeStyle='#1C1917';ctx.stroke();ctx.fillStyle='#1C1917';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 23px ${FONT}`;ctx.fillText('✦ BUTTER ✦',width/2,y+38);fitText(ctx,options.shop||'同城靠谱猫舍',w-70,86,30);ctx.fillText(options.shop||'同城靠谱猫舍',width/2,y+121);ctx.restore();
 if(options.city){ctx.textAlign='center';ctx.textBaseline='middle';outlined(ctx,options.city+' · 今日在售',width/2,y+h+62,41,860);}
 (options.points||DEFAULT_SELLING_POINTS).filter(Boolean).slice(0,3).forEach((point,i)=>{const rowY=(height-width)/2+width*.66+i*80;fitText(ctx,point,825,51,24);const textWidth=ctx.measureText(point).width,total=textWidth+59;check(ctx,(width-total)/2,rowY-21,42);ctx.textAlign='left';ctx.textBaseline='middle';outlined(ctx,point,(width-total)/2+59,rowY,51,825);});
}
export async function renderMarketingCanvas(canvas,cats,options,{signal,loadImage=loadCanvasImage}={}){
 if(!validPhotoCount(cats.length))throw new Error('请选择2至9只有照片的猫咪');
 const width=1080,height=options.height===1440?1440:1080,skin=POSTER_SKINS.find(s=>s.id===options.skin)||POSTER_SKINS[options.template==='sign'?4:0],variation=createVariation(cats.length,options.seed??randomSeed()),cells=gridCells(cats.length,width,height,skin.gap+variation.gapDelta,skin.inset);
 if(cats.some(c=>!c.image))throw new Error('所选猫咪缺少照片，请换一只后再生成');
 if(skin.id!=='local'&&cats.some(c=>!validPrice(options.prices?.[c.id])))throw new Error('请为每只猫填写有效售价');
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器不支持图片合成，请用系统浏览器打开');
 canvas.width=width;canvas.height=height;ctx.fillStyle=skin.background;ctx.fillRect(0,0,width,height);await document.fonts?.ready;
 for(let i=0;i<cats.length;i++){
  if(signal?.aborted)throw abortError();
  const image=await loadImage(cats[i].image,{signal});if(signal?.aborted){image.close?.();throw abortError();}
  try{const cell=cells[i],v=variation.photos[i];if(skin.id==='polaroid')polaroid(ctx,image,cell,v,options.prices[cats[i].id]);else{imageTile(ctx,image,cell,v,skin.radius);if(skin.id==='blackgold')goldCorners(ctx,cell,v);if(skin.id!=='local')priceSticker(ctx,options.prices[cats[i].id],cell,skin,v);}}
  finally{image.close?.();}
 }
 if(skin.id==='local')localSign(ctx,width,height,options);
 if(height>width){ctx.fillStyle=skin.id==='blackgold'?'#F4D988':'#7C4A2D';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 31px ${FONT}`;ctx.fillText(skin.id!=='local'?'今日心动猫咪 · 私信看更多照片与视频':(options.city||'')+' '+(options.shop||'同城靠谱猫舍'),540,74);ctx.fillStyle=skin.id==='blackgold'?'#C4B99B':'#78716C';ctx.font=`400 24px ${FONT}`;ctx.fillText('猫咪库存与最终费用，下单前请再次确认',540,height-78);}
 return canvas;
}
export function canvasBlob(canvas){return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片导出失败，请重新生成')),'image/png');}catch{reject(new Error('这张照片不允许合成下载，请换用猫源库照片后重试'));}});}
