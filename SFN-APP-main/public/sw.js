const CACHE='sfn-digital-shell-2026-10-v2';
const SHELL=['/','/index.html','/styles.css','/digital.css','/digital-portal.js','/bootstrap.js','/manifest.webmanifest','/assets/sfn-logo.png','/assets/sfn-wordmark.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const req=event.request,u=new URL(req.url);
  if(req.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')) return;
  const isNavigation=req.mode==='navigate';
  if(isNavigation){
    event.respondWith(fetch(req).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy));return r}).catch(async()=>await caches.match(req)||await caches.match('/index.html')));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy))}return r})));
});
