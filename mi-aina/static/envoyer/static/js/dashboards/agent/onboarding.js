/* ================================================================
   MI-AINA — Prise en main (formation interactive de démarrage)
   Guide l'agent de première ligne à travers 7 étapes + un mini-quiz.
   Progression sauvegardée en local (localStorage) pour l'instant —
   une sauvegarde côté serveur (sur le profil) est un ajout simple à
   faire ensuite si on veut qu'elle survive au changement d'appareil.
   ================================================================ */
const $ob  = s => document.querySelector(s);
const LS_DONE = 'mi_onboarding_done';
const LS_STEP = 'mi_onboarding_step';
const LS_REDUCED = 'mi_onboarding_reduced';

/* ---------- Personnages compacts (utilisés sur les 7 étapes) ----------
   Un seul gabarit "agent" décliné par pose, plus un personnage "patient"
   et un personnage "médecin" pour les scènes qui en ont besoin (accueil,
   dispositif, télé-expertise). Tenue professionnelle (blouse) pour rester
   cohérent avec le personnage de l'écran d'accueil. */
function agentCompact(pose){
  const ARM_R = {
    welcome: `<g class="agc-wave" style="transform-origin:70px 100px">
      <path d="M70,100 Q86,110 84,128" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>
    </g>`,
    explain: `<g class="agc-point" style="transform-origin:70px 100px">
      <path d="M70,100 Q90,92 100,80" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>
      <circle cx="103" cy="76" r="6" fill="#C88A5C"/>
    </g>`,
    device: `<path d="M70,100 Q80,112 76,126" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>`,
    congrats: `<g class="agc-cheer" style="transform-origin:70px 100px">
      <path d="M70,100 Q88,98 92,82" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M92,82 l0,-12" stroke="#C88A5C" stroke-width="7" stroke-linecap="round"/>
    </g>`,
    encourage: `<g class="agc-nudge" style="transform-origin:70px 100px">
      <path d="M70,100 Q88,96 94,82" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M89,79 l5,-3 M94,82 l7,2" stroke="#C88A5C" stroke-width="4" stroke-linecap="round"/>
    </g>`,
    correct: `<path d="M70,100 Q84,114 80,128" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>`,
  }[pose] || '';
  const ARM_L = pose === 'device'
    ? `<path d="M20,100 Q10,112 14,126" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>`
    : `<path d="M20,100 Q4,96 -6,88" stroke="#C88A5C" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  const DEVICE = pose === 'device'
    ? `<rect x="8" y="122" width="26" height="18" rx="3" fill="#FCFBF5" stroke="#1E2A22" stroke-width="1.5"/>
       <circle cx="21" cy="131" r="3" fill="#C1272D" class="ob-blip"/>` : '';
  const MOUTH = {
    congrats: `<path d="M35,42 Q37,39 39,42" stroke="#1E2A22" stroke-width="2" fill="none"/><path d="M51,42 Q53,39 55,42" stroke="#1E2A22" stroke-width="2" fill="none"/><path d="M34,49 Q45,58 56,49" stroke="#1E2A22" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    encourage: `<path d="M36,49 Q45,56 54,49" stroke="#1E2A22" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    correct: `<path d="M37,50 Q45,53 53,50" stroke="#1E2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  }[pose] || `<path d="M36,49 Q45,54 54,49" stroke="#1E2A22" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  const bounce = pose === 'congrats' ? ' mascot-bounce' : '';
  return `<svg viewBox="0 0 90 180" class="mascot agc-${pose}${bounce}">
    <defs>
      <linearGradient id="agSkin2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DFA073"/><stop offset="1" stop-color="#B87A50"/></linearGradient>
      <linearGradient id="agCoat2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E9E5D8"/></linearGradient>
      <linearGradient id="agHair2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3C2A1C"/><stop offset="1" stop-color="#1E140D"/></linearGradient>
    </defs>
    <g class="ob-body-bob">
    <path d="M20,150 Q22,90 45,84 Q68,90 70,150 Z" fill="url(#agCoat2)" stroke="#1E2A22" stroke-width="1.4"/>
    <path d="M34,84 L45,96 L56,84" fill="none" stroke="#007E3A" stroke-width="3" stroke-linecap="round"/>
    <rect x="38" y="108" width="14" height="10" rx="1.5" fill="#fff" stroke="#1E2A22" stroke-width="1"/>
    ${ARM_L.replace(/#C88A5C/g,'url(#agSkin2)')}
    ${ARM_R.replace(/#C88A5C/g,'url(#agSkin2)')}
    ${DEVICE}
    <circle cx="45" cy="42" r="24" fill="url(#agSkin2)"/>
    <path d="M22,32 Q45,10 68,32 Q68,20 45,16 Q22,20 22,32 Z" fill="url(#agHair2)"/>
    <circle cx="37" cy="43" r="2.2" fill="#1E2A22" class="ob-eye"/><circle cx="53" cy="43" r="2.2" fill="#1E2A22" class="ob-eye"/>
    <ellipse cx="37" cy="43" rx="2.6" ry="0" fill="#C88A5C" class="ob-lid"/><ellipse cx="53" cy="43" rx="2.6" ry="0" fill="#C88A5C" class="ob-lid"/>
    ${MOUTH}
  </g></svg>`;
}

