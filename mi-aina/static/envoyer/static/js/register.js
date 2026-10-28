/* ================================================================
   MI-AINA â€” Inscription (wizard 4 Ã©tapes, intÃ©gration Django)
   Aucune donnÃ©e n'est inventÃ©e : tous les champs manipulÃ©s ici sont
   les vrais champs de accounts.forms.RegisterForm.
   ================================================================ */
const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
const refreshIcons = () => { if (window.lucide && lucide.createIcons) lucide.createIcons(); };

/* ---------- Logo MI-AINA : fichier de marque partagé ---------- */
const BRAND_LOGO = document.querySelector('meta[name="mi-brand-logo"]')?.content || '/static/img/logo.png';
$$('[data-logo]').forEach(el => {
  el.innerHTML = `<img src="${BRAND_LOGO}" alt="Logo MI-AINA" style="width:100%;height:100%;object-fit:contain;display:block">`;
});

/* ============================================================
   Ã‰TAPES (stepper)
   ============================================================ */
const STEPS = [1, 2, 3, 4];
let current = 1;

function goToStep(n, opts){
  opts = opts || {};
  if (!opts.silent && n > current && !validateStep(current)) return;
  current = n;
  $$('.step').forEach(s => s.classList.toggle('active', Number(s.dataset.step) === n));
  $$('.step-tab').forEach(t => {
    const num = Number(t.dataset.tab);
    t.classList.toggle('active', num === n);
    t.classList.toggle('done', num < n);
  });
  hideGlobalErr();
  refreshIcons();
  const active = $('.step.active');
  if (active) {
    const firstField = active.querySelector('input:not([type=hidden]), select');
    if (firstField && opts.focus !== false) firstField.focus({ preventScroll: true });
  }
  window.scrollTo({ top: $('.card').getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' });
}

$$('[data-next]').forEach(b => b.addEventListener('click', () => goToStep(current + 1)));
$$('[data-back]').forEach(b => b.addEventListener('click', () => goToStep(current - 1, { silent: true })));

$$('.step-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const n = Number(tab.dataset.tab);
    if (n < current) goToStep(n, { silent: true });
  });
  tab.style.cursor = 'pointer';
});

/* ============================================================
   VALIDATION CLIENT (avant-goÃ»t â€” le serveur reste la rÃ©fÃ©rence)
   ============================================================ */
function setFieldError(field, msg){
  field.classList.add('invalid');
  const err = field.querySelector('.err');
  if (err) {
    const span = err.querySelector('span') || err;
    if (span.tagName === 'SPAN' && span.parentElement === err) span.textContent = msg;
    else err.lastChild ? (err.lastChild.textContent = msg) : (err.textContent = msg);
  }
}
function clearFieldError(field){
  field.classList.remove('invalid');
}

function validateStep(n){
  let ok = true;
  const step = $('.step[data-step="' + n + '"]');
  if (!step) return true;

  if (n === 1) {
    ['#id_prenom', '#id_nom'].forEach(sel => {
      const input = $(sel, step);
      if (!input) return;
      const field = input.closest('.field');
      if (!input.value.trim()) { setFieldError(field, 'Ce champ est requis.'); ok = false; }
      else clearFieldError(field);
    });
  }
  if (n === 2) {
    const ident = $('#id_identifiant', step);
    const field = ident.closest('.field');
    const role = $('#id_role').value;
    const val = ident.value.trim().toUpperCase();
    if (!val) { setFieldError(field, 'Ce champ est requis.'); ok = false; }
    else if (role === 'PREMIERE_LIGNE' && !val.startsWith('MG-T-')) {
      setFieldError(field, 'Le matricule doit commencer par MG-T- (ex : MG-T-2041).'); ok = false;
    } else if (role === 'MEDECIN' && !val.startsWith('MG-M-')) {
      setFieldError(field, "Le numÃ©ro d'ordre doit commencer par MG-M- (ex : MG-M-0716)."); ok = false;
    } else clearFieldError(field);
  }
  if (n === 3) {
    const role = $('#id_role').value;
    if (role === 'PREMIERE_LIGNE') {
      const csb = $('#id_csb', step);
      const field = csb.closest('.field');
      if (!csb.value) { setFieldError(field, 'SÃ©lectionnez votre CSB de rattachement.'); ok = false; }
      else clearFieldError(field);
    } else {
      const etab = $('#id_etablissement', step);
      const field = etab.closest('.field');
      if ($('#id_csb', step).value && etab.value.trim()) {
        setFieldError(field, 'Choisissez un CSB ou un établissement, pas les deux.'); ok = false;
      } else if (!etab.value.trim() && !$('#id_csb', step).value) {
        setFieldError(field, 'Choisissez un CSB ou indiquez votre établissement.'); ok = false;
      } else clearFieldError(field);
    }
  }
  if (n === 4) {
    const p1 = $('#id_password1', step), p2 = $('#id_password2', step);
    const f1 = p1.closest('.field'), f2 = p2.closest('.field');
    if (p1.value.length < 8) { setFieldError(f1, '8 caractÃ¨res minimum.'); ok = false; }
    else clearFieldError(f1);
    if (p1.value !== p2.value) { setFieldError(f2, 'Les mots de passe ne correspondent pas.'); ok = false; }
    else clearFieldError(f2);
  }
  return ok;
}

