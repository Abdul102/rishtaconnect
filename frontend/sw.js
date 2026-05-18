/**
 * RishtaConnect — Minimal Service Worker for PWA install.
 * Enables "Add to Home Screen" on Android/iOS browsers.
 * No caching of HTML — always fresh content from network.
 */
self.addEventListener("install", (e)=>{
  self.skipWaiting();
});

self.addEventListener("activate", (e)=>{
  e.waitUntil(self.clients.claim());
});

// Network-first strategy — always try fresh content
self.addEventListener("fetch", (e)=>{
  // Let browser handle normally; sw exists only to enable install prompt
});
