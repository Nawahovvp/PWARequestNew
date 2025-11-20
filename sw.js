const CACHE_NAME = "warehouse-parts-pwa-v1";
const OFFLINE_URL = "offline.html";

const ASSETS_TO_CACHE = [
  "./",
  "index.html",       // หรือ Requesttest.html ถ้าใช้ชื่อนั้น
  "offline.html",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png"
  // ถ้ามีไฟล์สำคัญอื่น เช่น CSS/JS แยกไฟล์ ให้เติมชื่อไฟล์ตรงนี้ด้วย
];

// ติดตั้ง SW + cache ไฟล์พื้นฐาน
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// จัดการลบ cache เก่าเมื่อมีเวอร์ชันใหม่
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// กลยุทธ์ fetch
self.addEventListener("fetch", event => {
  const req = event.request;

  // ไม่ยุ่งกับ chrome-extension ฯลฯ
  if (req.url.startsWith("chrome-extension")) return;

  // ถ้าเป็นการเปิดหน้า (navigation) → network first + offline fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(cacheRes => cacheRes || caches.match(OFFLINE_URL))
        )
    );
  } else {
    // asset ทั่วไป → cache first + update cache เบา ๆ
    event.respondWith(
      caches.match(req).then(cacheRes => {
        const fetchPromise = fetch(req)
          .then(networkRes => {
            const copy = networkRes.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
            return networkRes;
          })
          .catch(() => null);

        return cacheRes || fetchPromise;
      })
    );
  }
});
