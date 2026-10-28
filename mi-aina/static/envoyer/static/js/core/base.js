/* ================================================================
   MI-AINA — noyau partagé (base.html) — TOTALEMENT DYNAMIQUE
   La page enfant définit AVANT ce bloc :
     window.MI_NAV, window.MI_PRIMARY
   et APRÈS ce bloc : MI.registerRenderer(), MI.setBadge(),
   MI.addCommands(), ses données, ses rendus.
   Règle : apostrophe TYPOGRAPHIQUE (') dans les textes FR.
   ================================================================ */
const $  = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = new Intl.NumberFormat('fr-FR');
function refreshIcons(){ if (window.lucide && lucide.createIcons) lucide.createIcons(); }

/* ---------- Déconnexion — définie TÔT, avant tout usage ---------- */
const CORE = document.getElementById('coreData')?.dataset || {};
const MI_USER = { prenom: document.body.dataset.prenom || '', role: document.body.dataset.role || '' };
function doLogout(){ window.location.href = CORE.logout || '/logout/'; }

/* ---------- Logo MI-AINA depuis le fichier de marque du projet ---------- */
function makeLogo(src){
  return `<img src="${src}" alt="Logo MI-AINA" style="width:100%;height:100%;object-fit:contain;display:block">`;
}
function mountLogos(scope){
  (scope||document).querySelectorAll('[data-logo]:empty').forEach(el => {
    const src = el.dataset.logoSrc || '/static/img/logo.png';
    el.innerHTML = makeLogo(src);
  });
}
mountLogos();

/* ---------- API MI ---------- */
const RENDERERS = {};
const state = { view:null, q:'' };

window.MI = {
  refreshIcons, fmt,
  toast(msg, type){
    type = type || 'info';
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = '<i data-lucide="' + ({success:'circle-check',error:'circle-alert',info:'info'})[type] + '"></i><span>' + msg + '</span>';
    $('#toasts').appendChild(el);
    refreshIcons();
    setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 320); }, 3600);
  },
  countUp(el, target, dur){
    dur = dur || 1100;
    const t0 = performance.now();
    (function tick(t){
      const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3);
      el.textContent = fmt.format(Math.round(target*e));
      if(p<1) requestAnimationFrame(tick);
    })(t0);
  },
  stamp(host, txt, ok){
    const cell = host.tagName === 'TR' ? host.cells[0] : host;
    cell.classList.add('stamp-host');
    const s = document.createElement('div');
    s.className = 'stamp ' + (ok ? 'ok' : 'no');
    s.innerHTML = '<span>' + txt + '</span>';
    cell.appendChild(s);
  },
  setBadge(view, n){
    ['#nav-badge-' + view, '#dock-badge-' + view].forEach(sel=>{
      const b = $(sel); if(!b) return;
      b.textContent = n; b.hidden = !n;
    });
    if(n > 0) $('#bellDot').hidden = false;
  },
  setSync(text, warn){
    $('#syncPill').classList.toggle('warn', !!warn);
    $('#syncTxt').textContent = text;
  },
  registerRenderer(view, fn){ RENDERERS[view] = fn; },
  addCommands(list){ COMMANDS.push(...list); renderCmdkList(); },
  navigateCsb,
  loadDashboardContent,
  setView,
  greeting(emName){
    return 'Tongasoa, <em>' + emName + '</em>.';
  },
};

