import React,{createContext,useContext,useEffect,useState} from 'react';
import {WORKBENCH_DEFAULTS,validateWorkbench} from '../../cloud-functions/_lib/workbench-schema.js';
import './mobile-density.css';
const KEY='public-workbench-settings-v1',Context=createContext({config:WORKBENCH_DEFAULTS,ready:false});
function cached(){try{const row=JSON.parse(localStorage.getItem(KEY));if(row&&Date.now()-row.at<10*60*1000)return validateWorkbench(row.config);}catch{}return null;}
export function publishWorkbenchConfig(config){const clean=validateWorkbench(config);try{localStorage.setItem(KEY,JSON.stringify({at:Date.now(),config:clean}));}catch{}window.dispatchEvent(new CustomEvent('workbench-settings',{detail:clean}));}
export function WorkbenchConfigProvider({children}){
 const [initial]=useState(cached),[config,setConfig]=useState(initial||WORKBENCH_DEFAULTS),[ready,setReady]=useState(Boolean(initial));
 useEffect(()=>{const update=e=>{try{const clean=validateWorkbench(e.detail);setConfig(clean);setReady(true);try{localStorage.setItem(KEY,JSON.stringify({at:Date.now(),config:clean}));}catch{}}catch{}};const storage=e=>{if(e.key===KEY){const next=cached();if(next){setConfig(next);setReady(true);}}};window.addEventListener('workbench-settings',update);window.addEventListener('storage',storage);return()=>{window.removeEventListener('workbench-settings',update);window.removeEventListener('storage',storage);};},[]);
 return <Context.Provider value={{config,ready}}><div className="workbench-shell" data-workbench-density={config.mobileDensity} data-workbench-poster={config.posterEnabled?'on':'off'}>{children}</div></Context.Provider>;
}
export const useWorkbenchConfig=()=>useContext(Context);
export function WorkbenchNotice(){const {config}=useWorkbenchConfig(),[copied,setCopied]=useState(false);if(!config.notice&&!config.operatorContact)return null;return <div className="workbench-notice">{config.notice&&<span>{config.notice}</span>}{config.operatorContact&&<button onClick={async()=>{try{await navigator.clipboard.writeText(config.operatorContact);setCopied(true);}catch{setCopied(false);}}}>{copied?'已复制运营联系方式':'运营：'+config.operatorContact}</button>}</div>;}
