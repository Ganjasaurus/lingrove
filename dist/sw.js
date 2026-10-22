const CACHE='lingrove-shell-v5';
const SHELL=['/','/index.html','/style.css?v=5','/app.js?v=5','/lessons.js?v=5','/speech.js?v=5','/speech-worker.js?v=5','/ai.js?v=5','/ai-support.js?v=5','/vendor/language.js?v=5','/assets/leaf.svg','/assets/dm-sans.woff2'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lingrove-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!(SHELL.some(path=>path.split('?')[0]===url.pathname)||url.pathname.startsWith('/vendor/')))return;
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{if(response.ok&&!response.redirected){const clone=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,clone)))}return response}).catch(()=>caches.match(event.request).then(r=>r||Response.error())));
});
