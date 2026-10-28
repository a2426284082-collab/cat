import {normalizeId,shortIdMap} from './presentation.js';
import {provinces} from './sales-tools.js';
import {parseDemandLocally} from '../../cloud-functions/_lib/smart-search.js';
import {isHandbookQuestion} from '../../cloud-functions/_lib/sales-intent.js';
import {agentParams,validateAgentPlan} from '../../cloud-functions/_lib/agent-schema.js';
export const AGENT_TTL=30*60*1000,AGENT_STORAGE='sales-agent-session-v1:';
const num=text=>/^\d+$/.test(text)?Number(text):({'一':1,'两':2,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'十一':11,'十二':12}[text]??null);
export function requestedCount(text){text=text.replace(/第\s*(?:\d{1,2}|[一二两三四五六七八九十]+)\s*只/g,'');if(/九宫格/.test(text))return 9;if(/四宫格/.test(text))return 4;if(/双拼/.test(text))return 2;const matches=[...text.matchAll(/(\d{1,2}|十一|十二|[一两二三四五六七八九十])\s*(只|张|幅)/g)];const m=matches.find(row=>row[2]==='只')||matches.find(row=>num(row[1])>1);return m?num(m[1]):null;}
export function resolveCatReferences(text,cats,context={}){
 const labels=shortIdMap(cats),map=new Map(cats.map(c=>[normalizeId(c.id),normalizeId(c.id)]));for(const [id,label] of labels)map.set(label.slice(1).toUpperCase(),id);
 const ids=[],unknown=[];for(const m of text.matchAll(/#\s*([a-z0-9][a-z0-9_-]{0,39})|编号\s*[:：]?\s*([a-z0-9][a-z0-9_-]{0,39})/ig)){const ref=(m[1]||m[2]).toUpperCase();map.has(ref)?ids.push(map.get(ref)):unknown.push(ref);}
 for(const cat of cats){const id=normalizeId(cat.id);const safe=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(/[A-Z]/.test(id)&&new RegExp(`(?<![A-Za-z0-9_-])${safe}(?![A-Za-z0-9_-])`,'i').test(text)&&!ids.includes(id))ids.push(id);}
 for(const ordinal of text.matchAll(/第\s*(\d|[一二两三四五六七八九])\s*只/g)){const id=context.cat_ids?.[num(ordinal[1])-1];if(id)ids.push(id);else unknown.push('第'+ordinal[1]+'只');}
 if(!ids.length&&/这只|它的|这两只|它们|这几只|这批|上面/.test(text))ids.push(...(/这只|它的/.test(text)&&context.focus_id?[context.focus_id]:context.cat_ids||[]));
 return {ids:[...new Set(ids)].filter(id=>cats.some(c=>normalizeId(c.id)===id)),unknown};
}
export function posterPatch(text){
 const p={},count=requestedCount(text);if(count!=null)p.count=count;
 if(/不要(?:显示)?(?:价格|金额|价签)|不(?:显示|带|要)价|去掉(?:价格|金额|价签)|无价|隐藏价格/.test(text))p.includePrices=false;
 else if(/显示价格|带价|加上价格|恢复价格|报价(?:单|图)/.test(text))p.includePrices=true;
 if(/不要招牌|去掉招牌|隐藏招牌/.test(text))p.bannerEnabled=false;else if(/招牌|店名|猫舍名|加上.{2,20}猫舍/.test(text))p.bannerEnabled=true;
 if(/朋友圈/.test(text))p.platform='moments';else if(/小红书/.test(text))p.platform='xhs';
 if(/竖(?:图|版)|1440/.test(text))p.height=1440;else if(/方(?:图|版)|正方形/.test(text))p.height=1080;
 if(/不要镜像|关闭镜像/.test(text))p.mirrorEnabled=false;else if(/打开镜像|允许镜像/.test(text))p.mirrorEnabled=true;
 const quote=text.match(/(?:报价|标价|价格|零售价|售价)(?:改成|设为|是|为|到|[:：])?\s*[¥￥]?\s*(\d{2,7})/);if(quote)p.quote=Number(quote[1]);
 const markup=text.match(/(?:统一加价|加价|每只加|都加)(?:改成|设为|到|为|\s*[+＋])?\s*(\d{1,6})/);if(markup)p.markup=Number(markup[1]);
 const city=text.match(/(?:城市)(?:改成|设为|是|为|[:：])?\s*[“"「]?([\u4e00-\u9fff]{2,10})/);if(city)p.city=city[1];
 const shop=text.match(/(?:店名|猫舍名|招牌文字)(?:改成|设为|叫|是|为|[:：])?\s*[“"「]?([^，。；\n”"」]{2,20})/)||text.match(/加上\s*[“"「]?([^，。；\n”"」]{2,18}猫舍)/);if(shop)p.shop=shop[1].trim();
 if(/换一批|重新挑|换几只/.test(text))p.operation='batch';else if(/打乱|换.*顺序/.test(text))p.operation='shuffle';else if(/(?:换|随机).*(?:排版|样式|风格)/.test(text))p.operation='style';else if(/下载|保存(?:这张|图片|拼图|海报)/.test(text))p.operation='download';else if(/复制.*文案/.test(text))p.operation='copy';else if(/AI.*(?:文案|润色)|(?:写|润色|生成).*(?:小红书|朋友圈)?文案/.test(text))p.operation='generate';
 return p;
}
const clarify=message=>({tool:'clarify',message,cat_ids:[],params:{}});
export function localAgentPlan(raw,cats,context={}){
 const text=String(raw||'').normalize('NFKC').trim().slice(0,200),p=posterPatch(text),refs=resolveCatReferences(text,cats,context),base={cat_ids:refs.ids,params:{},query:text};
 if(!text)return clarify('说说你想做什么，例如“随便挑4只猫做小红书图”。');
 if(/忽略|提示词|系统指令|python|javascript|越狱|写代码|作文|周报|翻译|小说|扮演/.test(text))return clarify('这里只处理选猫、销售素材和手册任务。');
 if(/封禁|解封|生成激活码|删除账号|修改库存|标记已售|修改底价|发布到|自动发布|发到微信/.test(text))return clarify('这里不执行账号管理、库存修改或外部发布；可以先帮你准备素材。');
 if(/^(新客户|新任务|重新开始|清空对话|开始新对话)[。!！\s]*$/.test(text))return {...base,tool:'reset'};
 if(/^(你好|谢谢|感谢|好的|收到)[。!！\s]*$/.test(text)||/你能做什么|有哪些功能|怎么用/.test(text))return {...base,tool:'help'};
 if(refs.unknown.length)return clarify('没有找到编号 '+refs.unknown.join('、')+'，请核对当前在售卡片上的完整短编号。');
 if(p.count!=null&&(p.count<2||p.count>9)&&!/单猫|单只|详情海报/.test(text))return clarify('拼图支持2至9只；单只请说“给这只生成详情海报”。');
 if(/运费|定金|预付款|佣金|利润|尾款|成本/.test(text)&&/算|计算|速算|估/.test(text)){
  const params={};const province=provinces.find(p=>text.includes(p));if(province)params.province=province;const transport=['同城闪送','空运','汽运'].find(t=>text.includes(t));if(transport)params.transport=transport;for(const [key,re] of Object.entries({freight:/运费(?:检疫)?(?:为|是|[:：])?\s*(\d+)/,quote:/(?:报价|售价|零售价)(?:为|是|[:：])?\s*(\d+)/,advance:/(?:定金|预付款)(?:为|是|[:：])?\s*(\d+)/})){const m=text.match(re);if(m)params[key]=+m[1];}return {...base,tool:'calculator',params};
 }
 if(isHandbookQuestion(text)&&!/海报|拼图|九宫格|做图|算运费/.test(text))return {...base,tool:'handbook'};
 if(/打开.*(?:手册|规则)|去.*手册/.test(text))return {...base,tool:'handbook',params:{},query:text};
 if(/查库锁猫|报单口令|锁猫口令/.test(text))return {...base,tool:'order'};
 if(/下载.*(?:视频|原图|高清图|素材)|保存.*视频/.test(text)||refs.ids.length===1&&/下载/.test(text)&&!/海报|拼图|这张图/.test(text))return {...base,tool:'downloads'};
 if(/(?:单猫|单只|详情|这只).*(?:海报|长图)|(?:海报|长图).*单只/.test(text))return {...base,tool:'single_poster',params:p.quote!=null?{quote:p.quote}:{}};
 if(/(?:查看|打开|看看).*(?:资料|详情|视频|照片)|(?:这只|第.只).*(?:性格|疫苗|多大|资料)/.test(text))return {...base,tool:'details'};
 if(/对客模式|对客加价|截图模式|隐藏底价/.test(text))return {...base,tool:'client_view',params:{...(!/对客加价/.test(text)?{enabled:!/关闭|关掉|退出/.test(text)}:{}),...(p.markup!=null?{markup:p.markup}:{}),...(/纯隐藏/.test(text)?{markup:0}:{})}};
 if(/刷新(?:库存|猫源|列表)|随机换一批|(?:筛选|只看|清空筛选|猫源库|修复图片缓存)/.test(text)&&!/拼图|海报|做图/.test(text))return {...base,tool:'catalog',params:{clear:/清空/.test(text),refresh:/刷新/.test(text),shuffle:/换一批/.test(text)},message:/修复图片缓存/.test(text)?'repair':''};
 const explicitPoster=/拼图|海报|九宫格|做(?:一张|张|个)?图|合成.*图|小红书.*展示|展示.*图|朋友圈.*图|图.*(?:小红书|朋友圈)/.test(text);
 const posterFollow=context.task==='poster'&&(Object.keys(p).length>0||/这张图|继续做图/.test(text));
 if(explicitPoster||posterFollow)return {...base,tool:'poster',params:p};
 if(/小红书|朋友圈|种草/.test(text)&&/文案|写|润色/.test(text))return {...base,tool:'poster',params:{...p,operation:'generate'}};
 if(/对比|比较|纠结|这两只.*(?:怎么选|选哪|哪个好)/.test(text))return {...base,tool:'compare'};
 if(/嫌贵|保价|价格.*高|太贵|贵了|有点贵/.test(text))return {...base,tool:'price'};
 if(/夸|骨相|写话术|推荐语|文案|回复/.test(text)&&(context.task!=='poster'||refs.ids.length===1)&&(refs.ids.length||context.cat_ids?.length===1))return {...base,tool:'praise'};
 if(context.task==='poster'&&/文案|种草/.test(text))return {...base,tool:'poster',params:{...p,operation:'generate'}};
 if(context.task==='match'&&/(?:改成|换成|以内|不超过|最多).{0,5}\d|\d.{0,4}(?:以内|以下)/.test(text))return {...base,tool:'match'};
 if(/猫|预算|布偶|英短|美短|渐层|缅因|德文|便宜|温顺|粘人|黏人|甜美/.test(text))return {...base,tool:'match'};
 if(/图|客户|报价|文案|这批|它们|销售|合作/.test(text)||context.task&&text.length<60)return {...base,tool:'understand'};
 return clarify('我能挑猫、做拼图、写话术、看资料、准备下载、算报价和查手册。请说具体任务，不支持闲聊。');
}
export function mergeMatchNeed(previous,text,cats,currentIds=[]){
 const dictionaries={breeds:[...new Set(cats.map(c=>c.breed).filter(Boolean))],colors:[...new Set(cats.map(c=>c.color).filter(Boolean))]},prior=parseDemandLocally(previous||'',dictionaries).filters,next=parseDemandLocally(text,dictionaries).filters,filters={...prior};
 for(const [k,v] of Object.entries(next))if(v!==''&&v!=null)filters[k]=v;
 const budget=text.match(/(?:预算|改成|换成)(?:到|为|约|是|\s)*[¥￥]?\s*(\d{2,7})\s*元?/);if(budget)filters.max=budget[1];
 if(/更便宜|再便宜|便宜一点|便宜点/.test(text)){const prices=cats.filter(c=>currentIds.includes(normalizeId(c.id))&&c.price!=null).map(c=>Number(c.price));if(prices.length)filters.max=String(Math.max(1,Math.min(...prices)-1));}
 if(/性别不限|公母都行|公母都可以/.test(text))filters.gender='';
 const features=['甜美','圆脸','粘人','温顺','亲人','安静','活泼','大眼'],recent=features.filter(x=>text.includes(x)),known=recent.length?recent:features.filter(x=>previous?.includes(x));
 const chunks=[filters.max?`预算${filters.max}元以内`:'',filters.min?`最低${filters.min}元`:'',filters.breed,filters.color,filters.gender==='母'?'妹妹':filters.gender==='公'?'弟弟':'',...known,/性价比|捡漏/.test(text)?'性价比高':''].filter(Boolean);
 // Full stock identifiers are resolved before this merge and passed unchanged.
 if(!chunks.length||/#|编号/.test(text))return text.slice(0,200);
 return chunks.join('，').slice(0,200);
}
export function filterAgentCats(cats,query=''){
 const {filters:f}=parseDemandLocally(query,{breeds:[...new Set(cats.map(c=>c.breed).filter(Boolean))],colors:[...new Set(cats.map(c=>c.color).filter(Boolean))]});
 return cats.filter(c=>(!c.status||c.status==='在售')&&(!f.breed||c.breed===f.breed)&&(!f.color||c.color===f.color)&&(!f.gender||c.gender===f.gender)&&(!f.max||c.price!=null&&c.price<=Number(f.max))&&(!f.min||c.price!=null&&c.price>=Number(f.min)));
}
function cleanTask(value={}){
 const task=value.task||'help',params=agentParams(value.params||{}),ids=(value.cat_ids||[]).map(normalizeId);validateAgentPlan({tool:task,cat_ids:ids,params});
 const context={task,cat_ids:ids,params,need:String(value.need||'').slice(0,200)};
 if(ids.includes(value.focus_id))context.focus_id=value.focus_id;
 if(Number.isInteger(value.designSeed)&&value.designSeed>=0&&value.designSeed<=4294967295)context.designSeed=value.designSeed;
 if(typeof value.bannerText==='string')context.bannerText=value.bannerText.slice(0,60);
 if(typeof value.caption==='string')context.caption=value.caption.slice(0,1600);
 if(value.quotes&&typeof value.quotes==='object'){context.quotes={};for(const id of ids){const n=value.quotes[id];if(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1000000)context.quotes[id]=n;}}
 return context;
}
export function readAgentSession(storage,key,now=Date.now()){
 try{const value=JSON.parse(storage.getItem(AGENT_STORAGE+key)||'null');if(!value||typeof value.at!=='number'||now-value.at>AGENT_TTL||value.at>now+60000)return null;return {context:cleanTask(value.context),messages:Array.isArray(value.messages)?value.messages.slice(-16).filter(r=>['user','assistant'].includes(r.role)&&typeof r.text==='string').map(r=>({role:r.role,text:r.text.slice(0,600)})):[]};}catch{return null;}
}
export function writeAgentSession(storage,key,state){try{storage.setItem(AGENT_STORAGE+key,JSON.stringify({at:Date.now(),context:cleanTask(state.context),messages:state.messages.slice(-16).map(r=>({role:r.role,text:String(r.text).slice(0,600)}))}));return true;}catch{return false;}}
export {agentParams,validateAgentPlan};

// Exact, reversible edits to an existing preview are free. All other free-form input goes to semantics.
export function previewControl(text,context={}){
 if(context.task!=='poster')return null;
 const normalized=String(text).normalize('NFKC').trim().replace(/[，。!！]+$/,'');
 const edit=/^(?:不要价格|不显示价格|隐藏价格|恢复价格|显示价格|不要招牌|去掉招牌|关闭镜像|不要镜像|打开镜像|允许镜像|改成?竖版|换成竖版|改成?方图|换成方图|换个排版|换个样式|换个风格|随机排版|打乱顺序|换一批|下载这张图|保存这张图|复制文案|换成[二两三四五六七八九2-9]只|加上[^，。]{2,18}猫舍|店名改成[^，。]{2,20})$/;
 const replace=normalized.match(/^(?:把)?第([一二两三四五六七八九1-9])只(?:换掉|换一只|替换掉)$/);
 if(replace)return {tool:'poster',cat_ids:[],params:{operation:'replace',replaceIndex:num(replace[1])-1},query:''};
 if(!edit.test(normalized))return null;const params=posterPatch(normalized);return Object.keys(params).length?{tool:'poster',cat_ids:[],params,query:''}:null;
}
