/* MI-AINA — Médecin · chat, visio, profil, formation & publications, forum */
let recInt2=null, recS2=0;

/* ---------- Annuaire de l’espace Visio ---------- */
let visioRole='TOUS', visioTimer=null, visioContacts=[];
function visioAvatar(user){
  return user.photo
    ? '<img src="'+esc(user.photo)+'" alt="" class="visio-contact-photo">'
    : '<span class="visio-contact-initials '+(user.role==='MEDECIN'?'doctor':'agent')+'">'+esc(user.initiales)+'</span>';
}
function renderVisioContacts(){
  const box=$('#visioContactResults'); if(!box) return;
  box.innerHTML=visioContacts.length?visioContacts.map(user=>
    '<button type="button" class="visio-contact" data-visio-contact="'+esc(user.id)+'">'+
    visioAvatar(user)+'<span class="visio-contact-copy"><b>'+esc(user.nom)+'</b><small>'+esc(user.role_label)+' · '+esc(user.structure)+'</small><small>'+esc(user.district)+' · '+esc(user.region)+'</small></span>'+
    '<i data-lucide="chevron-right"></i></button>').join(''):
    '<p class="visio-directory-empty">Aucun contact ne correspond à ces filtres.</p>';
  const count=$('#visioContactsCount');
  if(count) count.textContent=visioContacts.length+' contact'+(visioContacts.length>1?'s':'')+' · agents limités à votre secteur';
  MI.refreshIcons();
  box.querySelectorAll('[data-visio-contact]').forEach(button=>button.onclick=()=>{
    const contact=visioContacts.find(user=>String(user.id)===String(button.dataset.visioContact));
    if(contact) showVisioContact(contact);
  });
}
function searchVisioContacts(){
  clearTimeout(visioTimer);
  visioTimer=setTimeout(()=>{
    const roles=visioRole==='TOUS'?'MEDECIN,PREMIERE_LIGNE':visioRole;
    const params=new URLSearchParams({roles,q:$('#visioContactQ')?.value.trim()||'',
      region:$('#visioContactRegion')?.value.trim()||'',district:$('#visioContactDistrict')?.value.trim()||'',
      csb:$('#visioContactCsb')?.value.trim()||'',hopital:$('#visioContactHospital')?.value.trim()||''});
    fetch((DB.urls.fils_annuaire||'/messaging/fils/annuaire/')+'?'+params.toString(),{credentials:'same-origin'})
      .then(response=>response.json()).then(data=>{
        if(!data.ok) throw new Error('Annuaire indisponible');
        visioContacts=data.items||[];
        renderVisioContacts();
      }).catch(()=>{const box=$('#visioContactResults');if(box)box.innerHTML='<p class="visio-directory-empty">Impossible de charger les contacts. Réessayez.</p>';});
  },180);
}
function showVisioContact(user){
  const box=$('#visioContactDetail'), results=$('#visioContactResults'); if(!box||!results)return;
  const canCall=user.role==='PREMIERE_LIGNE';
  box.innerHTML='<button type="button" class="visio-detail-back" id="visioContactBack"><i data-lucide="arrow-left"></i>Retour aux contacts</button>'+
    '<div class="visio-contact-profile">'+visioAvatar(user)+'<b>'+esc(user.nom)+'</b><span>'+esc(user.role_label)+'</span></div>'+
    '<dl><div><dt>Structure</dt><dd>'+esc(user.structure)+'</dd></div><div><dt>District / région</dt><dd>'+esc(user.district)+' · '+esc(user.region)+'</dd></div>'+
    (user.etablissement?'<div><dt>Établissement</dt><dd>'+esc(user.etablissement)+'</dd></div>':'')+'</dl>'+
    '<div class="visio-contact-actions"><button type="button" class="btn ghost" id="visioMessageContact"><i data-lucide="message-circle"></i>Ouvrir la messagerie</button>'+
    (canCall?'<button type="button" class="btn solid" id="visioCallContact"><i data-lucide="video"></i>Démarrer une visio</button>':'')+'</div>';
  results.hidden=true;box.hidden=false;MI.refreshIcons();
  $('#visioContactBack').onclick=()=>{box.hidden=true;results.hidden=false;};
  $('#visioMessageContact').onclick=()=>openVisioMessage(user);
  $('#visioCallContact')?.addEventListener('click',()=>callVisioContact(user));
}
function openVisioMessage(user){
  post(DB.urls.fil_create||'/messaging/fils/creer/',{dest:user.id}).then(result=>{
    if(!result.ok){MI.toast(result.erreur||'Conversation impossible à ouvrir.','error');return;}
    window.MI_FIL_TO_OPEN=result.fil.id;
    MI.setView('messagerie');
  }).catch(()=>MI.toast('Erreur réseau — conversation non ouverte.','error'));
}
function callVisioContact(user){
  const stage=$('#vStage'); if(!stage||stage.dataset.call){MI.toast('Terminez d’abord la visioconsultation en cours.','info');return;}
  const button=$('#visioCallContact');if(button)button.disabled=true;
  post(DB.urls.tm_start||'/telemedicine/start/',{agent_id:user.id,eco:true}).then(result=>{
    if(!result.ok){if(button)button.disabled=false;MI.toast(result.erreur||'Appel impossible.','error');return;}
    stage.dataset.call=result.call;
    const orb=stage.querySelector('.orb');if(orb)orb.textContent=result.peer_initiales||user.initiales;
    const peer=stage.querySelector('.pe-name');if(peer)peer.innerHTML=esc(result.peer||user.nom)+'<small>'+esc(result.peer_role||user.role_label)+'</small>';
    const timer=$('#callTimer');if(timer){timer.dataset.s='0';timer.textContent='00:00';}
    window.MIWebRTC?.start(result.call);
    MI.toast('Appel envoyé à '+user.nom+' — en attente de sa connexion.','success');
  }).catch(()=>{if(button)button.disabled=false;MI.toast('Erreur réseau — appel non lancé.','error');});
}
function renderVisio(){
  const roleFilters=$('#visioRoleFilters');
  roleFilters?.querySelectorAll('[data-visio-role]').forEach(button=>button.onclick=()=>{
    visioRole=button.dataset.visioRole;
    roleFilters.querySelectorAll('[data-visio-role]').forEach(item=>item.classList.toggle('on',item===button));
    $('#visioContactDetail').hidden=true;$('#visioContactResults').hidden=false;searchVisioContacts();
  });
  ['visioContactQ','visioContactRegion','visioContactDistrict','visioContactCsb','visioContactHospital']
    .forEach(id=>$('#'+id)?.addEventListener('input',searchVisioContacts));
  searchVisioContacts();
  clearInterval(window._vInt);
  window._vInt = setInterval(()=>{
    const el = $('#callTimer'); if(!el){ clearInterval(window._vInt); return; }
    const s = parseInt(el.dataset.s||'0')+1; el.dataset.s = s;
    el.textContent = String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  }, 1000);
  const mic=$('#vcMic'), cam=$('#vcCam'), eco=$('#vcEco'), end=$('#vcEnd');
  if(mic && !mic._bound){
    mic._bound=true;
    mic.onclick=function(){ this.classList.toggle('on'); this.classList.toggle('off');
      MI.toast(this.classList.contains('off')?'Micro coupé.':'Micro réactivé.','info'); };
    cam.onclick=function(){ this.classList.toggle('on'); this.classList.toggle('off');
      MI.toast(this.classList.contains('off')?'Caméra coupée — mode audio + notes vocales.':'Caméra réactivée.','info'); };
    if(eco) eco.onclick=()=>{
      const st=$('#vStage'); st.classList.toggle('eco');
      $('#netPill').textContent = st.classList.contains('eco')?'ÉCO · 240p · 3G':'HD · 720p · 4G';
      MI.toast(st.classList.contains('eco')?'Mode faible débit — la visio se dégrade volontairement, l\u2019audio reste prioritaire.':'Retour en qualité standard.','info');
    };
    if(end) end.onclick=()=>{
      MI.toast('Visio terminée — le résumé a été joint au dossier du patient.','success');
    };
  }
}

