/* ================================================================
   MI-AINA — MadaAlert : carte des foyers épidémiques (Leaflet).
   100 % dynamique : les foyers viennent des déclarations terrain.
   Niveaux :
   · CONSULTATION  → niveau DÉCLARÉ par l'agent (il voit le patient)
   · SIGNALEMENT   → niveau CALCULÉ par le nombre de cas
                     (<3 PRÉOCCUPANT · 3-4 URGENT · ≥5 CRITIQUE)
   Init paresseuse + invalidateSize (anti-carte-grise).
   ================================================================ */
(function(){
  if(!document.getElementById('madaMap')) return;

  const NIVEAU = {
    CRITIQUE:     {col:'#C1272D', badge:'red',   txt:'CRITIQUE'},
    URGENT:       {col:'#C98A1F', badge:'amber', txt:'URGENT'},
    'PRÉOCCUPANT':{col:'#007E3A', badge:'green', txt:'PRÉOCCUPANT'},
  };
  const col = n => (NIVEAU[n]||NIVEAU['PRÉOCCUPANT']).col;
  const REGIONS = ['Diana','Sava','Boeny','Sofia','Betsiboka','Melaky','Alaotra-Mangoro','Analanjirofo',
    'Atsinanana','Itasy','Analamanga','Bongolava','Vakinankaratra','Menabe','Amoron’i Mania','Vatovavy',
    'Haute Matsiatra','Fitovinany','Ihorombe','Atsimo-Atsinanana','Atsimo-Andrefana','Anosy','Androy'];
  const REGION_CENTERS = {
    'Diana':[-13.2,49.5],'Sava':[-14.1,50.2],'Boeny':[-16.1,46.6],'Sofia':[-14.9,48.1],
    'Betsiboka':[-16.5,47.0],'Melaky':[-18.1,44.3],'Alaotra-Mangoro':[-17.9,48.5],
    'Analanjirofo':[-16.7,49.8],'Atsinanana':[-18.2,49.4],'Itasy':[-19.0,46.8],
    'Analamanga':[-18.9,47.5],'Bongolava':[-18.6,46.4],'Vakinankaratra':[-19.8,47.0],
    'Menabe':[-20.3,44.3],'Amoron’i Mania':[-20.5,47.2],
    'Vatovavy':[-21.2,48.3],'Haute Matsiatra':[-21.5,47.1],'Fitovinany':[-22.0,47.9],
    'Ihorombe':[-22.4,46.1],'Atsimo-Atsinanana':[-23.0,47.8],'Atsimo-Andrefana':[-23.4,43.7],
    'Anosy':[-25.0,47.0],'Androy':[-25.2,46.1]
  };
  const esc = s => String(s??'').replace(/</g,'&lt;');
  /* Pastille colorée du design system — pas d'emoji */
  const dotHTML = n => '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;'+
    'background:'+col(n)+';vertical-align:-1px;margin-right:4px"></span>';

  let map=null, FOYERS=[], inited=false;
  const state = { filter:'TOUT', region:null, sel:null };

  function init(){
    if(inited) return; inited = true;

    fetch('/surveillance/data/', {headers:{'X-CSRFToken':csrf}})
      .then(r=>r.json()).then(d=>{
        FOYERS = d.ok ? d.foyers : [];
        updateSummary();
        renderRegions();
        renderList();
        try{ buildMap(); }catch(e){ console.warn('Carte :', e.message); }
      }).catch(e=>{
        console.error('Chargement de la surveillance :', e);
        const sub=$('#madaCount'); if(sub) sub.textContent='Données momentanément indisponibles.';
        renderRegions(); renderList();
      });
  }

  function updateSummary(){
    const tot=FOYERS.reduce((a,f)=>a+(Number(f.nb_cas)||0),0);
    const text=FOYERS.length+' foyer'+(FOYERS.length>1?'s':'')+' actif'+(FOYERS.length>1?'s':'')+
      ' · '+tot+' cas estimé'+(tot>1?'s':'');
    const cc=$('#madaCount'); if(cc) cc.textContent=text;
    const fc=$('#foyersCount'); if(fc) fc.textContent=FOYERS.length;
    const cases=$('#casCount'); if(cases) cases.textContent=tot;
  }

  function renderRegions(){
    const root=$('#madaRegions'); if(!root) return;
    const normalized=s=>String(s||'').normalize('NFC').replace(/[’‘]/g,"'").trim().toLocaleLowerCase('fr');
    const counts=new Map(REGIONS.map(r=>[normalized(r),0]));
    FOYERS.forEach(f=>{const key=normalized(f.region); counts.set(key,(counts.get(key)||0)+1);});
    root.innerHTML=REGIONS.map(region=>{
      const count=counts.get(normalized(region))||0;
      const active=state.region && normalized(state.region)===normalized(region);
      return '<button type="button" class="mada-region '+(active?'is-active':'')+'" data-region="'+esc(region)+'" aria-pressed="'+Boolean(active)+'">'+
        '<span>'+esc(region)+'</span><b>'+count+'</b></button>';
    }).join('')+(Array.from(counts.keys()).some(k=>!REGIONS.some(r=>normalized(r)===k))
      ? '<button type="button" class="mada-region" data-region="__other__"><span>Autres / non précisée</span><b>'+FOYERS.filter(f=>!REGIONS.some(r=>normalized(r)===normalized(f.region))).length+'</b></button>':'');
    root.querySelectorAll('[data-region]').forEach(button=>button.onclick=()=>{
      const selected=button.dataset.region;
      state.region=state.region===selected?null:selected;
      state.sel=null;
      renderRegions(); renderList();
      const matches=filteredFoyers();
      if(map && matches.length){
        if(matches.length===1) map.flyTo([matches[0].lat,matches[0].lng],8,{duration:.8});
        else map.fitBounds(L.latLngBounds(matches.map(f=>[f.lat,f.lng])).pad(.2),{maxZoom:7});
      } else if(map && state.region && REGION_CENTERS[state.region]) map.flyTo(REGION_CENTERS[state.region],7,{duration:.8});
      else if(map) map.flyTo([-19,46.8],5.2,{duration:.8});
    });
    const clear=$('#madaRegionClear');
    if(clear) clear.onclick=()=>{
      state.region=null; state.sel=null; renderRegions(); renderList();
      if(map) map.flyTo([-19,46.8],5.2,{duration:.8});
    };
  }

  function filteredFoyers(){
    const norm=s=>String(s||'').normalize('NFC').replace(/[’‘]/g,"'").trim().toLocaleLowerCase('fr');
    return FOYERS.filter(f=>(state.filter==='TOUT'||f.niveau===state.filter)&&
      (!state.region || (state.region==='__other__'?!REGIONS.some(r=>norm(r)===norm(f.region)):norm(f.region)===norm(state.region))));
  }

  function buildMap(){
    map = L.map('madaMap', {zoomControl:false}).setView([-19, 46.8], 5.2);
    const topo = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      {maxZoom:18, attribution:'© Esri'});
    const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {maxZoom:18, attribution:'© Esri World Imagery'});
    topo.addTo(map);
    L.control.zoom({position:'bottomleft'}).addTo(map);

    const lc = L.control.layers({'Esri Topographique':topo,'Satellite Esri':sat}, null,
      {position:'topright', collapsed:false});
    lc.addTo(map);

    FOYERS.forEach(f=>{
      const lat=Number(f.lat), lng=Number(f.lng);
      if(!Number.isFinite(lat)||!Number.isFinite(lng)) return; // conservé dans la liste, mais pas de faux point sur la carte
      const c = col(f.niveau);
      const radius = 9 + Math.min(f.nb_cas, 10) * 2.2;   // rayon proportionnel aux cas
      /* Halo animé + cercle plein : chaque couleur reflète le niveau de risque. */
      L.circleMarker([lat, lng], {
        radius:radius+7, color:c, weight:2, fill:false, opacity:.8,
        className:'mada-map-pulse mada-map-pulse-'+(NIVEAU[f.niveau]||NIVEAU['PRÉOCCUPANT']).badge,
        interactive:false,
      }).addTo(map);
      const m = L.circleMarker([lat, lng], {
        radius, color:c, weight:2.5, fillColor:c, fillOpacity:.65,
        className:'mada-map-marker mada-map-marker-'+(NIVEAU[f.niveau]||NIVEAU['PRÉOCCUPANT']).badge,
      });
      /* Origine du niveau : déclaré (agent) ou calculé (cas cumulés) */
      const origine = f.source === 'SIGNALEMENT'
        ? 'niveau calculé ('+f.nb_cas+' cas)'
        : 'niveau déclaré par l\u2019agent';
      m.bindPopup('<div class="csb-popup">'+
        '<b style="color:'+c+'">'+dotHTML(f.niveau)+esc(f.type)+'</b><br>'+
        '<span class="mono">'+esc(f.village)+' · '+esc(f.district)+'</span><br>'+
        '<span class="mono">'+f.nb_cas+' cas estimé'+(f.nb_cas>1?'s':'')+' · '+f.niveau+'</span><br>'+
        '<span class="mono" style="opacity:.7">'+origine+'</span><br>'+
        '<span class="mono">agent '+esc(f.agent)+' · '+esc(f.date)+'</span></div>');
      m.on('click', ()=>{ state.sel = f; renderList(); renderPanel(f); });
      m.addTo(map);
    });

    if(window.lucide) lucide.createIcons();
  }

  /* ---------- Filtres ---------- */
  function renderFilters(){
    const counts = {TOUT:FOYERS.length,
      CRITIQUE:FOYERS.filter(f=>f.niveau==='CRITIQUE').length,
      URGENT:FOYERS.filter(f=>f.niveau==='URGENT').length,
      'PRÉOCCUPANT':FOYERS.filter(f=>f.niveau==='PRÉOCCUPANT').length};
    $('#madaFilters').innerHTML = [['TOUT','Toutes'],['CRITIQUE','Critiques'],
      ['URGENT','Urgentes'],['PRÉOCCUPANT','Préoccupantes']].map(([k,l])=>
      '<button class="pill '+(state.filter===k?'on':'')+'" data-mf="'+k+'">'+l+' ('+counts[k]+')</button>').join('');
    MI.refreshIcons();
    $('#madaFilters').querySelectorAll('[data-mf]').forEach(b=>
      b.onclick=()=>{ state.filter=b.dataset.mf; renderList(); });
  }

  /* ---------- Liste des foyers ---------- */
  function renderList(){
    renderFilters();
    const shown = filteredFoyers();
    $('#madaListSub').textContent = shown.length+' foyer'+(shown.length>1?'s':'')+' — triés par gravité';
    const order = {CRITIQUE:0, URGENT:1, 'PRÉOCCUPANT':2};
    shown.sort((a,b)=> (order[a.niveau]-order[b.niveau]) || (b.nb_cas-a.nb_cas));
    $('#madaList').innerHTML = shown.length ? shown.map(f=>{
      const c = col(f.niveau);
      const origine = f.source === 'SIGNALEMENT'
        ? ' · niveau calculé'
        : ' · niveau déclaré';
      return '<div class="card" style="padding:14px 16px;cursor:pointer;border-left:4px solid '+c+'" data-foyer="'+esc(f.ref)+'">'+
      '<div style="display:flex;gap:12px;align-items:flex-start">'+
      '<span style="width:11px;height:11px;border-radius:50%;background:'+c+';flex:none;margin-top:5px;animation:pulseDot 2.4s infinite"></span>'+
      '<div style="flex:1;min-width:0"><b style="font-size:13.5px">'+esc(f.type)+'</b>'+
      '<span class="badge '+(NIVEAU[f.niveau]||{}).badge+'" style="font-size:9px;margin-left:6px">'+f.niveau+'</span>'+
      '<p style="font-size:11.5px;color:var(--ink-50);margin-top:4px">'+esc(f.village)+' · '+esc(f.district)+' · '+esc(f.region)+'</p>'+
      '<p style="font-size:12px;color:var(--ink-70);margin-top:6px">'+f.nb_cas+' cas estimé'+(f.nb_cas>1?'s':'')+
      ' · signalé par '+esc(f.agent)+' · '+esc(f.date)+origine+'</p></div>'+
      '<span class="mono" style="font-size:22px;font-weight:600;color:'+c+';flex:none">'+f.nb_cas+'</span></div></div>';
    }).join('')
    : '<div class="empty"><div class="empty-ic"><i data-lucide="shield-check"></i></div><h3>Aucun foyer signalé</h3>'+
      '<p>Le territoire est sous surveillance — les déclarations des agents apparaîtront ici en direct.</p></div>';
    MI.refreshIcons();
    $('#madaList').querySelectorAll('[data-foyer]').forEach(el=>el.onclick=()=>{
      const f = FOYERS.find(x=>String(x.ref)===el.dataset.foyer);
      if(f){ state.sel=f; renderList(); renderPanel(f);
        if(map) map.flyTo([f.lat, f.lng], 9, {duration:1.2}); }
    });
  }

  /* ---------- Panneau foyer ---------- */
  function renderPanel(f){
    const c = col(f.niveau);
    const origine = f.source === 'SIGNALEMENT'
      ? 'Niveau calculé automatiquement d\u2019après le nombre de cas cumulés.'
      : 'Niveau déclaré par l\u2019agent — il a examiné le patient sur place.';
    $('#madaPanel').innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">'+
      '<div><p class="mono" style="font-size:9px;letter-spacing:1.6px;color:var(--ink-35)">FOYER · '+(f.source==='SIGNALEMENT'?'SIGNALEMENT':'CONSULTATION')+'</p>'+
      '<h3 style="font-family:var(--serif);font-weight:500;font-size:21px;margin-top:4px">'+esc(f.type)+'</h3></div>'+
      '<span class="mono" style="font-size:20px;font-weight:600;color:'+c+'">'+f.nb_cas+'</span></div>'+
      '<div style="margin-top:12px">'+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Village</span><b style="font-size:12px">'+esc(f.village)+'</b></div>'+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">District · Région</span><b style="font-size:12px">'+esc(f.district)+' · '+esc(f.region)+'</b></div>'+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Déclaré par</span><b style="font-size:12px">'+esc(f.agent)+'</b></div>'+
      '<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:12px;color:var(--ink-50)">Date</span><b style="font-size:12px">'+esc(f.date)+'</b></div>'+
      '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line)">'+
      '<span style="font-size:12px;color:var(--ink-50);flex:none">Niveau</span>'+
      '<span class="badge '+(NIVEAU[f.niveau]||{}).badge+'" style="font-size:9px">'+f.niveau+'</span>'+
      '<span style="font-size:10.5px;color:var(--ink-50)">'+origine+'</span></div>'+
      (f.note?'<p style="font-size:12px;color:var(--ink-70);margin-top:10px;line-height:1.5;border-left:3px solid '+c+';padding-left:10px">'+esc(f.note)+'</p>':'')+
      '</div>'+
      '<p class="mono" style="font-size:9px;letter-spacing:1.4px;color:var(--ink-35);margin-top:12px">SOURCE : '+(f.source==='SIGNALEMENT'?'SIGNALEMENT TERRAIN':'CONSULTATION ÉPIDÉMIQUE')+'</p>';
  }

  /* ---------- Enregistrement lazy ---------- */
  MI.registerRenderer('surveillance', ()=>{
    init();
    setTimeout(()=>{ if(map) map.invalidateSize(); }, 80);
  });
})();
