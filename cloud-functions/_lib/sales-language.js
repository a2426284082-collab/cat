// Evidence extraction for user-authored inventory requirements. Model output is
// never allowed to invent hard constraints absent from this source evidence.
const digits={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
export function chineseNumber(raw){
 const s=String(raw||'').trim();if(/^\d+(?:\.\d+)?$/.test(s))return Number(s);
 if(s==='半')return .5;
 if(Object.hasOwn(digits,s))return digits[s];
 if(s==='十')return 10;
 if(/^[一二两三四五六七八九]?十[一二两三四五六七八九]?$/.test(s)){
  const [a,b]=s.split('十');return (a?digits[a]:1)*10+(b?digits[b]:0);
 }
 return null;
}
export function ageValue(raw,unit='月'){
 const s=String(raw||'').replace(/\s/g,'').replace(/个$/,'');
 if(s==='半年')return 6;
 const half=s.match(/^(.+?)个?半$/);
 const n=half?chineseNumber(half[1]):chineseNumber(s);
 if(n===null)return null;
 return (n+(half?0.5:0))*(unit==='岁'||unit==='年'?12:1);
}
const n=String.raw`(?:\d+(?:\.\d+)?|[零一二两三四五六七八九十]+)(?:个?半)?`;
const unit='(?:个?月|月龄|岁|年)';
const token=new RegExp(`(${n})\\s*(${unit})(半)?`,'g');
const amount=(word,u,half=false)=>ageValue(word,/岁|年/.test(u)?'岁':'月')+(half?(/岁|年/.test(u)?6:.5):0);
export function extractAgeIntent(text){
 const source=String(text||'').normalize('NFKC');
 const values=[...source.matchAll(token)].map(m=>({start:m.index,end:m.index+m[0].length,value:amount(m[1],m[2],Boolean(m[3])),raw:m[0]})).filter(m=>m.value!==null);
 // Match ranges first, to keep "两到三个月" from becoming an exact age.
 const range=new RegExp(`(${n})\\s*(${unit})?\\s*(?:到|至|[-~—–])\\s*(${n})\\s*(${unit})`);
 const r=source.match(range);
 if(r){const u1=r[2]||r[4],a=amount(r[1],u1),b=amount(r[3],r[4]);if(a!==null&&b!==null)return {min:a,max:b,target:null,conflict:a>b?'月龄区间下限高于上限':null};}
 let min=null,max=null,target=null;
 if(/半(?:年|岁)\s*(?:以内|以下|之内)/.test(source))max=6;
 else if(/半(?:年|岁)\s*(?:以上|起)/.test(source))min=6;
 else if(/半(?:年|岁)\s*(?:左右|上下)/.test(source))target=6;
 for(const v of values){
  const before=source.slice(Math.max(0,v.start-14),v.start),after=source.slice(v.end,v.end+14);
  if(/^(?:\s*(?:以内|以下|之内|内|及以下|以下的|以内的|以下都行|以内都行))/.test(after)||/(?:不超过|不大于|最多|至多|最高|上限|小于等于)\s*$/.test(before)){max=v.value;continue;}
  if(/^(?:\s*(?:以上|及以上|起|或更大))/.test(after)||/(?:不少于|不低于|至少|最少|大于等于)\s*$/.test(before)){min=v.value;continue;}
  if(/^(?:\s*(?:左右|上下|附近|差不多))/.test(after)||/(?:大约|大概|约|最好|优先)\s*$/.test(before)){target=v.value;continue;}
  // A bare age inside the client's selection request is a preference, not a hard range.
  if(/(?:月龄|年龄|小猫|幼猫|猫咪|只猫|要|找)/.test(before))target=v.value;
 }
 return {min,max,target,conflict:min!==null&&max!==null&&min>max?'月龄下限超过上限':null};
}
export function extractGenderIntent(text){
 const s=String(text||'').normalize('NFKC');
 const flexible=/(?:公母|性别)(?:都行|均可|都可以|不限|无所谓)|(?:公猫|男孩|弟弟).{0,8}(?:母猫|女孩|妹妹).{0,5}(?:都行|都可以|均可)/.test(s);
 const noMale=/(?:不要|排除|不考虑|别要|不选|不能要)\s*(?:公猫|公的|弟弟|男孩)/.test(s);
 const noFemale=/(?:不要|排除|不考虑|别要|不选|不能要)\s*(?:母猫|母的|妹妹|女孩)/.test(s);
 if(noMale&&noFemale||/(?:公猫.{0,5}母猫|母猫.{0,5}公猫).{0,4}(?:都不要|均不要|全部排除)/.test(s))return {hard:null,prefer:null,conflict:'公猫和母猫都被排除'};
 const asGender=v=>v?(/母|妹|女/.test(v)?'母':'公'):null;
 const required=s.match(/(?:必须|只要|一定要|仅要|只能是|性别必须是)\s*(母猫|妹妹|女孩|公猫|弟弟|男孩)/);
 if(required)return {hard:asGender(required[1]),prefer:null};
 if(noMale)return {hard:'母',prefer:null};
 if(noFemale)return {hard:'公',prefer:null};
 const prefix=[...s.matchAll(/(?:优先|最好|尽量|更喜欢|偏好|首选)\s*(?:是|选|考虑)?[^，。；,;]{0,5}(母猫|妹妹|女孩|公猫|弟弟|男孩)/g)].map(m=>({index:m.index,gender:asGender(m[1])}));
 const suffix=[...s.matchAll(/(母猫|妹妹|女孩|公猫|弟弟|男孩)\s*(?:优先(?:考虑)?|更好|更合适|为主|首选|最好)/g)].map(m=>({index:m.index,gender:asGender(m[1])}));
 const preferred=[...prefix,...suffix].sort((a,b)=>a.index-b.index).at(-1)?.gender||null;
 if(preferred)return {hard:null,prefer:preferred};
 if(flexible)return {hard:null,prefer:null};
 const mentions=[...s.matchAll(/(?:母猫|妹妹|女孩|公猫|弟弟|男孩)/g)];
 if(mentions.length===1)return {hard:asGender(mentions[0][0]),prefer:null};
 return {hard:null,prefer:null};
}
const coatContext=/(?:猫(?:咪)?|毛色|花色|毛发|皮毛|被毛|颜色|色系|渐层|玳瑁|三花)/;
export function coatEvidence(source){
 const text=String(source||'').normalize('NFKC');
 // Only remove image/presentation phrases, not cat attributes in the same sentence.
 return text.replace(/(?:无|不带|不显示|不要|去掉|隐藏|使用|换成|设置成|改成|带)?\s*(?:黑白|白黑|黑|白|灰|红|蓝|粉|绿|金|银|紫|橙)(?:色)?(?:的)?\s*(?:黑框|白框|外框|框线|边框|边线|框边|黑边|白边|背景|底色|底图|水印|横幅|标题栏)/g,' ')
 .replace(/(?:无|没有|不带|不要|去掉|隐藏)(?:黑框|白框|黑边|白边|框线|边框|相框|水印)/g,' ')
 .replace(/(?:图|图片|拼图|海报|背景|底色|底图|横幅|边框|框线|相框)\s*(?:要|用|选|改成|是|设置为)\s*(?:黑|白|灰|红|蓝|绿|金|银|粉|紫|橙)色?(?!猫|毛)/g,' ');
}
export function coatMentionedAsCat(text,color){
 if(!color||!String(text).includes(color))return false;
 const s=coatEvidence(text),needle=color.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const found of s.matchAll(new RegExp(needle,'g'))){
  const before=s.slice(Math.max(0,found.index-12),found.index),after=s.slice(found.index+color.length,found.index+color.length+12);
  if(coatContext.test(after)||/(?:毛色|花色|颜色|色系|猫|找|选|要|喜欢|排除|不考虑|不要|指定)[^，。；,;]{0,8}$/.test(before))return true;
 }
 return false;
}
export function intentConflicts(text,breeds=[]){
 const s=String(text||'').normalize('NFKC'),issues=[];
 for(const breed of [...new Set(breeds.filter(Boolean))]){
  const escaped=breed.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const neg=new RegExp(`(?:不要|排除|不考虑|别要|不选|除了)\\s*(?:[^，。；,;]{0,4})${escaped}|${escaped}\\s*(?:不要|不考虑|不选|排除)`).test(s);
  const pos=new RegExp(`(?:只要|必须要|指定|一定要|仅要|就要)\\s*(?:[^，。；,;]{0,4})${escaped}`).test(s);
  if(neg&&pos)issues.push(`品种“${breed}”同时被指定和排除`);
 }
 const age=extractAgeIntent(s),gender=extractGenderIntent(s);
 if(age.conflict)issues.push(age.conflict);
 if(gender.conflict)issues.push(gender.conflict);
 const hard=s.match(/(?:必须|只要|一定要|仅要|只能是|性别必须是)\s*(母猫|妹妹|女孩|公猫|弟弟|男孩)/);
 const preferred=s.match(/(?:优先|最好|尽量|首选)\s*(母猫|妹妹|女孩|公猫|弟弟|男孩)/)||s.match(/(母猫|妹妹|女孩|公猫|弟弟|男孩)\s*(?:优先|最好|首选)/);
 if(hard&&preferred&&/母|妹|女/.test(hard[1])!==/母|妹|女/.test(preferred[1]))issues.push('性别硬条件和偏好互相矛盾');
 return [...new Set(issues)];
}
