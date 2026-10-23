const CACHE_NAME = "sfn-digital-v9-20261023";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css?v=20261023-v9",
  "/digital.css?v=20261023-v9",
  "/digital-portal.js?v=20261023-v9",
  "/bootstrap.js?v=20261023-v9",
  "/assets/sfn-logo-tight.png"
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Không lưu cache dữ liệu nhạy cảm, API quản trị, tra cứu hoặc xác thực (Mục 9)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) {
    return;
  }
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && url.origin === self.location.origin) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
