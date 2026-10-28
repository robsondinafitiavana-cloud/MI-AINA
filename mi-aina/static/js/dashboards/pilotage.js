/* MI-AINA — Pilotage. Apostrophes TYPOGRAPHIQUES uniquement. */
const DB = Object.fromEntries(['pending','users','csb','alerts','regions','stats','urls','fils','pubs','forum']
  .map(k => [k, JSON.parse(document.getElementById('data-'+k).textContent)]));
const ROLE_META = {PREMIERE_LIGNE:{label:'Première ligne',badge:'green',av:'g'},
                   MEDECIN:{label:'Médecin',badge:'red',av:'r'},
                   PILOTAGE:{label:'Pilotage',badge:'navy',av:'n'}};
const STATUT_META = {ACTIF:'green',EN_ATTENTE:'amber',SUSPENDU:'gray',REFUSE:'red'};
const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
const post = (url, body) => fetch(url, {method:'POST',
  headers:{'X-CSRFToken':csrf,'Content-Type':'application/json'}, body:JSON.stringify(body||{})}).then(r=>r.json());
const fmtN = MI.fmt;
const esc = s => String(s).replace(/</g,'&lt;');
const attrEsc = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const ini = d => d.prenom.replace('Dr ','')[0] + d.nom[0];

window.MI_NAV = [
  {view:'overview', icon:'layout-dashboard', label:'Vue d\u2019ensemble', group:'FITANTANANA|PILOTAGE'},
  {view:'users', icon:'users', label:'Utilisateurs', count:DB.users.length},
  {view:'pending', icon:'clock-3', label:'Comptes en attente', badge:true, badgeValue:DB.pending.length},
  {view:'csb', icon:'building-2', label:'CSB', count:DB.csb.length},
  {view:'regions', icon:'map', label:'Régions'},
  {view:'stats', icon:'chart-column', label:'Statistiques', group:'FANARAHA-MASO|SUPERVISION'},
  {view:'alerts', icon:'siren', label:'Alertes', badge:true, badgeValue:DB.alerts.length},
  {view:'surveillance', icon:'radar', label:'Surveillance'},
  {view:'prevention', href:'/prevention/', icon:'shield-plus', label:'Prévention', group:'FANABEAZANA|SAVOIR', inDock:false},
  {view:'publications', icon:'megaphone', label:'Publications', badge:true, badgeValue:DB.pubs.filter(p=>!p.lu).length, group:'FANABEAZANA|DIFFUSION'},
  {view:'forum', icon:'messages-square', label:'Forum médical'},
  {view:'messagerie', icon:'message-circle', label:'Messagerie', badge:true, badgeValue:(DB.fils||[]).reduce((n,f)=>n+(f.non_lus||0),0)},
  {view:'profil', icon:'user-round', label:'Mon profil', group:'RAFITRA|COMPTE'},
];
if(document.body.dataset.superuser === '1')
  window.MI_NAV.push({view:'admin', href:'/admin/', icon:'shield-check', label:'Administration'});
window.MI_PRIMARY = {icon:'plus', tip:'Nouveau CSB', run:()=>{
  MI.loadDashboardContent('/csb/nouveau/').catch(()=>{ window.location.href='/csb/nouveau/'; });
}};
// Le même formulaire Django existant est accessible depuis l’accueil et la vue CSB.
document.addEventListener('click', e=>{
  const button = e.target.closest('[data-open-csb]');
  if(!button) return;
  e.preventDefault();
  MI.loadDashboardContent('/csb/nouveau/').catch(()=>{ window.location.href='/csb/nouveau/'; });
});

/* ---- Salutation & compteurs ---- */
const nPending = () => DB.pending.length, nAlerts = () => DB.alerts.length;
function greet(){
   $('#greetTitle').innerHTML = MI.greeting(window.MI_USER.prenom);
  const p = nPending(), a = nAlerts();
  let m = p ? `<a data-goto="pending"><b>${p} demande${p>1?'s':''} d\u2019inscription</b></a> ${p>1?'attendent':'attend'} votre décision`
            : 'Aucune demande d\u2019inscription en attente — le registre est à jour';
  m += a ? ` — dont <a data-goto="alerts"><b>${a} alerte${a>1?'s':''}</b></a> à superviser.` : ' — le système est calme.';
  $('#greetMsg').innerHTML = m;
}
function badges(){
  MI.setBadge('pending', nPending()); MI.setBadge('alerts', nAlerts());
  $('#statPendingVal').textContent = nPending();
  $('#statPendingDelta').textContent = nPending() ? 'à traiter' : 'à jour';
  $('#statAlertsVal').textContent = nAlerts();
  $('#pendingPreviewSub').textContent = nPending() ? nPending()+' comptes attendent une décision' : 'Rien à traiter';
  greet();
}

