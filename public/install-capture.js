// Chargé avant React sur toutes les pages : Android (Chrome, Edge, Samsung Internet) n'annonce qu'une fois,
// très tôt, que le site peut être installé. On garde cette autorisation pour le bouton « Installer ».
(function () {
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window.__yfInstallPrompt = event;
    window.dispatchEvent(new Event('yf-install-ready'));
  });
  window.addEventListener('appinstalled', function () {
    window.__yfInstallPrompt = null;
    try { localStorage.setItem('yf_apps_owned_v3', '1'); } catch (e) { /* stockage indisponible */ }
    window.dispatchEvent(new Event('yf-installed'));
  });
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
})();
