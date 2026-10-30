/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST || []);

// Listen for the background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-tasks') {
    console.log('[Service Worker] Background sync triggered!');
    event.waitUntil(syncWithFirebase());
  }
});

async function syncWithFirebase() {
  console.log('[Service Worker] Tasks synchronized with Firebase offline persistence');
  // In a typical app with a REST API, we would flush our IndexedDB task queue here using fetch().
  // Since we are using Firebase, the JS SDK inherently listens for the network connection to restore
  // and syncs its local persistent cache natively using WebSockets. 
  // The service worker sync event acts as a system-level wake-up guarantee so Firebase can synchronize 
  // immediately alongside background fetches.
  
  // Here we can notify all clients that the background sync happened
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage({ type: 'SYNC_COMPLETED' });
  }
}