/* ---- Aperçus ---- */
function renderPendingPreview(){
  const box = $('#pendingPreview');
  if(!DB.pending.length){
    box.innerHTML = '<div class="empty"><div class="empty-ic"><i data-lucide="circle-check"></i></div><h3>Tout est traité</h3><p>Aucune demande en attente.</p></div>';
    MI.refreshIcons(); return;
  }
  box.innerHTML = DB.pending.slice(0,4).map(d=>{
    const r = ROLE_META[d.role];
    return `<div class="mini-row" data-mini="${d.id}">
      <span class="p-av ${r.av}">${ini(d)}</span>
      <div class="who"><b>${esc(d.prenom)} ${esc(d.nom)}</b><span>${r.label} · ${esc(d.struct)}</span></div>
      <time>${esc(d.date)}</time>
      <button class="btn sm ok" data-qv="${d.id}"><i data-lucide="check"></i></button>
      <button class="btn sm danger" data-qr="${d.id}"><i data-lucide="x"></i></button></div>`;
  }).join('');
  MI.refreshIcons();
  box.querySelectorAll('[data-qv]').forEach(b=>b.onclick=()=>decide(b.dataset.qv,'ACTIF'));
  box.querySelectorAll('[data-qr]').forEach(b=>b.onclick=()=>decide(b.dataset.qr,'REFUSE'));
}
function alertHTML(a, compact){
  const r = a.report;
  const reportDetails = r && !compact ? `<details class="alert-report-details">
    <summary><i data-lucide="file-search"></i>Consulter le signalement</summary>
    <dl>
      <div><dt>Déclarant</dt><dd>${esc(r.reporter)} · ${esc(r.role)}</dd></div>
      <div><dt>Structure</dt><dd>${esc(r.structure)}</dd></div>
      <div><dt>Zone</dt><dd>${esc(r.village)} · ${esc(r.district)} · ${esc(r.region)}</dd></div>
      <div><dt>Cas estimés</dt><dd>${esc(r.cases)}</dd></div>
      <div><dt>Précisions</dt><dd>${esc(r.note || 'Aucune précision')}</dd></div>
    </dl>
  </details>` : '';
  return `<div class="alert-item ${a.lvl}" data-alert="${a.id}">
    <span class="alert-dot"></span>
    <div class="alert-body"><b>${esc(a.title)}</b> <span class="alert-tag">${esc(a.tag)}</span>
      <p>${esc(a.desc)}</p>${reportDetails}<time>${esc(a.time)}</time></div>
    ${compact?'':'<button class="btn sm ghost alert-act" data-done="'+a.id+'"><i data-lucide="check"></i>Traiter</button>'}</div>`;
}
function renderAlertsPreview(){
  $('#alertsPreview').innerHTML = DB.alerts.slice(0,3).map(a=>alertHTML(a,true)).join('');
  MI.refreshIcons();
}

/* ---- Décision : TAMPON + POST + cascade ---- */
function decide(id, statut){
  const d = DB.pending.find(x=>x.id===id); if(!d) return;
  const ok = statut==='ACTIF';
  const host = document.querySelector(`tr[data-row="${id}"]`) || document.querySelector(`div[data-mini="${id}"]`);
  if(host){
    MI.stamp(host, ok?'VALIDÉ · MI-AINA':'REFUSÉ · MI-AINA', ok);
    setTimeout(()=>{
      if(host.tagName==='TR') host.classList.add('leaving', ok?'val':'ref');
      else { host.style.transition='all .45s ease'; host.style.opacity=0; host.style.transform='translateX(26px)'; }
    }, 780);
  }
  setTimeout(()=>post(DB.urls.decide.replace('<ID>', id), {statut}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Action refusée.','error'); return; }
    DB.pending = DB.pending.filter(x=>x.id!==id);
    if(ok) DB.users.unshift({...d, statut:'ACTIF', last:'jamais'});
    badges(); renderPendingPreview();
    if(state.view==='pending') renderPending();
    MI.toast(ok ? `Tampon apposé — ${d.prenom} ${d.nom} peut désormais se connecter.`
                : `Tampon apposé — la demande de ${d.prenom} ${d.nom} est refusée.`, ok?'success':'error');
  }), 1180);
}

