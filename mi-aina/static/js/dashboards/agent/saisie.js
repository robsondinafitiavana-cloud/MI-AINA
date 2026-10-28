/* ================================================================
   MI-AINA — Agent · Saisie éclair : dropdown symptômes,
   repère clinique simple, routage d'avis et vigilance épidémique,
   mesures IoT, décision. Aucun NLP — déterministe et hors ligne.
   ================================================================ */

/* ---------- Catalogue clinique ---------- */
const SYMPTOMES = DB['ai-symptoms'];
const DUREES = ['< 24 h','1-3 jours','4-7 jours','> 1 semaine'];
const EPIDEMICS = ['Paludisme','Dengue','Rougeole','Diarrhée aqueuse','Grippe','Peste','Autre'];

/* Maladies à déclaration épidémique automatique */
const EPIDEMIC_DISEASES = ['Paludisme','Dengue','Rougeole','Diarrhée aqueuse','Grippe','Peste'];

function epidemicTypeFromDisease(name){
  const normalized = String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return EPIDEMIC_DISEASES.find(d=>normalized.includes(d.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))||'';
}

/* ---------- État de la saisie ---------- */
const S = {
  patient:null, symptomes:[], duree:'', contextes:[], notes:'',
  iot:'idle', iotVals:null,
  iotDemo:{capturing:false,phase:'ready',stage:'ready',capture:null,captureToken:0,temperature:null,bpm:null,pending:0,lastMeasurement:null},
  escal:false, sev:'PRÉOCCUPANT', preferredDoctor:'',
  epidemic:false, epidemicTypes:[],
  prediction:null, predictionStatus:'idle', predictionRequest:0, aiSuggested:false, aiEpidemic:false,
  autoEpidemicType:'', autoEscal:false, agentOverrode:false,
};
const iotDemoDevice = window.MiAinaDeviceSimulator.create();
const IOT_MODE = DB['iot-simulation-enabled'] ? 'simulation' : 'real';

function updateIoTDemoPanel(){
  const status=$('#iotDemoStatus'), button=$('#iotDemoCapture'), pulseButton=$('#iotDemoPulse'), stage=$('#iotDemoStage');
  const results=$('#iotDemoResults');
  const temp=$('#iotDemoTemp'), bpm=$('#iotDemoBpm');
  const temperatureReady=['temperature_ready','bpm_capturing','complete'].includes(S.iotDemo.phase);
  if(status){
    status.textContent=S.iotDemo.capturing?'CAPTURE EN COURS':S.iotDemo.phase==='complete'?'MESURES REÇUES · SIMULATION':temperatureReady?'TEMPÉRATURE REÇUE':'PRÊT';
    status.className='badge '+(S.iotDemo.capturing?'amber':temperatureReady?'green':'gray');
  }
  if(button){
    button.textContent=S.iotDemo.capturing?'Capture en cours…':S.iotDemo.phase==='complete'?'Réessayer':'Lancer une capture';
    button.disabled=S.iotDemo.capturing||!S.patient;
    button.hidden=['temperature_ready','bpm_capturing'].includes(S.iotDemo.phase);
  }
  if(pulseButton){
    pulseButton.textContent=S.iotDemo.phase==='bpm_capturing'?'Mesure du pouls en cours…':'Mesurer la fréquence cardiaque';
    pulseButton.hidden=!['temperature_ready','bpm_capturing'].includes(S.iotDemo.phase);
    pulseButton.disabled=S.iotDemo.capturing;
  }
  if(stage) stage.textContent=S.iotDemo.capturing?S.iotDemo.stage:S.iotDemo.phase==='temperature_ready'?'Température reçue · lancez la mesure du pouls':S.iotDemo.phase==='complete'?'Capture terminée · données de démonstration':'Prêt à capturer';
  if(results) results.hidden=!temperatureReady;
  if(temp && S.iotDemo.temperature!==null) temp.textContent=fmtDec(S.iotDemo.temperature.toFixed(1))+' °C';
  if(bpm) bpm.textContent=S.iotDemo.bpm!==null?S.iotDemo.bpm+' BPM':temperatureReady?'En attente':'—';
}

