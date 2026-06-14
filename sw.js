const CACHE_NAME = 'regmed-pro-v2';
const FILES_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './js/app.js',
    './js/chart.js',
    './js/register-sw.js',
    './js/crypto-js.min.js',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(FILES_TO_CACHE))
            .then(() => self.skipWaiting()) // <-- Force l'activation immédiate sans attendre la fermeture de l'app
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(caches.match(e.request).then((response) => response || fetch(e.request)));
});