/* ---- Vue : demandes ---- */
function renderPending(){
  const el = $('#view-pending');
  el.innerHTML = `<header class="view-head"><div>
      <h2 class="vh-title">Demandes d\u2019inscription</h2>
      <p class="vh-sub">${DB.pending.length} compte${DB.pending.length>1?'s':''} en attente — votre décision appose le tampon officiel.</p></div>
      <div class="pill-filters">${[['ALL','Tous'],['PREMIERE_LIGNE','Première ligne'],['MEDECIN','Médecins'],['PILOTAGE','Pilotage']]
        .map(([k,l])=>`<button class="pill ${state.pf===k||(!state.pf&&k==='ALL')?'on':''}" data-pf="${k}">${l}</button>`).join('')}</div></header>
    <div class="card"><div class="table-wrap">${
      DB.pending.length ? `<table class="table"><thead><tr><th>Demandeur</th><th>Rôle</th><th>Identifiant</th><th>Structure · Région</th><th>Décision</th></tr></thead><tbody>${
        DB.pending.map(d=>{ const r=ROLE_META[d.role]; return `<tr data-row="${d.id}">
          <td><div class="person"><span class="p-av ${r.av}">${ini(d)}</span><div><b>${esc(d.prenom)} ${esc(d.nom)}</b><span class="cell-sub">demandé le ${esc(d.date)}</span></div></div></td>
          <td><span class="badge ${r.badge}">${r.label}</span></td>
          <td><span class="ident">${esc(d.ident)}</span></td>
          <td><span class="cell-loc"><i data-lucide="building-2"></i>${esc(d.struct)}</span><span class="cell-sub cell-loc"><i data-lucide="map-pin"></i>${esc(d.region)}</span></td>
          <td style="white-space:nowrap"><button class="btn sm ok" data-act="val" data-id="${d.id}"><i data-lucide="stamp"></i>Valider</button>
          <button class="btn sm danger" data-act="ref" data-id="${d.id}"><i data-lucide="x"></i>Refuser</button></td></tr>`; }).join('')
      }</tbody></table>` : '<div class="empty"><div class="empty-ic"><i data-lucide="circle-check"></i></div><h3>Toutes les demandes ont été traitées</h3><p>Les nouvelles inscriptions apparaîtront ici automatiquement.</p></div>'
    }</div></div>`;
  MI.refreshIcons();
  el.querySelectorAll('[data-pf]').forEach(b=>b.onclick=()=>{ state.pf=b.dataset.pf; DB._pf=b.dataset.pf; renderPendingFiltered(); });
  el.querySelectorAll('[data-act]').forEach(b=>b.onclick=()=>decide(b.dataset.id, b.dataset.act==='val'?'ACTIF':'REFUSE'));
}
function renderPendingFiltered(){ /* filtre rôle puis re-rend — même code, rows filtrées */ 
  if(!DB._pf || DB._pf==='ALL'){ renderPending(); return; }
  const keep = DB.pending.filter(d=>d.role===DB._pf);
  const all = DB.pending; DB.pending = keep; renderPending(); DB.pending = all;
}

