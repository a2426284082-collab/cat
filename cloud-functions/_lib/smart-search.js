const clean = value => String(value ?? '').trim();

const chineseNumber = value => {
  const text = clean(value);
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const digits = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (text === '十') return 10;
  if (text.includes('十')) {
    const [a, b] = text.split('十');
    return (a ? digits[a] : 1) * 10 + (b ? digits[b] : 0);
  }
  return digits[text];
};

const findCatalogValue = (text, values, aliases = {}) => {
  const normalized = text.toLowerCase();
  const candidates = [...new Set((values || []).map(clean).filter(Boolean))]
    .sort((a, b) => b.length - a.length);
  const direct = candidates.find(value => normalized.includes(value.toLowerCase()));
  if (direct) return direct;
  for (const [alias, names] of Object.entries(aliases)) {
    if (!normalized.includes(alias.toLowerCase())) continue;
    const options = Array.isArray(names) ? names : [names];
    const match = options.map(name => candidates.find(value => value === name || value.includes(name))).find(Boolean);
    if (match) return match;
  }
  return '';
};

const BREED_ALIASES = {
  英国短毛猫: ['英短', '英国短毛猫'], 英短: ['英短', '英国短毛猫'],
  布偶: ['布偶猫', '布偶'], 缅因: ['缅因猫', '缅因'],
  德文: ['德文卷毛猫', '德文'], 拿破仑: ['拿破仑', '米努特'],
  金吉拉: ['金吉拉'], 无毛: ['斯芬克斯', '无毛猫'],
};

export function parseDemandLocally(text, { breeds = [], colors = [] } = {}) {
  const source = clean(text).slice(0, 300);
  const result = { query: '', breed: '', color: '', gender: '', min: '', max: '', minAge: '', maxAge: '', city: '' };
  result.breed = findCatalogValue(source, breeds, BREED_ALIASES);
  result.color = findCatalogValue(source, colors);
  const flexibleGender=/(性别.{0,4}(?:无所谓|不限)|(?:男孩|弟弟|公猫).{0,6}(?:女孩|妹妹|母猫).{0,4}(?:都行|都可以|均可))/.test(source);
  if (!flexibleGender && /(妹妹|母猫|母孩子|女孩|女宝)/.test(source)) result.gender = '母';
  else if (!flexibleGender && /(弟弟|公猫|男孩|男宝)/.test(source)) result.gender = '公';

  const negative=/(不要|不想要|排除|别要|不考虑)/.test(source);
  const alternatives=/(或者|二选一|都可以|都行|均可)/.test(source);
  if (negative && result.color && new RegExp(`(?:不要|不想要|排除|别要|不考虑).{0,3}${result.color}`).test(source)) result.color='';
  if (negative && result.breed && new RegExp(`(?:不要|不想要|排除|别要|不考虑).{0,3}${result.breed.replace('猫','')}`).test(source)) result.breed='';
  if (alternatives) {
    const breedHits=(breeds||[]).filter(value=>source.includes(value)||source.includes(value.replace('猫','')));
    const colorHits=(colors||[]).filter(value=>source.includes(value));
    if(breedHits.length>1)result.breed='';
    if(colorHits.length>1)result.color='';
  }

  const number = '[0-9一二两三四五六七八九十]+';
  const ageRange = source.match(new RegExp(`(${number})\\s*(?:个?月|月龄)?\\s*(?:到|至|[-~—])\\s*(${number})\\s*(?:个?月|月龄)`));
  const looseRange = source.match(/(两三|三四|四五|五六|六七|七八|八九)\s*个?月/);
  const ageCeiling = source.match(new RegExp(`(${number})\\s*(?:个?月|月龄)\\s*(?:以内|以下|以下的|内)`));
  const singleAge = source.match(new RegExp(`(${number})\\s*(?:个?月|月龄)`));
  if (ageRange) {
    result.minAge = String(chineseNumber(ageRange[1])); result.maxAge = String(chineseNumber(ageRange[2]));
  } else if (looseRange) {
    result.minAge = String(chineseNumber(looseRange[1][0])); result.maxAge = String(chineseNumber(looseRange[1][1]));
  } else if (ageCeiling) {
    const age = chineseNumber(ageCeiling[1]); if (Number.isFinite(age)) result.maxAge = String(age);
  } else if (singleAge) {
    const age = chineseNumber(singleAge[1]); if (Number.isFinite(age)) result.minAge = result.maxAge = String(age);
  }

  const thousands = source.match(/(?:预算|价格|价位|不超过|以内|以下|左右|大概)?\s*(\d+(?:\.\d+)?)\s*[千kK](?:元)?(?:以内|以下|左右|上下)?/);
  const budget = source.match(/(?:预算|价格|价位|不超过|最高|控制在)\s*(?:是|在|大概|约)?\s*[¥￥]?\s*(\d{3,6})/);
  const ceiling = source.match(/[¥￥]?\s*(\d{3,6})\s*(?:元)?\s*(?:以内|以下|封顶|左右|上下)/);
  // Sales commonly say '2000块的猫' rather than '预算2000元以内'.
  // Treat a standalone price in a selection request as the customer's maximum.
  const colloquial = source.match(/(?:^|[^0-9])(?:[¥￥]\s*)?(\d{3,6})\s*(?:块(?:钱)?|元)\s*(?:的猫|左右|以内|以下|封顶|上下|的(?:小猫|猫咪)|[，。,.]|$)/);
  const price = thousands ? Math.round(Number(thousands[1]) * 1000) : Number((budget || ceiling || colloquial)?.[1]);
  if (Number.isFinite(price) && price > 0) result.max = String(price);

  const city = source.match(/(?:能|可以)?(?:发|寄|送|运)(?:到|往)?[：: ]*([\u4e00-\u9fa5]{2,6}?)(?:市|地区)?(?:吗|呢|可以|能不能|能否|就行|[，。,. ]|$)/);
  if (city) result.city = city[1];
  const count = [result.breed,result.color,result.gender,(result.minAge||result.maxAge),(result.min||result.max)].filter(Boolean).length;
  const complex = negative || alternatives || flexibleGender || /(八九百|七八百|一千出头|两千出头|小一点|别太大|左右都行)/.test(source);
  return { filters: result, confidence: Math.min(1, count / 5), recognized: count, needsAI: complex || count < 3 };
}

export async function parseDemand(env, { text, breeds, colors }) {
  return { ...parseDemandLocally(text, { breeds, colors }), usedAI: false };
}
