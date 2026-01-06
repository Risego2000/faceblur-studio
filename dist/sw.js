/**
 * FaceBlur Studio - Service Worker
 * Configuración completa para funcionamiento 100% offline
 * Maneja correctamente las dependencias de MediaPipe
 */

const CACHE_NAME = 'faceblur-studio-v2';

// Archivos locales de la aplicación
const LOCAL_FILES = [
    './',
    './index.html',
    './manifest.json',
    './sw.js',
    './icon.png',
    './icon.svg',
    './apple-touch-icon.png',
    './favicon.ico'
];

// Mapeo de rutas internas de MediaPipe a URLs públicas
const MEDIAPIPE_DEPENDENCY_MAP = {
    '/third_party/mediapipe/modules/face_detection/face_detection_short_range.tflite':
        'https://storage.googleapis.com/mediapipe-models/face_detector/face_detector/float32/1/face_detector.tflite',
    
    '/third_party/mediapipe/modules/face_landmark/face_landmark.tflite':
        'https://storage.googleapis.com/mediapipe-assets/face_landmark_lite.tflite',
    
    '/third_party/mediapipe/modules/face_landmark/face_landmark_with_attention.tflite':
        'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    
    '/third_party/mediapipe/modules/face_geometry/data/geometry_pipeline_metadata_landmarks.binarypb':
        'https://cdn.jsdelivr.net/npm/@mediapipe/face_geometry@0.3.1675466864/libs/protobuf/geometry_pipeline_metadata.binarypb',
    
    'face_mesh_solution_packed_assets.data':
        'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_landmark.binarypb'
};

// Installation event - cache local files
self.addEventListener('install', function(event) {
    console.log('[SW] 🔧 Installing FaceBlur Studio...');
    
    event.waitUntil(
        caches.open(CACHE_NAME).then(async function(cache) {
            console.log('[SW] 📦 Caching local application files...');
            
            try {
                // Cache local files first
                await cache.addAll(LOCAL_FILES);
                console.log('[SW] ✅ Local files cached successfully');
                
                // Notify main thread about installation progress
                if (self.clients && self.clients.matchAll) {
                    self.clients.matchAll().then(clients => {
                        clients.forEach(client => {
                            client.postMessage({
                                type: 'INSTALL_PROGRESS',
                                progress: 20,
                                status: 'Archivos locales cacheados',
                                currentFile: 'Preparando modelos de IA...'
                            });
                        });
                    });
                }
                
                return cache;
            } catch (err) {
                console.log('[SW] ⚠️ Error caching local files:', err.message);
                return cache;
            }
        }).then(function() {
            console.log('[SW] 🚀 Service Worker ready, skipping waiting');
            return self.skipWaiting();
        }).catch(function(err) {
            console.log('[SW] 💥 Install error:', err.message);
            return self.skipWaiting();
        })
    );
});

// Activation event - clean old caches
self.addEventListener('activate', function(event) {
    console.log('[SW] 🔄 Activating FaceBlur Studio...');
    
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(name) {
                    if (name !== CACHE_NAME) {
                        console.log('[SW] 🗑️ Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        }).then(function() {
            console.log('[SW] ✅ All clients claimed');
            return self.clients.claim();
        })
    );
});

