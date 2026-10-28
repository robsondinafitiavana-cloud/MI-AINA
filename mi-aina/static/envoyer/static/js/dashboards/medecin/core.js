/* ================================================================
   MI-AINA — Médecin · noyau
   Données, nav, chargeur lazy, triage overview, modals, charts.
   Règle : apostrophe TYPOGRAPHIQUE (') dans les textes FR.
   ================================================================ */
const DB = Object.fromEntries(['cases','consults','patients','threads','fils','urls','me','formation','forum']
  .map(k => [k, JSON.parse(document.getElementById('data-'+k).textContent)]));
const csrf = document.querySelector('#csrfHolder [name=csrfmiddlewaretoken]')?.value
  || document.cookie.match(/(?:^|; )csrftoken=([^;]+)/)?.[1] || '';
const post = (u,b)=>fetch(u,{method:'POST',headers:{'X-CSRFToken':csrf,'Content-Type':'application/json'},body:JSON.stringify(b||{})}).then(r=>r.json());
const esc  = s => String(s??'').replace(/</g,'&lt;');

const SEV = {
  CRITIQUE:     {col:'#C1272D', lbl:'CRITIQUE'},
  URGENT:       {col:'#C98A1F', lbl:'URGENT'},
  'PRÉOCCUPANT':{col:'#C98A1F', lbl:'URGENT'},
  'MODÉRÉ':     {col:'#007E3A', lbl:'MODÉRÉ'},
};
const sevOf  = s => SEV[s] || SEV['MODÉRÉ'];
const vitCls = (k,v)=> k==='spo2' ? (v>=95?'v-ok':v>=90?'v-warn':'v-crit')
                     : k==='temp' ? (v<38?'v-ok':v<39?'v-warn':'v-crit')
                     : (v>120?'v-crit':v>100?'v-warn':'v-ok');
function vitalChips(v){
  const L={spo2:['SpO₂','%'],temp:['T°','°C'],bpm:['POULS','bpm']};
  return Object.entries(v||{}).filter(([k,val])=>L[k] && val!==null && val!==undefined && val!=='').map(([k,val])=>{
    const [lab,u]=L[k], c=vitCls(k,Number(val));
    return '<span class="vital '+c+'"><i></i>'+lab+' '+String(val).replace('.',',')+' '+u+'</span>';
  }).join('');
}
function elapsedMinutes(c){
  return c.created_at_ms ? Math.max(0,Math.floor((Date.now()-Number(c.created_at_ms))/60000)) : (c.wait||0);
}

window.MI_NAV = [
  {view:'overview',  icon:'layout-dashboard', label:'Vue d\u2019ensemble', group:'FITSABOANA|CLINIQUE'},
  {view:'triage',    icon:'inbox',            label:'File d\u2019expertise', badge:true, badgeValue:DB.cases.length},
  {view:'patients',  icon:'users',            label:'Patients', count:DB.patients.length},
  {view:'consults',  icon:'stethoscope',      label:'Consultations'},
  {view:'visio',     icon:'video',            label:'Visioconsultation', group:'FINDRAFY|TÉLÉMÉDECINE'},
  {view:'messagerie',icon:'message-circle',   label:'Messagerie', badge:true, badgeValue:(DB.fils||[]).reduce((n,f)=>n+(f.non_lus||0),0)},
  {view:'formation', icon:'graduation-cap',   label:'Formation & publications', badge:true, badgeValue:DB.formation.filter(p=>!p.lu).length, group:'FANABEAZANA|SAVOIR'},
  {view:'forum',     icon:'messages-square',  label:'Forum médical'},
  {view:'profil',    icon:'user-round',       label:'Mon profil', group:'RAFITRA|COMPTE'},
];
window.MI_PRIMARY = {icon:'inbox', tip:'Prendre le cas suivant', run:()=>takeNext()};

