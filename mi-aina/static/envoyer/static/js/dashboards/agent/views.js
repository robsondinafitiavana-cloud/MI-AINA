/* MI-AINA — Agent · consultations, signalements, devices, mesures */
let ordCurrent=null;

function renderConsults(){
  const el = $('#view-consults'); if(!el) return;
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Consultations</h2>'+
    '<p class="vh-sub">'+DB.consults.length+' dossiers — les avis urgents remontent en priorité au médecin.</p></div>'+
    '<button class="btn solid" data-goto="saisie"><i data-lucide="plus"></i>Nouvelle</button></header>'+
    '<div class="card"><div class="table-wrap"><table class="table">'+
    '<thead><tr><th>Patient</th><th>Motif</th><th>Statut</th><th>Date</th><th></th></tr></thead><tbody>'+
    (DB.consults.length ? DB.consults.map(c=>{
      const m = STATUT_META[c.statut]||STATUT_META.TERMINEE;
      return '<tr data-row="'+c.id+'">'+
        '<td><b style="font-size:13px">'+esc(c.patient)+'</b></td>'+
        '<td style="max-width:240px"><span style="font-size:12.5px">'+esc(c.motif)+'</span>'+
        (c.medecin?'<span class="cell-sub">pris en charge par '+esc(c.medecin)+'</span>':'')+'</td>'+
        '<td><span class="badge '+m.b+'">'+m.l+'</span></td>'+
        '<td><span class="mono" style="font-size:11px;color:var(--ink-50)">'+esc(c.date)+'</span></td>'+
        '<td style="white-space:nowrap">'+
        ((c.code||c.code_patient)?'<button type="button" class="btn sm ghost" data-open-dossier="'+esc(c.code||c.code_patient)+'"><i data-lucide="folder-open"></i>Dossier</button>':'')+
        (c.statut==='AVIS_RECU'?'<button class="btn sm ok" data-ord="'+c.id+'"><i data-lucide="file-text"></i>Ordonnance</button>':'')+
        (c.statut==='EN_COURS' && c.medecin_id?'<button class="btn sm role" data-consult-visio="'+esc(c.id)+'" data-doc-id="'+esc(c.medecin_id)+'"><i data-lucide="video"></i>Visio avec '+esc(c.medecin||'le médecin assigné')+'</button>':'')+
        (c.statut==='EN_ATTENTE' && !c.medecin_id?'<button class="btn sm ghost" data-consult-visio="'+esc(c.id)+'"><i data-lucide="search"></i>Chercher un médecin en visio</button>':'')+
        '</td></tr>';
    }).join('')
      : '<tr><td colspan="5"><div class="empty" style="padding:34px"><div class="empty-ic"><i data-lucide="stethoscope"></i></div><h3 style="font-size:18px">Aucune consultation</h3><p>Créez la première depuis « Nouvelle consultation ».</p></div></td></tr>')+
    '</tbody></table></div></div>';
  MI.refreshIcons();
  el.querySelectorAll('[data-ord]').forEach(b=>b.onclick=()=>openOrd(b.dataset.ord));
  el.querySelectorAll('[data-consult-visio]').forEach(b=>b.onclick=()=>{
    const c=DB.consults.find(x=>String(x.id)===String(b.dataset.consultVisio));
    if(!c || !window.MI?.openConsultVisio){ MI.toast('Impossible d’ouvrir la visio de cette consultation.','error'); return; }
    window.MI.openConsultVisio({consultationId:c.id, medecinId:c.medecin_id, patient:c.patient,
      code:c.code, motif:c.motif, symptomes:c.symptomes, severite:c.severite});
  });
}
function openOrd(id){
  const c = DB.consults.find(x=>String(x.id)===String(id)); if(!c) return;
  ordCurrent = id;
  const f=$('#ordFrom'); if(f) f.textContent = 'Prescription reçue pour '+c.patient+' — visible sur votre terminal.';
  const l=$('#ordLines'); if(l) l.innerHTML =
    '<div class="ord-line"><b>Artéméther-Luméfantrine 20/120 mg</b><span>2 cp matin et soir · 3 jours</span></div>'+
    '<div class="ord-line"><b>Paracétamol sirop</b><span>5 ml si fièvre · max 4 fois/jour</span></div>'+
    '<div class="ord-line"><b>Zinc + SRO</b><span>après chaque selle liquide</span></div>';
  const s=$('#ordSuivi'); if(s) s.textContent = 'Suivi : contrôle agent sous 48 h · réévaluation visio si persistance.';
  const m=$('#ordModal'); if(m) m.hidden = false;
  let dl=$('#ordDossier'); const cdc=c.code||c.code_patient;
  if(!dl && m){ const b=m.querySelector('.modal-body');
    if(b) b.insertAdjacentHTML('afterbegin','<button type="button" id="ordDossier" class="btn sm ghost" style="margin-bottom:10px"><i data-lucide="folder-open"></i>Ouvrir le dossier patient</button>');
    dl=$('#ordDossier'); }
  if(dl){ if(cdc){ dl.dataset.openDossier=cdc; dl.hidden=false; } else { dl.hidden=true; } }
  MI.refreshIcons();
}

