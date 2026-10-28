/* ================================================================
   MI-AINA — Agent · Saisie éclair : dropdown symptômes,
   repère clinique simple, routage d'avis et vigilance épidémique,
   mesures IoT, décision. Aucun NLP — déterministe et hors ligne.
   ================================================================ */

/* ---------- Catalogue clinique ---------- */
const SYMPTOMES = [
  'Fièvre','Frissons','Courbatures','Toux','Difficulté respiratoire',
  'Vomissements','Diarrhée','Douleurs abdominales','Maux de tête',
  'Éruption cutanée','Refus de s\u2019alimenter','Abattement',
  'Convulsions','Saignement','Blessure',
];
const DUREES = ['< 24 h','1-3 jours','4-7 jours','> 1 semaine'];
const EPIDEMICS = ['Paludisme','Dengue','Rougeole','Diarrhée aqueuse','Grippe','Peste','Autre'];

/* Maladies à déclaration épidémique automatique */
const EPIDEMIC_DISEASES = ['Paludisme','Dengue','Rougeole','Diarrhée aqueuse','Grippe','Peste'];

const RULES = [
  { need:['Fièvre','Frissons'],                      maladie:'Paludisme probable',        urgence:'PRÉOCCUPANT', examens:'TDR paludisme · goutte épaisse' },
  { need:['Fièvre','Saignement'],                    maladie:'Dengue hémorragique',       urgence:'CRITIQUE',    examens:'NFS plaquettes · test tourniquet' },
  { need:['Fièvre','Éruption cutanée'],              maladie:'Rougeole / Dengue (à départager)', urgence:'URGENT', examens:'Sérologie · TDR rougeole' },
  { need:['Fièvre','Diarrhée'],                      maladie:'Gastro-entérite infectieuse', urgence:'PRÉOCCUPANT', examens:'Coproculture · SRO' },
  { need:['Toux','Difficulté respiratoire'],         maladie:'Infection respiratoire aiguë (IRA)', urgence:'PRÉOCCUPANT', examens:'Comptage FR · évaluer la saturation si oxymètre disponible' },
  { need:['Convulsions'],                            maladie:'Urgence neurologique',      urgence:'CRITIQUE',    examens:'Glycémie capillaire · évacuation' },
  { need:['Vomissements','Diarrhée'],                maladie:'Déshydratation aiguë',      urgence:'PRÉOCCUPANT', examens:'Réhydratation · poids' },
  { need:['Fièvre','Maux de tête'],                  maladie:'Syndrome fébrile',          urgence:'PRÉOCCUPANT', examens:'TDR paludisme · TA' },
  { need:['Blessure'],                               maladie:'Traumatisme',               urgence:'MODÉRÉ',      examens:'Examen des lésions' },
  { need:['Douleurs abdominales'],                   maladie:'Douleur abdominale à explorer', urgence:'MODÉRÉ',  examens:'Palpation · échographie si dispo' },
];

/* ---------- État de la saisie ---------- */
const S = {
  patient:null, symptomes:[], duree:'', contextes:[], notes:'',
  iot:'idle', iotVals:null,
  escal:false, sev:'PRÉOCCUPANT', preferredDoctor:'',
  epidemic:false, epidemicTypes:[],
  prediction:null, aiSuggested:false, aiEpidemic:false, agentOverrode:false,
};
/* ---------- Moteur de prédiction (déterministe, instantané) ---------- */
function computePrediction(){
  let best = null, bestScore = 0;
  for(const r of RULES){
    const score = r.need.filter(s=>S.symptomes.includes(s)).length;
    if(score === r.need.length && score > bestScore){
      best = {...r}; bestScore = score;
    }
  }
  if(!best){
    best = S.symptomes.length
      ? {maladie:'Syndrome non spécifié', urgence:'MODÉRÉ', examens:'Examen clinique complet', need:[]}
      : null;
  }
  if(best){
    /* Seule la température saisie depuis le capteur infrarouge est disponible ici. */
    const temp = S.iotVals?.temp;
    if(temp && temp >= 39.5 && best.urgence === 'MODÉRÉ') best.urgence = 'PRÉOCCUPANT';
    best.triggers = best.need.filter(s=>S.symptomes.includes(s));
  }
  return best;
}