/* ---------- Profil ---------- */
function renderProfil(){
  const g = $('#gardeT');
  if(g && !g._bound){
    g._bound = true;
      g.addEventListener('click', ()=>{
        g.classList.toggle('on');
        const on = g.classList.contains('on');
        g.setAttribute('aria-pressed', String(on));
        $('#gardeLbl').textContent = on?'De garde — vous recevez les escalades':'Hors garde — la file va à un confrère';
        MI.toast(on?'Vous êtes de garde — les escalades vous arrivent en priorité.':'Hors garde — la file est confiée au médecin de garde.', on?'success':'info');
      });
    g.addEventListener('keydown', event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();g.click();}});
  }
}

/* ---------- Formation & publications (feed + publication) ---------- */
const TYPE_META = {
  image:    {icon:'image',          lbl:'IMAGE',      col:'#7254A3'},
  texte:    {icon:'text',           lbl:'TEXTE',      col:'#007E3A'},
  video:    {icon:'play',           lbl:'VIDÉO',      col:'#C1272D'},
  pdf:      {icon:'file-text',      lbl:'GUIDE PDF',  col:'#9A6A1F'},
  protocole:{icon:'clipboard-list', lbl:'PROTOCOLE',  col:'#1C4030'},
};
let feedFilter = 'TOUT';
let formationFeedLoaded = false;
const pubFile = $('#pubFile');
if(pubFile) pubFile.addEventListener('change', ()=>{
  const label = $('#pubFileLabel');
  if(label) label.textContent = pubFile.files[0]?.name || 'Joindre un média';
});
function renderFeed(){
  if(!formationFeedLoaded){
    formationFeedLoaded = true;
    fetch(DB.urls.pub_feed||'/publications/feed/', {credentials:'same-origin'})
      .then(r=>r.json()).then(res=>{
        if(res.ok && Array.isArray(res.items)){ DB.formation=res.items; renderFeed(); }
      }).catch(()=>{});
  }
  const items = DB.formation.filter(p=>feedFilter==='TOUT'||p.type===feedFilter);
  $('#feedSub').textContent = items.length+' publication'+(items.length>1?'s':'')+' · partagées avec tous les agents du réseau';
  const filters = [['image','Images'],['TOUT','Tout'],['texte','Textes'],['video','Vidéos'],['pdf','Guides'],['protocole','Protocoles']];
  $('#feedFilters').innerHTML = filters.map(([k,l])=>
    '<button class="pill '+(feedFilter===k?'on':'')+'" data-ff="'+k+'" style="font-size:10px;padding:4px 11px">'+l+'</button>').join('');
  $('#pubFeed').innerHTML = items.length ? items.map(p=>{
    const t = TYPE_META[p.type]||TYPE_META.texte;
    const ext=(p.fichier_url||'').split('?')[0].split('.').pop().toLowerCase();
    const media=p.fichier_url&&(p.type==='image'||['png','jpg','jpeg','gif','webp'].includes(ext))?'<img class="pub-media-image" loading="lazy" src="'+esc(p.fichier_url)+'" alt="'+esc(p.titre)+'">':p.fichier_url&&(p.type==='video'||['mp4','webm','ogv'].includes(ext))?'<video class="pub-media-video" controls preload="metadata"><source src="'+esc(p.fichier_url)+'"></video>':p.fichier_url&&(p.type==='pdf'||ext==='pdf')?'<a class="btn sm ghost" href="'+esc(p.fichier_url)+'" target="_blank" rel="noopener">Ouvrir le PDF</a>':'';
    const auteur = (p.auteur_role_code==='MEDECIN'?'Dr ':'')+(p.auteur||'—');
    const avatar = p.auteur_photo
      ? '<img src="'+esc(p.auteur_photo)+'" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:50%">'
      : '<span class="p-av g" style="width:36px;height:36px">'+esc((p.auteur_prenom||p.auteur||'MI').slice(0,1).toUpperCase())+'</span>';
    return '<article class="card pub-card" style="cursor:default">'+
      '<div style="display:flex;gap:10px;align-items:center">'+avatar+'<div><b style="font-size:12.5px">'+esc(auteur)+'</b><div style="font-size:10.5px;color:var(--ink-50)">'+esc(p.created||'')+'</div></div></div>'+
      '<div style="margin-top:12px"><span class="mono" style="font-size:9px;letter-spacing:.8px;color:'+t.col+';background:'+t.col+'14;padding:3px 8px;border-radius:999px">'+t.lbl+'</span></div>'+
      '<b style="font-size:16px;display:block;margin-top:10px">'+esc(p.titre)+'</b>'+
      '<p style="font-size:13px;color:var(--ink-70);margin-top:5px;line-height:1.6;white-space:pre-line">'+esc(p.resume)+'</p>'+media+
      '<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;align-items:center">'+
      '<span style="margin-left:auto;display:flex;gap:12px;font-size:10.5px;color:var(--ink-50)">'+
      '<span style="display:flex;align-items:center;gap:4px"><i data-lucide="eye" style="width:12px;height:12px"></i>'+(p.vues||0)+'</span></span>'+
      (p.fichier_url?'<a class="btn sm ghost" href="'+esc(p.fichier_url)+'" target="_blank" rel="noopener"><i data-lucide="paperclip"></i>'+esc(p.fichier_nom||'Ouvrir le média')+'</a>':'')+
      (!p.lu?'<button class="btn sm ghost" data-pub-lu="'+p.id+'"><i data-lucide="check"></i>Marquer comme lu</button>':'')+
      '</div></article>';
  }).join('')
  : '<div class="empty" style="padding:34px"><div class="empty-ic"><i data-lucide="megaphone"></i></div>'+
    '<h3 style="font-size:18px">Aucune publication</h3>'+
    '<p>Publiez le premier protocole ou guide — il sera poussé hors-ligne sur les terminaux des agents au prochain passage réseau.</p></div>';
  MI.refreshIcons();
  $('#feedFilters').querySelectorAll('[data-ff]').forEach(b=>b.onclick=()=>{ feedFilter=b.dataset.ff; renderFeed(); });
  $('#pubFeed').querySelectorAll('[data-pub-lu]').forEach(b=>b.onclick=()=>{
    const p = DB.formation.find(x=>String(x.id)===String(b.dataset.pubLu)); if(!p) return;
    p.lu = true; MI.setBadge('formation', DB.formation.filter(x=>!x.lu).length); renderFeed();
    post((DB.urls.pub_lu||'/publications/<ID>/lu/').replace('<ID>', p.id), {}).catch(()=>{});
  });
}
 $('#pubForm').addEventListener('submit', e=>{
  e.preventDefault();
  const titre = $('#pubTitle').value.trim(), resume = $('#pubDesc').value.trim();
  if(!titre || !resume){ MI.toast('Titre et contenu sont obligatoires.','error'); return; }
  const body = new FormData();
  body.append('type', $('#pubType').value); body.append('titre', titre); body.append('resume', resume);
  const file = $('#pubFile')?.files[0]; if(file) body.append('fichier', file);
  fetch(DB.urls.formation_publish, {method:'POST', headers:{'X-CSRFToken':csrf}, body})
  .then(r=>r.json()).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Publication impossible.','error'); return; }
    DB.formation.unshift(res.publication);
    e.target.reset();
    if($('#pubFileLabel')) $('#pubFileLabel').textContent='Joindre un média';
    feedFilter='TOUT'; renderFeed();
    MI.toast('Publié — « '+res.publication.titre+' » sera synchronisé sur les terminaux des agents au prochain passage réseau.','success');
  }).catch(()=>MI.toast('Échec de l’envoi du fichier. Vérifiez la connexion et réessayez.','error'));
});