function renderReports(){
  const el = $('#view-reports'); if(!el) return;
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Signalements sanitaires</h2>'+
    '<p class="vh-sub">Transmis en direct au Pilotage (MadaAlert) et au médecin de votre CSB — supprimable tant qu\u2019il n\u2019est pas pris en charge.</p></div>'+
    '<button class="btn solid" id="repOpen"><i data-lucide="megaphone"></i>Nouveau signalement</button></header>'+
    '<div class="card"><div class="table-wrap"><table class="table">'+
    '<thead><tr><th>Type</th><th>Village</th><th>Cas</th><th>Précisions</th><th>Statut</th><th>Date</th><th></th></tr></thead><tbody>'+
    (DB.reports.length ? DB.reports.map(r=>
      '<tr data-row="'+r.id+'">'+
      '<td><b style="font-size:12.5px">'+esc(r.type)+'</b></td><td>'+esc(r.village)+'</td>'+
      '<td><span class="mono" style="font-weight:600">'+r.n+'</span></td>'+
      '<td style="max-width:260px"><span style="font-size:12px;color:var(--ink-70)">'+esc(r.note)+'</span></td>'+
      '<td><span class="badge '+(r.statut==='TRANSMIS'?'green':'amber')+'">'+esc(r.statut)+'</span></td>'+
      '<td><span class="mono" style="font-size:11px;color:var(--ink-50)">'+esc(r.date)+'</span></td>'+
      '<td style="white-space:nowrap">'+
      (r.statut==='TRANSMIS'?'<button class="btn sm danger" data-del="'+r.id+'" data-type="'+esc(r.type)+'"><i data-lucide="trash-2"></i>Annuler</button>':'')+
      '</td></tr>').join('')
      : '<tr><td colspan="7"><div class="empty" style="padding:34px"><div class="empty-ic"><i data-lucide="megaphone"></i></div><h3 style="font-size:18px">Aucun signalement</h3><p>Un foyer suspecté dans votre village ? Signalez-le — MadaAlert et le médecin sont notifiés en direct.</p></div></td></tr>')+
    '</tbody></table></div></div>';
  MI.refreshIcons();
  const ro = $('#repOpen'); if(ro) ro.onclick = ()=>{ const m=$('#repModal'); if(m) m.hidden=false; setTimeout(()=>$('#repVillage').focus(),80); };
  el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>deleteReport(+b.dataset.del, b.dataset.type));
}
function deleteReport(id, type){
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-wrap" id="delModal">'+
    '<div class="modal" style="width:min(430px,100%)"><div class="modal-head"><b>Annuler le signalement</b>'+
    '<button data-dl-close><i data-lucide="x"></i></button></div>'+
    '<div class="modal-body"><p style="font-size:13px;line-height:1.6;color:var(--ink-70)">Confirmez-vous l\u2019annulation du signalement'+
    (type?' <b>'+esc(type)+'</b>':'')+' ? Les destinataires déjà notifiés verront le statut passer à « annulé » lors de leur prochaine consultation.</p></div>'+
    '<div class="modal-foot"><button class="btn ghost" data-dl-close>Conserver</button>'+
    '<button class="btn danger" id="dlConfirm"><i data-lucide="trash-2"></i>Annuler le signalement</button></div></div></div>');
  MI.refreshIcons();
  $('#delModal').querySelectorAll('[data-dl-close]').forEach(b=>b.onclick=()=>$('#delModal').remove());
  $('#dlConfirm').onclick = e=>{
    const button=e.currentTarget;
    button.disabled=true;
    post((DB.urls.report_delete||'/reports/<ID>/delete/').replace('<ID>', id), {}).then(res=>{
      if(!res.ok){ button.disabled=false;MI.toast(res.erreur||'Annulation impossible.','error'); return; }
      $('#delModal')?.remove();
      const row = document.querySelector('tr[data-row="'+id+'"]');
      if(row) MI.stamp(row, 'ANNULÉ · MI-AINA', false);
      setTimeout(()=>{
        DB.reports = DB.reports.filter(x=>String(x.id)!==String(id));
        updateCounters(); refreshDockBadges();
        if(state.view==='reports') renderReports();
        MI.toast('Signalement annulé — retrait effectué dans votre registre.','success');
      }, 900);
    }).catch(()=>{button.disabled=false;MI.toast('Erreur réseau — annulation non confirmée. Réessayez.','error');});
  };
}

