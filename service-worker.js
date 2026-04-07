const CACHE_NAME = "ebd-fiel-v15";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./licao.html",
  "./manifest.json",
  "./lessons.json",
  "./ebdfiel.png"
];

self.addEventListener("install", (event) => {
  console.log("[Service Worker] Instalando versão:", CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Cacheando arquivos");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Ativando versão:", CACHE_NAME);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[Service Worker] Removendo cache antigo:", key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log("[Service Worker] Pronto para controlar a página");
      return self.clients.claim();
    })
  );
});

// Evento de push para notificações
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    data = event.data.json();
  }
  
  const options = {
    body: data.body || 'Nova lição disponível!',
    icon: './ebdfiel.png',
    badge: './ebdfiel.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || './index.html'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'EBD Fiel', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        const url = event.notification.data.url;
        for (let client of windowClients) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Resto do código fetch igual ao anterior...