/* ---------- CASCADE AUTOMATIQUE après prédiction ---------- */
function applyCascade(auto){
  const p = S.prediction;
  if(!p){ if(!S.epidemic) S.aiEpidemic = false; return; }

  /* 1) Urgence -> toggle avis automatique */
  if(p.urgence === 'URGENT' || p.urgence === 'CRITIQUE'){
    if(!S.escal){
      S.escal = true;
      S.sev = p.urgence;
      if(auto){
        MI.toast('Repère clinique '+p.urgence+' — avis médical proposé automatiquement. Vérifiez la situation avant de l’envoyer.','info');
      }
    } else if(p.urgence === 'CRITIQUE' && S.sev !== 'CRITIQUE'){
      S.sev = 'CRITIQUE';   /* synchronise vers le haut, jamais vers le bas */
    } else if(p.urgence === 'URGENT' && S.sev === 'MODÉRÉ'){
      S.sev = 'URGENT';
    }
  }

  /* 2) Une règle peut suggérer une vigilance ; le signalement reste une décision humaine. */
  const epi = EPIDEMIC_DISEASES.find(d => p.maladie.toLowerCase().includes(d.toLowerCase()));
  if(epi && !S.epidemic){
    if(!S.aiEpidemic && auto) MI.toast('Le repère évoque « '+epi+' » : vérifiez le cas et activez le signalement épidémique si nécessaire.','info');
    S.aiEpidemic = true;
  } else if(!epi && !S.epidemic){
    S.aiEpidemic = false;
  } else if(epi && S.epidemic && !S.epidemicTypes.includes(epi)){
    S.epidemicTypes.push(epi);
  }

  /* Le repère basé sur les règles a suggéré : badge tant que l'agent n'a pas modifié. */
  if(auto) S.aiSuggested = true;
}

