const role = document.body.dataset.role;
const roleKey = ({agent:'PREMIERE_LIGNE',medecin:'MEDECIN',pilotage:'PILOTAGE'})[role]||role;
const dashboardHref = roleKey === 'PREMIERE_LIGNE' ? '/premiere-ligne/'
  : roleKey === 'MEDECIN' ? '/medecin/' : '/pilotage/';

const fallbackNav = {
  PREMIERE_LIGNE: [
    {view:'overview',icon:'layout-dashboard',label:'Vue d’ensemble',group:'FIASA|TRAVAIL'},
    {view:'saisie',icon:'clipboard-pen',label:'Nouvelle consultation'},
    {view:'patients',icon:'users',label:'Mes patients',count:0,badgeCount:true},
    {view:'consults',icon:'stethoscope',label:'Consultations',badge:true,badgeCount:true},
    {view:'reports',icon:'megaphone',label:'Signalements',badge:true},
    {view:'devices',icon:'cpu',label:'Boîtiers IoT',badge:true,group:'FITAFIANA|IoT · EXCLUSIF'},
    {view:'measures',icon:'activity',label:'Mesures IoT'},
    {view:'prevention',href:'/prevention/',icon:'shield-plus',label:'Prévention',group:'FANABEAZANA|SAVOIR',inDock:false},
    {view:'formations',icon:'graduation-cap',label:'Formations'},
    {view:'onboarding',icon:'circle-help',label:'Centre d’aide'},
    {view:'forum',icon:'messages-square',label:'Forum médical'},
    {view:'messagerie',icon:'message-circle',label:'Messagerie',badge:true,group:'FINDRAFY|MÉDECIN'},
    {view:'visio',icon:'video',label:'Visioconsultation'},
    {view:'profil',icon:'user-round',label:'Mon profil',group:'RAFITRA|COMPTE'},
  ],
  MEDECIN: [
    {view:'overview',icon:'layout-dashboard',label:'Vue d’ensemble',group:'FITSABOANA|CLINIQUE'},
    {view:'triage',icon:'inbox',label:'File d’expertise',badge:true},
    {view:'patients',icon:'users',label:'Patients',count:0},
    {view:'consults',icon:'stethoscope',label:'Consultations'},
    {view:'visio',icon:'video',label:'Visioconsultation',group:'FINDRAFY|TÉLÉMÉDECINE'},
    {view:'messagerie',icon:'message-circle',label:'Messagerie',badge:true},
    {view:'prevention',href:'/prevention/',icon:'shield-plus',label:'Prévention',group:'FANABEAZANA|SAVOIR',inDock:false},
    {view:'formation',icon:'graduation-cap',label:'Formation & publications',badge:true},
    {view:'forum',icon:'messages-square',label:'Forum médical'},
    {view:'profil',icon:'user-round',label:'Mon profil',group:'RAFITRA|COMPTE'},
  ],
  PILOTAGE: [
    {view:'overview',icon:'layout-dashboard',label:'Vue d’ensemble',group:'FITANTANANA|PILOTAGE'},
    {view:'users',icon:'users',label:'Utilisateurs',count:0},
    {view:'pending',icon:'clock-3',label:'Comptes en attente',badge:true},
    {view:'csb',icon:'building-2',label:'CSB',count:0},
    {view:'regions',icon:'map',label:'Régions'},
    {view:'stats',icon:'chart-column',label:'Statistiques',group:'FANARAHA-MASO|SUPERVISION'},
    {view:'alerts',icon:'siren',label:'Alertes',badge:true},
    {view:'surveillance',icon:'radar',label:'Surveillance'},
    {view:'prevention',href:'/prevention/',icon:'shield-plus',label:'Prévention',group:'FANABEAZANA|SAVOIR',inDock:false},
    {view:'publications',icon:'megaphone',label:'Publications',badge:true,group:'FANABEAZANA|DIFFUSION'},
    {view:'forum',icon:'messages-square',label:'Forum médical'},
    {view:'messagerie',icon:'message-circle',label:'Messagerie',badge:true},
    {view:'profil',icon:'user-round',label:'Mon profil',group:'RAFITRA|COMPTE'},
  ],
};

let saved = null;
try{ saved = JSON.parse(sessionStorage.getItem('miaina-nav:'+role)||'null'); }catch(_){ }
const expectedViews = (fallbackNav[roleKey]||[]).filter(item=>item.view!=='prevention').map(item=>item.view);
const hasFullDashboardNav = Array.isArray(saved?.nav)
  && expectedViews.every(view=>saved.nav.some(item=>item.view===view));
let nav = hasFullDashboardNav ? saved.nav : (fallbackNav[roleKey]||[]);
if(!nav.some(item=>item.view==='prevention')){
  const index = nav.findIndex(item=>['formations','formation','publications'].includes(item.view));
  nav = [...nav];
  nav.splice(index<0?nav.length:index,0,{view:'prevention',href:'/prevention/',icon:'shield-plus',label:'Prévention',inDock:false});
}
/* Sur la fiche de prévention, les vues SPA du dashboard ne sont pas présentes.
   Convertir les boutons du menu en liens vers la même vue du dashboard. */
window.MI_NAV = nav.map(item=>item.view==='prevention'
  ? {...item,href:'/prevention/'}
  : item.view==='admin'
    ? {...item,href:item.href||'/admin/'}
    : {...item,href:dashboardHref+'?view='+encodeURIComponent(item.view)});

const dashboardAction = roleKey === 'PREMIERE_LIGNE'
  ? ()=>{ window.location.href='/premiere-ligne/?view=saisie'; }
  : roleKey === 'PILOTAGE'
    ? ()=>{ window.location.href='/csb/nouveau/'; }
    : ()=>{ window.location.href=dashboardHref; };
window.MI_PRIMARY = {...(saved?.primary||{}), run:dashboardAction};

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.nav-item[data-view="prevention"],.dock-btn[href="/prevention/"]').forEach(item=>item.classList.add('active'));
});
