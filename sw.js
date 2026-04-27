/* 草刈りトラッカー Service Worker v6 */
const CACHE = 'kusagari-v6';
const ASSETS = [
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Bebas+Neue&family=Noto+Sans+JP:wght@400;700;900&display=swap',
];

// インストール：アセットをキャッシュ
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// アクティベート：古いキャッシュを削除
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// フェッチ：ネットワーク優先、失敗時はキャッシュ
self.addEventListener('fetch', e => {
  // Firebaseなど外部APIはキャッシュしない
  if (e.request.url.includes('firebase') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('open-meteo') ||
      e.request.url.includes('firebaseapp')) {
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// メッセージ：クライアントからのskipWaiting要求
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
