/**
 * OSHOWANI — Service Worker v6
 * Caching + Periodic Background Sync + Notification handling
 */

const CACHE_NAME = 'oshowani-v6';
const PROXY_URL  = 'https://oshowani-proxy.n-k-dubey1997.workers.dev';

const STATIC_ASSETS = [
    './',
    './index.html',
    './app.js',
    './style.css',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './assets/osho-avatar.png',
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache =>
            cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })))
        ).catch(() => {})
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes(PROXY_URL)) return;
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
                }
                return response;
            }).catch(() => cached);
        })
    );
});

// ── Periodic Background Sync: fires when app is closed (Android Chrome/TWA) ──
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'osho-hourly') {
        event.waitUntil(generateAndShowNotification());
    }
});

// ── Notification click: bring app to foreground ──
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            for (const client of clients) {
                if ('focus' in client) return client.focus();
            }
            return self.clients.openWindow('./');
        })
    );
});

// ── Server Push (future use) ──
self.addEventListener('push', (event) => {
    let body = 'A thought from Osho awaits you.';
    try { const d = event.data ? event.data.json() : {}; if (d.body) body = d.body; } catch {}
    event.waitUntil(
        self.registration.showNotification('✨ Oshowani', {
            body, icon: './icons/icon-192.png', badge: './icons/icon-192.png',
            tag: 'osho-push', renotify: true,
        })
    );
});

// ── Generate message via Gemini and show notification ──
const NOTIF_PROMPT = `Write ONE short spiritual push notification for the Oshowani app (Osho wisdom). Max 90 chars. Topic: meditation/mindfulness/awareness/peace/love. Osho's poetic rebellious tone. Sometimes end with "→ Ask Osho". Return ONLY the message text.`;

async function generateAndShowNotification() {
    let message = getRandomFallback();
    try {
        const res = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: NOTIF_PROMPT }] }],
                generationConfig: { temperature: 1.35, topP: 0.97, maxOutputTokens: 60 }
            })
        });
        if (res.ok) {
            const data = await res.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (text) message = text;
        }
    } catch {}

    return self.registration.showNotification('✨ Oshowani', {
        body: message,
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'osho-hourly',
        renotify: true,
    });
}

function getRandomFallback() {
    const pool = [
        'The mind chatters. You are the one watching it. → Ask Osho',
        'Breathe. Right now, that breath is your entire universe.',
        'Stop running. The peace you seek is where you already are.',
        'Awareness is the only meditation. → Ask Osho',
        'You are not your thoughts. You are the sky, not the clouds.',
        'The present moment never asks anything of you. Just arrive.',
        'Silence is not empty. It is full of answers. → Ask Osho',
        'Joy is your nature. Suffering is just resistance.',
        'To be at ease in chaos — that is the art of living.',
        'Love needs no reason. That\'s what makes it love.',
        'Be still. The river doesn\'t chase the ocean.',
        'The whole secret of existence: watch, don\'t judge.',
    ];
    return pool[Math.floor(Math.random() * pool.length)];
}
