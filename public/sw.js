const CACHE_VERSION = 'gymfxr-v1'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`

const PRECACHE_URLS = [
  '/dashboard',
  '/camera',
  '/nutrition',
]

const MEDIAPIPE_ORIGIN = 'https://cdn.jsdelivr.net'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (request.method !== 'GET') return
  if (url.hostname.includes('supabase.co')) return
  // Never cache API routes — they return user-specific authenticated data
  if (url.pathname.startsWith('/api/')) return
  // Let the browser handle Google Fonts natively (avoids connect-src issues)
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) return

  // MediaPipe CDN — cache-first (WASM files are immutable)
  if (url.origin === MEDIAPIPE_ORIGIN) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  // Next.js static assets — cache-first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        cache.put(request, response.clone())
        return response
      })
    )
    return
  }

  // App pages — network-first with offline fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(request).then((cached) => cached ?? new Response('Offline', { status: 503 }))
      )
  )
})
