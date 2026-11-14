const CACHE='lingrove-shell-v9';
const SHELL=['/','/index.html','/style.css?v=6','/app.js?v=6','/rf-bridge.js?v=6','/lessons.js?v=6','/speech.js?v=6','/speech-worker.js?v=6','/setup-support.js?v=6','/console-kit.js?v=6','/storage-probe.js?v=6','/ai.js?v=6','/ai-support.js?v=6','/vendor/language.js?v=6','/assets/leaf.svg','/assets/dm-sans.woff2'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lingrove-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!(SHELL.some(path=>path.split('?')[0]===url.pathname)||url.pathname.startsWith('/vendor/')))return;
  const isNavShell=event.request.mode==='navigate'||url.pathname==='/'||url.pathname==='/index.html';
  event.respondWith(fetch(event.request,{cache:'no-cache'}).then(response=>{if(response.ok&&!response.redirected){const clone=response.clone();const cacheKey=isNavShell&&url.search?url.pathname:event.request;event.waitUntil(caches.open(CACHE).then(c=>c.put(cacheKey,clone)))}return response}).catch(()=>caches.match(event.request).then(r=>r||(isNavShell?caches.match('/').then(s=>s||caches.match('/index.html')):null)).then(r=>r||Response.error())));
});
