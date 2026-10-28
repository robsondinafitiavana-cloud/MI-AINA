/* ================================================================
   MI-AINA — Login (intégration Django)
   Règle : apostrophe TYPOGRAPHIQUE (') dans les textes FR du JS.
   ================================================================ */
const $  = s => document.querySelector(s);
const panel = $('#panel');
const AUTH_ILLUSTRATION = document.querySelector('meta[name="mi-auth-illustration"]')?.content || '/static/img/miaina-auth-illustration.svg';
const AUTH_ARTS = {
  agent: document.querySelector('meta[name="mi-auth-agent"]')?.content || AUTH_ILLUSTRATION,
  medecin: document.querySelector('meta[name="mi-auth-medecin"]')?.content || AUTH_ILLUSTRATION,
  administration: document.querySelector('meta[name="mi-auth-administration"]')?.content || AUTH_ILLUSTRATION,
};
const REGISTER_URL = (() => {
  const node = document.getElementById('mi-register-url');
  if (!node) return '';
  try { return JSON.parse(node.textContent); } catch (_) { return ''; }
})();
const refreshIcons = () => { if (window.lucide && lucide.createIcons) lucide.createIcons(); };

/* ---------- Logo MI-AINA : fichier de marque partagé ---------- */
const BRAND_LOGO = document.querySelector('meta[name="mi-brand-logo"]')?.content || '/static/img/logo.png';
document.querySelectorAll('[data-logo]').forEach(el => {
  el.innerHTML = `<img src="${BRAND_LOGO}" alt="Logo MI-AINA" style="width:100%;height:100%;object-fit:contain;display:block">`;
});

/* ---------- Rôles (clés = valeurs Django du ChoiceField) ---------- */
const ROLES = {
  PREMIERE_LIGNE: {
    key:'PREMIERE_LIGNE', num:'01', accent:'#007E3A', icon:'scan-line', register:true,
    role:'Agent', art:'agent', subtitle:'Collecte & suivi patient',
    audience:'Agent communautaire · Infirmier · Sage-femme',
    headline:'Espace agent',
    tagline:'Chaque dossier saisi au village rejoint le système national — avec ou sans réseau.',
    form:{
      idLabel:'Matricule agent', idIcon:'id-card', idPlaceholder:'MG-T-2041',
      idHint:'Matricule attribué par votre CSB de rattachement.',
    },
    cta:'Ouvrir la saisie du jour',
    forgot:'Présentez-vous au <strong>CSB de rattachement</strong> avec votre pièce d\u2019identité : le référent réinitialise votre accès depuis la console locale.',
  },
  MEDECIN: {
    key:'MEDECIN', num:'02', accent:'#C1272D', icon:'stethoscope', register:true,
    role:'Médecin', art:'medecin', subtitle:'Prise en charge',
    audience:'Généraliste · Spécialiste · Médecin de garde',
    headline:'Espace de prise en charge',
    tagline:'Les cas urgents remontés du terrain arrivent ici, triés et pré-analysés par l\u2019IA.',
    form:{
      idLabel:'N° d\u2019ordre / ID Médecin', idIcon:'badge-check', idPlaceholder:'MG-M-0716',
      idHint:'Numéro délivré par l\u2019Ordre des Médecins de Madagascar.',
    },
    cta:'Ouvrir la file d\u2019expertise',
    forgot:'Adressez une demande signée au <strong>secrétariat de l\u2019Ordre régional</strong>, ou écrivez depuis votre e-mail professionnel.',
  },
  PILOTAGE: {
    key:'PILOTAGE', num:'03', accent:'#1C4030', icon:'landmark',
    role:'Administration', art:'administration', subtitle:'Supervision nationale',
    audience:'Responsable CSB · Épidémiologiste · Ministère',
    headline:'Espace administration',
    tagline:'La carte du pays et les chiffres qui comptent — pour décider avant que ça s\u2019étende.',
    form:{
      idLabel:'E-mail institutionnel', idIcon:'mail', idPlaceholder:'prenom.nom@sante.gov.mg', email:true,
      idHint:'Adresse officielle — compte créé par le Ministère uniquement.',
    },
    cta:'Ouvrir le tableau de bord',
    forgot:'Réinitialisation par le <strong>super-admin du Ministère</strong> uniquement. Contactez supervision@sante.gov.mg.',
  },
};

