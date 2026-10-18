/**
 * ============================================================================
 * LEVITY CHESS DUNGEON - SERVICE WORKER (PUSH & SYNC)
 * ============================================================================
 */

const LEVITY_UID = "usr_6c3bcbba52c94766bcdc426f6bc4dc1b";
const LEVITY_DB = "chess-dungeon";
const BASE_URL = "https://api.levity.click";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Handle incoming Web Push
 */
self.addEventListener("push", (event) => {
  event.waitUntil(handlePushEvent(event));
});

async function handlePushEvent(event) {
  let title = "⚔️ Chess Dungeon Challenge!";
  let message = "A new chess match has been proposed!";
  let matchId = null;
  let targetUrl = "/";

  // 1. If payload was transmitted in the push body directly
  if (event.data) {
    try {
      const payload = event.data.json();
      title = payload.title || title;
      message = payload.message || payload.body || message;
      matchId = payload.data?.matchId || payload.matchId || null;
      targetUrl = payload.url || (matchId ? `/?match=${matchId}` : "/");
    } catch (_) {
      message = event.data.text() || message;
    }
  } else {
    // 2. Fetch latest queued notification for this user from Levity DB
    try {
      const storedUser = await getStoredUser();
      if (storedUser && storedUser.id) {
        const queueRes = await fetch(
          `${BASE_URL}/${LEVITY_UID}/${LEVITY_DB}/notify/latest?userId=${encodeURIComponent(storedUser.id)}`
        );
        if (queueRes.ok) {
          const queueData = await queueRes.json();
          if (queueData.notifications && queueData.notifications.length > 0) {
            const latest = queueData.notifications[0];
            title = latest.title || title;
            message = latest.message || message;
            matchId = latest.data?.matchId || latest.matchId || null;
            targetUrl = latest.url || (matchId ? `/?match=${matchId}` : "/");
          }
        }
      }
    } catch (e) {
      console.warn("Could not retrieve queued notification:", e);
    }
  }

  const notificationOptions = {
    body: message,
    icon: "/icon-192.png",
    badge: "/badge.png",
    vibrate: [200, 100, 200],
    tag: matchId ? `match_${matchId}` : "chess_general",
    renotify: true,
    data: {
      url: targetUrl,
      matchId: matchId
    },
    actions: [
      { action: "play", title: "⚔️ Enter Battle" },
      { action: "dismiss", title: "Dismiss" }
    ]
  };

  return self.registration.showNotification(title, notificationOptions);
}

/**
 * Handle Notification Click -> Open or Focus ?match={id}
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") {
    return;
  }

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If a Chess Dungeon tab is already open, focus and navigate it
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Helper to read current user from client index if indexedDB is used
async function getStoredUser() {
  return null;
}
