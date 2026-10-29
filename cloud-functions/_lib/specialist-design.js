// Professional graphic-design specialist. It never parses coat color/price/age.
// Generating a preview is distinct from downloading a file.
const noFrame=/(?:无黑框|不带黑框|不要黑框|去掉黑框|去黑框|没有黑框|无边框|无框拼图|不带黑边|不要黑边|去掉黑边)/;
const hidePrice=/(?:不显示|不带|不要|隐藏|去掉)(?:价格|价签|售价)/;
export function designBrief({goal='',params={}}={}){
 const text=String(goal||'').normalize('NFKC');
 if(!params||typeof params!=='object'||Array.isArray(params))throw new Error('图片参数必须为对象');
 const settings={...params};
 if(noFrame.test(text))settings.borderless=true;
 if(hidePrice.test(text))settings.includePrices=false;
 if(/(?:微信|朋友圈)/.test(text)&&!Object.hasOwn(settings,'platform'))settings.platform='moments';
 return {specialist:'design',settings};
}
export function validateDesignSelection({ids,catalog,requirePhoto=true}){
 if(!Array.isArray(ids)||ids.length<2||ids.length>9||new Set(ids).size!==ids.length)throw new Error('拼图需要2至9只不同猫咪');
 const stock=new Map(catalog.map(c=>[String(c.id).toUpperCase(),c]));
 const checked=ids.map(id=>stock.get(String(id).toUpperCase()));
 if(checked.some(cat=>!cat||cat.status&&cat.status!=='在售'||requirePhoto&&!cat.image))throw new Error('图片模块拒绝无效、下架或缺少照片的猫咪');
 return {specialist:'design',verified:true,cat_ids:[...ids],stage:'ready_for_render'};
}
export function designReceipt(status){
 if(status==='rendered')return {specialist:'design',stage:'rendered',verified:true};
 if(status==='download_requested')return {specialist:'design',stage:'download_requested',verified:false};
 return {specialist:'design',stage:'ready_for_render',verified:false};
}