/* ---------- Chargeur paresseux (1 fichier = 1 chargement) ---------- */
const LAZY = {
  triage:    '/static/js/dashboards/medecin/triage.js',
  patients:  '/static/js/dashboards/medecin/views.js',
  consults:  '/static/js/dashboards/medecin/views.js',
  messagerie:'/static/js/dashboards/shared_messaging.js',
  visio:     '/static/js/dashboards/medecin/social.js',
  formation: '/static/js/dashboards/medecin/social.js',
  forum:     '/static/js/dashboards/medecin/social.js',
  profil:    '/static/js/dashboards/medecin/social.js',
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
    s.onload = ()=>{ const fn = RENDERERS[name]; if(typeof fn==='function' && !fn._lazy) fn(); };
    document.body.appendChild(s);
    return;
  }
  const fn = RENDERERS[name];
  if(typeof fn==='function' && !fn._lazy) fn();
}
MI.registerRenderer('triage',     lazyStub('triage'));
MI.registerRenderer('patients',   lazyStub('patients'));
MI.registerRenderer('consults',   lazyStub('consults'));
MI.registerRenderer('messagerie', lazyStub('messagerie'));
MI.registerRenderer('visio',      lazyStub('visio'));
MI.registerRenderer('formation',  lazyStub('formation'));
MI.registerRenderer('forum',      lazyStub('forum'));
MI.registerRenderer('profil',     lazyStub('profil'));

/* ---------- Salutation + compteurs ---------- */
const CRIT_N = ()=>DB.cases.filter(c=>c.sev==='CRITIQUE').length;
function greet(){
  $('#greetTitle').innerHTML = MI.greeting(DB.me.prenom || window.MI_USER?.prenom || '');
  const n = DB.cases.length, c = CRIT_N();
  let m = n>0 ? '<a data-goto="triage"><b>'+n+' cas</b></a> '+(n>1?'attendent':'attend')+' votre expertise'
              : 'Aucun cas en attente — les agents sont sereins';
  m += c>0 ? ' — dont <a data-goto="triage"><b>'+c+' critique'+(c>1?'s':'')+'</b></a>. Priorité aux cas les plus graves.'
           : ' — la file est sous contrôle.';
  $('#greetMsg').innerHTML = m;
  $('#greetMsg').querySelectorAll('[data-goto]').forEach(x=>x.addEventListener('click',()=>MI.setView(x.dataset.goto)));
}
function updateCounters(){
  MI.setBadge('triage', DB.cases.length);
  MI.setBadge('formation', DB.formation.filter(p=>!p.lu).length);
  MI.setBadge('messagerie', (DB.fils||[]).reduce((n,f)=>n+(f.non_lus||0),0));
  $('#statTriageVal').textContent    = DB.cases.length;
  $('#statTriageDelta').textContent  = DB.cases.length ? 'à traiter' : 'à jour';
  $('#statCritVal').textContent      = CRIT_N();
  $('#statPatVal').textContent       = DB.patients.length;
  $('#statConsVal').textContent      = DB.consults.filter(x=>x.statut==='EN_COURS').length;
  $('#bellDot').hidden               = DB.cases.length===0;
  greet();
}

