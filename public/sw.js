// network-first
const C='nexus-sentinel-v3';self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['/fleet.html','/manifest.json'])))});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{if(e.request.url.includes('/fleet.html')||e.request.url.includes('/api/')){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)))}else{e.respondWith(caches.match(e.request).then(h=>h||fetch(e.request)))}});


