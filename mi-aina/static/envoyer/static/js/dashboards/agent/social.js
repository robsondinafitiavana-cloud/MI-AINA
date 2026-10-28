/* MI-AINA — Agent · chat, visio annuaire, profil */
let recInt2=null, recS2=0;

function bindChat(){
  $$('#view-visio #chatForm').forEach(form=>{
    if(form._bound) return; form._bound = true;
    const card = form.closest('.chat');
    const thread = card?.dataset.thread || (DB.threads[0]?.id ?? '');
    const input = form.querySelector('#chatTxt') || form.querySelector('input:not([type="file"])');
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const txt = input.value.trim(); if(!txt) return;
      input.value='';
      const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      appendMsg(form, '<div class="msg me">'+esc(txt)+'<time>'+now+'</time></div>');
      post(DB.urls.message.replace('<THREAD>', thread), {texte:txt}).then(res=>{
        if(!res.ok) MI.toast(res.erreur||'Envoi impossible.','error');
      }).catch(()=>MI.toast('Erreur réseau — message non confirmé.','error'));
    });
    const foot = form.closest('.chat-foot');
    const vb = foot?.querySelector('#voiceBtn') || foot?.querySelector('.ci-btn:not(.send)');
    const bar = foot?.querySelector('#recBar');
    if(vb) vb.addEventListener('click', ()=>{
      if(!bar || !bar.hidden) return;
      recS2=0; bar.hidden=false; form.style.display='none';
      recInt2 = setInterval(()=>{ recS2++;
        const t=bar.querySelector('#recTime'); if(t) t.textContent = Math.floor(recS2/60)+':'+String(recS2%60).padStart(2,'0');
      },1000);
    });
    const stop = foot?.querySelector('#recStop');
    if(stop) stop.addEventListener('click', ()=>{
      clearInterval(recInt2); recInt2=null;
      bar.hidden=true; form.style.display='flex';
      const dur = '0\u2032'+String(recS2%60).padStart(2,'0');
      const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      const w = Array.from({length:14},()=>Math.floor(6+Math.random()*16));
      appendMsg(form, '<div class="msg voice me"><button class="vplay"><i data-lucide="play"></i></button>'+
        '<span class="wave">'+w.map(h=>'<i style="height:'+h+'px"></i>').join('')+'</span>'+
        '<small>'+dur+'</small><time>'+now+'</time></div>');
      post(DB.urls.message.replace('<THREAD>', thread), {vocal:true, duree:recS2}).catch(()=>{});
      MI.refreshIcons();
      MI.toast('Note vocale envoyée — transcription malagasy jointe pour le médecin.','success');
    });
  });
}
function appendMsg(form, html){
  const box = form.closest('.chat').querySelector('.chat-msgs');
  if(!box) return;
  box.insertAdjacentHTML('beforeend', html);
  MI.refreshIcons(); box.scrollTop = box.scrollHeight;
}

