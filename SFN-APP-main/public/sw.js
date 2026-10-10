/* Sky First CTT service worker — versioned assets and update-first strategy. */
const CACHE='sfn-digital-shell-2026-10-v5';
const SHELL=[
  '/','/index.html',
  '/styles.css?v=20261010-v5','/digital.css?v=20261010-v5',
  '/digital-portal.js?v=20261010-v5','/bootstrap.js?v=20261010-v5',
  '/manifest.webmanifest','/assets/sfn-logo-tight.png','/assets/sfn-logo.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('sfn-digital-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('message',event=>{
  if(event.data==='SKY_FIRST_SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch',event=>{
  const req=event.request,u=new URL(req.url);
  if(req.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')) return;
  if(req.mode==='navigate'){
    event.respondWith(fetch(req,{cache:'no-cache'}).then(r=>{
      if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put('/index.html',copy)).catch(()=>{});}
      return r;
    }).catch(async()=>await caches.match(req)||await caches.match('/index.html')));
    return;
  }
  const isVersionedAsset=/\.(?:css|js|webmanifest)$/.test(u.pathname);
  if(isVersionedAsset){
    event.respondWith(fetch(req,{cache:'no-cache'}).then(r=>{
      if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}
      return r;
    }).catch(async()=>await caches.match(req)||await fetch(req)));
    return;
  }
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(r=>{
    if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(req,copy)).catch(()=>{});}
    return r;
  })));
});
