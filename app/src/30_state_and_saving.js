/* ---------------- state ---------------- */
const defaults = () => ({
  d: {
    title: "Semester 1 Exam", subtitle: "", year: "", subject: "", duration: "2 hrs",
    teacher: "", className: "", date: "", totalOverride: "",
    instructions: "Write all answers clearly, legibly and neatly using a blue or black ink pen.\nYou may use pencils for drawing if needed.\nWrite your answers on the lined paper provided.\nFor multiple-choice questions, you may highlight the chosen answer directly on the exam paper.",
    school: "The Hive Academy", paper: "a4", fontSize: "11", accent: "#2E2E2E",
    lineSpacing: "1", largePrint: false, answerMode: "paper",
    showMarks: true, nameEveryPage: true, restartNumbering: false, sectionNewPage: false,
    endMarker: true, scoreTable: true, bigInline: true, justify: true
  },
  logo: { src: DEFAULT_LOGO, w: DEFAULT_LOGO_SIZE[0], h: DEFAULT_LOGO_SIZE[1], isDefault: true },
  items: []
});
let S = defaults();
let uid = 1;
let lastEdited = null;
const nid = () => "i" + Date.now().toString(36) + (uid++);

/* browser autosave: IndexedDB (room for photos), localStorage as fallback */
const IDB = {
  db: null,
  open(){ return this.db || (this.db = new Promise((res, rej) => { try{ const r = indexedDB.open("examBuilder", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }catch(e){ rej(e); } })); },
  async get(k){ const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v){ const db = await this.open(); return new Promise((res, rej) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); },
  async del(k){ const db = await this.open(); return new Promise(res => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").delete(k); t.oncomplete = () => res(); t.onerror = () => res(); }); }
};
/* ---------- 🕘 version history: copies of the exam kept in this browser ---------- */
const VERS_MAX = 30, VERS_BYTES = 60e6;
let versLastAt = 0, versLastSig = "";
async function keepVersion(reason){
  try{
    if(!S.items.length && !S.d.title) return;
    const snap = snapshot(), json = JSON.stringify(snap), sig = json.length + ":" + strHash(json);
    const meta = { title: S.d.title || "Untitled exam", file: proj.name || "", nq: S.items.filter(i => i.type === "q").length };   // read now, before anything changes
    if(sig === versLastSig) return;                         // nothing changed since the last copy
    const list = (await IDB.get("versions")) || [];
    if(list.length && list[0].sig === sig){ versLastSig = sig; return; }
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    await IDB.set("v:" + id, json);
    list.unshift(Object.assign({ id, at: Date.now(), reason, sig, bytes: json.length }, meta));
    let total = 0; const keep = [];
    for(const v of list){ total += v.bytes || 0; if(keep.length < VERS_MAX && (total <= VERS_BYTES || !keep.length)) keep.push(v); else await IDB.del("v:" + v.id); }
    await IDB.set("versions", keep);
    versLastAt = Date.now(); versLastSig = sig;
  }catch(e){ console.warn("version not kept", e); }
}
async function openHistory(){
  const list = (await IDB.get("versions").catch(() => null)) || [];
  const day = t => { const d = new Date(t), n = new Date(); const y = new Date(n); y.setDate(n.getDate() - 1);
    return d.toDateString() === n.toDateString() ? "Today" : d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }); };
  $("#histList").innerHTML = list.length ? list.map(v => `<div class="hist-row" data-v="${v.id}" data-at="${v.at}">
      <div class="hist-when"><b>${day(v.at)}</b> ${hhmm(v.at)}</div>
      <div class="hist-what"><b>${esc(v.title)}</b> · ${v.nq} question${v.nq === 1 ? "" : "s"}${v.file ? ` · <span class="hint">${esc(v.file)}</span>` : ""}<div class="hint">${esc(v.reason)}</div></div>
      <div class="hist-act"><button class="btn sm" data-hdl>⬇</button><button class="btn sm primary" data-hrestore>Restore</button></div></div>`).join("")
    : `<p class="hint">No earlier versions yet. BEE keeps a copy every few minutes while you work, and before pasting, opening another file or clearing.</p>`;
  openModal("#histModal");
}
document.getElementById("histList").addEventListener("click", async e => {
  const row = e.target.closest("[data-v]"); if(!row) return;
  const json = await IDB.get("v:" + row.dataset.v).catch(() => null); if(!json){ toast("That version is no longer available"); return; }
  const o = JSON.parse(json);
  if(e.target.closest("[data-hdl]")){
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const t = new Date(+row.dataset.at); a.download = cleanName(o.d && o.d.title || "exam") + " - " + t.toISOString().slice(0, 10) + " " + String(t.getHours()).padStart(2, "0") + "h" + String(t.getMinutes()).padStart(2, "0") + ".exam.json"; a.click(); return;
  }
  if(e.target.closest("[data-hrestore]")){
    await keepVersion("Before restoring an earlier version");
    applyState(o); saveLocal(); $("#histModal").classList.remove("open");
    toast("Earlier version restored — your work just before is kept in 🕘 History too");
  }
});
document.getElementById("btnHistory").onclick = () => openHistory();
setInterval(() => { if(S.items.length && (S.savedAt || 0) > versLastAt && Date.now() - versLastAt > 5 * 60000) keepVersion("Saved while you worked"); }, 60000);
function snapshot(){
  const used = new Set(); S.items.forEach(it => [it.text, it.answer].concat((it.subs || []).flatMap(sb => [sb.text, sb.answer])).forEach(t => String(t || "").split("\n").forEach(l => { const m = l.match(RE_IMG); if(m) used.add(m[1]); })));
  const items = S.items.map(it => it.pics && Object.keys(it.pics).some(k => !used.has(k)) ? Object.assign({}, it, { pics: Object.fromEntries(Object.entries(it.pics).filter(([k]) => used.has(k))) }) : it);
  return { app: "exam-builder", version: 2, savedAt: S.savedAt || Date.now(), d: S.d, logo: S.logo.isDefault ? { isDefault: true } : S.logo, items };
}
async function loadLocal(){
  let o = null;
  try{ o = await IDB.get("state"); }catch(e){}
  if(!o){ try{ const raw = localStorage.getItem(STORE_KEY); if(raw) o = JSON.parse(raw); }catch(e){} }
  return o;
}
function mergeState(o){
  const base = defaults();
  const out = { d: Object.assign(base.d, o.d || {}), logo: o.logo || base.logo, items: Array.isArray(o.items) ? o.items : [], savedAt: o.savedAt || 0 };
  if(out.logo && out.logo.isDefault) out.logo = base.logo;
  if(!out.d.accentChosen && /^#b5892e$/i.test(out.d.accent || "")) out.d.accent = defaults().d.accent;
  out.items.forEach(it => { if(!it.id) it.id = nid(); });
  return out;
}
let saveT;
function saveLocal(clean){
  S.savedAt = Date.now(); if(!clean) proj.dirty = true; updateChip();
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    const snap = snapshot();
    try{ await IDB.set("state", snap); }
    catch(e){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(snap)); }catch(_){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(Object.assign({}, snap, { items: S.items.map(it => Object.assign({}, it, { img: null })) }))); }catch(__){} } }
  }, 400);
}