/* ---------- Cards de triage (overview + vue dédiée) ---------- */
function caseCardHTML(c, preview){
  const s = sevOf(c.sev);
  return '<article class="case-card" data-case="'+c.id+'" style="--sev-col:'+s.col+'">'+
    '<div style="display:flex;flex-direction:column;gap:6px;align-items:center;min-width:64px">'+
    '<span class="sev-chip">'+s.lbl+'</span>'+
    '<span class="wait">attend<b><span data-wait="'+c.id+'">'+elapsedMinutes(c)+'</span> min</b></span></div>'+
    '<div style="min-width:0">'+
    '<div class="case-head"><b>'+esc(c.patient)+'</b><span>'+(c.age||'?')+' ans · '+(c.sexe||'')+' · '+esc(c.csb||'—')+'</span>'+
    (c.preferred?'<span class="badge green">Médecin préféré</span>':'')+
    (c.vocal?'<span class="vocal-tag"><i data-lucide="mic"></i>IA · DICTÉE MALAGASY</span>':'')+'</div>'+
    '<p class="case-motif">'+esc(c.motif)+'</p>'+
    '<div class="vitals">'+vitalChips(c.vitals||{})+'</div>'+
    '<div class="ia-box" data-ia="'+c.id+'"><i data-lucide="sparkles"></i>'+
    '<span><b>'+esc(c.ia?.dx||'—')+'</b> <span class="ia-conf">IA · confiance '+(c.ia?.conf||0)+' %</span></span>'+
    (preview?'':'<span class="ia-acts"><button class="btn sm ok" data-ia-ok="'+c.id+'"><i data-lucide="check"></i>Valider l\u2019IA</button></span>')+
    '</div></div>'+
    '<div class="case-side">'+
    '<div class="case-agent"><b>'+esc(c.agent||'—')+'</b>'+esc(c.csb||'')+'</div>'+
    (preview?'<button class="btn sm role" data-take="'+c.id+'"><i data-lucide="check"></i>Prendre</button>'
            :'<button class="btn sm role" data-take="'+c.id+'"><i data-lucide="stethoscope"></i>Prendre en charge</button>'+
             '<button class="btn sm ghost" data-ord="'+c.id+'"><i data-lucide="file-signature"></i>Ordonnance</button>')+
    '</div></article>';
}
function bindCaseActions(box){
  box.querySelectorAll('[data-take]').forEach(b=>b.addEventListener('click',()=>takeCase(b.dataset.take)));
  box.querySelectorAll('[data-ia-ok]').forEach(b=>b.addEventListener('click',()=>validateIA(b.dataset.iaOk)));
  box.querySelectorAll('[data-ord]').forEach(b=>b.addEventListener('click',()=>openOrd(b.dataset.ord)));
}
function takeCase(id){
  const c = DB.cases.find(x=>String(x.id)===String(id)); if(!c) return;
  const card = document.querySelector('.case-card[data-case="'+id+'"]');
  if(card) MI.stamp(card, 'PRIS EN CHARGE · MI-AINA', true);
  setTimeout(()=>post(DB.urls.take.replace('<ID>', id), {}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Action refusée.','error'); return; }
    DB.cases = DB.cases.filter(x=>String(x.id)!==String(id));
    DB.consults.unshift({id:String(id), patient:c.patient, motif:c.ia?.dx||c.motif,
      statut:'EN_COURS', severite:c.sev, agent:c.agent, csb:c.csb, age:c.age, sexe:c.sexe, date:'à l\u2019instant'});
    updateCounters(); renderTriagePreview(); renderLiveCase();
    if(state.view==='triage' && typeof renderTriage==='function') renderTriage();
    MI.toast(c.patient+' pris en charge — la visio avec '+c.agent+' est disponible.','success');
  }), 800);
}
function validateIA(id){
  const c = DB.cases.find(x=>String(x.id)===String(id)); if(!c) return;
  const box = document.querySelector('[data-ia="'+id+'"]');
  if(box){ box.classList.add('validated');
    box.innerHTML = '<i data-lucide="badge-check"></i><span><b>'+esc(c.ia.dx)+'</b> <span class="ia-conf">diagnostic IA validé</span></span>';
    MI.refreshIcons(); }
  post(DB.urls.ia_validate.replace('<ID>', id), {}).catch(()=>{});
  MI.toast('Suggestion IA validée — jointe au dossier de '+c.patient+'.','success');
}
function takeNext(){
  if(!DB.cases.length){ MI.toast('Aucun cas dans la file — tout est traité.','info'); return; }
  takeCase(DB.cases[0].id);
}
 $('#takeNextBtn').addEventListener('click', takeNext);

