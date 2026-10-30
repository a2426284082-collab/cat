// Only reusable, non-customer-specific defaults go into browser storage.
// Consultant identity, contact information, markup and QR are stored on the server.
export const DEFAULT_SHARE_PREFERENCES = Object.freeze({note:'',days:7});
const keyFor = ownerId => `forward-share-preferences-v1:${Number(ownerId)}`;
const validOwner = ownerId => Number.isSafeInteger(Number(ownerId)) && Number(ownerId)>0;
export function normalizeSharePreferences(raw){
 const obj=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 return {
  note: typeof obj.note==='string'?obj.note.slice(0,500):'',
  days: Number.isInteger(obj.days)&&obj.days>=0&&obj.days<=30?obj.days:7
 };
}
export function readSharePreferences(ownerId,storage){
 if(!validOwner(ownerId))return {...DEFAULT_SHARE_PREFERENCES};
 try{return normalizeSharePreferences(JSON.parse(storage.getItem(keyFor(ownerId))));}
 catch{return {...DEFAULT_SHARE_PREFERENCES};}
}
export function saveSharePreferences(ownerId,prefs,storage){
 if(!validOwner(ownerId))throw new Error('代理身份无法识别，未保存设置');
 const clean=normalizeSharePreferences(prefs);
 storage.setItem(keyFor(ownerId),JSON.stringify(clean));
 return clean;
}
export function shareExpiryDays(dateString,todayString){
 const value=Date.parse(`${dateString}T00:00:00Z`),today=Date.parse(`${todayString}T00:00:00Z`);
 const days=Math.round((value-today)/86400000);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dateString)||!Number.isFinite(days)||days<0||days>30)throw new Error('报价有效期须在今天至30天内');
 return days;
}
