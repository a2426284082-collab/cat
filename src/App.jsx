import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Cat, CheckCircle2, ChevronLeft, ChevronRight, Clipboard, Copy, ImageOff, Maximize2, PlayCircle, RefreshCw, RotateCcw, Search, X } from 'lucide-react';

const REFRESH_MS = 5 * 60 * 1000;
const displayAge = value => {
  const age = String(value ?? '').trim();
  return age && /^\d+(?:\.\d+)?$/.test(age) ? `${age}个月` : age;
};
const ageInMonths = value => {
  const match = String(value ?? '').trim().match(/^(\d+(?:\.\d+)?)\s*(?:个?月)?$/);
  return match ? Number(match[1]) : NaN;
};
const salesText = cat => [`猫咪编号：${cat.id}`, `品种：${cat.breed || '待补充'}`, `花色：${cat.color || '待补充'}`, `性别：${cat.gender || '待补充'}`, `月龄：${displayAge(cat.age) || '待补充'}`, `疫苗：${cat.vaccine || '待补充'}`, `描述：${cat.description || '待补充'}`, `参考价格：${cat.price == null ? '请咨询' : `¥${cat.price.toLocaleString('zh-CN')}`}`, '库存实时变化，成交前请凭猫咪编号再次确认。'].join('\n');

