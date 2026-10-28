/* MI-AINA — Agent · notifications réelles + poll temps réel (chargé d'office) */
function refreshNotifs(notifs, unreadTotal){
  if(!Array.isArray(notifs)) notifs = [];
  const list = $('#notifList');
  const unread = notifs.filter(n=>!n.lu);
  const nUnread = Number.isFinite(unreadTotal) ? unreadTotal : unread.length;
  const dot = $('#bellDot'); if(dot) dot.hidden = nUnread===0;
  const count = $('#bellCount'); if(count){ count.textContent=nUnread>99?'99+':String(nUnread); count.hidden=nUnread===0; }
  if(list){
    list.innerHTML = notifs.length ? notifs.map(n=>
      '<a class="drop-item" href="/notifications/'+encodeURIComponent(n.id)+'/open/" style="text-decoration:none;color:inherit;'+(n.lu?'':'background:rgba(0,126,58,.05)')+'">'+
      '<i data-lucide="'+esc(n.icone||'bell')+'" style="width:14px;height:14px;color:var(--mg-green);flex:none;margin-top:3px"></i>'+
      '<div><p style="font-weight:600">'+esc(n.titre)+'</p>'+(n.texte?'<p style="font-size:11px;color:var(--ink-50)">'+esc(n.texte)+'</p>':'')+
      '<time>'+esc(n.date)+'</time></div></a>').join('')
      : '<div class="drop-item"><span style="font-size:12px;color:var(--ink-50)">Aucune notification — le terrain est calme.</span></div>';
    MI.refreshIcons();
  }
}
let pollTimer = null;
function poll(){
  fetch('/notifications/feed/', {headers:{'X-CSRFToken':csrf}})
    .then(r=>r.json())
    .then(d=>{
      if(!d.ok) return;
      (d.consults||[]).forEach(c=>{
        const old = DB.consults.find(x=>String(x.id)===String(c.id));
        if(!old){
          DB.consults.unshift(c);
        } else if(old.statut!==c.statut){
          old.statut = c.statut; old.medecin = c.medecin; old.medecin_id = c.medecin_id;
          if(c.statut==='EN_COURS') MI.toast(c.patient+' : le médecin a pris en charge le cas — visio disponible.','success');
          if(c.statut==='AVIS_RECU') MI.toast(c.patient+' : ordonnance reçue du médecin.','info');
        } else {
          old.medecin = c.medecin; old.medecin_id = c.medecin_id;
        }
      });
      refreshNotifs(d.notifs||[], d.non_lues);
      refreshDockBadges();
      if(state.view==='consults' && typeof renderConsults==='function') renderConsults();
    }).catch(()=>{});
}
function startPoll(){
  stopPoll();
  pollTimer = setInterval(poll, 20000);
  document.addEventListener('visibilitychange', ()=>{
    if(document.hidden){ clearInterval(pollTimer); }
    else { clearInterval(pollTimer); pollTimer = setInterval(poll, 20000); poll(); }
  });
}
function stopPoll(){ if(pollTimer) clearInterval(pollTimer); }
startPoll();