/* project file: chosen once, then overwritten every minute */
const FS_OK = typeof window.showSaveFilePicker === "function";
const proj = { handle: null, name: "", dirty: false, lastWrite: 0, perm: "none", writing: false };
const PTYPES = [{ description: "Exam project", accept: { "application/json": [".json"] } }];
function hhmm(t){ return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function updateChip(){
  const c = document.getElementById("saveChip"); if(!c) return;
  c.classList.remove("ok", "warn");
  if(proj.handle){
    if(proj.perm !== "granted"){ c.textContent = "⚠ Click to allow saving to " + proj.name; c.classList.add("warn"); return; }
    if(proj.writing){ c.textContent = "Saving to " + proj.name + "…"; return; }
    c.textContent = proj.dirty ? "● " + proj.name + " — saves within a minute" : "✓ Saved to " + proj.name + (proj.lastWrite ? " · " + hhmm(proj.lastWrite) : "");
    if(!proj.dirty) c.classList.add("ok");
  }else{
    if(FS_OK){ c.textContent = "⚠ Not saved to a file yet — click to choose one"; c.classList.add("warn"); return; }
    const last = +(localStorage.getItem("examBuilder.lastDownload") || 0);
    if(last && last >= (S.savedAt || 0)){ c.textContent = "✓ Copy downloaded " + hhmm(last) + " · also kept in this browser"; c.classList.add("ok"); }
    else { c.textContent = "⚠ Kept in this browser only — click to download a project copy"; c.classList.add("warn"); }
  }
}
async function writeProject(force){
  if(!proj.handle || proj.writing) return false;
  if(!force && !proj.dirty) return true;
  // take the file and the exam together, right now: if the teacher switches to another exam while this
  // save is still running, the old file still gets the old exam (never the new one)
  const h = proj.handle, name = proj.name, data = JSON.stringify(snapshot()), was = S.savedAt;
  try{
    proj.writing = true; updateChip();
    if(h.queryPermission){ const p = await h.queryPermission({ mode: "readwrite" }); if(proj.handle === h) proj.perm = p; if(p !== "granted") return false; }
    const w = await h.createWritable();
    await w.write(data);
    await w.close();
    if(proj.handle === h){ if(S.savedAt === was) proj.dirty = false; proj.lastWrite = Date.now(); proj.perm = "granted"; }
    return true;
  }catch(e){ console.error(e); toast("Couldn't save to " + name + ": " + (e.message || e)); return false; }
  finally{ proj.writing = false; updateChip(); }
}
// before BEE shows a different exam: save the current one into its own file, then let go of that file,
// so nothing (the minute autosave, switching windows, Ctrl+S) can write the next exam into it
async function leaveCurrentFile(){
  for(let i = 0; i < 40 && proj.writing; i++) await new Promise(r => setTimeout(r, 50));
  if(proj.handle && proj.dirty) await writeProject(true);
  proj.handle = null; proj.name = ""; proj.dirty = false; proj.perm = "none";
}
async function setHandle(h){
  proj.handle = h; proj.name = h ? h.name : ""; proj.perm = h ? "granted" : "none";
  try{ if(h) await IDB.set("handle", h); else await IDB.del("handle"); }catch(e){}
  updateChip();
}
function downloadProject(name){
  try{ localStorage.setItem("examBuilder.lastDownload", String(Date.now() + 1)); }catch(e){}
  setTimeout(updateChip, 50);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(snapshot())], { type: "application/json" }));
  a.download = (name || fileName().replace(/\.pdf$/, "")) + ".exam.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
