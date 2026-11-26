/* ================= BEE · student computer version =================
   One file, no internet. The exam inside is locked with the start code; answers are sealed for the teacher. */
const EXAM = /*__EXAM__*/null;          // filled in by BEE when the teacher downloads this file
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const now = () => Date.now();
let PAPER = null;      // the decrypted question paper
let CK = null;         // AES key from the start code (keeps the saved answers private on this computer)
let ST = null;         // everything the student did
let dirty = false;

function toast(msg, ms){
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add("hidden"), ms || 3200);
}
function show(id){ ["#scrStart", "#scrExam", "#scrEnded"].forEach(s => $(s).classList.toggle("hidden", s !== id)); }
function openM(id){ $(id).classList.remove("hidden"); }
function closeM(id){ $(id).classList.add("hidden"); }
document.addEventListener("click", e => { const c = e.target.closest("[data-close]"); if(c) c.closest(".modal").classList.add("hidden"); });
function hm(ms){ const d = new Date(ms); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
function dur(ms){ const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); }
function logEv(kind, extra){ if(!ST) return; ST.log.push(Object.assign({ t: now(), kind }, extra || {})); dirty = true; }

/* ---- storage on this computer (IndexedDB, with localStorage as a fallback) ---- */
const DB = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    try{ const r = indexedDB.open("bee-student", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }catch(e){ rej(e); }
  }));
  const tx = (mode, fn) => open().then(db => new Promise((res, rej) => { const t = db.transaction("kv", mode), s = t.objectStore("kv"), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }));
  return {
    async get(k){ try{ return await tx("readonly", s => s.get(k)); }catch(_){ try{ const v = localStorage.getItem("bee:" + k); return v ? JSON.parse(v) : undefined; }catch(e){ return undefined; } } },
    async set(k, v){ try{ await tx("readwrite", s => s.put(v, k)); return true; }catch(_){ try{ localStorage.setItem("bee:" + k, JSON.stringify(v)); return true; }catch(e){ console.warn(e); return false; } } },
    // can answers be kept on this device? Not inside some file previews (iPad Files, apps that preview attachments)
    async works(){ const k = "probe:" + Math.random(); if(!(await this.set(k, 1))) return false; return (await this.get(k)) === 1; }
  };
})();
const RUN = () => "run:" + EXAM.examId, DONE = () => "done:" + EXAM.examId;

let saving = false;
async function saveNow(){
  if(!ST || !CK || saving) return;
  saving = true;
  try{
    dirty = false; ST.savedAt = now();
    const box = await BC.lock(CK, ST);
    const kept = await DB.set(RUN(), { name: ST.name, startedAt: ST.startedAt, ended: !!ST.endedAt, box });
    if(!kept){ $("#bSaved").textContent = "⚠ NOT saved on this device"; $("#bSaved").classList.add("bad"); $("#bSaved").title = "This file is open in a preview, so answers can't be kept here. Ask your teacher."; if(window.backupTick) backupTick(box); return; }
    $("#bSaved").classList.remove("bad");
    if(window.backupTick) backupTick(box);
    $("#bSaved").textContent = "✓ Saved " + hm(ST.savedAt) + " on this computer" + (typeof saveDir !== "undefined" && saveDir && window.lastFolderSave ? " · copy in " + saveDir.name + " " + hm(lastFolderSave) : "");
    $("#bSaved").title = typeof saveDir !== "undefined" && saveDir ? "Saved on this computer every few seconds, and a backup copy goes to " + saveDir.name + " every minute." : "Saved on this computer every few seconds. Your teacher can also keep a copy on a USB stick or folder.";
  }catch(e){ console.error(e); $("#bSaved").textContent = "⚠ Not saved"; }
  finally{ saving = false; }
}
setInterval(() => { if(dirty) saveNow(); }, 3000);
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden" && dirty) saveNow(); });
window.addEventListener("pagehide", () => { if(dirty) saveNow(); });
function changed(){ dirty = true; }

/* ---- time ---- */
function allowedMs(){ return EXAM.timeMin ? (EXAM.timeMin + (ST.extraMin || 0)) * 60000 : 0; }
// rest breaks pause the clock: finished breaks are in ST.paused (ms); a break in progress started at ST.breakAt
function leftMs(){ return ST.startedAt + allowedMs() + (ST.paused || 0) + (ST.breakAt ? now() - ST.breakAt : 0) - now(); }
