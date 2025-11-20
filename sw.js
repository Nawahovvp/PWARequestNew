const CACHE_NAME = 'sparepart-pwa-v1';
const urlsToCache = [
  '/',
  '/index.html', // หรือชื่อไฟล์ HTML ของคุณ
  'https://fonts.googleapis.com/css2?family=Itim&display=swap',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11'
  // เพิ่ม URL อื่นๆ ที่ต้องการแคช (เช่น API ถ้าต้องการ)
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});