/* ---- Vue : utilisateurs ---- */
function renderUsers(){
  const el = $('#view-users');
  el.innerHTML = `<header class="view-head"><div>
      <h2 class="vh-title">Utilisateurs de la plateforme</h2>
      <p class="vh-sub">${DB.users.length} comptes — gestion des accès et suspension.</p></div></header>
    <div class="card"><div class="table-wrap"><table class="table">
      <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Identifiant</th><th>Structure · Région</th><th>Statut</th><th>Dernière conn.</th><th></th></tr></thead><tbody>${
      DB.users.map(u=>{ const r=ROLE_META[u.role]; return `<tr>
        <td><div class="person"><span class="p-av ${r.av} ${u.photo?'has-photo':''}">${ini(u)}${u.photo?`<img class="p-av-photo" src="${attrEsc(u.photo)}" alt="" loading="lazy">`:''}</span><div><b>${esc(u.prenom)} ${esc(u.nom)}</b></div></div></td>
        <td><span class="badge ${r.badge}">${r.label}</span></td>
        <td><span class="ident">${esc(u.ident)}</span></td>
        <td><span class="cell-loc"><i data-lucide="building-2"></i>${esc(u.struct)}</span><span class="cell-sub cell-loc"><i data-lucide="map-pin"></i>${esc(u.region)}</span></td>
        <td><span class="badge ${STATUT_META[u.statut]}">${u.statut}</span></td>
        <td><span class="mono" style="font-size:11.5px;color:var(--ink-50)">${esc(u.last)}</span></td>
        <td style="white-space:nowrap">${u.statut==='ACTIF'
          ? `<button class="btn sm danger" data-susp="${u.id}"><i data-lucide="pause"></i>Suspendre</button>`
          : u.statut==='SUSPENDU' ? `<button class="btn sm ok" data-susp="${u.id}"><i data-lucide="play"></i>Réactiver</button>` : ''}</td></tr>`; }).join('')
      }</tbody></table></div></div>`;
  el.querySelectorAll('.p-av-photo').forEach(img=>img.addEventListener('error',()=>{
    img.remove(); img.closest('.p-av')?.classList.remove('has-photo');
  },{once:true}));
  MI.refreshIcons();
  el.querySelectorAll('[data-susp]').forEach(b=>b.onclick=()=>post(DB.urls.statut.replace('<ID>', b.dataset.susp), {})
    .then(res=>{ if(!res.ok){ MI.toast('Action refusée.','error'); return; }
      const u = DB.users.find(x=>x.id===b.dataset.susp); u.statut = res.statut;
      MI.toast(res.statut==='SUSPENDU' ? `${u.prenom} ${u.nom} a été suspendu — connexion bloquée.` : `${u.prenom} ${u.nom} est réactivé.`,
               res.statut==='SUSPENDU'?'error':'success');
      renderUsers(); }));
}

/* ---- Vue : CSB ---- */
function renderCsb(){
  const el = $('#view-csb');
  el.innerHTML = `<header class="view-head"><div>
      <h2 class="vh-title">Centres de santé (CSB)</h2>
      <p class="vh-sub">${DB.csb.length} centres rattachés — base du découpage territorial.</p></div>
      <button type="button" class="btn solid" data-open-csb><i data-lucide="plus"></i>Ajouter un CSB</button></header>
    <div class="grid-3">${DB.csb.map(c=>`<a class="info-card" style="text-decoration:none;color:inherit" href="/csb/${c.code}/">
      <span class="mono" style="font-size:10px;letter-spacing:1.4px;color:var(--mg-green);background:rgba(0,126,58,.08);padding:3px 9px;border-radius:5px">${esc(c.code)}</span>
      <h3 style="font-size:15.5px;margin-top:11px">${esc(c.nom)}</h3>
      <div style="font-size:12px;color:var(--ink-50);margin-top:5px;display:flex;align-items:center;gap:5px"><i data-lucide="map-pin" style="width:12px;height:12px"></i>${esc(c.district)} · ${esc(c.region)}</div>
      <div style="display:flex;gap:18px;margin-top:14px;padding-top:13px;border-top:1px dashed var(--line)">
        <div><b class="mono" style="font-size:17px;display:block">${c.agents}</b><span style="font-size:10px;color:var(--ink-50)">AGENTS</span></div>
        <div><b class="mono" style="font-size:17px;display:block">${fmtN.format(c.patients)}</b><span style="font-size:10px;color:var(--ink-50)">PATIENTS</span></div>
        <div><b style="color:var(--mg-green)">●</b><span style="font-size:10px;color:var(--ink-50)">ACTIF</span></div>
      </div></a>`).join('')}</div>`;
  MI.refreshIcons();
}