/* Personnage "Patient" — pose 'talk' (assis, parle) ou 'arm' (bras tendu
   pour la mesure). Tenue distincte (lamba) pour le différencier de l'agent. */
function patientCompact(pose){
  const arm = pose === 'arm'
    ? `<g class="pt-arm-out" style="transform-origin:60px 100px">
        <path d="M60,100 Q84,104 96,100" stroke="url(#ptSkin)" stroke-width="11" fill="none" stroke-linecap="round"/>
        <circle cx="99" cy="100" r="6" fill="url(#ptSkin)"/>
       </g>`
    : `<path d="M60,100 Q76,112 72,128" stroke="url(#ptSkin)" stroke-width="11" fill="none" stroke-linecap="round"/>`;
  return `<svg viewBox="0 0 90 160" class="mascot pt-${pose}">
    <defs>
      <linearGradient id="ptSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#C88355"/><stop offset="1" stop-color="#A3653D"/></linearGradient>
      <linearGradient id="ptWrap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D6423A"/><stop offset="1" stop-color="#A81E1E"/></linearGradient>
    </defs>
    <g class="pt-body-bob">
    <path d="M18,150 Q20,96 45,90 Q70,96 72,150 Z" fill="url(#ptWrap)"/>
    <path d="M28,150 L28,112 M45,152 L45,110 M62,150 L62,112" stroke="#7A3A18" stroke-width="1.4" opacity=".4"/>
    <path d="M20,100 Q10,96 6,86" stroke="url(#ptSkin)" stroke-width="11" fill="none" stroke-linecap="round"/>
    ${arm}
    <circle cx="45" cy="42" r="22" fill="url(#ptSkin)"/>
    <path d="M24,40 Q22,16 45,14 Q68,16 66,40 Q69,52 60,60 Q64,38 45,35 Q26,38 30,60 Q21,52 24,40 Z" fill="#1B1310"/>
    <circle cx="38" cy="43" r="2" fill="#1E2A22" class="pt-eye"/><circle cx="52" cy="43" r="2" fill="#1E2A22" class="pt-eye"/>
    <ellipse cx="38" cy="43" rx="2.4" ry="0" fill="#B97A52" class="pt-lid"/><ellipse cx="52" cy="43" rx="2.4" ry="0" fill="#B97A52" class="pt-lid"/>
    <path class="pt-mouth" d="M37,50 Q45,54 53,50" stroke="#1E2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </g></svg>`;
}