/* ---------- Rendu ---------- */
function renderSaisie(){
  const el = $('#view-saisie'); if(!el) return;
  const patOptions = DB.patients.map(p=>'<option value="'+p.code+'"'+(S.patient===p.code?' selected':'')+'>'+esc(p.nom)+' · '+p.age+' ans · '+esc(p.village)+'</option>').join('');
  const pat = DB.patients.find(p=>p.code===S.patient);

  /* --- Dropdown multi-choix des symptômes --- */
  const symDropdown =
    '<div id="symDrop" style="position:relative">'+
    '<button type="button" id="symDropBtn" style="width:100%;height:46px;background:var(--field);'+
    'border:1px solid var(--line-strong);border-radius:9px;padding:0 12px;font-family:var(--sans);'+
    'font-size:13.5px;color:var(--ink);outline:none;display:flex;align-items:center;justify-content:space-between;gap:8px">'+
    '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+
    (S.symptomes.length ? S.symptomes.map(esc).join(', ') : '— Cocher les symptômes observés —')+
    '</span><i data-lucide="chevron-down" style="width:15px;height:15px;color:var(--ink-35);flex:none"></i></button>'+
    '<div id="symDropList" hidden style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:20;'+
    'background:var(--sheet);border:1px solid var(--line-strong);border-radius:11px;'+
    'box-shadow:0 14px 34px rgba(30,42,34,.18);max-height:290px;overflow-y:auto;padding:6px">'+
    SYMPTOMES.map(s=>
      '<label style="display:flex;align-items:center;gap:10px;padding:9px 11px;border-radius:8px;'+
      'cursor:pointer;font-size:13px;font-weight:500;color:var(--ink);'+
      (S.symptomes.includes(s)?'background:rgba(0,126,58,.08)':'')+'" data-sym-row="'+s+'">'+
      '<input type="checkbox" data-sym="'+s+'"'+(S.symptomes.includes(s)?' checked':'')+
      ' style="accent-color:var(--mg-green);width:15px;height:15px">'+s+'</label>').join('')+
    '</div></div>';

  /* --- Durée en pills radio --- */
  const dureePills = '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
    DUREES.map(d=>'<button type="button" class="pill '+(S.duree===d?'on':'')+'" data-duree="'+d+'">'+d+'</button>').join('')+'</div>';

  /* --- Repère clinique indicatif --- */
  const pred = S.prediction;
  const predBlock = pred ?
    '<div class="ia-box" id="predBox" style="margin-top:14px;width:100%;flex-direction:column;align-items:stretch">'+
    '<div style="display:flex;align-items:center;gap:10px;width:100%">'+
    '<span style="width:10px;height:10px;border-radius:50%;background:'+(pred.urgence==='CRITIQUE'?'var(--mg-red)':pred.urgence==='URGENT'?'#C98A1F':'var(--mg-green)')+
    ';flex:none;animation:pulseDot 2s infinite"></span>'+
    '<div style="flex:1"><b style="font-size:13px">'+esc(pred.maladie)+'</b>'+
    '<div style="font-size:11px;color:var(--ink-50);margin-top:2px">Urgence <b>'+pred.urgence+
    '</b> · estimation indicative par règles'+(S.agentOverrode?' · <b style="color:var(--mg-green)">ajusté par vous</b>':'')+'</div></div></div>'+
    (pred.triggers && pred.triggers.length ?
      '<div style="margin-top:8px;font-size:11px;color:var(--ink-50)">Basé sur : '+pred.triggers.map(t=>'<b style="color:var(--ink)">'+esc(t)+'</b>').join(' + ')+'</div>' : '')+
    '</div>' : '';

  /* --- Épidémie (activée par cascade ou manuellement) --- */
  const epiBlock =
    '<div class="card" style="margin-top:14px"><div style="padding:16px 18px 18px">'+
    '<p class="mono" style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--mg-red);display:flex;align-items:center;gap:8px;margin-bottom:12px"><i data-lucide="siren" style="width:13px;height:13px"></i>Vigilance épidémique <span class="mono" style="font-size:8.5px;padding:2px 7px;border-radius:999px;background:rgba(193,39,45,.1);color:var(--mg-red)">SIGNALEMENT MANUEL</span></p>'+
    '<div class="escal-toggle '+(S.epidemic?'on':'')+'" id="epiT"><span class="toggle-pill"></span>'+
    '<span class="tt"><b>Suspicion épidémique'+(S.aiEpidemic?' <span class="mono" style="font-size:9px;color:#026630">· repère à vérifier</span>':'')+'</b>'+
    '<span>Si activé, Pilotage est alerté en direct à l\u2019envoi</span></span></div>'+
    (S.epidemic?'<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px">'+
      EPIDEMICS.map(e=>'<button type="button" class="pill '+(S.epidemicTypes.includes(e)?'on':'')+'" data-epi="'+e+'" style="font-size:10.5px;padding:5px 12px;'+
      (S.epidemicTypes.includes(e)?'border-color:var(--mg-red);background:rgba(193,39,45,.07);color:var(--mg-red)':'')+'">'+e+'</button>').join('')+
      '</div><p style="font-size:10.5px;color:var(--mg-red);margin-top:10px">L\u2019alerte remontera en direct au Pilotage et au médecin traitant.</p>':'')+
    '</div></div>';

  /* --- Routage --- */
  const routBlock = S.escal ?
    '<div style="margin-top:12px"><label for="preferredDoctor" style="display:block;font-size:11px;color:var(--ink-50);margin-bottom:6px">Médecin préféré (facultatif)</label>'+
    '<select id="preferredDoctor" style="width:100%;height:40px;border:1px solid var(--line-strong);border-radius:8px;background:var(--field);padding:0 10px;color:var(--ink)">'+
    '<option value="">'+((DB.doctors||[]).length?'File partagée du centre — premier médecin disponible':'Aucun médecin actif rattaché à cette structure')+'</option>'+
    (DB.doctors||[]).map(d=>'<option value="'+esc(d.id)+'"'+(S.preferredDoctor===d.id?' selected':'')+'>'+esc(d.nom)+' · '+esc(d.structure)+'</option>').join('')+
    '</select><p style="font-size:10.5px;color:var(--ink-50);margin-top:5px">'+((DB.doctors||[]).length?'Les médecins de la structure voient le cas ; la préférence ne bloque pas la relève.':'Utilisez la recherche de médecin en visioconsultation si aucun médecin local n’est disponible.')+'</p></div>' : '';

  const iotState = S.iot==='done'?'TEMPÉRATURE NOTÉE':'MESURE À SAISIR';
  const assignedDevice = DB.devices?.[0];

  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Nouvelle consultation</h2>'+
    '<p class="vh-sub">Saisissez les signes observés. L’estimation affichée est indicative et fondée sur des règles simples.</p></div></header>'+
    '<div style="display:grid;grid-template-columns:1.15fr 1fr;gap:14px;align-items:start">'+
    '<div style="display:flex;flex-direction:column;gap:14px">'+
      '<div class="card"><div style="padding:16px 18px 18px">'+
        '<p class="mono" style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-70);margin-bottom:12px">Patient</p>'+
        '<select id="szPatient" style="width:100%;height:46px;background:var(--field);border:1px solid var(--line-strong);border-radius:9px;padding:0 12px;font-family:var(--sans);font-size:13.5px;color:var(--ink);outline:none">'+
        '<option value="">— Choisir un patient —</option>'+patOptions+'</select>'+
        '<div style="display:flex;gap:8px;margin-top:10px">'+
          '<button class="btn sm ghost" id="qrOpen"><i data-lucide="scan-line"></i>Scanner le QR</button>'+
          '<button class="btn sm ghost" id="patNew"><i data-lucide="user-plus"></i>Nouveau patient</button></div>'+
        (pat?'<div style="margin-top:10px;display:flex;align-items:center;gap:11px;border:1px solid var(--line);border-radius:10px;background:var(--field);padding:11px 13px">'+
          '<span class="p-av '+(pat.sexe==='F'?'r':'g')+'">'+pat.nom[0]+'</span>'+
          '<div style="flex:1"><b style="font-size:13.5px">'+esc(pat.nom)+'</b><div style="font-size:11px;color:var(--ink-50)">'+pat.age+' ans · '+pat.sexe+' · '+esc(pat.code)+' · '+esc(pat.village)+'</div></div></div>':'')+
      '</div></div>'+
      '<div class="card"><div style="padding:16px 18px 18px">'+
    '<p class="mono" style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-70);margin-bottom:12px">Symptômes <span class="mono" style="font-size:8.5px;padding:2px 7px;border-radius:999px;background:rgba(0,126,58,.1);color:#026630">REPÈRE INDICATIF</span></p>'+
        symDropdown+
        '<p class="mono" style="font-size:9px;letter-spacing:1.4px;color:var(--ink-35);margin:16px 0 8px">DURÉE DES SYMPTÔMES</p>'+
        dureePills+
        '<p class="mono" style="font-size:9px;letter-spacing:1.4px;color:var(--ink-35);margin:16px 0 8px">CONTEXTE (OPTIONNEL)</p>'+
        '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
        ['Contact avec un cas similaire','Eau non potable','Voyage en zone forestière'].map(c=>
          '<button type="button" class="pill '+(S.contextes.includes(c)?'on':'')+'" data-ctx="'+c+'" style="font-size:10.5px;padding:5px 12px">'+c+'</button>').join('')+
        '</div>'+
        '<div class="f-group" style="margin-top:16px;margin-bottom:0"><label>Notes complémentaires (optionnel)</label>'+
        '<textarea id="notesTxt" style="width:100%;min-height:60px;background:var(--field);border:1px solid var(--line-strong);border-radius:9px;padding:11px 13px;font-family:var(--sans);font-size:13px;color:var(--ink);resize:vertical;outline:none;box-sizing:border-box" placeholder="Précisions libres si nécessaire…">'+esc(S.notes||'')+'</textarea></div>'+
        predBlock+
      '</div></div>'+
    '</div>'+
    '<div style="display:flex;flex-direction:column;gap:14px">'+
      '<div class="card"><div style="padding:16px 18px 18px">'+
        '<p class="mono" style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-70);margin-bottom:12px">Mesures des capteurs</p>'+
        '<div class="iot-box">'+
          '<div class="iot-head"><span class="dev-ic" style="width:36px;height:36px"><i data-lucide="cpu" style="width:17px;height:17px"></i></span>'+
          '<div><b>'+esc(assignedDevice?.nom||'Boîtier non renseigné')+'</b><span>Température infrarouge · '+iotState+'</span></div>'+
          '<span class="iot-state '+(S.iot==='done'?'ok':'')+'"><span class="dot"></span>'+(assignedDevice?esc(assignedDevice.id):'—')+'</span></div>'+
          '<label for="infraredTemp" style="display:block;margin-top:14px;font-size:12px;font-weight:600">Température affichée par le capteur infrarouge</label>'+
          '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">'+
          '<input id="infraredTemp" type="number" inputmode="decimal" step="0.1" min="25" max="45" value="'+(S.iotVals?.temp??'')+'" placeholder="Ex. 37.2" style="width:150px;height:40px;padding:0 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--field);color:var(--ink)">'+
          '<span class="mono" style="font-size:11px;color:var(--ink-50)">°C</span>'+
          '<button type="button" class="btn sm role" id="tempSave"><i data-lucide="thermometer"></i>Ajouter la mesure</button></div>'+
          '<p style="font-size:10.5px;color:var(--ink-50);margin-top:7px">La liaison automatique au capteur n’est pas encore configurée : saisissez la valeur lue sur l’appareil.</p>'+
          (S.iotVals?.temp!=null?'<div class="cap-val" style="grid-template-columns:1fr;margin-top:10px"><div class="cap-cell done"><div class="n">'+fmtDec(S.iotVals.temp)+'<small> °C</small></div><div class="l">TEMPÉRATURE AJOUTÉE À LA SAISIE</div></div></div>':'')+
          '<div style="margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--field)">'+
          '<b style="font-size:12px">AD8232 · ECG une dérivation</b>'+
          '<p style="font-size:11px;color:var(--ink-50);margin:5px 0 0;line-height:1.5">L’AD8232 fournit un signal électrique ECG. Aucun flux ECG ni calcul de fréquence cardiaque n’est connecté à cette page ; aucune valeur de pouls n’est simulée ou enregistrée.</p></div>'+
        '</div></div></div>'+
      '<div class="card"><div style="padding:16px 18px 18px">'+
        '<p class="mono" style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-70);margin-bottom:12px">Décision</p>'+
        '<div class="escal-toggle '+(S.escal?'on':'')+'" id="escalT"><span class="toggle-pill"></span>'+
        '<span class="tt"><b>Demander un avis médical'+
        (S.aiSuggested?' <span class="mono" style="font-size:9px;color:#026630">· repère automatique</span>':'')+
        '</b><span>Le cas rejoint la file de votre structure et peut être pris par un médecin autorisé.</span></span></div>'+
        (S.escal?'<div style="display:flex;gap:8px;margin-top:10px" id="sevRow">'+
          ['PRÉOCCUPANT','URGENT','CRITIQUE'].map(sv=>
          '<button class="sev-opt '+(S.sev===sv?'on':'')+(sv==='CRITIQUE'?' crit':'')+'" data-sev="'+sv+'" style="flex:1;border:1px solid var(--line-strong);border-radius:9px;padding:9px;font-size:11.5px;font-weight:600;background:var(--field);color:var(--ink-70)">'+sv+'</button>').join('')+
          '</div>'+routBlock:'')+
        '<div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap">'+
          '<button class="btn ghost" id="saveDraft" style="flex:1;justify-content:center"><i data-lucide="save"></i>Enregistrer seul</button>'+
          '<button class="btn solid" id="saveConsult" style="flex:1;justify-content:center"><i data-lucide="send"></i>'+(S.escal?'Envoyer + avis':'Valider')+'</button></div>'+
      '</div></div>'+
      epiBlock+
    '</div></div>';
  MI.refreshIcons();
  ensureSaisieBound();
}