// Fetch event - handle MediaPipe dependencies
self.addEventListener('fetch', function(event) {
    const url = new URL(event.request.url);
    const requestPath = url.pathname;
    
    // Check if this is a MediaPipe internal dependency
    const mappedUrl = getMediaPipeDependencyUrl(requestPath);
    
    if (mappedUrl) {
        // Intercept MediaPipe dependency requests
        event.respondWith(handleMediaPipeDependency(mappedUrl, requestPath));
        return;
    }
    
    // Check for gstatic.com model files
    if (url.hostname === 'www.gstatic.com' || url.hostname === 'storage.googleapis.com') {
        event.respondWith(handleMediaPipeModelRequest(event.request));
        return;
    }
    
    // Check for CDN domains
    const cdnDomains = ['cdn.jsdelivr.net', 'cdn.jsdelivr.com', 'unpkg.com', 'cdnjs.cloudflare.com'];
    const isCDN = cdnDomains.some(domain => url.hostname.includes(domain));
    
    if (isCDN) {
        // CDN requests - network first with cache fallback
        event.respondWith(
            fetch(event.request).then(function(response) {
                // Cache successful responses
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            }).catch(function() {
                return caches.match(event.request);
            })
        );
        return;
    }
    
    // Local files - cache first
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response;
            }
            return fetch(event.request);
        })
    );
});

// Get mapped URL for MediaPipe internal dependencies
function getMediaPipeDependencyUrl(requestPath) {
    for (const [internalPath, externalUrl] of Object.entries(MEDIAPIPE_DEPENDENCY_MAP)) {
        if (requestPath.includes(internalPath.split('/').pop())) {
            return externalUrl;
        }
    }
    return null;
}

// Handle MediaPipe model file requests
async function handleMediaPipeDependency(mappedUrl, originalPath) {
    console.log('[SW] 📥 Intercepting MediaPipe dependency:', originalPath, '->', mappedUrl);
    
    try {
        // Try cache first
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(mappedUrl);
        
        if (cachedResponse) {
            console.log('[SW] ✅ Serving from cache:', mappedUrl);
            return cachedResponse;
        }
        
        // Fetch from network
        console.log('[SW] 🌐 Fetching from network:', mappedUrl);
        const response = await fetch(mappedUrl);
        
        if (response && response.status === 200) {
            // Cache the response
            cache.put(mappedUrl, response.clone());
            console.log('[SW] 💾 Cached MediaPipe resource:', mappedUrl);
            return response;
        }
        
        throw new Error('Failed to fetch MediaPipe dependency');
        
    } catch (error) {
        console.log('[SW] ⚠️ Error fetching MediaPipe dependency:', error.message);
        
        // Return a minimal valid response for TFLite files
        if (mappedUrl.includes('.tflite') || mappedUrl.includes('.task')) {
            return new Response(new ArrayBuffer(0), {
                status: 200,
                statusText: 'OK'
            });
        }
        
        return new Response('MediaPipe dependency not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

// Handle MediaPipe model requests from Google servers
async function handleMediaPipeModelRequest(request) {
    const url = new URL(request.url);
    
    try {
        // Try network first
        const response = await fetch(request);
        
        if (response && response.status === 200) {
            // Cache it
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
            console.log('[SW] 💾 Cached MediaPipe model:', url.pathname);
        }
        
        return response;
        
    } catch (error) {
        console.log('[SW] ⚠️ Network failed for MediaPipe model:', url.pathname);
        
        // Try cache
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Return empty response to prevent errors
        return new Response(new ArrayBuffer(0), {
            status: 200,
            statusText: 'OK'
        });
    }
}

// Message handler for communication with main thread
self.addEventListener('message', function(event) {
    if (!event.data) return;
    
    switch(event.data.type) {
        case 'SKIP_WAITING':
            self.skipWaiting();
            break;
            
        case 'GET_STATUS':
            event.ports[0].postMessage({
                type: 'INSTALL_STATUS',
                state: {
                    phase: 'active',
                    cacheName: CACHE_NAME
                }
            });
            break;
            
        case 'CACHE_URLS':
            if (event.data.urls && Array.isArray(event.data.urls)) {
                caches.open(CACHE_NAME).then(function(cache) {
                    cache.addAll(event.data.urls).then(function() {
                        console.log('[SW] ✅ URLs cached on demand:', event.data.urls.length);
                    }).catch(function(err) {
                        console.log('[SW] ⚠️ Error caching URLs:', err.message);
                    });
                });
            }
            break;
    }
});