/* ---------- Rendu de la nav (sidebar + dock depuis MI_NAV) ---------- */
function renderNav(){
  const nav = window.MI_NAV || [];
  let html = '', lastGroup = null;
  nav.forEach(it=>{
    if(it.group && it.group !== lastGroup){
      const [mg, fr] = it.group.split('|');
      html += '<div class="nav-group"><span class="mg">' + mg + '</span> · ' + fr + '</div>';
      lastGroup = it.group;
    }
    const badgeValue = Number(it.badgeValue || 0);
    const badge = it.badge  ? '<span class="nav-badge" id="nav-badge-' + it.view + '"' + (badgeValue ? '' : ' hidden') + '>' + badgeValue + '</span>' : '';
    const count = it.count != null ? '<span class="nav-count">' + it.count + '</span>' : '';
    const navTag = it.href ? 'a' : 'button';
    const navLink = it.href ? ' href="' + it.href + '"' : '';
    html += '<' + navTag + ' class="nav-item" data-view="' + it.view + '"' + navLink + ' data-tip="' + it.label + '">' +
            '<i data-lucide="' + it.icon + '"></i><span class="nav-label">' + it.label + '</span>' + count + badge + '</' + navTag + '>';
  });
  $('#sideNav').innerHTML = html;

  const dockNav = nav.filter(it=>it.inDock !== false).slice(0, 5);
  let dh = dockNav.map(it=>{
    const dockTag = it.href ? 'a' : 'button';
    const dockLink = it.href ? ' href="' + it.href + '"' : ' data-goto="' + it.view + '"';
    const badgeValue = Number(it.badgeValue || 0);
    return '<' + dockTag + ' class="dock-btn"' + dockLink + ' data-tip="' + it.label + '"><i data-lucide="' + it.icon + '"></i>' +
      (it.badge ? '<span class="dock-badge" id="dock-badge-' + it.view + '"' + (badgeValue ? '' : ' hidden') + '>' + badgeValue + '</span>' : '') + '</' + dockTag + '>';
  }).join('');
  dh += '<span class="dock-sep"></span>' +
        '<button class="dock-btn" id="dockCmd" data-tip="Commandes · Ctrl K"><i data-lucide="command"></i></button>' +
        '<button class="dock-btn accent" id="dockPrimary" data-tip="' + (window.MI_PRIMARY?.tip || 'Action') + '"><i data-lucide="' + (window.MI_PRIMARY?.icon || 'plus') + '"></i></button>';
  $('#dock').innerHTML = dh;

  $$('.nav-item[data-view]:not([href])').forEach(b=>b.addEventListener('click',()=>MI.setView(b.dataset.view)));
  $$('.dock-btn[data-goto]').forEach(b=>b.addEventListener('click',()=>MI.setView(b.dataset.goto)));
  $('#dockCmd').addEventListener('click', openCmdk);
  $('#dockPrimary').addEventListener('click', ()=>{
    const p = window.MI_PRIMARY || {};
    if(p.run) p.run(); else if(p.goto) MI.setView(p.goto);
  });
}

/* ---------- Routeur de vues ---------- */
function setView(name){
  state.view = name;
  const views = $$('.view[data-view]');
  let found = false;
  views.forEach(v=>{ v.hidden = v.dataset.view !== name; if(v.dataset.view === name) found = true; });
  if(!found){
    const it = (window.MI_NAV || []).find(x=>x.view === name);
    let stub = $('#view-stub');
    if(!stub){
      stub = document.createElement('section');
      stub.className = 'view'; stub.id = 'view-stub'; stub.dataset.view = '__stub';
      $('.content').appendChild(stub);
    }
    stub.innerHTML = '<div class="card"><div class="stub">' +
      '<div class="stub-ic"><i data-lucide="layout-template"></i></div>' +
      '<h3>' + (it ? it.label : name) + '</h3><p>Ce module est planifié dans la feuille de route Mi-AINA.</p>' +
      '<button class="btn ghost" data-goto="' + (views[0] ? views[0].dataset.view : 'overview') + '"><i data-lucide="arrow-left"></i>Retour</button></div></div>';
    views.forEach(v=>v.hidden = true);
    stub.hidden = false;
    stub.style.display = '';
  } else {
    const stub = $('#view-stub'); if(stub) stub.hidden = true;
    if(RENDERERS[name]) RENDERERS[name]();
  }
  $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===name));
  $$('.dock-btn[data-goto]').forEach(b=>b.classList.toggle('active', b.dataset.goto===name));
  document.body.classList.remove('mobile-open');
  window.scrollTo({top:0, behavior:'smooth'});
}
document.addEventListener('click', e=>{
  const g = e.target.closest('[data-goto]');
  if(g){ setView(g.dataset.goto); if(g.closest('.drop')) $$('.drop').forEach(d=>d.hidden=true); }
});

