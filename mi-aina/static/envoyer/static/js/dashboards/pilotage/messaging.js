/* ================================================================
   MI-AINA — Pilotage · messagerie inter-rôles, publications & forum
   Fichier séparé : ne redéclare aucune constante de pilotage.js
   (DB, esc, post, csrf, ROLE_META restent définis là-bas).
   Règle : apostrophe TYPOGRAPHIQUE (') dans les textes FR.
   ================================================================ */
const PURLS = Object.assign({
  fils:          '/messaging/fils/',
  fil_create:    '/messaging/fils/creer/',
  fils_annuaire: '/messaging/fils/annuaire/',
  fil_messages:  '/messaging/fils/<FIL>/messages/',
  fil_send:      '/messaging/fils/<FIL>/send/',
  fil_delete:    '/messaging/fils/message/<ID>/delete/',
  pub_feed:      '/publications/feed/',
  pub_publish:   '/publications/publish/',
  forum_list:    '/formation/forum/',
  forum_create:  '/formation/forum/creer/',
  forum_reply:   '/formation/forum/<ID>/repondre/',
}, DB.urls || {});

/* ================================================================
   1. PUBLICATIONS — le pilotage lit le feed et publie à son tour
   ================================================================ */
const PUB_META = {
  image:    {icon:'image',          lbl:'IMAGE',      col:'#7254A3'},
  texte:    {icon:'text',           lbl:'TEXTE',      col:'#007E3A'},
  video:    {icon:'play',           lbl:'VIDÉO',      col:'#C1272D'},
  pdf:      {icon:'file-text',      lbl:'GUIDE PDF',  col:'#9A6A1F'},
  protocole:{icon:'clipboard-list', lbl:'PROTOCOLE',  col:'#1C4030'},
};
let pubFilter = 'TOUT';
let pubsFeedLoaded = false;
const selectedDestinataires = new Set();
const pubFile = $('#pubFile');
if(pubFile) pubFile.addEventListener('change', ()=>{
  const label = $('#pubFileLabel');
  if(label) label.textContent = pubFile.files[0]?.name || 'Joindre un média';
});

function pubCard(p){
  const t = PUB_META[p.type] || PUB_META.texte;
  const auteur = (p.auteur_role_code === 'MEDECIN' ? 'Dr ' : '') + (p.auteur || '—');
  const ext = (p.fichier_nom||p.fichier_url||'').split('?')[0].split('.').pop().toLowerCase();
  const image = p.fichier_url && (p.type==='image'||['png','jpg','jpeg','gif','webp'].includes(ext));
  const video = p.fichier_url && (p.type==='video'||['mp4','webm','ogv','mov'].includes(ext));
  const pdf = p.fichier_url && (p.type==='pdf'||ext==='pdf');
  const media = image
    ? '<img class="pub-media-image" src="'+esc(p.fichier_url)+'" alt="'+esc(p.titre)+'" loading="lazy">'
    : video ? '<video class="pub-media-video" controls preload="metadata"><source src="'+esc(p.fichier_url)+'"></video>'
    : pdf ? '<a class="btn sm ghost" style="margin-top:12px" href="'+esc(p.fichier_url)+'" target="_blank" rel="noopener"><i data-lucide="file-text"></i>Ouvrir le PDF · '+esc(p.fichier_nom||'Document')+'</a>'
    : p.fichier_url ? '<a class="btn sm ghost" style="margin-top:12px" href="'+esc(p.fichier_url)+'" target="_blank" rel="noopener"><i data-lucide="paperclip"></i>'+esc(p.fichier_nom||'Ouvrir le fichier')+'</a>' : '';
  const avatar = p.auteur_photo
    ? '<img src="'+esc(p.auteur_photo)+'" alt="" style="width:34px;height:34px;object-fit:cover;border-radius:50%">'
    : '<span class="p-av n" style="width:34px;height:34px">'+esc((p.auteur_prenom||p.auteur||'MI').slice(0,1).toUpperCase())+'</span>';
  return '<article class="card pub-card" style="cursor:default">'+
    '<div style="display:flex;gap:10px;align-items:center">'+avatar+'<div style="min-width:0"><b style="font-size:12.5px">'+esc(auteur)+'</b><div style="font-size:10.5px;color:var(--ink-50)">'+esc(p.created||'')+'</div></div></div>'+
    '<div style="margin-top:12px"><span class="mono" style="font-size:9px;letter-spacing:.8px;color:'+t.col+';background:'+t.col+'14;padding:3px 8px;border-radius:999px">'+t.lbl+'</span></div>'+
    '<h3 style="font-size:16px;margin:10px 0 5px">'+esc(p.titre)+'</h3>'+
    '<p style="font-size:13px;color:var(--ink-70);line-height:1.6;white-space:pre-line">'+esc(p.resume)+'</p>'+media+
    '<div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap;align-items:center">'+
      '<span style="font-size:10.5px;color:var(--ink-50)">'+esc(p.auteur_role||'—')+'</span>'+
      '<span style="margin-left:auto;display:flex;gap:12px;font-size:10.5px;color:var(--ink-50)">'+
        '<span style="display:flex;align-items:center;gap:4px"><i data-lucide="eye" style="width:12px;height:12px"></i>'+(p.vues||0)+'</span>'+
        (p.epingle?'<span style="display:flex;align-items:center;gap:4px;color:var(--mg-green)"><i data-lucide="pin" style="width:12px;height:12px"></i>épinglé</span>':'')+
      '</span>'+(p.fichier_url?'<a class="btn sm ghost" href="'+esc(p.fichier_url)+'" target="_blank" rel="noopener"><i data-lucide="paperclip"></i>'+esc(p.fichier_nom||'Ouvrir le média')+'</a>':'')+
      (!p.lu?'<button class="btn sm ghost" data-pub-lu="'+p.id+'"><i data-lucide="check"></i>Marquer comme lu</button>':'')+
      '</div></article>';
}

