(function () {
  const win = document.getElementById('ainaFloatWindow');
  const form = document.getElementById('ainaForm');
  const toggle = document.getElementById('ainaFloatToggle');
  if (!win || !form || !toggle) return;

  const messages = document.getElementById('ainaMsgs');
  const input = document.getElementById('ainaTxt');
  const fileInput = document.getElementById('ainaFileInput');
  const fileBar = document.getElementById('ainaFileBar');
  const positionKey = 'miaina.aina.position.v1';
  const margin = 12;
  let file = null;
  let drag = null;
  let wasDragged = false;
  let suppressClickUntil = 0;

  const csrf = () => decodeURIComponent((document.cookie.match(/(?:^|; )csrftoken=([^;]+)/) || [])[1] || '');
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
  const bounds = () => ({width: toggle.offsetWidth, height: toggle.offsetHeight});

  function savePosition() {
    const rect = toggle.getBoundingClientRect();
    const size = bounds();
    const maxX = Math.max(1, window.innerWidth - size.width);
    const maxY = Math.max(1, window.innerHeight - size.height);
    try {
      localStorage.setItem(positionKey, JSON.stringify({
        x: Math.min(1, Math.max(0, rect.left / maxX)),
        y: Math.min(1, Math.max(0, rect.top / maxY))
      }));
    } catch (_) {}
  }

  function restorePosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
      if (!saved || !Number.isFinite(saved.x) || !Number.isFinite(saved.y)) return;
      const size = bounds();
      toggle.style.left = clamp(saved.x * (window.innerWidth - size.width), margin,
        window.innerWidth - size.width - margin) + 'px';
      toggle.style.top = clamp(saved.y * (window.innerHeight - size.height), margin,
        window.innerHeight - size.height - margin) + 'px';
      toggle.style.right = 'auto';
      toggle.style.bottom = 'auto';
    } catch (_) {}
  }

  function snapToNearestEdge() {
    const size = bounds();
    const rect = toggle.getBoundingClientRect();
    let x = rect.left, y = rect.top;
    const gaps = [
      {edge:'left', distance:x},
      {edge:'right', distance:window.innerWidth - rect.right},
      {edge:'top', distance:y},
      {edge:'bottom', distance:window.innerHeight - rect.bottom}
    ].sort((a, b) => a.distance - b.distance);
    const dockClearance = window.innerWidth <= 760 ? 98 : 116;
    switch (gaps[0].edge) {
      case 'left': x = margin; y = clamp(y, margin, window.innerHeight - size.height - dockClearance); break;
      case 'right':
        x = window.innerWidth - size.width - margin;
        y = clamp(y, margin, window.innerHeight - size.height - dockClearance);
        break;
      case 'top': y = margin; break;
      case 'bottom':
        // Keep the floating action above the fixed navigation dock.
        y = window.innerHeight - size.height - (window.innerWidth <= 760 ? 86 : 104);
        break;
    }
    x = clamp(x, margin, window.innerWidth - size.width - margin);
    y = clamp(y, margin, window.innerHeight - size.height - margin);
    toggle.style.left = x + 'px';
    toggle.style.top = y + 'px';
    toggle.style.right = 'auto';
    toggle.style.bottom = 'auto';
    savePosition();
  }

  function placeWindow() {
    const rect = toggle.getBoundingClientRect();
    const panel = win.getBoundingClientRect();
    const width = panel.width || Math.min(390, window.innerWidth - 28);
    const height = panel.height || Math.min(560, window.innerHeight - 28);
    const x = clamp(rect.right - width, margin, window.innerWidth - width - margin);
    let y = rect.top - height - 12;
    if (y < margin) y = rect.bottom + 12;
    y = clamp(y, margin, window.innerHeight - height - margin);
    win.style.left = x + 'px';
    win.style.top = y + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  }

  const add = (role, text) => {
    const item = document.createElement('div');
    item.className = 'msg ' + (role === 'user' || role === 'me' ? 'me' : 'them');
    item.textContent = text;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  };
  const history = () => fetch('/assistant/history/', {credentials:'same-origin'})
    .then(r => r.json()).then(data => {
      if (!data.ok || !Array.isArray(data.items)) return;
      messages.replaceChildren();
      data.items.forEach(item => add(item.role, item.texte || item.piece || ''));
    }).catch(() => {});

  function open() {
    win.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(placeWindow);
    history();
    input.focus();
  }
  function close() {
    win.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', event => {
    if (wasDragged || Date.now() < suppressClickUntil) {
      event.preventDefault();
      wasDragged = false;
      return;
    }
    if (win.hidden) open(); else close();
  });
  ['ainaFloatMin', 'ainaFloatClose'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', close);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !win.hidden) {
      close();
      toggle.focus();
    }
    if (document.activeElement === toggle && event.altKey &&
        ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const rect = toggle.getBoundingClientRect();
      const step = event.shiftKey ? 40 : 12;
      const x = clamp(rect.left + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        margin, window.innerWidth - toggle.offsetWidth - margin);
      const y = clamp(rect.top + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
        margin, window.innerHeight - toggle.offsetHeight - margin);
      toggle.style.left = x + 'px'; toggle.style.top = y + 'px';
      toggle.style.right = 'auto'; toggle.style.bottom = 'auto';
      savePosition();
    }
  });

  toggle.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = toggle.getBoundingClientRect();
    drag = {pointerId:event.pointerId, startX:event.clientX, startY:event.clientY,
      left:rect.left, top:rect.top, moved:false};
    toggle.setPointerCapture?.(event.pointerId);
  });
  toggle.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    wasDragged = true;
    toggle.classList.add('dragging');
    event.preventDefault();
    toggle.style.left = clamp(drag.left + dx, margin, window.innerWidth - toggle.offsetWidth - margin) + 'px';
    toggle.style.top = clamp(drag.top + dy, margin, window.innerHeight - toggle.offsetHeight - margin) + 'px';
    toggle.style.right = 'auto'; toggle.style.bottom = 'auto';
  });
  function endDrag(event) {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const moved = drag.moved;
    drag = null;
    toggle.classList.remove('dragging');
    if (moved) {
      snapToNearestEdge();
      suppressClickUntil = Date.now() + 300;
      window.setTimeout(() => { wasDragged = false; }, 320);
    }
  }
  toggle.addEventListener('pointerup', endDrag);
  toggle.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => {
    restorePosition();
    if (!win.hidden) placeWindow();
  });
  restorePosition();

  document.getElementById('ainaFileBtn')?.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    file = fileInput.files[0] || null;
    fileBar.hidden = !file;
    document.getElementById('ainaFilePreview').textContent = file ? file.name : '';
  });
  document.getElementById('ainaFileCancel')?.addEventListener('click', () => {
    file = null; fileInput.value = ''; fileBar.hidden = true;
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text && !file) return;
    if (text) add('me', text);
    else if (file) add('me', file.name);
    const pending = add('aina', 'AINA prépare une réponse…');
    const data = new FormData(); data.append('texte', text); if (file) data.append('piece', file);
    input.value = ''; file = null; fileInput.value = ''; fileBar.hidden = true;
    fetch('/assistant/send/', {method:'POST', credentials:'same-origin',
      headers:{'X-CSRFToken':csrf()}, body:data})
      .then(r => r.json()).then(result => {
        pending.remove();
        add('aina', result.ok ? result.reponse : (result.erreur || 'Assistant indisponible.'));
      }).catch(() => { pending.remove(); add('aina', 'Erreur de connexion à AINA.'); });
  });
  document.getElementById('ainaReset')?.addEventListener('click', () => fetch('/assistant/reset/', {
    method:'POST', credentials:'same-origin', headers:{'X-CSRFToken':csrf()}
  }).then(() => { messages.replaceChildren(); history(); }));
})();
