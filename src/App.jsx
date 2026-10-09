import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Cat, Check, ChevronLeft, ChevronRight, Clipboard, Copy, Download, FolderHeart, ImageOff, KeyRound, LayoutGrid, LogIn, LogOut, Maximize2, Menu, PlayCircle, RefreshCw, Search, Settings2, Share2, Sparkles, User as UserRound, X } from 'lucide-react';

const REFRESH_MS = 5 * 60 * 1000;
const CATALOG_CACHE_KEY = 'public-cat-catalog-v1';
const CATALOG_CACHE_MAX_AGE = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 24;
// 默认保持公开看猫模式。需要启用销售工作台时，在部署环境中设置 VITE_SALES_MODE=true 后重新构建。
const SALES_MODE = import.meta.env.VITE_SALES_MODE === 'true';
const money = value => value == null ? '请咨询' : `¥${Math.round(value).toLocaleString('zh-CN')}`;
const ageText = value => { const v = String(value ?? '').trim(); return v && /^\d+(?:\.\d+)?$/.test(v) ? `${v}个月` : v; };
const ageNumber = value => { const match=String(value??'').trim().match(/^(\d+(?:\.\d+)?)/); return match?Number(match[1]):NaN; };
const salesText = cat => [`猫咪编号：${cat.id}`,`品种：${cat.breed||'待补充'}`,`花色：${cat.color||'待补充'}`,`性别：${cat.gender||'待补充'}`,`月龄：${ageText(cat.age)||'待补充'}`,`疫苗：${cat.vaccine||'待补充'}`,`描述：${cat.description||'待补充'}`,`参考价格：${cat.price==null?'请咨询':money(cat.price)}`,'库存实时变化，成交前请凭猫咪编号再次确认。'].join('\n');
const load = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const loadCatalogCache = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY));
    if (!cached || !Array.isArray(cached.data) || !cached.data.length || !Number.isFinite(cached.savedAt)) return [];
    if (Date.now() - cached.savedAt > CATALOG_CACHE_MAX_AGE) return [];
    return cached.data;
  } catch { return []; }
};
const saveCatalogCache = data => {
  try { localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data })); } catch {}
};
const loadCatalogSavedAt = () => {
  try {
    const cached = JSON.parse(localStorage.getItem(CATALOG_CACHE_KEY));
    return Number.isFinite(cached?.savedAt) ? cached.savedAt : null;
  } catch { return null; }
};
const syncTimeText = value => value ? new Intl.DateTimeFormat('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)) : '等待首次同步';
function quote(base, profile, override) { if (override !== '' && Number.isFinite(Number(override))) return Math.max(0, Number(override)); if (base == null) return null; let value = profile.mode === 'rate' ? base * (1 + Number(profile.markup || 0) / 100) : base + Number(profile.markup || 0); if (profile.ending === '99') value = Math.max(99, Math.ceil((value + 1) / 100) * 100 - 1); if (profile.ending === '10') value = Math.round(value / 10) * 10; if (profile.ending === '100') value = Math.round(value / 100) * 100; return Math.round(value); }

export default function App() {
  const [signedIn,setSignedIn]=useState(()=>sessionStorage.getItem('sales-demo-session')==='1'),[login,setLogin]=useState(null);
  const requireAuth=(action,reason='登录后才能使用这项功能')=>{if(signedIn)return action();setLogin({action,reason});};
  const enter=()=>{sessionStorage.setItem('sales-demo-session','1');setSignedIn(true);const action=login?.action;setLogin(null);action?.();};
  const logout=()=>{sessionStorage.removeItem('sales-demo-session');setSignedIn(false);};
  return <><Workspace salesMode={SALES_MODE} signedIn={signedIn} requireAuth={requireAuth} onLogin={()=>setLogin({reason:'登录后可保存货源、报价和销售资料'})} onLogout={logout}/>{SALES_MODE&&login&&<Login reason={login.reason} onEnter={enter} close={()=>setLogin(null)}/>}</>;
}

function Login({ onEnter, close, reason }) {
  const [account, setAccount] = useState('sales-demo'), [password, setPassword] = useState(''), [error, setError] = useState('');
  const submit = e => { e.preventDefault(); if (!account.trim() || !password.trim()) return setError('请输入管理员分配的账号和密码'); onEnter(); };
  return <div className="fixed inset-0 z-[100] bg-stone-950/55 p-4 grid place-items-center" onMouseDown={e=>e.target===e.currentTarget&&close()}><form onSubmit={submit} className="relative w-full max-w-md rounded-[28px] bg-white border border-stone-200 p-7 sm:p-9 shadow-2xl"><button type="button" onClick={close} className="absolute right-5 top-5 text-stone-400"><X size={19}/></button><div className="w-11 h-11 rounded-2xl bg-[#e89a45] text-white grid place-items-center"><UserRound size={22}/></div><p className="mt-6 text-sm text-emerald-800 font-semibold">销售身份验证</p><h2 className="mt-1 text-2xl font-semibold text-stone-900">登录后继续</h2><p className="mt-2 text-sm text-stone-500">{reason}</p><button type="button" onClick={()=>setError('Passkey 将在接入正式账号服务后启用；当前请使用演示账号。')} className="mt-6 w-full rounded-xl border border-stone-300 py-3 font-semibold flex items-center justify-center gap-2"><KeyRound size={18}/>使用指纹、面容或设备解锁</button><div className="my-5 flex items-center gap-3 text-xs text-stone-400"><span className="h-px flex-1 bg-stone-200"/>或使用管理员账号<span className="h-px flex-1 bg-stone-200"/></div><label className="block text-sm font-medium">销售账号<input value={account} onChange={e=>setAccount(e.target.value)} className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-700" /></label><label className="block mt-4 text-sm font-medium">密码<input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="演示时输入任意内容" className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 outline-none focus:border-emerald-700" /></label>{error&&<p className="mt-3 text-sm text-amber-700">{error}</p>}<button className="mt-6 w-full rounded-xl bg-[#183f32] py-3.5 font-semibold text-white hover:bg-[#102f25]">登录并继续</button><p className="mt-4 text-center text-xs leading-5 text-stone-400">不开放自行注册，销售身份由管理员统一授权。</p></form></div>;
}

function Workspace({ salesMode, signedIn, requireAuth, onLogin, onLogout }) {
  const [cats,setCats]=useState(()=>loadCatalogCache()),[loading,setLoading]=useState(true),[error,setError]=useState(''),[tab,setTab]=useState('catalog'),[mobileNav,setMobileNav]=useState(false),[lastUpdated,setLastUpdated]=useState(()=>loadCatalogSavedAt());
  const [saved,setSaved]=useState(()=>load('sales-saved',[])),[selected,setSelected]=useState([]),[prices,setPrices]=useState(()=>load('sales-prices',{}));
  const [profile,setProfile]=useState(()=>load('sales-profile',{name:'麦麦',phone:'微信：maimai-cat',mode:'fixed',markup:800,ending:'99'}));
  const [filters,setFilters]=useState({query:'',breed:'',color:'',gender:'',min:'',max:'',minAge:'',maxAge:''}),[settings,setSettings]=useState(false),[share,setShare]=useState(false),[notice,setNotice]=useState('');
  const [playing,setPlaying]=useState(null),[preview,setPreview]=useState(null),[detail,setDetail]=useState(null);
  const [visibleCount,setVisibleCount]=useState(PAGE_SIZE),loadMoreRef=useRef(null),catsRef=useRef(cats);
  useEffect(()=>{catsRef.current=cats;},[cats]);
  const refresh=async (signal,{manual=false}={})=>{
    if (!catsRef.current.length || manual) setLoading(true);
    try {
      const r=await fetch('/api/public-cats',{cache:manual?'reload':'default',signal});
      const b=await r.json();
      if(!r.ok||!b.success||!Array.isArray(b.data))throw new Error();
      setCats(b.data);
      saveCatalogCache(b.data);
      setLastUpdated(Date.now());
      setError('');
    } catch(e) {
      if(e.name!=='AbortError') {
        if (!catsRef.current.length) setError('猫源数据暂时无法读取，请刷新页面或联系运营。');
        else setError('线上猫源刷新失败，当前显示最近一次成功同步的数据。');
      }
    } finally { if(!signal?.aborted)setLoading(false); }
  };
  useEffect(()=>{const c=new AbortController();refresh(c.signal);const t=setInterval(()=>!document.hidden&&refresh(c.signal),REFRESH_MS);return()=>{c.abort();clearInterval(t);};},[]);
  useEffect(()=>save('sales-saved',saved),[saved]); useEffect(()=>save('sales-prices',prices),[prices]); useEffect(()=>save('sales-profile',profile),[profile]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),2200);return()=>clearTimeout(t);},[notice]);
  const visibleCats=tab==='saved'?cats.filter(c=>saved.includes(c.id)):cats;
  const breeds=[...new Set(cats.map(c=>c.breed).filter(Boolean))].sort(),colors=[...new Set(cats.map(c=>c.color).filter(Boolean))].sort();
  const matchWithoutAge=c=>{const q=filters.query.trim().toLowerCase(),p=c.price;return(!q||[c.id,c.breed,c.color].some(v=>String(v||'').toLowerCase().includes(q)))&&(!filters.breed||c.breed===filters.breed)&&(!filters.color||c.color===filters.color)&&(!filters.gender||c.gender===filters.gender)&&(filters.min===''||(p!=null&&p>=Number(filters.min)))&&(filters.max===''||(p!=null&&p<=Number(filters.max)));};
  const exactFiltered=useMemo(()=>visibleCats.filter(c=>{const a=ageNumber(c.age);return matchWithoutAge(c)&&(filters.minAge===''||(Number.isFinite(a)&&a>=Number(filters.minAge)))&&(filters.maxAge===''||(Number.isFinite(a)&&a<=Number(filters.maxAge)));}),[visibleCats,filters]);
  const relaxedAgeFiltered=useMemo(()=>{if(filters.minAge===''&&filters.maxAge==='')return[];const min=filters.minAge===''?null:Number(filters.minAge),max=filters.maxAge===''?null:Number(filters.maxAge);return visibleCats.filter(matchWithoutAge).sort((a,b)=>{const distance=cat=>{const age=ageNumber(cat.age);if(!Number.isFinite(age))return Number.MAX_SAFE_INTEGER;if(min!=null&&age<min)return min-age;if(max!=null&&age>max)return age-max;return 0;};return distance(a)-distance(b);});},[visibleCats,filters]);
  const ageRelaxed=exactFiltered.length===0&&relaxedAgeFiltered.length>0&&(filters.minAge!==''||filters.maxAge!=='');
  const filtered=ageRelaxed?relaxedAgeFiltered:exactFiltered;
  const pageCats=filtered.slice(0,visibleCount),hasMore=visibleCount<filtered.length;
  useEffect(()=>setVisibleCount(PAGE_SIZE),[filters,tab]);
  useEffect(()=>{const node=loadMoreRef.current;if(!node||!hasMore||!('IntersectionObserver' in window))return;const observer=new IntersectionObserver(entries=>{if(entries[0]?.isIntersecting)setVisibleCount(count=>Math.min(count+PAGE_SIZE,filtered.length));},{rootMargin:'600px 0px'});observer.observe(node);return()=>observer.disconnect();},[hasMore,filtered.length]);
  const toggleSaved=id=>requireAuth(()=>setSaved(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]),'登录后才能把猫咪长期保存到“我的货源”'),toggleSelected=id=>setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  const openTab=id=>{const action=()=>{setTab(id);setMobileNav(false);};id==='catalog'?action():requireAuth(action,id==='saved'?'登录后才能查看长期保存的货源':'登录后才能制作和导出销售资料');};
  const selectedCats=cats.filter(c=>selected.includes(c.id));
  const exportCsv=()=>{const rows=[['猫咪ID','品种','花色','性别','年龄','疫苗','销售价'],...selectedCats.map(c=>[c.id,c.breed,c.color,c.gender,ageText(c.age),c.vaccine||'',quote(c.price,profile,prices[c.id]??'')])];const csv='\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`销售猫源-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(a.href);setNotice('表格已导出');};
  return <div className="min-h-screen bg-[#f7f7f5] text-stone-800">
    <header className="sticky top-0 z-30 bg-white/95 border-b border-stone-200 backdrop-blur"><div className={`${salesMode?'max-w-[1500px]':'max-w-7xl'} mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4`}><div className="flex items-center gap-3 shrink-0">{salesMode&&<button onClick={()=>setMobileNav(!mobileNav)} className="lg:hidden"><Menu/></button>}<span className="w-9 h-9 rounded-xl bg-[#e89a45] text-white grid place-items-center shadow-sm"><Cat size={21}/></span><div><b className="text-stone-900">猫咪合作平台</b><small className="hidden sm:block text-[11px] text-stone-400">合作销售端 · 实时猫源</small></div></div><nav className="hidden md:flex items-center gap-1 text-sm text-stone-500"><a href="/cats/" className="rounded-lg bg-stone-100 px-3 py-2 font-medium text-stone-800">猫源库</a><a href="/manuals/" className="rounded-lg px-3 py-2 hover:bg-stone-50 hover:text-stone-800">销售手册</a><a href="/training/" className="rounded-lg px-3 py-2 hover:bg-stone-50 hover:text-stone-800">实战带练</a><a href="/assistant/" className="rounded-lg px-3 py-2 hover:bg-stone-50 hover:text-stone-800">AI销售助手</a></nav><div className="flex items-center gap-2">{!salesMode&&<a href="/manuals/" className="md:hidden rounded-xl border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700"><BookOpen size={16}/></a>}{salesMode&&<><button onClick={()=>requireAuth(()=>setSettings(true),'登录后才能保存个人报价和联系方式')} className="rounded-xl border border-stone-200 px-3 py-2 text-sm flex gap-2 items-center"><Settings2 size={16}/><span className="hidden sm:inline">报价设置</span></button>{signedIn?<button onClick={onLogout} className="rounded-xl px-3 py-2 text-sm text-stone-500 flex items-center gap-2" title="退出"><LogOut size={17}/><span className="hidden sm:inline">退出</span></button>:<button onClick={onLogin} className="rounded-xl bg-[#183f32] px-3 py-2 text-sm text-white flex items-center gap-2"><LogIn size={17}/>登录</button>}</>}</div></div></header>
    {salesMode&&!signedIn&&<div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-800">当前为游客模式：猫咪资料和原有价格正常展示；保存货源、个人报价及素材工具登录后使用。</div>}
    <div className={`${salesMode?'max-w-[1500px] lg:grid lg:grid-cols-[220px_1fr]':'max-w-7xl'} mx-auto min-h-[calc(100vh-64px)]`}>{salesMode&&<aside className={`${mobileNav?'block':'hidden'} lg:block border-r border-stone-200 bg-white p-4`}><nav className="space-y-1">{[['catalog',LayoutGrid,'猫源库'],['saved',FolderHeart,'我的货源'],['materials',Sparkles,'素材工具']].map(([id,Icon,label])=><button key={id} onClick={()=>openTab(id)} className={`w-full flex items-center justify-between rounded-xl px-3 py-3 text-sm ${tab===id?'bg-[#edf4f0] text-[#173e31] font-semibold':'hover:bg-stone-50'}`}><span className="flex items-center gap-3"><Icon size={18}/>{label}</span>{id==='saved'&&<em className="not-italic text-xs">{signedIn?saved.length:<KeyRound size={13}/>}</em>}</button>)}</nav><div className={`mt-8 rounded-2xl p-4 ${signedIn?'bg-[#183f32] text-white':'border border-stone-200 bg-stone-50'}`}><p className={`text-xs ${signedIn?'text-white/60':'text-stone-400'}`}>{signedIn?'当前销售':'游客使用中'}</p><b className="mt-1 block">{signedIn?profile.name:'无需登录即可找猫'}</b><p className={`mt-3 text-xs ${signedIn?'text-white/70':'text-stone-500'}`}>{signedIn?`默认加价：${profile.mode==='rate'?`${profile.markup}%`:`${profile.markup}元`}`:'勾选内容会保留到登录完成'}</p></div><a href="/manuals/" className="mt-4 flex items-center gap-2 px-3 py-2 text-xs text-stone-500"><BookOpen size={15}/>销售手册</a></aside>}
      <main className="p-4 sm:p-7 min-w-0">
        {salesMode&&tab==='materials'?<Materials selected={selectedCats} profile={profile} prices={prices} onExport={exportCsv} onShare={()=>setShare(true)}/>:<>
          <div className="flex flex-wrap justify-between items-end gap-4"><div><p className="text-sm text-emerald-800 font-semibold">{salesMode&&tab==='saved'?'PERSONAL STOCK':'实时猫源库'}</p><h1 className="mt-1 text-2xl font-semibold">{salesMode&&tab==='saved'?'我的货源':'在售猫咪'}</h1><p className="mt-1 text-sm text-stone-500">{salesMode&&tab==='saved'?'收藏常用货源并设置自己的售价':'当前合作猫源库存 · 成交前请凭猫咪编号再次确认'}</p></div><button onClick={()=>refresh(undefined,{manual:true})} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500 shadow-sm hover:text-stone-800"><RefreshCw size={16} className={loading?'animate-spin':''}/>刷新</button></div>
          {tab!=='saved'&&<div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-xs text-stone-500 shadow-sm"><span className="flex items-center gap-2 font-medium text-stone-700"><i className={`h-2 w-2 rounded-full ${error?'bg-amber-500':loading?'bg-stone-300':'bg-emerald-600'}`}/>{error?(cats.length?'使用最近同步数据':'数据同步异常'):(loading?'正在同步':'数据同步正常')}</span><span>最后更新：{syncTimeText(lastUpdated)}</span><span>当前在售：<b className="font-semibold text-stone-700">{cats.length}</b> 只</span><span>系统每 5 分钟自动同步</span><span className="ml-auto hidden lg:inline text-stone-400">猫源资料由运营持续维护</span></div>}
          <Filters value={filters} set={setFilters} breeds={breeds} colors={colors}/>
          {error&&<p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</p>}
          {ageRelaxed&&<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"><b>暂无完全符合月龄的猫咪。</b><span className="ml-1">下面展示的是其他条件符合的接近结果，月龄可能不同或暂未录入，请按猫咪编号进一步确认。</span></div>}
          <div className="mb-4 flex items-center justify-between text-sm text-stone-500"><span>{loading&&!cats.length?'正在加载猫咪…':ageRelaxed?`找到 ${filtered.length} 只接近需求的猫咪${filtered.length>pageCats.length?` · 已显示 ${pageCats.length} 只`:''}`:`找到 ${filtered.length} 只猫咪${filtered.length>pageCats.length?` · 已显示 ${pageCats.length} 只`:''}`}</span>{salesMode&&selected.length>0&&<button onClick={()=>openTab('materials')} className="rounded-xl bg-[#183f32] px-4 py-2 text-white">已选 {selected.length} 只 · 去制作资料</button>}</div>
          {loading&&!cats.length?<CatalogSkeleton/>:filtered.length===0?<Empty saved={salesMode&&tab==='saved'}/>:<><div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{pageCats.map((cat,index)=><CatCard key={cat.id} cat={cat} priority={index<8} salesMode={salesMode} signedIn={signedIn} saved={saved.includes(cat.id)} selected={selected.includes(cat.id)} salePrice={quote(cat.price,profile,prices[cat.id]??'')} custom={prices[cat.id]??''} setCustom={v=>setPrices(p=>({...p,[cat.id]:v}))} onSave={()=>toggleSaved(cat.id)} onSelect={()=>toggleSelected(cat.id)} onPlay={()=>setPlaying(cat)} onPreview={()=>setPreview(cat)} onDetail={()=>setDetail(cat)}/>)}</div>{hasMore&&<div ref={loadMoreRef} className="py-8 text-center"><button onClick={()=>setVisibleCount(count=>Math.min(count+PAGE_SIZE,filtered.length))} className="rounded-xl border border-stone-200 bg-white px-5 py-2.5 text-sm text-stone-500 shadow-sm">加载更多猫咪</button></div>}</>}
        </>}
        <footer className="mt-12 border-t border-stone-200 py-6 text-xs leading-6 text-stone-400"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p><b className="font-medium text-stone-500">猫咪合作平台</b> · 合作销售专用</p><nav className="flex flex-wrap gap-x-4"><a href="/manuals/" className="hover:text-stone-700">销售手册</a><a href="/training/" className="hover:text-stone-700">实战带练</a><a href="/assistant/" className="hover:text-stone-700">AI销售助手</a></nav></div><p className="mt-1">猫源库存实时变化，成交前请凭猫咪编号再次确认；使用过程中如有问题，请联系运营。</p></footer>
      </main>
    </div>{settings&&<PriceSettings profile={profile} set={setProfile} close={()=>setSettings(false)}/>} {share&&<SharePreview cats={selectedCats} profile={profile} prices={prices} close={()=>setShare(false)} notify={setNotice}/>} {playing&&<Video cat={playing} close={()=>setPlaying(null)}/>} {preview&&<Photo cat={preview} close={()=>setPreview(null)}/>} {detail&&<Detail cat={detail} close={()=>setDetail(null)} notify={setNotice}/>} {notice&&<div className="fixed z-[90] bottom-5 left-1/2 -translate-x-1/2 bg-stone-900 text-white rounded-xl px-4 py-3 text-sm shadow-xl flex gap-2"><Check size={17}/>{notice}</div>}
  </div>;
}

function Filters({value,set,breeds,colors}){
  const field=(k,v)=>set(x=>({...x,[k]:v}));
  const [smartOpen,setSmartOpen]=useState(false),[demand,setDemand]=useState(''),[smartLoading,setSmartLoading]=useState(false),[smartMessage,setSmartMessage]=useState(''),[city,setCity]=useState('');
  const day=new Date().toISOString().slice(0,10),quotaKey=`smart-search-${day}`;
  const used=()=>{try{return Number(localStorage.getItem(quotaKey)||0);}catch{return 0;}};
  const submitDemand=async e=>{
    e.preventDefault();const text=demand.trim();
    if(text.length<2)return setSmartMessage('先粘贴一句客户需求');
    if(used()>=20)return setSmartMessage('今天的智能整理次数已用完，请直接使用下方筛选条件');
    setSmartLoading(true);setSmartMessage('');
    try{
      const response=await fetch('/api/smart-search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text,breeds,colors})});
      const body=await response.json();if(!response.ok||!body.success)throw new Error(body.message||'智能整理失败');
      const result=body.data?.filters||{};
      if(!body.data?.recognized)throw new Error('没有识别出明确条件，请换一种说法或手动筛选');
      set({query:'',breed:result.breed||'',color:result.color||'',gender:result.gender||'',min:result.min||'',max:result.max||'',minAge:result.minAge||'',maxAge:result.maxAge||''});
      setCity(result.city||'');setSmartOpen(false);
      setSmartMessage(body.data.usedAI?'已智能填写筛选条件，请检查后再挑选':'已快速填写筛选条件，请检查后再挑选');
      if(body.data.usedAI)try{localStorage.setItem(quotaKey,String(used()+1));}catch{}
    }catch(error){setSmartMessage(error.message||'暂时无法智能整理，请手动筛选');}
    finally{setSmartLoading(false);}
  };
  const tags=[value.breed,value.color,value.gender,value.minAge&&(value.maxAge&&value.maxAge!==value.minAge?`${value.minAge}—${value.maxAge}个月`:`${value.minAge}个月`),value.max&&`${value.max}元以内`,city&&`收货地：${city}`].filter(Boolean);
  return <div className="my-6 grid grid-cols-2 md:grid-cols-4 gap-3 rounded-2xl border border-stone-200 bg-white p-4">
    <div className="col-span-2 md:col-span-4 rounded-xl border border-[#f0dfca] bg-[#fffaf4] overflow-hidden">
      <button type="button" onClick={()=>setSmartOpen(open=>!open)} className="w-full min-h-[44px] px-3.5 py-2.5 flex items-center gap-2 text-left text-sm text-stone-700 hover:bg-[#fff7ed]">
        <Sparkles size={16} className="shrink-0 text-[#d8842e]"/><span className="font-medium">有客户需求？</span><span className="min-w-0 flex-1 truncate text-stone-500">粘贴一句话，自动填写筛选条件</span><span className="text-xs text-[#b86c24]">{smartOpen?'收起':'智能整理 ›'}</span>
      </button>
      {smartOpen&&<form onSubmit={submitDemand} className="border-t border-[#f0dfca] p-3 sm:p-4">
        <textarea autoFocus value={demand} onChange={e=>setDemand(e.target.value.slice(0,300))} placeholder="例如：想找一只两三个月的布偶妹妹，预算1500以内，可以发杭州" className="w-full min-h-[82px] resize-y rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-sm leading-6 outline-none focus:border-[#d8842e]"/>
        <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[11px] text-stone-400">只整理品种、花色、性别、月龄和预算</span><button disabled={smartLoading||demand.trim().length<2} className="shrink-0 rounded-lg bg-[#183f32] px-4 py-2 text-sm font-medium text-white disabled:bg-stone-300">{smartLoading?'正在整理…':'查看匹配猫咪'}</button></div>
      </form>}
    </div>
    {(smartMessage||tags.length>0)&&<div className="col-span-2 md:col-span-4 flex flex-wrap items-center gap-2 text-xs">
      {smartMessage&&<span className={smartMessage.includes('失败')||smartMessage.includes('无法')||smartMessage.includes('没有')||smartMessage.includes('用完')?'text-amber-700':'text-emerald-700'}>{smartMessage}</span>}
      {tags.map(tag=><span key={tag} className="rounded-full bg-[#edf4f0] px-2.5 py-1 text-[#315c49]">{tag}</span>)}
      {city&&<span className="text-stone-400">城市仅用于运输提醒，不作为硬筛选</span>}
    </div>}
    <label className="col-span-2 md:col-span-1 relative"><Search size={16} className="absolute left-3 top-3 text-stone-400"/><input value={value.query} onChange={e=>field('query',e.target.value)} placeholder="编号、品种、花色" className="w-full rounded-xl bg-stone-50 py-2.5 pl-9 pr-3 text-sm"/></label>
    <Select value={value.breed} set={v=>field('breed',v)} values={breeds} label="全部品种"/><Select value={value.color} set={v=>field('color',v)} values={colors} label="全部花色"/><Select value={value.gender} set={v=>field('gender',v)} values={['公','母']} label="不限性别"/>
    <Range label="价格区间（元）" min={value.min} max={value.max} setMin={v=>field('min',v)} setMax={v=>field('max',v)}/><Range label="月龄区间（月）" min={value.minAge} max={value.maxAge} setMin={v=>field('minAge',v)} setMax={v=>field('maxAge',v)}/>
  </div>;
}
function Select({value,set,values,label}){return <select value={value} onChange={e=>set(e.target.value)} className="rounded-xl bg-stone-50 px-3 py-2.5 text-sm"><option value="">{label}</option>{values.map(v=><option key={v}>{v}</option>)}</select>}
function Range({label,min,max,setMin,setMax}){return <fieldset className="col-span-2"><legend className="mb-1 text-xs text-stone-500">{label}</legend><div className="flex items-center gap-2"><input type="number" min="0" value={min} onChange={e=>setMin(e.target.value)} placeholder="最低" className="min-w-0 w-full rounded-xl bg-stone-50 px-3 py-2.5 text-sm"/><span className="text-stone-300">—</span><input type="number" min="0" value={max} onChange={e=>setMax(e.target.value)} placeholder="最高" className="min-w-0 w-full rounded-xl bg-stone-50 px-3 py-2.5 text-sm"/></div></fieldset>}
function Empty({saved}){return <div className="rounded-2xl border border-dashed border-stone-300 py-20 text-center text-stone-400"><FolderHeart className="mx-auto mb-3"/>{saved?'还没有加入我的货源':'没有符合条件的猫咪'}</div>}
function CatalogSkeleton(){return <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" aria-label="正在加载猫咪">{Array.from({length:8},(_,i)=><div key={i} className="overflow-hidden rounded-2xl border border-stone-200 bg-white"><div className="aspect-[4/3] animate-pulse bg-stone-100"/><div className="space-y-3 p-4"><div className="h-5 w-2/3 animate-pulse rounded bg-stone-100"/><div className="h-4 w-1/2 animate-pulse rounded bg-stone-100"/><div className="h-4 w-5/6 animate-pulse rounded bg-stone-100"/></div></div>)}</div>}

function CatCard({cat,priority,salesMode,signedIn,saved,selected,salePrice,custom,setCustom,onSave,onSelect,onPlay,onPreview,onDetail}){
  const image=cat.images?.[0]||cat.image;
  return <article className={`rounded-2xl overflow-hidden border bg-white shadow-sm ${salesMode&&selected?'border-emerald-700 ring-2 ring-emerald-700/10':'border-stone-200'}`}>
    <div className="relative aspect-[4/3] bg-[#f2ede5]">
      {image?<img src={image} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'} decoding="async" width="640" height="480" className="h-full w-full object-cover" alt={cat.breed||'在售猫咪'}/>:<div className="h-full grid place-items-center text-stone-300"><ImageOff/></div>}
      {salesMode&&<><button onClick={onSelect} title="临时勾选" className={`absolute left-3 top-3 w-7 h-7 rounded-lg grid place-items-center ${selected?'bg-emerald-700 text-white':'bg-white/90 text-stone-400'}`}>{selected&&<Check size={17}/>}</button><button onClick={onSave} className={`absolute right-3 top-3 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${saved&&signedIn?'bg-[#183f32] text-white':'bg-white/90'}`}>{signedIn?(saved?'已加入':'加入货源'):<span className="flex items-center gap-1"><KeyRound size={12}/>保存</span>}</button></>}
      {cat.videos?.length>0&&<button onClick={onPlay} className="absolute right-3 bottom-3 rounded-lg bg-white/90 p-2"><PlayCircle size={18}/></button>}
      {image&&<button onClick={onPreview} className="absolute left-3 bottom-3 rounded-lg bg-white/90 p-2"><Maximize2 size={17}/></button>}
    </div>
    <div className="p-4"><div className="flex justify-between gap-3"><div><h3 className="font-semibold">{cat.breed||'猫咪'} · {cat.color||'花色待补充'}</h3><p className="mt-1 text-xs text-stone-500">{cat.gender||'性别待补充'} · {ageText(cat.age)||'年龄待补充'}</p></div><span className="text-xs text-stone-400">{cat.id}</span></div><p className="mt-2 text-sm text-stone-600">疫苗：{cat.vaccine||'待补充'}</p>{cat.description&&<p className="mt-2 line-clamp-2 min-h-[40px] whitespace-pre-line break-words text-sm leading-5 text-stone-500">{cat.description}</p>}<div className="mt-4 flex items-end justify-between gap-3 border-t border-stone-100 pt-3"><div><small className="text-stone-400">参考价格</small><b className="block text-lg text-[#c96f23]">{money(cat.price)}</b></div><button onClick={onDetail} className="rounded-lg bg-stone-800 px-3 py-2 text-xs font-semibold text-white">查看资料</button></div>{salesMode&&signedIn&&<div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2"><small className="text-emerald-700">我的销售价</small><b className="ml-2 text-[#c96f23]">{money(salePrice)}</b></div>}{salesMode&&signedIn&&saved&&<input type="number" value={custom} onChange={e=>setCustom(e.target.value)} placeholder="输入自定义售价" className="mt-3 w-full rounded-xl bg-stone-50 px-3 py-2 text-sm"/>}</div>
  </article>;
}

function Materials({selected,profile,prices,onExport,onShare}){return <div><p className="text-sm font-semibold text-emerald-800">SALES MATERIALS</p><h1 className="mt-1 text-2xl font-semibold">销售素材工具</h1><p className="mt-1 text-sm text-stone-500">把选中的猫咪整理成可以直接发给客户的资料。</p><div className="mt-7 grid md:grid-cols-3 gap-4">{[[Download,'导出销售表格','编号、资料与个人报价整理为 CSV',onExport],[Sparkles,'批量销售图','按统一模板生成带报价和联系方式的图片',()=>alert('界面预览：下一阶段接入图片批量生成')],[Share2,'客户展示页','预览客户看到的多猫展示页',onShare]].map(([Icon,title,text,fn])=><button key={title} onClick={fn} disabled={!selected.length} className="text-left rounded-2xl border border-stone-200 bg-white p-5 disabled:opacity-40"><Icon className="text-[#c96f23]"/><b className="mt-5 block">{title}</b><p className="mt-2 text-sm leading-6 text-stone-500">{text}</p></button>)}</div><div className="mt-7 rounded-2xl border border-stone-200 bg-white"><div className="border-b border-stone-100 p-4 flex justify-between"><b>已选择 {selected.length} 只</b><span className="text-sm text-stone-400">销售：{profile.name}</span></div>{selected.length===0?<p className="p-12 text-center text-stone-400">请先回到猫源库选择猫咪</p>:<div className="divide-y divide-stone-100">{selected.map(c=><div key={c.id} className="p-4 flex items-center justify-between gap-4"><div><b>{c.breed} · {c.color}</b><p className="text-xs text-stone-400">{c.id} · {c.gender} · {ageText(c.age)}</p></div><b className="text-[#c96f23]">{money(quote(c.price,profile,prices[c.id]??''))}</b></div>)}</div>}</div></div>}
function PriceSettings({profile,set,close}){const f=(k,v)=>set(p=>({...p,[k]:v}));return <Modal close={close} title="报价与联系方式"><div className="space-y-4"><label className="block text-sm">销售称呼<input value={profile.name} onChange={e=>f('name',e.target.value)} className="mt-2 w-full rounded-xl bg-stone-50 px-3 py-2.5"/></label><label className="block text-sm">联系方式<input value={profile.phone} onChange={e=>f('phone',e.target.value)} className="mt-2 w-full rounded-xl bg-stone-50 px-3 py-2.5"/></label><div className="grid grid-cols-2 gap-3"><label className="text-sm">加价方式<select value={profile.mode} onChange={e=>f('mode',e.target.value)} className="mt-2 w-full rounded-xl bg-stone-50 px-3 py-2.5"><option value="fixed">固定加价</option><option value="rate">百分比加价</option></select></label><label className="text-sm">加价数值<input type="number" value={profile.markup} onChange={e=>f('markup',e.target.value)} className="mt-2 w-full rounded-xl bg-stone-50 px-3 py-2.5"/></label></div><label className="block text-sm">价格尾数<select value={profile.ending} onChange={e=>f('ending',e.target.value)} className="mt-2 w-full rounded-xl bg-stone-50 px-3 py-2.5"><option value="none">不处理</option><option value="10">取整到十元</option><option value="99">调整为 xx99</option><option value="100">取整到百元</option></select></label><button onClick={close} className="w-full rounded-xl bg-[#183f32] py-3 text-white">保存设置</button></div></Modal>}
function SharePreview({cats,profile,prices,close,notify}){const copy=async()=>{await navigator.clipboard.writeText('演示链接：正式版将由服务端生成不可猜测、可关闭的专属链接');notify('演示链接说明已复制');};return <Modal close={close} title="客户展示页预览" wide><div className="rounded-2xl bg-[#183f32] p-6 text-white"><small className="text-white/60">由 {profile.name} 为你整理</small><h3 className="mt-2 text-2xl font-semibold">为你挑选的猫咪</h3><p className="mt-2 text-sm text-white/70">联系方式：{profile.phone}</p></div><div className="mt-4 grid sm:grid-cols-2 gap-3">{cats.map(c=><div key={c.id} className="rounded-xl border border-stone-200 p-4"><b>{c.breed} · {c.color}</b><p className="mt-1 text-sm text-stone-500">{c.gender} · {ageText(c.age)} · 疫苗：{c.vaccine||'待补充'}</p><strong className="mt-3 block text-[#c96f23]">{money(quote(c.price,profile,prices[c.id]??''))}</strong></div>)}</div><button onClick={copy} className="mt-5 w-full rounded-xl bg-[#183f32] py-3 text-white flex justify-center gap-2"><Share2 size={17}/>生成专属链接</button></Modal>}
function Detail({cat,close,notify}){const copy=async(text,message)=>{try{await navigator.clipboard.writeText(text);notify(message);}catch{notify('复制失败，请手动记录猫咪编号。');}};return <Modal close={close} title="猫咪销售资料"><dl className="grid grid-cols-2 gap-4 text-sm">{[['品种',cat.breed],['花色',cat.color],['性别',cat.gender],['月龄',ageText(cat.age)],['疫苗',cat.vaccine]].map(([k,v])=><div key={k}><dt className="text-stone-400">{k}</dt><dd className="mt-1 font-semibold whitespace-pre-line break-words">{v||'待补充'}</dd></div>)}<div className="col-span-2"><dt className="text-stone-400">描述</dt><dd className="mt-1 whitespace-pre-line break-words">{cat.description||'待补充'}</dd></div><div className="col-span-2"><dt className="text-stone-400">参考价格</dt><dd className="mt-1 text-xl font-bold text-[#c96f23]">{money(cat.price)}</dd></div></dl><p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">库存实时变化，成交前请再次确认猫咪编号。</p><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={()=>copy(salesText(cat),'销售文案已复制')} className="flex items-center justify-center gap-2 rounded-xl bg-[#e87924] px-3 py-3 text-sm font-semibold text-white"><Copy size={16}/>复制完整文案</button><button onClick={()=>copy(cat.id,'猫咪编号已复制')} className="flex items-center justify-center gap-2 rounded-xl border border-stone-300 px-3 py-3 text-sm font-semibold"><Clipboard size={16}/>复制编号</button></div></Modal>}
function Modal({close,title,children,wide=false}){return <div className="fixed inset-0 z-50 bg-stone-950/55 p-4 grid place-items-center" onMouseDown={e=>e.target===e.currentTarget&&close()}><div className={`max-h-[90vh] overflow-y-auto w-full ${wide?'max-w-2xl':'max-w-md'} rounded-2xl bg-white shadow-2xl`}><div className="sticky top-0 bg-white flex justify-between border-b border-stone-100 p-5"><b>{title}</b><button onClick={close}><X size={19}/></button></div><div className="p-5">{children}</div></div></div>}
function Video({cat,close}){const [i,setI]=useState(0);if(!cat.videos?.length)return null;return <div className="fixed inset-0 z-50 bg-black/85 p-4 grid place-items-center"><div className="w-full max-w-4xl"><div className="mb-3 flex justify-between text-white"><b>{cat.breed} · {cat.id}</b><button onClick={close}><X/></button></div><video key={cat.videos[i].url} src={cat.videos[i].url} controls playsInline className="w-full max-h-[78vh] bg-black rounded-xl"/>{cat.videos.length>1&&<div className="mt-3 flex gap-2">{cat.videos.map((v,n)=><button key={v.url} onClick={()=>setI(n)} className={`rounded-lg px-3 py-2 text-sm ${i===n?'bg-orange-500 text-white':'bg-white'}`}>视频 {n+1}</button>)}</div>}</div></div>}
function Photo({cat,close}){const images=cat.images?.length?cat.images:[cat.image].filter(Boolean),[i,setI]=useState(0);return <div className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center"><button className="absolute top-5 right-5 text-white" onClick={close}><X/></button>{images.length?<div className="relative w-full max-w-5xl flex justify-center"><img src={images[i]} className="max-h-[85vh] object-contain" alt="猫咪大图"/>{images.length>1&&<><button onClick={()=>setI((i-1+images.length)%images.length)} className="absolute left-0 top-1/2 text-white"><ChevronLeft size={35}/></button><button onClick={()=>setI((i+1)%images.length)} className="absolute right-0 top-1/2 text-white"><ChevronRight size={35}/></button></>}</div>:<ImageOff className="text-white"/>}</div>}