function renderPubs(){
  const box = $('#pubFeed'); if(!box) return;
  if(!pubsFeedLoaded){
    pubsFeedLoaded = true;
    fetch(PURLS.pub_feed, {credentials:'same-origin'})
      .then(r=>r.json())
      .then(res=>{
        if(res.ok && Array.isArray(res.items)){
          DB.pubs = res.items;
          renderPubs();
        }
      })
      .catch(()=>{});
  }
  const items = (DB.pubs||[]).filter(p=>pubFilter==='TOUT'||p.type===pubFilter);
  MI.setBadge('publications', (DB.pubs||[]).filter(p=>!p.lu).length);
  const sub = $('#feedSub');
  if(sub) sub.textContent = items.length+' publication'+(items.length>1?'s':'')+' · émises par les médecins et le pilotage';
  const ff = $('#feedFilters');
  if(ff){
    ff.innerHTML = [['TOUT','Tout'],['texte','Textes'],['image','Images'],['video','Vidéos'],['pdf','Guides'],['protocole','Protocoles']]
      .map(([k,l])=>'<button class="pill '+(pubFilter===k?'on':'')+'" data-pf="'+k+'" style="font-size:10px;padding:4px 11px">'+l+'</button>').join('');
    ff.querySelectorAll('[data-pf]').forEach(b=>b.onclick=()=>{ pubFilter=b.dataset.pf; renderPubs(); });
  }
  box.innerHTML = items.length ? items.map(pubCard).join('')
    : '<div class="empty" style="padding:34px"><div class="empty-ic"><i data-lucide="megaphone"></i></div>'+
      '<h3 style="font-size:18px">Aucune publication</h3>'+
      '<p>Les protocoles et guides publiés par les médecins apparaîtront ici — vous pouvez aussi publier le vôtre ci-dessus.</p></div>';
  MI.refreshIcons();
  box.querySelectorAll('[data-pub-lu]').forEach(b=>b.onclick=()=>{
    const p = DB.pubs.find(x=>String(x.id)===String(b.dataset.pubLu)); if(!p) return;
    p.lu = true; MI.setBadge('publications', DB.pubs.filter(x=>!x.lu).length); renderPubs();
    post(PURLS.pub_lu.replace('<ID>', p.id), {}).catch(()=>{});
  });

  const form = $('#pubForm');
  if(form && !form._bound){
    form._bound = true;
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const titre = $('#pubTitle').value.trim(), resume = $('#pubDesc').value.trim();
      if(!titre || !resume){ MI.toast('Titre et contenu sont obligatoires.','error'); return; }
      const body = new FormData();
      body.append('type', $('#pubType').value); body.append('titre', titre); body.append('resume', resume);
      const file = $('#pubFile')?.files[0]; if(file) body.append('fichier', file);
      fetch(PURLS.pub_publish, {method:'POST', headers:{'X-CSRFToken':csrf}, body})
      .then(r=>r.json()).then(res=>{
        if(!res.ok){ MI.toast(res.erreur||'Publication impossible.','error'); return; }
        DB.pubs.unshift(res.publication);
        e.target.reset();
        if($('#pubFileLabel')) $('#pubFileLabel').textContent='Joindre un média';
        pubFilter='TOUT'; renderPubs();
        MI.toast('Publié — « '+res.publication.titre+' » est poussé vers les terminaux des agents et des médecins.','success');
      }).catch(()=>MI.toast('Échec de l’envoi du fichier. Vérifiez la connexion et réessayez.','error'));
    });
  }
}
MI.registerRenderer('publications', renderPubs);

