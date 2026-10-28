/* MI-AINA — Agent · formations : feed lecture + accusés hors-ligne */
const PUB_TYPE = {
  image:{icon:'image',lbl:'IMAGE',col:'#7254A3'},
  texte:{icon:'text',lbl:'TEXTE',col:'#007E3A'}, video:{icon:'play',lbl:'VIDÉO',col:'#C1272D'},
  pdf:{icon:'file-text',lbl:'GUIDE',col:'#9A6A1F'}, protocole:{icon:'clipboard-list',lbl:'PROTOCOLE',col:'#1C4030'},
};
let pubFilter='TOUT';
let pubFeedLoaded=false;
function renderFormations(){
  const el = $('#view-formations'); if(!el) return;
  if(!pubFeedLoaded){
    pubFeedLoaded=true;
    fetch(DB.urls.pub_feed||'/publications/feed/', {credentials:'same-origin'})
      .then(r=>r.json()).then(res=>{
        if(res.ok && Array.isArray(res.items)){ DB.pubs=res.items; renderFormations(); refreshDockBadges(); }
      }).catch(()=>{});
  }
  const items = (DB.pubs||[]).filter(p=>pubFilter==='TOUT'||p.type===pubFilter);
  const newN = (DB.pubs||[]).filter(p=>!p.lu).length;
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">Formations des médecins</h2>'+
    '<p class="vh-sub">'+items.length+' publication'+(items.length>1?'s':'')+(newN?' · <b style="color:var(--mg-green)">'+newN+' nouvelle'+(newN>1?'s':'')+'</b>':'')+' — disponibles même hors-ligne après synchro.</p></div>'+
    '<div class="pill-filters" id="pubFilters"></div></header>'+
    '<div style="display:flex;flex-direction:column;gap:10px" id="pubList"></div>';
  const filters=[['image','Images'],['TOUT','Tout'],['protocole','Protocoles'],['pdf','Guides'],['video','Vidéos'],['texte','Textes']];
  $('#pubFilters').innerHTML = filters.map(([k,l])=>
    '<button class="pill '+(pubFilter===k?'on':'')+'" data-pf="'+k+'">'+l+'</button>').join('');
  $('#pubFilters').querySelectorAll('[data-pf]').forEach(b=>b.onclick=()=>{ pubFilter=b.dataset.pf; renderFormations(); });
  $('#pubList').innerHTML = items.length ? items.map(p=>{
    const t = PUB_TYPE[p.type]||PUB_TYPE.texte;
    const isNew = !p.lu;
    const ext = (p.fichier_nom||p.fichier_url||'').split('?')[0].split('.').pop().toLowerCase();
    const media = p.fichier_url && (p.type==='image'||['png','jpg','jpeg','gif','webp'].includes(ext))
      ? '<img class="pub-media-image" src="'+esc(p.fichier_url)+'" alt="'+esc(p.titre)+'" loading="lazy">'
      : p.fichier_url && (p.type==='video'||['mp4','webm','ogv','mov'].includes(ext))
        ? '<video class="pub-media-video" controls preload="metadata"><source src="'+esc(p.fichier_url)+'"></video>'
        : p.fichier_url && (p.type==='pdf'||ext==='pdf')
          ? '<a class="btn sm ghost" style="margin:12px 0" href="'+esc(p.fichier_url)+'" target="_blank" rel="noopener"><i data-lucide="file-text"></i>Ouvrir le document PDF · '+esc(p.fichier_nom||'PDF')+'</a>' : '';
    const auteur=(p.auteur_role_code==='MEDECIN'?'Dr ':'')+(p.auteur||'—');
    const avatar=p.auteur_photo
      ? '<img src="'+esc(p.auteur_photo)+'" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:50%">'
      : '<span class="p-av r" style="width:36px;height:36px">'+esc((p.auteur_prenom||p.auteur||'MI').slice(0,1).toUpperCase())+'</span>';
    return '<article class="card pub-card" style="'+(isNew?'border-left:3px solid var(--mg-green)':'')+'">'+
    '<div style="display:flex;gap:10px;align-items:center">'+avatar+'<div><b style="font-size:12.5px">'+esc(auteur)+'</b><div style="font-size:10.5px;color:var(--ink-50)">'+esc(p.created||'')+'</div></div></div>'+
    '<div style="margin-top:12px"><span class="mono" style="font-size:9px;color:'+t.col+';background:'+t.col+'14;padding:3px 8px;border-radius:999px">'+t.lbl+'</span>'+(p.epingle?'<span class="badge green" style="font-size:8.5px;margin-left:6px">OFFICIEL</span>':'')+(isNew?'<span class="badge amber" style="font-size:8.5px;margin-left:6px">NOUVEAU</span>':'')+'</div>'+
    '<b style="font-size:16px;display:block;margin-top:10px">'+esc(p.titre)+'</b>'+
    '<p style="font-size:13px;color:var(--ink-70);margin-top:5px;line-height:1.6;white-space:pre-line">'+esc(p.resume)+'</p>'+media+
    '<div style="display:flex;gap:12px;margin-top:9px;flex-wrap:wrap;align-items:center">'+
    (p.fichier_url?'<a class="btn sm ghost" href="'+esc(p.fichier_url)+'" target="_blank" rel="noopener"><i data-lucide="paperclip"></i>'+esc(p.fichier_nom||'Média')+'</a>':'')+
    '<button class="btn sm '+(isNew?'solid':'ghost')+'" data-lu="'+p.id+'" style="margin-left:auto"><i data-lucide="check"></i>'+(isNew?'Marquer comme lu':'Lu ✓')+'</button>'+ 
    '</div></article>';
  }).join('')
  : '<div class="card"><div class="empty"><div class="empty-ic"><i data-lucide="graduation-cap"></i></div><h3>Aucune formation</h3><p>Les publications des médecins apparaîtront ici — poussées hors-ligne sur votre terminal.</p></div></div>';
  MI.refreshIcons();
  $('#pubList').querySelectorAll('[data-lu]').forEach(b=>b.onclick=()=>{
    const p = DB.pubs.find(x=>String(x.id)===b.dataset.lu); if(!p) return;
    p.lu = true;
    post((DB.urls.pub_lu||'/publications/<ID>/lu/').replace('<ID>', p.id), {}).catch(()=>{});
    syncQueue.unshift({l:'Accusé lecture formation', tag:'LU'});
    refreshSync(); refreshDockBadges();
    MI.toast('Lecture confirmée — l\u2019accusé part avec la prochaine synchro (hors-ligne OK).','success');
    renderFormations();
  });
}
MI.registerRenderer('formations', renderFormations);
