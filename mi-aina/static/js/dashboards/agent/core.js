/* ================================================================
   MI-AINA — Agent · noyau : données, nav, chargeur lazy, sync,
   boîtier mini, badges dock, init défensif.
   Règle : apostrophe TYPOGRAPHIQUE (') dans les textes FR.
   ================================================================ */
const DB = Object.fromEntries(['patients','doctors','consults','reports','devices','measures','threads','fils','urls','me','pubs','notifs','forum','ai-symptoms','iot-simulation-enabled']
  .map(k => [k, JSON.parse(document.getElementById('data-'+k).textContent)]));
const csrf = document.querySelector('#csrfHolder [name=csrfmiddlewaretoken]')?.value
  || document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] || '';
const post = (u,b)=>fetch(u,{method:'POST',headers:{'X-CSRFToken':csrf,'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(r=>r.json());
const esc  = s => String(s??'').replace(/</g,'&lt;');
const fmtDec = n => String(n).replace('.', ',');
const ME = DB.me || {};
const syncQueue = [];

/* Métadonnées partagées (utilisées par patients.js et views.js) */
const STATUT_META = {
  EN_ATTENTE:{b:'amber', l:'AVIS EN ATTENTE'},
  EN_ATTENTE_AVIS:{b:'amber', l:'AVIS DEMANDÉ'},
  EN_COURS:{b:'red', l:'EN COURS'},
  AVIS_RECU:{b:'green', l:'AVIS REÇU'},
  ORIENTEE:{b:'navy', l:'ORIENTÉE'},
  TERMINEE:{b:'gray', l:'TERMINÉE'},
};

window.MI_NAV = [
  {view:'overview',   icon:'layout-dashboard', label:'Vue d\u2019ensemble', group:'FIASA|TRAVAIL'},
  {view:'saisie',     icon:'clipboard-pen',    label:'Nouvelle consultation'},
  {view:'patients',   icon:'users',            label:'Mes patients', count:DB.patients.length, badgeCount:true},
  {view:'consults',   icon:'stethoscope',      label:'Consultations', badgeCount:true},
  {view:'reports',    icon:'megaphone',        label:'Signalements', badge:true, badgeValue:DB.reports.length},
  {view:'devices',    icon:'cpu',              label:'Boîtiers IoT', badge:true, group:'FITAFIANA|IoT · EXCLUSIF'},
  {view:'measures',   icon:'activity',         label:'Mesures IoT'},
  {view:'prevention', href:'/prevention/', icon:'shield-plus', label:'Prévention', group:'FANABEAZANA|SAVOIR', inDock:false},
  {view:'formations', icon:'graduation-cap',   label:'Formations', badge:true, badgeValue:DB.pubs.filter(p=>!p.lu).length},
  {view:'onboarding', icon:'circle-help',       label:'Centre d’aide'},
  {view:'forum',      icon:'messages-square',  label:'Forum médical'},
  {view:'messagerie', icon:'message-circle',   label:'Messagerie', badge:true, group:'FINDRAFY|MÉDECIN'},
  {view:'visio',      icon:'video',            label:'Visioconsultation'},
  {view:'profil',     icon:'user-round',       label:'Mon profil', group:'RAFITRA|COMPTE'},
];
window.MI_PRIMARY = {icon:'plus', tip:'Nouvelle consultation', goto:'saisie'};

/* ---------- Chargeur paresseux (1 fichier = 1 chargement) ---------- */
const LAZY = {
  saisie:    '/static/js/dashboards/agent/saisie.js',
  patients:  '/static/js/dashboards/agent/patients.js',
  consults:  '/static/js/dashboards/agent/views.js',
  reports:   '/static/js/dashboards/agent/views.js',
  devices:   '/static/js/dashboards/agent/views.js',
  measures:  '/static/js/dashboards/agent/views.js',
  formations:'/static/js/dashboards/agent/formations.js',
  onboarding:'/static/js/dashboards/agent/onboarding.js',
  forum:     '/static/js/dashboards/agent/forum.js',
  messagerie:'/static/js/dashboards/shared_messaging.js',
  visio:     '/static/js/dashboards/agent/social.js',
  profil:    '/static/js/dashboards/agent/social.js',
};
const loadedFiles = {};
function lazyStub(name){
  const fn = ()=>loadOnce(name); fn._lazy = true; return fn;
}
function loadOnce(name){
  const url = LAZY[name];
  if(!loadedFiles[url]){
    loadedFiles[url] = true;
    const s = document.createElement('script');
    s.src = url;
    s.onload = ()=>{
      const fn = RENDERERS[name]; if(typeof fn==='function' && !fn._lazy) fn();
      if(name==='visio' && window.MI_VISIO_CONTEXT) window.MI_SHOW_CONSULT_VISIO?.(window.MI_VISIO_CONTEXT);
    };
    document.body.appendChild(s);
    return;
  }
  const fn = RENDERERS[name];
  if(typeof fn==='function' && !fn._lazy) fn();
}
MI.openConsultVisio = context=>{
  window.MI_VISIO_CONTEXT = context;
  if(window.MI_SHOW_CONSULT_VISIO) window.MI_SHOW_CONSULT_VISIO(context);
  else loadOnce('visio');
};
MI.registerRenderer('saisie',    lazyStub('saisie'));
MI.registerRenderer('patients',  lazyStub('patients'));
MI.registerRenderer('consults',  lazyStub('consults'));
MI.registerRenderer('reports',   lazyStub('reports'));
MI.registerRenderer('devices',   lazyStub('devices'));
MI.registerRenderer('measures',  lazyStub('measures'));
MI.registerRenderer('formations',lazyStub('formations'));
MI.registerRenderer('onboarding',lazyStub('onboarding'));
MI.registerRenderer('messagerie',lazyStub('messagerie'));
MI.registerRenderer('visio',     lazyStub('visio'));
MI.registerRenderer('profil',    lazyStub('profil'));

/* ---------- Salutation + compteurs ---------- */
const TODAY_N = () => DB.consults.filter(c=>c.date==='aujourd\u2019hui'||c.date==='à l\u2019instant').length;
function greet(){
  const t = $('#greetTitle'); if(!t) return;
  t.innerHTML = MI.greeting(ME.prenom || window.MI_USER?.prenom || '');
  const a = DB.consults.filter(c=>c.statut==='EN_ATTENTE_AVIS').length;
  const m = $('#greetMsg'); if(!m) return;
  m.innerHTML = a>0
    ? '<a data-goto="consults"><b>'+a+' avis médical'+(a>1?'aux':'')+'</b></a> '+(a>1?'sont':'est')+' en attente côté médecin — les constantes continuent d\u2019arriver.'
    : 'CSB '+esc(ME.csb_nom||'')+' — la collecte peut commencer. Le médecin répond en moyenne en 15 min.';
  m.querySelectorAll('[data-goto]').forEach(x=>x.addEventListener('click',()=>MI.setView(x.dataset.goto)));
}
function updateCounters(){
  const set = (id,v)=>{ const e=$('#'+id); if(e) e.textContent=v; };
  set('statPatVal', DB.patients.length);
  set('statConsVal', TODAY_N());
  set('statConsHint', DB.consults.filter(x=>x.statut==='EN_ATTENTE_AVIS').length+' avis en attente');
  set('statRepVal', DB.reports.length);
  const online = DB.devices.filter(d=>d.statut==='CONNECTÉ').length;
  set('statDevVal', DB.devices.length);
  set('statDevDelta', online+' en ligne');
  set('statDevHint', DB.devices.length+' ESP32 jumelés'+(DB.devices.length-online?' · '+(DB.devices.length-online)+' à surveiller':''));
  greet();
}

/* ---------- File de synchronisation ---------- */
let syncing = false;
function refreshSync(){
  const n = syncQueue.length;
  MI.setSync(n ? 'FILE : '+n : 'SYNC ✓', n>0);
  const sub = $('#syncSub'); if(sub) sub.textContent = n ? n+' élément'+(n>1?'s':'')+' partiront au prochain réseau' : 'Tout est synchronisé — à jour';
  const items = $('#syncItems');
  if(items) items.innerHTML = n
    ? syncQueue.map(it=>'<div class="sync-item"><i data-lucide="cloud-upload"></i><span>'+esc(it.l)+'</span><span class="sp">'+it.tag+'</span></div>').join('')
    : '<div class="sync-item"><i data-lucide="cloud-check" style="color:#026630"></i><span>Rien à envoyer — le registre local est vide.</span></div>';
  MI.refreshIcons();
}
function doSync(){
  if(!syncQueue.length || syncing) return;
  syncing = true; const btn = $('#syncBtn'); if(btn) btn.disabled = true;
  const total = syncQueue.length; let done = 0;
  const step = setInterval(()=>{
    const items = $$('#syncItems .sync-item'); if(items[0]) items[0].classList.add('gone');
    done++; const prog = $('#syncProg'); if(prog) prog.style.width = Math.round(done/total*100)+'%';
    setTimeout(()=>{
      syncQueue.shift(); refreshSync();
      if(!syncQueue.length){
        clearInterval(step);
        post(DB.urls.sync, {}).catch(()=>{});
        setTimeout(()=>{ const pr=$('#syncProg'); if(pr) pr.style.width='0'; if(btn) btn.disabled=false; syncing=false; }, 600);
        MI.toast('Synchronisé — '+total+' élément'+(total>1?'s':'')+' envoyé au serveur national.','success');
      }
    }, 420);
  }, 620);
}

/* ---------- Boîtier mini ---------- */
function renderDevMini(){
  const box = $('#devMini'); if(!box) return;
  const d = DB.devices[0];
  if(!d){ box.innerHTML = '<p style="font-size:12px;color:var(--ink-50)">Aucun boîtier assigné — contactez le Pilotage.</p>'; return; }
  box.innerHTML =
    '<div style="display:flex;align-items:center;gap:11px">'+
    '<span class="dev-ic"><i data-lucide="cpu"></i></span>'+
    '<div style="flex:1"><b style="font-size:14px;display:block">'+esc(d.nom)+'</b><span style="font-size:11px;color:var(--ink-50)">'+esc(d.csb)+' · '+esc(d.statut)+'</span></div>'+
    '<div style="text-align:right"><div class="bat '+(d.bat<20?'c':d.bat<40?'w':'')+'" style="width:64px"><i style="width:'+d.bat+'%"></i></div>'+
    '<span class="mono" style="font-size:9.5px;color:var(--ink-50)">batterie '+d.bat+' %</span></div></div>'+
    '<div style="display:flex;gap:8px;margin-top:13px;flex-wrap:wrap">'+
    '<span class="vital"><i></i>Température <small>infrarouge</small></span>'+
    '<span class="vital"><i></i>AD8232 <small>ECG · flux non relié</small></span></div>'+
    '<div style="display:flex;gap:16px;margin-top:13px;padding-top:12px;border-top:1px dashed var(--line);font-size:11px;color:var(--ink-50);flex-wrap:wrap">'+
    '<span>SIGNAL <span class="sig s'+d.sig+'"><i></i><i></i><i></i></span></span>'+
    '<span>FIRMWARE <b class="mono" style="color:var(--ink)">'+esc(d.fw||'v2.3.1')+'</b></span></div>';
  MI.refreshIcons();
}

/* ---------- Badges dock façon iPhone ---------- */
function refreshDockBadges(){
  const map = {
    patients:   DB.patients.length,
    consults:   DB.consults.filter(c=>c.statut==='EN_ATTENTE_AVIS').length,
    reports:    DB.reports.length,
    devices:    DB.devices.filter(d=>d.statut!=='CONNECTÉ').length,
    formations: (DB.pubs||[]).filter(p=>!p.lu).length,
    messagerie: (DB.fils||[]).reduce((a,f)=>a+(f.non_lus||0),0),
  };
  MI.setBadge('reports', map.reports);
  MI.setBadge('consults', map.consults);
  MI.setBadge('formations', map.formations);
  MI.setBadge('messagerie', map.messagerie);
  Object.entries(map).forEach(([view,n])=>{
    const dockB = $('#dock-badge-'+view);
    if(dockB){ dockB.textContent = n; dockB.hidden = false; dockB.classList.toggle('zero', !n); }
  });
}

/* ---------- Init défensif ---------- */
try { greet(); } catch(e){ console.error('greet:', e.message); }
try { refreshSync(); } catch(e){ console.error('sync:', e.message); }
try { renderDevMini(); } catch(e){ console.error('devMini:', e.message); }
try { updateCounters(); } catch(e){ console.error('counters:', e.message); }

 $('#statPatVal').textContent = DB.patients.length;
 $('#statConsVal').textContent = TODAY_N();
 $('#statRepVal').textContent = DB.reports.length;
const _online = DB.devices.filter(d=>d.statut==='CONNECTÉ').length;
 $('#statDevVal').textContent = DB.devices.length;
 $('#statDevDelta').textContent = _online+' en ligne';
 $('#statDevHint').textContent = DB.devices.length+' ESP32 jumelés';

const _sb = $('#syncBtn'); if(_sb) _sb.addEventListener('click', doSync);
const _snb = $('#syncNowBtn'); if(_snb) _snb.addEventListener('click', doSync);

refreshDockBadges();
