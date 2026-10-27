// Imported before React DOM / Router so browser capability detection observes
// an initialized DOM, instead of selecting legacy server/IE event fallbacks.
import {JSDOM} from 'jsdom';
export const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://component.example'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.location=dom.window.location;
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.localStorage=dom.window.localStorage;globalThis.sessionStorage=dom.window.sessionStorage;
globalThis.CustomEvent=dom.window.CustomEvent;
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
dom.window.HTMLElement.prototype.scrollIntoView=function(){};
window.scrollTo=()=>{};
globalThis.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
Object.defineProperty(dom.window.HTMLElement.prototype,'innerText',{get(){return this.textContent;},set(value){this.textContent=value;},configurable:true});
