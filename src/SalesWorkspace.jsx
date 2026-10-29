// ADMIN_CONTROL_PATCH_V1
import {WorkbenchConfigProvider,useWorkbenchConfig,WorkbenchNotice} from './workspace/WorkbenchConfig.jsx';
import React,{lazy,Suspense,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {BrowserRouter,Link,useLocation,useNavigate} from 'react-router-dom';
import {ArrowLeft,ArrowRight,BookOpen,Cat,Check,ChevronRight,GraduationCap,LayoutGrid,MessageSquare,RefreshCw,ShieldCheck,Sparkles,X} from 'lucide-react';
import SalesAI,{AIResult} from './components/SalesAI.jsx';
import {SalesSessionProvider,useSalesSession} from './workspace/SalesSession.jsx';
import Dialog from './workspace/Dialog.jsx';
import {displayText,money,normalizeId,shortIdMap,priceSettings,displayedPrice} from './workspace/presentation.js';
import {CatalogProvider,useCatalog} from './workspace/catalog.jsx';
import {canonicalPath,eligibleClick,workspaceDestination} from './workspace/navigation.js';
import './workspace/workspace.css';
import './workspace/workflow.css';
import './workspace/theme.css';
import MarketingStudio from './workspace/MarketingStudio.jsx';
import {pickMarketingCats} from './workspace/marketing.js';
import './workspace/marketing.css';
import {FollowupProvider,FollowupDrawer,useFollowups} from './workspace/followups.jsx';
import CatTools from './workspace/CatTools.jsx';
import SmartImage from './workspace/SmartImage.jsx';
import './workspace/practical.css';
import SidebarUtilities from './workspace/SidebarUtilities.jsx';
import {WORKSPACE_FEATURES} from './workspace/features.js';
import './workspace/layout.css';
import {AgentContext,useWorkspaceAgent} from './workspace/AgentContext.jsx';
import {filterAgentCats,agentParams,mergeMatchNeed,exactReplacementAllowed} from './workspace/agent.js';
import {orderCommand,provinces} from './workspace/sales-tools.js';
import {clearPreviewCache} from './workspace/media.js';
import {renderPosterHeadless} from './workspace/poster-headless.js';
import './workspace/agent.css';
import './workspace/mobile-office.css';

const loaders={
  '/cats/':()=>import('./App.jsx'),'/manuals/':()=>import('./workspace/SupportPage.jsx'),
  '/guide/':()=>import('./learning/BasicsPage.jsx'),'/guide-sales/':()=>import('./learning/MethodsPage.jsx'),'/training/':()=>import('./learning/TrainingPage.jsx'),
};
const Catalog=lazy(loaders['/cats/']),Support=lazy(loaders['/manuals/']),Basics=lazy(loaders['/guide/']),Methods=lazy(loaders['/guide-sales/']),Training=lazy(loaders['/training/']);
const pages=[['/cats/',Catalog],['/manuals/',Support],['/guide/',Basics],['/guide-sales/',Methods],['/training/',Training]].filter(([route])=>WORKSPACE_FEATURES.training||route!=='/training/');
const nav=[{to:'/cats/',label:'在售猫源库',hint:'输入需求挑猫，卡片直接写话术',icon:LayoutGrid},{to:'/manuals/',label:'销冠手册与售后',hint:'合作规则、销路教程与售后',icon:BookOpen},{to:'/training/',label:'新手模拟带练',hint:'用模拟客户练一遍接单流程',icon:GraduationCap}].filter(item=>WORKSPACE_FEATURES.training||item.to!=='/training/');
const titles={'/cats/':'在售猫源库','/manuals/':'销冠手册与售后','/guide/':'基础与成交手册','/guide-sales/':'销路实操手册','/training/':'新手模拟带练'};
const primaryRoute=path=>['/guide/','/guide-sales/'].includes(path)?'/manuals/':path;
function preload(path){if(navigator.connection?.saveData||(!WORKSPACE_FEATURES.training&&path==='/training/'))return;loaders[path]?.().catch(()=>{});}
class PageBoundary extends React.Component{
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return{failed:true};}
  componentDidCatch(){console.warn('workspace_page_failed');}
  render(){return this.state.failed?<div className="workspace-empty" role="alert"><h2>这个页面暂时没能打开</h2><p>已打开的其他工作区仍可继续使用。</p><button type="button" onClick={()=>window.location.reload()}>刷新此页面</button></div>:this.props.children;}
}
function PageSkeleton(){return <div className="workspace-loading" role="status"><span/><div/><div/><p>正在打开工作区…</p></div>;}
function Workspace(){
  const {config:workbenchConfig,ready:configReady}=useWorkbenchConfig();
  const location=useLocation(),navigate=useNavigate(),rawPath=canonicalPath(location.pathname),path=rawPath==='/assistant/'||(!WORKSPACE_FEATURES.training&&rawPath==='/training/')?'/cats/':rawPath,{cats,refresh}=useCatalog();
  const salesSession=useSalesSession(),{ask,busy,cooldown,user,epoch}=salesSession,labels=shortIdMap(cats),followups=useFollowups();
  const visited=useRef(new Set());visited.current.add(path);
  const [detailTool,setDetailTool]=useState(null),[catalogCommand,setCatalogCommand]=useState(null);
  const [compare,setCompare]=useState([]),[notice,setNotice]=useState(''),[detail,setDetail]=useState(null),[job,setJob]=useState(null);
  const [customerDisplay,setCustomerDisplay]=useState(()=>{try{const saved=localStorage.getItem('sales-customer-display');return saved?priceSettings(JSON.parse(saved)):priceSettings({enabled:localStorage.getItem('sales-hide-prices')==='1',markup:localStorage.getItem('sales-hide-prices')==='1'?0:800});}catch{return priceSettings({});}});
  const [marketing,setMarketing]=useState(null),[utilitiesOpen,setUtilitiesOpen]=useState(false);
  const configDefaults=useRef(false);useEffect(()=>{if(configReady&&!configDefaults.current){configDefaults.current=true;try{if(!localStorage.getItem('sales-customer-display')&&!localStorage.getItem('sales-hide-prices'))setCustomerDisplay(old=>({...old,markup:workbenchConfig.defaultMarkup}));}catch{}}},[configReady]);
  const hidePrices=customerDisplay.enabled,priorSalesIdentity=useRef(salesSession.listingIdentity);
  useEffect(()=>{const prior=priorSalesIdentity.current;priorSalesIdentity.current=salesSession.listingIdentity;if(prior.startsWith('sales:')&&prior!==salesSession.listingIdentity){headlessAbort.current?.abort();setMarketing(null);setDetail(null);setJob(null);setCompare([]);}},[salesSession.listingIdentity]);
  const panel=useRef(null),positions=useRef({}),active=useRef(path),restorePending=useRef(false);
  useEffect(()=>{if(rawPath==='/assistant/'||(!WORKSPACE_FEATURES.training&&rawPath==='/training/'))navigate('/cats/'+location.search+location.hash,{replace:true});},[rawPath]);
  useEffect(()=>{setJob(null);setDetail(null);setCompare([]);},[epoch]);
  function privacy(value){const next=priceSettings(value);setCustomerDisplay(next);if(next.enabled&&!customerDisplay.enabled){setJob(null);}try{localStorage.setItem('sales-customer-display',JSON.stringify(next));localStorage.removeItem('sales-hide-prices');}catch{}}

  function openMarketing(template='price',ids){
    if(!workbenchConfig.posterEnabled){setNotice('营销拼图功能已被管理员暂停');return;}
    const selected=ids?ids.map(id=>cats.find(c=>c.id===id)).filter(Boolean):pickMarketingCats(cats).slice(0,workbenchConfig.defaultPosterCount);
    if(ids&&selected.length!==ids.length){setNotice('已选猫咪库存有变化，请刷新并重新选择');return;}
    if(selected.length<2||selected.length>9){setNotice('拼图需要2至9只有照片的在售猫咪，请继续选猫');return;}
    if(selected.some(c=>!c.image)){setNotice('所选猫咪有缺少照片的，请替换后再生成');return;}
    setMarketing({cats:selected,template,key:crypto.randomUUID(),settings:{markup:customerDisplay.markup}});setUtilitiesOpen(false);agent.recordTask('poster',{task:'poster',cat_ids:selected.map(c=>normalizeId(c.id)),params:{count:selected.length,includePrices:template!=='sign',bannerEnabled:template==='sign',platform:'xhs',height:1080,markup:customerDisplay.markup,mirrorEnabled:true},need:'',focus_id:null},'已打开拼图编辑器，可以从这条任务卡重新打开。');
  }
  const routeOrigin=window.location.origin==='null'?'https://workspace-preview.local':window.location.origin;
  const routeBase=routeOrigin+location.pathname+location.search+location.hash;
  function remember(){positions.current[active.current]=window.scrollY||0;}
  function restore(){
    const current=path;
    if(current!==active.current)return;
    const pane=panel.current?.querySelector('[data-active="true"]');
    if(location.hash&&pane){
      let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
      const target=[pane,...pane.querySelectorAll('[id]')].find(el=>el.id===id);
      if(target){target._setOpen?.(true);if(target.classList.contains('method')&&!target.classList.contains('is-open'))target.querySelector('.method-toggle')?.click();target.scrollIntoView({block:'start',behavior:'instant'});restorePending.current=false;return;}
    }
    window.scrollTo({top:positions.current[current]||0,left:0,behavior:'instant'});restorePending.current=false;
  }
  useLayoutEffect(()=>{
    active.current=path;restorePending.current=true;
    setDetail(null);
    document.title=`${titles[path]||'销售工作台'} · 猫咪合作平台`;
    const frame=requestAnimationFrame(restore);
    return()=>cancelAnimationFrame(frame);
  },[path,location.hash]);
  useEffect(()=>{
    const scroll=()=>{if(!restorePending.current)remember();};
    const pop=()=>{remember();restorePending.current=true;};
    const ready=()=>requestAnimationFrame(restore);
    window.addEventListener('scroll',scroll,{passive:true});window.addEventListener('popstate',pop);window.addEventListener('workspace:content-ready',ready);
    return()=>{window.removeEventListener('scroll',scroll);window.removeEventListener('popstate',pop);window.removeEventListener('workspace:content-ready',ready);};
  },[path,location.hash]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),2600);return()=>clearTimeout(timer);},[notice]);
  function routeClick(event){
    if(event.defaultPrevented)return;
    const anchor=event.target.closest?.('a[href]');
    if(!eligibleClick(event,anchor))return;
    const destination=workspaceDestination(anchor.getAttribute('href'),routeBase);
    if(!destination)return;
    event.preventDefault();remember();
    const same=destination===location.pathname+location.search+location.hash;
    if(same){window.scrollTo({top:0,behavior:'smooth'});return;}
    navigate(destination);
  }
  async function runScript(ids,action){
    const id=crypto.randomUUID();agent.remember({task:action,cat_ids:ids.map(normalizeId),params:{},focus_id:null});setDetail(null);setJob({id,ids,action,loading:true,result:null,error:''});
    try{const result=await ask({mode:'script',action,cat_ids:ids.map(normalizeId),hide_prices:hidePrices});setJob(current=>current?.id===id?{...current,loading:false,result}:current);}
    catch(e){setJob(current=>current?.id===id?(e.cancelled?null:{...current,loading:false,error:e.message}):current);}
  }
  function toggleCompare(cat){setCompare(items=>{if(items.includes(cat.id))return items.filter(id=>id!==cat.id);if(items.length>=9){setNotice('最多选择9只，请先移除一只');return items;}return [...items,cat.id];});}
  function showDetail(cat,tool='',params={}){
    setDetail(cat);setDetailTool(tool?{id:crypto.randomUUID(),tool,params}:null);
    const id=normalizeId(cat.id);agent.remember(agent.context.cat_ids.includes(id)?{focus_id:id}:{task:'details',cat_ids:[id],focus_id:id,params:{}});
  }
  // Autopilot must wait for the canvas to actually render. Opening the dialog
  // alone is not a successful image task.
  const posterRenderReceipt=useRef(null);
  const headlessAbort=useRef(null);
  function settlePosterRender(status){
    const pending=posterRenderReceipt.current;if(!pending)return;
    posterRenderReceipt.current=null;clearTimeout(pending.timer);
    status?.status==='ready'?pending.resolve():pending.reject(new Error(status?.text||'浏览器没有成功渲染拼图'));
  }
  const posterOperationReceipt=useRef(null);
  function settlePosterOperation(status){
    const pending=posterOperationReceipt.current;
    if(!pending||pending.operation!==status?.operation)return;
    posterOperationReceipt.current=null;clearTimeout(pending.timer);
    status.status==='ready'?pending.resolve():pending.reject(new Error(status.text||'浏览器操作失败'));
  }
  async function executeAgent(plan,current,{caption,restore=false,verifyRender=false,silentPoster=false,onProgress,taskId,goalId}={}){ 
    if(plan.tool==='show_matches'){setMarketing(null);setDetail(null);navigate('/cats/');return {text:'已返回库存结果。'};}
    const switches={poster:'posterEnabled',downloads:'downloadsEnabled',single_poster:'singlePosterEnabled',calculator:'calculatorEnabled'};if(switches[plan.tool]&&!workbenchConfig[switches[plan.tool]])return {ok:false,text:'这项功能已被管理员暂停。'};
    const params=agentParams(plan.params||{}),requested=plan.cat_ids?.length?plan.cat_ids:current.focus_id?[current.focus_id]:current.cat_ids||[];
    const find=id=>cats.find(c=>normalizeId(c.id)===id&&(!c.status||c.status==='在售'));
    const tools=['details','downloads','single_poster','calculator','order'];
    if(tools.includes(plan.tool)){
      if(requested.length!==1||!find(requested[0]))return {ok:false,text:'请明确是哪一只在售猫，例如“下载 #017 的视频”，或“看第一只的资料”。'};
      if(hidePrices&&['calculator','order'].includes(plan.tool))return {ok:false,text:'对客模式不显示内部底价和收益，请先关闭对客模式。'};
      const cat=find(requested[0]);if(plan.tool==='calculator'&&params.province&&!provinces.includes(params.province))return {ok:false,text:'请选择速算器支持的省份，并填写核实后的运费。'};
      if(plan.tool==='order')return {result:{kind:'copy',used_ai:false,matched_ids:[],reply_text:orderCommand(cat,labels.get(normalizeId(cat.id)))+'\n\n复制后发给负责人核实；此操作没有自动锁定库存。'}};
      showDetail(cat,{downloads:'download',single_poster:'poster',calculator:'freight'}[plan.tool]||'',params);
      return {text:plan.tool==='downloads'?'已打开原素材下载面板，请点击文件链接保存。':plan.tool==='single_poster'?'已打开单猫详情海报，可核对零售价后下载。':plan.tool==='calculator'?'已打开速算器；运费需填写核实后的估算。':'已打开猫咪资料。'};
    }
    if(plan.tool==='client_view'){const next={...customerDisplay,...params};if(/切换/.test(plan.query||''))next.enabled=!customerDisplay.enabled;privacy(next);return {text:next.enabled?'已更新对客报价设置，对客模式已开启。':'已更新对客报价设置，对客模式保持关闭。'};}
    if(plan.tool==='handbook'){navigate('/manuals/');return {text:'已打开手册与售后FAQ，请选择对应问题查看原文。'};}
    if(plan.tool==='catalog'){
      navigate('/cats/');if(/修复图片缓存/.test(plan.query||'')){await clearPreviewCache();await refresh({manual:true});return {text:'已清理本应用图片缓存并请求刷新库存，本地报价和激活数据保留。'};}
      if(params.refresh)await refresh({manual:true});setCatalogCommand({id:crypto.randomUUID(),query:plan.query||'',...params});return {text:params.shuffle?'已随机换一批，筛选条件保留。':params.refresh?'已请求刷新猫源，请查看最新状态。':'已更新列表筛选。'};
    }
    if(plan.tool==='poster'){
      const continuing=current.task==='poster',base=continuing?current.params:{markup:customerDisplay.markup,includePrices:true,bannerEnabled:false,platform:'xhs',height:1080,mirrorEnabled:true};
      const settings={...base,...params};if(caption)delete settings.operation;
      // A precise edit is checked against the ORIGINAL hard requirements,
      // not re-parsed as a new four-cat search with the customer's follow-up.
      const query=continuing?(params.operation==='replace'?current.need:mergeMatchNeed(current.need,plan.query||'',cats)):plan.query||'';
      const pool=filterAgentCats(cats,query).filter(c=>c.image),poolIds=new Set(pool.map(c=>normalizeId(c.id)));
      let ids=plan.cat_ids?.length>=2?plan.cat_ids:continuing?current.cat_ids:[];
      if(params.quote!=null){const target=plan.cat_ids?.length?plan.cat_ids:current.focus_id?[current.focus_id]:current.cat_ids;if(target?.length!==1||!find(target[0]))return {ok:false,text:'单只改价请带编号，例如“#017 的价格改成1400”。'};if(Number(find(target[0]).price)>params.quote)return {ok:false,text:'海报报价不能低于当前合作底价，请重新核对。'};settings.quoteTarget=target[0];}
      const count=settings.count||((plan.cat_ids?.length>=2)?plan.cat_ids.length:ids.length||9);
      if(params.operation==='batch')ids=[];
      const replacing=params.operation==='replace';if(replacing&&(!continuing||!Number.isInteger(params.replaceIndex)||params.replaceIndex>=ids.length))return {ok:false,text:'要替换哪一只？请先生成拼图，再说“换掉第二只”。'};
      if(replacing){
        if(verifyRender){
          // The server has already selected and verified the exact replacement.
          // Never let the browser randomly change it a second time.
          const original=current.cat_ids||[];
          const availableIds=new Set(cats.filter(c=>(!c.status||c.status==='在售')&&c.image).map(c=>normalizeId(c.id)));
          if(!exactReplacementAllowed(original,ids,params.replaceIndex,availableIds))
            return {ok:false,text:'替换方案与上次拼图不一致，已停止操作，其余猫咪保持不变。'};
        }else{
          const alternatives=pool.filter(c=>!ids.includes(normalizeId(c.id)));
          if(!alternatives.length)return {ok:false,text:'当前没有其他符合条件且有照片的猫，原拼图已保留。'};
          ids=[...ids];ids[params.replaceIndex]=normalizeId(alternatives[Math.floor(Math.random()*alternatives.length)].id);
        }
      }
      let chosen=ids.map(find).filter(c=>c?.image&&(replacing&&verifyRender||poolIds.has(normalizeId(c.id)))).slice(0,count);
      if(replacing&&verifyRender&&chosen.length!==ids.length)return {ok:false,text:'替换后的猫咪未通过库存或原筛选条件校验，原拼图未修改。'};
      if(!replacing&&chosen.length<count){const used=new Set(chosen.map(c=>normalizeId(c.id)));chosen=[...chosen,...pickMarketingCats(pool).filter(c=>!used.has(normalizeId(c.id))).slice(0,count-chosen.length)];}
      if(chosen.length<2)return {ok:false,text:'符合条件且有照片的在售猫不足2只，当前拼图保持原样，请放宽条件后再试。'};
      settings.count=chosen.length;const control={id:crypto.randomUUID(),params:settings,cats:chosen,caption};
      const quotes=continuing?{...(current.quotes||{})}:{};if(settings.quoteTarget)quotes[settings.quoteTarget]=params.quote;
      // Agent work is done in an off-screen canvas without opening an editor.
      // The editor is retained only for explicit manual reopening.
      if(silentPoster&&!restore){
        const cleanSettings={...settings};for(const k of ['operation','quoteTarget','quote','replaceIndex'])delete cleanSettings[k];
        const posterContext={task:'poster',cat_ids:chosen.map(c=>normalizeId(c.id)),params:cleanSettings,
          need:query,quotes,focus_id:null};
        if(caption){
          // Writing copy is a distinct deliverable. Do not render the same PNG
          // for a second time when the caption is generated.
          return {text:'推荐文案已生成，将在对话中单独交付。',context:posterContext};
        }
        // The active job belongs to the currently signed-in account. A change
        // of account or a new job can cancel it instead of leaving a spinner.
        headlessAbort.current?.abort();
        const controller=new AbortController();headlessAbort.current=controller;
        try{
          const artifact=await renderPosterHeadless({cats:chosen,settings:{...cleanSettings,overrides:quotes,
              designSeed:continuing?current.designSeed:undefined,bannerText:current.bannerText},
            owner:salesSession.listingIdentity,taskId,goalId,signal:controller.signal,onProgress});
          posterContext.designSeed=artifact.designSeed;
          return {artifact,context:posterContext,
            text:artifact.persisted?`已在浏览器内部合成${chosen.length}只猫的高清PNG，图片预览和下载入口在本次对话中；没有自动保存到电脑。`:
              `已合成${chosen.length}只猫的高清PNG，但浏览器无法持久保存。请在当前会话立即下载。`};
        }finally{if(headlessAbort.current===controller)headlessAbort.current=null;}
      }
      const verifyOperation=verifyRender&&['download','copy'].includes(params.operation);
      const operationPromise=verifyOperation?new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{settlePosterOperation({operation:params.operation,status:'error',text:'浏览器操作超时'})},30000);
        posterOperationReceipt.current={operation:params.operation,timer,resolve,reject};
      }):null;
      const renderPromise=verifyRender&&!caption&&!verifyOperation?new Promise((resolve,reject)=>{
        if(posterRenderReceipt.current)settlePosterRender({status:'error',text:'图片预览被新的任务替换'});
        const timer=setTimeout(()=>{settlePosterRender({status:'error',text:'图片渲染超时，请检查照片是否可正常加载'})},30000);
        posterRenderReceipt.current={resolve,reject,timer};
      }):null;
      setMarketing(old=>old&&continuing&&!restore?{...old,control}:{cats:chosen,template:settings.includePrices===false?'sign':'price',key:crypto.randomUUID(),settings:{...settings,overrides:quotes,designSeed:continuing?current.designSeed:undefined,caption:caption??(continuing?current.caption:undefined),bannerText:continuing?current.bannerText:undefined},control:params.operation&&!caption?control:null});
      if(renderPromise)await renderPromise;
      if(operationPromise)await operationPromise;
      const cleanSettings={...settings};delete cleanSettings.operation;delete cleanSettings.quoteTarget;delete cleanSettings.quote;delete cleanSettings.replaceIndex;
      return {text:params.operation==='download'?'已请求下载当前预览；若画面还在更新，请等待后点击下载。':caption?'文案已生成并放进当前拼图，无需再次执行。':`已准备${chosen.length}只在售猫的拼图${settings.includePrices===false?'，不显示价格':''}，可在弹窗继续调整。`,context:{task:'poster',cat_ids:chosen.map(c=>normalizeId(c.id)),params:cleanSettings,need:query,quotes,focus_id:null}};
    }
    return {ok:false,text:'当前没有可执行的对应操作，请说具体的选猫或素材任务。'};
  }
  const agent=useWorkspaceAgent({cats,session:{...salesSession,hidePrices,markup:customerDisplay.markup},execute:executeAgent,onReset:()=>{headlessAbort.current?.abort();setMarketing(null);setDetail(null);setJob(null);setCompare([]);}});
  return <AgentContext.Provider value={agent}><div className={`sales-workspace workflow-workspace${hidePrices?' customer-view':''}`} onClickCapture={event=>{const anchor=event.target.closest?.('a[href]');if(eligibleClick(event,anchor)&&workspaceDestination(anchor.getAttribute('href'),routeBase))remember();}} onClick={routeClick} onPointerOver={event=>{const href=event.target.closest?.('a[href]')?.getAttribute('href');if(href){const destination=workspaceDestination(href,routeBase);if(destination)preload(canonicalPath(new URL(destination,routeBase).pathname));}}}>
    <header className="workspace-header"><Link className="workspace-brand" to="/cats/"><span><Cat size={24}/></span><div><b>{workbenchConfig.brandName}</b><small>{workbenchConfig.brandSubtitle}</small></div></Link><div className="workspace-breadcrumb"><span>销售工作台</span><ChevronRight size={14}/><b>{titles[path]||'工作区'}</b></div></header>
    <div className="workspace-layout"><aside className="workspace-sidebar"><div className="workspace-nav-label">工作区</div><nav aria-label="销售工作台主导航">{nav.map(({to,label,hint,icon:Icon})=><Link key={to} to={to} onFocus={()=>preload(to)} aria-current={primaryRoute(path)===to?'page':undefined}><span className="workspace-nav-icon"><Icon size={19}/></span><span><b>{label}</b><small>{hint}</small></span></Link>)}<button className="workspace-utilities-toggle" aria-expanded={utilitiesOpen} aria-controls="workspace-sidebar-utilities" onClick={()=>setUtilitiesOpen(v=>!v)}><Sparkles size={19}/><b>做图与设置</b></button></nav><div id="workspace-sidebar-utilities" className={`workspace-sidebar-utilities${utilitiesOpen?' is-open':''}`}><SidebarUtilities customerDisplay={customerDisplay} onCustomerDisplay={privacy} onMarketing={openMarketing}/></div></aside>
    <main className="workspace-content" ref={panel}>
      {visited.current.has('/cats/')&&<div className="workspace-ai-pane" hidden={path!=='/cats/'}><SalesAI cats={cats} onDetail={showDetail} hidePrices={hidePrices} customerDisplay={customerDisplay} onCustomerDisplay={privacy}/></div>}
      {pages.map(([route,Component])=>visited.current.has(route)&&<section key={route} className="workspace-pane" data-route={route} data-active={path===route?'true':undefined} hidden={path!==route} aria-label={titles[route]}><PageBoundary><Suspense fallback={<PageSkeleton/>}><Component embedded onAsk={(cat,action)=>runScript([cat.id],action)} onCompare={toggleCompare} compareIds={compare} onDetail={showDetail} hidePrices={hidePrices} customerDisplay={customerDisplay} onCustomerDisplay={privacy} agentCommand={catalogCommand}/></Suspense></PageBoundary></section>)}
      {!titles[path]&&<div className="workspace-empty"><h1>这个工作区暂时不存在</h1><Link to="/cats/">返回猫源库</Link></div>}
      <WorkbenchNotice/><footer className="workspace-footer"><span>合作销售专用 · 成交前请确认库存与最终费用</span></footer>
    </main></div>
    {compare.length>=1&&path==='/cats/'&&!hidePrices&&<div className="workspace-compare" aria-label="选猫操作台"><span className="workspace-compare-label">已选{compare.length}只 · {compare.map(id=>labels.get(normalizeId(id))).join(' 与 ')}</span><div className="workspace-compare-items">{compare.map(id=><button key={id} aria-label={`移除${labels.get(normalizeId(id))}`} onClick={()=>setCompare(items=>items.filter(x=>x!==id))}><X size={13}/>{labels.get(normalizeId(id))}</button>)}</div>{compare.length===2&&<button disabled={busy} onClick={()=>runScript(compare,'compare')}>⚖️ AI生成双猫对比逼单话术</button>}{compare.length>=2&&compare.length<=9?<button data-workbench-tool="poster" onClick={()=>openMarketing('price',compare)}>🖼️ 一键合成为报价拼图/小红书海报</button>:<span className="compare-hint">选2只可对比，2至9只均可拼图</span>}<button className="basket-clear" onClick={()=>setCompare([])}>清空</button></div>}
    {marketing&&<MarketingStudio key={marketing.key} initialCats={marketing.cats} initialTemplate={marketing.template} initialSettings={marketing.settings} control={marketing.control} onStateChange={snapshot=>agent.remember(snapshot)} onPreviewReady={agent.capturePreview} onRenderStatus={settlePosterRender} onOperationStatus={settlePosterOperation} allCats={cats} close={()=>{settlePosterRender({status:'error',text:'拼图编辑器已关闭'});if(posterOperationReceipt.current)settlePosterOperation({operation:posterOperationReceipt.current.operation,status:'error',text:'拼图编辑器已关闭'});setMarketing(null);}}/>}
    {WORKSPACE_FEATURES.followups&&followups.open&&!hidePrices&&<FollowupDrawer cats={cats} onDetail={showDetail}/>}
    {notice&&<div className="workspace-notice" role="status"><Check size={16}/>{notice}</div>}
    {detail&&<Dialog title={hidePrices?'猫咪资料':'猫咪销售资料'} close={()=>setDetail(null)}><div className="workflow-cat-detail">{detail.image&&<SmartImage src={detail.image} sources={detail.images} alt={detail.breed||'在售猫咪'}/>}<b className="workflow-detail-id">{labels.get(normalizeId(detail.id))}</b><h2>{detail.breed} · {detail.color}</h2><p>{detail.gender} · 月龄{detail.age||'待确认'} · 疫苗{detail.vaccine||'待确认'}</p><p>{displayText(detail.description,cats,hidePrices)}</p>{displayedPrice(detail,customerDisplay)!=null&&<strong>{hidePrices?'售价 ':'合作底价 '}{money(displayedPrice(detail,customerDisplay))}</strong>}{!hidePrices&&<div><button disabled={busy} onClick={()=>runScript([detail.id],'praise')}>夸这只猫骨相甜美</button><button disabled={busy} onClick={()=>runScript([detail.id],'price')}>客户嫌贵保价逼单</button></div>}<CatTools cat={detail} label={labels.get(normalizeId(detail.id))} initialQuote={detail.price==null?null:Number(detail.price)+(customerDisplay.markup??0)} customerView={hidePrices} request={detailTool}/><small>库存实时变化，成交前请再次核对。</small></div></Dialog>}
    {job&&<Dialog title={job.action==='compare'?'双猫对比话术':'猫咪推荐话术'} close={()=>setJob(null)}><div className="workflow-script-result"><p className="workflow-script-ids">{job.ids.map(id=>labels.get(normalizeId(id))).join(' · ')}</p>{job.loading?<p role="status">{busy?'正在生成微信话术…':'请先完成销售激活…'}</p>:job.error?<><p role="alert" className="sales-ai-error">{job.error}</p><button className="workspace-primary" disabled={busy||cooldown>0||user?.remaining===0} onClick={()=>runScript(job.ids,job.action)}>{cooldown?`请等待${cooldown}秒`:'重新生成'}</button></>:<AIResult result={job.result} cats={cats} hidePrices={hidePrices} customerDisplay={customerDisplay} onDetail={cat=>{setJob(null);showDetail(cat);}}/>}</div></Dialog>}
  </div></AgentContext.Provider>;
}
export function WorkspaceContent(){return <WorkbenchConfigProvider><SalesSessionProvider><FollowupProvider><CatalogProvider><Workspace/></CatalogProvider></FollowupProvider></SalesSessionProvider></WorkbenchConfigProvider>;}
export default function SalesWorkspace(){return <BrowserRouter><WorkspaceContent/></BrowserRouter>;}
