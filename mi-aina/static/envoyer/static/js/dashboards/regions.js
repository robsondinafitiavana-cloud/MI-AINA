/* ================================================================
   MI-AINA — Carte nationale
   4 fonds (Esri Topo défaut · OSM · Carto Voyager · Satellite)
   Compteur CSB visibles · Toast IA au zoom ≥ 9 → stub backend
   Init paresseuse + invalidateSize (anti-carte-grise)
   ================================================================ */
(function(){
  if(!document.getElementById('map')) return;
  const esc = s => String(s).replace(/</g,'&lt;');
  const csrf = document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
  const IA_ZOOM = 9;

  let map=null, clusterGrp=null, REGIONS=null, allPoints=[], inited=false;
  let toastShownForZoom = null;
  const state = { selRegion:null };

  /* ---------- Init paresseuse : au premier affichage de la vue ---------- */
  function init(){
    if(inited) return; inited = true;

    const DB   = JSON.parse(document.getElementById('data-csb').textContent);
    const URLS = JSON.parse(document.getElementById('data-urls').textContent);
    allPoints  = DB.filter(c => c.lat != null);

    /* Regroupement par région */
    REGIONS = {};
    allPoints.forEach(c=>{
      const r = REGIONS[c.region] = REGIONS[c.region] || {nom:c.region, csbs:[]};
      r.csbs.push(c);
    });
    const regList = Object.values(REGIONS).sort((a,b)=>b.csbs.length - a.csbs.length);
    $('#regCount').textContent    = regList.length + ' régions · ' + allPoints.length + ' CSB géolocalisées';
    $('#regListSub').textContent  = 'Top ' + Math.min(10, regList.length) + ' · par nombre de centres';

    /* Liste d'abord — indépendante de la carte */
    renderList();

    /* Overlays (compteur + toast IA) dans la carte */
    const host = $('#map').parentElement;
    host.style.position = 'relative';
    host.insertAdjacentHTML('beforeend',
      '<div class="geo-count"><i data-lucide="map-pin" style="width:11px;height:11px"></i>'+
      '<span><b id="visCount">0</b> / ' + allPoints.length + ' CSB visibles</span></div>'+
      '<div class="ia-toast" id="iaToast" hidden>'+
      '<i data-lucide="sparkles"></i>'+
      '<span><b><span id="iaCount">0</span> CSB</b> dans cette zone — analyse IA de la zone ?</span>'+
      '<button class="btn solid sm" id="iaAsk">Demander l\u2019analyse</button></div>');

    /* Carte — protégée : si Leaflet échoue, la liste survit */
    try {
      map = L.map('map', {zoomControl:false}).setView([-19, 46.8], 5.4);

            const esriTopo = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        {maxZoom:19, attribution:'© Esri, HERE, Garmin, FAO, NOAA, USGS'});
      const esriStreet = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        {maxZoom:19, attribution:'© Esri'});
      const osm = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {maxZoom:19, attribution:'© OpenStreetMap contributors'});
      const sat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {maxZoom:18, attribution:'© Esri World Imagery'});
      esriTopo.addTo(map);

      L.control.zoom({position:'bottomleft'}).addTo(map);
      const lc = L.control.layers({
        'Esri Topographique': esriTopo,
        'Esri Rues': esriStreet,
        'OpenStreetMap': osm,
        'Satellite Esri': sat
      }, null, {position:'topright', collapsed:false});
      lc.addTo(map);
      /* Clusters + pins */
      clusterGrp = L.markerClusterGroup({
        iconCreateFunction: cl=>
          L.divIcon({html:'<div>'+cl.getChildCount()+'</div>', className:'csb-cluster', iconSize:L.point(38,38)}),
        maxClusterRadius:45, showCoverageOnHover:false
      });
      allPoints.forEach(c=>{
        const m = L.marker([c.lat, c.lng], {icon:L.divIcon({
          className:'csb-marker', html:'<i></i>', iconSize:L.point(14,20), iconAnchor:[7,18]})});
        m.bindPopup('<div class="csb-popup"><b>'+esc(c.nom)+'</b><br>'+
          '<span class="mono">'+esc(c.code)+' · '+esc(c.district)+'</span><br>'+
          '<span class="mono">'+c.agents+' agents · '+c.patients+' patients</span></div>');
        m.on('click', ()=>selectRegion(c.region));
        clusterGrp.addLayer(m);
      });
      map.addLayer(clusterGrp);

      /* Compteur visible + toast IA — à chaque déplacement/zoom */
      map.on('zoomend moveend', updateView);
      setTimeout(()=>{ map.invalidateSize(); updateView(); }, 80);
    } catch(e){
      console.warn('Carte indisponible :', e.message);
    }

    MI.refreshIcons();
    bindIa(URLS);
  }

  /* ---------- Compteur visible + suggestion IA ---------- */
  function updateView(){
    if(!map) return;
    const bounds = map.getBounds();
    const visible = allPoints.filter(c => bounds.contains([c.lat, c.lng]));
    const vc = $('#visCount'); if(vc) vc.textContent = visible.length;

    const t = $('#iaToast');
    if(!t) return;
    const z = map.getZoom();
    if(z >= IA_ZOOM && visible.length > 0){
      if(toastShownForZoom !== z){
        t.hidden = false;
        $('#iaCount').textContent = visible.length;
        t.dataset.payload = JSON.stringify({
          csbs: visible.map(c=>c.code),
          bbox: bounds.toBBoxString(),
          zoom: z,
        });
        toastShownForZoom = z;
      }
    } else {
      t.hidden = true;
      toastShownForZoom = null;
    }
  }

  /* ---------- Analyse IA (stub backend — vraies données agrégées) ---------- */
  function bindIa(URLS){
    const btn = $('#iaAsk'); if(!btn) return;
    btn.addEventListener('click', async ()=>{
      const t = $('#iaToast');
      const payload = JSON.parse(t.dataset.payload || '{}');
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = 'Analyse en cours…';
      try {
        const res = await fetch(URLS.zone_analyse, {method:'POST',
          headers:{'X-CSRFToken':csrf, 'Content-Type':'application/json'},
          body: JSON.stringify(payload)});
        const data = await res.json();
        MI.toast(data.synthese || 'Analyse indisponible.',
                 data.urgence === 'CRITIQUE' ? 'error' : 'info');
        t.hidden = true;
      } catch(e){
        MI.toast('Analyse indisponible — réseau ou serveur.', 'error');
      }
      btn.disabled = false;
      btn.textContent = label;
    });
  }

  /* ---------- Liste des régions : top 10 + Voir plus ---------- */
  const LIMIT = 10;
  let expanded = false;
  function renderList(){
    const regList = Object.values(REGIONS).sort((a,b)=>b.csbs.length - a.csbs.length);
    const shown = expanded ? regList : regList.slice(0, LIMIT);
    $('#regionList').innerHTML = shown.map(r=>{
      const sel = state.selRegion === r.nom;
      return '<div class="reg-row '+(sel?'sel':'')+'" data-reg="'+esc(r.nom)+'">'+
        '<span class="dot" style="background:var(--mg-green)"></span>'+
        '<span class="who"><b>'+esc(r.nom)+'</b><span>'+r.csbs.length+' centre'+(r.csbs.length>1?'s':'')+
        ' · '+esc(r.csbs[0].district)+'</span></span>'+
        '<span class="n">'+r.csbs.length+'</span></div>';
    }).join('') +
    (regList.length > LIMIT
      ? '<button class="btn ghost sm reg-more" id="regMoreBtn"><i data-lucide="'+(expanded?'chevrons-up':'chevrons-down')+'"></i>'+
        (expanded ? 'Voir moins' : 'Voir les '+(regList.length-LIMIT)+' autres régions')+'</button>'
      : '');
    MI.refreshIcons();
    $('#regionList').querySelectorAll('.reg-row').forEach(el=>el.onclick=()=>selectRegion(el.dataset.reg));
    const more = $('#regMoreBtn');
    if(more) more.onclick = ()=>{ expanded = !expanded; renderList(); };
  }

  /* ---------- Panneau région ---------- */
  function renderPanel(nom){
    const r = REGIONS[nom]; if(!r) return;
    const districts = {};
    r.csbs.forEach(c=>{ districts[c.district] = (districts[c.district]||0)+1; });
    const agents   = r.csbs.reduce((a,c)=>a+c.agents, 0);
    const patients = r.csbs.reduce((a,c)=>a+c.patients, 0);
    $('#geoPanel').innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
      '<div><p class="mono" style="font-size:9px;letter-spacing:1.6px;color:var(--ink-35)">FARITRA · RÉGION</p>'+
      '<h3 style="font-family:var(--serif);font-weight:500;font-size:22px;margin-top:4px">'+esc(r.nom)+'</h3></div>'+
      '<span class="badge green">ACTIF</span></div>'+
      '<div style="margin-top:12px">'+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Centres CSB</span><b class="mono">'+r.csbs.length+'</b></div>'+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Agents actifs</span><b class="mono">'+agents+'</b></div>'+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Patients suivis</span><b class="mono">'+MI.fmt.format(patients)+'</b></div></div>'+
      '<p class="mono" style="font-size:9px;letter-spacing:1.4px;color:var(--ink-35);margin-top:14px">DISTRICTS ('+Object.keys(districts).length+')</p>'+
      Object.entries(districts).slice(0,6).map(([d,n])=>
        '<div style="display:flex;justify-content:space-between;padding:7px 0;border-top:1px dashed var(--line);font-size:12px">'+
        '<span><i data-lucide="map-pin" style="width:11px;height:11px;vertical-align:-1px;margin-right:5px;color:var(--ink-35)"></i>'+esc(d)+'</span>'+
        '<b class="mono" style="font-size:11.5px">'+n+' CSB</b></div>').join('')+
      '<button class="btn solid sm" id="flyBtn" style="margin-top:12px;width:100%;justify-content:center">'+
      '<i data-lucide="focus"></i>Zoomer sur la région</button>';
    MI.refreshIcons();
    const avgLat = r.csbs.reduce((a,c)=>a+c.lat,0)/r.csbs.length;
    const avgLng = r.csbs.reduce((a,c)=>a+c.lng,0)/r.csbs.length;
    $('#flyBtn').onclick = ()=>map && map.flyTo([avgLat, avgLng], 9, {duration:1.2});
  }

  function selectRegion(nom){
    state.selRegion = nom;
    renderList(); renderPanel(nom);
    const row = $('#regionList').querySelector('.reg-row.sel');
    if(row) row.scrollIntoView({block:'nearest'});
  }

  /* ---------- Recherche + Ma position ---------- */
  function bindSearch(){
    $('#geoSearch').addEventListener('keydown', e=>{
      if(e.key!=='Enter') return;
      const q = e.target.value.trim().toLowerCase(); if(!q) return;
      const hit = allPoints.find(c=>
        c.district.toLowerCase().includes(q) || c.region.toLowerCase().includes(q) || c.nom.toLowerCase().includes(q));
      if(hit){ map.flyTo([hit.lat, hit.lng], 10, {duration:1.2}); selectRegion(hit.region); }
      else MI.toast('Aucun district, région ou CSB ne correspond à « '+q+' ».','info');
    });
    $('#geoLocBtn').onclick = ()=>{
      if(!navigator.geolocation){ MI.toast('Géolocalisation non disponible.','error'); return; }
      navigator.geolocation.getCurrentPosition(
        p=>{ map.flyTo([p.coords.latitude, p.coords.longitude], 12);
             L.circleMarker([p.coords.latitude, p.coords.longitude],
               {radius:8, color:'#C1272D', fillOpacity:.9}).addTo(map)
               .bindPopup('Votre position').openPopup(); },
        ()=>MI.toast('Position refusée ou indisponible.','info'));
    };
  }

  /* ---------- Enregistrement : s'exécute quand la vue devient visible ---------- */
  MI.registerRenderer('regions', ()=>{
    init();
    bindSearch();
    setTimeout(()=>{ if(map) map.invalidateSize(); }, 80);
  });
})();