/* Personnage "Médecin" — apparaît dans la fenêtre de télé-expertise. */
function doctorCompact(){
  return `<svg viewBox="0 0 90 160" class="mascot dr-call">
    <defs>
      <linearGradient id="drSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#A66C46"/><stop offset="1" stop-color="#7E4E2E"/></linearGradient>
      <linearGradient id="drCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E9E5D8"/></linearGradient>
    </defs>
    <g class="dr-body-bob">
    <path d="M18,150 Q20,100 45,92 Q70,100 72,150 Z" fill="url(#drCoat)" stroke="#1E2A22" stroke-width="1.4"/>
    <path d="M34,92 L45,102 L56,92" fill="none" stroke="#0F6FB0" stroke-width="3" stroke-linecap="round"/>
    <path d="M45,60 Q20,60 20,80 M45,60 Q70,60 70,80" stroke="#1E2A22" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <circle cx="20" cy="82" r="4" fill="#1E2A22"/><circle cx="70" cy="82" r="4" fill="#1E2A22"/>
    <path d="M20,100 Q10,110 14,124" stroke="url(#drSkin)" stroke-width="10" fill="none" stroke-linecap="round"/>
    <g class="dr-wave" style="transform-origin:70px 100px">
      <path d="M70,100 Q86,96 90,82" stroke="url(#drSkin)" stroke-width="10" fill="none" stroke-linecap="round"/>
    </g>
    <circle cx="45" cy="44" r="22" fill="url(#drSkin)"/>
    <path d="M24,40 Q22,18 45,16 Q68,18 66,40 Q68,30 45,26 Q22,30 24,40 Z" fill="#14100D"/>
    <circle cx="38" cy="45" r="2" fill="#1E2A22" class="dr-eye"/><circle cx="52" cy="45" r="2" fill="#1E2A22" class="dr-eye"/>
    <ellipse cx="38" cy="45" rx="2.4" ry="0" fill="#8C5A3C" class="dr-lid"/><ellipse cx="52" cy="45" rx="2.4" ry="0" fill="#8C5A3C" class="dr-lid"/>
    <path d="M37,52 Q45,56 53,52" stroke="#1E2A22" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  </g></svg>`;
}

/* Scène animée du dispositif MI-AINA (§9 / §17 du brief) : agent + patient
   autour du boîtier, écran LCD avec valeurs qui montent progressivement et
   tracé ECG animé. Purement SVG/CSS + un petit compteur JS — pas de vidéo. */
function deviceSceneSVG(){
  return `<div class="dvc-scene">
    ${agentCompact('device')}
    <div class="dvc-board">
      <div class="dvc-lcd">
        <div class="dvc-row"><span>TEMP</span><b id="dvcTemp">--</b></div>
        <div class="dvc-row"><span>FC</span><b id="dvcBpm">--</b></div>
        <svg class="dvc-ecg" viewBox="0 0 160 34" preserveAspectRatio="none">
          <path class="dvc-ecg-line" d="M0,17 L28,17 L34,4 L40,30 L46,17 L160,17"/>
        </svg>
        <p class="dvc-status" id="dvcStatus">Mesure en cours…</p>
      </div>
      <div class="dvc-legs"></div>
    </div>
    ${patientCompact('arm')}
  </div>`;
}

function obAnimateDevice(){
  const tEl = $ob('#dvcTemp'), bEl = $ob('#dvcBpm'), stEl = $ob('#dvcStatus');
  if (!tEl || !bEl) return;
  if (obIsReduced()){
    tEl.textContent = '36,8 °C'; bEl.textContent = '78 bpm';
    if (stEl) { stEl.innerHTML = 'Mesure terminée <i data-lucide="check-circle-2"></i>'; if (window.lucide && lucide.createIcons) lucide.createIcons(); }
    return;
  }
  let n = 0;
  const dur = 40, tTarget = 36.8, bTarget = 78;
  const timer = setInterval(() => {
    n++;
    const p = Math.min(1, n / dur);
    tEl.textContent = (tTarget * p).toFixed(1).replace('.', ',') + ' °C';
    bEl.textContent = Math.round(bTarget * p) + ' bpm';
    if (p >= 1) {
      clearInterval(timer);
      if (stEl) { stEl.innerHTML = 'Mesure terminée <i data-lucide="check-circle-2"></i>'; if (window.lucide && lucide.createIcons) lucide.createIcons(); }
    }
  }, 35);
}

