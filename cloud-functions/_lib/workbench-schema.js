export const WORKBENCH_DEFAULTS=Object.freeze({brandName:'猫咪合作平台',brandSubtitle:'合作销售工作台',heroTitle:'把客户需求变成',heroHighlight:'销冠方案',aiPlaceholder:'说出客户预算、月龄、品种和偏好，例如：找4只1500元以内、有照片的小母猫',notice:'',operatorContact:'',defaultMarkup:800,defaultDailyLimit:50,maxDevices:2,cooldownSeconds:15,defaultExpiryDays:0,mobileDensity:'compact',posterEnabled:true,downloadsEnabled:true,singlePosterEnabled:true,calculatorEnabled:true,defaultPosterCount:9,defaultPosterHeight:1080});
const textLimits={brandName:24,brandSubtitle:30,heroTitle:30,heroHighlight:12,aiPlaceholder:100,notice:120,operatorContact:40};
const ranges={defaultMarkup:[0,100000],defaultDailyLimit:[1,1000],maxDevices:[1,5],cooldownSeconds:[5,120],defaultExpiryDays:[0,3650],defaultPosterCount:[2,9]};
export function validateWorkbench(input,{partial=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('配置格式错误');const out=partial?{}:{...WORKBENCH_DEFAULTS};
 for(const [key,value] of Object.entries(input)){
  if(Object.hasOwn(textLimits,key)){if(typeof value!=='string'||[...value].length>textLimits[key]||/[<>\x00-\x1f]/.test(value)||!value.trim()&&!['notice','operatorContact'].includes(key))throw new Error('请检查文字设置：'+key);out[key]=value.trim();}
  else if(Object.hasOwn(ranges,key)){const [min,max]=ranges[key];if(!Number.isInteger(value)||value<min||value>max)throw new Error('设置数值超出范围：'+key);out[key]=value;}
  else if(key==='mobileDensity'){if(!['compact','standard'].includes(value))throw new Error('手机密度无效');out[key]=value;}
  else if(key==='defaultPosterHeight'){if(![1080,1440].includes(value))throw new Error('海报尺寸无效');out[key]=value;}
  else if(['posterEnabled','downloadsEnabled','singlePosterEnabled','calculatorEnabled'].includes(key)){if(typeof value!=='boolean')throw new Error('开关格式错误');out[key]=value;}
  else if(key==='marketingLabEnabled'){ /* 兼容曾经保存到D1中的实验室开关；此功能已经下线，不再读取或保存 */ }
  else throw new Error('不支持的配置项：'+key);
 }
 return out;
}
