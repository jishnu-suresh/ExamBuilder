// Exam Builder service worker — makes the app work offline and update itself.
const CORE_CACHE = "eb-core-__CORE_VERSION__";
const LAZY_CACHE = "eb-lazy-__LAZY_VERSION__";
const CORE = __CORE__;
const LAZY = __LAZY__;   // photo reader + extra fonts: fetched in the background after install

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CORE_CACHE).then(c => c.addAll(CORE.map(u => new Request(u, { cache: "reload" })))));
});
self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for(const k of await caches.keys()) if(k !== CORE_CACHE && k !== LAZY_CACHE) await caches.delete(k);
    await self.clients.claim();
    const c = await caches.open(LAZY_CACHE);
    for(const u of LAZY){ try{ if(!(await c.match(u))) await c.add(new Request(u, { cache: "reload" })); }catch(_){ } }
  })());
});
self.addEventListener("message", e => { if(e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("fetch", e => {
  const req = e.request;
  if(req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  if(/\/guide\//.test(new URL(req.url).pathname)) return;     // 📖 the illustrated guide (pages + clips): straight from the website
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if(hit) return hit;
    if(req.mode === "navigate"){ const idx = await caches.match("index.html"); if(idx) return idx; }
    try{
      const res = await fetch(req);
      if(res.ok){ const c = await caches.open(LAZY_CACHE); c.put(req, res.clone()); }
      return res;
    }catch(err){
      if(req.mode === "navigate"){ const idx = await caches.match("index.html"); if(idx) return idx; }
      throw err;
    }
  })());
});
