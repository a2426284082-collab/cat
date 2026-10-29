import {displayText} from './presentation.js';
import React,{useEffect,useRef,useState} from 'react';
import Dialog from './Dialog.jsx';
export default function AgentConversation({agent,renderResult,cats=[],hidePrices=false}){
 const [draft,setDraft]=useState(''),end=useRef(null);
 useEffect(()=>{end.current?.scrollIntoView?.({block:'nearest'});},[agent.messages,agent.phase]);
 return <Dialog title="智能找猫 · 对话" close={agent.closeConversation} className="agent-conversation" explicitCloseOnly>
  <div className="agent-conversation-body">
   <div className="agent-conversation-messages" role="log" aria-label="找猫助手对话记录">
    {agent.messages.map((row,i)=><article key={row.id||i} className={'agent-bubble '+row.role}>
     <b>{row.role==='user'?'你':'找猫助手'}</b>
     {!(row.role==='assistant'&&i===agent.messages.length-1&&agent.result&&!agent.pending)&&<p>{displayText(row.text,cats,hidePrices)}</p>}
    </article>)}
    {agent.pending&&<div className="agent-progress" role="status"><b>正在理解找猫条件并核对真实库存…</b><p>结果会直接出现在对话中，不会打开拼图、海报或其他工具。</p></div>}
    {!agent.pending&&agent.result&&<div className="agent-conversation-result">{renderResult()}</div>}
    <div ref={end}/>
   </div>
   <form className="agent-conversation-compose" onSubmit={async e=>{e.preventDefault();if(!draft.trim())return;const text=draft;setDraft('');await agent.send(text);}}>
    <label htmlFor="agent-conversation-input">继续找猫、比较，或只替换某一只</label>
    <textarea id="agent-conversation-input" aria-label="继续找猫" maxLength={4000} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="例如：只换第二只，其他三只不变，找一只更便宜的" disabled={agent.pending}/>
    <div><small>本助手只负责真实库存找猫；做图和营销工具在旁边手动使用。</small><button disabled={agent.pending||!draft.trim()}>{agent.pending?'查找中…':'发送'}</button></div>
   </form>
  </div>
 </Dialog>;
}
