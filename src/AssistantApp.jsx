import React, { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Clipboard, History, LogOut, Plus, Sparkles } from 'lucide-react';

const examples = [
  '你们是一手猫源吗？',
  '这只为什么比别人贵？',
  '能保证没有猫癣吗？',
  '运输安全吗？',
  '定金能退吗？',
  '收到以后生病怎么办？'
];

const newId = () => `chat_${crypto.randomUUID().replaceAll('-', '')}`;

async function api(url, options) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || '请求失败');
  return result;
}

function toneLabel(tone) {
  return tone || '亲切自然';
}

function riskTone(risk) {
  if (risk === 'high') return 'bg-red-50 text-red-700 border-red-200';
  if (risk === 'medium') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-emerald-50 text-emerald-700 border-emerald-200';
}

function riskText(risk) {
  if (risk === 'high') return '高风险';
  if (risk === 'medium') return '中风险';
  return '低风险';
}

function Access({ done }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/api/assistant/login', {
        method: 'POST',
        body: JSON.stringify({ code })
      });
      done(r.user);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-4 py-8 md:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-gradient-to-br from-orange-50 via-white to-emerald-50 p-7 shadow-sm md:p-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-orange-700">
            AI SALES COPILOT
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-900 md:text-5xl">
            遇到不会回的客户消息
            <br className="hidden md:block" />
            先交给助手起草一版
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-stone-600 md:text-base">
            它不是“写作文页面”，而是给销售在聊天途中直接借力的回复工具。把客户原话贴进来，快速拿到一段可以检查、复制、再自行调整的回复草稿。
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            {[
              ['连续对话', '同一个客户可连续追问，减少前情重复。'],
              ['风险提醒', '健康、运输、退款等敏感问题会提醒你别乱承诺。'],
              ['可直接复制', '生成结果支持一键复制，立刻发回给客户。']
            ].map(([title, desc]) => (
              <article key={title} className="rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm backdrop-blur">
                <b className="block text-sm text-stone-900">{title}</b>
                <span className="mt-2 block text-xs leading-6 text-stone-500">{desc}</span>
              </article>
            ))}
          </div>
        </section>

        <form onSubmit={submit} className="rounded-[28px] border border-stone-200 bg-white p-7 shadow-sm md:p-9">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-orange-500 text-white shadow-sm">
            <Bot size={28} />
          </span>
          <h2 className="mt-5 text-2xl font-bold text-stone-900">进入 AI 销售助手</h2>
          <p className="mt-2 text-sm leading-7 text-stone-500">使用管理员发放的个人邀请码进入。建议一个销售只用一个邀请码，方便额度与历史记录管理。</p>
          <label className="mt-7 block text-sm font-medium text-stone-700">
            邀请码
            <input
              type="password"
              value={code}
              onChange={e => setCode(e.target.value)}
              required
              autoFocus
              className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-orange-300 focus:bg-white"
              placeholder="输入你的邀请码"
            />
          </label>
          {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          <button
            disabled={busy}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3.5 font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={17} />
            {busy ? '验证中…' : '进入助手'}
          </button>
          <div className="mt-5 rounded-2xl border border-stone-100 bg-stone-50 px-4 py-4 text-xs leading-6 text-stone-500">
            进入后可直接粘贴客户消息；只有真正生成回复时才会消耗额度。
          </div>
        </form>
      </div>
    </main>
  );
}

