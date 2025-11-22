// เวอร์ชัน cache (เปลี่ยนชื่อทุกครั้งที่อัปเดตไฟล์สำคัญ)
const CACHE_NAME = 'spare-parts-app-v4';  // อัป v3 → v4
const DATA_CACHE_NAME = 'spare-parts-data-v2';  // อัปเวอร์ชัน

// ไฟล์พื้นฐานที่ต้องใช้ทุกครั้ง (App Shell) - เพิ่ม iOS assets
const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-180.png',  // เพิ่ม iOS icons
  '/icon-152.png',
  // ฟอนต์ / CSS / JS จาก CDN ที่ใช้บ่อยและอยากให้โหลดไว
  'https://fonts.googleapis.com/css2?family=Itim&display=swap',
  'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap',
  'https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js'
];

// บังคับให้ SW ตัวใหม่ทำงานทันที (iOS ชอบ self.skipWaiting)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE))
  );
  self.skipWaiting();  // iOS: Force activate ทันที
});

// ลบ cache เก่าออก เหลือเฉพาะเวอร์ชันล่าสุด (iOS ลบ cache บ่อย ต้อง clean ดี)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names => {
      return Promise.all(
        names.map(name => {
          if (name !== CACHE_NAME && name !== DATA_CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  clients.claim();  // iOS: Claim clients ทันทีสำหรับ seamless update
});

// กลยุทธ์ตอบสนองเวลา fetch (ปรับสำหรับ iOS: network-first สำหรับ navigation/data)
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) จัดการกับข้อมูลจาก Google Sheet (opensheet.elk.sh) - iOS: stale-while-revalidate เสมอ
  if (url.hostname === 'opensheet.elk.sh') {
    event.respondWith(handleDataRequest(req));
    return;
  }

  // 2) ถ้าเป็นหน้า HTML (navigate) → network-first (iOS ชอบ freshness สำหรับ UI)
  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }

  // 3) อื่น ๆ (CSS, JS, รูป, ฟอนต์) → cache-first (iOS โหลดไวดี)
  event.respondWith(cacheFirst(req));
});

// 🔹 กลยุทธ์ cache-first (ไวมาก สำหรับ assets)
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // เก็บลง cache ถ้าเป็น GET และมาจากโปรโตคอลปกติ
  if (request.method === 'GET' && (request.url.startsWith('http://') || request.url.startsWith('https://'))) {
    cache.put(request, response.clone());
  }
  return response;
}

// 🔹 กลยุทธ์ network-first สำหรับหน้า HTML (iOS: freshness สูง)
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, {  // เพิ่ม cache: 'no-cache' สำหรับ iOS
      cache: 'no-cache'
    });
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request);
    if (cached) return cached;
    // iOS fallback: แสดงข้อความ offline ชัดเจน
    return new Response('Offline: ไม่สามารถเชื่อมต่อได้ กรุณาเช็คอินเทอร์เน็ต', {
      status: 503,
      headers: { 
        'Content-Type': 'text/plain; charset=utf-8',
        'X-iOS-Offline': 'true'  // Custom header สำหรับ debug iOS
      }
    });
  }
}

// 🔹 จัดการข้อมูลจาก opensheet.elk.sh → stale-while-revalidate (iOS: update เบื้องหลัง)
async function handleDataRequest(request) {
  const cache = await caches.open(DATA_CACHE_NAME);

  const cached = await cache.match(request);

  const networkPromise = fetch(request, { cache: 'no-cache' })  // iOS: no-cache สำหรับ data
    .then(response => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  // ถ้ามี cache → ส่ง cache ก่อน (โหลดไว) แล้วค่อยอัปเดตเบื้องหลัง
  if (cached) {
    networkPromise;  // Fire and forget
    return cached;
  }

  // ถ้าไม่มี cache → รอ network (iOS ชอบ fresh data)
  const networkResponse = await networkPromise;
  if (networkResponse) return networkResponse;

  // ไม่มีทั้งเน็ตและ cache
  return new Response('Offline: ไม่สามารถโหลดข้อมูลจาก Google Sheet ได้', {
    status: 503,
    headers: { 
      'Content-Type': 'text/plain; charset=utf-8',
      'X-iOS-Offline': 'true'
    }
  });
}
