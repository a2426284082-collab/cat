import {displayText} from './presentation.js';
import React,{useEffect,useRef,useState} from 'react';
import Dialog from './Dialog.jsx';
export default function AgentConversation({agent,renderResult,cats=[],hidePrices=false,pricingControl=null}){
 const [draft,setDraft]=useState(''),end=useRef(null);
 useEffect(()=>{end.current?.scrollIntoView?.({block:'nearest'});},[agent.messages,agent.phase]);
 return <Dialog title="智能找猫 · 对话" close={agent.closeConversation} className="agent-conversation" explicitCloseOnly>
  <div className="agent-conversation-body">
   <div className="agent-conversation-messages" role="log" aria-label="找猫助手对话记录">
    {agent.messages.map((row,i)=><article key={row.id||i} className={'agent-bubble '+row.role}>
     <b>{row.role==='user'?'你':'找猫助手'}</b>
     {!(row.role==='assistant'&&i===agent.messages.length-1&&agent.result&&!agent.pending)&&<p>{displayText(row.text,cats,hidePrices)}</p>}
    </article>)}
    {agent.pending&&<div className="agent-progress" role="status"><b>AI正在理解问题、查询所需资料…</b></div>}
    {!agent.pending&&agent.result&&<div className="agent-conversation-result">{renderResult()}</div>}
    <div ref={end}/>
   </div>
   {pricingControl}
   <form className="agent-conversation-compose" onSubmit={async e=>{e.preventDefault();if(!draft.trim())return;const text=draft;setDraft('');await agent.send(text);}}>
    <label htmlFor="agent-conversation-input">继续找猫、换猫，或问合作、发货与售后规则</label>
    <textarea id="agent-conversation-input" aria-label="继续找猫" maxLength={4000} rows={2} value={draft} onChange={e=>setDraft(e.target.value)} placeholder="例如：只换第二只；或问：售后需要准备什么资料？" disabled={agent.pending}/>
    <div><button disabled={agent.pending||!draft.trim()}>{agent.pending?'查找中…':'发送'}</button></div>
   </form>
  </div>
 </Dialog>;
}
