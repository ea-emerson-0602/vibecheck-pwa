// public/sw.js — Service Worker
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Handle push notifications
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  const title = data.title ?? "VibeCheck ✨";
  const options = {
    body: data.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url ?? "/" },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// On notification click — open the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const url = e.notification.data?.url ?? "/";
      const client = clients.find((c) => c.url === url && "focus" in c);
      if (client) return client.focus();
      return self.clients.openWindow(url);
    })
  );
});
