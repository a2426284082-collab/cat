import React, { useEffect, useMemo, useState } from 'react';
import { Cat, LogOut, Pencil, RefreshCw, Search, X } from 'lucide-react';

async function api(url, options) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || '请求失败');
  return result;
}

const statuses = ['在售', '已售', '下架'];
const show = value => value === null || value === undefined || value === '' ? '—' : value;

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) }); onLogin(result.user); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  return <main className="min-h-screen grid place-items-center p-5">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="mb-6 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500 text-white"><Cat /></span><div><h1 className="text-xl font-bold">猫源管理台</h1><p className="text-sm text-slate-500">管理员登录</p></div></div>
      <label className="mb-4 block text-sm font-medium">账号<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500" /></label>
      <label className="mb-4 block text-sm font-medium">密码<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-orange-500" /></label>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="w-full rounded-xl bg-orange-500 py-2.5 font-semibold text-white hover:bg-orange-600 disabled:opacity-60">{busy ? '登录中…' : '登录'}</button>
    </form>
  </main>;
}

function Editor({ cat, onClose, onSaved }) {
  const [form, setForm] = useState({ ...cat });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
  async function save(event) {
    event.preventDefault(); setBusy(true); setError('');
    const fields = ['status','breed','color','gender','age','vaccine','price','supplier','supplierOriginalId','costPrice','description','rawDescription','verificationNote'];
    const body = Object.fromEntries(fields.map(key => [key, form[key] ?? '']));
    try { await api(`/api/admin/cats/${encodeURIComponent(cat.recordId)}`, { method: 'PATCH', body: JSON.stringify(body) }); onSaved({ ...cat, ...body }); }
    catch (reason) { setError(reason.message); }
    finally { setBusy(false); }
  }
  const input = (label, key, type = 'text') => <label className="block text-sm font-medium">{label}<input type={type} min={type === 'number' ? 0 : undefined} value={form[key] ?? ''} onChange={e => set(key, e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-500" /></label>;
  return <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-8" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <form onSubmit={save} className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
      <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b bg-white px-5 py-4"><div><h2 className="font-bold">编辑 {cat.id}</h2><p className="text-xs text-slate-500">保存后直接更新飞书多维表格</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={20}/></button></div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">状态<select value={form.status} onChange={e => set('status', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2">{statuses.map(item => <option key={item}>{item}</option>)}</select></label>
        <label className="block text-sm font-medium">性别<select value={form.gender || ''} onChange={e => set('gender', e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2"><option value="">未填写</option><option>公</option><option>母</option><option>未知</option></select></label>
        {input('品种', 'breed')}{input('毛色/花色', 'color')}{input('年龄（月）', 'age', 'number')}{input('疫苗', 'vaccine')}{input('销售供货价', 'price', 'number')}{input('原始采购价', 'costPrice', 'number')}{input('供应商', 'supplier')}{input('供应商原编号', 'supplierOriginalId')}
        {[['对外描述','description'],['原始描述','rawDescription'],['内部核对备注','verificationNote']].map(([label,key]) => <label key={key} className="block text-sm font-medium sm:col-span-2">{label}<textarea rows={3} value={form[key] || ''} onChange={e => set(key, e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-orange-500" /></label>)}
      </div>
      {error && <p className="mx-5 mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3 border-t px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">取消</button><button disabled={busy} className="rounded-lg bg-orange-500 px-5 py-2 font-semibold text-white disabled:opacity-60">{busy ? '保存中…' : '保存到飞书'}</button></div>
    </form>
  </div>;
}

export default function AdminApp() {
  const [user, setUser] = useState(null), [checking, setChecking] = useState(true);
  const [cats, setCats] = useState([]), [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [query, setQuery] = useState(''), [status, setStatus] = useState('全部'), [editing, setEditing] = useState(null);
  useEffect(() => { api('/api/admin/session').then(result => setUser(result.user)).catch(() => {}).finally(() => setChecking(false)); }, []);
  async function load() { setLoading(true); setError(''); try { const result = await api('/api/admin/cats'); setCats(result.data || []); } catch (reason) { setError(reason.message); } finally { setLoading(false); } }
  useEffect(() => { if (user) load(); }, [user]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cats.filter(cat => (status === '全部' || cat.status === status) && (!needle || [cat.id,cat.breed,cat.color,cat.supplier,cat.supplierOriginalId].some(value => String(value || '').toLowerCase().includes(needle))));
  }, [cats, query, status]);
  async function quick(cat, nextStatus) {
    setError('');
    try { await api(`/api/admin/cats/${encodeURIComponent(cat.recordId)}`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }); setCats(items => items.map(item => item.recordId === cat.recordId ? { ...item, status: nextStatus } : item)); }
    catch (reason) { setError(`${cat.id}：${reason.message}`); }
  }
  async function logout() { try { await api('/api/admin/logout', { method: 'POST', body: '{}' }); } finally { setUser(null); setCats([]); } }
  if (checking) return <div className="min-h-screen grid place-items-center text-slate-500">正在检查登录状态…</div>;
  if (!user) return <Login onLogin={setUser} />;
  return <div className="min-h-screen">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-500 text-white"><Cat/></span><div><h1 className="font-bold">猫源管理台</h1><p className="text-xs text-slate-500">直接管理飞书猫源</p></div></div><div className="flex items-center gap-3 text-sm"><span className="hidden text-slate-500 sm:inline">{user.username}</span><button onClick={logout} className="flex items-center gap-1.5 rounded-lg border px-3 py-2 hover:bg-slate-50"><LogOut size={16}/>退出</button></div></div></header>
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-2.5 text-slate-400" size={20}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索猫ID、品种、毛色、供应商、原编号" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 outline-none focus:border-orange-500" /></div><select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5"><option>全部</option>{statuses.map(item => <option key={item}>{item}</option>)}</select><button onClick={load} disabled={loading} className="flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-2.5 hover:bg-slate-50"><RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>刷新</button></div>
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500"><span>共 {cats.length} 只，当前显示 {filtered.length} 只</span></div>
      {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[1050px] w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">猫咪</th><th>品种 / 毛色</th><th>性别 / 年龄</th><th>售价</th><th>供应商 / 原编号</th><th>状态</th><th className="pr-4 text-right">操作</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map(cat => <tr key={cat.recordId} className="hover:bg-slate-50/70"><td className="px-4 py-3"><div className="flex items-center gap-3">{cat.image ? <img src={cat.image} loading="lazy" className="h-14 w-14 rounded-lg object-cover"/> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-slate-100 text-slate-400"><Cat/></span>}<strong>{cat.id}</strong></div></td><td><div>{show(cat.breed)}</div><div className="text-xs text-slate-500">{show(cat.color)}</div></td><td><div>{show(cat.gender)}</div><div className="text-xs text-slate-500">{cat.age == null ? '—' : `${cat.age}个月`}</div></td><td className="font-semibold text-orange-600">{cat.price == null ? '—' : `¥${cat.price}`}</td><td><div>{show(cat.supplier)}</div><div className="text-xs text-slate-500">{show(cat.supplierOriginalId)}</div></td><td><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${cat.status === '在售' ? 'bg-emerald-50 text-emerald-700' : cat.status === '已售' ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700'}`}>{show(cat.status)}</span></td><td className="pr-4"><div className="flex justify-end gap-2"><button onClick={() => quick(cat, cat.status === '在售' ? '已售' : '在售')} className="rounded-lg border px-3 py-1.5 hover:bg-white">{cat.status === '在售' ? '标记已售' : '恢复在售'}</button><button onClick={() => setEditing(cat)} className="rounded-lg border p-2 hover:bg-white" aria-label="编辑"><Pencil size={16}/></button></div></td></tr>)}</tbody></table></div>{!loading && !filtered.length && <p className="py-16 text-center text-slate-500">没有符合条件的猫咪</p>}</div>
    </main>
    {editing && <Editor cat={editing} onClose={() => setEditing(null)} onSaved={updated => { setCats(items => items.map(item => item.recordId === updated.recordId ? updated : item)); setEditing(null); }} />}
  </div>;
}
