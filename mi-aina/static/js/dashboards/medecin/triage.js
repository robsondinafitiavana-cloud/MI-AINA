/* MI-AINA — Médecin · file d'expertise (triage complet) */
MI.registerRenderer('triage', renderTriage);
function renderTriage(){
  const el = $('#view-triage');
  el.innerHTML =
    '<header class="view-head"><div><h2 class="vh-title">File d\u2019expertise</h2>'+
    '<p class="vh-sub">'+DB.cases.length+' cas en attente — votre décision appose le tampon officiel.</p></div></header>'+
    '<div class="case-list">'+
    (DB.cases.length
      ? DB.cases.map(c=>caseCardHTML(c)).join('')
      : '<div class="card"><div class="empty"><div class="empty-ic"><i data-lucide="coffee"></i></div>'+
        '<h3>Aucun cas dans la file</h3><p>Les escalades des agents de première ligne apparaîtront ici automatiquement.</p></div></div>')+
    '</div>';
  MI.refreshIcons();
  bindCaseActions(el);
}