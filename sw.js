// 오프라인: 앱 파일은 설치 때, 소리·글꼴은 처음 쓸 때 저장한다. 파일을 고치면 VERSION을 올린다.
const VERSION = '0264a59996';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'rules.js', 'words.json', 'sounds.json', 'manifest.webmanifest', 'icon-180.png',
  'img/excavator.jpg', 'img/bulldozer.jpg', 'img/loader.jpg', 'img/forklift.jpg', 'img/tower-crane.jpg',
  'img/dump-truck.jpg', 'img/roller.jpg'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok || res.type === 'opaque') {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(e.request, copy));
    }
    return res;
  })));
});
