// Admin requests have a deadline and are never automatically retried, especially writes.
export async function adminApi(url,options={}){
 const {timeoutMs=20000,...fetchOptions}=options,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{const response=await fetch(url,{credentials:'same-origin',...fetchOptions,signal:controller.signal,headers:{'Content-Type':'application/json',...(fetchOptions.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(data.message||'请求失败'),{status:response.status});return data;}
 catch(e){if(controller.signal.aborted)throw Object.assign(new Error('请求超时，结果尚未确认，请刷新核对后再操作'),{code:'ADMIN_REQUEST_TIMEOUT'});throw e;}
 finally{clearTimeout(timer);}
}
