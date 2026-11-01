// Service worker minimal : il rend le site installable sur l'écran d'accueil (Android, Chrome, Edge).
// Il ne met rien en cache et laisse passer toutes les requêtes telles quelles (vidéos comprises).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