function Conversation({ turns, onCopy, copied }) {
  return (
    <div className="space-y-5">
      {turns.map((turn, index) => (
        <div key={`${turn.time || index}-${index}`} className="space-y-3">
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-[22px] rounded-br-md bg-stone-900 px-4 py-3 text-sm leading-7 text-white shadow-sm whitespace-pre-wrap">
              {turn.message}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-orange-500 text-white shadow-sm">
              <Bot size={18} />
            </div>
            <div className="min-w-0 flex-1 rounded-[24px] rounded-tl-md border border-orange-100 bg-white p-4 shadow-sm">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                  {turn.intent || '回复草稿'}
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${riskTone(turn.riskLevel)}`}>
                  {riskText(turn.riskLevel)}
                </span>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] text-stone-500">
                  {toneLabel(turn.tone)}
                </span>
              </div>
              <div className="text-sm leading-7 text-stone-700 whitespace-pre-wrap">{turn.reply}</div>
              <div className="mt-4 flex items-center justify-between border-t border-stone-100 pt-3 text-[11px] text-stone-400">
                <span>{turn.time ? turn.time.replace('T', ' ').slice(0, 16) : '刚刚生成'}</span>
                <button onClick={() => onCopy(turn.reply, index)} className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-3 py-1.5 text-stone-600 transition hover:bg-stone-200">
                  {copied === index ? <Check size={13} /> : <Clipboard size={13} />}
                  {copied === index ? '已复制' : '复制回复'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AssistantApp() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [conversationId, setConversationId] = useState(newId);
  const [turns, setTurns] = useState([]);
  const [message, setMessage] = useState('');
  const [catId, setCatId] = useState('');
  const [tone, setTone] = useState('亲切自然');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    api('/api/assistant/session')
      .then(r => setUser(r.user))
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const conversations = useMemo(() => {
    const map = new Map();
    for (const row of history) {
      if (!map.has(row.conversationId)) map.set(row.conversationId, []);
      map.get(row.conversationId).push(row);
    }
    return [...map.entries()]
      .map(([id, rows]) => ({
        id,
        rows: rows.sort((a, b) => a.time.localeCompare(b.time)),
        latest: rows.at(-1)?.time,
        title: rows[0]?.message || '未命名对话'
      }))
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [history]);

  async function loadHistory() {
    try {
      const r = await api('/api/assistant/history');
      setHistory(r.data || []);
      setShowHistory(true);
    } catch (e) {
      setError(e.message);
    }
  }

  function fresh() {
    setConversationId(newId());
    setTurns([]);
    setMessage('');
    setCatId('');
    setError('');
    setShowHistory(false);
  }

  function openConversation(item) {
    setConversationId(item.id);
    setTurns(item.rows);
    setCatId(item.rows.find(v => v.catId)?.catId || '');
    setShowHistory(false);
    setError('');
  }

  async function generate() {
    const customerMessage = message.trim();
    if (customerMessage.length < 2) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/assistant/reply', {
        method: 'POST',
        body: JSON.stringify({ message: customerMessage, catId, tone, conversationId })
      });
      setTurns(v => [...v, { ...data.data, message: customerMessage, time: new Date().toISOString() }]);
      setMessage('');
      setUser(v => ({ ...v, ...data.user }));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  }

  async function copy(text, index) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(index);
      setTimeout(() => setCopied(null), 1400);
    } catch {
      setError('复制失败，请手动选择回复内容。');
    }
  }

  async function logout() {
    await api('/api/assistant/logout', { method: 'POST', body: '{}' }).catch(() => {});
    setUser(null);
  }

  if (checking) {
    return <div className="grid min-h-screen place-items-center bg-stone-50 text-stone-500">正在打开助手…</div>;
  }

  if (!user) return <Access done={setUser} />;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex min-h-[74px] max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-orange-500 text-white shadow-sm">
              <Bot size={22} />
            </span>
            <div>
              <b className="block text-stone-900">AI 销售助手 · {user.name}</b>
              <small className="block text-[11px] text-stone-400">本月 {user.used}/{user.quota} 次 · 当前为连续对话模式</small>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fresh} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 transition hover:border-stone-300 hover:bg-stone-50">
              <Plus size={15} /> 新对话
            </button>
            <button onClick={loadHistory} className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 transition hover:border-stone-300 hover:bg-stone-50">
              <History size={15} /> 历史
            </button>
            <button onClick={logout} title="退出" className="rounded-xl p-2 text-stone-500 transition hover:bg-stone-100">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="mb-5 grid gap-3 md:grid-cols-3">
          {[
            ['把客户原话直接粘贴进来', '不用先整理成长文，助手会根据上下文生成一版回复草稿。'],
            ['同一个客户尽量放在同一条对话里', 'AI 会参考最近 10 轮内容，所以更换客户时记得点“新对话”。'],
            ['高风险问题先求稳', '健康、运输、退款等内容不要自行乱承诺，先检查 AI 给出的风险提醒。']
          ].map(([title, desc]) => (
            <article key={title} className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
              <b className="block text-sm text-stone-900">{title}</b>
              <span className="mt-2 block text-xs leading-6 text-stone-500">{desc}</span>
            </article>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
          <section className="h-fit rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-stone-900">把客户消息贴进来</h1>
                <p className="mt-1 text-xs leading-6 text-stone-500">如果正在接待客户，这里就是你的“即时辅助区”。</p>
              </div>
              <span className="rounded-full bg-orange-50 px-3 py-1 text-[11px] font-semibold text-orange-700">额度 {user.used}/{user.quota}</span>
            </div>

            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              maxLength={5000}
              className="mt-4 w-full rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm leading-7 outline-none transition focus:border-orange-300 focus:bg-white"
              placeholder="客户刚刚说了什么？直接粘贴原话即可。"
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="text-sm text-stone-700">
                猫咪编号（可选）
                <input
                  value={catId}
                  onChange={e => setCatId(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-orange-300 focus:bg-white"
                  placeholder="例如 C-118"
                />
              </label>
              <label className="text-sm text-stone-700">
                回复风格
                <select
                  value={tone}
                  onChange={e => setTone(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none transition focus:border-orange-300 focus:bg-white"
                >
                  <option>亲切自然</option>
                  <option>简短直接</option>
                  <option>稳重专业</option>
                </select>
              </label>
            </div>

            {!turns.length && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-stone-400">常见问题一键带入</p>
                <div className="flex flex-wrap gap-2">
                  {examples.map(v => (
                    <button
                      key={v}
                      onClick={() => setMessage(v)}
                      className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs text-stone-600 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

            <button
              onClick={generate}
              disabled={busy || message.trim().length < 2}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 py-3.5 font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles size={18} />
              {busy ? '正在结合上下文生成回复…' : '生成本轮回复'}
            </button>

            <div className="mt-4 rounded-2xl border border-stone-100 bg-stone-50 p-4">
              <b className="block text-sm text-stone-800">使用建议</b>
              <ul className="mt-2 space-y-1.5 pl-4 text-xs leading-6 text-stone-500">
                <li>同一个客户尽量持续在同一条对话中追问。</li>
                <li>复制前先看一眼措辞，必要时自己微调。</li>
                <li>涉及健康、售后、运输承诺时，先看风险标签。</li>
              </ul>
            </div>
          </section>

          <section className="rounded-[28px] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h2 className="font-bold text-stone-900">当前客户对话</h2>
                <p className="mt-1 text-xs text-stone-400">{turns.length ? `${turns.length} 轮对话 · 自动保存` : '还没有生成回复'}</p>
              </div>
              {conversationId && <span className="rounded-full bg-stone-100 px-3 py-1 text-[11px] text-stone-500">会话 ID：{conversationId.slice(-8)}</span>}
            </div>

            {turns.length ? (
              <Conversation turns={turns} onCopy={copy} copied={copied} />
            ) : (
              <div className="grid min-h-[520px] place-items-center rounded-[24px] border border-dashed border-stone-200 bg-stone-50/70 text-center text-stone-400">
                <div className="px-6">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-orange-500 shadow-sm">
                    <Bot size={32} />
                  </span>
                  <p className="mt-4 text-base text-stone-600">粘贴客户消息，开始一条连续对话。</p>
                  <p className="mt-2 text-sm leading-7 text-stone-400">它更像是一个销售 Copilot：不会替你成交，但能让你更快给出第一版稳妥回复。</p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {showHistory && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 p-4" onClick={e => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="mx-auto max-w-3xl rounded-[28px] bg-white p-5 shadow-2xl md:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-stone-900">历史客户对话</h2>
                <p className="mt-1 text-xs text-stone-400">选择一条历史记录，可继续在原会话基础上追问。</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600 hover:bg-stone-200">
                关闭
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {conversations.map(item => (
                <button
                  key={item.id}
                  onClick={() => openConversation(item)}
                  className="block w-full rounded-2xl border border-stone-200 p-4 text-left transition hover:border-orange-200 hover:bg-orange-50/40"
                >
                  <div className="text-sm font-semibold text-stone-800">{item.title}</div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-stone-400">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">{item.rows.length} 轮</span>
                    <span className="rounded-full bg-stone-100 px-2.5 py-1">{item.latest?.replace('T', ' ').slice(0, 16)}</span>
                  </div>
                </button>
              ))}
              {!conversations.length && <p className="py-12 text-center text-stone-400">还没有历史对话</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
