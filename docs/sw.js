// Exam Builder service worker — makes the app work offline and update itself.
const CORE_CACHE = "eb-core-2d6f0cd76d83";
const LAZY_CACHE = "eb-lazy-81e42df67ac0";
const CORE = ["./", "index.html", "manifest.webmanifest", "vendor/jspdf.umd.min.js", "vendor/mathjax/tex-svg-full.js", "vendor/mathlive/mathlive.min.js", "vendor/mathlive/fonts.css", "vendor/sortable.min.js", "vendor/smiles-drawer.min.js", "vendor/pdfjs/pdf.min.js", "vendor/pdfjs/pdf.worker.min.js", "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"];
const LAZY = ["student/player.html", "vendor/fonts.js", "vendor/easyfonts.js", "vendor/ocr/tesseract.min.js", "vendor/ocr/worker.min.js", "vendor/ocr/tesseract-core-simd-lstm.wasm.js", "vendor/ocr/lang/eng.traineddata.gz"];   // photo reader + extra fonts: fetched in the background after install

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
