/* MI-AINA - csb_form_cascade : extrait de templates/csb/form.html (plus aucun script inline). */
const regionSelect = document.getElementById('id_region');
const districtSelect = document.getElementById('id_district');
if (regionSelect && districtSelect) {
  const districtOptions = [...districtSelect.options].map(option => ({
    value: option.value,
    label: option.textContent,
    region: option.textContent.includes(' · ')
      ? option.textContent.split(' · ').pop()
      : '',
  }));
  const filterDistricts = () => {
    const selected = districtSelect.value;
    const region = regionSelect.value;
    districtSelect.innerHTML = '';
    districtOptions
      .filter(option => !option.value || !region || option.region === region)
      .forEach(option => {
        const item = new Option(option.label, option.value);
        districtSelect.add(item);
      });
    districtSelect.value = districtOptions.some(option => option.value === selected &&
      (!region || option.region === region)) ? selected : '';
  };
  regionSelect.addEventListener('change', filterDistricts);
  filterDistricts();
}

window.MI_NAV = [
  {view:'overview', href:'/pilotage/', icon:'layout-dashboard', label:'Vue d’ensemble', group:'FITANTANANA|PILOTAGE'},
  {view:'users',    href:'/pilotage/', icon:'users',      label:'Utilisateurs'},
  {view:'pending',  href:'/pilotage/', icon:'clock-3',    label:'Comptes en attente'},
  {view:'csb',      href:'/pilotage/?view=csb', icon:'building-2', label:'CSB'},
  {view:'regions',  href:'/pilotage/', icon:'map',        label:'Régions', group:'FANARAHA-MASO|SUPERVISION'},
  {view:'stats',    href:'/pilotage/', icon:'chart-column', label:'Statistiques'},
  {view:'alerts',   href:'/pilotage/', icon:'siren',      label:'Alertes'},
  {view:'surveillance', href:'/pilotage/', icon:'radar', label:'Surveillance'},
  {view:'publications', href:'/pilotage/', icon:'megaphone', label:'Publications', group:'FANABEAZANA|DIFFUSION'},
  {view:'forum',    href:'/pilotage/', icon:'messages-square', label:'Forum médical'},
  {view:'messagerie', href:'/pilotage/', icon:'message-circle', label:'Messagerie inter-rôles'}
];
window.MI_PRIMARY = {icon:'arrow-left', tip:'Retour aux CSB', href:'/pilotage/?view=csb'};