const CONFETTI = ['#007E3A','#C1272D','#9A6A1F','#1E2A22'].map((c,i)=>
  `<span class="ob-confetti" style="--c:${c};--d:${i*0.18}s;--x:${(i%2?1:-1)*(20+i*14)}px"></span>`).join('');

/* ---------- Scène 1 (Bienvenue) — personnage "Agent" articulé ----------
   Remplace la mascotte plate de l'écran d'accueil par un personnage en
   plusieurs pièces (tête, torse, bras séparés) animables individuellement :
   entrée en scène, respiration, clignement, léger balancement de la tête,
   geste de bienvenue (bras qui salue) et bouche synchronisée avec le texte
   de bienvenue. Le reste du parcours (étapes, quiz) n'est pas touché. */
const AGENT_HERO = `
<svg class="ag-hero ag-talking" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="agSkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#DFA073"/><stop offset="1" stop-color="#B87A50"/></linearGradient>
    <linearGradient id="agCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#E9E5D8"/></linearGradient>
    <linearGradient id="agHair" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3C2A1C"/><stop offset="1" stop-color="#1E140D"/></linearGradient>
  </defs>
  <g class="ag-root">
    <ellipse cx="100" cy="288" rx="48" ry="8" fill="rgba(30,42,34,.14)"/>
    <g class="ag-legs">
      <path d="M82,226 L76,282 L92,282 L96,230 Z" fill="#1E2A22"/>
      <path d="M118,226 L124,282 L108,282 L104,230 Z" fill="#1E2A22"/>
      <rect x="72" y="278" width="24" height="10" rx="3" fill="#12291D"/>
      <rect x="104" y="278" width="24" height="10" rx="3" fill="#12291D"/>
    </g>
    <g class="ag-torso-wrap">
      <path d="M64,150 Q100,131 136,150 L142,232 Q100,246 58,232 Z" fill="url(#agCoat)" stroke="#1E2A22" stroke-width="2"/>
      <path d="M86,150 L100,170 L114,150" fill="none" stroke="#007E3A" stroke-width="4" stroke-linecap="round"/>
      <rect x="88" y="182" width="20" height="14" rx="2" fill="#fff" stroke="#1E2A22" stroke-width="1.2"/>
      <rect x="91" y="186" width="14" height="3" fill="#007E3A"/>
    </g>
    <g class="ag-arm-left" style="transform-origin:70px 156px">
      <path d="M70,156 Q54,180 58,210" stroke="url(#agSkin)" stroke-width="15" fill="none" stroke-linecap="round"/>
      <circle cx="59" cy="212" r="7.5" fill="url(#agSkin)"/>
    </g>
    <g class="ag-arm-right" style="transform-origin:130px 156px">
      <path d="M130,156 Q146,180 142,210" stroke="url(#agSkin)" stroke-width="15" fill="none" stroke-linecap="round"/>
      <circle cx="142" cy="212" r="7.5" fill="url(#agSkin)"/>
    </g>
    <rect x="91" y="120" width="18" height="20" fill="url(#agSkin)"/>
    <g class="ag-head">
      <circle cx="100" cy="98" r="31" fill="url(#agSkin)"/>
      <path d="M69,92 Q100,56 131,92 Q131,72 100,66 Q69,72 69,92 Z" fill="url(#agHair)"/>
      <path d="M83,89 Q89,85 96,88" stroke="#2B1B12" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M104,88 Q111,85 117,89" stroke="#2B1B12" stroke-width="2" fill="none" stroke-linecap="round"/>
      <circle class="ag-eye" cx="89" cy="98" r="3" fill="#1E2A22"/>
      <circle class="ag-eye" cx="111" cy="98" r="3" fill="#1E2A22"/>
      <ellipse class="ag-lid" cx="89" cy="98" rx="4.4" ry="0" fill="#C88A5C"/>
      <ellipse class="ag-lid" cx="111" cy="98" rx="4.4" ry="0" fill="#C88A5C"/>
      <path class="ag-mouth-closed" d="M88,113 Q100,119 112,113" stroke="#1E2A22" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <ellipse class="ag-mouth-open" cx="100" cy="114" rx="7" ry="5" fill="#5C2A1E" opacity="0"/>
    </g>
  </g>
</svg>`;

