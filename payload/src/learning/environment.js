// Scope legacy learning interactions to their own retained page. No eval, no
// document-wide click handlers, and no leakage into the sales or admin UI.
export function learningEnvironment(root){
  const owner=root.ownerDocument,listeners=[],timers=new Set(),observers=[];
  const document=new Proxy(owner,{get(target,key){
    if(key==='body'||key==='documentElement')return root;
    if(key==='querySelector')return selector=>root.querySelector(selector);
    if(key==='querySelectorAll')return selector=>root.querySelectorAll(selector);
    if(key==='getElementById')return id=>[root,...root.querySelectorAll('[id]')].find(el=>el.id===id)||null;
    if(key==='addEventListener')return (type,fn,options)=>{root.addEventListener(type,fn,options);listeners.push([root,type,fn,options]);};
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
  function addEventListener(type,fn,options){window.addEventListener(type,fn,options);listeners.push([window,type,fn,options]);}
  function setTimeout(fn,delay){const id=globalThis.setTimeout(()=>{timers.delete(id);fn();},delay);timers.add(id);return id;}
  class IntersectionObserver{
    constructor(fn,options){this.observer=globalThis.IntersectionObserver?new globalThis.IntersectionObserver(fn,options):null;observers.push(this);}
    observe(node){this.observer?.observe(node);}disconnect(){this.observer?.disconnect();}
  }
  function cleanup(){for(const[target,type,fn,options]of listeners)target.removeEventListener(type,fn,options);for(const timer of timers)globalThis.clearTimeout(timer);for(const observer of observers)observer.disconnect();}
  return{document,addEventListener,setTimeout,IntersectionObserver,cleanup};
}