async function startIoTCapture(){
  if(S.iotDemo.capturing) return;
  if(!S.patient){ MI.toast('Choisissez d’abord un patient avant de lancer la capture.','info'); return; }
  const token=++S.iotDemo.captureToken;
  iotDemoDevice.beginCapture();
  Object.assign(S.iotDemo,{capture:null,lastMeasurement:null,pending:0,temperature:null,bpm:null});
  S.iotDemo.phase='temperature_capturing'; S.iotDemo.capturing=true; S.iotDemo.stage='Initialisation du boîtier…';
  updateIoTDemoPanel();
  const stages=[['Stabilisation du boîtier…',1600],['Lecture du capteur MLX90614ESF-DCI…',3400]];
  for(const [label,delay] of stages){
    S.iotDemo.stage=label; updateIoTDemoPanel();
    await new Promise(resolve=>setTimeout(resolve,delay));
    if(token!==S.iotDemo.captureToken) return;
  }
  S.iotDemo.temperature=iotDemoDevice.captureTemperature();
  S.iotDemo.phase='temperature_ready'; S.iotDemo.capturing=false; S.iotDemo.stage='Température reçue';
  updateIoTDemoPanel();
}

async function startIoTPulseCapture(){
  if(S.iotDemo.capturing||S.iotDemo.phase!=='temperature_ready') return;
  const token=++S.iotDemo.captureToken;
  S.iotDemo.phase='bpm_capturing'; S.iotDemo.capturing=true; S.iotDemo.stage='Stabilisation de la fréquence cardiaque…';
  updateIoTDemoPanel();
  const stages=[['Stabilisation du pouls…',3000],['Lecture et validation de la fréquence…',3000]];
  for(const [label,delay] of stages){
    S.iotDemo.stage=label; updateIoTDemoPanel();
    await new Promise(resolve=>setTimeout(resolve,delay));
    if(token!==S.iotDemo.captureToken) return;
  }
  S.iotDemo.capture=iotDemoDevice.finishCapture();
  S.iotDemo.lastMeasurement=S.iotDemo.capture; S.iotDemo.pending=1;
  S.iotDemo.bpm=S.iotDemo.capture.bpm;
  S.iotDemo.phase='complete'; S.iotDemo.capturing=false; S.iotDemo.stage='Fréquence cardiaque reçue';
  updateIoTDemoPanel();
}

function resetIoTCapture(){
  S.iotDemo.captureToken+=1;
  iotDemoDevice.resetCapture();
  Object.assign(S.iotDemo,{capturing:false,phase:'ready',stage:'ready',capture:null,pending:0,lastMeasurement:null,temperature:null,bpm:null});
  updateIoTDemoPanel();
}

iotDemoDevice.subscribe(state=>{
  if(state.temperature!==null) S.iotDemo.temperature=state.temperature;
  if(state.bpm!==null) S.iotDemo.bpm=state.bpm;
  S.iotDemo.pending=state.pending;
  S.iotDemo.lastMeasurement=state.lastMeasurement;
  updateIoTDemoPanel();
});

