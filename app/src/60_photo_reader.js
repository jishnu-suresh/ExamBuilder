/* ---------------- reading text from photos ---------------- */
const PREF_KEY = "examBuilder.prefs";
let PREFS = { photoMode: "image" };
try{ Object.assign(PREFS, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); }catch(e){}
if(PREFS.aiKey !== undefined || PREFS.photoMode === "ai"){ delete PREFS.aiKey; if(PREFS.photoMode === "ai") PREFS.photoMode = "offline"; try{ localStorage.setItem(PREF_KEY, JSON.stringify(PREFS)); }catch(e){} }
function savePrefs(){ try{ localStorage.setItem(PREF_KEY, JSON.stringify(PREFS)); }catch(e){} }

/* offline engine (Tesseract, fully embedded) */
let tess = null, tessProgress = null;
function b64ToBytes(b64){ const bin = atob(b64); const u = new Uint8Array(bin.length); for(let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
function getTess(){
  if(tess) return tess;
  if(window.__PWA__){
    tess = (async () => {
      if(!window.Tesseract) await loadScript("vendor/ocr/tesseract.min.js");
      const abs = p => new URL(p, location.href).href;
      return Tesseract.createWorker("eng", 1, {
        workerPath: abs("vendor/ocr/worker.min.js"), corePath: abs("vendor/ocr/tesseract-core-simd-lstm.wasm.js"), langPath: abs("vendor/ocr/lang"),
        workerBlobURL: false, cacheMethod: "none", gzip: true, logger: m => tessProgress && tessProgress(m)
      });
    })();
    tess.catch(() => { tess = null; });
    return tess;
  }
  tess = (async () => {
    // Everything goes into ONE worker script: pages opened from disk (file://) have an opaque
    // origin, so a worker may not importScripts()/fetch() other blob URLs.
    const pre = `var __ENG=${JSON.stringify(document.getElementById("tess-eng").textContent.trim())};
var __imp=self.importScripts.bind(self);
self.importScripts=function(){var a=Array.prototype.filter.call(arguments,function(u){return !/tesseract-core/.test(String(u));});return a.length?__imp.apply(self,a):undefined;};
var __f=self.fetch.bind(self);
self.fetch=function(u,o){if(/(^|\\/)eng\\.traineddata/.test(String(u&&u.url||u))){var b=atob(__ENG),x=new Uint8Array(b.length);for(var i=0;i<b.length;i++)x[i]=b.charCodeAt(i);return Promise.resolve(new Response(x,{status:200}));}return __f(u,o);};
`;
    const blob = new Blob([pre, document.getElementById("tess-core").textContent, "\n;\n", document.getElementById("tess-worker").textContent], { type: "text/javascript" });
    const w = await Tesseract.createWorker("eng", 1, {
      workerPath: URL.createObjectURL(blob), workerBlobURL: false,
      corePath: "embedded/tesseract-core-simd-lstm.wasm.js", cacheMethod: "none",
      logger: m => tessProgress && tessProgress(m)
    });
    return w;
  })();
  tess.catch(() => { tess = null; });
  return tess;
}
function tidyOcr(t){
  return String(t || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[|]{1,2}(?=\s|$)/g, "").trim();
}
async function readOffline(img, onProg){
  onProg({ text: "Starting the offline reader…", p: null });
  tessProgress = m => {
    const labels = { "loading tesseract core": "Loading reader…", "initializing tesseract": "Starting reader…", "loading language traineddata": "Loading English language data…", "initializing api": "Preparing…", "recognizing text": "Reading text…" };
    onProg({ text: labels[m.status] || m.status, p: m.status === "recognizing text" ? m.progress : null });
  };
  const w = await getTess();
  const { data } = await w.recognize(img.src);
  tessProgress = null;
  return tidyOcr(data.text);
}

/* review dialog */
const ocr = { queue: [], id: null, run: 0 };
function queueOcr(ids){
  ocr.queue.push(...ids);
  if(!$("#ocrModal").classList.contains("open")) nextOcr();
}
function setSeg(el, val){ el.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === val)); }
function nextOcr(){
  ocr.id = ocr.queue.shift() || null;
  const it = ocr.id && S.items.find(x => x.id === ocr.id);
  if(!it || !it.img){ if(ocr.queue.length) return nextOcr(); $("#ocrModal").classList.remove("open"); ocr.id = null; return; }
  $("#ocrImg").src = it.img.src;
  $("#ocrText").value = "";
  $("#ocrTitle").textContent = "Read text from photo" + (ocr.queue.length ? "  (" + (ocr.queue.length + 1) + " left)" : "");
  $("#ocrModal").classList.add("open");
  runOcr();
}
async function runOcr(){
  const it = S.items.find(x => x.id === ocr.id); if(!it) return;
  const myRun = ++ocr.run;
  const prog = $("#ocrProg"), msg = $("#ocrMsg");
  const btns = ["#ocrKeep", "#ocrReplace"].map(s => $(s));
  btns.forEach(b => b.disabled = true);
  $("#ocrText").value = ""; $("#ocrText").placeholder = "Working…";
  const onProg = ({ text, p }) => { if(myRun !== ocr.run) return; msg.textContent = text; prog.classList.toggle("indet", p == null); if(p != null) prog.firstElementChild.style.width = Math.round(p * 100) + "%"; };
  try{
    const text = await readOffline(it.img, onProg);
    if(myRun !== ocr.run) return;
    $("#ocrText").value = text;
    const n = parseText(text).filter(x => x.type === "q").length;
    msg.textContent = text ? "Done — found " + n + " question" + (n === 1 ? "" : "s") + ". Check the text, then add it."  : "No text found in this photo.";
    btns.forEach(b => b.disabled = !text);
  }catch(e){
    if(myRun !== ocr.run) return;
    console.error(e); msg.textContent = "⚠ " + (e.message || e);
  }finally{
    if(myRun === ocr.run){ prog.classList.remove("indet"); prog.firstElementChild.style.width = "100%"; $("#ocrText").placeholder = "The recognised text will appear here…"; }
  }
}
function applyOcr(replace){
  const i = S.items.findIndex(x => x.id === ocr.id);
  const items = parseText($("#ocrText").value);
  if(i >= 0 && items.length){
    if(replace) S.items.splice(i, 1, ...items);
    else S.items.splice(i + 1, 0, ...items);
    render(); changed(); toast("Added " + items.length + " item" + (items.length > 1 ? "s" : "") + " from the photo");
  }
  ocr.run++; nextOcr();
}
$("#ocrCancel").onclick = () => { ocr.run++; ocr.queue = []; $("#ocrModal").classList.remove("open"); };
$("#ocrKeep").onclick = () => applyOcr(false);
$("#ocrReplace").onclick = () => applyOcr(true);

/* photo-mode controls */
function syncPhotoMode(){ setSeg($("#photoMode"), PREFS.photoMode); }
$("#photoMode").addEventListener("click", e => { const b = e.target.closest("button"); if(!b) return; PREFS.photoMode = b.dataset.m; savePrefs(); syncPhotoMode(); if(b.dataset.m === "offline") getTess(); });
syncPhotoMode();