/* ---------- Forum ---------- */
function medForumAvatar(user){return user?.auteur_photo?'<img class="forum-avatar" src="'+esc(user.auteur_photo)+'" alt="">':'<span class="forum-avatar forum-avatar-fallback '+(user?.auteur_role_code==='MEDECIN'?'doctor':user?.auteur_role_code==='PILOTAGE'?'pilot':'agent')+'">'+esc((user?.auteur||'?').trim().slice(0,1).toUpperCase())+'</span>';}
function renderMedForum(){
  const box=$('#forumBox'), composer=$('#medForumComposer');if(!box||!composer)return;
  composer.innerHTML='<header><div><div class="card-title">Nouveau sujet</div><div class="card-sub">Posez une question ou partagez un retour clinique</div></div></header>'+
    '<form id="medForumCreate" class="forum-create-form"><textarea name="question" minlength="8" maxlength="8000" required placeholder="Décrivez votre question ou votre retour d’expérience…"></textarea>'+
    '<div class="forum-create-actions"><input name="tags" maxlength="120" placeholder="Thèmes, séparés par des virgules (facultatif)"><button class="btn solid" type="submit"><i data-lucide="plus"></i>Nouveau sujet</button></div></form>';
  box.innerHTML='<div class="forum-feed-head"><b>Discussions</b><span>'+DB.forum.length+' sujet'+(DB.forum.length===1?'':'s')+'</span></div>'+
    '<div class="forum-feed">'+(DB.forum.length?DB.forum.map(medForumCard).join(''):'<div class="empty"><div class="empty-ic"><i data-lucide="messages-square"></i></div><h3>Aucun sujet</h3><p>Ouvrez une discussion pour commencer.</p></div>')+'</div>';
  MI.refreshIcons();
  $('#medForumCreate').onsubmit=e=>{e.preventDefault();const data=new FormData(e.currentTarget),question=String(data.get('question')||'').trim();
    post(DB.urls.forum_create,{question,tags:String(data.get('tags')||'').trim()}).then(res=>{if(!res.ok){MI.toast(res.erreur||'Sujet impossible à publier.','error');return;}DB.forum.unshift(res.post);renderMedForum();MI.toast('Sujet enregistré.','success');}).catch(()=>MI.toast('Réseau indisponible — réessayez.','error'));};
  box.querySelectorAll('[data-med-forum-reply]').forEach(form=>form.onsubmit=e=>{e.preventDefault();const reponse=form.elements.reponse.value.trim();if(!reponse)return;const button=form.querySelector('button');button.disabled=true;
    post(DB.urls.forum_reply.replace('<ID>',form.dataset.medForumReply),{reponse}).then(res=>{if(!res.ok){button.disabled=false;MI.toast(res.erreur||'Réponse impossible.','error');return;}const i=DB.forum.findIndex(p=>String(p.id)===form.dataset.medForumReply);if(i>=0)DB.forum[i]=res.post;renderMedForum();MI.toast('Réponse enregistrée.','success');}).catch(()=>{button.disabled=false;MI.toast('Réseau indisponible — réessayez.','error');});});
}
function medForumCard(f){const replies=(f.reponses_list||[]).map(r=>'<article class="forum-reply">'+medForumAvatar(r)+'<div class="forum-reply-copy"><div><b>'+esc(r.auteur)+'</b><span>'+esc(r.auteur_role||'')+' · '+esc(r.date||'')+'</span></div><p>'+esc(r.reponse)+'</p></div></article>').join('');
  const tags=(f.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>'<span class="f-tag">'+esc(t)+'</span>').join('');
  return '<article class="card forum-card"><header class="forum-post-head">'+medForumAvatar(f)+'<div class="forum-post-by"><b>'+esc(f.auteur)+'</b><span>'+esc(f.auteur_role||'')+' · '+esc(f.date||'')+'</span></div><span class="forum-reply-count">'+(f.reponses||0)+' réponse'+(f.reponses===1?'':'s')+'</span></header>'+
    '<div class="forum-question">'+esc(f.question)+'</div>'+(tags?'<div class="forum-tags">'+tags+'</div>':'')+'<div class="forum-replies">'+(replies||'<p class="forum-no-replies">Pas encore de réponse. Soyez le premier à contribuer.</p>')+'</div>'+
    '<form class="forum-reply-form" data-med-forum-reply="'+f.id+'"><input name="reponse" maxlength="8000" required placeholder="Écrire une réponse…"><button class="btn sm solid" type="submit"><i data-lucide="send"></i>Répondre</button></form></article>';}
MI.registerRenderer('forum',renderMedForum);

/* ---------- Enregistrements ---------- */
MI.registerRenderer('visio',      renderVisio);
MI.registerRenderer('profil',     renderProfil);
MI.registerRenderer('formation',  renderFeed);