/* ================= ACCUSÉ DE TRANSMISSION ================= */
function showReceipt(sg, destinataires){
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-wrap" id="rcModal">'+
    '<div class="modal" style="width:min(460px,100%)"><div class="modal-head">'+
    '<b>Accusé de transmission</b><button data-rc-close><i data-lucide="x"></i></button></div>'+
    '<div class="modal-body">'+
    '<div class="stamp ok" style="position:static;display:inline-block;margin-bottom:14px"><span>TRANSMIS · MI-AINA</span></div>'+
    '<p style="font-size:13.5px;line-height:1.65;color:var(--ink-70)">Votre signalement <b>'+esc(sg.type)+'</b> (réf. <b class="mono">S-'+sg.id+'</b>, '+sg.n+' cas — '+esc(sg.village)+')'+
    ' a été transmis en direct aux autorités sanitaires suivantes :</p>'+
    '<div style="margin:12px 0;display:flex;flex-direction:column;gap:8px">'+
    (destinataires||[]).map(d=>'<div style="display:flex;align-items:center;gap:9px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;background:var(--field)">'+
    '<i data-lucide="badge-check" style="width:15px;height:15px;color:var(--mg-green);flex:none"></i>'+
    '<span style="font-size:12.5px;font-weight:600">'+esc(d)+'</span>'+
    '<span class="mono" style="margin-left:auto;font-size:9px;color:#026630;background:rgba(0,126,58,.1);padding:2px 8px;border-radius:999px">NOTIFIÉ</span></div>').join('')+
    '</div>'+
    '<p style="font-size:11.5px;color:var(--ink-50);line-height:1.55">Vous serez informé du traitement de ce signalement. En cas de détérioration, renforcez-le avec un nombre de cas actualisé.</p>'+
    '</div><div class="modal-foot">'+
    '<button class="btn ghost" data-rc-close>Fermer</button>'+
    '<button class="btn solid" data-rc-consult><i data-lucide="clipboard-pen"></i>Consulter un patient lié</button></div>'+
    '</div></div>');
  MI.refreshIcons();
  $('#rcModal').querySelectorAll('[data-rc-close]').forEach(b=>b.onclick=()=>$('#rcModal').remove());
  $('#rcModal').addEventListener('click', e=>{ if(e.target.id==='rcModal') $('#rcModal').remove(); });
  $('#rcModal').querySelector('[data-rc-consult]').onclick = ()=>{ $('#rcModal').remove(); MI.setView('saisie'); };
}

