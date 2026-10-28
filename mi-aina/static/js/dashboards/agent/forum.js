/* Forum médical — création et réponses, données persistées côté Django. */
function forumAvatar(user, role){
  return user?.auteur_photo
    ? '<img class="forum-avatar" src="'+esc(user.auteur_photo)+'" alt="">'
    : '<span class="forum-avatar forum-avatar-fallback '+(role==='MEDECIN'?'doctor':role==='PILOTAGE'?'pilot':'agent')+'">'+
      esc((user?.auteur||'?').trim().slice(0,1).toUpperCase())+'</span>';
}
function renderForum(){
  const el=$('#view-forum'); if(!el)return;
  const items=DB.forum||[];
  el.innerHTML='<header class="view-head"><div><h2 class="vh-title">Forum médical</h2>'+
    '<p class="vh-sub">Échangez entre Première Ligne, médecins et Pilotage. Les sujets et réponses sont visibles par tous les rôles autorisés.</p></div></header>'+
    '<section class="card forum-composer"><header><div><div class="card-title">Nouveau sujet</div><div class="card-sub">Posez une question ou partagez un retour clinique</div></div></header>'+
    '<form id="agentForumCreate" class="forum-create-form"><textarea name="question" minlength="8" maxlength="8000" required placeholder="Décrivez votre question ou votre retour d’expérience…"></textarea>'+
    '<div class="forum-create-actions"><input name="tags" maxlength="120" placeholder="Thèmes, séparés par des virgules (facultatif)"><button class="btn solid" type="submit"><i data-lucide="plus"></i>Nouveau sujet</button></div></form></section>'+
    '<div class="forum-feed-head"><b>Discussions</b><span>'+items.length+' sujet'+(items.length===1?'':'s')+'</span></div>'+
    '<div class="forum-feed" id="forumList">'+(items.length?items.map(forumCard).join(''):'<div class="card empty"><div class="empty-ic"><i data-lucide="messages-square"></i></div><h3>Aucun sujet</h3><p>Ouvrez une discussion pour commencer.</p></div>')+'</div>';
  MI.refreshIcons();
  $('#agentForumCreate')?.addEventListener('submit',e=>{
    e.preventDefault();const form=e.currentTarget, data=new FormData(form);
    const question=String(data.get('question')||'').trim();if(question.length<8){MI.toast('La question doit contenir au moins 8 caractères.','error');return;}
    post(DB.urls.forum_create,{question,tags:String(data.get('tags')||'').trim()}).then(res=>{
      if(!res.ok){MI.toast(res.erreur||'Création du sujet impossible.','error');return;}
      DB.forum.unshift(res.post);renderForum();MI.toast('Sujet publié et enregistré.','success');
    }).catch(()=>MI.toast('Réseau indisponible — le sujet n’a pas été envoyé.','error'));
  });
  $('#forumList')?.querySelectorAll('[data-forum-reply]').forEach(form=>form.addEventListener('submit',e=>{
    e.preventDefault();const input=form.elements.reponse, reponse=input.value.trim();if(!reponse)return;
    const button=form.querySelector('button');button.disabled=true;
    post(DB.urls.forum_reply.replace('<ID>',form.dataset.forumReply),{reponse}).then(res=>{
      if(!res.ok){button.disabled=false;MI.toast(res.erreur||'Réponse impossible.','error');return;}
      const i=DB.forum.findIndex(p=>String(p.id)===form.dataset.forumReply);if(i>=0)DB.forum[i]=res.post;
      renderForum();MI.toast('Réponse enregistrée et visible dans la discussion.','success');
    }).catch(()=>{button.disabled=false;MI.toast('Réseau indisponible — réessayez.','error');});
  }));
}
function forumCard(f){
  const replies=(f.reponses_list||[]).map(r=>'<article class="forum-reply">'+forumAvatar(r,r.auteur_role_code)+
    '<div class="forum-reply-copy"><div><b>'+esc(r.auteur)+'</b><span>'+esc(r.auteur_role||'')+' · '+esc(r.date||'')+'</span></div><p>'+esc(r.reponse)+'</p></div></article>').join('');
  const tags=(f.tags||'').split(',').map(t=>t.trim()).filter(Boolean).map(t=>'<span class="f-tag">'+esc(t)+'</span>').join('');
  return '<article class="card forum-card"><header class="forum-post-head">'+forumAvatar(f,f.auteur_role_code)+
    '<div class="forum-post-by"><b>'+esc(f.auteur)+'</b><span>'+esc(f.auteur_role||'')+' · '+esc(f.date||'')+'</span></div>'+
    '<span class="forum-reply-count">'+(f.reponses||0)+' réponse'+(f.reponses===1?'':'s')+'</span></header>'+
    '<div class="forum-question">'+esc(f.question)+'</div>'+(tags?'<div class="forum-tags">'+tags+'</div>':'')+
    '<div class="forum-replies">'+(replies||'<p class="forum-no-replies">Pas encore de réponse. Soyez le premier à contribuer.</p>')+'</div>'+
    '<form class="forum-reply-form" data-forum-reply="'+f.id+'"><input name="reponse" maxlength="8000" required placeholder="Écrire une réponse…"><button type="submit" class="btn sm solid"><i data-lucide="send"></i>Répondre</button></form></article>';
}
MI.registerRenderer('forum',renderForum);
