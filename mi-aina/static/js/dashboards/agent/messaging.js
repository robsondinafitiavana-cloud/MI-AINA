/* ================================================================
   MI-AINA — Agent · messagerie sociale + AINA Assistant IA
   (fichier partagé : fonctionne aussi côté Médecin)
   ================================================================ */
const MURLS = {
  list:   DB.urls.message_list  || '/messaging/<THREAD>/messages/',
  send:   DB.urls.message       || '/messaging/<THREAD>/send/',
  del:    DB.urls.msg_delete    || '/messaging/message/<ID>/delete/',
  create: DB.urls.msg_thread_create || '/messaging/thread/create/',
  docs:   DB.urls.tm_doctors    || '/telemedicine/doctors/',
  aina:   DB.urls.ia_send       || '/assistant/send/',
  aina_h: DB.urls.ia_history    || '/assistant/history/',
  aina_r: DB.urls.ia_reset      || '/assistant/reset/',
};

/* ================= CONVERSATIONS ================= */
let curThread = null, replyingTo = null, fileToSend = null;

function renderThreads(){
  const box = $('#threadList'); if(!box) return;
  box.innerHTML = (DB.threads||[]).length ? DB.threads.map(t=>{
    const sel = String(curThread)===String(t.id);
    return '<button class="thread '+(sel?'sel':'')+'" data-thread="'+t.id+'">'+
      '<span class="p-av '+(t.online?'g':'n')+'">'+esc(t.initiales||'DR')+'</span>'+
      '<span class="who"><b>'+esc(t.nom)+'</b><span>'+esc(t.dernier_message||'—')+'</span></span>'+
      '<span class="meta"><time>'+esc(t.dernier_temps||'')+'</time>'+
      (t.non_lus?'<span class="unread" style="margin-top:5px">'+t.non_lus+'</span>':'')+'</span></button>';
  }).join('')
  : '<p style="font-size:12px;color:var(--ink-50);text-align:center;padding:16px">Aucune conversation — cherchez un médecin avec « Nouvelle ».</p>';
  MI.refreshIcons();
  box.querySelectorAll('[data-thread]').forEach(b=>b.onclick=()=>openThread(b.dataset.thread));
}

