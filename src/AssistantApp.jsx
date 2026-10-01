import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowUp, ArrowUpRight, Cat, Check, ChevronDown, Clipboard, History, LogOut, MessageSquare, Plus, ShieldCheck, Sparkles, X } from 'lucide-react';
import './assistant.css';

const examples = [
  { title: '客户觉得价格高', text: '这只为什么比别人贵？', category: '价格沟通', icon: '01' },
  { title: '想确认猫咪健康', text: '能保证没有猫癣吗？', category: '建立信任', icon: '02' },
  { title: '担心运输不安全', text: '运输安全吗？', category: '消除顾虑', icon: '03' },
  { title: '询问定金和售后', text: '定金能退吗？', category: '售后解答', icon: '04' }
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
  if (risk === 'high') return 'risk-high';
  if (risk === 'medium') return 'risk-medium';
  return 'risk-low';
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
    <main className="sales-app access-page">
      <a className="sales-brand" href="/"><span className="brand-mark"><Cat size={23} /></span><span>猫咪销售助手<small>SALES COPILOT</small></span></a>
      <div className="access-layout">
        <section className="access-story">
          <span className="eyebrow">让每一次沟通，更有底气</span>
          <h1>好好聊天，<br />让心动更近一步。</h1>
          <p>从客户的第一句询问，到每一次耐心解答。<br />你的 AI 销售搭档，陪你把话说得更好。</p>
          <div className="access-sample"><span><Sparkles size={17} /> 回复思路示例</span><p>“这只为什么比别人贵？”</p><div>先理解客户的预算，再结合这只猫咪的实际资料，说明值得比较的地方。</div></div>
          <div className="access-features"><span><MessageSquare size={16} /> 连续对话</span><span><ShieldCheck size={16} /> 风险提醒</span><span><Clipboard size={16} /> 一键复制</span></div>
        </section>
        <form onSubmit={submit} className="access-form">
          <span className="brand-mark"><Sparkles size={25} /></span>
          <h2>欢迎回来</h2><p>输入邀请码，开始今天的客户沟通。</p>
          <label htmlFor="access-code">邀请码</label>
          <input id="access-code" type="password" value={code} onChange={e => setCode(e.target.value)} required autoFocus placeholder="请输入你的邀请码" />
          {error && <p className="sales-error" role="alert">{error}</p>}
          <button className="primary-button" disabled={busy}>{busy ? '验证中…' : '进入销售助手'}<ArrowUpRight size={18}/></button>
          <small>只有生成回复时才会消耗额度。</small>
        </form>
      </div>
    </main>
  );
}

