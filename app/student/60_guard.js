/* ---- staying on the test: full screen, a warning sound and a lock only the teacher can open ---- */
let running = false, audio = null, wake = null, awaySince = 0, beepT = null, beeps = 0;
// sound must be switched on during a click (browsers mute pages that never asked): called by Start and Unlock
function soundOn(){
  try{
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if(audio.state !== "running") audio.resume();
    const b = audio.createBuffer(1, 1, 22050), s = audio.createBufferSource(); s.buffer = b; s.connect(audio.destination); s.start(0);   // a silent sound unlocks Safari
  }catch(e){ console.warn(e); }
}
function beep(){
  beeps++;
  try{
    if(!audio) soundOn();
    if(audio.state !== "running") audio.resume();
    [0, .28, .56].forEach((t, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "square"; o.frequency.value = i === 1 ? 660 : 880;
      g.gain.setValueAtTime(.0001, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(.4, audio.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + t + .24);
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + .26);
    });
  }catch(e){ console.warn(e); }
}
async function keepAwake(){
  try{ if("wakeLock" in navigator && document.visibilityState === "visible" && !wake){ wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } }
  catch(e){ if(!keepAwake.told){ keepAwake.told = 1; toast("Keep the charger plugged in so the screen doesn't go to sleep.", 6000); } }
}
// full screen, and in Chrome/Edge the keyboard too: Esc, Alt+Tab, the Windows key… stay inside the test
// (the browser always keeps one way out: holding Esc for 2 seconds — that still locks the test and beeps)
async function goFull(){
  try{ if(!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: "hide" }); }catch(_){}
  try{ if(document.fullscreenElement && navigator.keyboard && navigator.keyboard.lock) await navigator.keyboard.lock(); }catch(_){}
}
function guardStart(){ running = true; soundOn(); goFull(); keepAwake(); }
function guardStop(){ running = false; clearInterval(beepT); beepT = null; try{ navigator.keyboard && navigator.keyboard.unlock && navigator.keyboard.unlock(); }catch(_){} try{ wake && wake.release(); }catch(_){} if(document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
const away = () => document.visibilityState === "hidden" || !document.hasFocus();
// every time the student leaves: beep, lock, record — and keep beeping until they come back
function left(how){
  if(!running || !ST || ST.endedAt || (typeof picking !== "undefined" && picking)) return;
  if(!awaySince) awaySince = now();
  logEv("left", { how });
  if(!ST.locked){ ST.locked = { at: now(), how }; showLock(); }
  beep();
  if(!beepT) beepT = setInterval(() => { if(!running || !away()){ clearInterval(beepT); beepT = null; return; } beep(); }, 2000);
  saveNow();
}
function back(){
  if(!running || !awaySince) return;
  const ms = now() - awaySince; awaySince = 0;
  logEv("back", { ms });
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") left("switched to another window or app, or minimised"); else { back(); keepAwake(); } });
window.addEventListener("blur", () => setTimeout(() => { if(!document.hasFocus()) left("clicked outside the test"); }, 150));
window.addEventListener("focus", back);
// leaving full screen counts as leaving the test: beep, lock, only the teacher can reopen it
document.addEventListener("fullscreenchange", () => { if(!document.fullscreenElement && running && ST && !ST.endedAt) left("left full screen"); });
// keys that try to leave, while the keyboard is captured
document.addEventListener("keydown", e => {
  if(!running || !ST || ST.endedAt) return;
  if((e.altKey && (e.key === "Tab" || e.key === "F4")) || e.key === "Meta" || e.key === "OS" || (e.metaKey && /^(tab|h|m|q|w)$/i.test(e.key))){
    e.preventDefault(); logEv("tried to leave with the keyboard", { key: (e.altKey ? "Alt+" : e.metaKey ? "Cmd+" : "") + e.key }); beep(); toast("Stay on the test, please.");
  }
}, true);
// the lock covers everything: the paper, the maths keyboard, the reading bar, a drawing in progress
function showLock(){
  try{ stopReading(); }catch(_){}
  try{ window.mathVirtualKeyboard && mathVirtualKeyboard.hide(); }catch(_){}
  $$(".modal").forEach(m => m.classList.add("hidden")); $("#accBar").classList.add("hidden");
  if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
  $("#scrLock").classList.remove("hidden"); $("#lkCode").value = ""; $("#lkErr").textContent = ""; setTimeout(() => $("#lkCode").focus(), 50); }
async function teacherOK(code){ return (await BC.codeHash(code, EXAM.unlock.salt, EXAM.unlock.iter)) === EXAM.unlock.hash; }
$("#lkGo").onclick = async () => {
  soundOn(); goFull();                       // while the click still counts
  const c = $("#lkCode").value;
  if(!c || !(await teacherOK(c))){ $("#lkErr").textContent = "That's not the teacher code."; logEv("wrong teacher code"); return; }
  ST.locked = null; logEv("unlocked by teacher"); $("#scrLock").classList.add("hidden"); if(ST.prefs.accents && !READ_ONLY()) $("#accBar").classList.remove("hidden"); clearInterval(beepT); beepT = null; changed(); saveNow(); soundOn(); goFull(); keepAwake();
};
$("#lkCode").addEventListener("keydown", e => { if(e.key === "Enter") $("#lkGo").click(); });

/* no pasting answers in, no copying questions out, no printing */
["paste", "drop"].forEach(ev => document.addEventListener(ev, e => { if(running && !(e.target.closest && e.target.closest(".txtin"))){ e.preventDefault(); toast("Pasting is switched off during the test."); logEv("tried to paste"); } }, true));
["copy", "cut"].forEach(ev => document.addEventListener(ev, e => { if(running && !(e.target.closest && e.target.closest("textarea, math-field"))) e.preventDefault(); }, true));
document.addEventListener("contextmenu", e => { if(running) e.preventDefault(); });
document.addEventListener("keydown", e => {
  if(!running) return;
  const k = e.key.toLowerCase();
  if((e.ctrlKey || e.metaKey) && ["p", "s", "o", "u"].includes(k)){ e.preventDefault(); }
});

/* ---- the clock ---- */
// the clock, as the teacher chose: "show" (countdown), "hide" (no countdown, only the 10 and 5 minute notices),
// "checks" (countdown plus a time check every 15 minutes). A rest break pauses it.
function tick(){
  if(!ST || ST.endedAt || !EXAM.timeMin) return;
  const ms = leftMs(), t = $("#bTimer"), mode = (EXAM.acc && EXAM.acc.clock) || "show";
  t.classList.toggle("hidden", mode === "hide");
  t.textContent = ST.breakAt ? "☕ paused" : "⏱ " + dur(ms); t.classList.toggle("low", ms < 5 * 60000);
  if(ST.breakAt) return;
  ST.warned = ST.warned || {};
  const note = (txt, ms) => mode === "hide" ? timeNote(txt) : toast(txt, ms);
  if(ms < 10 * 60000 && !ST.warned[10] && ms > 5 * 60000){ ST.warned[10] = 1; note("10 minutes left.", 6000); }
  if(ms < 5 * 60000 && !ST.warned[5] && ms > 0){ ST.warned[5] = 1; note("5 minutes left. Check your answers.", 7000); }
  if(mode === "checks"){
    const q = Math.floor(ms / 900000);                 // every 15 minutes
    if(ST.lastCheck == null) ST.lastCheck = q;
    if(q < ST.lastCheck && ms > 10 * 60000){ ST.lastCheck = q; timeNote("Time check: " + Math.round(ms / 60000) + " minutes left."); }
  }
  if(ms <= 0) endTest("time");
}
function timeNote(txt){
  const n = document.createElement("div"); n.className = "time-note"; n.setAttribute("role", "status"); n.textContent = "⏱ " + txt;
  document.body.appendChild(n); setTimeout(() => n.remove(), 9000);
}
setInterval(tick, 1000);

/* ---- teacher menu: add time, end the test for this student ---- */
$("#bTeacher").onclick = () => { $("#tCodeRow").classList.remove("hidden"); $("#tMenu").classList.add("hidden"); $("#tCode").value = ""; $("#tErr").textContent = ""; openM("#mTeacher"); setTimeout(() => $("#tCode").focus(), 50); };
$("#tCode").addEventListener("keydown", e => { if(e.key === "Enter") $("#tOk").click(); });
$("#tOk").onclick = async () => {
  if(!(await teacherOK($("#tCode").value))){ $("#tErr").textContent = "That's not the teacher code."; return; }
  $("#tCodeRow").classList.add("hidden"); $("#tMenu").classList.remove("hidden"); teacherInfo();
};
function teacherInfo(){
  const lefts = ST.log.filter(l => l.kind === "left").length;
  $("#tSaveInfo").innerHTML = "💾 Answers and backups are saved in: <b>" + esc(saveWhere()) + "</b>";
  $("#tSave").classList.toggle("hidden", !("showDirectoryPicker" in window) || READ_ONLY());
  $("#tInfo").innerHTML = `${esc(ST.name)} · started ${hm(ST.startedAt)}${EXAM.timeMin ? ` · time allowed ${EXAM.timeMin + (ST.extraMin || 0)} min` : ""} · left the test ${lefts} time${lefts === 1 ? "" : "s"}`;
}
document.querySelectorAll("#tMenu [data-add]").forEach(b => b.onclick = () => {
  const m = +b.dataset.add; ST.extraMin = (ST.extraMin || 0) + m; ST.warned = {}; logEv("time added by teacher", { min: m }); changed(); saveNow(); tick(); teacherInfo(); toast(`${m} minutes added.`);
});
$("#tSave").onclick = async () => { if(await chooseFolder()){ logEv("teacher chose where to save", { folder: saveDir.name }); teacherInfo(); saveNow(); toast("Answers and backups now go to " + saveDir.name + "."); } goFull(); };
$("#mTeacher").addEventListener("click", e => { if(e.target.closest("[data-close]") && running && ST && !ST.endedAt) goFull(); });
$("#tEnd").onclick = () => { closeM("#mTeacher"); endTest("teacher"); };