/* ---------- Bindings délégués (une fois, survivent aux re-rendus) ---------- */
let _saisieBound = false;
function ensureSaisieBound(){
  if(_saisieBound) return; _saisieBound = true;
  const el = $('#view-saisie'); if(!el) return;

  el.addEventListener('click', e=>{
    /* Dropdown symptômes : ouvrir/fermer + cochage */
    if(e.target.closest('#symDropBtn')){
      const l = $('#symDropList'); if(l) l.hidden = !l.hidden; return;
    }
    const chk = e.target.closest('input[data-sym]');
    if(chk){
      const s = chk.dataset.sym;
      S.symptomes = chk.checked ? [...S.symptomes, s] : S.symptomes.filter(x=>x!==s);
      S.prediction = computePrediction();
      applyCascade(true);                       /* ← cascade automatique */
      renderSaisie();                           /* re-rend + refreshPrediction */
      return;
    }
    const dur = e.target.closest('[data-duree]');
    if(dur){ S.duree = dur.dataset.duree; renderSaisie(); return; }
    const ctx2 = e.target.closest('[data-ctx]');
    if(ctx2){
      const c = ctx2.dataset.ctx;
      S.contextes = S.contextes.includes(c) ? S.contextes.filter(x=>x!==c) : [...S.contextes, c];
      renderSaisie(); return;
    }
    if(e.target.closest('#qrOpen')){ openQr(); return; }
    if(e.target.closest('#patNew')){ openNewPatient(); return; }
    if(e.target.closest('#tempSave')){ saveInfraredTemperature(); return; }
    if(e.target.closest('#escalT')){
      S.escal = !S.escal;
      if(!S.escal) S.aiSuggested = false;
      renderSaisie(); return;
    }
    const sev = e.target.closest('[data-sev]');
    if(sev){ S.sev = sev.dataset.sev; S.agentOverrode = true; renderSaisie(); return; }
    if(e.target.closest('#epiT')){
      S.epidemic = !S.epidemic;
      if(!S.epidemic){ S.epidemicTypes = []; S.aiEpidemic = false; }
      renderSaisie(); return;
    }
    const epi = e.target.closest('[data-epi]');
    if(epi){
      const t = epi.dataset.epi;
      S.epidemicTypes = S.epidemicTypes.includes(t) ? S.epidemicTypes.filter(x=>x!==t) : [...S.epidemicTypes, t];
      renderSaisie(); return;
    }
    if(e.target.closest('#saveDraft')){ submitConsult(false); return; }
    if(e.target.closest('#saveConsult')){ submitConsult(true); return; }
  });

  /* Ferme le dropdown si clic ailleurs */
  document.addEventListener('click', e=>{
    if(!e.target.closest('#symDrop')){
      const l = $('#symDropList'); if(l) l.hidden = true;
    }
  });

  el.addEventListener('input', e=>{
    if(e.target.id === 'notesTxt'){ S.notes = e.target.value; }
  });

  el.addEventListener('change', e=>{
    if(e.target.id === 'szPatient'){ S.patient = e.target.value || null; renderSaisie(); }
    if(e.target.id === 'preferredDoctor') S.preferredDoctor = e.target.value || '';
  });
}