/* ---------- Visio : annuaire cherchable ---------- */
function renderVisio(){
  const pre = $('#preCall');
  if(!pre) return;
  pre.innerHTML =
    '<p class="mono" style="font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-70);margin-bottom:12px">'+
    '<i data-lucide="search" style="width:13px;height:13px;vertical-align:-2px"></i> Trouver un médecin — par nom, CSB, région ou établissement</p>'+
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-bottom:12px">'+
    [['docSearch','Nom ou prénom'],['docRegion','Région'],['docDistrict','District'],['docFacility','CSB ou hôpital']].map(x=>
      '<input id="'+x[0]+'" placeholder="'+x[1]+'" autocomplete="off" style="height:40px;min-width:0;background:var(--field);border:1px solid var(--line-strong);border-radius:9px;padding:0 12px;font-family:var(--sans);font-size:12.5px;color:var(--ink);outline:none">'
    ).join('')+'</div><div id="docList" style="display:flex;flex-direction:column;gap:8px">'+
    '<p style="font-size:12px;color:var(--ink-50);text-align:center;padding:14px">Tapez pour chercher un médecin disponible…</p></div>';
  MI.refreshIcons();
  bindDocSearch();
}
function docRow(d){
  return '<div class="reg-row" data-doc-id="'+d.id+'" data-doc-name="'+esc(d.nom)+'" '+
    'data-doc-init="'+esc(d.initiales)+'" data-doc-role="'+esc(d.etablissement)+'" style="width:100%;cursor:pointer">'+
    '<span class="p-av g">'+esc(d.initiales)+'</span>'+
    '<span class="who"><b>'+esc(d.nom)+'</b><span>'+esc(d.etablissement)+' · '+esc(d.region)+
    ' · '+esc(d.dispo)+(d.local?' · même secteur':' · hors secteur')+'</span></span>'+
    '<span class="btn sm role" style="pointer-events:none"><i data-lucide="phone"></i>Appeler</span></div>';
}
function bindDocSearch(){
  const inputs = ['docSearch','docRegion','docDistrict','docFacility'].map(id=>$('#'+id)).filter(Boolean);
  if(!inputs.length) return;
  let tmo = null;
  const search = ()=>{
    clearTimeout(tmo);
    tmo = setTimeout(()=>{
      const params=new URLSearchParams({name:$('#docSearch')?.value.trim()||'',region:$('#docRegion')?.value.trim()||'',
        district:$('#docDistrict')?.value.trim()||'',facility:$('#docFacility')?.value.trim()||''});
      fetch((DB.urls.tm_doctors||'/telemedicine/doctors/') + '?' + params.toString(),
        {headers:{'X-CSRFToken':csrf}})
        .then(r=>r.json()).then(d=>{
          const list = $('#docList'); if(!list) return;
          list.innerHTML = d.ok && d.items.length ? d.items.map(docRow).join('')
            : '<p style="font-size:12px;color:var(--ink-50);text-align:center;padding:14px">Aucun médecin trouvé — essayez un autre nom, CSB ou région.</p>';
          MI.refreshIcons();
          list.querySelectorAll('[data-doc-id]').forEach(b=>b.onclick=()=>startCall(b.dataset));
        }).catch(()=>{});
    }, 250);
  };
  inputs.forEach(inp=>inp.addEventListener('input',search));
  search();
}
function startCall(ds){
  const context=window.MI_VISIO_CONTEXT||null;
  post(DB.urls.tm_start, {medecin_id: ds.docId, eco:true, consultation_id:context?.consultationId||''}).then(res=>{
    if(!res.ok){ setConsultCallState('Échec de l’appel', 'ÉCHEC'); MI.toast(res.erreur||'Appel impossible.','error'); return; }
    const st = $('#vStage'); if(!st){ setConsultCallState('Salle indisponible — rechargez la page.', 'ÉCHEC'); MI.toast('Salle indisponible — rechargez la page.','error'); return; }
    $('#callStage').hidden = false;
    st.dataset.call = res.call;
    setConsultCallState('Appel envoyé — en attente de la connexion du médecin.', 'APPEL ENVOYÉ');
    const orb = st.querySelector('.orb');     if(orb) orb.textContent = res.initiales;
    const pn  = st.querySelector('.pe-name'); if(pn) pn.innerHTML = esc(res.medecin)+'<small>'+esc(res.role)+'</small>';
    const timer = $('#callTimer'); if(timer){ timer.dataset.s='0'; timer.textContent='00:00'; }
    const btn = $('#callBtn');
    if(btn){ btn.disabled=true; btn.innerHTML='<i data-lucide="phone-call"></i>En appel…'; }
    MI.refreshIcons();
    startCallCtrls(res.call);
    window.MIWebRTC?.start(res.call);
    MI.toast('Appel vers '+res.medecin+' — connexion à faible débit établie.','success');
  }).catch(()=>{setConsultCallState('Erreur réseau — vérifiez la connexion puis réessayez.', 'RÉSEAU');MI.toast('Erreur réseau — réessayez.','error');});
}
function setConsultCallState(message, state){
  const status=$('#consultCallStatus'), badge=$('#consultCallState');
  if(status) status.textContent=message;
  if(badge) badge.textContent=state;
}
document.addEventListener('mi-call-connected',()=>setConsultCallState('Connexion vidéo établie.', 'EN DIRECT'));
document.addEventListener('mi-call-ended',event=>{
  const saved=event.detail?.summarySaved!==false;
  setConsultCallState(saved?'Appel terminé — le résumé a été enregistré.':'Appel terminé, mais le résumé n’a pas pu être enregistré.', saved?'TERMINÉ':'NON ENREGISTRÉ');
  const btn=$('#callBtn'); if(btn){btn.disabled=false;btn.innerHTML='<i data-lucide="phone"></i>Appeler';}
  const close=$('#closeConsultCall'); if(close) close.setAttribute('aria-label','Fermer le résumé de consultation');
  MI.refreshIcons();
});
function startCallCtrls(callId){
  const mic=$('#vcMic'), cam=$('#vcCam'), eco=$('#vcEco'), end=$('#vcEnd');
  if(mic && !mic._bound){
    mic._bound=true;
    mic.onclick=function(){ this.classList.toggle('on'); this.classList.toggle('off'); };
    if(cam) cam.onclick=function(){ this.classList.toggle('on'); this.classList.toggle('off'); };
    if(eco) eco.onclick=()=>{
      const st=$('#vStage'); st.classList.toggle('eco');
      const pill=$('#netPill');
      if(pill) pill.textContent = st.classList.contains('eco')?'ÉCO · 240p · 3G':'HD · 720p · 4G';
    };
    if(end) end.onclick=()=>{
      window.MI_VISIO_CONTEXT=null;
      const btn=$('#callBtn'); if(btn){ btn.disabled=false; btn.innerHTML='<i data-lucide="phone"></i>Appeler'; }
      setConsultCallState('Appel terminé — enregistrement du résumé…', 'TERMINÉ');
      const close=$('#closeConsultCall'); if(close) close.setAttribute('aria-label','Fermer le résumé de consultation');
      MI.refreshIcons();
      MI.toast('Appel terminé — le résumé a été joint au dossier.','success');
    };
  }
  bindChat();
  clearInterval(window._vInt);
  window._vInt = setInterval(()=>{
    const el=$('#callTimer'); if(!el||$('#callStage').hidden){ clearInterval(window._vInt); return; }
    const s = parseInt(el.dataset.s||'0')+1; el.dataset.s=s;
    el.textContent = String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  },1000);
}