function CatImage({ cat, onPlay, onView }) {
  const images = cat.images?.length ? cat.images : (cat.image ? [cat.image] : []);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState(false);
  const selected = images[index] ?? images[0];
  useEffect(() => setIndex(current => Math.min(current, Math.max(0, images.length - 1))), [images.length]);
  useEffect(() => setBroken(false), [selected]);
  return <div>
    <div className="relative aspect-[4/3] bg-amber-50 overflow-hidden">
      {selected && !broken ? <img src={selected} alt={`${cat.breed || '猫咪'}的第${index + 1}张照片`} loading="lazy" onError={() => setBroken(true)} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400"><ImageOff size={28} /><span className="text-xs">暂无照片</span></div>}
      <span className="absolute top-3 left-3 bg-stone-950/75 text-white text-xs font-semibold px-2.5 py-1 rounded-lg backdrop-blur">{cat.id}</span>
      {cat.videos?.length > 0 && <button type="button" onClick={() => onPlay({ ...cat, image: selected })} aria-label={`查看${cat.id}的视频`} className="absolute top-3 right-3 flex items-center gap-1.5 rounded-lg bg-white/90 text-stone-800 px-2.5 py-1.5 text-xs font-semibold shadow-sm hover:bg-white"><PlayCircle size={15} />视频 {cat.videos.length}</button>}
      {selected && <button type="button" onClick={() => onView(cat, index)} aria-label={`放大查看${cat.id}的照片`} className="absolute bottom-3 right-3 rounded-lg bg-white/90 text-stone-700 p-2 shadow-sm hover:bg-white"><Maximize2 size={16} /></button>}
    </div>
    {images.length > 1 && <div className="flex gap-2 overflow-x-auto px-3 py-2.5 custom-scrollbar">{images.map((image, imageIndex) => <button type="button" key={`${image}-${imageIndex}`} onClick={() => setIndex(imageIndex)} aria-label={`查看第${imageIndex + 1}张照片`} aria-pressed={index === imageIndex} className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 ${index === imageIndex ? 'border-orange-500' : 'border-transparent hover:border-slate-300'}`}><img src={image} alt="" loading="lazy" className="w-full h-full object-cover" /></button>)}</div>}
  </div>;
}

export default function App() {
  const [cats, setCats] = useState([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [updatedAt, setUpdatedAt] = useState('');
  const [breed, setBreed] = useState(''), [color, setColor] = useState(''), [gender, setGender] = useState(''), [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState(''), [maxPrice, setMaxPrice] = useState(''), [minAge, setMinAge] = useState(''), [maxAge, setMaxAge] = useState('');
  const [playing, setPlaying] = useState(null), [preview, setPreview] = useState(null), [detail, setDetail] = useState(null);
  const [videoIndex, setVideoIndex] = useState(0), [videoError, setVideoError] = useState(false), [notice, setNotice] = useState('');

  const copy = async (text, message) => { try { await navigator.clipboard.writeText(text); setNotice(message); } catch { setNotice('复制失败，请手动记录猫咪编号。'); } };
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 2400); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { if (!playing && !preview && !detail) return; const close = e => { if (e.key === 'Escape') { setPlaying(null); setPreview(null); setDetail(null); } }; document.addEventListener('keydown', close); return () => document.removeEventListener('keydown', close); }, [playing, preview, detail]);

  const refresh = async signal => {
    setLoading(true);
    try { const response = await fetch('/api/public-cats', { cache: 'no-cache', signal }); const body = await response.json(); if (!response.ok || !body.success || !Array.isArray(body.data)) throw new Error(); setCats(body.data); setUpdatedAt(body.updatedAt); setError(''); }
    catch (err) { if (err.name !== 'AbortError') setError('暂时无法更新猫咪资料，请稍后重试。'); }
    finally { if (!signal?.aborted) setLoading(false); }
  };
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); const timer = setInterval(() => { if (!document.hidden) refresh(controller.signal); }, REFRESH_MS); const visible = () => { if (!document.hidden) refresh(controller.signal); }; document.addEventListener('visibilitychange', visible); return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); }; }, []);

  const breeds = useMemo(() => [...new Set(cats.map(c => c.breed).filter(Boolean))].sort(), [cats]);
  const colors = useMemo(() => [...new Set(cats.map(c => c.color).filter(Boolean))].sort(), [cats]);
  const filtered = useMemo(() => cats.filter(c => { const term = query.trim().toLowerCase(), age = ageInMonths(c.age); return (!breed || c.breed === breed) && (!color || c.color === color) && (!gender || c.gender === gender) && (!term || [c.id, c.breed, c.color].some(v => String(v || '').toLowerCase().includes(term))) && (minPrice === '' || (c.price != null && c.price >= Number(minPrice))) && (maxPrice === '' || (c.price != null && c.price <= Number(maxPrice))) && (minAge === '' || (Number.isFinite(age) && age >= Number(minAge))) && (maxAge === '' || (Number.isFinite(age) && age <= Number(maxAge))); }), [cats, breed, color, gender, query, minPrice, maxPrice, minAge, maxAge]);
  const hasFilters = Boolean(breed || color || gender || query || minPrice || maxPrice || minAge || maxAge);
  const reset = () => { setBreed(''); setColor(''); setGender(''); setQuery(''); setMinPrice(''); setMaxPrice(''); setMinAge(''); setMaxAge(''); };

  return <div className="min-h-screen bg-slate-50 text-slate-800">
    <header className="bg-white border-b border-slate-200 shadow-sm"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
      <a href="#top" className="flex items-center gap-3"><span className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white"><Cat size={24} /></span><span><strong className="block text-lg leading-tight">喵星猫咪展示</strong><small className="block text-xs text-slate-500">查看当前在售猫咪</small></span></a>
      <div className="flex gap-2"><a href="/guide/" className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold"><BookOpen size={15} />销售手册</a><button type="button" onClick={() => refresh()} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-xs"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新</button></div>
    </div></header>

    <main id="top" className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
      <a href="/guide/" className="group mb-6 flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-5 shadow-sm hover:border-amber-300"><div className="flex items-center gap-3 sm:gap-4 min-w-0"><span className="shrink-0 w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center"><BookOpen size={23} /></span><span className="min-w-0"><strong className="block text-slate-900">猫咪销售手册</strong><small className="block mt-1 text-xs sm:text-sm text-slate-600">找客户、发布内容、报价与下单等流程说明。</small></span></div><ArrowRight size={20} className="shrink-0 text-amber-700" /></a>
      <section id="catalog">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5"><div><h2 className="text-xl font-bold">在售猫咪 <span className="text-amber-600">{filtered.length}</span></h2><p className="text-xs text-slate-500 mt-1">每五分钟自动检查更新{updatedAt ? ` · 数据更新于 ${new Date(updatedAt).toLocaleString('zh-CN')}` : ''}</p></div>{hasFilters && <button type="button" onClick={reset} className="text-sm text-amber-700 flex items-center gap-1"><RotateCcw size={14} />清除筛选</button>}</div>
        <div className="bg-white border border-stone-200 rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3 shadow-sm">
          <label className="col-span-2 md:col-span-1"><span className="block text-xs text-stone-500 mb-1">搜索</span><div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-stone-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="编号、品种或花色" className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm" /></div></label>
          <Select label="品种" value={breed} set={setBreed} values={breeds} empty="全部品种" /><Select label="花色" value={color} set={setColor} values={colors} empty="全部花色" /><Select label="性别" value={gender} set={setGender} values={['公', '母']} empty="不限" />
          <Range label="价格区间（元）" min={minPrice} max={maxPrice} setMin={setMinPrice} setMax={setMaxPrice} /><Range label="月龄区间（月）" min={minAge} max={maxAge} setMin={setMinAge} setMax={setMaxAge} />
        </div>
        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">{error}{cats.length > 0 && ' 当前显示上次成功加载的资料。'}</div>}
        {loading && cats.length === 0 && !error ? <p className="py-16 text-center text-slate-500">正在加载猫咪资料…</p> : filtered.length === 0 ? <div className="bg-white rounded-2xl p-12 text-center text-slate-500">没有符合条件的猫咪<button onClick={reset} className="flex items-center gap-1 mx-auto mt-4 text-amber-700 text-sm"><RotateCcw size={14} />重置筛选</button></div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{filtered.map(cat => <article key={cat.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"><CatImage cat={cat} onPlay={selected => { setVideoIndex(0); setVideoError(false); setPlaying(selected); }} onView={(selected, index) => setPreview({ cat: { ...selected, images: selected.images?.length ? selected.images : [selected.image] }, index })} /><div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold text-lg">{cat.breed || '猫咪'}</h3><span className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded-lg">{cat.color || '花色待补充'}</span></div><p className="text-sm text-slate-500 mt-2">{cat.gender || '性别待补充'} · {displayAge(cat.age) || '年龄待补充'}</p><p className="text-sm text-slate-600 mt-2">疫苗：{cat.vaccine || '待补充'}</p>{cat.description && <p className="text-sm text-slate-500 mt-2 line-clamp-2 whitespace-pre-line break-words">{cat.description}</p>}<div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3"><strong className="text-orange-600 text-lg">{cat.price == null ? '价格请咨询' : `¥ ${cat.price.toLocaleString('zh-CN')}`}</strong><button type="button" onClick={() => setDetail(cat)} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900">查看资料</button></div></div></article>)}</div>}
      </section>
      <section className="mt-10 border-t border-slate-200 pt-7 pb-3"><h2 className="font-bold">使用提醒</h2><div className="mt-3 grid sm:grid-cols-3 gap-3 text-sm text-slate-600 leading-6"><p><strong className="text-slate-800">确认库存：</strong>客户有明确意向后，凭猫咪编号再次确认。</p><p><strong className="text-slate-800">资料对应：</strong>对外发送的图片、视频和文案须使用同一编号。</p><p><strong className="text-slate-800">真实沟通：</strong>价格、运输和售后以最终确认结果为准。</p></div></section>
    </main>

    <footer className="bg-white border-t border-slate-200"><div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 text-xs text-slate-500">实际库存及成交条件以最终确认为准</div></footer>
    {notice && <div role="status" className="fixed z-[70] bottom-5 left-1/2 -translate-x-1/2 rounded-xl bg-stone-950 text-white px-4 py-3 text-sm shadow-xl flex items-center gap-2"><CheckCircle2 size={17} className="text-emerald-400" />{notice}</div>}
    {detail && <Detail cat={detail} close={() => setDetail(null)} copy={copy} />}
    {preview && <Preview data={preview} set={setPreview} close={() => setPreview(null)} />}
    {playing && <Video data={playing} index={videoIndex} setIndex={setVideoIndex} error={videoError} setError={setVideoError} close={() => setPlaying(null)} />}
  </div>;
}

function Select({ label, value, set, values, empty }) { return <label><span className="block text-xs text-stone-500 mb-1">{label}</span><select value={value} onChange={e => set(e.target.value)} className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-sm"><option value="">{empty}</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>; }
function Range({ label, min, max, setMin, setMax }) { return <fieldset className="col-span-2 min-w-0"><legend className="text-xs text-stone-500 mb-1">{label}</legend><div className="flex items-center gap-2"><input aria-label={`${label}最低`} type="number" min="0" value={min} onChange={e => setMin(e.target.value)} placeholder="最低" className="min-w-0 w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-sm" /><span className="text-stone-400">—</span><input aria-label={`${label}最高`} type="number" min="0" value={max} onChange={e => setMax(e.target.value)} placeholder="最高" className="min-w-0 w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-sm" /></div></fieldset>; }

function Detail({ cat, close, copy }) { return <div className="fixed inset-0 z-50 bg-slate-950/70 flex items-center justify-center p-4" onMouseDown={e => e.target === e.currentTarget && close()}><div role="dialog" aria-modal="true" className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"><div className="p-5 flex justify-between gap-4 border-b border-slate-100"><div><p className="text-xs font-semibold text-amber-700">销售资料</p><h2 className="mt-1 text-xl font-bold">{cat.breed || '猫咪'} · {cat.id}</h2></div><button onClick={close} aria-label="关闭资料" className="p-2"><X size={20} /></button></div><div className="p-5"><dl className="grid grid-cols-2 gap-4 text-sm">{[['品种', cat.breed], ['花色', cat.color], ['性别', cat.gender], ['月龄', displayAge(cat.age)], ['疫苗', cat.vaccine]].map(([k, v]) => <div key={k}><dt className="text-slate-400">{k}</dt><dd className="mt-1 font-semibold whitespace-pre-line break-words">{v || '待补充'}</dd></div>)}<div className="col-span-2"><dt className="text-slate-400">描述</dt><dd className="mt-1 whitespace-pre-line break-words">{cat.description || '待补充'}</dd></div><div className="col-span-2"><dt className="text-slate-400">参考价格</dt><dd className="mt-1 text-xl font-bold text-orange-600">{cat.price == null ? '请咨询' : `¥ ${cat.price.toLocaleString('zh-CN')}`}</dd></div></dl><p className="mt-5 rounded-xl bg-amber-50 text-amber-900 p-3 text-xs leading-5">库存实时变化，成交前请再次确认猫咪编号。</p><div className="mt-5 grid grid-cols-2 gap-3"><button onClick={() => copy(salesText(cat), '销售文案已复制')} className="inline-flex justify-center items-center gap-2 rounded-xl bg-orange-500 px-3 py-3 text-sm font-semibold text-white hover:bg-orange-600"><Copy size={16} />复制完整文案</button><button onClick={() => copy(cat.id, '猫咪编号已复制')} className="inline-flex justify-center items-center gap-2 rounded-xl border border-slate-300 px-3 py-3 text-sm font-semibold"><Clipboard size={16} />复制编号</button></div></div></div></div>; }
function Preview({ data, set, close }) { return <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3" onMouseDown={e => e.target === e.currentTarget && close()}><div role="dialog" aria-modal="true" className="w-full max-w-5xl"><div className="flex justify-between text-white mb-3"><span>{data.cat.id} · {data.index + 1}/{data.cat.images.length}</span><button onClick={close}><X /></button></div><div className="relative flex items-center justify-center"><img src={data.cat.images[data.index]} alt="猫咪大图" className="max-h-[78vh] max-w-full object-contain rounded-lg" />{data.cat.images.length > 1 && <><button aria-label="上一张" onClick={() => set(v => ({ ...v, index: (v.index - 1 + v.cat.images.length) % v.cat.images.length }))} className="absolute left-0 bg-black/60 text-white p-2 rounded-full"><ChevronLeft /></button><button aria-label="下一张" onClick={() => set(v => ({ ...v, index: (v.index + 1) % v.cat.images.length }))} className="absolute right-0 bg-black/60 text-white p-2 rounded-full"><ChevronRight /></button></>}</div></div></div>; }
function Video({ data, index, setIndex, error, setError, close }) { return <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onMouseDown={e => e.target === e.currentTarget && close()}><div role="dialog" aria-modal="true" className="w-full max-w-4xl rounded-2xl bg-slate-900 p-4"><div className="flex justify-between pb-3 text-white"><strong>{data.breed || '猫咪'} · {data.id}</strong><button onClick={close}><X /></button></div>{data.videos.length > 1 && <div className="flex gap-2 pb-3 overflow-x-auto">{data.videos.map((v, i) => <button key={v.url} onClick={() => { setIndex(i); setError(false); }} className={`rounded-lg px-3 py-2 text-sm ${index === i ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-100'}`}>视频 {i + 1}</button>)}</div>}<video key={data.videos[index].url} src={data.videos[index].url} poster={data.image} controls playsInline preload="metadata" onError={() => setError(true)} className="block w-full max-h-[75vh] rounded-lg bg-black" />{error && <p className="mt-2 text-sm text-red-300">视频加载失败，请检查素材格式和权限。</p>}</div></div>; }