/* ---------- Saisie explicite d'une lecture du thermomètre infrarouge ---------- */
function saveInfraredTemperature(){
  const input = $('#infraredTemp');
  const value = Number(String(input?.value||'').replace(',','.'));
  if(!Number.isFinite(value) || value < 25 || value > 45){
    MI.toast('Saisissez une température valide entre 25 et 45 °C.','error'); return;
  }
  S.iotVals = {temp:Number(value.toFixed(1))};
  S.iot = 'done';
  S.prediction = computePrediction();
  applyCascade(true);
  renderSaisie();
  MI.toast('Température notée. Vérifiez la valeur lue sur le capteur avant validation.','success');
}

/* ---------- Envoi ---------- */
function submitConsult(escal){
  if(!S.patient){ MI.toast('Choisissez d\u2019abord un patient (liste ou QR).','error'); return; }
  if(!S.symptomes.length){
    MI.toast('Cochez au moins un symptôme observé.','error'); return; }
  const F = S.fields || {motif:'', symptomes:'', duree:'', exams:''};

  const nomPatient = (DB.patients.find(p=>p.code===S.patient)||{}).nom || '';

  post(DB.urls.consult_save, {
    patient:S.patient,
    medecin_prefere: escal ? (document.getElementById('preferredDoctor')?.value || '') : '',
    motif: S.prediction?.maladie || 'Consultation de suivi',
    symptomes: S.symptomes.join(' · ') + (S.notes ? ' — ' + S.notes : ''),
    duree:S.duree||'', exams:S.prediction?.examens||'',
    severite: escal ? S.sev : 'MODÉRÉ', demande_avis: escal,
    temperature:S.iotVals?.temp??null,
    ia_engine:'checklist',
    agent_modified: S.agentOverrode,
    prediction: S.prediction||{},
    epidemic_suspect: S.epidemic,
    epidemic_type: S.epidemicTypes.join(', '),
  }).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Enregistrement impossible.','error'); return; }
    syncQueue.unshift({l:'Consultation '+res.id, tag:'DOSSIER'}); refreshSync();
    MI.toast(S.iotVals?.temp!=null && !res.measurement_saved
      ? 'Consultation enregistrée, mais la température n’a pas été archivée : aucun boîtier associé à votre CSB.'
      : escal
      ? 'Avis routé → '+(res.routed?.medecin||'médecin')+' ('+(res.routed?.reason||'')+').'+(res.epidemic?' Alerte épidémique au Pilotage.':'')
      : 'Consultation enregistrée.','success');
    DB.consults.unshift({id:String(res.id), patient:nomPatient,
      motif:S.prediction?.maladie||'Consultation',
      statut: escal?'EN_ATTENTE':'EN_COURS', severite: escal?S.sev:'MODÉRÉ',
      medecin_id:'', medecin:'',
      date:'à l\u2019instant'});
    Object.assign(S, {patient:null, symptomes:[], duree:'', contextes:[], notes:'',
      iot:'idle', iotVals:null, escal:false, sev:'PRÉOCCUPANT',
      epidemic:false, epidemicTypes:[], preferredDoctor:'', prediction:null, aiSuggested:false, aiEpidemic:false, agentOverrode:false});
    MI.setView('consults');
  }).catch(()=>MI.toast('Erreur réseau — la saisie rejoint la file locale.','error'));
}

