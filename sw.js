/**
 * FaceAnon Pro - Service Worker v9
 * Enables full offline functionality for local AI processing.
 */

const CACHE_NAME = 'faceanon-pro-v10';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './js/face-api.js',
    './css/fonts.css',
    './assets/inter-regular.woff2',
    './assets/inter-medium.woff2',
    './assets/inter-bold.woff2',
    './logo.jpg',
    // Local Models
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
    // External Libraries (CDNs)
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-core@4.15.0',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.15.0',
    'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.15.0',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/blazeface@0.0.7',
    'https://cdn.jsdelivr.net/npm/@tensorflow-models/face-detection@1.0.1',
    'https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229',
    'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js',
    // External Models
    'https://cdn.jsdelivr.net/gh/onnx/models@main/vision/body_analysis/ultraface/models/version-RFB-320.onnx'
];

self.addEventListener('install', (event) => {
    console.log('[SW] Instalando y Cacheando Motores IA...');
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
    // Definimos qué URLs deben considerarse assets de la app
    const url = event.request.url;
    const isLocal = url.includes(location.origin);
    const isCDN = url.includes('cdn.jsdelivr.net') || url.includes('mediapipe') || url.includes('tensorflow') || url.includes('onnx');

    if (isLocal || isCDN) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;

                return fetch(event.request).then((networkResponse) => {
                    // Si es un recurso válido de CDN o local, lo guardamos dinámicamente
                    if (networkResponse && networkResponse.status === 200) {
                        return caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse.clone());
                            return networkResponse;
                        });
                    }
                    return networkResponse;
                }).catch(() => {
                    // Fallback a index si no hay red
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                    return null;
                });
            })
        );
    } else {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
    }
});