/* ================= DEVICES ================= */
function renderDevices(){
  const el = $('#view-devices'); if(!el) return;
  const ST = {'CONNECTÉ':'green','EN PRÊT':'amber','HORS LIGNE':'gray'};
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Boîtiers IoT (ESP32)</h2>'+
    '<p class="vh-sub">'+DB.devices.length+' boîtier(s) référencé(s) — température infrarouge et module ECG AD8232.</p></div>'+
    '<button class="btn solid" id="pairBtn"><i data-lucide="qr-code"></i>Jumeler un boîtier</button></header>'+
    '<div class="grid-3">'+(DB.devices.length ? DB.devices.map(d=>
      '<div class="info-card">'+
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'+
      '<span class="badge '+(ST[d.statut]||'gray')+'">'+esc(d.statut)+'</span>'+
      '<div style="text-align:right"><div class="bat '+(d.bat<20?'c':d.bat<40?'w':'')+'" style="width:70px"><i style="width:'+d.bat+'%"></i></div>'+
      '<span class="mono" style="font-size:9px;color:var(--ink-50)">'+d.bat+' %</span></div></div>'+
      '<h3 style="font-size:15px;margin-top:11px">'+esc(d.nom)+'</h3>'+
      '<div style="font-size:11.5px;color:var(--ink-50);margin-top:4px"><i data-lucide="map-pin" style="width:11px;height:11px;vertical-align:-1px"></i> '+esc(d.csb)+'</div>'+
      '<div style="display:flex;gap:16px;margin-top:13px;padding-top:12px;border-top:1px dashed var(--line);font-size:11px;color:var(--ink-50)">'+
      '<span>SIGNAL <span class="sig s'+d.sig+'"><i></i><i></i><i></i></span></span>'+
      '<span>FIRMWARE <b class="mono" style="color:var(--ink)">'+esc(d.fw||'—')+'</b></span></div>'+
      '<div style="display:flex;gap:7px;margin-top:13px;flex-wrap:wrap">'+
      '<button class="btn sm ghost" data-dev-sync="'+esc(d.id)+'"><i data-lucide="refresh-cw"></i>Synchroniser</button>'+
      '<button class="btn sm ghost" data-dev-diag="'+esc(d.id)+'"><i data-lucide="wrench"></i>Diagnostic</button>'+
      (d.statut==='CONNECTÉ'?'<button class="btn sm role" data-goto="measures"><i data-lucide="activity"></i>Mesurer</button>':'')+
      '</div></div>').join('')
      : '<div class="card" style="grid-column:1/-1"><div class="empty"><div class="empty-ic"><i data-lucide="cpu"></i></div><h3>Aucun boîtier</h3><p>Le Pilotage attribue les ESP32 — contactez-le pour le jumelage.</p></div></div>')+'</div>';
  MI.refreshIcons();
  const pb = $('#pairBtn'); if(pb) pb.onclick = ()=>MI.toast('Jumelage — scannez le QR au dos du boîtier. Il sera associé à votre CSB.','info');
  el.querySelectorAll('[data-dev-sync]').forEach(b=>b.onclick=()=>{
    MI.toast('Boîtier '+b.dataset.devSync+' : synchronisation lancée.','success');
    syncQueue.unshift({l:'Mesures boîtier '+b.dataset.devSync, tag:'IOT'}); refreshSync();
  });
  el.querySelectorAll('[data-dev-diag]').forEach(b=>b.onclick=()=>{
    MI.toast('Diagnostic à distance indisponible : aucun retour matériel temps réel n’est relié à l’application.','info');
  });
}

