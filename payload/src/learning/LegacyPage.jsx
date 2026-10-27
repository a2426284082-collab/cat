import React,{useEffect,useRef} from 'react';
export default function LegacyPage({html,css,mount,kind}){
  const root=useRef(null);
  useEffect(()=>{
    const node=root.current;
    node.innerHTML=html;
    const cleanup=mount(node);
    window.dispatchEvent(new CustomEvent('workspace:content-ready'));
    return()=>{cleanup?.();node.innerHTML='';};
  },[html,mount]);
  return <><style>{css}</style><div ref={root} className={`workspace-learning workspace-${kind}`} id={kind==='basics'?'top':undefined}/></>;
}
