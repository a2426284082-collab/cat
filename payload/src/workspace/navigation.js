export const WORKSPACE_ROUTES=['/cats/','/manuals/','/guide/','/guide-sales/','/training/','/assistant/'];
export const canonicalPath=path=>path==='/'?path:path.replace(/\/+$/,'')+'/';
export function workspaceDestination(href,base){
  try{const url=new URL(href,base);return url.origin===new URL(base).origin&&WORKSPACE_ROUTES.includes(canonicalPath(url.pathname))?canonicalPath(url.pathname)+url.search+url.hash:null;}catch{return null;}
}
export function eligibleClick(event,anchor){return !!anchor&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&!anchor.hasAttribute('download')&&(!anchor.target||anchor.target==='_self');}
