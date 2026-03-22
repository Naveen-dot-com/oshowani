const CACHE_NAME = 'oshowani-cache-v2';
const ASSETS_TO_CACHE = [
    './', './index.html', './style.css', './app.js', './manifest.json',
    './icons/icon-192.png', './icons/icon-512.png',
    './assets/osho-avatar.png', 'https://unpkg.com/feather-icons'
];
self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
    if (event.request.url.includes('generativelanguage.googleapis.com')) return;
    event.respondWith(
        caches.match(event.request).then(r => r || fetch(event.request)).catch(() => {
            if (event.request.mode === 'navigate') return caches.match('./index.html');
        })
    );
});
