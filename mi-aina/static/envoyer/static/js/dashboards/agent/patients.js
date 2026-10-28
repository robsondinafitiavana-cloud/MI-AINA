/* MI-AINA — Agent · patients : création (CSB auto), fiche, QR étiquette */

function showQrLabel(code, nom){
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-wrap" id="qrShow">'+
    '<div class="modal" style="text-align:center"><div class="modal-head"><b>Dossier QR · '+esc(nom)+'</b>'+
    '<button data-qr-close><i data-lucide="x"></i></button></div>'+
    '<div class="modal-body" style="display:grid;place-items:center">'+
    '<div id="qrBoxPrint" style="width:180px;height:180px;padding:12px;background:#fff;border:1px solid var(--line-strong);border-radius:12px"></div>'+
    '<p class="mono" style="margin-top:12px;font-size:13px;font-weight:600">'+esc(code)+'</p>'+
    '<p style="font-size:11px;color:var(--ink-50);margin-top:4px">Collez cette étiquette sur la carte papier du patient — le scan ouvre son dossier hors-ligne.</p>'+
    '</div><div class="modal-foot"><button class="btn ghost" data-qr-close>Fermer</button>'+
    '<button class="btn solid" id="qrPrint"><i data-lucide="printer"></i>Imprimer l\u2019étiquette</button></div></div></div>');
  MI.refreshIcons();
  if(window.QRCode) new QRCode(document.getElementById('qrBoxPrint'), { text: code, width:150, height:150,
    colorDark:'#1E2A22', colorLight:'#FFFFFF' });
  $('#qrShow').querySelectorAll('[data-qr-close]').forEach(b=>b.onclick=()=>$('#qrShow').remove());
  $('#qrShow').addEventListener('click', e=>{ if(e.target.id==='qrShow') $('#qrShow').remove(); });
  $('#qrPrint').onclick = ()=>{
    const w = window.open('','_blank','width=340,height=460');
    w.document.write('<html><head><title>Étiquette '+code+'</title><style>body{font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0}'+
      '.e{text-align:center;border:2px dashed #007E3A;padding:22px;border-radius:12px}'+
      'h3{margin:8px 0 2px}p{margin:0;color:#555;font-size:12px}</style></head><body>'+
      '<div class="e"><div style="color:#007E3A;font-weight:700">MI-AINA</div>'+
      '<h3>'+nom+'</h3><p>'+(ME.csb_nom||'')+' · '+(ME.district||'')+'</p>'+
      '<div id="q"></div></div>'+
      '<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>'+
      '<scr'+'ipt>new QRCode(document.getElementById("q"),{text:"'+code+'",width:120,height:120});setTimeout(function(){window.print()},400);<\/script></body></html>');
    w.document.close();
  };
}