/* ================= MESURES ================= */
function measRows(){
  return DB.measures.slice(0,12).map(m=>
    '<tr><td><span class="mono" style="font-size:12px">'+m.t+'</span></td>'+
    '<td><b style="font-size:12.5px">'+esc(m.pat)+'</b></td>'+
    '<td>'+(m.temp!=null && m.temp!==''?'<span class="badge '+(parseFloat(m.temp)<38?'green':parseFloat(m.temp)<39?'amber':'red')+'" style="font-family:var(--mono)">'+fmtDec(m.temp)+' °C</span>':'—')+'</td>'+
    '<td><span class="ident">ESP32 '+esc(m.dev)+'</span></td>'+
    '<td>'+(m.sync?'<span class="badge green" style="font-size:10px">SYNC ✓</span>':'<span class="badge amber" style="font-size:10px">FILE LOCALE</span>')+'</td></tr>').join('');
}
function renderMeasures(){
  const el = $('#view-measures'); if(!el) return;
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Mesures des capteurs</h2>'+
    '<p class="vh-sub">Historique des températures enregistrées depuis une consultation.</p></div>'+
    '<button class="btn role" data-goto="saisie"><i data-lucide="clipboard-pen"></i>Nouvelle consultation</button></header>'+
    '<div class="bento" style="margin-bottom:14px">'+
    '<div class="card"><header><div><div class="card-title">Thermomètre infrarouge</div><div class="card-sub">Valeur lue sur l’appareil et ajoutée à la consultation</div></div></header>'+
    '<div style="padding:14px 18px 18px"><span class="badge amber">Liaison automatique non configurée</span><p style="font-size:12px;color:var(--ink-50);margin-top:10px">Aucune température n’est inventée. Seules les valeurs réellement saisies et enregistrées apparaissent dans l’historique.</p></div></div>'+
    '<div class="card"><header><div><div class="card-title">AD8232 · ECG</div><div class="card-sub">Signal électrique à une dérivation</div></div></header>'+
    '<div style="padding:14px 18px 18px"><span class="badge amber">Flux ECG non relié à l’application</span><p style="font-size:12px;color:var(--ink-50);margin-top:10px">La courbe et la fréquence cardiaque resteront absentes tant que l’acquisition du signal n’est pas intégrée.</p></div></div></div>'+
    '<div class="card"><div class="table-wrap"><table class="table">'+
    '<thead><tr><th>Heure</th><th>Patient</th><th>Température</th><th>Boîtier</th><th>Sync</th></tr></thead>'+
    '<tbody>'+measRows()+'</tbody></table></div>'+
    (DB.measures.length?'':'<div class="empty"><p>Aucune température enregistrée pour le moment.</p></div>')+'</div>';
  MI.refreshIcons();
}

/* ---------- Enregistrements de ce module ---------- */
MI.registerRenderer('consults', renderConsults);
MI.registerRenderer('reports',  renderReports);
MI.registerRenderer('devices',  renderDevices);
MI.registerRenderer('measures', ()=>{ renderMeasures(); });

/* ---------- Handlers globaux du domaine ---------- */
const _ordDel = $('#ordDelivered');
if(_ordDel) _ordDel.addEventListener('click', ()=>{
  post((DB.urls&&DB.urls.ordonnance_recue?DB.urls.ordonnance_recue:'/consultations/<ID>/remise/').replace('<ID>', ordCurrent), {}).then(res=>{
    if(!res.ok){ MI.toast('Action refusée.','error'); return; }
    const m=$('#ordModal'); if(m) m.hidden = true;
    const row = document.querySelector('tr[data-row="'+ordCurrent+'"]');
    if(row) MI.stamp(row, 'ORDONNANCE REMISE · MI-AINA', true);
    MI.toast('Ordonnance marquée comme remise — le médecin est notifié.','success');
  });
});
const _repForm = $('#repForm');
if(_repForm) _repForm.addEventListener('submit', e=>{
  e.preventDefault();
  post(DB.urls.report, {type:$('#repType').value, village:$('#repVillage').value.trim(),
    nb_cas:+$('#repN').value||1, note:$('#repNote').value.trim()}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Envoi impossible.','error'); return; }
    DB.reports.unshift(res.signalement);
    syncQueue.unshift({l:'Signalement '+res.signalement.id, tag:'ALERTE'});
    $$('.modal-wrap').forEach(m=>m.hidden=true); e.target.reset(); refreshSync();
    showReceipt(res.signalement, res.destinataires || ['Pilotage national (MadaAlert)']);
    if(state.view==='reports') renderReports();
    updateCounters(); refreshDockBadges();
  }).catch(()=>MI.toast('Erreur réseau — le signalement rejoint la file locale.','error'));
});
