/* MI-AINA — Statistiques nationales : charts, récit, exports CSV/PDF */
(function(){
  if(!document.getElementById('view-stats')) return;
  const S = JSON.parse(document.getElementById('data-statsfull').textContent);
  const esc = s => String(s).replace(/</g,'&lt;');
  const PALETTE = ['#007E3A','#C1272D','#1C4030','#C98A1F','#5BC58A','#3E6B58','#9A6A1F','#D05A54'];

  /* ---------- Carte narrative : humaniser les chiffres ---------- */
  (function story(){
    const st = S.story;
    const titleEl = $('#storyTitle'), textEl = $('#storyText');
    if(st.n > 0){
      titleEl.innerHTML = `Cette semaine, <em style="color:var(--mg-green);font-style:italic">${esc(st.region)}</em> concentre la vigilance.`;
      textEl.textContent = `${st.n} cas critique${st.n>1?'s':''} y attend${st.n>1?'ent':''} une expertise médicale — soit la concentration la plus élevée du pays. Les médecins de garde ont été notifiés ; les agents de première ligne poursuivent le suivi quotidien.`;
    } else {
      titleEl.innerHTML = `Le pays respire. <em style="color:var(--mg-green);font-style:italic">Aucun cas critique</em> cette semaine.`;
      textEl.textContent = 'Aucune consultation critique n\u2019est en attente sur le territoire — le calme avant la prochaine collecte. Les agents poursuivent leurs tournées et les constantes continuent d\u2019affluer.';
    }
  })();

  /* ---------- KPI strip humanisé ---------- */
  (function kpis(){
    const k = S.kpis;
    const items = [
      {ic:'stethoscope', lbl:'Consultations (30 j)', val:k.cons_30, hint:k.cons_delta===null?'données en construction':(k.cons_delta>=0?`+${k.cons_delta} % vs période précédente`:`${k.cons_delta} % vs précédente`), tone:k.cons_delta>=0?'#026630':'#A31F24', tint:'rgba(0,126,58,.09)'},
      {ic:'user-check',  lbl:'Taux de validation',   val:k.validation_rate+' %', hint:'inscriptions traitées par le Pilotage', tone:'#026630', tint:'rgba(0,126,58,.09)'},
      {ic:'timer',       lbl:'Délai moyen de prise en charge', val:k.avg_delay+' h', hint:'de la création à l\u2019attribution au médecin', tone:'#1C4030', tint:'rgba(28,64,48,.09)'},
      {ic:'map',         lbl:'Couverture districts', val:k.coverage+' %', hint:'districts avec au moins un agent actif', tone:'#026630', tint:'rgba(0,126,58,.09)'},
      {ic:'users',       lbl:'Patients par agent',   val:k.patients_per_agent, hint:'moyenne nationale de suivi', tone:'#9A6A1F', tint:'rgba(154,106,31,.11)'},
    ];
    $('#kpiStrip').innerHTML = items.map(i=>`
      <div class="stat" style="--tone:${i.tone};--tint:${i.tint};cursor:default">
        <div class="top"><span class="ic"><i data-lucide="${i.ic}"></i></span></div>
        <div class="val">${i.val}</div><div class="lbl">${i.lbl}</div><div class="hint">${i.hint}</div>
      </div>`).join('');
    MI.refreshIcons();
  })();

  /* ---------- Charts ---------- */
  (function charts(){
    // Pipeline
    const pl = S.pipeline;
    new Chart($('#chPipeline'), { type:'doughnut',
      data:{ labels:['En attente','En cours','Validées','Orientées','Terminées'],
        datasets:[{ data:[pl.EN_ATTENTE, pl.EN_COURS, pl.VALIDEE, pl.ORIENTEE, pl.TERMINEE],
          backgroundColor:['#C98A1F','#C1272D','#007E3A','#1C4030','#8B8F8A'],
          borderColor:'#FCFBF5', borderWidth:3, hoverOffset:7 }]},
      options:{ responsive:true, maintainAspectRatio:false, cutout:'66%',
        plugins:{ legend:{position:'bottom', labels:{boxWidth:7, boxHeight:7, usePointStyle:true, pointStyle:'circle', padding:11}}, tooltip:MI_TOOLTIP } } });

    // Sévérité par région (barres empilées)
    const sev = S.sev_by_region;
    new Chart($('#chSev'), { type:'bar',
      data:{ labels: sev.map(r=>r.region),
        datasets:[
          {label:'Critique',   data:sev.map(r=>r.CRITIQUE),     backgroundColor:'#C1272D', borderRadius:4, barThickness:12},
          {label:'Préoccupant',data:sev.map(r=>r['PRÉOCCUPANT']),backgroundColor:'#C98A1F', borderRadius:4, barThickness:12},
          {label:'Modéré',     data:sev.map(r=>r['MODÉRÉ']),    backgroundColor:'#007E3A', borderRadius:4, barThickness:12},
        ]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom', labels:{boxWidth:7, boxHeight:7, usePointStyle:true, pointStyle:'circle', padding:10}}, tooltip:MI_TOOLTIP },
        scales:{ x:{stacked:true, grid:{color:'rgba(30,42,34,.07)'}, border:{display:false}, ticks:{precision:0}},
                 y:{stacked:true, grid:{display:false}} } } });

    // Croissance
    const g = S.growth;
    new Chart($('#chGrowth'), { type:'bar',
      data:{ labels:g.labels, datasets:[
        {label:'Première ligne', data:g.data.map(d=>d.pl),  backgroundColor:'#007E3A', borderRadius:5, barThickness:16},
        {label:'Médecin',        data:g.data.map(d=>d.med), backgroundColor:'#C1272D', borderRadius:5, barThickness:16},
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{position:'bottom', labels:{boxWidth:7, boxHeight:7, usePointStyle:true, pointStyle:'circle', padding:10}}, tooltip:MI_TOOLTIP },
        scales:{ x:{stacked:true, grid:{display:false}}, y:{stacked:true, grid:{color:'rgba(30,42,34,.07)'}, border:{display:false}, ticks:{precision:0}}} } });

    // Signalements
    const sig = S.sig_types;
    new Chart($('#chSig'), { type:'bar',
      data:{ labels:sig.map(s=>s[0]), datasets:[{ data:sig.map(s=>s[1]),
        backgroundColor:'#007E3A', hoverBackgroundColor:'#006A31', borderRadius:5, barThickness:13 }]},
      options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:MI_TOOLTIP },
        scales:{ x:{grid:{color:'rgba(30,42,34,.07)'}, border:{display:false}, ticks:{precision:0}},
                 y:{grid:{display:false}} } } });
  })();

  /* ---------- Tableau comparatif + progression ---------- */
  (function table(){
    const rows = S.sev_by_region;
    const csbByRegion = {};
    (JSON.parse(document.getElementById('data-csb').textContent)||[]).forEach(c=>{
      csbByRegion[c.region] = (csbByRegion[c.region]||0)+1;
    });
    const maxCons = Math.max(...rows.map(r=>r.total), 1);
    $('#regionTable tbody').innerHTML = rows.map(r=>{
      const w = Math.round(r.total/maxCons*100);
      const crit = r.total ? Math.round(r.CRITIQUE/r.total*100) : 0;
      return `<tr>
        <td><b style="font-size:13px">${esc(r.region)}</b></td>
        <td class="mono">${csbByRegion[r.region]||0}</td>
        <td><div class="mini-bar"><i style="width:${w}%"></i></div><span class="mono" style="font-size:11px">${r.total}</span></td>
        <td class="mono">${r.CRITIQUE}</td>
        <td>${crit}% <span class="badge ${crit>30?'red':crit>10?'amber':'green'}" style="font-size:9px;margin-left:4px">${crit>30?'ALERTE':crit>10?'VIGILANCE':'OK'}</span></td>
      </tr>`;
    }).join('');
  })();

  /* ---------- Export CSV (navigateur, zéro dépendance) ---------- */
  function exportCSV(){
    const rows = [['Région','CSB','Consultations','Critiques','Préoccupantes','Modérées','% critique']];
    S.sev_by_region.forEach(r=>{
      const crit = r.total ? Math.round(r.CRITIQUE/r.total*100) : 0;
      rows.push([r.region, (JSON.parse(document.getElementById('data-csb').textContent)||[]).filter(c=>c.region===r.region).length,
                 r.total, r.CRITIQUE, r['PRÉOCCUPANT'], r['MODÉRÉ'], crit+'%']);
    });
    const csv = '\uFEFF' + rows.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
    a.download = 'mi-aina-statistiques-regions.csv';
    a.click();
    MI.toast('Export CSV téléchargé — encodage compatible Excel (BOM UTF-8).', 'success');
  }

  /* ---------- Export PDF (fenêtre d'impression propre) ---------- */
  function exportPDF(){
    const k = S.kpis;
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mi-AINA — Rapport statistique</title>
      <style>
        body{font-family:'Segoe UI',system-ui,sans-serif;color:#1E2A22;margin:40px;position:relative}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #007E3A;padding-bottom:14px}
        h1{font-size:22px;margin:0} h1 span{color:#007E3A}
        .meta{font-family:monospace;font-size:10px;color:#666;text-align:right}
        .story{background:#F4F1E9;border-left:4px solid #007E3A;padding:14px 18px;margin:22px 0;border-radius:0 8px 8px 0}
        .kpis{display:flex;gap:10px;margin:18px 0;flex-wrap:wrap}
        .kpi{border:1px solid #ddd;border-radius:10px;padding:10px 14px;min-width:130px}
        .kpi b{font-size:22px;display:block} .kpi span{font-size:10px;color:#666}
        table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
        th{background:#F4F1E9;text-align:left;padding:8px 10px;font-size:10px;text-transform:uppercase;letter-spacing:1px}
        td{padding:8px 10px;border-bottom:1px solid #eee}
        .badge{padding:2px 8px;border-radius:99px;font-size:10px;font-weight:600}
        .b-ok{background:#E2F2E9;color:#026630}.b-w{background:#F7ECD9;color:#9A6A1F}.b-c{background:#F7E2E0;color:#A31F24}
        .stamp{position:absolute;bottom:30px;right:40px;font-family:monospace;font-weight:600;letter-spacing:3px;
          border:3px double #00713A;color:#00713A;border-radius:7px;padding:8px 16px;transform:rotate(-8deg);font-size:12px}
        @media print{.noprint{display:none}}
      </style></head><body>
      <div class="head">
        <div><h1>Mi-<span>AINA</span> · Rapport statistique national</h1>
        <p style="margin:6px 0 0;font-size:12px;color:#555">Ministeran'ny Fahasalamam-bahoaka — République de Madagasikara</p></div>
        <div class="meta">Généré le ${new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})}<br>à ${new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})} (Antananarivo)</div>
      </div>
      <div class="story"><b>Le chiffre qui compte —</b> ${S.story.n} cas critique${S.story.n>1?'s':''} en attente dans la région <b>${S.story.region}</b> cette semaine.</div>
      <div class="kpis">
        <div class="kpi"><b>${k.cons_30}</b><span>Consultations (30 j)</span></div>
        <div class="kpi"><b>${k.validation_rate} %</b><span>Taux de validation</span></div>
        <div class="kpi"><b>${k.avg_delay} h</b><span>Délai moyen prise en charge</span></div>
        <div class="kpi"><b>${k.coverage} %</b><span>Couverture districts</span></div>
        <div class="kpi"><b>${k.patients_per_agent}</b><span>Patients par agent</span></div>
      </div>
      <h3 style="font-size:14px;margin-top:22px">Comparatif régional</h3>
      <table><thead><tr><th>Région</th><th>Consultations</th><th>Critiques</th><th>Préoccupantes</th><th>Modérées</th><th>État</th></tr></thead><tbody>
      ${S.sev_by_region.map(r=>{
        const crit = r.total?Math.round(r.CRITIQUE/r.total*100):0;
        const b = crit>30?'<span class="badge b-c">ALERTE</span>':crit>10?'<span class="badge b-w">VIGILANCE</span>':'<span class="badge b-ok">OK</span>';
        return `<tr><td><b>${r.region}</b></td><td>${r.total}</td><td>${r.CRITIQUE}</td><td>${r['PRÉOCCUPANT']}</td><td>${r['MODÉRÉ']}</td><td>${b}</td></tr>`;
      }).join('')}
      </tbody></table>
      <p style="margin-top:26px;font-size:10px;color:#888">Document généré par la plateforme Mi-AINA — données consolidées du terrain. Compatible export DHIS2 (phase statistiques avancées).</p>
      <div class="stamp">MI-AINA · OFFICIEL</div>
      <div class="noprint" style="margin-top:30px;text-align:center">
        <button onclick="window.print()" style="padding:12px 26px;background:#007E3A;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px">🖨️ Imprimer / Enregistrer en PDF</button>
      </div>
    </body></html>`);
    w.document.close();
    MI.toast('Rapport PDF prêt — l\u2019imprimante propose « Enregistrer au format PDF ».', 'success');
  }

  const _csv = $('#csvBtn'), _pdf = $('#pdfBtn');
  if(_csv) _csv.onclick = exportCSV;
  if(_pdf) _pdf.onclick = exportPDF;
  MI.refreshIcons();
})();