/* Petit décor plat (poste de santé stylisé) derrière le personnage. */
const SCENE1_DECOR = `
<svg class="ag-decor" viewBox="0 0 320 200" preserveAspectRatio="xMidYMax slice" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="320" height="200" fill="var(--field)"/>
  <rect x="0" y="150" width="320" height="50" fill="var(--paper)"/>
  <rect x="30" y="70" width="120" height="90" rx="4" fill="var(--sheet)" stroke="var(--line-strong)" stroke-width="2"/>
  <path d="M20,72 L90,32 L160,72 Z" fill="var(--mg-green)"/>
  <rect x="78" y="110" width="24" height="50" fill="var(--field)" stroke="var(--line-strong)" stroke-width="1.5"/>
  <rect x="55" y="90" width="18" height="18" fill="var(--field)" stroke="var(--line-strong)" stroke-width="1.5"/>
  <path d="M60,95 L68,95 M64,91 L64,99" stroke="var(--mg-red)" stroke-width="2"/>
  <rect x="110" y="90" width="18" height="18" fill="var(--field)" stroke="var(--line-strong)" stroke-width="1.5"/>
  <circle cx="250" cy="150" r="14" fill="var(--mg-green)" opacity=".7"/>
  <circle cx="266" cy="156" r="10" fill="var(--mg-green)" opacity=".55"/>
  <rect x="256" y="156" width="4" height="18" fill="var(--amber)"/>
</svg>`;

