// Minimal service worker: makes Hazir installable (manifest + SW is what Chrome asks for).
// No offline caching - the app is live-data by design, and his Vercel bandwidth is metered.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
