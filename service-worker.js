const CACHE = 'chantier-v3';
const FICHIERS = [
  'index.html','fdm.html','colisage.html','style.css','manifest.json',
  'chantiers.json','equipements.json','conteneurs.json','config.json',
  'fdm.js','fdm-forms.js','photos.js','colisage.js','icon-192.png','icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(FICHIERS.map(f => c.add(f))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Lecteur QR de secours (jsQR) : mis en cache pour fonctionner hors réseau
  const estJsQR = url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/jsqr@');
  if (url.origin !== self.location.origin && !estJsQR) return;

  e.respondWith(
    fetch(req)
      .then(r => {
        if (r.ok || r.type === 'opaque') {
          const copie = r.clone();
          caches.open(CACHE).then(c => c.put(req, copie)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(req))
  );
});