function Conversation({ turns, onCopy, copied }) {
  return <div className="turn-list">{turns.map((turn, index) => (
    <article className="conversation-turn" key={`${turn.time || index}-${index}`}>
      <div className="customer-message"><span>客户消息</span><p>{turn.message}</p></div>
      <div className="assistant-message">
        <span className="reply-avatar"><Sparkles size={18}/></span>
        <div className="reply-content">
          <div className="reply-heading"><strong>销售助手</strong><span>为你起草</span></div>
          <div className="reply-tags"><span>{turn.intent || '回复草稿'}</span><span>{toneLabel(turn.tone)}</span><span className={`risk-tag ${riskTone(turn.riskLevel)}`}>{riskText(turn.riskLevel)}</span></div>
          <p className="reply-text">{turn.reply}</p>
          <div className="reply-footer"><button onClick={() => onCopy(turn.reply, index)}>{copied === index ? <Check size={14}/> : <Clipboard size={14}/>} {copied === index ? '已复制' : '复制回复'}</button><time>{turn.time ? new Date(turn.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '刚刚生成'}</time></div>
        </div>
      </div>
    </article>
  ))}</div>;
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const inputRef = useRef(null);
  const shellRef = useRef(null);
  const settingsRef = useRef(null);
  useEffect(() => {
    if (!user) return;
    const viewport = window.visualViewport;
    const small = window.matchMedia('(max-width:900px)');
    const update = () => {
      const shell = shellRef.current;
      if (!shell) return;
      const height = viewport?.height || window.innerHeight;
      shell.style.setProperty('--mobile-app-height', `${height}px`);
      shell.style.setProperty('--mobile-app-top', `${viewport?.offsetTop || 0}px`);
      shell.classList.toggle('keyboard-open', small.matches && height < window.innerHeight - 120);
    };
    document.body.classList.add('assistant-active');
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      document.body.classList.remove('assistant-active');
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [!!user]);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [turns, busy]);
  useEffect(() => {
    if (!showHistory) return;
    const close = e => { if (e.key === 'Escape') setShowHistory(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [showHistory]);

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
    inputRef.current?.blur();
    try {
      const r = await api('/api/assistant/history');
      setHistory(r.data || []);
      setShowHistory(true);
    } catch (e) {
      setError(e.message);
    }
  }

  function fresh() {
    if (busy) return;
    setCopied(null);
    setConversationId(newId());
    setTurns([]);
    setMessage('');
    setCatId('');
    setError('');
    setShowHistory(false);
  }

  function openConversation(item) {
    if (busy) return;
    setMessage('');
    setCopied(null);
    setConversationId(item.id);
    setTurns(item.rows);
    setCatId(item.rows.find(v => v.catId)?.catId || '');
    setShowHistory(false);
    setError('');
  }

  async function generate() {
    const customerMessage = message.trim();
    if (busy || customerMessage.length < 2) return;
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
    fresh();
    setHistory([]);
  }

  if (checking) return <div className="sales-app sales-loading"><Sparkles size={28}/><p>正在打开你的销售工作台…</p></div>;
  if (!user) return <Access done={setUser} />;

  return (
    <div className="sales-app sales-shell" ref={shellRef}>
      <aside className="sales-sidebar">
        <a className="sales-brand" href="/"><span className="brand-mark"><Cat size={23}/></span><span>猫咪销售助手<small>SALES COPILOT</small></span></a>
        <button className="new-chat" onClick={fresh} disabled={busy}><Plus size={18}/> 开始新对话 <span>↗</span></button>
        <div className="sidebar-caption">工作空间</div>
        <button className="sidebar-link active" onClick={() => { setShowHistory(false); inputRef.current?.focus(); }}><MessageSquare size={18}/> 销售对话 <span className="nav-dot"/></button>
        <button className="sidebar-link" onClick={loadHistory} disabled={busy}><History size={18}/> 历史会话 <ArrowUpRight size={14}/></button>
        <div className="sidebar-note"><span className="note-icon"><Sparkles size={18}/></span><h3>每一次回复，都更从容</h3><p>贴上客户原话，剩下的一起想。<br/>同一位客户，接着聊就好。</p><div><span/> 参考最近 10 轮对话</div></div>
        <div className="sidebar-bottom">
          <div className="quota-label"><span>本月使用额度</span><strong>{user.used} <em>/ {user.quota}</em></strong></div>
          <div className="quota-track"><span style={{width: `${Math.min(100, Math.max(0, Number(user.used) / Math.max(1, Number(user.quota)) * 100))}%`}}/></div>
          <div className="account"><span className="account-avatar">{user.name?.slice(0,1) || '销'}</span><div><strong>{user.name}</strong><small>销售工作台</small></div><button onClick={logout} disabled={busy} aria-label="退出登录" title="退出登录"><LogOut size={17}/></button></div>
        </div>
      </aside>

      <main className="sales-main">
        <header className="workspace-header"><div className="mobile-header-brand"><a className="mobile-home" href="/manuals/" aria-label="返回销售支持中心"><ArrowLeft size={20}/></a><span className="header-title">销售助手<small className="mobile-account-info">{user.name} · 本月 {user.used}/{user.quota} 次</small></span><span className="header-divider"/><span className="header-subtitle">你的专属沟通搭档</span></div><div className="header-actions"><span className="context-badge"><span/> 连续对话</span><button className="mobile-action" onClick={fresh} disabled={busy} aria-label="新对话"><Plus size={19}/><small>新对话</small></button><button className="mobile-action" onClick={loadHistory} disabled={busy} aria-label="历史会话"><History size={19}/><small>历史</small></button><button className="mobile-action" onClick={logout} disabled={busy} aria-label="退出登录"><LogOut size={18}/><small>退出</small></button></div></header>
        <div className="chat-scroll">
          {!turns.length && !busy ? <section className="welcome">
            <div className="welcome-symbol"><Sparkles size={30} strokeWidth={1.5}/></div>
            <div className="eyebrow">你的 AI 销售搭档</div>
            <h1>这位客户，我们一起聊。</h1>
            <p>粘贴客户的消息，把难回答的话，变成自然的沟通。</p>
            <div className="scenario-heading"><span>不知道怎么开口？从这里开始</span><span>点击带入 <ArrowUpRight size={13}/></span></div>
            <div className="scenario-grid">{examples.map(item => <button key={item.icon} className="scenario-card" onClick={() => {setMessage(item.text); inputRef.current?.focus();}}><div><span className="scenario-number">{item.icon}</span><span className="scenario-category">{item.category}</span><ArrowUpRight size={15}/></div><strong>{item.title}</strong><p>“{item.text}”</p></button>)}</div>
          </section> : <div className="conversation-area"><div className="conversation-meta"><span>当前客户对话</span><span>{turns.length} 轮 · 回复自动保存</span></div><Conversation turns={turns} onCopy={copy} copied={copied}/>{busy && <div className="thinking" role="status"><Sparkles size={19}/><span>正在结合客户上下文，整理回复<span className="thinking-dots">…</span></span></div>}<div ref={endRef}/></div>}
        </div>
        <div className="composer-area">
          {error && <p className="sales-error" role="alert">{error}</p>}
          <form className="composer" onSubmit={e => {e.preventDefault(); generate();}}>
            <div className="composer-context"><span><span className="tiny-dot"/>{turns.length ? '继续当前客户的对话' : '客户说了什么？'}</span><button type="button" disabled={busy} onClick={() => {setSettingsOpen(true); settingsRef.current?.showModal();}} aria-expanded={settingsOpen} aria-controls="reply-settings">{tone}{catId ? ` · ${catId}` : ''}<ChevronDown size={14} className={settingsOpen ? 'rotated' : ''}/></button></div>

            <textarea ref={inputRef} aria-label="客户消息" value={message} onChange={e => setMessage(e.target.value)} disabled={busy} maxLength={5000} rows={2} placeholder="粘贴客户原话，或补充你想咨询的问题…" onKeyDown={e => {if(e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.nativeEvent.isComposing) {e.preventDefault(); generate();}}}/>
            <div className="composer-toolbar"><span><MessageSquare size={14}/><span className="desktop-hint">支持连续追问</span><span className="character-count">{message.length} / 5000</span></span><button className="send-button" type="submit" disabled={busy || message.trim().length < 2}><span>{busy ? '正在生成' : '生成回复'}</span><ArrowUp size={17}/></button></div>
          </form>
          <div className="composer-footnote"><span><ShieldCheck size={13}/> 发送前，请核对猫咪资料与承诺内容</span><span className="desktop-hint">Ctrl / ⌘ + Enter 发送</span></div>
        </div>
      </main>
      <dialog ref={settingsRef} className="reply-settings-dialog" aria-label="回复设置" onClose={() => setSettingsOpen(false)} onClick={e => { if(e.target === e.currentTarget) settingsRef.current?.close(); }}>
        <form method="dialog"><header><div><h2>回复设置</h2><p>补充猫咪编号，让回复更贴近当前客户。</p></div><button className="settings-close" aria-label="关闭回复设置"><X size={21}/></button></header>
          <div className="composer-settings" id="reply-settings"><label>猫咪编号（可选）<input value={catId} onChange={e => setCatId(e.target.value)} disabled={busy} placeholder="例如 C-118"/></label><label>回复风格<select value={tone} onChange={e => setTone(e.target.value)} disabled={busy}><option>亲切自然</option><option>简短直接</option><option>稳重专业</option></select></label></div>
          <button className="settings-done">完成设置</button>
        </form>
      </dialog>
      {showHistory && <div className="history-overlay" onClick={e => e.target === e.currentTarget && setShowHistory(false)}><section className="history-dialog" role="dialog" aria-modal="true" aria-label="历史客户对话" onKeyDown={e => {if(e.key !== 'Tab') return; const els = e.currentTarget.querySelectorAll('button:not(:disabled)'); const first=els[0], last=els[els.length-1]; if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();} else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}}}><header><div><h2>历史客户对话</h2><p>找到之前的沟通，接着聊。</p></div><button autoFocus onClick={() => {setShowHistory(false);inputRef.current?.focus();}} aria-label="关闭历史会话"><X size={21}/></button></header><div className="history-list">{conversations.map(item => <button key={item.id} disabled={busy} onClick={() => openConversation(item)} className="history-item"><MessageSquare size={18}/><span><strong>{item.title}</strong><small>{item.rows.length} 轮对话 · {item.latest?.replace('T', ' ').slice(0,16)}</small></span><ArrowUpRight size={17}/></button>)}{!conversations.length && <div className="history-empty"><History size={32}/><p>还没有历史对话</p><small>生成第一条回复后，会自动保存在这里。</small></div>}</div></section></div>}
    </div>
  );
}