/* ---------- Navigation CSB sans reconstruire le shell ---------- */
function replaceContent(html, url, replace){
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const next = parsed.querySelector('.content');
  const content = $('.content');
  if(!next || !content) return false;
  content.innerHTML = next.innerHTML;
  if(parsed.title) document.title = parsed.title;
  if(url) {
    const method = replace ? 'replaceState' : 'pushState';
    history[method]({csb:true}, '', url);
  }
  refreshIcons();
  window.scrollTo({top:0, behavior:'smooth'});
  return true;
}
async function navigateCsb(url, options){
  const {replace = false, ...fetchOptions} = options || {};
  const response = await fetch(url, {credentials:'same-origin', ...fetchOptions});
  if(!response.ok) throw new Error('Navigation CSB impossible');
  const html = await response.text();
  const finalUrl = response.url || url;
  if(!replaceContent(html, finalUrl, replace)) window.location.href = finalUrl;
}
async function loadDashboardContent(url, options){
  const response = await fetch(url, {credentials:'same-origin', ...(options || {})});
  if(!response.ok) throw new Error('Chargement CSB impossible');
  const html = await response.text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const source = parsed.querySelector('.content .view');
  const target = $('#view-csb');
  if(!source || !target) throw new Error('Contenu CSB absent');
  target.innerHTML = source.innerHTML;
  $$('.view[data-view]').forEach(view=>{ view.hidden = view !== target; });
  state.view = 'csb';
  if(parsed.title) document.title = parsed.title;
  MI.refreshIcons();
  $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view==='csb'));
  $$('.dock-btn[data-goto]').forEach(b=>b.classList.toggle('active', b.dataset.goto==='csb'));
  window.scrollTo({top:0, behavior:'smooth'});
}
document.addEventListener('click', e=>{
  const link = e.target.closest('a[href]');
  if(!link || link.target === '_blank') return;
  const url = new URL(link.href, window.location.href);
  if(url.origin !== window.location.origin || !url.pathname.startsWith('/csb/')) return;
  e.preventDefault();
  const load = window.location.pathname === '/pilotage/'
    ? loadDashboardContent(url.pathname + url.search)
    : navigateCsb(url.pathname + url.search);
  load.catch(()=>{ window.location.href = url.href; });
});
document.addEventListener('submit', e=>{
  const form = e.target.closest('form');
  if(!form || !form.action) return;
  const url = new URL(form.action, window.location.href);
  if(url.origin !== window.location.origin || !url.pathname.startsWith('/csb/')) return;
  e.preventDefault();
  const headers = {'X-Requested-With':'XMLHttpRequest'};
  const csrfInput = form.querySelector('[name=csrfmiddlewaretoken]');
  if(csrfInput) headers['X-CSRFToken'] = csrfInput.value;
  const options = {method:form.method || 'POST', body:new FormData(form), headers};
  const load = window.location.pathname === '/pilotage/'
    ? loadDashboardContent(url.pathname + url.search, options)
    : navigateCsb(url.pathname + url.search, options);
  load
    .catch(()=>{ form.submit(); });
});
window.addEventListener('popstate', e=>{
  if(!window.location.pathname.startsWith('/csb/')) return;
  navigateCsb(window.location.pathname + window.location.search, {replace:true})
    .catch(()=>{ window.location.reload(); });
});

/* ---------- Sidebar : repli / drawer ---------- */
 $('#sideToggle').addEventListener('click', ()=>document.body.classList.toggle('collapsed'));
 $('#menuBtn').addEventListener('click', ()=>document.body.classList.toggle('mobile-open'));
 $('#backdrop').addEventListener('click', ()=>document.body.classList.remove('mobile-open'));

