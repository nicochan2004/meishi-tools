const CACHE_NAME = "meishi-shell-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/util.js",
  "./js/auth.js",
  "./js/drive.js",
  "./js/store.js",
  "./js/camera.js",
  "./js/contour.js",
  "./js/ocr.js",
  "./js/views/list.js",
  "./js/views/detail.js",
  "./js/views/scan.js",
  "./js/app.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting())
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
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return; // 外部API(Vision/Drive)やCDN(OpenCV.js/GIS)はキャッシュ対象外でパススルー
  }
  // ネットワーク優先。設定ファイル等の更新をすぐ反映するため、
  // オンライン時は常に最新を取得し、オフライン時のみキャッシュにフォールバックする。
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