let consultCallPlaceholder=null, consultCallOverlay=null;
function openConsultCallOverlay(){
  const callStage=$('#callStage'); if(!callStage) return false;
  if(consultCallOverlay) consultCallOverlay.remove();
  consultCallOverlay=document.createElement('div');
  consultCallOverlay.className='consult-call-overlay';
  consultCallOverlay.innerHTML='<section class="consult-call-window"><header><div><b>Visioconsultation</b><small id="consultCallContext"></small></div><button type="button" aria-label="Terminer l’appel" id="closeConsultCall">×</button></header></section>';
  document.body.appendChild(consultCallOverlay);
  const windowEl=consultCallOverlay.querySelector('.consult-call-window');
  consultCallPlaceholder=document.createComment('callStage original location');
  callStage.parentNode.insertBefore(consultCallPlaceholder,callStage);
  windowEl.appendChild(callStage);
  callStage.hidden=false;
  callStage.style.marginTop='0';
  const closeOrEnd=()=>{
    if($('#vStage')?.dataset.call){$('#vcEnd')?.click();return;}
    closeConsultCallOverlay();window.MI_VISIO_CONTEXT=null;
  };
  consultCallOverlay.querySelector('#closeConsultCall').onclick=closeOrEnd;
  consultCallOverlay.addEventListener('click',e=>{if(e.target===consultCallOverlay) closeOrEnd();});
  return true;
}
function closeConsultCallOverlay(){
  const callStage=$('#callStage');
  if(consultCallPlaceholder?.parentNode && callStage){
    consultCallPlaceholder.replaceWith(callStage);
    callStage.hidden=true;
    callStage.style.marginTop='14px';
  }
  consultCallPlaceholder=null;
  consultCallOverlay?.remove(); consultCallOverlay=null;
}
window.MI_SHOW_CONSULT_VISIO=context=>{
  if(!context?.medecinId){ MI.setView('visio'); return; }
  if(!openConsultCallOverlay()){ MI.setView('visio'); return; }
  const label=$('#consultCallContext');
  if(label) label.textContent=(context.patient||'Patient')+(context.code?' · '+context.code:'');
  const patient=$('#consultCallPatient'), code=$('#consultCallCode'), motif=$('#consultCallMotif'), severity=$('#consultCallSeverity');
  const consult=(DB.consults||[]).find(item=>String(item.id)===String(context.consultationId));
  if(patient) patient.textContent=context.patient||consult?.patient||'Patient de la consultation';
  if(code) code.textContent=context.code?'Code patient · '+context.code:'';
  if(motif) motif.textContent=context.motif||consult?.motif||'Non renseigné';
  if(severity) severity.textContent=context.severite||consult?.severite||'—';
  const notes=$('#consultCallNotes'); if(notes) notes.value='';
  const record=$('#consultCallRecord');
  if(record){ if(context.code){record.dataset.openDossier=context.code;record.href='#';record.hidden=false;}else record.hidden=true; }
  setConsultCallState('Préparation de l’appel avec le médecin.', 'EN ATTENTE');
  startCall({docId:context.medecinId});
};

/* ---------- Profil ---------- */
function renderProfil(){
  $$('#prefBox .escal-toggle').forEach(t=>{
    if(t._bound) return; t._bound = true;
    const toggle=()=>{t.classList.toggle('on');t.setAttribute('aria-pressed',String(t.classList.contains('on')));MI.toast('Préférence enregistrée.','success');};
    t.addEventListener('click',toggle);
    t.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}});
  });
}

MI.registerRenderer('visio',      renderVisio);
MI.registerRenderer('profil',     renderProfil);