/* ---------- Île : dropdowns + horloge ---------- */
function toggleDrop(id){
  const d = $(id);
  $$('.drop').forEach(x=>{ if(x!==d) x.hidden = true; });
  d.hidden = !d.hidden;
}
 $('#bellBtn').addEventListener('click', e=>{ e.stopPropagation(); toggleDrop('#notifDrop'); });
 $('#avatarBtn').addEventListener('click', e=>{ e.stopPropagation(); toggleDrop('#avatarDrop'); });
document.addEventListener('click', e=>{
  if(!e.target.closest('.drop') && !e.target.closest('.island-bell') && !e.target.closest('.island-avatar'))
    $$('.drop').forEach(d=>d.hidden = true);
});
 $('#markRead').addEventListener('click', ()=>{
  $('#bellDot').hidden = true;
  const count=$('#bellCount'); if(count) count.hidden=true;
  const csrf=(document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)||[])[1];
  fetch('/notifications/read-all/', {method:'POST',headers:{'X-CSRFToken':decodeURIComponent(csrf||'')}}).catch(()=>{});
  document.querySelectorAll('#notifList .drop-item').forEach(x=>x.style.background='');
  MI.toast('Notifications marquées comme lues.','success');
 });
 $$('#avatarDrop [data-me]').forEach(i=>i.addEventListener('click',()=>{
  $$('.drop').forEach(d=>d.hidden=true);
  if(i.dataset.act === 'logout'){ doLogout(); return; }
  MI.toast('Module à venir dans la phase administration.','info');
}));
let syncSec = 0;
setInterval(()=>{
  const now = new Date();
  $('#islandTime').textContent = now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  $('#islandDate').textContent = now.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');
  syncSec++;
  if(!window.MI_SYNC_LOCK) MI.setSync('À JOUR · ' + syncSec + ' s');
}, 1000);
 $('#islandDate').textContent = new Date().toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');

/* ---------- Dock magnétique + cache au scroll ---------- */
const dock = $('#dock');
function bindDockMagnet(){
  const btns = [...dock.querySelectorAll('.dock-btn')];
  dock.addEventListener('mousemove', e=>{
    btns.forEach(b=>{
      const r = b.getBoundingClientRect();
      const d = Math.hypot(e.clientX-(r.left+r.width/2), e.clientY-(r.top+r.height/2));
      const s = Math.max(0, 1-d/120);
      b.style.transform = 'translateY(' + (-14*s).toFixed(1) + 'px) scale(' + (1+.3*s).toFixed(3) + ')';
    });
  });
  dock.addEventListener('mouseleave', ()=>btns.forEach(b=>b.style.transform=''));
}
let lastY = 0;
window.addEventListener('scroll', ()=>{
  const y = window.scrollY;
  dock.classList.toggle('dock-hidden', y>lastY && y>140);
  lastY = y;
}, {passive:true});

