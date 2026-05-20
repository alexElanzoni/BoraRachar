const CACHE_NAME = 'borarachar-v1';
const CACHE_NAME = 'borarachar-v4';
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.json',
  './assets/icons/brand.png',
  './assets/icons/criar-viagem.png',
  './assets/icons/entrar-viagem.png',
  './assets/icons/adicionar-gasto.png',
  './assets/icons/historico.png',
  './assets/icons/grupo.png',
  './assets/icons/viagem.png',
  './assets/icons/quem-paga-quem.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  self.clients.claim();
});
