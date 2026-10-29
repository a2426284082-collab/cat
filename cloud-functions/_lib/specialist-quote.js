// Professional pricing specialist. Uses the existing TWO-layer business model:
// Feishu catalog 'price' is the site's base price; the salesperson's markup
// is applied ONCE. No price-based exclusion and no guessing freight.
export function quoteOne(cat,{markup=0,override=null}={}){
 if(!cat||cat.price===null||cat.price===undefined||cat.price==='')throw new Error('缺少网站合作基准价');
 const base=Number(cat.price),plus=Number(markup);
 if(!Number.isFinite(base)||base<0||!Number.isFinite(plus)||plus<0||plus>100000)throw new Error('报价参数不合法');
 let customer=base+plus;
 if(override!==null&&override!==undefined){
  const requested=Number(override);
  if(!Number.isFinite(requested)||requested<base)throw new Error('报价低于网站合作基准价，已阻止');
  customer=requested;
 }
 return Object.freeze({id:String(cat.id).toUpperCase(),basePrice:base,customerPrice:customer,markup:customer-base,requiresFreightConfirmation:true});
}
export function quoteBatch(cats,{markup=0,overrides={}}={}){
 if(!Array.isArray(cats)||!cats.length||cats.length>9)throw new Error('报价缺少有效猫咪');
 const ids=new Set();return cats.map(cat=>{
  const id=String(cat.id).toUpperCase();if(ids.has(id))throw new Error('报价含有重复猫咪编号');ids.add(id);
  return quoteOne(cat,{markup,override:Object.hasOwn(overrides,id)?overrides[id]:null});
 });
}
