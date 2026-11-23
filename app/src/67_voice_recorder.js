/* ---------------- 🎙️ the teacher's own voice for read aloud (💻 computer version) ----------------
   The instructions, each part, text, question (with its options) and (a)/(b) part can be recorded once.
   Recordings live in S.audio (saved in the .exam.json file, but outside d/items, so undo and typing never copy them)
   and go inside the student file, where students hear the teacher instead of the computer voice.
   A recording is only used while its text is unchanged: edit a question and the recording is marked
   "text changed" (✓ Still right keeps it). In versions A–D, a question whose options are shuffled keeps
   the computer voice, so a recording can never read the options in the wrong order. */
const AUD = () => (S.audio && typeof S.audio === "object" && !Array.isArray(S.audio)) ? S.audio : (S.audio = {});
const REC_MAX_S = 180;

// what can be read aloud, in reading order, with the same keys the student file uses (40_paper.js)
function recUnits(items){
  const saved = S.items; let M; S.items = items; try{ M = computeMeta(); }finally{ S.items = saved; }
  const out = [];
  if(String(S.d.instructions || "").trim()) out.push({ key: "ins", label: "Instructions", text: String(S.d.instructions), sig: strHash("ins|" + S.d.instructions) });
  for(const it0 of items){
    const it = cloneItem(it0); ensureOptions(it);
    const t = String(it.text || "");
    if(it.type === "section"){ if(t.trim()) out.push({ key: it.id, label: "Part", text: t, sig: strHash("sec|" + t) }); continue; }
    if(it.type !== "q"){ if(it.pagebreak || !t.trim()) continue; out.push({ key: it.id, label: it.heading ? "Sub-heading" : "Text", text: t, sig: strHash("note|" + t) }); continue; }
    const opts = it.mcq ? optionList(it).map(x => x.L + ": " + x.o) : [];
    const qn = it.nonum ? "Question" : "Question " + (M.meta[it.id] || "");
    out.push({ key: it.id, label: qn + (it.mcq ? " · multiple choice" : ""), text: t + (opts.length ? "\n" + opts.join("\n") : ""), sig: strHash("q|" + t + "|" + opts.join("|")) });
    (Array.isArray(it.subs) ? it.subs : []).forEach((sb, k) => {
      const st = String(sb.text || ""); if(!st.trim()) return;
      out.push({ key: "s:" + it.id + ":" + (sb.id || String(k)), label: qn + " (" + LETTERS[k] + ")", text: st, sig: strHash("sub|" + st) });
    });
  }
  return out;
}
// the recordings that still match their text, for the student file: { key: data URL }
function voiceFor(items){
  const A = AUD(), out = {};
  for(const u of recUnits(items)){ const r = A[u.key]; if(r && r.src && r.sig === u.sig) out[u.key] = r.src; }
  return out;
}
function recCounts(){
  const A = AUD(), us = recUnits(S.items); let ok = 0, old = 0, bytes = 0;
  for(const u of us){ const r = A[u.key]; if(!r || !r.src) continue; bytes += r.src.length * .75; if(r.sig === u.sig) ok++; else old++; }
  return { ok, old, total: us.length, bytes };
}
function recInfo(){
  const el = $("#stuRecInfo"); if(!el) return;
  const c = recCounts();
  el.textContent = !c.ok && !c.old ? "Record the questions yourself: students hear you instead of the computer voice."
    : c.ok + " of " + c.total + " recorded in your voice" + (c.old ? " · ⚠ " + c.old + " changed since you recorded " + (c.old === 1 ? "it" : "them") + " (the computer voice reads " + (c.old === 1 ? "it" : "them") + ")" : "");
}
// the text as the teacher reads it: pictures and formatting marks out of the way
function recShow(t){
  return String(t || "").split("\n").map(l => RE_IMG.test(l) ? "[picture]" : l).join("\n")
    .replace(/\{(?:center|centre|right|left|justify|small|big|bigger|huge)\}/gi, "").replace(/\{(?:pic|mol)\s*:[^}]*\}/gi, "[picture]").replace(/\*\*|__/g, "").replace(/\n{3,}/g, "\n\n").trim();
}
const recDur = s => Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0");

/* ---- the window ---- */
const REC = { mr: null, key: null, stream: null, timer: null, t0: 0, sig: "" };
let recPlayer = null, recDelArm = null;
function renderRec(){
  const A = AUD(), us = recUnits(S.items), c = recCounts();
  $("#recSum").textContent = c.ok + " of " + c.total + " recorded" + (c.old ? " · ⚠ " + c.old + " to check" : "") + (c.bytes ? " · " + (c.bytes / 1e6).toFixed(1) + " MB" : "");
  $("#recList").innerHTML = us.map(u => {
    const r = A[u.key], ok = !!(r && r.src && r.sig === u.sig), old = !!(r && r.src && !ok), live = REC.mr && REC.key === u.key;
    const st = live ? "🔴 Recording…" : ok ? "✅ Recorded · " + recDur(r.dur || 0) : old ? "⚠ The text changed since you recorded it: record again, or ✓ Still right" : "Not recorded: the computer voice reads it";
    return `<div class="rec-item ${ok ? "ok" : old ? "old" : ""} ${live ? "live" : ""}" data-key="${esc(u.key)}">
      <div class="rec-h"><b>${esc(u.label)}</b><span class="rec-st">${esc(st)}</span></div>
      <div class="rec-t">${esc(recShow(u.text))}</div>
      <div class="rec-b"><button type="button" class="btn sm ${live ? "on" : ""}" data-rec>${live ? "■ Stop " + recDur((Date.now() - REC.t0) / 1000) : r && r.src ? "● Record again" : "● Record"}</button>
        ${r && r.src && !live ? `<button type="button" class="btn sm" data-play>▶ Play</button>` : ""}
        ${old && !live ? `<button type="button" class="btn sm" data-keep title="The recording still matches the text">✓ Still right</button>` : ""}
        ${r && r.src && !live ? `<button type="button" class="btn sm" data-del title="Delete this recording">🗑</button>` : ""}</div></div>`;
  }).join("") || `<p class="hint">Add some questions first.</p>`;
  recInfo();
}
function openRecorder(){ renderRec(); openModal("#recModal"); }