/* ============================================================
   ERREUR GLOBALE
   ============================================================ */
function showGlobalErr(msg){
  const box = $('#globalErr');
  $('#globalErrTxt').textContent = msg;
  box.classList.add('show');
}
function hideGlobalErr(){ $('#globalErr').classList.remove('show'); }

/* ============================================================
   RÃ”LE â€” cartes + champs dynamiques
   ============================================================ */
const IDENT_META = {
  PREMIERE_LIGNE: { label: 'Matricule', hint: 'Format : MG-T-XXXX', placeholder: 'Ex. MG-T-2041' },
  MEDECIN:        { label: "NumÃ©ro d'ordre", hint: 'Format : MG-M-XXXX', placeholder: 'Ex. MG-M-0716' },
};

function applyRole(role, opts){
  opts = opts || {};
  const roleSelect = $('#id_role');
  if (roleSelect) roleSelect.value = role;

  $$('.role-card').forEach(c => {
    const active = c.dataset.role === role;
    c.classList.toggle('active', active);
    c.setAttribute('aria-pressed', String(active));
  });

  const meta = IDENT_META[role] || IDENT_META.PREMIERE_LIGNE;
  $('#identLabel').textContent = meta.label;
  $('#identHint').textContent = meta.hint;
  const identInput = $('#id_identifiant');
  if (identInput) identInput.placeholder = meta.placeholder;

  $('#fieldCsb').hidden = false;
  $('#fieldEtab').hidden = role === 'PREMIERE_LIGNE';

  if (!opts.silent) {
    const field = identInput.closest('.field');
    clearFieldError(field);
  }
}

$$('.role-card').forEach(card => {
  card.addEventListener('click', () => applyRole(card.dataset.role));
});

/* ============================================================
   RÃ‰GION â†’ DISTRICT â†’ CSB (mÃªme pattern que templates/csb/form.html)
   ============================================================ */
const regionSelect   = $('#id_region');
const districtSelect = $('#id_district');
const csbSelect       = $('#id_csb');

function splitLabel(text){
  // "Nom Â· Qualificatif" -> ['Nom', 'Qualificatif']
  const parts = text.split(' · ');
  return parts.length > 1 ? parts[1] : '';
}
function normalizeLocation(value){
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function buildOptionCache(select){
  return $$('option', select).map(o => ({
    value: o.value, text: o.textContent, qualifier: splitLabel(o.textContent),
  }));
}

if (regionSelect && districtSelect) {
  const districtOptions = buildOptionCache(districtSelect);

  function filterDistricts(){
    const selected = districtSelect.value;
    const region = regionSelect.value;
    districtSelect.innerHTML = '';
    districtOptions
      .filter(o => !o.value || !region || normalizeLocation(o.qualifier) === normalizeLocation(region))
      .forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.text;
        districtSelect.add(opt);
      });
    districtSelect.value = districtOptions.some(o => o.value === selected &&
      (!region || normalizeLocation(o.qualifier) === normalizeLocation(region))) ? selected : '';
    filterCsb();
  }

  regionSelect.addEventListener('change', filterDistricts);
  districtSelect.addEventListener('change', filterCsb);

  var csbOptionsCache = csbSelect ? $$('option', csbSelect).map(o => ({
    value: o.value, text: o.textContent,
    region: o.dataset.region || '', district: o.dataset.district || '',
  })) : [];

  function filterCsb(){
    if (!csbSelect) return;
    const selected = csbSelect.value;
    const district = districtSelect.value;
    const region = regionSelect.value;
    csbSelect.innerHTML = '';
    csbOptionsCache
      .filter(o => !o.value || ((!district || normalizeLocation(o.district) === normalizeLocation(district)) &&
        (!region || normalizeLocation(o.region) === normalizeLocation(region))))
      .forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.text;
        csbSelect.add(opt);
      });
    csbSelect.value = csbOptionsCache.some(o => o.value === selected &&
      (!district || normalizeLocation(o.district) === normalizeLocation(district)) &&
      (!region || normalizeLocation(o.region) === normalizeLocation(region))) ? selected : '';
  }

  // Ã‰tat initial : respecte une sÃ©lection dÃ©jÃ  prÃ©sente (rechargement aprÃ¨s erreur serveur)
  filterDistricts();
}

