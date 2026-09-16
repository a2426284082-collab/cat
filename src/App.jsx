import React, { useEffect, useMemo, useState } from 'react';
import { Cat, Search, RefreshCw, RotateCcw, ImageOff } from 'lucide-react';

const REFRESH_MS = 5 * 60 * 1000;

function CatImage({ cat }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [cat.image]);
  return (
    <div className="relative aspect-[4/3] bg-amber-50 overflow-hidden">
      {cat.image && !broken ? (
        <img src={cat.image} alt={`${cat.breed || '猫咪'}的照片`} loading="lazy"
          onError={() => setBroken(true)} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-400">
          <ImageOff size={28} /><span className="text-xs">暂无照片</span>
        </div>
      )}
      <span className="absolute top-3 left-3 bg-slate-900/70 text-white text-xs font-semibold px-2.5 py-1 rounded-lg">{cat.id}</span>
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
    return (!breed || c.breed === breed) && (!color || c.color === color) && (!gender || c.gender === gender)
      && (!term || [c.id, c.breed, c.color].some(v => String(v || '').toLowerCase().includes(term)));
  }), [cats, breed, color, gender, query]);
  const reset = () => { setBreed(''); setColor(''); setGender(''); setQuery(''); };

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
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <label className="col-span-2 md:col-span-1"><span className="block text-xs text-slate-500 mb-1">搜索</span>
            <div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="编号、品种或花色" className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" /></div></label>
          <label><span className="block text-xs text-slate-500 mb-1">品种</span><select value={breed} onChange={e => setBreed(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="">全部品种</option>{breeds.map(v => <option key={v}>{v}</option>)}</select></label>
          <label><span className="block text-xs text-slate-500 mb-1">花色</span><select value={color} onChange={e => setColor(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="">全部花色</option>{colors.map(v => <option key={v}>{v}</option>)}</select></label>
          <label><span className="block text-xs text-slate-500 mb-1">性别</span><select value={gender} onChange={e => setGender(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"><option value="">不限</option><option>公</option><option>母</option></select></label>
        </div>

        {error && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5 text-sm">{error}{cats.length > 0 && ' 当前显示上次成功加载的资料。'}</div>}
        {loading && cats.length === 0 && !error ? <p className="py-16 text-center text-slate-500">正在加载猫咪资料…</p>
          : filtered.length === 0 ? <div className="bg-white rounded-2xl p-12 text-center text-slate-500">{error ? '暂无可显示的数据' : '没有符合条件的猫咪'}<button onClick={reset} className="flex items-center gap-1 mx-auto mt-4 text-amber-700 text-sm"><RotateCcw size={14} />重置筛选</button></div>
            : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">{filtered.map(cat => (
              <article key={cat.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <CatImage cat={cat} /><div className="p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold text-lg">{cat.breed || '猫咪'}</h3><span className="text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded-lg">{cat.color || '花色待补充'}</span></div>
                  <p className="text-sm text-slate-500 mt-3">{cat.gender || '性别待补充'} · {cat.age ? `${cat.age}个月` : '年龄待补充'}</p>
                  <div className="mt-4 pt-3 border-t border-slate-100 text-orange-600 text-lg font-bold">{cat.price == null ? '价格请咨询' : `¥ ${cat.price.toLocaleString('zh-CN')}`}</div>
                </div>
              </article>
            ))}</div>}
      </main>
    </div>
  );
}