/* ================================================================
   2. FORUM MÉDICAL — lecture des sujets des médecins + réponse
   ================================================================ */
function forumAvatar(user, role){
  return user?.auteur_photo?'<img class="forum-avatar" src="'+esc(user.auteur_photo)+'" alt="">':
    '<span class="forum-avatar forum-avatar-fallback '+(role==='MEDECIN'?'doctor':role==='PILOTAGE'?'pilot':'agent')+'">'+esc((user?.auteur||'?').trim().slice(0,1).toUpperCase())+'</span>';
}
function forumRow(f){
  const tags = (f.tags||'').split(',').filter(Boolean)
    .map(t=>'<span class="f-tag">'+esc(t.trim())+'</span>').join('');
  const reps = (f.reponses_list||[]).map(r=>
    '<article class="forum-reply">'+forumAvatar(r,r.auteur_role_code)+'<div class="forum-reply-copy"><div><b>'+esc(r.auteur)+'</b><span>'+esc(r.auteur_role||'—')+' · '+esc(r.date||'')+'</span></div><p>'+esc(r.reponse)+'</p></div></article>').join('');
  const avatar=forumAvatar(f,f.auteur_role_code);
  return '<article class="card forum-card" data-post="'+f.id+'"><header class="forum-post-head">'+avatar+
    '<div class="forum-post-by"><b>'+esc(f.auteur)+'</b><span>'+esc(f.auteur_role||'—')+' · '+esc(f.date||'')+'</span></div>'+
    '<span class="forum-reply-count">'+(f.reponses||0)+' réponse'+(f.reponses===1?'':'s')+'</span></header>'+
    '<div class="forum-question">'+esc(f.question)+'</div>'+(tags?'<div class="forum-tags">'+tags+'</div>':'')+
    '<div class="forum-replies">'+(reps||'<p class="forum-no-replies">Pas encore de réponse.</p>')+'</div>'+
    '<div class="forum-reply-form"><input class="f-reply" data-reply="'+f.id+'" maxlength="8000" placeholder="Répondre à ce sujet…">'+
    '<button class="btn sm solid" data-send="'+f.id+'"><i data-lucide="send"></i>Répondre</button></div></article>';
}

