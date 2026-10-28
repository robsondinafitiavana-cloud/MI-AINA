(function () {
  const count = document.getElementById('bellCount');
  const dot = document.getElementById('bellDot');
  const list = document.getElementById('notifList');
  const refresh = () => fetch('/notifications/feed/').then(r => r.json()).then(data => {
    if (!data.ok) return;
    const unread = Number(data.non_lues) || 0;
    if (count) { count.textContent = unread > 99 ? '99+' : String(unread); count.hidden = unread === 0; }
    if (dot) dot.hidden = unread === 0;
    if (!list) return;
    list.replaceChildren();
    (data.notifs || []).forEach(n => {
      const link = document.createElement('a');
      link.className = 'drop-item'; link.href = '/notifications/' + encodeURIComponent(n.id) + '/open/';
      link.style.cssText = 'text-decoration:none;color:inherit;' + (n.lu ? '' : 'background:rgba(0,126,58,.05)');
      const body = document.createElement('span');
      const title = document.createElement('b'); title.textContent = n.titre; body.appendChild(title);
      if (n.texte) { const text = document.createElement('small'); text.textContent = n.texte; text.style.display = 'block'; body.appendChild(text); }
      const date = document.createElement('small'); date.textContent = n.date; date.style.display = 'block'; body.appendChild(date);
      link.appendChild(body); list.appendChild(link);
    });
  }).catch(() => {});
  refresh();
  window.setInterval(refresh, 20000);
})();