/* ---------- QR scanner (reprend le flux existant) ---------- */
let qrTmo=null, qrPatient=null;
function openQr(){
  qrPatient=null; const f=$('#qrFound'); if(f) f.innerHTML='';
  const u=$('#qrUse'); if(u) u.hidden=true;
  const st=$('#qrStatus'); if(st) st.textContent='RECHERCHE DU CODE…';
  const m=$('#qrModal'); if(m) m.hidden=false;
  clearTimeout(qrTmo);
  qrTmo = setTimeout(()=>{
    const p = DB.patients[Math.floor(Math.random()*DB.patients.length)];
    qrPatient = p;
    if(st) st.textContent = 'CODE RECONNU — DOSSIER TROUVÉ';
    if(f) f.innerHTML = '<div class="qr-found" style="display:flex;align-items:center;gap:11px;border:1px solid rgba(0,126,58,.35);background:rgba(0,126,58,.07);border-radius:11px;padding:11px 14px">'+
      '<span class="p-av '+(p.sexe==='F'?'r':'g')+'">'+p.nom[0]+'</span>'+
      '<div><b style="font-size:13.5px;display:block">'+esc(p.nom)+'</b><span style="font-size:11px;color:var(--ink-50)">'+p.age+' ans · '+p.sexe+' · '+esc(p.code)+' · '+esc(p.village)+'</span></div></div>';
    if(u) u.hidden = false;
    MI.refreshIcons();
  }, 1900);
}
const _qrUse = $('#qrUse');
if(_qrUse) _qrUse.addEventListener('click', ()=>{
  if(qrPatient){ S.patient = qrPatient.code; MI.toast('Patient sélectionné — '+qrPatient.nom+'.','success'); }
  const m = $('#qrModal'); if(m) m.hidden = true;
  if(state.view==='saisie') renderSaisie();
});

/* ---------- Enregistrements ---------- */
MI.registerRenderer('saisie', renderSaisie);
