/**
 * FaceAnon Pro - Service Worker
 * Enables full offline functionality for local AI processing.
 */

const CACHE_NAME = 'faceanon-pro-v5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './js/face-api.js',
    './css/fonts.css',
    './assets/inter-regular.woff2',
    './assets/inter-medium.woff2',
    './assets/inter-bold.woff2',
    './models/ssd_mobilenetv1_model-weights_manifest.json',
    './models/ssd_mobilenetv1_model-shard1',
    './models/ssd_mobilenetv1_model-shard2',
    './models/tiny_face_detector_model-weights_manifest.json',
    './models/tiny_face_detector_model-shard1',
    './models/face_landmark_68_model-weights_manifest.json',
    './models/face_landmark_68_model-shard1',
    './models/face_recognition_model-weights_manifest.json',
    './models/face_recognition_model-shard1',
    './models/face_recognition_model-shard2',
    './icon.svg'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando y Cacheando Todo para uso 100% local...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS_TO_CACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    // Para modelos y scripts locales, forzamos Cache-First extremo
    const isLocalAsset = ASSETS_TO_CACHE.some(asset => event.request.url.endsWith(asset.replace('./', '')));

    if (isLocalAsset) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                // Fallback a red si no está en cache por algún motivo, y lo guardamos
                return fetch(event.request).then((response) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, response.clone());
                        return response;
                    });
                });
            })
        );
    } else {
        // Para otros recursos, red pero con fallback a cache
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(event.request);
            })
        );
    }
});
