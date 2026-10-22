const CACHE='lingrove-shell-v2';
const SHELL=['/','/index.html','/style.css','/app.js','/content.js','/core.js','/ai.js','/assets/leaf.svg','/assets/tea.svg','/assets/dm-sans.woff2','/assets/cafe.jpg','/assets/city.jpg','/assets/mountains.jpg','/assets/books.jpg','/assets/park.jpg','/DICTIONARY-LICENSE.txt'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lingrove-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!(SHELL.includes(url.pathname)||url.pathname==='/dictionary.json'||url.pathname.startsWith('/vendor/')))return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok&&!response.redirected){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,clone)))}return response}).catch(()=>caches.match(event.request).then(r=>r||Response.error())));
});