function renderForum(){
  const box = $('#forumBox'); if(!box) return;
  const items=DB.forum||[];
  const discussions=items.length?items.map(forumRow).join(''):
    '<div class="empty"><div class="empty-ic"><i data-lucide="messages-square"></i></div><h3>Aucun sujet</h3><p>Ouvrez une discussion pour commencer.</p></div>';
  box.innerHTML='<div class="forum-feed-head"><b>Discussions</b><span>'+items.length+' sujet'+(items.length===1?'':'s')+'</span></div>'+
    '<div class="forum-feed">'+discussions+'</div>';
  MI.refreshIcons();

  box.querySelectorAll('[data-send]').forEach(b=>b.onclick=()=>{
    const inp = box.querySelector('[data-reply="'+b.dataset.send+'"]');
    const txt = (inp && inp.value || '').trim();
    if(!txt){ MI.toast('Écrivez votre réponse.','error'); return; }
    b.disabled=true;
    post(PURLS.forum_reply.replace('<ID>', b.dataset.send), {reponse:txt}).then(res=>{
      if(!res.ok){ b.disabled=false;MI.toast(res.erreur||'Réponse impossible.','error'); return; }
      const i = DB.forum.findIndex(x=>String(x.id)===String(b.dataset.send));
      if(i > -1) DB.forum[i] = res.post;
      renderForum();
      MI.toast('Réponse publiée sur le forum médical.','success');
    }).catch(()=>{b.disabled=false;MI.toast('Réseau indisponible — réessayez.','error');});
  });

  const form = $('#forumForm');
  if(form && !form._bound){
    form._bound = true;
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const question = $('#forumQ').value.trim();
      if(question.length < 8){ MI.toast('Formulez la question en 8 caractères minimum.','error'); return; }
      post(PURLS.forum_create, {question, tags:$('#forumTags').value.trim()}).then(res=>{
        if(!res.ok){ MI.toast(res.erreur||'Publication impossible.','error'); return; }
        DB.forum.unshift(res.post); e.target.reset(); renderForum();
        MI.toast('Sujet ouvert — les utilisateurs autorisés sont notifiés.','success');
      });
    });
  }
}
MI.registerRenderer('forum', renderForum);

/* ================================================================
   3. MESSAGERIE INTER-RÔLES (fils à participants)
   ================================================================ */
let curFil = null, filFile = null;
const FIL_QUEUE_KEY = 'mi-aina-message-queue';

function readFilQueue(){
  try { return JSON.parse(localStorage.getItem(FIL_QUEUE_KEY) || '[]'); }
  catch(e){ return []; }
}

function writeFilQueue(items){
  try { localStorage.setItem(FIL_QUEUE_KEY, JSON.stringify(items)); }
  catch(e) {}
}

function queueFilMessage(filId, texte){
  const queue = readFilQueue();
  queue.push({fil: String(filId), texte, created: Date.now()});
  writeFilQueue(queue);
}

function sendFilMessage(filId, texte){
  const fd = new FormData();
  fd.append('texte', texte);
  return fetch(PURLS.fil_send.replace('<FIL>', filId), {
    method:'POST', headers:{'X-CSRFToken':csrf}, body:fd
  }).then(r=>r.json());
}

function flushFilQueue(){
  const queue = readFilQueue();
  if(!queue.length) return;
  Promise.all(queue.map(item=>sendFilMessage(item.fil, item.texte)
    .then(res=>res.ok ? item : null)
    .catch(()=>null)))
    .then(done=>writeFilQueue(queue.filter((item, i)=>!done[i])));
}

function filBubble(m){
  if(m.supprime)
    return '<div class="msg '+(m.me?'me':'them')+'" style="font-style:italic;opacity:.55">Message supprimé<time>'+m.time+'</time></div>';
  let inner = '';
  if(m.fichier){
    inner += m.is_image
      ? '<img src="'+m.fichier+'" style="max-width:100%;border-radius:9px;margin:4px 0" alt="'+esc(m.nom_fichier)+'">'
      : '<div style="display:flex;align-items:center;gap:8px;background:rgba(30,42,34,.08);border-radius:8px;padding:7px 10px;margin:4px 0">'+
        '<i data-lucide="file" style="width:15px;height:15px"></i><a href="'+m.fichier+'" target="_blank" style="color:inherit;font-size:12px">'+esc(m.nom_fichier)+'</a></div>';
  }
  if(m.texte) inner += '<span>'+esc(m.texte)+'</span>';
  inner += '<time>'+m.time+'</time>';
  const del = m.me ? '<button class="msg-del" data-del="'+m.id+'" title="Supprimer"><i data-lucide="trash-2" style="width:11px;height:11px"></i></button>' : '';
  return '<div class="msg '+(m.me?'me':'them')+'" data-msg="'+m.id+'" style="position:relative">'+inner+del+'</div>';
}

