/* TemkaLauncher service worker — офлайн и мгновенный запуск */
const CACHE = "temka-launcher-v1";
const CORE = ["./", "./index.html", "./manifest.webmanifest", "./icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  // навигация: сеть primero, офлайн-фолбэк из кэша
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", cp));
          return res;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            const cp = res.clone();
            caches.open(CACHE).then((c) => c.put(req, cp));
            return res;
          })
          .catch(() => hit)
    )
  );
});
