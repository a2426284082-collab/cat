// Local image composition; no model calls, uploads or third-party image proxy.
export const FONT='-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif';
export const DEFAULT_SELLING_POINTS=['真实在售，支持看视频','多种猫咪，资料逐只确认','售后按订单约定'];
export const OPTIONAL_PROMISES=['疫苗接种，终身售后','品种齐全，购宠签约','365天重疾保障'];
export const validPrice=value=>value!==''&&value!=null&&Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=1000000;
export const retailPrice=(cat,markup=800)=>validPrice(cat.price)&&validPrice(markup)?Math.round(Number(cat.price)+Number(markup)):null;
export function pickMarketingCats(cats,exclude=[]){
 const available=[...new Map(cats.filter(c=>c.image&&(!c.status||c.status==='在售')).map(c=>[c.id,c])).values()];
 const size=available.length>=9?9:available.length>=4?4:0;
 if(!size)return [];
 // Randomized, breed-diverse selection uses recorded stock fields, not imagined photo ratings.
 const shuffled=available.map(cat=>({cat,rank:Math.random(),recent:exclude.includes(cat.id)})).sort((a,b)=>Number(a.recent)-Number(b.recent)||a.rank-b.rank);
 const chosen=[],breeds=new Set();
 for(const {cat} of shuffled)if(!breeds.has(cat.breed)){chosen.push(cat);breeds.add(cat.breed);if(chosen.length===size)return chosen;}
 for(const {cat} of shuffled)if(!chosen.includes(cat)){chosen.push(cat);if(chosen.length===size)break;}
 return chosen;
}
export function squareCrop(width,height){const side=Math.min(width,height);return [(width-side)/2,(height-side)/2,side,side];}
export function gridCells(count,width=1080,height=1080,gap=4){
 if(![4,9].includes(count)||width!==1080||![1080,1440].includes(height))throw new Error('请选择4只或9只有照片的猫咪');
 const columns=count===9?3:2,side=(width-gap*(columns-1))/columns,top=(height-width)/2;
 return Array.from({length:count},(_,i)=>({x:(i%columns)*(side+gap),y:top+Math.floor(i/columns)*(side+gap),size:side}));
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
export async function renderMarketingCanvas(canvas,cats,options,{signal,loadImage=loadCanvasImage}={}){
 const width=1080,height=options.height===1440?1440:1080,cells=gridCells(cats.length,width,height);
 if(cats.some(c=>!c.image))throw new Error('所选猫咪缺少照片，请换一只后再生成');
 if(options.template==='price'&&cats.some(c=>!validPrice(options.prices[c.id])))throw new Error('请为每只猫填写有效售价');
 const ctx=canvas.getContext('2d');if(!ctx)throw new Error('当前浏览器不支持图片合成，请用系统浏览器打开');
 canvas.width=width;canvas.height=height;ctx.fillStyle='#FAF8F5';ctx.fillRect(0,0,width,height);
 await document.fonts?.ready;
 // Sequential image decoding bounds peak decoded image memory on mobile.
 for(let i=0;i<cats.length;i++){
  if(signal?.aborted)throw abortError();
  const image=await loadImage(cats[i].image,{signal});if(signal?.aborted)throw abortError();
  const cell=cells[i],crop=squareCrop(image.naturalWidth||image.width,image.naturalHeight||image.height);
  ctx.drawImage(image,...crop,cell.x,cell.y,cell.size,cell.size);image.close?.();
  if(options.template==='price'){
   const text=String(options.prices[cats[i].id]),size=fitText(ctx,text,cell.size-100,cats.length===9?49:66),tw=ctx.measureText(text).width;
   const x=cell.x+(cell.size-tw-58)/2,y=cell.y+cell.size-31;
   const shade=ctx.createLinearGradient(0,y-65,0,cell.y+cell.size);shade.addColorStop(0,'rgba(0,0,0,0)');shade.addColorStop(1,'rgba(0,0,0,.48)');ctx.fillStyle=shade;ctx.fillRect(cell.x,y-65,cell.size,96);
   bag(ctx,x,y-45,47);ctx.textAlign='left';ctx.textBaseline='alphabetic';outlined(ctx,text,x+58,y,size,cell.size-85);
  }
 }
 if(options.template==='sign'){
  const w=870,x=(width-w)/2,y=(height-width)/2+width*.17,h=205;
  ctx.save();ctx.shadowColor='rgba(0,0,0,.25)';ctx.shadowBlur=14;ctx.shadowOffsetY=7;rounded(ctx,x,y,w,h,28);ctx.fillStyle='#FACC15';ctx.fill();ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineWidth=6;ctx.strokeStyle='#1C1917';ctx.stroke();ctx.fillStyle='#1C1917';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`700 23px ${FONT}`;ctx.fillText('✦ BUTTER ✦',width/2,y+38);fitText(ctx,options.shop||'同城靠谱猫舍',w-70,86,30);ctx.fillText(options.shop||'同城靠谱猫舍',width/2,y+121);ctx.restore();
  if(options.city){ctx.textAlign='center';ctx.textBaseline='middle';outlined(ctx,options.city+' · 今日在售',width/2,y+h+62,41,860);}
  options.points.filter(Boolean).slice(0,3).forEach((point,i)=>{const rowY=(height-width)/2+width*.66+i*80;fitText(ctx,point,825,51,24);const textWidth=ctx.measureText(point).width,total=textWidth+59;check(ctx,(width-total)/2,rowY-21,42);ctx.textAlign='left';ctx.textBaseline='middle';outlined(ctx,point,(width-total)/2+59,rowY,51,825);});
 }
 if(height>width){ctx.fillStyle='#7C4A2D';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`600 31px ${FONT}`;ctx.fillText(options.template==='price'?'今日心动猫咪 · 私信看更多照片与视频':(options.city||'')+' '+(options.shop||'同城靠谱猫舍'),540,74);ctx.fillStyle='#78716C';ctx.font=`400 24px ${FONT}`;ctx.fillText('猫咪库存与最终费用，下单前请再次确认',540,height-78);}
 return canvas;
}
export function canvasBlob(canvas){return new Promise((resolve,reject)=>{try{canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('图片导出失败，请重新生成')),'image/png');}catch{reject(new Error('这张照片不允许合成下载，请换用猫源库照片后重试'));}});}
