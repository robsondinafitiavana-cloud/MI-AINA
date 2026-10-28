/* MI-AINA — Médecin · vues patients & consultations */
function renderPatients(){
  const el = $('#view-patients');
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Mes patients</h2>'+
    '<p class="vh-sub">'+DB.patients.length+' dossiers suivis — agent référent de première ligne pour chacun.</p></div></header>'+
    '<div class="card"><div class="table-wrap"><table class="table">'+
    '<thead><tr><th>Patient</th><th>Code</th><th>Agent référent</th><th>Dernières constantes</th><th>État</th><th></th></tr></thead><tbody>'+
    (DB.patients.length ? DB.patients.map(p=>
      '<tr><td><div class="person"><span class="p-av '+(p.sexe==='F'?'r':'g')+'">'+esc(p.nom[0])+'</span>'+
      '<div><b>'+esc(p.nom)+'</b><span class="cell-sub">'+p.age+' ans · '+p.sexe+' · '+esc(p.csb)+'</span></div></div></td>'+
      '<td><span class="ident">'+esc(p.code)+'</span></td>'+
      '<td>'+esc(p.agent||'—')+'</td>'+
      '<td>'+(Object.keys(p.v||{}).length
        ? '<div class="vitals" style="margin-top:0">'+vitalChips(p.v)+'</div>'
        : '<span class="cell-sub">Aucune mesure enregistrée</span>')+'</td>'+
      '<td><span class="badge '+(p.statut==='CRITIQUE'?'red':p.statut==='SURVEILLANCE'?'amber':'green')+'">'+esc(p.statut)+'</span></td>'+
      '<td><button type="button" class="btn sm ghost" data-open-dossier="'+esc(p.code)+'"><i data-lucide="folder-open"></i>Dossier</button></td></tr>').join('')
      : '<tr><td colspan="6"><div class="empty" style="padding:34px"><div class="empty-ic"><i data-lucide="users"></i></div><h3 style="font-size:18px">Aucun patient suivi</h3><p>Les patients apparaissent dès votre première prise en charge.</p></div></td></tr>')+
    '</tbody></table></div></div>';
  MI.refreshIcons();
}

const CONS_META = {
  EN_COURS:  {b:'red',   l:'EN COURS'},
  VALIDEE:   {b:'green', l:'VALIDÉE'},
  ORIENTEE:  {b:'navy',  l:'ORIENTÉE'},
  TERMINEE:  {b:'gray',  l:'TERMINÉE'},
  EN_ATTENTE:{b:'amber', l:'EN ATTENTE'},
};
function renderConsults(){
  const el = $('#view-consults');
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Consultations</h2>'+
    '<p class="vh-sub">'+DB.consults.length+' dossiers — statuts gérés conformément au modèle Mi-AINA.</p></div></header>'+
    '<div class="card"><div class="table-wrap"><table class="table">'+
    '<thead><tr><th>Patient</th><th>Motif / Diagnostic</th><th>Agent · CSB</th><th>Statut</th><th>Date</th><th></th></tr></thead><tbody>'+
    (DB.consults.length ? DB.consults.map(c=>{
      const m = CONS_META[c.statut]||CONS_META.TERMINEE;
      return '<tr data-cons="'+c.id+'">'+
        '<td><div class="person"><span class="p-av '+(c.sexe==='F'?'r':'g')+'">'+esc((c.patient||'?')[0])+'</span>'+
        '<div><b>'+esc(c.patient)+'</b><span class="cell-sub">'+(c.age||'?')+' ans · '+(c.sexe||'')+'</span></div></div></td>'+
        '<td style="max-width:230px"><b style="font-size:12.5px">'+esc(c.motif)+'</b>'+
        (c.dest?'<span class="cell-sub">→ '+esc(c.dest)+'</span>':'')+'</td>'+
        '<td>'+esc(c.agent||'—')+'<span class="cell-sub">'+esc(c.csb||'—')+'</span></td>'+
        '<td><span class="badge '+m.b+'">'+m.l+'</span></td>'+
        '<td><span class="mono" style="font-size:11px;color:var(--ink-50)">'+esc(c.date)+'</span></td>'+
        '<td style="white-space:nowrap">'+
        (c.code?'<button type="button" class="btn sm ghost" data-open-dossier="'+esc(c.code)+'"><i data-lucide="folder-open"></i>Dossier</button>':'')+
        (c.statut==='EN_COURS'
          ?'<button class="btn sm ghost" data-ord="'+c.id+'"><i data-lucide="file-signature"></i>Ordonnance</button>'+
           '<button class="btn sm role" data-ori="'+c.id+'"><i data-lucide="send"></i>Orienter</button>'
          :c.statut==='VALIDEE'
          ?'<button class="btn sm ghost" data-retour="'+c.id+'"><i data-lucide="undo-2"></i>Renvoyer au terrain</button>'
          :'<button class="btn sm ghost" data-retour="'+c.id+'"><i data-lucide="undo-2"></i>Renvoyer au terrain</button>')+
        '</td></tr>';
    }).join('')
      : '<tr><td colspan="6"><div class="empty" style="padding:34px"><div class="empty-ic"><i data-lucide="stethoscope"></i></div><h3 style="font-size:18px">Aucune consultation</h3><p>Prenez un cas dans la file d\u2019expertise pour commencer.</p></div></td></tr>')+
    '</tbody></table></div></div>';
  MI.refreshIcons();
  el.querySelectorAll('[data-ord]').forEach(b=>b.addEventListener('click',()=>openOrd(b.dataset.ord)));
  el.querySelectorAll('[data-ori]').forEach(b=>b.addEventListener('click',()=>openOri(b.dataset.ori)));
  el.querySelectorAll('[data-retour]').forEach(b=>b.addEventListener('click',()=>retourTerrain(b.dataset.retour)));
}
MI.registerRenderer('patients', renderPatients);
MI.registerRenderer('consults', renderConsults);