function openNewPatient(){
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-wrap" id="npModal">'+
    '<div class="modal"><div class="modal-head"><b>Nouveau patient</b>'+
    '<button data-np-close><i data-lucide="x"></i></button></div>'+
    '<form class="modal-body" id="npForm">'+
    '<div style="display:flex;gap:10px;padding:11px 13px;border-radius:10px;background:rgba(0,126,58,.06);border:1px solid rgba(0,126,58,.25);margin-bottom:14px">'+
    '<i data-lucide="building-2" style="width:15px;height:15px;color:var(--mg-green);flex:none;margin-top:2px"></i>'+
    '<div style="font-size:11.5px;line-height:1.5;color:var(--ink-70)"><b style="color:var(--ink)">'+esc(ME.csb_nom||'Votre CSB')+'</b> · '+esc(ME.district)+' · '+esc(ME.region)+
    '<br>Le patient sera automatiquement rattaché à votre CSB — visible par le médecin traitant.</div></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
    '<div class="f-group"><label>Nom *</label><input id="npNom" required></div>'+
    '<div class="f-group"><label>Prénom</label><input id="npPrenom"></div>'+
    '<div class="f-group"><label>Âge *</label><input id="npAge" type="number" min="0" max="120" required></div>'+
    '<div class="f-group"><label>Sexe</label><select id="npSexe"><option value="M">Masculin</option><option value="F">Féminin</option></select></div>'+
    '<div class="f-group"><label>Village / Fokontany</label><input id="npVillage"></div>'+
    '<div class="f-group"><label>Téléphone</label><input id="npTel" placeholder="03X XX XXX XX"></div></div>'+
    '<div class="modal-foot" style="margin:18px -20px -20px">'+
    '<button type="button" class="btn ghost" data-np-close>Annuler</button>'+
    '<button type="submit" class="btn solid"><i data-lucide="user-plus"></i>Créer le dossier</button></div>'+
    '</form></div></div>');
  MI.refreshIcons();
  $('#npModal').querySelectorAll('[data-np-close]').forEach(b=>b.onclick=()=>$('#npModal').remove());
  $('#npModal').addEventListener('click', e=>{ if(e.target.id==='npModal') $('#npModal').remove(); });
  setTimeout(()=>$('#npNom').focus(), 80);
  $('#npForm').addEventListener('submit', e=>{
    e.preventDefault();
    post(DB.urls.patient_create, {
      nom:$('#npNom').value.trim(), prenom:$('#npPrenom').value.trim(),
      age:+$('#npAge').value||0, sexe:$('#npSexe').value,
      village:$('#npVillage').value.trim(), telephone:$('#npTel').value.trim(),
    }).then(res=>{
      if(!res.ok){ MI.toast(res.erreur||'Création impossible.','error'); return; }
      DB.patients.unshift(res.patient);
      $('#npModal').remove();
      MI.toast('Patient créé — '+res.patient.nom+' · code '+res.patient.code+' attribué.','success');
      if(state.view==='patients') renderPatients();
      updateCounters(); refreshDockBadges();
    });
  });
}

function openDetail(code){
  const p = DB.patients.find(x=>x.code===code); if(!p) return;
  const consults = DB.consults.filter(c=>c.patient===p.nom);
  const measures = DB.measures.filter(m=>m.pat===p.nom).slice(0,4);
  document.body.insertAdjacentHTML('beforeend',
    '<div class="modal-wrap" id="pDetail">'+
    '<div class="modal" style="width:min(560px,100%)"><div class="modal-head"><b>'+esc(p.nom)+'</b>'+
    '<button data-pd-close><i data-lucide="x"></i></button></div>'+
    '<div class="modal-body">'+
    '<button type="button" class="btn sm ghost" style="margin-bottom:12px" data-open-dossier="'+esc(p.code)+'"><i data-lucide="folder-open"></i>Ouvrir le dossier médical</button>'+
    '<div class="person" style="margin-bottom:14px">'+
    '<span class="p-av '+(p.sexe==='F'?'r':'g')+'" style="width:46px;height:46px;font-size:14px">'+p.nom[0]+'</span>'+
    '<div><b style="font-size:15px">'+esc(p.nom)+'</b>'+
    '<span class="cell-sub">'+p.age+' ans · '+p.sexe+' · '+esc(p.village)+' · '+esc(p.code)+'</span>'+
    '<span class="cell-sub" style="display:flex;align-items:center;gap:4px"><i data-lucide="map-pin" style="width:11px;height:11px"></i>'+esc(ME.csb_nom)+' · '+esc(ME.district)+' · '+esc(ME.region)+'</span></div></div>'+
    '<p class="mono" style="font-size:9px;letter-spacing:1.4px;color:var(--ink-35);margin-bottom:6px">DERNIÈRES CONSTANTES</p>'+
    (measures.some(m=>m.temp!=null && m.temp!=='') ? '<div class="vitals" style="margin:6px 0 14px">'+
      measures.filter(m=>m.temp!=null && m.temp!=='').map(m=>'<span class="vital"><i></i>Température '+fmtDec(m.temp)+' °C</span>').join('')+
      '</div>' : '<p style="font-size:11.5px;color:var(--ink-50);margin:4px 0 14px">Aucune température enregistrée pour ce patient.</p>')+
    '<p class="mono" style="font-size:9px;letter-spacing:1.4px;color:var(--ink-35);margin-bottom:6px">HISTORIQUE ('+consults.length+')</p>'+
    (consults.length ? consults.map(c=>{
      const m2 = STATUT_META[c.statut]||STATUT_META.TERMINEE;
      return '<div style="display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-top:1px solid var(--line)">'+
        '<span style="width:2px;min-height:26px;background:var(--line-strong);border-radius:2px;flex:none;margin-top:3px"></span>'+
        '<div style="flex:1"><b style="font-size:12.5px">'+esc(c.motif)+'</b>'+
        '<span class="cell-sub">'+esc(c.date)+' · <span class="badge '+m2.b+'" style="font-size:9px;padding:1px 7px">'+m2.l+'</span></span></div></div>';
    }).join('') : '<p style="font-size:11.5px;color:var(--ink-50);margin:4px 0">Aucune consultation — première visite à programmer.</p>')+
    '</div><div class="modal-foot">'+
    '<button class="btn ghost" data-pd-qr><i data-lucide="scan-line"></i>QR</button>'+
    '<button class="btn solid" data-pd-cons><i data-lucide="clipboard-pen"></i>Consultation pour ce patient</button></div>'+
    '</div></div>');
  MI.refreshIcons();
  $('#pDetail').querySelectorAll('[data-pd-close]').forEach(b=>b.onclick=()=>$('#pDetail').remove());
  $('#pDetail').addEventListener('click', e=>{ if(e.target.id==='pDetail') $('#pDetail').remove(); });
  $('#pDetail').querySelector('[data-pd-qr]').onclick = ()=>{ $('#pDetail').remove(); showQrLabel(p.code, p.nom); };
  $('#pDetail').querySelector('[data-pd-cons]').onclick = ()=>{
    $('#pDetail').remove();
    window.__pendingPatient = p.code;   /* saisie.js le récupère à son chargement */
    MI.setView('saisie');
  };
}