/* ---------- Aperçus overview ---------- */
function renderTriagePreview(){
  const box = $('#triagePreview');
  if(!DB.cases.length){
    box.innerHTML = '<div class="empty"><div class="empty-ic"><i data-lucide="coffee"></i></div><h3>La file est vide</h3><p>Un moment rare — profitez-en pour préparer une formation pour les agents.</p></div>';
    MI.refreshIcons(); return;
  }
  box.innerHTML = DB.cases.slice(0,4).map(c=>caseCardHTML(c,true)).join('');
  MI.refreshIcons(); bindCaseActions(box);
}
function renderLiveCase(){
  const box = $('#liveCase');
  const cur = DB.consults.find(c=>c.statut==='EN_COURS');
  if(!cur){
    box.innerHTML = '<p style="font-size:12.5px;color:var(--ink-50);text-align:center;padding:20px 0">Aucun cas en cours — prenez un cas dans la file pour lancer le suivi des constantes.</p>';
    return;
  }
  box.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
    '<div><h3 style="font-family:var(--serif);font-weight:500;font-size:19px">'+esc(cur.patient)+'</h3>'+
    '<div style="font-size:11.5px;color:var(--ink-50);margin-top:3px">'+esc(cur.motif)+' · agent '+esc(cur.agent||'—')+'</div></div>'+
    '<span class="badge red">EN COURS</span></div>'+
    '<div class="sensor-note" style="margin-top:12px;color:var(--ink-50);font-size:12px">Les constantes apparaissent ici après leur enregistrement réel dans le dossier.</div>'+
    '<div class="lc-acts">'+
    '<button class="btn sm role" data-goto="visio"><i data-lucide="video"></i>Visio</button>'+
    '<button class="btn sm ghost" data-ord="'+cur.id+'"><i data-lucide="file-signature"></i>Ordonnance</button>'+
    '<button class="btn sm ghost" data-ori="'+cur.id+'"><i data-lucide="send"></i>Orienter</button></div>';
  MI.refreshIcons();
  box.querySelectorAll('[data-ord]').forEach(b=>b.addEventListener('click',()=>openOrd(b.dataset.ord)));
  box.querySelectorAll('[data-ori]').forEach(b=>b.addEventListener('click',()=>openOri(b.dataset.ori)));
}

/* ---------- Modals : ordonnance & orientation ---------- */
/* Un cas peut venir de la file d'expertise (DB.cases) ou des consultations.
   Sans cette recherche double, le bouton Ordonnance ne trouvait rien
   et la fenetre ne s'ouvrait jamais depuis la file. */
const findAny = id => (DB.consults||[]).find(x=>String(x.id)===String(id))
                   || (DB.cases||[]).find(x=>String(x.id)===String(id));
let ordTarget=null, oriDest='CSB';
function openOrd(id){
  const c = findAny(id); if(!c) return;
  ordTarget = id;
  $('#ordFor').innerHTML = 'Pour <b>'+esc(c.patient)+'</b> — '+esc(c.motif)+'.<br>L\u2019ordonnance partira directement sur le terminal de '+esc(c.agent||'l\u2019agent')+'.';
  $('#ordForm').dataset.consult = id;
  $$('.modal-wrap').forEach(m=>m.hidden=true);
  $('#ordModal').hidden=false;
  setTimeout(()=>$('#ordMeds').focus(),80);
}
 $('#ordForm').addEventListener('submit', e=>{
  e.preventDefault();
  const meds = $('#ordMeds').value.trim();
  if(!meds){ MI.toast('Ajoutez au moins un médicament avec sa posologie.','error'); return; }
  post((DB.urls&&DB.urls.ordonnance?DB.urls.ordonnance:'/consultations/<ID>/ordonnance/').replace('<ID>', ordTarget),
    {contenu:meds, suivi:$('#ordSuivi').value, rdv:$('#ordDate').value}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Signature impossible.','error'); return; }
    const c = findAny(ordTarget); if(c) c.statut='VALIDEE';
    DB.cases = (DB.cases||[]).filter(x=>String(x.id)!==String(ordTarget));
    $$('.modal-wrap').forEach(m=>m.hidden=true); e.target.reset();
    updateCounters(); renderTriagePreview();
    if(state.view==='consults' && typeof renderConsults==='function') renderConsults();
    MI.toast('Ordonnance signée et transmise à l\u2019agent — accusé de réception attendu.','success');
    if(state.view==='consults' && typeof renderConsults==='function') renderConsults();
  });
});
function openOri(id){
  const c = findAny(id); if(!c) return;
  $('#oriForm').dataset.consult = id;
  $('#oriFor').innerHTML = 'Décision pour <b>'+esc(c.patient)+'</b> ('+esc(c.motif)+'). L\u2019agent recevra la consigne et l\u2019établissement sera prévenu.';
  $$('.modal-wrap').forEach(m=>m.hidden=true);
  $('#oriModal').hidden=false;
}
 $('#oriChoice').addEventListener('click', e=>{
  const o = e.target.closest('.radio-opt'); if(!o) return;
  oriDest = o.dataset.dest;
  $('#oriChoice').querySelectorAll('.radio-opt').forEach(x=>x.classList.toggle('on', x===o));
});
 $('#oriForm').addEventListener('submit', e=>{
  e.preventDefault();
  post((DB.urls&&DB.urls.orienter?DB.urls.orienter:'/consultations/<ID>/orienter/').replace('<ID>', e.target.dataset.consult),
    {dest:oriDest, structure:$('#oriStruct').value, note:$('#oriNote').value}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Orientation impossible.','error'); return; }
    const c = findAny(e.target.dataset.consult);
    if(c){ c.statut='ORIENTEE'; c.dest=oriDest; }
    DB.cases = (DB.cases||[]).filter(x=>String(x.id)!==String(e.target.dataset.consult));
    updateCounters(); renderTriagePreview();
    $$('.modal-wrap').forEach(m=>m.hidden=true); e.target.reset();
    if(state.view==='consults' && typeof renderConsults==='function') renderConsults();
    MI.toast('Patient orienté vers '+oriDest+' — agent et établissement notifiés.','success');
  });
});