function renderFils(){
  const box = $('#threadList'); if(!box) return;
  const sub = $('#thSub');
  if(sub) sub.textContent = (DB.fils||[]).length+' conversation'+((DB.fils||[]).length>1?'s':'')+' inter-rôles';
  box.innerHTML = (DB.fils||[]).length ? DB.fils.map(f=>
    '<button class="thread '+(String(curFil)===String(f.id)?'sel':'')+'" data-fil="'+f.id+'">'+
      '<span class="p-av g">'+(f.photo?'<img src="'+esc(f.photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':esc(f.initiales||'MI'))+'</span>'+
      '<span class="who"><b>'+esc(f.nom)+'</b><span>'+esc(f.dernier_message||'—')+'</span></span>'+
      '<span class="meta"><time>'+esc(f.dernier_temps||'')+'</time>'+
      (f.non_lus?'<span class="unread" style="margin-top:5px">'+f.non_lus+'</span>':'')+'</span></button>').join('')
    : '<p style="font-size:12px;color:var(--ink-50);text-align:center;padding:16px">Aucune conversation — ouvrez-en une avec « Nouvelle » (médecin, agent ou pilotage).</p>';
  MI.refreshIcons();
  box.querySelectorAll('[data-fil]').forEach(b=>b.onclick=()=>openFil(b.dataset.fil));
}

function chargerFils(){
  return fetch(PURLS.fils, {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json()).then(d=>{
      if(d.ok){ DB.fils = d.items; MI.setBadge('messagerie', DB.fils.reduce((n,f)=>n+(f.non_lus||0),0)); }
      renderFils(); return d;
    })
    .catch(()=>renderFils());
}

function openFil(id){
  curFil = id;
  renderFils();
  fetch(PURLS.fil_messages.replace('<FIL>', id), {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json()).then(d=>{
      const box = $('#chatMsgs'); if(!box) return;
      if(!d.ok){ box.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--mg-red);padding:20px">'+esc(d.erreur||'Conversation inaccessible.')+'</p>'; return; }
      box.innerHTML = d.items.length ? d.items.map(filBubble).join('')
        : '<p style="text-align:center;font-size:12px;color:var(--ink-50);padding:20px">Aucun message — démarrez la conversation 👋</p>';
      const selected = (DB.fils||[]).find(f=>String(f.id)===String(id));
      if(selected){
        const name = $('#chatNom'), avatar = $('#chatAv'), role = $('#chatRole');
        if(name) name.textContent = selected.nom;
        if(avatar) avatar.innerHTML = selected.photo
          ? '<img src="'+esc(selected.photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
          : esc(selected.initiales||'MI');
        if(role) role.textContent = (selected.participants||[]).map(p=>p.role_label).filter(Boolean).join(' · ');
      }
      const card = $('#chatCard'); if(card) card.dataset.thread = id;
      MI.refreshIcons(); bindFilActions(); box.scrollTop = box.scrollHeight; chargerFils();
    }).catch(()=>{});
}

function actualiserFilOuvert(){
  if(!curFil) return;
  const id = curFil;
  fetch(PURLS.fil_messages.replace('<FIL>', id), {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json()).then(d=>{
      if(!d.ok || String(curFil)!==String(id)) return;
      const box = $('#chatMsgs'); if(!box) return;
      const presDuBas = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      box.innerHTML = d.items.length ? d.items.map(filBubble).join('')
        : '<p style="text-align:center;font-size:12px;color:var(--ink-50);padding:20px">Aucun message — démarrez la conversation 👋</p>';
      MI.refreshIcons(); bindFilActions();
      if(presDuBas) box.scrollTop = box.scrollHeight;
      chargerFils();
    }).catch(()=>{});
}

function bindFilActions(){
  $$('#chatMsgs [data-del]').forEach(b=>b.onclick=()=>{
    fetch(PURLS.fil_delete.replace('<ID>', b.dataset.del), {method:'POST', headers:{'X-CSRFToken':csrf}})
      .then(r=>r.json()).then(res=>{
        if(!res.ok){ MI.toast(res.erreur||'Suppression impossible.','error'); return; }
        const el = document.querySelector('[data-msg="'+b.dataset.del+'"]');
        if(el) el.outerHTML = '<div class="msg me" style="font-style:italic;opacity:.55">Message supprimé</div>';
        MI.toast('Message supprimé — « Message supprimé » visible chez les autres participants.','success');
      });
  });
}

function annuaireFils(q){
  const params = new URLSearchParams({q:q||''});
  [['region','convRegion'],['district','convDistrict'],['csb','convCsb'],['hopital','convHospital']]
    .forEach(([key,id])=>{ const value = $('#'+id)?.value.trim(); if(value) params.set(key,value); });
  fetch(PURLS.fils_annuaire + '?' + params.toString(), {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json()).then(d=>{
      const box = $('#convResults'); if(!box) return;
      box.innerHTML = d.ok && d.items.length ? d.items.map(u=>
        '<div class="reg-row" data-dest="'+u.id+'" style="cursor:pointer">'+
        '<input type="checkbox" data-dest-check="'+u.id+'" '+(selectedDestinataires.has(String(u.id))?'checked':'')+' aria-label="Sélectionner '+esc(u.nom)+'" style="margin-right:4px">'+
        '<span class="p-av '+(u.role==='MEDECIN'?'r':u.role==='PILOTAGE'?'n':'g')+'">'+(u.photo?'<img src="'+esc(u.photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':esc(u.initiales))+'</span>'+
        '<span class="who"><b>'+esc(u.nom)+'</b><span>'+esc(u.role_label)+' · '+esc(u.structure)+' · '+esc(u.region)+' · '+esc(u.district||'National')+'</span></span>'+
        '<i data-lucide="message-circle" style="width:15px;height:15px;color:var(--mg-green)"></i></div>').join('')
        : '<p style="font-size:12px;color:var(--ink-50);text-align:center;padding:10px">Aucun correspondant trouvé.</p>';
      MI.refreshIcons();
      const groupBtn = $('#convGroupBtn');
      const updateGroupButton = ()=>{ if(groupBtn){ groupBtn.hidden = selectedDestinataires.size < 2; } };
      box.querySelectorAll('[data-dest-check]').forEach(check=>check.onchange=()=>{
        if(check.checked) selectedDestinataires.add(String(check.dataset.destCheck));
        else selectedDestinataires.delete(String(check.dataset.destCheck));
        updateGroupButton();
      });
      box.querySelectorAll('[data-dest]').forEach(b=>b.onclick=(event)=>{
        if(event && event.target && event.target.matches('[data-dest-check]')) return;
        post(PURLS.fil_create, {dest:b.dataset.dest}).then(res=>{
          if(!res.ok){ MI.toast(res.erreur||'Ouverture impossible.','error'); return; }
          $('#convSearch').hidden = true;
          const i = DB.fils.findIndex(x=>String(x.id)===String(res.fil.id));
          if(i > -1) DB.fils[i] = res.fil; else DB.fils.unshift(res.fil);
          renderFils(); openFil(res.fil.id);
          MI.toast('Conversation ouverte avec '+res.fil.nom+'.','success');
        });
      });
      updateGroupButton();
    }).catch(()=>{});
}

const groupButton = $('#convGroupBtn');
if(groupButton) groupButton.onclick = ()=>{
  const dests = Array.from(selectedDestinataires);
  if(dests.length < 2) return;
  post(PURLS.fil_create, {destinataires:dests}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Ouverture impossible.','error'); return; }
    selectedDestinataires.clear(); groupButton.hidden = true;
    $('#convSearch').hidden = true;
    const i = DB.fils.findIndex(x=>String(x.id)===String(res.fil.id));
    if(i > -1) DB.fils[i] = res.fil; else DB.fils.unshift(res.fil);
    renderFils(); openFil(res.fil.id);
    MI.toast('Conversation de groupe ouverte.','success');
  });
};

function bindFils(){
  const form = $('#chatForm');
  if(form && !form._bound){
    form._bound = true;
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const input = $('#chatTxt'); if(!input) return;
      const txt = input.value.trim();
      if(!txt && !filFile) return;
      if(!curFil){ MI.toast('Choisissez d\u2019abord une conversation.','error'); return; }
      const pendingFile = filFile;
      const fd = new FormData();
      fd.append('texte', txt);
      if(pendingFile) fd.append('piece', pendingFile);
      input.value=''; filFile=null;
      const bar = $('#fileBar'); if(bar) bar.hidden = true;
      const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      const box = $('#chatMsgs');
      if(box){
        box.insertAdjacentHTML('beforeend',
          '<div class="msg me" style="position:relative">'+(txt?'<span>'+esc(txt)+'</span>':'')+
          '<time>'+now+'</time></div>');
        box.scrollTop = box.scrollHeight;
      }
      const sendRequest = pendingFile
        ? fetch(PURLS.fil_send.replace('<FIL>', curFil), {method:'POST', headers:{'X-CSRFToken':csrf}, body:fd})
        : sendFilMessage(curFil, txt);
      sendRequest
        .then(r=>r instanceof Response ? r.json() : r).then(res=>{
          if(!res.ok){ MI.toast(res.erreur||'Envoi impossible.','error'); return; }
          MI.toast('Message envoyé — les autres participants sont notifiés.','success');
          chargerFils();
        }).catch(()=>{
          if(!pendingFile) queueFilMessage(curFil, txt);
        });
    });
  }
  const txt = $('#chatTxt');
  if(txt && !txt._bound){
    txt._bound = true;
    txt.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(form) form.requestSubmit(); } });
  }
  const fi = $('#fileInput'), fb = $('#fileBtn');
  if(fb && fi && !fb._bound){
    fb._bound = true;
    fb.onclick = ()=>fi.click();
    fi.addEventListener('change', ()=>{
      filFile = fi.files[0] || null;
      const bar = $('#fileBar');
      if(bar){ bar.hidden = !filFile;
        if(filFile) $('#filePreview').textContent = filFile.name + ' · ' + (filFile.size/1048576).toFixed(2) + ' Mo'; }
    });
  }
  const fc = $('#fileCancel');
  if(fc) fc.onclick = ()=>{ filFile=null; const b=$('#fileBar'); if(b) b.hidden=true; };
  const nb = $('#newConvBtn');
  if(nb && !nb._bound){ nb._bound = true; nb.onclick = ()=>{ $('#convSearch').hidden = false; $('#convQ').focus(); annuaireFils(''); }; }
  const cc = $('#convSearchClose');
  if(cc) cc.onclick = ()=>$('#convSearch').hidden = true;
  const cq = $('#convQ');
  if(cq && !cq._bound){
    cq._bound = true;
    let tmo = null;
    cq.addEventListener('input', ()=>{ clearTimeout(tmo); tmo = setTimeout(()=>annuaireFils(cq.value.trim()), 300); });
  }
  ['convRegion','convDistrict','convCsb','convHospital'].forEach(id=>{
    const field = $('#'+id);
    if(field && !field._bound){ field._bound=true; field.addEventListener('input',()=>annuaireFils($('#convQ')?.value.trim()||'')); }
  });
  const rs = $('#recStop');
  if(rs) rs.onclick = ()=>MI.toast('Note vocale réservée aux terminaux terrain — utilisez le texte ou une pièce jointe.','info');
  const vb = $('#voiceBtn');
  if(vb) vb.onclick = ()=>MI.toast('Note vocale réservée aux terminaux terrain — utilisez le texte ou une pièce jointe.','info');

  bindFilActions();
  flushFilQueue();
  window.addEventListener('online', flushFilQueue, {once:false});
  if(!window._miFilPoll){
    window._miFilPoll = setInterval(()=>{
      if(document.visibilityState!=='visible' || document.querySelector('#view-messagerie')?.hidden) return;
      chargerFils(); actualiserFilOuvert();
    }, 12000);
  }
  if(curFil) openFil(curFil);
  else chargerFils().then(()=>{ if((DB.fils||[]).length) openFil(DB.fils[0].id); });
}
MI.registerRenderer('messagerie', bindFils);