async function startRec(key){
  if(REC.mr) await stopRec();
  stopPreview();
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)){ toast("This browser can't record sound. Please use Chrome, Edge, Safari or Firefox.", 6000); return; }
  const u = recUnits(S.items).find(x => x.key === key); if(!u) return;
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch(e){ toast(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "BEE needs permission to use the microphone: click Allow (or the 🔒 next to the web address)." : "No microphone was found" + (e && e.message ? ": " + e.message : "."), 7000); return; }
  // AAC (.m4a) plays everywhere, Safari and iPads included; Chrome may only offer WebM/Opus (the student file falls back to the computer voice if a laptop can't play it)
  const type = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || "";
  let mr;
  try{ mr = new MediaRecorder(stream, Object.assign({ audioBitsPerSecond: 48000 }, type ? { mimeType: type } : {})); }
  catch(_){ try{ mr = new MediaRecorder(stream); }catch(e){ stream.getTracks().forEach(t => t.stop()); toast("Couldn't start recording: " + (e.message || e)); return; } }
  const parts = [], t0 = Date.now(), sig = u.sig;
  mr.ondataavailable = e => { if(e.data && e.data.size) parts.push(e.data); };
  const done = new Promise(res => { mr.onstop = res; });
  Object.assign(REC, { mr, key, stream, t0, sig, done });
  REC.save = async () => {
    await done;
    stream.getTracks().forEach(t => t.stop());
    const dur = (Date.now() - t0) / 1000, mime = (mr.mimeType || type || "audio/webm").split(";")[0];
    if(dur < 0.6 || !parts.length){ toast("That was too short: nothing was kept."); return; }
    const blob = new Blob(parts, { type: mime });
    const src = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
    AUD()[key] = { src, sig, dur: Math.round(dur * 10) / 10, at: Date.now() };
    saveLocal(); toast("Recorded (" + recDur(dur) + ")");
  };
  mr.start(1000);
  REC.timer = setInterval(() => {
    if(!REC.mr) return;
    if((Date.now() - REC.t0) / 1000 >= REC_MAX_S){ toast("Recordings stop after 3 minutes."); stopRec(); return; }
    const b = document.querySelector(`#recList .rec-item[data-key="${CSS.escape(REC.key)}"] [data-rec]`); if(b) b.textContent = "■ Stop " + recDur((Date.now() - REC.t0) / 1000);
  }, 500);
  renderRec();
}
async function stopRec(){
  if(!REC.mr) return;
  const { mr, save } = REC; clearInterval(REC.timer);
  REC.mr = null; REC.key = null;
  try{ if(mr.state !== "inactive") mr.stop(); }catch(_){}
  try{ await save(); }catch(e){ toast("Couldn't keep the recording: " + (e.message || e)); }
  renderRec();
}
function stopPreview(){ if(recPlayer){ try{ recPlayer.pause(); }catch(_){} recPlayer = null; } }
$("#recList").addEventListener("click", async e => {
  const item = e.target.closest(".rec-item"); if(!item) return;
  const key = item.dataset.key, A = AUD();
  if(e.target.closest("[data-rec]")){ if(REC.mr && REC.key === key) await stopRec(); else await startRec(key); return; }
  if(e.target.closest("[data-play]")){
    const r = A[key]; if(!r) return;
    stopPreview(); recPlayer = new Audio(r.src);
    recPlayer.play().catch(() => toast("This browser can't play the recording."));
    return;
  }
  if(e.target.closest("[data-keep]")){ const u = recUnits(S.items).find(x => x.key === key); if(u && A[key]){ A[key].sig = u.sig; saveLocal(); renderRec(); } return; }
  const del = e.target.closest("[data-del]");
  if(del){
    if(recDelArm !== key){ recDelArm = key; del.textContent = "🗑 Delete?"; setTimeout(() => { if(recDelArm === key){ recDelArm = null; if(document.body.contains(del)) del.textContent = "🗑"; } }, 3000); return; }
    recDelArm = null; stopPreview(); delete A[key]; saveLocal(); renderRec(); toast("Recording deleted");
  }
});
// closing the window stops a recording (and keeps it) and any playback
new MutationObserver(() => { if(!$("#recModal").classList.contains("open")){ stopPreview(); if(REC.mr) stopRec(); recInfo(); } })
  .observe(document.getElementById("recModal"), { attributes: true, attributeFilter: ["class"] });
$("#stuRecBtn").onclick = openRecorder;