/* ---------- Ctrl+K ---------- */
const COMMANDS = [];
let cmdkIdx = 0, cmdkFiltered = COMMANDS;
function renderCmdkList(){
  const list = $('#cmdkList');
  if(!cmdkFiltered.length){
    list.innerHTML = '<div class="cmdk-empty">Aucune commande pour « ' + $('#cmdkInput').value + ' »</div>';
    refreshIcons(); return;
  }
  let html = '', lastGroup = '';
  cmdkFiltered.forEach((c,i)=>{
    if(c.group !== lastGroup){ html += '<div class="cmdk-group mono">' + c.group + '</div>'; lastGroup = c.group; }
    html += '<button class="cmdk-item ' + (i===cmdkIdx?'sel':'') + '" data-fi="' + i + '"><i data-lucide="' + c.icon + '"></i><span>' + c.label + '</span></button>';
  });
  list.innerHTML = html;
  refreshIcons();
  list.querySelectorAll('.cmdk-item').forEach(it=>{
    it.addEventListener('mouseenter', ()=>{
      const i = +it.dataset.fi;
      if(i !== cmdkIdx){ cmdkIdx = i;
        list.querySelectorAll('.cmdk-item').forEach(x=>x.classList.toggle('sel', +x.dataset.fi===cmdkIdx)); }
    });
    it.addEventListener('click', ()=>runFiltered(+it.dataset.fi));
  });
  const sel = list.querySelector('.cmdk-item.sel');
  if(sel) sel.scrollIntoView({block:'nearest'});
}
function filterCmdk(){
  const q = $('#cmdkInput').value.trim().toLowerCase();
  cmdkFiltered = COMMANDS.filter(c=>c.label.toLowerCase().includes(q));
  cmdkIdx = 0; renderCmdkList();
}
function openCmdk(){
  $$('.drop').forEach(d=>d.hidden=true);
  $('#cmdk').hidden = false;
  $('#cmdkInput').value=''; filterCmdk();
  setTimeout(()=>$('#cmdkInput').focus(), 50);
}
function closeCmdk(){ $('#cmdk').hidden = true; }
function runFiltered(i){ const c = cmdkFiltered[i]; if(!c) return; closeCmdk(); c.run(); }
 $('#cmdkInput').addEventListener('input', filterCmdk);
 $('#cmdkInput').addEventListener('keydown', e=>{
  if(e.key==='ArrowDown'){ e.preventDefault(); cmdkIdx = Math.min(cmdkIdx+1, cmdkFiltered.length-1); renderCmdkList(); }
  if(e.key==='ArrowUp'){ e.preventDefault(); cmdkIdx = Math.max(cmdkIdx-1, 0); renderCmdkList(); }
  if(e.key==='Enter') runFiltered(cmdkIdx);
});
 $('#cmdk').addEventListener('click', e=>{ if(e.target===e.currentTarget) closeCmdk(); });
 $('#searchTrigger').addEventListener('click', openCmdk);
document.addEventListener('keydown', e=>{
  if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='k'){
    e.preventDefault();
    if($('#cmdk').hidden) openCmdk(); else closeCmdk();
    return;
  }
  if(e.key==='Escape'){
    if(!$('#cmdk').hidden){ closeCmdk(); return; }
    $$('.modal-wrap').forEach(m=>m.hidden=true);
    $$('.drop').forEach(d=>d.hidden=true);
  }
});
 $$('[data-close]').forEach(b=>b.addEventListener('click', ()=>$$('.modal-wrap').forEach(m=>m.hidden=true)));
 $$('.modal-wrap').forEach(m=>m.addEventListener('click', e=>{ if(e.target===m) m.hidden=true; }));

/* ---------- Déconnexion — handlers ---------- */
 $$('[data-logout]').forEach(b=>b.addEventListener('click', e=>{
  e.preventDefault();
  doLogout();
}));

/* ---------- Chart.js : réglages communs ---------- */
if(window.Chart){
  Chart.defaults.font.family = "'Inter',sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = 'rgba(30,42,34,.55)';
  window.MI_TOOLTIP = {
    backgroundColor:'#0F1A14', padding:11, cornerRadius:10, boxWidth:8, boxHeight:8,
    usePointStyle:true, titleFont:{weight:'600'}, bodyFont:{family:"'IBM Plex Mono'", size:11},
  };
}

/* ---------- Démarrage — APRÈS le JS de la page enfant ---------- */
document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  bindDockMagnet();
  const first = document.querySelector('.view[data-view]');
  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (requestedView && document.querySelector('.view[data-view="'+requestedView+'"]')) {
    setView(requestedView);
  } else if (first) {
    setView(first.dataset.view);
  }
  refreshIcons();
});
window.addEventListener('load', refreshIcons);
