import React, { useEffect, useMemo, useState } from 'react';
import { Cat, Search, RefreshCw, RotateCcw, ImageOff, X, Maximize2, ChevronLeft, ChevronRight } from 'lucide-react';

const REFRESH_MS = 5 * 60 * 1000;

function CatImage({ cat, onPlay, onView }) {
  const images = cat.images?.length ? cat.images : (cat.image ? [cat.image] : []);
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState(false);
  const selected = images[index] ?? images[0];
  useEffect(() => setIndex(current => Math.min(current, Math.max(0, images.length - 1))), [images.length]);
  useEffect(() => setBroken(false), [selected]);
  return (
    <div>
      <div className="relative aspect-[4/3] bg-amber-50 overflow-hidden">
        {selected && !broken ? (
          <img src={selected} alt={`${cat.breed || '猫咪'}的第${index + 1}张照片`} loading="lazy"
            onError={() => setBroken(true)} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <ImageOff size={28} /><span className="text-xs">暂无照片</span>
          </div>
        )}
        <span className="absolute top-3 left-3 bg-slate-900/70 text-white text-xs font-semibold px-2.5 py-1 rounded-lg">{cat.id}</span>
        {cat.videos?.length > 0 && <button type="button" onClick={() => onPlay({ ...cat, image: selected })}
          aria-label={`查看${cat.id}的${cat.videos.length}个视频`}
          className="absolute inset-0 flex items-start justify-end p-3 cursor-pointer hover:bg-black/5 focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-500"
          title="点击查看视频">
          <span className="rounded-md bg-white/90 text-slate-700 px-2 py-1 text-xs font-medium shadow-sm">视频 {cat.videos.length}</span>
        </button>}
        {selected && <button type="button" onClick={() => onView(cat, index)} aria-label={`放大查看${cat.id}的照片`}
          className="absolute bottom-3 right-3 rounded-md bg-white/90 text-slate-700 p-2 shadow-sm hover:bg-white focus-visible:outline focus-visible:outline-4 focus-visible:outline-amber-500"
          title="放大照片"><Maximize2 size={16} /></button>}
      </div>
      {images.length > 1 && <div className="flex gap-2 overflow-x-auto px-3 py-2.5" aria-label={`${cat.id}的照片，共${images.length}张`}>
        {images.map((image, imageIndex) => <button type="button" key={`${image}-${imageIndex}`} onClick={() => setIndex(imageIndex)}
          aria-label={`查看第${imageIndex + 1}张照片`} aria-pressed={index === imageIndex}
          className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 ${index === imageIndex ? 'border-orange-500' : 'border-transparent hover:border-slate-300'}`}>
          <img src={image} alt="" loading="lazy" className="w-full h-full object-cover" />
        </button>)}
      </div>}
    </div>
  );
}

export default function App() {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [breed, setBreed] = useState('');
  const [color, setColor] = useState('');
  const [gender, setGender] = useState('');
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [playing, setPlaying] = useState(null);
  const [preview, setPreview] = useState(null);
  const [videoIndex, setVideoIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const openVideos = cat => { setVideoIndex(0); setVideoError(false); setPlaying(cat); };

  useEffect(() => {
    if (!playing && !preview) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') { setPlaying(null); setPreview(null); } };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [playing, preview]);

  const refresh = async (signal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/public-cats', { cache: 'no-cache', signal });
      const body = await response.json();
      if (!response.ok || !body.success || !Array.isArray(body.data)) throw new Error('读取失败');
      setCats(body.data);
      setUpdatedAt(body.updatedAt);
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError('暂时无法更新猫咪资料，请稍后重试。');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    const timer = setInterval(() => {
      if (!document.hidden) refresh(controller.signal);
    }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) refresh(controller.signal); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  const breeds = useMemo(() => [...new Set(cats.map(c => c.breed).filter(Boolean))].sort(), [cats]);
  const colors = useMemo(() => [...new Set(cats.map(c => c.color).filter(Boolean))].sort(), [cats]);
  const filtered = useMemo(() => cats.filter(c => {
    const term = query.trim().toLowerCase();
    const age = c.age === '' ? NaN : Number(c.age);
    return (!breed || c.breed === breed) && (!color || c.color === color) && (!gender || c.gender === gender)
      && (!term || [c.id, c.breed, c.color].some(v => String(v || '').toLowerCase().includes(term)))
      && (minPrice === '' || (c.price != null && c.price >= Number(minPrice)))
      && (maxPrice === '' || (c.price != null && c.price <= Number(maxPrice)))
      && (minAge === '' || (Number.isFinite(age) && age >= Number(minAge)))
      && (maxAge === '' || (Number.isFinite(age) && age <= Number(maxAge)));
  }), [cats, breed, color, gender, query, minPrice, maxPrice, minAge, maxAge]);
  const hasFilters = Boolean(breed || color || gender || query || minPrice || maxPrice || minAge || maxAge);
  const reset = () => { setBreed(''); setColor(''); setGender(''); setQuery(''); setMinPrice(''); setMaxPrice(''); setMinAge(''); setMaxAge(''); };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white"><Cat size={24} /></div>
            <div><h1 className="text-lg font-bold">喵星猫咪展示</h1><p className="text-xs text-slate-500">查看当前在售猫咪</p></div>
          </div>
          <button type="button" onClick={() => refresh()} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-xs">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />刷新
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div><h2 className="text-xl font-bold">在售猫咪 <span className="text-amber-600">{filtered.length}</span></h2>
            <p className="text-xs text-slate-500 mt-1">每五分钟自动检查更新{updatedAt ? ` · 数据更新于 ${new Date(updatedAt).toLocaleString('zh-CN')}` : ''}</p></div>
          {hasFilters && <button type="button" onClick={reset} className="text-sm text-amber-700 hover:underline flex items-center gap-1"><RotateCcw size={14} />清除筛选</button>}
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="col-span-2 md:col-span-1"><span className="block text-xs text-slate-500 mb-1">搜索</span>
            <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="编号、品种或花色" className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div></label>
          <label><span className="block text-xs text-slate-500 mb-1">品种</span><select value={breed} onChange={e => setBreed(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="">全部品种</option>{breeds.map(v => <option key={v}>{v}</option>)}</select></label>
          <label><span className="block text-xs text-slate-500 mb-1">花色</span><select value={color} onChange={e => setColor(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="">全部花色</option>{colors.map(v => <option key={v}>{v}</option>)}</select></label>
          <label><span className="block text-xs text-slate-500 mb-1">性别</span><select value={gender} onChange={e => setGender(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="">不限</option><option>公</option><option>母</option></select></label>
          <fieldset className="col-span-2 min-w-0"><legend className="text-xs text-slate-500 mb-1">价格区间（元）</legend>
            <div className="flex items-center gap-2"><input aria-label="最低价格" type="number" min="0" step="1" inputMode="numeric" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="最低" className="min-w-0 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              <span className="text-slate-400">—</span><input aria-label="最高价格" type="number" min="0" step="1" inputMode="numeric" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="最高" className="min-w-0 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div></fieldset>
          <fieldset className="col-span-2 min-w-0"><legend className="text-xs text-slate-500 mb-1">月龄区间（月）</legend>
            <div className="flex items-center gap-2"><input aria-label="最小月龄" type="number" min="0" step="1" inputMode="numeric" value={minAge} onChange={e => setMinAge(e.target.value)} placeholder="最小" className="min-w-0 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
              <span className="text-slate-400">—</span><input aria-label="最大月龄" type="number" min="0" step="1" inputMode="numeric" value={maxAge} onChange={e => setMaxAge(e.target.value)} placeholder="最大" className="min-w-0 w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div></fieldset>
        </div>

        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">{error}{cats.length > 0 && ' 当前显示上次成功加载的资料。'}</div>}
        {loading && cats.length === 0 && !error ? <p className="py-16 text-center text-slate-500">正在加载猫咪资料…</p>
          : filtered.length === 0 ? <div className="bg-white rounded-2xl p-12 text-center text-slate-500">{error ? '暂无可显示的数据' : '没有符合条件的猫咪'}<button onClick={reset} className="flex items-center gap-1 mx-auto mt-4 text-amber-700 text-sm"><RotateCcw size={14} />重置筛选</button></div>
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{filtered.map(cat => (
              <article key={cat.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <CatImage cat={cat} onPlay={openVideos} onView={(selectedCat, index) => setPreview({ cat: { ...selectedCat, images: selectedCat.images?.length ? selectedCat.images : [selectedCat.image] }, index })} /><div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold text-lg">{cat.breed || '猫咪'}</h3><span className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded-lg">{cat.color || '花色待补充'}</span></div>
                  <p className="text-sm text-slate-500 mt-3">{cat.gender || '性别待补充'} · {cat.age ? `${cat.age}个月` : '年龄待补充'}</p>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-orange-600 text-lg font-bold">{cat.price == null ? '价格请咨询' : `¥ ${cat.price.toLocaleString('zh-CN')}`}</div>
                </div>
              </article>
            ))}</div>}
      </main>
      {preview && <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setPreview(null); }}>
        <div role="dialog" aria-modal="true" aria-label={`${preview.cat.id}的照片`} className="w-full max-w-5xl">
          <div className="flex items-center justify-between text-white mb-3"><span>{preview.cat.id} · {preview.index + 1}/{preview.cat.images.length}</span>
            <button type="button" onClick={() => setPreview(null)} aria-label="关闭照片" className="p-2 rounded-lg hover:bg-white/20"><X size={22} /></button></div>
          <div className="relative flex items-center justify-center min-h-48">
            <img key={preview.cat.images[preview.index]} src={preview.cat.images[preview.index]} alt={`${preview.cat.breed || '猫咪'}的第${preview.index + 1}张照片`} className="max-h-[75vh] max-w-full object-contain rounded-lg" />
            {preview.cat.images.length > 1 && <>
              <button type="button" aria-label="上一张照片" onClick={() => setPreview(current => ({ ...current, index: (current.index - 1 + current.cat.images.length) % current.cat.images.length }))} className="absolute left-0 rounded-full bg-black/60 text-white p-2 hover:bg-black/80"><ChevronLeft size={24} /></button>
              <button type="button" aria-label="下一张照片" onClick={() => setPreview(current => ({ ...current, index: (current.index + 1) % current.cat.images.length }))} className="absolute right-0 rounded-full bg-black/60 text-white p-2 hover:bg-black/80"><ChevronRight size={24} /></button>
            </>}
          </div>
        </div>
      </div>}
      {playing && <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget) setPlaying(null); }}>
        <div role="dialog" aria-modal="true" aria-label={`${playing.id}的视频`} className="w-full max-w-4xl rounded-2xl bg-slate-900 p-3 sm:p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-4 pb-3 text-white"><strong>{playing.breed || '猫咪'} · {playing.id}</strong>
            <button type="button" onClick={() => setPlaying(null)} aria-label="关闭视频" className="rounded-lg p-2 hover:bg-white/20 focus-visible:outline focus-visible:outline-amber-400"><X size={22} /></button></div>
          {playing.videos.length > 1 && <div className="flex gap-2 pb-3 overflow-x-auto" aria-label="选择视频">
            {playing.videos.map((video, index) => <button key={`${video.url}-${index}`} type="button" onClick={() => { setVideoIndex(index); setVideoError(false); }}
              aria-pressed={videoIndex === index} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${videoIndex === index ? 'bg-orange-500 text-white' : 'bg-slate-700 text-slate-100 hover:bg-slate-600'}`}>
              视频 {index + 1} · {video.name}
            </button>)}
          </div>}
          <video key={playing.videos[videoIndex].url} src={playing.videos[videoIndex].url} poster={playing.image || undefined} controls playsInline preload="metadata" onError={() => setVideoError(true)} className="block w-full max-h-[75vh] rounded-lg bg-black" />
          {videoError && <p role="alert" className="mt-2 text-sm text-red-300">视频加载失败。请确认视频是 MP4 或 WebM，飞书应用已开通素材下载权限。</p>}
        </div>
      </div>}
    </div>
  );
}
