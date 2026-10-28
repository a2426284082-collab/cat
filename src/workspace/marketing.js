import {isInlineImage,loadPreparedImage} from './media.js';
import {seededShuffle,hashSeed,randomFromSeed} from './distribution.js';
// Local image composition; no model calls, uploads or third-party image proxy.
export const FONT='-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
export const DEFAULT_SELLING_POINTS=['真实在售，支持看视频','多种猫咪，资料逐只确认','售后按订单约定'];
export const validPrice=value=>value!==''&&value!=null&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000000;
export const retailPrice=(cat,markup=800)=>validPrice(cat.price)&&validPrice(markup)?Math.round(Number(cat.price)+Number(markup)):null;
export function pickMarketingCats(cats,exclude=[]){
 const available=[...new Map(cats.filter(c=>c.image&&(!c.status||c.status==='在售')).map(c=>[String(c.id).replace(/^#+/,'').toUpperCase(),c])).values()];
 const size=Math.min(9,available.length);if(size<2)return [];
 // Draw from the entire photo-backed pool; recent picks are only deprioritized on an explicit batch change.
 const random=seededShuffle(available,randomSeed()),recent=new Set(exclude),pool=[...random.filter(c=>!recent.has(c.id)),...random.filter(c=>recent.has(c.id))],chosen=[],breeds=new Set();
 for(const cat of pool)if(!breeds.has(cat.breed)){chosen.push(cat);breeds.add(cat.breed);if(chosen.length===size)break;}
 for(const cat of pool)if(chosen.length<size&&!chosen.includes(cat))chosen.push(cat);
 return seededShuffle(chosen,randomSeed());
}
export function shufflePhotoOrder(cats,seed=randomSeed()){const shuffled=seededShuffle(cats,seed);if(shuffled.length>1&&shuffled.every((cat,i)=>cat.id===cats[i].id))shuffled.push(shuffled.shift());return shuffled;}
export function squareCrop(width,height){const side=Math.min(width,height);return [(width-side)/2,(height-side)/2,side,side];}
export const POSTER_BACKGROUNDS=['#FAF8F5','#F3EAE0','#FDF2F8','#F0FDF4','#FEFCE8','#18181B','#271C19','#FFFFFF'];
export const POSTER_GAPS=[0,8,14,20],POSTER_RADII=[0,12,24];
export const PRICE_TAG_NAMES=['实心胶囊','相纸底栏','折角便签','聊天气泡','斜角丝带','描边大字'];
export function generateDesign(seed=randomSeed()){
 const random=randomFromSeed(seed),pick=items=>items[Math.floor(random()*items.length)],background=pick(POSTER_BACKGROUNDS),dark=['#18181B','#271C19'].includes(background);
 const palette=dark?pick([{fill:'#FACC15',ink:'#1C1917',stroke:'#FDE68A'},{fill:'#F5EBE1',ink:'#7C4A2D',stroke:'#D4AF37'}]):pick([{fill:'#1C1917',ink:'#FACC15',stroke:'#1C1917'},{fill:'#7C4A2D',ink:'#FFFFFF',stroke:'#9A6747'},{fill:'#9D4767',ink:'#FFFFFF',stroke:'#783550'},{fill:'#E7F3E6',ink:'#28533C',stroke:'#5F8064'}]);
 return {seed,background,gap:pick(POSTER_GAPS),radius:pick(POSTER_RADII),tagShape:Math.floor(random()*6),tagPosition:pick(['left','center','right']),corner:pick(['left','right']),palette,bannerFill:dark?palette.fill:'#FFFDF7',bannerInk:dark?palette.ink:'#292524',bannerStroke:palette.stroke,bannerDashed:random()<.5,bannerRadius:pick([4,18,32]),bannerPosition:pick(['top','middle'])};
}
export function mirroredPhoto(id,designSeed){return hashSeed(String(designSeed)+'|mirror|'+String(id))<2147483648;}
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
 for(const [columns,weight] of rows){const h=rowSpace*weight,w=(area-gap*(columns-1))/columns;for(let column=0;column<columns;column++){const x=inset+column*(w+gap),left=Math.round(x),top=Math.round(y);cells.push({x:left,y:top,width:Math.round(x+w)-left,height:Math.round(y+h)-top});}y+=h+gap;}
 return cells;
}
export function coverCrop(imageWidth,imageHeight,cellWidth,cellHeight,{zoom=1,dx=0,dy=0}={}){
 if(![imageWidth,imageHeight,cellWidth,cellHeight,zoom].every(n=>Number.isFinite(n)&&n>0))throw new Error('照片尺寸无效');
 const ratio=cellWidth/cellHeight;let width=imageWidth,height=width/ratio;
 if(height>imageHeight){height=imageHeight;width=height*ratio;}width/=zoom;height/=zoom;
 return [Math.max(0,Math.min(imageWidth-width,(imageWidth-width)/2+dx)),Math.max(0,Math.min(imageHeight-height,(imageHeight-height)/2+dy)),width,height];
}
export function marketingDraft(cats,{template,city='',shop='同城靠谱猫舍',prices,platform='xhs',points=DEFAULT_SELLING_POINTS,bannerEnabled=false,bannerText=''}){
 const breeds=[...new Set(cats.map(c=>c.breed).filter(Boolean))].join(' / ');
 const title=template==='sign'?`🐾 ${city}${shop}｜来看看今天在售的小猫`:'🐾 今日猫咪图鉴｜把心动的小猫带回家';
 const quote=template==='price'?cats.map((c,i)=>`${i+1}. ${c.breed||'猫咪'} ${prices[c.id]==null?'私聊确认价格':'¥'+prices[c.id]}`).join('\n'):points.map(p=>'✅ '+p).join('\n');
 return `${title}${bannerEnabled&&bannerText?'\n'+bannerText:''}\n\n${breeds}\n${quote}\n\n喜欢哪只可以私信我，发你对应照片和视频，库存与最终费用下单前确认。${platform==='xhs'?`\n\n#猫咪 #选猫日记 #猫咪日常${city?' #'+city+'猫咪':''}`:''}`;
}
function abortError(){return new DOMException('已取消','AbortError');}
export function loadCanvasImage(src,{signal}={}){
 if(!isInlineImage(src))return loadPreparedImage(src,{signal});
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(abortError());return;}
  const image=new Image();image.crossOrigin='anonymous';image.decoding='async';
  const timer=setTimeout(()=>done(new Error('照片加载超时，请换图或重试')),20000);
  const abort=()=>{done(abortError());image.src='';};
  function done(error){clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=null;image.onerror=null;error?reject(error):resolve(image);}
  image.onload=()=>{if(image.naturalWidth&&image.naturalHeight){image.close=()=>{image.src='';};done();}else done(new Error('照片尺寸无效'));};
  image.onerror=()=>done(new Error('照片无法读取，请刷新猫源或更换照片后重试'));
  signal?.addEventListener('abort',abort,{once:true});image.src=src;
 });
}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function fitText(ctx,text,maxWidth,size,min=20){ctx.font=`700 ${size}px ${FONT}`;while(size>min&&ctx.measureText(text).width>maxWidth){size-=2;ctx.font=`700 ${size}px ${FONT}`;}return size;}
function imageTile(ctx,image,cell,variation,radius=0,mirror=false){
 ctx.save();rounded(ctx,cell.x,cell.y,cell.width,cell.height,radius);ctx.clip();
 const crop=coverCrop(image.naturalWidth||image.width,image.naturalHeight||image.height,cell.width,cell.height,variation);
 if(mirror){ctx.translate(cell.x*2+cell.width,0);ctx.scale(-1,1);}ctx.drawImage(image,...crop,cell.x,cell.y,cell.width,cell.height);ctx.restore();
}
function tagLeft(cell,width,position){return position==='right'?cell.x+cell.width-width-13:position==='center'?cell.x+(cell.width-width)/2:cell.x+13;}
function priceTag(ctx,cat,price,cell,design,variation){
 const {tagShape:shape,palette,tagPosition:position}=design,text='¥ '+price,size=Math.min(64,Math.max(32,cell.width*.13));
 ctx.save();rounded(ctx,cell.x,cell.y,cell.width,cell.height,design.radius);ctx.clip();ctx.textBaseline='middle';ctx.textAlign='left';
 if(shape===1){
  const h=Math.min(68,cell.height*.23),y=cell.y+cell.height-h;ctx.fillStyle='#FFFFFF';ctx.fillRect(cell.x,y,cell.width,h);ctx.fillStyle='#3F352D';fitText(ctx,(cat.breed||'猫咪')+' · '+text,cell.width-24,Math.min(33,h*.52),18);ctx.fillText((cat.breed||'猫咪')+' · '+text,cell.x+12,y+h/2);ctx.restore();return;
 }
 if(shape===5){
  const font=fitText(ctx,text,cell.width-28,size),tw=ctx.measureText(text).width,x=tagLeft(cell,tw,position),y=cell.y+cell.height-38;
  ctx.lineJoin='round';ctx.lineWidth=6+variation.borderDelta;ctx.strokeStyle='#1C1917';ctx.fillStyle='#FFFFFF';ctx.strokeText(text,x,y);ctx.fillText(text,x,y);ctx.restore();return;
 }
 if(shape===4){
  const right=design.corner==='right',cx=right?cell.x+cell.width-57:cell.x+57,cy=cell.y+57;ctx.translate(cx,cy);ctx.rotate((right?1:-1)*Math.PI/4);ctx.fillStyle=palette.fill;ctx.fillRect(-130,-25,260,50);ctx.strokeStyle=palette.stroke;ctx.lineWidth=1+variation.borderDelta*.4;ctx.strokeRect(-130,-25,260,50);fitText(ctx,text,158,31,18);ctx.textAlign='center';ctx.fillStyle=palette.ink;ctx.fillText(text,0,1);ctx.restore();return;
 }
 const label=shape===2?'售价 '+price:shape===3?'售价 '+text:text;
 const font=fitText(ctx,label,cell.width-57,size,22),width=ctx.measureText(label).width+28,height=font+24,x=tagLeft(cell,width,position),y=cell.y+cell.height-height-(shape===3?26:14);
 ctx.shadowColor='rgba(0,0,0,.16)';ctx.shadowBlur=5;ctx.shadowOffsetY=3;rounded(ctx,x,y,width,height,shape===2?3:shape===3?15:height/2);ctx.fillStyle=shape===2?'#FFFADE':palette.fill;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=shape===2?palette.stroke:palette.fill;ctx.lineWidth=1.4+variation.borderDelta*.5;ctx.stroke();
 if(shape===2){ctx.fillStyle='#EADDA7';ctx.beginPath();ctx.moveTo(x+width-17,y);ctx.lineTo(x+width,y+17);ctx.lineTo(x+width-17,y+17);ctx.closePath();ctx.fill();}
 if(shape===3){ctx.beginPath();ctx.moveTo(x+21,y+height-1);ctx.lineTo(x+36,y+height-1);ctx.lineTo(x+24,y+height+12);ctx.closePath();ctx.fill();}
 ctx.fillStyle=shape===2?'#594635':palette.ink;ctx.fillText(label,x+14,y+height/2);ctx.restore();
}
function bannerLines(ctx,text,width){let lines=[''];for(const character of [...text].slice(0,60)){const index=lines.length-1;if(ctx.measureText(lines[index]+character).width>width&&lines[index])lines.push(character);else lines[index]+=character;}return lines;}
function drawBanner(ctx,width,height,options,design){
 const text=String(options.bannerText||options.shop||'同城靠谱猫舍').trim(),w=920,x=(width-w)/2,y=(height-width)/2+(design.bannerPosition==='top'?105:350);
 ctx.save();let font=47;ctx.font=`700 ${font}px ${FONT}`;let lines=bannerLines(ctx,text,w-70);while(lines.length>3&&font>30){font-=2;ctx.font=`700 ${font}px ${FONT}`;lines=bannerLines(ctx,text,w-70);}const lineHeight=font+10,h=57+lines.length*lineHeight;ctx.shadowColor='rgba(0,0,0,.2)';ctx.shadowBlur=12;ctx.shadowOffsetY=5;rounded(ctx,x,y,w,h,design.bannerRadius);ctx.fillStyle=design.bannerFill;ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.strokeStyle=design.bannerStroke;ctx.lineWidth=4;ctx.setLineDash(design.bannerDashed?[12,7]:[]);ctx.stroke();ctx.setLineDash([]);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=design.bannerInk;lines.forEach((line,i)=>ctx.fillText(line,width/2,y+34+i*lineHeight+font/2));ctx.restore();
}
export async function renderMarketingCanvas(canvas,cats,options,{signal,loadImage=loadCanvasImage,onProgress}={}){
 if(!validPhotoCount(cats.length))throw new Error('请选择2至9只有照片的猫咪');
 const width=1080,height=options.height===1440?1440:1080,design=options.design||generateDesign(options.seed??randomSeed()),variation=createVariation(cats.length,options.seed??randomSeed()),cells=gridCells(cats.length,width,height,design.gap,design.gap);
 if(cats.some(c=>!c.image))throw new Error('所选猫咪缺少照片，请换一只后再生成');
 const includePrices=options.includePrices??options.template!=='sign';
 if(includePrices&&cats.some(c=>!validPrice(options.prices?.[c.id])))throw new Error('请为每只猫填写有效售价');
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器不支持图片合成，请用系统浏览器打开');
 canvas.width=width;canvas.height=height;ctx.fillStyle=design.background;ctx.fillRect(0,0,width,height);
 for(let i=0;i<cats.length;i++){
  onProgress?.(i,cats.length);
  if(signal?.aborted)throw abortError();
  const image=await loadImage(cats[i].image,{signal});if(signal?.aborted){image.close?.();throw abortError();}
  try{const cell=cells[i],v=variation.photos[i],photo=includePrices&&design.tagShape===1?{...cell,height:cell.height-Math.min(68,cell.height*.23)}:cell;
   imageTile(ctx,image,photo,v,design.radius,options.mirrorEnabled!==false&&mirroredPhoto(cats[i].id,design.seed));
   if(includePrices)priceTag(ctx,cats[i],options.prices[cats[i].id],cell,design,v);
  }finally{image.close?.();}
 }
 onProgress?.(cats.length,cats.length);
 if(options.bannerEnabled)drawBanner(ctx,width,height,options,design);
 if(height>width){const dark=['#18181B','#271C19'].includes(design.background);ctx.fillStyle=dark?'#F5EBE1':'#7C4A2D';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 31px ${FONT}`;ctx.fillText(options.shop||'今日心动猫咪 · 私信看更多照片与视频',540,74);ctx.fillStyle=dark?'#C4B99B':'#78716C';ctx.font=`400 24px ${FONT}`;ctx.fillText('猫咪库存与最终费用，下单前请再次确认',540,height-78);}
 return canvas;
}
export function canvasBlob(canvas){return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片导出失败，请重新生成')),'image/png');}catch{reject(new Error('这张照片不允许合成下载，请换用猫源库照片后重试'));}});}