/* ---------- Moteur de prédiction (déterministe, instantané) ---------- */
function requestDiseasePrediction(){
  const requestId = ++S.predictionRequest;
  if(!S.patient || !S.symptomes.length){ S.prediction=null; S.predictionStatus='idle'; applyCascade(false); renderSaisie(); return; }
  S.prediction=null; S.predictionStatus='loading'; applyCascade(false); renderSaisie();
  const observed = Object.fromEntries(SYMPTOMES.map(s=>[s.key,S.symptomes.includes(s.key)]));
  post(DB.urls.ai_predict_disease, {patient:S.patient, symptoms:observed, temperature:S.iotVals?.temp??null})
    .then(result=>{ if(requestId!==S.predictionRequest) return; S.prediction=result.ok?result:null; S.predictionStatus=result.status||(result.ok?'ok':'insufficient_data'); applyCascade(true); renderSaisie(); })
    .catch(()=>{ if(requestId!==S.predictionRequest) return; S.prediction=null; S.predictionStatus='offline'; applyCascade(false); renderSaisie(); });
}
/* ---------- CASCADE AUTOMATIQUE après prédiction ---------- */
function applyCascade(auto){
  const disease = S.prediction?.results?.[0]?.disease||'';
  const epidemicType = epidemicTypeFromDisease(disease);
  if(epidemicType){
    if(S.autoEpidemicType && S.autoEpidemicType!==epidemicType){
      S.epidemicTypes = S.epidemicTypes.filter(type=>type!==S.autoEpidemicType);
    }
    const newlyDetected = !S.epidemic || !S.escal;
    S.epidemic = true;
    S.escal = true;
    S.aiEpidemic = true;
    S.aiSuggested = true;
    if(!S.epidemicTypes.includes(epidemicType)) S.epidemicTypes.push(epidemicType);
    S.autoEpidemicType = epidemicType;
    S.autoEscal = true;
    if(auto && newlyDetected) MI.toast('Suspicion de '+epidemicType+' : avis médical et vigilance épidémique activés automatiquement. À confirmer par un professionnel.','info');
    return;
  }
  if(S.autoEpidemicType){
    S.epidemicTypes = S.epidemicTypes.filter(type=>type!==S.autoEpidemicType);
    S.autoEpidemicType = '';
    S.epidemic = S.epidemicTypes.length>0;
  }
  if(S.autoEscal){ S.escal=false; S.autoEscal=false; }
  S.aiEpidemic = false;
  if(!S.epidemic) S.epidemicTypes = [];
  S.aiSuggested = false;
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
    (S.symptomes.length ? S.symptomes.map(key=>esc(SYMPTOMES.find(s=>s.key===key)?.label||key)).join(', ') : '— Cocher les symptômes observés —')+
    '</span><i data-lucide="chevron-down" style="width:15px;height:15px;color:var(--ink-35);flex:none"></i></button>'+
    '<div id="symDropList" hidden style="position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:20;'+
    'background:var(--sheet);border:1px solid var(--line-strong);border-radius:11px;'+
    'box-shadow:0 14px 34px rgba(30,42,34,.18);max-height:290px;overflow-y:auto;padding:6px">'+
    SYMPTOMES.map((s,i)=>
      ((i===0 || SYMPTOMES[i-1].group!==s.group) ? '<div style="padding:9px 10px 4px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--mg-green);letter-spacing:.06em">'+esc(s.group)+'</div>' : '')+
      '<label style="display:flex;align-items:center;gap:10px;padding:8px 11px;border-radius:8px;'+
      'cursor:pointer;font-size:13px;font-weight:500;color:var(--ink);'+
      (S.symptomes.includes(s.key)?'background:rgba(0,126,58,.08)':'')+'" data-sym-row="'+s.key+'">'+
      '<input type="checkbox" data-sym="'+s.key+'"'+(S.symptomes.includes(s.key)?' checked':'')+
      ' style="accent-color:var(--mg-green);width:15px;height:15px">'+esc(s.label)+'</label>').join('')+
    '</div></div>';

  /* --- Durée en pills radio --- */
  const dureePills = '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
    DUREES.map(d=>'<button type="button" class="pill '+(S.duree===d?'on':'')+'" data-duree="'+d+'">'+d+'</button>').join('')+'</div>';

  /* --- Repère clinique indicatif --- */
  const pred = S.prediction;
  const predBlock = pred ? '<div class="ia-box" id="predBox" style="margin-top:14px;width:100%;display:block">'+
    '<b>Maladies compatibles proposées par l’aide IA</b><ol style="margin:8px 0;padding-left:22px">'+
    pred.results.map(r=>'<li style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;padding:5px 0">'+
      '<span>'+esc(r.disease)+' <b>'+Math.round(r.score*100)+' %</b></span>'+ 
      (r.prevention_url?'<a href="'+esc(r.prevention_url)+'" style="display:inline-flex;align-items:center;gap:5px;padding:5px 9px;border:1px solid rgba(0,126,58,.28);border-radius:8px;color:#026630;text-decoration:none;font-size:10.5px;font-weight:600">Voir les précautions</a>':'<span style="font-size:10.5px;color:var(--ink-50)">Fiche de prévention indisponible</span>')+'</li>').join('')+'</ol>'+ 
    (pred.missing_optional_features?.length ? '<div style="font-size:11px;color:var(--ink-50);margin:6px 0">Certaines constantes capteur étaient indisponibles pour cette estimation.</div>' : '')+
    '<div style="font-size:11px;color:var(--ink-50)">Scores du modèle; résultat indicatif, ne remplace pas l’évaluation d’un professionnel de santé.</div></div>' :
    (S.predictionStatus==='loading' ? '<div class="ia-box" style="margin-top:14px">Calcul de l’aide IA…</div>' :
    (S.predictionStatus==='insufficient_data' || S.predictionStatus==='model_unavailable' || S.predictionStatus==='offline' ? '<div class="ia-box" style="margin-top:14px">Données insuffisantes ou modèle MLP indisponible.</div>' : ''));  /* --- Épidémie (activée par cascade ou manuellement) --- */
  const epiBlock =
    '<div class="card" style="margin-top:14px"><div style="padding:16px 18px 18px">'+
    '<p class="mono" style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--mg-red);display:flex;align-items:center;gap:8px;margin-bottom:12px"><i data-lucide="siren" style="width:13px;height:13px"></i>Vigilance épidémique <span class="mono" style="font-size:8.5px;padding:2px 7px;border-radius:999px;background:rgba(193,39,45,.1);color:var(--mg-red)">'+(S.aiEpidemic?'ACTIVATION AUTOMATIQUE':'SIGNALEMENT MANUEL')+'</span></p>'+ 
    '<div class="escal-toggle '+(S.epidemic?'on':'')+'" id="epiT"><span class="toggle-pill"></span>'+
    '<span class="tt"><b>Suspicion épidémique'+(S.aiEpidemic?' <span class="mono" style="font-size:9px;color:#026630">· repère à vérifier</span>':'')+'</b>'+
    '<span>'+(S.aiEpidemic?'Alerte Pilotage à l’envoi ; suspicion à confirmer médicalement.':'Si activé, Pilotage est alerté en direct à l\u2019envoi')+'</span></span></div>'+ 
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
          (IOT_MODE==='simulation'
            ? '<div class="iot-head"><span class="dev-ic" style="width:36px;height:36px"><i data-lucide="cpu" style="width:17px;height:17px"></i></span>'+ 
              '<div><b>Boîtier ESP32 · démonstration</b><span>MLX90614ESF-DCI · pouls simulé</span></div>'+ 
              '<span class="badge gray" id="iotDemoStatus">PRÊT</span></div>'+ 
              '<button type="button" class="btn solid" id="iotDemoCapture" style="width:100%;justify-content:center;margin-top:13px"'+(S.iotDemo.capturing||!S.patient?' disabled':'')+'>'+(S.iotDemo.phase==='complete'?'Réessayer':'Lancer une capture')+'</button>'+ 
              '<p id="iotDemoStage" style="font-size:11px;color:var(--ink-50);margin:9px 0 0" aria-live="polite">'+(S.iotDemo.capturing?esc(S.iotDemo.stage):S.iotDemo.phase==='temperature_ready'?'Température reçue · lancez la mesure du pouls':S.iotDemo.capture?'Capture terminée · données de démonstration':'Prêt à capturer')+'</p>'+ 
              '<div id="iotDemoResults"'+(S.iotDemo.temperature!==null?'':' hidden')+' style="margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--field)">'+ 
                '<div class="cap-val" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">'+ 
                  '<div class="cap-cell done"><div class="n" id="iotDemoTemp">'+(S.iotDemo.temperature!==null?fmtDec(S.iotDemo.temperature.toFixed(1)):'—')+'<small> °C</small></div><div class="l">TEMPÉRATURE · MLX90614</div></div>'+ 
                  '<div class="cap-cell '+(S.iotDemo.bpm!==null?'done':'spin')+'"><div class="n" id="iotDemoBpm">'+(S.iotDemo.bpm!==null?S.iotDemo.bpm:'En attente')+(S.iotDemo.bpm!==null?'<small> BPM</small>':'')+'</div><div class="l">FRÉQUENCE CARDIAQUE · SIMULÉE</div></div></div>'+ 
                '<button type="button" class="btn sm role" id="iotDemoPulse" style="width:100%;justify-content:center;margin-top:10px"'+(S.iotDemo.capturing||S.iotDemo.phase==='complete'?' disabled':'')+'>'+(S.iotDemo.phase==='bpm_capturing'?'Mesure du pouls en cours…':'Mesurer la fréquence cardiaque')+'</button>'+ 
              '</div>'+ 
              '<p style="font-size:10px;color:var(--ink-50);margin:9px 0 0">Profil adulte au repos. Données de démonstration identifiées comme SIMULATION ; elles ne sont pas utilisées par l’IA.</p>'
            : '<div class="iot-head"><span class="dev-ic" style="width:36px;height:36px"><i data-lucide="cpu" style="width:17px;height:17px"></i></span>'+ 
              '<div><b>Boîtier ESP32</b><span>Température infrarouge · '+iotState+'</span></div>'+ 
              '<span class="iot-state '+(S.iot==='done'?'ok':'')+'"><span class="dot"></span></span></div>'+ 
              '<label for="infraredTemp" style="display:block;margin-top:14px;font-size:12px;font-weight:600">Température réelle saisie manuellement</label>'+ 
              '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap">'+ 
              '<input id="infraredTemp" type="number" inputmode="decimal" step="0.1" min="25" max="45" value="'+(S.iotVals?.temp??'')+'" placeholder="Ex. 37.2" style="width:150px;height:40px;padding:0 10px;border:1px solid var(--line-strong);border-radius:8px;background:var(--field);color:var(--ink)">'+ 
              '<span class="mono" style="font-size:11px;color:var(--ink-50)">°C</span>'+ 
              '<button type="button" class="btn sm role" id="tempSave"><i data-lucide="thermometer"></i>Ajouter la mesure</button></div>'+ 
              '<p style="font-size:10.5px;color:var(--ink-50);margin-top:7px">La liaison automatique au capteur n’est pas encore configurée.</p>'+ 
              '<div style="margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:9px;background:var(--field)"><b style="font-size:12px">AD8232 · ECG une dérivation</b><p style="font-size:11px;color:var(--ink-50);margin:5px 0 0;line-height:1.5">Aucun BPM n’est déduit d’un signal ECG matériel.</p></div>')+ 
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
          '<button class="btn ghost" id="saveDraft" style="flex:1;justify-content:center"><i data-lucide="save"></i>'+(S.aiEpidemic?'Enregistrer + avis et alerte':'Enregistrer seul')+'</button>'+ 
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
      requestDiseasePrediction();
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
    if(e.target.closest('#iotDemoCapture')){
      startIoTCapture();
      return;
    }
    if(e.target.closest('#iotDemoPulse')){
      startIoTPulseCapture();
      return;
    }
    if(e.target.closest('#tempSave')){ saveInfraredTemperature(); return; }
    if(e.target.closest('#escalT')){
      if(S.aiEpidemic){ MI.toast('Avis médical requis pour cette suspicion épidémique. Corrigez les symptômes si le repère est inexact.','info'); return; }
      S.escal = !S.escal;
      if(!S.escal) S.autoEscal = false;
      if(!S.escal) S.aiSuggested = false;
      renderSaisie(); return;
    }
    const sev = e.target.closest('[data-sev]');
    if(sev){ S.sev = sev.dataset.sev; S.agentOverrode = true; renderSaisie(); return; }
    if(e.target.closest('#epiT')){
      if(S.aiEpidemic){ MI.toast('La vigilance est activée automatiquement pour cette suspicion. Corrigez les symptômes si le repère est inexact.','info'); return; }
      S.epidemic = !S.epidemic;
      S.autoEpidemicType = '';
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
    if(e.target.id === 'szPatient'){
      const nextPatient=e.target.value||null;
      if(S.patient && nextPatient!==S.patient && S.iotDemo.phase!=='ready'){
        resetIoTCapture();
        MI.toast('La capture a été effacée car le patient a changé.','info');
      }
      S.patient = nextPatient; requestDiseasePrediction();
    }
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
  requestDiseasePrediction();
  applyCascade(true);
  renderSaisie();
  MI.toast('Température notée. Vérifiez la valeur lue sur le capteur avant validation.','success');
}

/* ---------- Envoi ---------- */
function submitConsult(escal){
  if(!S.patient){ MI.toast('Choisissez d\u2019abord un patient (liste ou QR).','error'); return; }
  if(S.iotDemo.capturing || S.iotDemo.phase==='temperature_ready'){
    MI.toast(S.iotDemo.phase==='temperature_ready'?'Mesurez d’abord la fréquence cardiaque pour terminer la capture.':'Attendez la fin de la capture avant de valider.','info'); return;
  }
  if(!S.symptomes.length){
    MI.toast('Cochez au moins un symptôme observé.','error'); return; }
  const F = S.fields || {motif:'', symptomes:'', duree:'', exams:''};
  const mustEscalate = Boolean(escal || S.escal || S.epidemic);

  const nomPatient = (DB.patients.find(p=>p.code===S.patient)||{}).nom || '';

  post(DB.urls.consult_save, {
    patient:S.patient,
    medecin_prefere: mustEscalate ? (document.getElementById('preferredDoctor')?.value || '') : '',
    motif: S.prediction?.results?.[0]?.disease || 'Consultation de suivi',
    symptomes: S.symptomes.map(key=>SYMPTOMES.find(s=>s.key===key)?.label||key).join(' · ') + (S.notes ? ' — ' + S.notes : ''),
    duree:S.duree||'', exams:'',
    severite: mustEscalate ? S.sev : 'MODÉRÉ', demande_avis: mustEscalate,
    temperature:S.iotVals?.temp??null,
    ia_engine:S.prediction ? 'mlp' : '',
    agent_modified: S.agentOverrode,
    prediction: S.prediction?.results?.length ? {maladie:S.prediction.results[0].disease, confiance:Math.round(S.prediction.results[0].score*100)} : {},
    epidemic_suspect: S.epidemic,
    epidemic_type: S.epidemicTypes.join(', '),
  }).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Enregistrement impossible.','error'); return; }
    const hadSimulation = Boolean(S.iotDemo.capture);
    const simulationFlush = hadSimulation
      ? iotDemoDevice.flush(DB.urls.simulation_post, csrf, res.id)
      : Promise.resolve([]);
    syncQueue.unshift({l:'Consultation '+res.id, tag:'DOSSIER'}); refreshSync();
    simulationFlush.then(sent=>{
      sent.slice().reverse().forEach(m=>DB.measures.unshift({
        t:new Date(m.timestamp).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        pat:nomPatient, temp:String(m.temperature), bpm:m.bpm,
        dev:m.device_id, sync:true, source:'SIMULATION',
      }));
      if(sent.length) MI.toast(`${sent.length} relevé(s) de démonstration enregistrés avec la mention SIMULATION.`, 'success');
      resetIoTCapture();
    }).catch(err=>{
      MI.toast('Consultation enregistrée, mais la capture simulée n’a pas été archivée : '+err.message,'error');
      resetIoTCapture();
    });
    MI.toast(S.iotVals?.temp!=null && !res.measurement_saved
      ? 'Consultation enregistrée, mais la température n’a pas été archivée : aucun boîtier associé à votre CSB.'
      : mustEscalate
      ? 'Avis routé → '+(res.routed?.medecin||'médecin')+' ('+(res.routed?.reason||'')+').'+(res.epidemic?' Alerte épidémique au Pilotage.':'')
      : 'Consultation enregistrée.','success');
    DB.consults.unshift({id:String(res.id), patient:nomPatient,
      motif:S.prediction?.results?.[0]?.disease||'Consultation',
      statut: mustEscalate?'EN_ATTENTE':'EN_COURS', severite: mustEscalate?S.sev:'MODÉRÉ',
      medecin_id:'', medecin:'',
      date:'à l\u2019instant'});
    Object.assign(S, {patient:null, symptomes:[], duree:'', contextes:[], notes:'',
      iot:'idle', iotVals:null, escal:false, sev:'PRÉOCCUPANT',
      epidemic:false, epidemicTypes:[], preferredDoctor:'', prediction:null, aiSuggested:false, aiEpidemic:false,
      autoEpidemicType:'', autoEscal:false, agentOverrode:false});
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