/* ---------- Annuaire cherchable ---------- */
function openConvSearch(){
  $('#convSearch').hidden = false;
  $('#convQ').focus();
  searchDoctors('');
}
/* ---------- Annuaire cherchable : div cliquable (pas de button imbriqué) ---------- */
function searchDoctors(q){
  fetch(MURLS.docs + '?q=' + encodeURIComponent(q), {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json()).then(d=>{
      const box = $('#convResults'); if(!box) return;
      box.innerHTML = d.ok && d.items.length ? d.items.map(m=>
        '<div class="reg-row" data-mid="'+m.id+'" style="cursor:pointer">'+
        '<span class="p-av g">'+esc(m.initiales)+'</span>'+
        '<span class="who"><b>'+esc(m.nom)+'</b><span>'+esc(m.etablissement)+' · '+esc(m.region)+' · '+esc(m.district||'National')+'</span></span>'+
        '<i data-lucide="message-circle" style="width:15px;height:15px;color:var(--mg-green)"></i></div>').join('')
        : '<p style="font-size:12px;color:var(--ink-50);text-align:center;padding:10px">Aucun médecin trouvé.</p>';
      MI.refreshIcons();
      box.querySelectorAll('[data-mid]').forEach(b=>b.onclick=()=>createThread(b.dataset.mid));
    }).catch(()=>{});
}
function createThread(mid){
  post(MURLS.create, {medecin_id: mid}).then(res=>{
    if(!res.ok){ MI.toast(res.erreur||'Impossible.','error'); return; }
    $('#convSearch').hidden = true;
    /* Recharge la page des threads côté serveur : le plus simple = reload léger du contexte */
    location.reload();
  }).catch(()=>MI.toast('Erreur réseau.','error'));
}

/* ---------- Bulles : gestion propre du supprimé après F5 ---------- */
function msgBubble(m){
  if(m.supprime)
    return '<div class="msg '+(m.me?'me':'them')+'" style="font-style:italic;opacity:.55">Message supprimé<time>'+m.time+'</time></div>';
  let inner = '';
  if(m.reply){
    inner += '<div style="border-left:3px solid var(--mg-green);background:rgba(0,126,58,.06);'+
      'border-radius:6px;padding:5px 9px;margin-bottom:6px;font-size:11px;color:var(--ink-70)">'+
      esc(m.reply.texte)+'</div>';
  }
  if(m.audio){
    const w = Array.from({length:14},()=>Math.floor(6+Math.random()*16));
    inner += '<div style="display:flex;align-items:center;gap:9px"><button class="vplay"><i data-lucide="play"></i></button>'+
      '<span class="wave">'+w.map(h=>'<i style="height:'+h+'px"></i>').join('')+'</span>'+
      '<small>0\u2032'+String(m.duree%60).padStart(2,'0')+'</small></div>';
  }
  if(m.fichier){
    inner += m.is_image
      ? '<img src="'+m.fichier+'" style="max-width:100%;border-radius:9px;margin:4px 0" alt="'+esc(m.nom_fichier)+'">'
      : '<div style="display:flex;align-items:center;gap:8px;background:rgba(30,42,34,.08);border-radius:8px;padding:7px 10px;margin:4px 0">'+
        '<i data-lucide="file" style="width:15px;height:15px"></i><a href="'+m.fichier+'" target="_blank" style="color:inherit;font-size:12px">'+esc(m.nom_fichier)+'</a></div>';
  }
  if(m.texte) inner += '<span>'+esc(m.texte)+'</span>';
  inner += '<time>'+m.time+'</time>';
  const del = m.me
    ? '<button class="msg-del" data-del="'+m.id+'" title="Supprimer"><i data-lucide="trash-2" style="width:11px;height:11px"></i></button>' : '';
  return '<div class="msg '+(m.me?'me':'them')+'" data-msg="'+m.id+'" style="position:relative">'+inner+del+'</div>';
}

function openThread(id){
  curThread = id;
  renderThreads();
  fetch(MURLS.list.replace('<THREAD>', id), {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json()).then(d=>{
      const box = $('#chatMsgs'); if(!box) return;
      box.innerHTML = d.ok && d.items.length ? d.items.map(msgBubble).join('')
        : '<p style="text-align:center;font-size:12px;color:var(--ink-50);padding:20px">Aucun message — démarrez la conversation 👋</p>';
      MI.refreshIcons(); bindMsgActions(); box.scrollTop = box.scrollHeight;
    }).catch(()=>{});
  const card = $('#chatCard'); if(card) card.dataset.thread = id;
}

function appendMsg(html){
  const box = $('#chatMsgs'); if(!box) return;
  box.insertAdjacentHTML('beforeend', html);
  MI.refreshIcons(); bindMsgActions(); box.scrollTop = box.scrollHeight;
}
function bindMsgActions(){
  $$('#chatMsgs [data-del]').forEach(b=>b.onclick=()=>{
    const id = b.dataset.del;
    fetch(MURLS.del.replace('<ID>', id), {method:'POST', headers:{'X-CSRFToken':csrf}})
      .then(r=>r.json()).then(res=>{
        if(!res.ok){ MI.toast(res.erreur||'Impossible.','error'); return; }
        const b2 = document.querySelector('[data-msg="'+id+'"]');
        if(b2) b2.outerHTML = '<div class="msg me" style="font-style:italic;opacity:.55">Message supprimé</div>';
        MI.toast('Message supprimé — « Message supprimé » visible chez le destinataire.','success');
      });
  });
}

/* ---------- Envoi : texte + fichier + réponse citée ---------- */
function sendCurrent(){
  const input = $('#chatTxt'); if(!input) return;
  const txt = input.value.trim();
  if(!txt && !fileToSend){ return; }
  const fd = new FormData();
  fd.append('texte', txt);
  if(fileToSend) fd.append('piece', fileToSend);
  if(replyingTo) fd.append('reply_to', replyingTo);
  input.value=''; clearFileBar(); cancelReply();

  /* Bulle locale optimiste */
  const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  let local = '<div class="msg me" style="position:relative">';
  if(fileToSend){
    local += fileToSend.type.startsWith('image/')
      ? '<img src="'+URL.createObjectURL(fileToSend)+'" style="max-width:100%;border-radius:9px;margin:4px 0">'
      : '<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.12);border-radius:8px;padding:7px 10px;margin:4px 0"><i data-lucide="file" style="width:15px;height:15px"></i>'+esc(fileToSend.name)+'</div>';
  }
  if(txt) local += '<span>'+esc(txt)+'</span>';
  local += '<time>'+now+'</time></div>';
  appendMsg(local);

  fetch(MURLS.send.replace('<THREAD>', curThread), {method:'POST',
    headers:{'X-CSRFToken':csrf}, body:fd})
    .then(r=>r.json())
    .then(res=>{
      if(!res.ok){ MI.toast(res.erreur||'Envoi impossible.','error'); return; }
      MI.toast('Message envoyé — notification transmise au destinataire.','success');
    }).catch(()=>MI.toast('Réseau faible — le message partira à la synchro.','info'));
}

/* ---------- Barre fichier + réponse ---------- */
function setFileBar(f){
  fileToSend = f;
  const bar = $('#fileBar'); if(!bar) return;
  bar.hidden = !f;
  if(f) $('#filePreview').textContent = f.name + ' · ' + (f.size/1024/1024).toFixed(2) + ' Mo';
}
function cancelReply(){
  replyingTo = null;
  const bar = $('#replyBar'); if(bar) bar.hidden = true;
}
function clearFileBar(){
  fileToSend = null;
  const bar = $('#fileBar'); if(bar) bar.hidden = true;
  const inp = $('#fileInput'); if(inp) inp.value = '';
}

/* ================= AINA ASSISTANT (Gemini) ================= */
function renderAina(){
  const pre = $('#ainaMsgs'); if(!pre) return;
  fetch(MURLS.aina_h, {headers:{'X-CSRFToken':csrf}}).then(r=>r.json()).then(d=>{
    if(!d.ok) return;
    pre.innerHTML = d.items.length ? d.items.map(m=>{
      let inner = '';
      if(m.piece) inner += '<div style="display:flex;align-items:center;gap:8px;background:rgba(30,42,34,.08);border-radius:8px;padding:6px 10px;margin:4px 0;font-size:12px">'+
        '<i data-lucide="'+(m.is_image?'image':'file-text')+'" style="width:14px;height:14px"></i>'+esc(m.piece)+'</div>';
      if(m.texte) inner += '<span>'+esc(m.texte)+'</span>';
      inner += '<time>'+m.time+'</time>';
      return '<div class="msg '+m.role+'">'+inner+'</div>';
    }).join('') : pre.innerHTML;
    MI.refreshIcons(); pre.scrollTop = pre.scrollHeight;
  }).catch(()=>{});
}
function ainaSend(){
  const txt = $('#ainaTxt').value.trim();
  const f = window.__ainaFile || null;
  if(!txt && !f) return;
  const pre = $('#ainaMsgs');
  const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  let local = '<div class="msg me">';
  if(f) local += '<div style="font-size:11.5px;opacity:.8;margin-bottom:4px">📎 '+esc(f.name)+'</div>';
  if(txt) local += '<span>'+esc(txt)+'</span>';
  local += '<time>'+now+'</time></div>';
  appendAina(local);

  $('#ainaTxt').value = '';
  window.__ainaFile = null; $('#ainaFileBar').hidden = true;

  const thinking = document.createElement('div');
  thinking.className = 'msg them';
  thinking.innerHTML = '<div class="proc-dots"><i></i><i></i><i></i></div>';
  pre.appendChild(thinking); pre.scrollTop = pre.scrollHeight;

  const fd = new FormData();
  fd.append('texte', txt);
  if(f) fd.append('piece', f);
  fetch(MURLS.aina, {method:'POST', headers:{'X-CSRFToken':csrf}, body:fd})
    .then(r=>r.json()).then(d=>{
      thinking.remove();
      if(!d.ok){ appendAina('<div class="msg them" style="color:var(--mg-red)">'+esc(d.erreur||'Indisponible.')+'<time>'+now+'</time></div>'); return; }
      appendAina('<div class="msg them">'+esc(d.reponse).replace(/\n/g,'<br>')+'<time>'+d.time+'</time></div>');
      speak && speak(d.reponse.slice(0,150), 'fr');
    }).catch(()=>{
      thinking.remove();
      appendAina('<div class="msg them" style="color:var(--mg-red)">Erreur réseau.<time></time></div>');
    });
}
function appendAina(html){
  const box = $('#ainaMsgs'); if(!box) return;
  box.insertAdjacentHTML('beforeend', html);
  MI.refreshIcons(); box.scrollTop = box.scrollHeight;
}

/* ---------- Bindings globaux (une fois) ---------- */
let _mBound = false;
function bindMessaging(){
  if(_mBound) return; _mBound = true;

  renderThreads();

  const nb = $('#newConvBtn');
  if(nb) nb.onclick = openConvSearch;
  const cc = $('#convSearchClose');
  if(cc) cc.onclick = ()=>$('#convSearch').hidden = true;
  const cq = $('#convQ');
  if(cq){
    let tmo=null;
    cq.addEventListener('input', ()=>{ clearTimeout(tmo);
      tmo = setTimeout(()=>searchDoctors(cq.value.trim()), 300); });
  }
  const ab = $('#ainaBtn');
  if(ab) ab.onclick = ()=>MI.setView('aina');

  /* Chat existant */
  const card = $('#chatCard');
  if(card && card.dataset.thread) openThread(card.dataset.thread);
  else if(card){ const box=$('#chatMsgs'); if(box) box.innerHTML =
    '<p style="text-align:center;font-size:12px;color:var(--ink-50);padding:20px">Sélectionnez ou créez une conversation pour commencer.</p>'; }

  const form = $('#chatForm');
  if(form) form.addEventListener('submit', e=>{ e.preventDefault(); sendCurrent(); });
  const txt = $('#chatTxt');
  if(txt) txt.addEventListener('keydown', e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendCurrent(); } });

  const fi = $('#fileInput');
  const fb = $('#fileBtn');
  if(fb && fi){ fb.onclick = ()=>fi.click();
    fi.addEventListener('change', ()=>{ if(fi.files[0]) setFileBar(fi.files[0]); }); }
  const fc = $('#fileCancel');
  if(fc) fc.onclick = clearFileBar;

  const rc = $('#replyCancel');
  if(rc) rc.onclick = cancelReply;

  /* Voice note (démo : message vocal simulé attaché au thread) */
  const vb = $('#voiceBtn'); let _rInt=null, _rS=0;
  if(vb) vb.onclick = ()=>{
    const bar = $('#recBar'); if(!bar) return;
    _rS=0; bar.hidden=false;
    $('#chatForm').style.display='none';
    _rInt = setInterval(()=>{ _rS++;
      const t=$('#recTime'); if(t) t.textContent = Math.floor(_rS/60)+':'+String(_rS%60).padStart(2,'0');
    },1000);
  };
  const rs = $('#recStop');
  if(rs) rs.onclick = ()=>{
    clearInterval(_rInt);
    const bar = $('#recBar'); if(bar) bar.hidden=true;
    const form = $('#chatForm'); if(form) form.style.display='flex';
    const dur = '0\u2032'+String(_rS%60).padStart(2,'0');
    const now = new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    const w = Array.from({length:14},()=>Math.floor(6+Math.random()*16));
    appendMsg('<div class="msg voice me"><button class="vplay"><i data-lucide="play"></i></button>'+
      '<span class="wave">'+w.map(h=>'<i style="height:'+h+'px"></i>').join('')+'</span>'+
      '<small>'+dur+'</small><time>'+now+'</time></div>');
    MI.toast('Note vocale envoyée.','success');
  };

  /* AINA */
  const aForm = $('#ainaForm');
  if(aForm) aForm.addEventListener('submit', e=>{ e.preventDefault(); ainaSend(); });
  const afi = $('#ainaFileInput'), afb = $('#ainaFileBtn');
  if(afb && afi) afb.onclick = ()=>afi.click();
  if(afi) afi.addEventListener('change', ()=>{
    window.__ainaFile = afi.files[0] || null;
    const bar = $('#ainaFileBar');
    if(bar){ bar.hidden = !window.__ainaFile;
      if(window.__ainaFile) $('#ainaFilePreview').textContent = window.__ainaFile.name; }
  });
  const afc = $('#ainaFileCancel');
  if(afc) afc.onclick = ()=>{ window.__ainaFile=null; const b=$('#ainaFileBar'); if(b) b.hidden=true; };
  const ar = $('#ainaReset');
  if(ar) ar.onclick = ()=>{
    post(MURLS.aina_r, {}).then(()=>{ window.location.hash=''; renderAina(); MI.toast('Nouvelle discussion AINA créée.','success'); });
  };
}

MI.registerRenderer('messagerie', ()=>{ bindMessaging(); });
MI.registerRenderer('aina',       ()=>{ bindMessaging(); renderAina(); });