/* ---------- Fin de télé-expertise : renvoyer le dossier au terrain ---------- */
function retourTerrain(id){
  const c = findAny(id);
  post('/consultations/' + id + '/retour/', {}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Action refusée.','error'); return; }
    if(c) c.statut='TERMINEE';
    DB.cases = (DB.cases||[]).filter(x=>String(x.id)!==String(id));
    updateCounters(); renderTriagePreview();
    if(state.view==='consults' && typeof renderConsults==='function') renderConsults();
    MI.toast('Dossier renvoyé au terrain — l\u2019agent est notifié.','success');
  }).catch(()=>MI.toast('Réseau indisponible — réessayez.','error'));
}

/* ---------- Charts overview ---------- */
(function charts(){
  const ctx = $('#chartActivity').getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,240);
  grad.addColorStop(0,'rgba(193,39,45,.14)'); grad.addColorStop(1,'rgba(193,39,45,0)');
  new Chart(ctx, { type:'line',
    data:{ labels:['29/05','30/05','31/05','01/06','02/06','03/06','04/06','05/06','06/06','07/06','08/06','09/06','10/06','11/06'],
      datasets:[
        {label:'Cas expertisés', data:[6,8,5,9,11,7,5,10,9,8,12,13,8,11], borderColor:'#C1272D', backgroundColor:grad, fill:true, tension:.42, borderWidth:2, pointRadius:0, pointHoverRadius:5},
        {label:'Visios réalisées', data:[3,4,2,5,6,3,2,5,4,4,6,7,4,5], borderColor:'#007E3A', fill:false, tension:.42, borderWidth:2, pointRadius:0, pointHoverRadius:5},
        {label:'Redirections CSB', data:[2,3,1,2,3,2,1,3,2,2,3,4,2,3], borderColor:'#1C4030', fill:false, tension:.42, borderWidth:2, borderDash:[5,4], pointRadius:0, pointHoverRadius:5}]},
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{position:'bottom', labels:{boxWidth:7,boxHeight:7,usePointStyle:true,pointStyle:'circle',padding:16}}, tooltip:MI_TOOLTIP },
      scales:{ x:{grid:{display:false}, ticks:{maxTicksLimit:8}}, y:{grid:{color:'rgba(30,42,34,.07)'}, border:{display:false}, ticks:{precision:0}}} } });
  new Chart($('#chartOrient'), { type:'doughnut',
    data:{ labels:['Traitement local (CSB)','Réf. Hôpital','Terminés','En cours'],
      datasets:[{ data:[34,21,58,15], backgroundColor:['#007E3A','#C1272D','#1C4030','#C98A1F'],
        borderColor:'#FCFBF5', borderWidth:3, hoverOffset:7 }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'70%',
      plugins:{ legend:{position:'bottom', labels:{boxWidth:7,boxHeight:7,usePointStyle:true,pointStyle:'circle',padding:12}}, tooltip:MI_TOOLTIP } } });
})();

/* ---------- Vieillissement des cas ---------- */
setInterval(()=>{
  $$('[data-wait]').forEach(el=>{
    const c=DB.cases.find(x=>String(x.id)===el.dataset.wait);
    if(c) el.textContent=elapsedMinutes(c);
  });
}, 15000);

/* ---------- Init ---------- */
greet(); updateCounters();
renderTriagePreview(); renderLiveCase();
MI.refreshIcons();
window.addEventListener('load', MI.refreshIcons);
