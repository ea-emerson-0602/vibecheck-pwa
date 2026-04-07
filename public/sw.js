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
    // Silent tag so mood updates don't always show a notification
    tag: data.silent ? "silent-refresh" : "vibe-update",
    silent: data.silent ?? false,
  };

  e.waitUntil(
    (async () => {
      // Always show the notification
      await self.registration.showNotification(title, options);

      // Also tell all open clients (PWA windows) to trigger widget refresh
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => {
        client.postMessage({ type: "MOOD_UPDATED" });
      });
    })()
  );
});

// On notification click — open the app
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      const url = e.notification.data?.url ?? "/";
      const client = clients.find((c) => c.url.includes(url) && "focus" in c);
      if (client) return client.focus();
      return self.clients.openWindow(url);
    })
  );
});