/* ============================================================
   MOT DE PASSE â€” afficher/masquer + robustesse
   ============================================================ */
$$('.eye-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.eyeFor;
    const input = document.getElementById(id);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.classList.toggle('show', show);
    btn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
  });
});

const pw1 = $('#id_password1');
if (pw1) {
  const bars = $$('.pw-meter i');
  const label = $('#pwMeterLabel');
  const LEVELS = [
    { min: 0, text: 'Saisissez un mot de passe', color: 'var(--line-strong)' },
    { min: 1, text: 'Trop court', color: '#C1272D' },
    { min: 2, text: 'Faible', color: '#9A6A1F' },
    { min: 3, text: 'Correct', color: '#9A6A1F' },
    { min: 4, text: 'Robuste', color: '#007E3A' },
  ];
  function score(v){
    if (!v) return 0;
    if (v.length < 8) return 1;
    let s = 1;
    if (v.length >= 10) s++;
    if (/[0-9]/.test(v) && /[a-zA-Z]/.test(v)) s++;
    if (/[^a-zA-Z0-9]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v))) s++;
    return Math.min(s, 4);
  }
  pw1.addEventListener('input', () => {
    const s = score(pw1.value);
    const lvl = LEVELS[s] || LEVELS[0];
    bars.forEach((bar, i) => { bar.style.background = i < s ? lvl.color : 'var(--line-strong)'; });
    label.textContent = lvl.text;
    label.style.color = s ? lvl.color : 'var(--ink-50)';
  });
}

/* ============================================================
   SOUMISSION
   ============================================================ */
const form = $('#regForm');
form.addEventListener('submit', (e) => {
  if (!validateStep(4)) { e.preventDefault(); return; }
  const btn = $('#submitBtn');
  btn.classList.add('loading');
});

/* ============================================================
   INITIALISATION â€” reprise aprÃ¨s erreurs serveur
   ============================================================ */
(function init(){
  const roleSelectEl = $('#id_role');
  if (roleSelectEl) roleSelectEl.tabIndex = -1;
  const initialRole = roleSelectEl ? roleSelectEl.value : 'PREMIERE_LIGNE';
  applyRole(initialRole || 'PREMIERE_LIGNE', { silent: true });

  // Message global (non_field_errors rendu par Django)
  const nfEl = document.getElementById('mi-reg-nonfield');
  if (nfEl) {
    try {
      const errs = JSON.parse(nfEl.textContent);
      if (errs && errs.length) showGlobalErr(errs.join(' '));
    } catch (e) { /* rien Ã  afficher */ }
  }

  // Si le serveur a renvoyÃ© des erreurs de champ (rechargement aprÃ¨s Ã©chec), on
  // ouvre directement l'Ã©tape concernÃ©e.
  const invalidField = $('.field.invalid, .global-err.show');
  if (invalidField) {
    const step = invalidField.closest ? invalidField.closest('.step') : null;
    if (step) goToStep(Number(step.dataset.step), { silent: true, focus: false });
  }
  if ($('#globalErr').innerHTML && $('#globalErrTxt').textContent) {
    $('#globalErr').classList.add('show');
  }

  refreshIcons();
})();
