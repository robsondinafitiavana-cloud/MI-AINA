/* Dossier patient dans le panneau central, commun aux espaces terrain et médecin. */
(() => {
  let requestedCode = '';
  let previousView = 'patients';
  let loadId = 0;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]);
  const textOrDash = value => value ? escapeHtml(value) : '—';

  function infoCard(title, items) {
    return '<section class="card" style="padding:18px"><h3 style="margin:0 0 12px;font-size:16px">'+title+'</h3>'+items+'</section>';
  }

  function renderDossier(data) {
    const p = data.patient;
    const demographics = [
      ['Code dossier', p.code], ['Âge', p.age ? p.age+' ans' : '—'], ['Sexe', p.sexe],
      ['Téléphone', p.telephone], ['Adresse', p.adresse], ['Village / Fokontany', p.village],
      ['Commune', p.commune], ['District', p.district], ['Région', p.region], ['CSB', p.csb],
      ['Agent référent', p.agent], ['Dossier créé le', p.created_at]
    ].map(([label,value]) => '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><small style="display:block;color:var(--ink-50);margin-bottom:3px">'+label+'</small><b>'+textOrDash(value)+'</b></div>').join('');

    const consultations = data.consultations.length ? data.consultations.map(c =>
      '<article style="padding:14px 0;border-bottom:1px solid var(--line)">'+
      '<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><b>'+textOrDash(c.motif)+'</b><span class="mono" style="font-size:11px;color:var(--ink-50)">'+textOrDash(c.date)+'</span></div>'+
      '<p style="margin:7px 0;color:var(--ink-70)">Statut : '+textOrDash(c.statut)+' · Médecin : '+textOrDash(c.medecin)+'</p>'+
      (c.observation ? '<p style="margin:7px 0"><b>Observation :</b> '+escapeHtml(c.observation)+'</p>' : '')+
      (c.ordonnance ? '<p style="margin:7px 0"><b>Ordonnance :</b> '+escapeHtml(c.ordonnance)+'</p>' : '')+
      (c.suivi ? '<p style="margin:7px 0"><b>Suivi :</b> '+escapeHtml(c.suivi)+'</p>' : '')+
      (c.orientation ? '<p style="margin:7px 0"><b>Orientation :</b> '+escapeHtml(c.orientation)+'</p>' : '')+
      '</article>').join('') : '<p class="cell-sub">Aucune consultation enregistrée.</p>';

    const measures = data.mesures.length ? '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Température infrarouge</th><th>Appareil</th></tr></thead><tbody>'+data.mesures.map(m=>
      '<tr><td>'+textOrDash(m.date)+'</td><td>'+(m.temperature!==null && m.temperature!==undefined && m.temperature!=='' ? escapeHtml(String(m.temperature).replace('.',','))+' °C' : '—')+'</td><td>'+textOrDash(m.device)+'</td></tr>').join('')+'</tbody></table></div>' : '<p class="cell-sub">Aucune température enregistrée.</p>';

    return '<header class="view-head"><div><h2 class="vh-title">Dossier médical</h2><p class="vh-sub">Consultation du dossier rattaché à votre secteur.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn ghost" type="button" data-dossier-back><i data-lucide="arrow-left"></i>Retour</button><a class="btn solid" href="/patients/'+encodeURIComponent(p.code)+'/pdf/"><i data-lucide="file-down"></i>Exporter en PDF</a></div></header>'+
      '<section class="card" style="padding:20px;margin-bottom:14px"><div class="person"><span class="p-av '+(p.sexe==='F'?'r':'g')+'" style="width:52px;height:52px;font-size:17px">'+escapeHtml((p.prenom||p.nom||'?').trim().charAt(0).toUpperCase())+'</span><div><h2 style="margin:0;font-size:21px">'+escapeHtml((p.prenom+' '+p.nom).trim())+'</h2><span class="cell-sub">'+textOrDash(p.village)+' · '+textOrDash(p.csb)+'</span></div></div></section>'+
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr));gap:14px">'+
      infoCard('Identité et rattachement', '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:0 18px">'+demographics+'</div>')+
      infoCard('Constantes et mesures', measures)+
      '</div><section class="card" style="padding:18px;margin-top:14px"><h3 style="margin:0 0 8px;font-size:16px">Historique des consultations <span class="ident">'+data.consultations.length+'</span></h3>'+consultations+'</section>';
  }

  async function showDossier() {
    const view = document.getElementById('view-dossier');
    if (!view || !requestedCode) return;
    const currentLoad = ++loadId;
    view.innerHTML = '<div class="card" style="padding:28px;text-align:center">Chargement du dossier…</div>';
    try {
      const response = await fetch('/patients/'+encodeURIComponent(requestedCode)+'/data/', {credentials:'same-origin', headers:{'Accept':'application/json'}});
      const data = await response.json();
      if (currentLoad !== loadId) return;
      if (!response.ok || !data.ok) throw new Error(data.error || 'Dossier indisponible.');
      view.innerHTML = renderDossier(data);
      window.MI.refreshIcons();
    } catch (error) {
      if (currentLoad !== loadId) return;
      view.innerHTML = '<header class="view-head"><div><h2 class="vh-title">Dossier médical</h2></div></header><div class="card" style="padding:24px"><p>'+escapeHtml(error.message || 'Impossible de charger ce dossier.')+'</p><button type="button" class="btn ghost" data-dossier-back>Retour</button></div>';
    }
  }

  window.MI.openPatientDossier = code => {
    if (!code || !window.MI) return;
    previousView = document.querySelector('.view[data-view]:not([hidden])')?.dataset.view || previousView;
    requestedCode = String(code);
    window.MI.setView('dossier');
  };
  window.MI.registerRenderer('dossier', showDossier);

  document.addEventListener('click', event => {
    const opener = event.target.closest('[data-open-dossier]');
    if (opener) {
      event.preventDefault();
      document.getElementById('pDetail')?.remove();
      opener.closest('.modal-wrap')?.remove();
      const ordonnanceModal = document.getElementById('ordModal');
      if (ordonnanceModal) ordonnanceModal.hidden = true;
      window.MI.openPatientDossier(opener.dataset.openDossier);
      return;
    }
    if (event.target.closest('[data-dossier-back]')) {
      window.MI.setView(previousView || 'patients');
    }
  });
})();