function obIsReduced(){
  return localStorage.getItem(LS_REDUCED) === '1' ||
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/* ---------- Contenu des 7 étapes ---------- */
const STEPS = [
  { pose:'welcome', title:'Bienvenue dans MI-AINA', bubble:
    `Bienvenue dans MI-AINA&nbsp;! Je vais vous montrer comment utiliser l'application pour accompagner les patients au quotidien.`,
    body:'' },

  { pose:'explain', title:'Votre rôle', bubble:
    `Vous êtes le premier point de contact avec le patient. Vous recueillez les informations, effectuez les premières mesures et utilisez MI-AINA pour vous aider dans l'orientation.`,
    body:`<div class="ob-flow">
      <div class="ob-flow-step">Patient</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step ob-you">Première ligne (vous)</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">MI-AINA</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">Médecin si nécessaire</div>
    </div>
    <p class="ob-note"><i data-lucide="triangle-alert" class="ob-inline-ic"></i> MI-AINA vous accompagne dans votre travail. L'IA ne remplace pas le professionnel de santé.</p>` },

  { pose:'welcome', title:'Accueillir un patient', bubble:'Voici à quoi ressemble un premier échange avec un patient :', body:
    `<div class="ob-scene-mini">
      ${patientCompact('talk')}
      <div class="ob-chat">
        <div class="ob-bubble ob-me">Bonjour, qu'est-ce qui vous amène aujourd'hui&nbsp;?</div>
        <div class="ob-bubble ob-them">J'ai de la fièvre et je suis très fatigué depuis deux jours.</div>
      </div>
    </div>
    <p>Ensuite, ouvrez simplement :</p>
    <div class="ob-fake-btn"><i data-lucide="plus"></i> Nouvelle consultation</div>` },

  { pose:'explain', title:'Créer une consultation', bubble:
    `Sélectionnez uniquement les symptômes réellement observés ou rapportés par le patient.`, body:
    `<div class="ob-fake-form">
      <p class="ob-fake-label">1. Informations du patient</p>
      <div class="ob-fake-row"><span>Nom</span><span>Âge</span><span>Sexe</span></div>
      <p class="ob-fake-label">2. Symptômes</p>
      <div class="ob-checklist">
        <span class="on"><i data-lucide="square-check" class="ob-inline-ic"></i> Fièvre</span><span class="on"><i data-lucide="square-check" class="ob-inline-ic"></i> Fatigue</span><span class="on"><i data-lucide="square-check" class="ob-inline-ic"></i> Céphalée</span>
        <span><i data-lucide="square" class="ob-inline-ic"></i> Toux</span><span><i data-lucide="square" class="ob-inline-ic"></i> Vomissements</span>
      </div>
    </div>
    <p class="ob-note">Ne sélectionnez jamais un symptôme au hasard — seulement ce que le patient rapporte réellement.</p>` },

  { pose:'device', title:'Le dispositif MI-AINA', bubble:
    `Le dispositif MI-AINA peut vous aider à recueillir certaines mesures du patient.`, body:
    `${deviceSceneSVG()}
    <div class="ob-chips">
      <span>ESP32</span><span>Écran LCD</span><span>Capteur MLX90614</span><span>AD8232 (ECG)</span><span>Alimentation</span>
    </div>
    <div class="ob-flow ob-flow-sm">
      <div class="ob-flow-step">Patient</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">Positionner le capteur</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">Lancer la mesure</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">Attendre la fin</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">Résultat envoyé à MI-AINA</div>
    </div>
    <div class="ob-result-card">
      <div><i data-lucide="thermometer" class="ob-inline-ic"></i> Température<br><b>36,8&nbsp;°C</b></div>
      <div><i data-lucide="heart-pulse" class="ob-inline-ic"></i> Fréquence cardiaque<br><b>78&nbsp;bpm</b></div>
      <div><i data-lucide="activity" class="ob-inline-ic"></i> ECG<br><b>Mesure disponible</b></div>
    </div>
    <p class="ob-note">Vérifiez toujours que le patient est correctement installé et que la mesure semble cohérente.</p>` },

  { pose:'explain', title:"L'aide de l'IA", bubble:
    `L'IA vous aide à analyser les informations recueillies, mais la décision médicale reste du ressort du professionnel de santé.`, body:
    `<div class="ob-flow ob-flow-sm">
      <div class="ob-flow-step">Symptômes + Mesures</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step"><i data-lucide="bot" class="ob-inline-ic"></i> IA</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">Maladies compatibles</div>
    </div>
    <div class="ob-fake-form">
      <p class="ob-fake-label">Analyse terminée — maladies compatibles</p>
      <p><span class="ob-num">1</span> Paludisme &nbsp; <span class="ob-num">2</span> Dengue &nbsp; <span class="ob-num">3</span> Infection respiratoire</p>
    </div>
    <p class="ob-warn"><i data-lucide="triangle-alert" class="ob-inline-ic"></i> Ces résultats sont des hypothèses destinées à aider à l'orientation. Ils ne constituent pas un diagnostic médical.</p>` },

  { pose:'explain', title:'Quand contacter un médecin ?', bubble:
    `Sollicitez un médecin lorsqu'une situation nécessite une expertise, une confirmation ou une orientation.`, body:
    `<div class="ob-callwin">
      <div class="ob-callwin-frame">
        ${doctorCompact()}
        <span class="ob-callwin-label">Télé-expertise en direct</span>
      </div>
    </div>
    <div class="ob-flow ob-flow-sm">
      <div class="ob-flow-step">Vous</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step">Cas nécessitant une expertise</div><div class="ob-arrow">↓</div>
      <div class="ob-flow-step"><i data-lucide="phone" class="ob-inline-ic"></i> <i data-lucide="message-circle" class="ob-inline-ic"></i> Médecin</div>
    </div>
    <div class="ob-fake-btn"><i data-lucide="message-circle"></i> Contacter un médecin</div>` },
];

const QUIZ = {
  patient: `J'ai de la fièvre, des frissons et mal à la tête depuis deux jours.`,
  question: `Que devez-vous faire en premier&nbsp;?`,
  options: [
    { id:'A', text:'Sélectionner les symptômes et poursuivre l\u2019évaluation', ok:true },
    { id:'B', text:'Choisir immédiatement une maladie', ok:false },
    { id:'C', text:'Donner directement un traitement', ok:false },
    { id:'D', text:'Ignorer les symptômes', ok:false },
  ],
};

/* ---------- Rendu ---------- */
let obIndex = 0; // 0 = intro, 1..7 = STEPS, 8 = quiz, 9 = fin

function obProgressDots(){
  if (obIndex < 1 || obIndex > STEPS.length) return '';
  return `<div class="ob-progress">
    ${STEPS.map((_,i)=>`<span class="${i+1<=obIndex?'on':''}"></span>`).join('')}
    <em>Étape ${obIndex} / ${STEPS.length}</em>
  </div>`;
}

function obRenderIntro(){
  const reduced = obIsReduced();
  return `<div class="ob-card ob-intro">
    <div class="ob-scene1">
      ${SCENE1_DECOR}
      <div class="ag-stage">${AGENT_HERO}</div>
    </div>
    <h2><i data-lucide="hand" class="ob-inline-ic ob-inline-ic-lg"></i> Bienvenue dans MI-AINA</h2>
    <p>Je vais vous accompagner pendant vos premières étapes — comment accueillir un patient, créer une consultation, utiliser le dispositif connecté et savoir quand contacter un médecin.</p>
    <p class="ob-duration"><i data-lucide="clock"></i> Environ 5 à 8 minutes</p>
    <div class="ob-actions">
      <button class="btn sm ghost" id="obSkip">Passer pour le moment</button>
      <button class="btn sm solid" id="obStart">Commencer la formation <i data-lucide="arrow-right"></i></button>
    </div>
    <label class="ob-reduce-row"><input type="checkbox" id="obReduceToggle" ${reduced ? 'checked' : ''}> Réduire les animations</label>
  </div>`;
}

function obRenderStep(n){
  const s = STEPS[n-1];
  return `<div class="ob-card">
    ${obProgressDots()}
    <div class="ob-step-head">
      ${agentCompact(s.pose)}
      <div class="ob-bubble-main"><b>${s.title}</b><p>${s.bubble}</p></div>
    </div>
    <div class="ob-step-body">${s.body}</div>
    <div class="ob-actions">
      <button class="btn sm ghost" id="obBack" ${n===1?'style="visibility:hidden"':''}>← Retour</button>
      <button class="btn sm solid" id="obNext">${n===STEPS.length?'Continuer vers le quiz':'Continuer'} <i data-lucide="arrow-right"></i></button>
    </div>
  </div>`;
}

function obRenderQuiz(){
  return `<div class="ob-card">
    <h2><i data-lucide="flask-conical" class="ob-inline-ic ob-inline-ic-lg"></i> Petite vérification</h2>
    <div class="ob-chat"><div class="ob-bubble ob-them">${QUIZ.patient}</div></div>
    <p><b>${QUIZ.question}</b></p>
    <div class="ob-quiz-opts">
      ${QUIZ.options.map(o=>`<button class="ob-opt" data-ok="${o.ok}">${o.id}. ${o.text}</button>`).join('')}
    </div>
    <div class="ob-quiz-feedback" id="obFeedback" hidden></div>
  </div>`;
}

function obRenderDone(){
  return `<div class="ob-card ob-intro">
    <div class="ob-mascot-stage">${agentCompact('congrats')}${CONFETTI}</div>
    <h2 class="ob-pop"><i data-lucide="graduation-cap" class="ob-inline-ic ob-inline-ic-lg"></i> Formation terminée !</h2>
    <p>Vous connaissez maintenant les principales étapes d'utilisation de MI-AINA.</p>
    <ul class="ob-recap">
      ${['Bienvenue','Votre rôle','Accueillir un patient','Créer une consultation','Le dispositif MI-AINA',"L'aide de l'IA",'Contacter un médecin']
        .map((t,i)=>`<li style="--i:${i}"><i data-lucide="check" class="ob-inline-ic"></i> ${t}</li>`).join('')}
    </ul>
    <div class="ob-actions">
      <button class="btn sm ghost" id="obReplay">Revoir la formation</button>
      <button class="btn sm solid" id="obGoSaisie">Commencer une consultation <i data-lucide="arrow-right"></i></button>
    </div>
  </div>`;
}

function obRender(){
  const view = $ob('#view-onboarding');
  if (!view) return;
  let html;
  if (obIndex === 0) html = obRenderIntro();
  else if (obIndex <= STEPS.length) html = obRenderStep(obIndex);
  else if (obIndex === STEPS.length + 1) html = obRenderQuiz();
  else html = obRenderDone();

  view.innerHTML = `<div class="ob-wrap${obIsReduced() ? ' ob-reduced' : ''}"><div class="ob-bg"></div><div class="ob-content">${html}</div></div>`;
  obBindActions();
  MI.refreshIcons && MI.refreshIcons();
  if (window.lucide && lucide.createIcons) lucide.createIcons();
  if (obIndex === 5) obAnimateDevice();
}

function obGo(n){
  obIndex = n;
  localStorage.setItem(LS_STEP, String(n));
  obRender();
}

function obBindActions(){
  const skip = $ob('#obSkip'); if (skip) skip.onclick = () => MI.setView('overview');
  const start = $ob('#obStart'); if (start) start.onclick = () => obGo(1);
  const next = $ob('#obNext'); if (next) next.onclick = () => obGo(obIndex + 1);
  const back = $ob('#obBack'); if (back) back.onclick = () => obGo(Math.max(1, obIndex - 1));
  const replay = $ob('#obReplay'); if (replay) replay.onclick = () => obGo(0);
  const reduceToggle = $ob('#obReduceToggle');
  if (reduceToggle) reduceToggle.onchange = () => {
    const wrap = document.querySelector('#view-onboarding .ob-wrap');
    if (reduceToggle.checked) { localStorage.setItem(LS_REDUCED, '1'); if (wrap) wrap.classList.add('ob-reduced'); }
    else { localStorage.removeItem(LS_REDUCED); if (wrap) wrap.classList.remove('ob-reduced'); }
  };
  const goSaisie = $ob('#obGoSaisie'); if (goSaisie) goSaisie.onclick = () => {
    localStorage.setItem(LS_DONE, '1');
    MI.setView('saisie');
  };
  document.querySelectorAll('#view-onboarding .ob-opt').forEach(btn => {
    btn.onclick = () => {
      const ok = btn.dataset.ok === 'true';
      document.querySelectorAll('#view-onboarding .ob-opt').forEach(b => b.disabled = true);
      btn.classList.add(ok ? 'good' : 'bad');
      const fb = $ob('#obFeedback');
      fb.hidden = false;
      fb.innerHTML = ok
        ? `<div class="ob-fb-row">${agentCompact('encourage')}<div><p class="ob-fb-good"><i data-lucide="check-circle-2" class="ob-inline-ic"></i> Très bien ! On recueille toujours les symptômes avant de faire appel à l'aide de l'IA.</p>
           <button class="btn sm solid" id="obQuizNext">Continuer <i data-lucide="arrow-right"></i></button></div></div>`
        : `<div class="ob-fb-row">${agentCompact('correct')}<div><p class="ob-fb-bad">Pas tout à fait. Dans MI-AINA, commencez par recueillir les informations du patient et ses symptômes avant d'utiliser l'aide de l'IA.</p>
           <button class="btn sm solid" id="obQuizNext">Continuer quand même <i data-lucide="arrow-right"></i></button></div></div>`;
      const qn = $ob('#obQuizNext'); if (qn) qn.onclick = () => { localStorage.setItem(LS_DONE,'1'); obGo(STEPS.length + 2); };
      if (window.lucide && lucide.createIcons) lucide.createIcons();
    };
  });
}

function bindOnboarding(){
  const saved = parseInt(localStorage.getItem(LS_STEP) || '0', 10);
  obIndex = Number.isFinite(saved) ? saved : 0;
  obRender();
}

MI.registerRenderer('onboarding', bindOnboarding);