// Save as: first BEE's own little dialog (name the file), then the computer's folder picker where the browser has one
let svResolve = null, svOpts = {};
// file names: "/" "\\" "|" ":" become " - ", other characters computers refuse are dropped
const cleanName = t => String(t || "").replace(/\.exam\.json$|\.json$|\.pdf$/i, "")
  .replace(/\s*[\\/|:]+\s*/g, " - ").replace(/[*?"<>]+/g, "").replace(/(\s-\s*)+(?=-|$)/g, "").replace(/(\s-\s)+/g, " - ")
  .replace(/\s+/g, " ").replace(/^[\s.-]+|[\s.-]+$/g, "").slice(0, 120);
function saveAs(opts){
  opts = opts || {};
  return new Promise(res => {
    if(svResolve) svResolve(false);
    svResolve = res; svOpts = opts;
    const SD = (opts.state || S).d;
    const base = opts.isNew ? "" : (cleanName(proj.name || "") || cleanName(fileName()) || "exam");
    $("#svTitle").textContent = opts.isNew ? "🐝 Name your new exam" : "💾 Save exam as";
    $("#svHint").innerHTML = FS_OK
      ? "Next, choose the folder. BEE then keeps this file up to date by itself every minute."
      : "It goes to your <b>Downloads</b> folder. Open it again later with 📂 Open.";
    $("#svName").value = base;
    const today = new Date().toISOString().slice(0, 10);
    const quick = [
      [cleanName([SD.subject, SD.title].filter(Boolean).join(" - ")), "subject + title"],
      [cleanName([SD.subject, SD.title, SD.className].filter(Boolean).join(" - ")), "with class"],
      ["+date", "＋ " + today], ["+v", "＋ version"], ["+copy", "＋ copy"]
    ].filter(([v], i, A) => v && (v.startsWith("+") || A.findIndex(x => x[0] === v) === i));
    $("#svQuick").innerHTML = quick.map(([v, l]) => `<button type="button" data-v="${esc(v)}" title="${v.startsWith("+") ? "" : esc(v)}">${esc(v.startsWith("+") ? l : v.length > 38 ? v.slice(0, 36) + "…" : v)}</button>`).join("");
    $("#svPdf").checked = false; $("#svPdf").parentElement.classList.toggle("hidden", !!opts.isNew);
    $("#svGo").textContent = FS_OK ? "Choose folder & save" : "💾 Save";
    openModal("#saveModal"); setTimeout(() => { $("#svName").focus(); $("#svName").select(); }, 60);
  });
}
document.getElementById("svQuick").addEventListener("click", e => {
  const b = e.target.closest("[data-v]"); if(!b) return;
  const v = b.dataset.v, n = $("#svName"), cur = n.value.trim();
  if(v === "+date"){ const d = new Date().toISOString().slice(0, 10); n.value = cur.replace(/\s*-?\s*\d{4}-\d{2}-\d{2}$/, "") + " - " + d; }
  else if(v === "+v"){ const m = cur.match(/\s*-?\s*v(\d+)$/i); n.value = m ? cur.slice(0, m.index) + " - v" + (+m[1] + 1) : cur + " - v2"; }
  else if(v === "+copy") n.value = /\(copy\)$/i.test(cur) ? cur : cur + " (copy)";
  else n.value = v;
  n.focus();
});
document.getElementById("svName").addEventListener("keydown", e => { if(e.key === "Enter"){ e.preventDefault(); $("#svGo").click(); } });
document.addEventListener("keydown", e => { if(e.key !== "Escape") return; const open = [...document.querySelectorAll(".modal.open")].filter(m => m.id !== "startModal"); const top = open[open.length - 1]; if(top){ e.preventDefault(); top.classList.remove("open"); } });
document.getElementById("svGo").onclick = async () => {
  const name = cleanName($("#svName").value) || "exam", pdf = $("#svPdf").checked, res = svResolve; svResolve = null;
  $("#saveModal").classList.remove("open");
  let ok = false;
  if(!FS_OK){ downloadProject(name); toast("Saved " + name + ".exam.json to Downloads — open it later with 📂 Open"); ok = true; }
  else{
    try{
      const h = await showSaveFilePicker({ suggestedName: name + ".exam.json", types: PTYPES });
      if(svOpts.state){ await leaveCurrentFile(); S = svOpts.state; }      // a new exam replaces the old one only once its file is chosen
      await setHandle(h); await writeProject(true); toast("Saving to " + h.name + " — automatically every minute"); ok = true;
    }catch(e){ if(!(e && e.name === "AbortError")) toast("Couldn't save: " + (e.message || e)); }
  }
  if(ok && pdf) download({ name });
  if(res) res(ok);
};
// closing the dialog any other way (Cancel, Esc, clicking outside) = not saved
new MutationObserver(() => { if(!$("#saveModal").classList.contains("open") && svResolve){ const r = svResolve; svResolve = null; r(false); } }).observe(document.getElementById("saveModal"), { attributes: true, attributeFilter: ["class"] });
function applyState(o){ S = mergeState(o); refreshDetails(); updateLogoUI(); lastEdited = null; render(); preview(); histReset(); }
async function openProject(){
  if(!FS_OK){ $("#projIn").click(); return false; }
  try{
    const [h] = await showOpenFilePicker({ types: PTYPES, multiple: false });
    return await openFromHandle(h);
  }catch(e){ if(e && e.name === "AbortError") return false; toast("That file isn't a valid exam project"); return false; }
}
async function openFromHandle(h){
  try{
    const file = await h.getFile();
    if(fileKind(file)){ showBlocked(fileKind(file), [file.name]); return false; }
    if(/\.(txt|md|markdown|text)$/i.test(file.name)){ await handleFiles([file]); return true; }
    const o = JSON.parse(await file.text());
    if(!o || !Array.isArray(o.items)) throw new Error("not an exam project");
    await keepVersion("Before opening " + file.name);
    await leaveCurrentFile();
    applyState(o);
    try{ proj.perm = h.requestPermission ? await h.requestPermission({ mode: "readwrite" }) : "granted"; }catch(_){ proj.perm = "prompt"; }
    proj.handle = h; proj.name = h.name; proj.dirty = false; proj.lastWrite = Date.now();
    try{ await IDB.set("handle", h); }catch(_){}
    try{ await IDB.set("state", snapshot()); }catch(_){}
    updateChip(); toast("Opened " + h.name); return true;
  }catch(e){ if(e && e.name === "AbortError") return false; toast("That file isn't a valid exam project"); return false; }
}
function freshState(){
  const keep = S.d, n = defaults();
  ["school", "teacher", "paper", "fontSize", "lineSpacing", "accent", "instructions", "duration", "year", "title", "showMarks", "nameEveryPage", "restartNumbering", "sectionNewPage", "endMarker", "scoreTable", "bigInline"].forEach(k => { if(keep[k] !== undefined) n.d[k] = keep[k]; });
  n.logo = S.logo; n.savedAt = Date.now();
  return n;
}
async function newProject(){
  await keepVersion("Before starting a new exam");
  const fresh = freshState();
  if(FS_OK){
    const ok = await saveAs({ isNew: true, state: fresh });
    if(!ok) return false;
    S = fresh;
  }else{ await leaveCurrentFile(); await setHandle(null); S = fresh; }
  applyState(S); saveLocal(true);
  return true;
}
setInterval(() => { if(proj.dirty && proj.handle) writeProject(); }, 60000);
// browsers without file access (Safari, Firefox): remind every 10 minutes if there are changes not downloaded
setInterval(() => {
  if(FS_OK) return;
  const last = +(localStorage.getItem("examBuilder.lastDownload") || 0);
  if((S.savedAt || 0) > last && S.items.length) toast("Reminder: click 💾 Save as… to download a project copy — this browser can't save files automatically.");
}, 600000);
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden" && proj.dirty && proj.handle) writeProject(); });
window.addEventListener("beforeunload", e => { if(proj.dirty && proj.handle){ writeProject(); } });
document.addEventListener("keydown", e => { if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){ e.preventDefault(); if(proj.handle) writeProject(true).then(ok => ok && toast("Saved")); else saveAs(); } });