/* ---------- Toasts ---------- */
const T_ICONS = {success:'circle-check', error:'circle-alert', info:'info'};
function toast(msg, type){
  type = type || 'info';
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = '<i data-lucide="' + T_ICONS[type] + '"></i><span>' + msg + '</span>';
  $('#toasts').appendChild(el);
  refreshIcons();
  setTimeout(()=>{ el.classList.add('out'); setTimeout(()=>el.remove(), 320); }, 4200);
}

/* ---------- Vue : panneau de connexion ---------- */
function renderLogin(key){
  const R = ROLES[key];
  document.documentElement.style.setProperty('--accent', R.accent);
  panel.innerHTML = `
    <div class="panel-inner">
      <div class="login-hero"><div><div class="role-head"><span class="role-badge">ESPACE ${R.role.toUpperCase()}</span></div>
      <h2>${R.headline}</h2>
      <p class="audience">${R.audience}</p></div>
      <img class="login-hero-art" src="${AUTH_ARTS[R.art] || AUTH_ILLUSTRATION}" alt="" aria-hidden="true"></div>
      <p class="tagline">${R.tagline}</p>

      <form class="login-form" id="uiForm" novalidate>
        <div class="field" id="idField">
          <label for="idInput">${R.form.idLabel}</label>
          <div class="input-wrap">
            <i data-lucide="${R.form.idIcon}" class="lead"></i>
            <input id="idInput" type="${R.form.email ? 'email' : 'text'}" placeholder="${R.form.idPlaceholder}" autocomplete="username" spellcheck="false">
          </div>
          <p class="hint">${R.form.idHint}</p>
          <p class="err" id="idErr"></p>
        </div>

        <div class="field" id="pwField">
          <label for="pwInput">Mot de passe</label>
          <div class="input-wrap">
            <i data-lucide="key-round" class="lead"></i>
            <input id="pwInput" type="password" placeholder="••••••••" autocomplete="current-password">
            <button type="button" class="eye-btn" id="eyeBtn" aria-label="Afficher le mot de passe">
              <i data-lucide="eye" class="icon-on"></i><i data-lucide="eye-off" class="icon-off"></i>
            </button>
          </div>
          <p class="err" id="pwErr"></p>
          <div class="caps-hint" id="capsHint" hidden><i data-lucide="arrow-big-up"></i>Verrouillage majuscule activé</div>
        </div>

        <div class="row-between">
          <label class="check">
            <input type="checkbox" id="rememberMe">
            <span class="box"><i data-lucide="check"></i></span>
            Rester connecté 30 jours
          </label>
          <button type="button" class="forgot-link" id="forgotLink" style="border:none;background:none;font-size:12.5px;color:var(--ink-70);cursor:pointer;text-decoration:underline;text-underline-offset:3px">Mot de passe oublié ?</button>
        </div>
        <div class="forgot-box" id="forgotBox" hidden style="margin:-6px 0 18px;padding:12px 15px;font-size:12.5px;line-height:1.55;color:var(--ink-70);border-left:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 6%,transparent);border-radius:0 3px 3px 0">${R.forgot}</div>

        <button class="submit" id="submitBtn" type="submit">
          <span class="spinner"></span>
          <span class="btn-label">${R.cta}</span>
          <i data-lucide="arrow-right"></i>
        </button>
      </form>

      ${R.register && REGISTER_URL ? `<p class="signup-note" style="margin-top:14px;font-size:12.5px;color:var(--ink-70)">Pas encore de compte ? <a style="color:var(--accent);font-weight:600" href="${REGISTER_URL}">Créer un compte Agent ou Médecin</a></p>` : ''}

      <p class="secure-note"><i data-lucide="shield-check"></i>
        Connexion chiffrée · Aucune donnée patient n\u2019est conservée sur cet appareil.</p>
    </div>`;
  refreshIcons();
  bindForm(R);
}

