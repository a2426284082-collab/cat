import {learningEnvironment} from './environment.js';
export function mount(root){
const {document,IntersectionObserver,addEventListener,setTimeout,cleanup}=learningEnvironment(root);

    const guideMain=document.getElementById('guide-main');
    const panels=[...guideMain.querySelectorAll(':scope > .panel')];
    const sideList=document.getElementById('side-list');
    let firstInChapter=true,chapterIndex=0,panelIndex=0;
    [...guideMain.children].forEach(node=>{
      if(node.classList&&node.classList.contains('chapter-head')){
        chapterIndex++;firstInChapter=true;
        if(!node.id)node.id='chapter-'+chapterIndex;
        const title=node.querySelector('h2')?.textContent.trim()||('第'+chapterIndex+'章');
        const link=document.createElement('a');link.className='side-chapter';link.href='#'+node.id;link.textContent=chapterIndex+' · '+title;sideList.appendChild(link);
      }
      if(node.classList&&node.classList.contains('panel')){
        const h2=[...node.children].find(el=>el.tagName==='H2');if(!h2)return;
        panelIndex++;if(!node.id)node.id='section-'+panelIndex;
        const title=h2.textContent.trim();
        const content=document.createElement('div');content.className='section-content';
        while(h2.nextSibling)content.appendChild(h2.nextSibling);node.appendChild(content);
        const text=document.createElement('span');text.className='panel-title-text';text.textContent=title;h2.textContent='';h2.classList.add('panel-title');h2.appendChild(text);
        const toggle=document.createElement('button');toggle.className='section-toggle';toggle.type='button';toggle.setAttribute('aria-label','收起'+title);toggle.textContent='−';h2.appendChild(toggle);
        const setOpen=open=>{node.classList.toggle('collapsed',!open);toggle.textContent=open?'−':'＋';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',(open?'收起':'展开')+title)};
        node._setOpen=setOpen;setOpen(firstInChapter);firstInChapter=false;
        toggle.addEventListener('click',()=>setOpen(node.classList.contains('collapsed')));
        const link=document.createElement('a');link.className='side-link';link.href='#'+node.id;link.textContent=title;link.dataset.target=node.id;sideList.appendChild(link);
      }
    });
    const sidebar=document.getElementById('sidebar'),overlay=document.getElementById('drawer-overlay'),menuButton=document.getElementById('guide-menu-fab'),search=document.getElementById('guide-search'),results=document.getElementById('search-results'),searchOpen=document.getElementById('search-open'),searchBox=document.getElementById('search-box');
    const openMenu=()=>{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();sidebar.classList.add('open');overlay.classList.add('show');document.body.classList.add('no-scroll')};
    const closeMenu=()=>{sidebar.classList.remove('open');overlay.classList.remove('show');document.body.classList.remove('no-scroll')};
    menuButton.addEventListener('click',openMenu);overlay.addEventListener('click',closeMenu);document.getElementById('sidebar-close').addEventListener('click',closeMenu);document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
    sideList.addEventListener('click',e=>{const link=e.target.closest('a');if(!link)return;const target=document.querySelector(link.getAttribute('href'));if(target&&target._setOpen)target._setOpen(true);closeMenu()});
    document.getElementById('expand-all').onclick=()=>panels.forEach(p=>p._setOpen&&p._setOpen(true));
    document.getElementById('collapse-all').onclick=()=>panels.forEach(p=>p._setOpen&&p._setOpen(false));
    searchOpen.addEventListener('click',()=>{searchBox.hidden=false;searchOpen.hidden=true;setTimeout(()=>search.focus(),50)});
    search.addEventListener('input',()=>{const q=search.value.trim().toLowerCase();results.textContent='';results.classList.toggle('show',!!q);if(!q)return;const matches=panels.filter(p=>p.innerText.toLowerCase().includes(q));if(!matches.length){const empty=document.createElement('div');empty.className='search-empty';empty.textContent='没有找到相关内容';results.appendChild(empty);return}matches.slice(0,8).forEach(panel=>{const btn=document.createElement('button');btn.className='search-result';btn.type='button';btn.textContent=panel.querySelector('.panel-title-text')?.textContent||'相关内容';btn.onclick=()=>{panel._setOpen(true);panel.querySelectorAll('details').forEach(d=>{if(d.innerText.toLowerCase().includes(q))d.open=true});closeMenu();panel.scrollIntoView({behavior:'smooth',block:'start'})};results.appendChild(btn)})});
    const mobileCurrent=document.getElementById('mobile-current');
    const observed=[...guideMain.querySelectorAll('.chapter-head,.panel')];
    const observer=new IntersectionObserver(entries=>{const visible=entries.filter(e=>e.isIntersecting).sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];if(!visible)return;const id=visible.target.id;document.querySelectorAll('.side-list a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'+id));const titleNode=visible.target.querySelector('.panel-title-text')||visible.target.querySelector('h2');const title=titleNode?.textContent.trim();if(title&&mobileCurrent)mobileCurrent.textContent=title},{rootMargin:'-15% 0px -70% 0px',threshold:0});observed.forEach(el=>observer.observe(el));
    if(location.hash){const target=document.querySelector(location.hash);if(target&&target._setOpen)target._setOpen(true)}
    document.querySelectorAll('.copy').forEach(btn=>btn.onclick=e=>{e.stopPropagation();const box=btn.parentElement.cloneNode(true);box.querySelector('.copy').remove();navigator.clipboard.writeText(box.innerText.trim()).then(()=>{btn.textContent='已复制';setTimeout(()=>btn.textContent='复制',1200)}).catch(()=>btn.textContent='长按复制')});
    const themeButton=document.getElementById('theme-toggle');
    const themeMeta={setAttribute(){}};
    const setTheme=theme=>{const dark=theme==='dark';document.documentElement.dataset.theme=theme;themeButton.setAttribute('aria-pressed',String(dark));themeButton.textContent=dark?'☀️ 浅色模式':'🌙 深色模式';themeMeta.setAttribute('content',dark?'#171615':'#fff9f1');try{localStorage.setItem('sales-guide-theme',theme)}catch(e){}};
    let savedTheme='';try{savedTheme=localStorage.getItem('sales-guide-theme')||''}catch(e){}
    setTheme(savedTheme||'light');
    themeButton.addEventListener('click',()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark'));
  
return cleanup;
}
