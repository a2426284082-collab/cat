export async function salesApi(path,options={}){
 const {timeoutMs=60000,signal,...rest}=options,controller=new AbortController();let timer,abort;
 const interrupted=new Promise((_,reject)=>{abort=()=>{controller.abort();reject(Object.assign(new Error('请求已停止，已发送的AI任务可能仍计次，请核对剩余次数。'),{cancelled:true}));};if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{reject(Object.assign(new Error('等待服务响应超时，未自动重试。请核对配额后重试，或直接点击左侧做图工具。'),{code:'SALES_TIMEOUT'}));controller.abort();},timeoutMs);});
 try{return await Promise.race([interrupted,(async()=>{const response=await fetch(path,{credentials:'same-origin',...rest,signal:controller.signal,headers:{'Content-Type':'application/json',...rest.headers}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.message||'服务暂时不可用，请稍后重试'),{status:response.status,retry_after:data.retry_after,user:data.user});return data;})()]);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
