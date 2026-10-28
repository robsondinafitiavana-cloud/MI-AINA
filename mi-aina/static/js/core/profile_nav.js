/* MI-AINA - profile_nav : extrait de templates/accounts/profile.html (plus aucun script inline). */
window.MI_NAV = [
  {view:'overview', href:'/pilotage/', icon:'layout-dashboard', label:'Vue d’ensemble', group:'FITANTANANA|PILOTAGE'},
  {view:'users', href:'/pilotage/', icon:'users', label:'Utilisateurs'},
  {view:'pending', href:'/pilotage/', icon:'clock-3', label:'Comptes en attente'},
  {view:'csb', href:'/pilotage/?view=csb', icon:'building-2', label:'CSB'},
  {view:'regions', href:'/pilotage/', icon:'map', label:'Régions', group:'FANARAHA-MASO|SUPERVISION'},
  {view:'stats', href:'/pilotage/', icon:'chart-column', label:'Statistiques'},
  {view:'alerts', href:'/pilotage/', icon:'siren', label:'Alertes'},
  {view:'surveillance', href:'/pilotage/', icon:'radar', label:'Surveillance'},
  {view:'publications', href:'/pilotage/', icon:'megaphone', label:'Publications', group:'FANABEAZANA|DIFFUSION'},
  {view:'forum', href:'/pilotage/', icon:'messages-square', label:'Forum médical'},
  {view:'messagerie', href:'/pilotage/', icon:'message-circle', label:'Messagerie inter-rôles'},
  {view:'profil', href:'/profile/', icon:'user-round', label:'Mon profil', group:'RAFITRA|COMPTE'}
];
if(document.body.dataset.superuser === '1')
  window.MI_NAV.push({view:'admin', href:'/admin/', icon:'shield-check', label:'Administration'});