/* ---- Vue : alertes ---- */
function renderAlerts(){
  const el = $('#view-alerts');
  el.innerHTML = `<header class="view-head"><div>
      <h2 class="vh-title">Alertes du système</h2>
      <p class="vh-sub">${nAlerts()} alertes actives — sécurité, transmissions et supervision.</p></div></header>
    <div class="card" style="overflow:hidden">${
      DB.alerts.length ? DB.alerts.map(a=>alertHTML(a)).join('')
      : '<div class="empty"><div class="empty-ic"><i data-lucide="shield-check"></i></div><h3>Aucune alerte active</h3><p>Le système fonctionne normalement.</p></div>'}</div>`;
  MI.refreshIcons();
  el.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>{
    b.closest('.alert-item').classList.add('leaving');
    setTimeout(()=>post(DB.urls.alerte_traiter.replace('<ID>', b.dataset.done), {}).then(res=>{
      if(!res.ok){ MI.toast('Action refusée.','error'); return; }
      DB.alerts = DB.alerts.filter(a=>a.id!==b.dataset.done);
      badges(); renderAlertsPreview();
      if(state.view==='alerts') renderAlerts();
      MI.toast('Alerte marquée comme traitée.','success');
    }), 400);
  });
}

/* ---- Carte vivante ---- */
const REG_STATUT = {OK:{badge:'green',txt:'ACTIF'}, SYNC:{badge:'amber',txt:'SYNC RETARD'}, ALERTE:{badge:'red',txt:'SILENCE RADIO'}};
const REG_COLOR = s => s==='OK'?'#007E3A':s==='SYNC'?'#C98A1F':'#C1272D';
let selR = 0;
function drawMap(){
  $('#mapDots').innerHTML = DB.regions.map((r,i)=>{
    const c = REG_COLOR(r.statut), sel = i===selR;
    return `<g class="rdot" data-ri="${i}" style="cursor:pointer"><title>${esc(r.nom)} — ${REG_STATUT[r.statut].txt}</title>
      <circle cx="${r.x}" cy="${r.y}" r="9" fill="transparent"/>
      ${sel?`<circle cx="${r.x}" cy="${r.y}" r="5.5" fill="none" stroke="${c}" stroke-width="1.6"/>`:''}
      <circle cx="${r.x}" cy="${r.y}" r="${sel?3.4:2.6}" fill="${c}"/>
      <circle cx="${r.x}" cy="${r.y}" r="3" fill="none" stroke="${c}" stroke-width="1">
        <animate attributeName="r" values="3;11" dur="2.6s" begin="${(i*0.3).toFixed(1)}s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".5;0" dur="2.6s" begin="${(i*0.3).toFixed(1)}s" repeatCount="indefinite"/></circle></g>`;
  }).join('');
}
function drawPanel(i){
  const r = DB.regions[i], st = REG_STATUT[r.statut];
  $('#regionPanel').innerHTML = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
      <div><p class="mono" style="font-size:9px;letter-spacing:1.6px;color:var(--ink-35)">FARITRA · RÉGION</p>
      <h3 style="font-family:var(--serif);font-weight:500;font-size:21px;margin-top:4px">${esc(r.nom)}</h3></div>
      <span class="badge ${st.badge}">${st.txt}</span></div>
    <div style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Centres CSB</span><b class="mono">${r.csb}</b></div>
      <div style="display:flex;justify-content:space-between;padding:9px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Synchronisation</span><b class="mono" style="font-size:11.5px;font-weight:500;color:var(--ink-70)">${esc(r.sync)}</b></div>
    </div><div class="mono" style="margin-top:auto;padding-top:12px;font-size:9px;letter-spacing:1.2px;color:var(--ink-35)">CLIQUEZ POUR FIGER LA SÉLECTION</div>`;
}
 $('#mapDots').addEventListener('click', e=>{ const g=e.target.closest('.rdot'); if(!g) return;
  selR=+g.dataset.ri; drawMap(); drawPanel(selR); });
 $('#mapDots').addEventListener('mouseover', e=>{ const g=e.target.closest('.rdot'); if(g) drawPanel(+g.dataset.ri); });

/* ---- Charts ---- */
(function charts(){
  const ctx = $('#chartActivity').getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,250);
  grad.addColorStop(0,'rgba(0,126,58,.16)'); grad.addColorStop(1,'rgba(0,126,58,0)');
  new Chart(ctx, { type:'line',
    data:{ labels:['29/05','30/05','31/05','01/06','02/06','03/06','04/06','05/06','06/06','07/06','08/06','09/06','10/06','11/06'],
      datasets:[
        {label:'Première ligne', data:[118,132,109,145,160,88,64,142,151,138,166,171,124,158],
         borderColor:'#007E3A', backgroundColor:grad, fill:true, tension:.42, borderWidth:2, pointRadius:0, pointHoverRadius:5},
        {label:'Médecin', data:[42,51,38,47,55,30,22,49,52,46,58,61,44,53],
         borderColor:'#C1272D', fill:false, tension:.42, borderWidth:2, pointRadius:0, pointHoverRadius:5},
        {label:'Pilotage', data:[6,8,5,9,7,4,3,8,7,6,9,10,6,8],
         borderColor:'#1C4030', fill:false, tension:.42, borderWidth:2, borderDash:[5,4], pointRadius:0, pointHoverRadius:5}]},
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{position:'bottom', labels:{boxWidth:7,boxHeight:7,usePointStyle:true,pointStyle:'circle',padding:16}}, tooltip:MI_TOOLTIP },
      scales:{ x:{grid:{display:false}, ticks:{maxTicksLimit:8}},
               y:{grid:{color:'rgba(30,42,34,.07)'}, border:{display:false}, ticks:{precision:0}}}} });
  const center = { id:'c', afterDraw(ch){ const m=ch.getDatasetMeta(0).data[0]; if(!m) return;
    const c=ch.ctx; c.save(); c.textAlign='center';
    c.font="600 21px 'IBM Plex Mono'"; c.fillStyle='#1E2A22'; c.fillText(fmtN.format(DB.stats.users_total), m.x, m.y-3);
    c.font="9.5px 'IBM Plex Mono'"; c.fillStyle='rgba(30,42,34,.5)'; c.fillText('COMPTES ACTIFS', m.x, m.y+14); c.restore(); }};
  new Chart($('#chartRoles'), { type:'doughnut',
    data:{ labels:['Première ligne','Médecin','Pilotage'],
      datasets:[{ data:[DB.stats.users_pl, DB.stats.users_med, DB.stats.users_pil],
        backgroundColor:['#007E3A','#C1272D','#1C4030'], borderColor:'#FCFBF5', borderWidth:3, hoverOffset:7 }]},
    options:{ responsive:true, maintainAspectRatio:false, cutout:'70%',
      plugins:{ legend:{position:'bottom', labels:{boxWidth:7,boxHeight:7,usePointStyle:true,pointStyle:'circle',padding:12}}, tooltip:MI_TOOLTIP } },
    plugins:[center] });
})();

/* ---- Export & commands ---- */
 $('#exportBtn').onclick = ()=>MI.toast('Rapport PDF en cours de génération (démo) — export DHIS2 prévu en phase statistiques.','info');
MI.addCommands([
  {icon:'plus', label:'Créer un nouveau CSB', group:'Actions', run:()=>{
    MI.loadDashboardContent('/csb/nouveau/').catch(()=>{ window.location.href='/csb/nouveau/'; });
  }},
  {icon:'file-down', label:'Exporter le rapport (PDF)', group:'Actions', run:()=>$('#exportBtn').click()},
]);

/* ---- Enregistrements + init ---- */
MI.registerRenderer('pending', renderPending);
MI.registerRenderer('users', renderUsers);
MI.registerRenderer('csb', renderCsb);
MI.registerRenderer('alerts', renderAlerts);
 $('#statUsersHint').textContent = fmtN.format(DB.stats.users_pl)+' première ligne · '+fmtN.format(DB.stats.users_med)+' médecins';
drawMap(); drawPanel(selR);
renderPendingPreview(); renderAlertsPreview(); badges();
MI.countUp($('#statUsersVal'), DB.stats.users_total);
MI.countUp($('#statPendingVal'), nPending(), 700);
MI.countUp($('#statCsbVal'), DB.stats.csb_total);
MI.countUp($('#statAlertsVal'), nAlerts(), 700);
MI.refreshIcons();