function renderPatients(){
  const el = $('#view-patients'); if(!el) return;
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Mes patients</h2>'+
    '<p class="vh-sub">'+DB.patients.length+' dossiers · <b>'+esc(ME.csb_nom||'')+'</b> · '+esc(ME.district||'')+' · '+esc(ME.region||'')+' — vous êtes l\u2019agent référent.</p></div>'+
    '<button class="btn solid" id="patNewTop"><i data-lucide="user-plus"></i>Nouveau patient</button></header>'+
    '<div class="card"><div class="table-wrap"><table class="table">'+
    '<thead><tr><th>Patient</th><th>Code</th><th>Village</th><th></th></tr></thead><tbody>'+
    (DB.patients.length ? DB.patients.map(p=>
      '<tr><td><div class="person"><span class="p-av '+(p.sexe==='F'?'r':'g')+'">'+p.nom[0]+'</span>'+
      '<div><b>'+esc(p.nom)+'</b><span class="cell-sub">'+p.age+' ans · '+p.sexe+'</span></div></div></td>'+
      '<td><span class="ident">'+esc(p.code)+'</span></td><td>'+esc(p.village)+'</td>'+
      '<td style="white-space:nowrap"><button class="btn sm ghost" data-qr="'+p.code+'" data-nom="'+esc(p.nom)+'"><i data-lucide="scan-line"></i>QR</button>'+
      '<button class="btn sm ghost" data-detail="'+esc(p.code)+'"><i data-lucide="user-round"></i>Aperçu</button>'+
      '<button type="button" class="btn sm role" data-open-dossier="'+esc(p.code)+'"><i data-lucide="folder-open"></i>Dossier</button></td></tr>').join('')
      : '<tr><td colspan="4"><div class="empty" style="padding:34px"><div class="empty-ic"><i data-lucide="users"></i></div>'+
        '<h3 style="font-size:18px">Aucun patient</h3><p>Créez le premier dossier — il sera rattaché à votre CSB.</p></div></td></tr>')+
    '</tbody></table></div></div>';
  MI.refreshIcons();
  $('#patNewTop').onclick = openNewPatient;
  el.querySelectorAll('[data-qr]').forEach(b=>b.onclick=()=>showQrLabel(b.dataset.qr, b.dataset.nom));
  el.querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>openDetail(b.dataset.detail));
}
MI.registerRenderer('patients', renderPatients);
