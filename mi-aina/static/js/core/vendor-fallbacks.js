/* ================================================================
   MI-AINA — garde-fous CDN (extrait de base.html)
   Recharge chaque bibliothèque depuis un miroir si le CDN principal
   n'a pas répondu. Aucune logique applicative ici.
   ================================================================ */
(function () {
  var mirrors = [
    ['lucide', 'https://cdn.jsdelivr.net/npm/lucide@0.462.0/dist/umd/lucide.min.js'],
    ['lucide', 'https://unpkg.com/lucide@0.462.0/dist/umd/lucide.min.js'],
    ['L', 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'],
    ['L', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.min.js'],
    ['L', 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.min.js']
  ];
  mirrors.forEach(function (m) {
    var lib = m[0], url = m[1];
    var manquant = lib === 'lucide' ? !window.lucide : (url.indexOf('markercluster') > -1 ? !(window.L && window.L.MarkerClusterGroup) : !window.L);
    if (manquant) document.write('<script src="' + url + '"><\/script>');
  });
})();