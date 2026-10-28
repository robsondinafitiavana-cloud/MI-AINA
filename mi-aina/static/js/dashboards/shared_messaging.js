/* Messagerie partagée: Fil/MessageFil, pour les trois rôles. */
const PURLS = Object.assign({
  fils:'/messaging/fils/', fil_create:'/messaging/fils/creer/',
  fils_annuaire:'/messaging/fils/annuaire/',
  fil_messages:'/messaging/fils/<FIL>/messages/',
  fil_send:'/messaging/fils/<FIL>/send/',
  fil_delete:'/messaging/fils/message/<ID>/delete/'
}, DB.urls || {});
DB.fils = DB.fils || [];
const selectedDestinataires = new Set();
/* ================================================================
   3. MESSAGERIE INTER-RÔLES (fils à participants)
   ================================================================ */
let curFil = null, filFile = null;
const msgEl = id => document.querySelector('#view-messagerie #' + id);
const filAvatar = (photo, initiales) => photo
  ? '<img src="'+esc(photo)+'" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%">'
  : esc(initiales||'MI');
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
      '<span class="p-av g">'+filAvatar(f.photo,f.initiales)+'</span>'+
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
      const box = msgEl('chatMsgs'); if(!box) return;
      if(!d.ok){ box.innerHTML = '<p style="text-align:center;font-size:12px;color:var(--mg-red);padding:20px">'+esc(d.erreur||'Conversation inaccessible.')+'</p>'; return; }
      box.innerHTML = d.items.length ? d.items.map(filBubble).join('')
        : '<p style="text-align:center;font-size:12px;color:var(--ink-50);padding:20px">Aucun message — démarrez la conversation 👋</p>';
      const card = msgEl('chatCard'); if(card) card.dataset.thread = id;
      const selected = (DB.fils||[]).find(f=>String(f.id)===String(id));
      if(selected){
        const name = msgEl('chatNom'), avatar = msgEl('chatAv'), role = msgEl('chatRole');
        if(name) name.textContent = selected.nom;
        if(avatar) avatar.innerHTML = filAvatar(selected.photo,selected.initiales);
        if(role) role.textContent = (selected.participants||[]).map(p=>p.role_label).filter(Boolean).join(' · ');
      }
      MI.refreshIcons(); bindFilActions(); box.scrollTop = box.scrollHeight;
      chargerFils();
    }).catch(()=>{});
}

function actualiserFilOuvert(){
  if(!curFil) return;
  const id = curFil;
  fetch(PURLS.fil_messages.replace('<FIL>', id), {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json()).then(d=>{
      if(!d.ok || String(curFil)!==String(id)) return;
      const box = msgEl('chatMsgs'); if(!box) return;
      const presDuBas = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
      box.innerHTML = d.items.length ? d.items.map(filBubble).join('')
        : '<p style="text-align:center;font-size:12px;color:var(--ink-50);padding:20px">Aucun message — démarrez la conversation 👋</p>';
      MI.refreshIcons(); bindFilActions();
      if(presDuBas) box.scrollTop = box.scrollHeight;
      chargerFils();
    }).catch(()=>{});
}

function bindFilActions(){
  document.querySelectorAll('#view-messagerie #chatMsgs [data-del]').forEach(b=>b.onclick=()=>{
    fetch(PURLS.fil_delete.replace('<ID>', b.dataset.del), {method:'POST', headers:{'X-CSRFToken':csrf}})
      .then(r=>r.json()).then(res=>{
        if(!res.ok){ MI.toast(res.erreur||'Suppression impossible.','error'); return; }
        const el = document.querySelector('#view-messagerie [data-msg="'+b.dataset.del+'"]');
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
        '<span class="p-av '+(u.role==='MEDECIN'?'r':u.role==='PILOTAGE'?'n':'g')+'">'+filAvatar(u.photo,u.initiales)+'</span>'+ 
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
  const form = msgEl('chatForm');
  if(form && !form._bound){
    form._bound = true;
    form.addEventListener('submit', e=>{
      e.preventDefault();
      const input = msgEl('chatTxt'); if(!input) return;
      const txt = input.value.trim();
      if(!txt && !filFile) return;
      if(!curFil){ MI.toast('Choisissez d\u2019abord une conversation.','error'); return; }
      const pendingFile = filFile;
      const fd = new FormData();
      fd.append('texte', txt);
      if(pendingFile) fd.append('piece', pendingFile);
      input.value=''; filFile=null;
      const bar = msgEl('fileBar'); if(bar) bar.hidden = true;
      const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
      const box = msgEl('chatMsgs');
      if(box){
        box.insertAdjacentHTML('beforeend',
          '<div class="msg me" style="position:relative">'+(txt?'<span>'+esc(txt)+'</span>':'')+
          '<time>'+now+'</time></div>');
        box.scrollTop = box.scrollHeight;
      }
      const sendingFil = curFil;
      const sendRequest = pendingFile
        ? fetch(PURLS.fil_send.replace('<FIL>', sendingFil), {method:'POST', headers:{'X-CSRFToken':csrf}, body:fd})
        : sendFilMessage(sendingFil, txt);
      sendRequest
        .then(r=>r instanceof Response ? r.json() : r).then(res=>{
          if(!res.ok){ MI.toast(res.erreur||'Envoi impossible.','error'); return; }
          MI.toast('Message envoyé — les autres participants sont notifiés.','success');
          chargerFils().then(()=>{ if(String(curFil)===String(sendingFil)) openFil(sendingFil); });
        }).catch(()=>{
          if(String(curFil)===String(sendingFil)) openFil(sendingFil);
          if(!pendingFile) queueFilMessage(sendingFil, txt);
        });
    });
  }
  const txt = msgEl('chatTxt');
  if(txt && !txt._bound){
    txt._bound = true;
    txt.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(form) form.requestSubmit(); } });
  }
  const fi = msgEl('fileInput'), fb = msgEl('fileBtn');
  if(fb && fi && !fb._bound){
    fb._bound = true;
    fb.onclick = ()=>fi.click();
    fi.addEventListener('change', ()=>{
      filFile = fi.files[0] || null;
      const bar = msgEl('fileBar');
      if(bar){ bar.hidden = !filFile;
        if(filFile) msgEl('filePreview').textContent = filFile.name + ' · ' + (filFile.size/1048576).toFixed(2) + ' Mo'; }
    });
  }
  const fc = msgEl('fileCancel');
  if(fc) fc.onclick = ()=>{ filFile=null; const b=msgEl('fileBar'); if(b) b.hidden=true; };
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
  const rs = msgEl('recStop');
  if(rs) rs.onclick = ()=>MI.toast('Note vocale réservée aux terminaux terrain — utilisez le texte ou une pièce jointe.','info');
  const vb = msgEl('voiceBtn');
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
  const requestedFil = window.MI_FIL_TO_OPEN;
  if(requestedFil){
    window.MI_FIL_TO_OPEN = null;
    curFil = String(requestedFil);
    chargerFils().then(()=>openFil(curFil));
  }
  else if(curFil) openFil(curFil);
  else chargerFils().then(()=>{ if((DB.fils||[]).length) openFil(DB.fils[0].id); });
}
MI.registerRenderer('messagerie', bindFils);