/* ---------- Câblage : validations locales puis POST Django ---------- */
function bindForm(R){
  const idInput = $('#idInput'), pwInput = $('#pwInput');
  const idField = $('#idField'), pwField = $('#pwField');
  const btn = $('#submitBtn');

  const setErr = (f, msg) => { f.classList.add('invalid'); f.querySelector('.err').textContent = msg; };
  const clear = () => { [idField, pwField].forEach(f => f.classList.remove('invalid')); };

  $('#eyeBtn').addEventListener('click', () => {
    const show = pwInput.type === 'password';
    pwInput.type = show ? 'text' : 'password';
    $('#eyeBtn').classList.toggle('show', show);
  });
  const caps = e => { if (e.getModifierState) $('#capsHint').hidden = !e.getModifierState('CapsLock'); };
  pwInput.addEventListener('keydown', caps);
  pwInput.addEventListener('keyup', caps);
  pwInput.addEventListener('blur', () => $('#capsHint').hidden = true);
  [idInput, pwInput].forEach(i => i.addEventListener('input', () => i.closest('.field').classList.remove('invalid')));

  $('#forgotLink').addEventListener('click', () => { $('#forgotBox').hidden = !$('#forgotBox').hidden; });

  $('#uiForm').addEventListener('submit', e => {
    e.preventDefault();
    clear();
    const id = idInput.value.trim(), pw = pwInput.value;
    let ok = true;
    if (R.form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id)) {
      setErr(idField, 'Renseignez un e-mail institutionnel valide.'); ok = false;
    } else if (id.length < 3) {
      setErr(idField, 'Renseignez votre ' + R.form.idLabel.toLowerCase() + '.'); ok = false;
    }
    if (pw.length < 4) { setErr(pwField, 'Mot de passe : 4 caractères minimum.'); ok = false; }
    if (!ok) { toast('Vérifiez les champs signalés en rouge.', 'error'); return; }

    // Soumission réelle vers Django
    btn.classList.add('loading');
    $('#fRole').value = R.key;
    $('#fIdent').value = id;
    $('#fPass').value = pw;
    $('#fRem').value = $('#rememberMe').checked ? '1' : '';
    $('#realForm').submit();          // Django valide, redirige ou renvoie les erreurs
  });

  setTimeout(() => idInput.focus({ preventScroll:true }), 150);
}

/* ---------- Sélecteur de rôle + clavier ---------- */
const entries = document.querySelectorAll('.role-entry');
function selectRole(key){
  entries.forEach(b => {
    const active = b.dataset.key === key;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.body.dataset.loginRole = key.toLowerCase();
  renderLogin(key);
}
entries.forEach(b => b.addEventListener('click', () => selectRole(b.dataset.key)));
document.addEventListener('keydown', e => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === '1') selectRole('PREMIERE_LIGNE');
  if (e.key === '2') selectRole('MEDECIN');
  if (e.key === '3') selectRole('PILOTAGE');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const keys = Object.keys(ROLES);
    const cur = document.querySelector('.role-entry.active').dataset.key;
    const i = keys.indexOf(cur);
    selectRole(keys[(i + (e.key === 'ArrowDown' ? 1 : keys.length - 1)) % keys.length]);
  }
});

/* ---------- Horloge + réseau + compteurs vivants ---------- */
setInterval(() => {
  $('#clock').textContent = new Date().toLocaleTimeString('fr-FR',
    {hour:'2-digit', minute:'2-digit', second:'2-digit', timeZone:'Indian/Antananarivo'}) + ' · ANTANANARIVO';
}, 1000);

function refreshNet(){
  const on = navigator.onLine, b = $('#netBadge');
  b.className = 'net-badge ' + (on ? 'on' : 'off');
  b.innerHTML = '<span class="dot"></span>' + (on ? 'En ligne' : 'Hors-ligne · file locale active');
}
window.addEventListener('online',  () => { refreshNet(); toast('Connexion rétablie — synchronisation de la file locale…', 'success'); });
window.addEventListener('offline', () => { refreshNet(); toast('Réseau perdu — passage en mode hors-ligne.', 'error'); });
refreshNet();

/* ---------- Erreurs serveur (renvoyées par Django après échec) ---------- */
/* Lecture des données serveur depuis les îles JSON du template. */
const _ile = function (id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent); } catch (e) { return null; }
};
const SERVER_ERRORS = (window.MI_LOGIN && window.MI_LOGIN.errors) ||
  Array.prototype.slice.call(document.querySelectorAll('#mi-login-errors li'))
    .map(function (li) { return li.textContent.trim(); })
    .filter(Boolean);
SERVER_ERRORS.forEach(m => toast(m, 'error'));

/* ---------- Initialisation ---------- */
const INIT = (window.MI_LOGIN && window.MI_LOGIN.role) || _ile('mi-login-role') || 'PREMIERE_LIGNE';
selectRole(ROLES[INIT] ? INIT : 'PREMIERE_LIGNE');
refreshIcons();
window.addEventListener('load', refreshIcons);
