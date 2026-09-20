const CACHE = 'chantier-v2';
const FICHIERS = [
  'index.html','fdm.html','style.css','manifest.json',
  'chantiers.json','equipements.json','config.json',
  'fdm.js','fdm-forms.js','icon-192.png','icon-512.png'
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

  // On ignore tout ce qui n'est pas une page du site :
  // extensions navigateur (chrome-extension://), POST vers Power Automate, autres domaines.
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(r => {
        const copie = r.clone();
        caches.open(CACHE).then(c => c.put(req, copie)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(req))
  );
});
