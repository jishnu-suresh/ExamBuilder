/* ---- staying on the test: full screen, a warning sound and a lock only the teacher can open ---- */
let running = false, audio = null, wake = null, awaySince = 0, beepT = null;
function beep(){
  try{
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if(audio.state === "suspended") audio.resume();
    [0, .28, .56].forEach((t, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = "square"; o.frequency.value = i === 1 ? 660 : 880;
      g.gain.setValueAtTime(.0001, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(.35, audio.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + t + .24);
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + .26);
    });
  }catch(e){ console.warn(e); }
}
async function keepAwake(){
  try{ if("wakeLock" in navigator && document.visibilityState === "visible" && !wake){ wake = await navigator.wakeLock.request("screen"); wake.addEventListener("release", () => { wake = null; }); } }
  catch(e){ if(!keepAwake.told){ keepAwake.told = 1; toast("Keep the charger plugged in so the screen doesn't go to sleep.", 6000); } }
}
async function goFull(){ try{ if(!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: "hide" }); }catch(_){} }
function guardStart(){
  running = true;
  try{ audio = audio || new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); }catch(_){}
  goFull(); keepAwake();
}
function guardStop(){ running = false; clearInterval(beepT); try{ wake && wake.release(); }catch(_){} if(document.fullscreenElement) document.exitFullscreen().catch(() => {}); }
function left(how){
  if(!running || !ST || ST.endedAt) return;
  if(!awaySince) awaySince = now();
  if(ST.locked) return;
  ST.locked = { at: now(), how };
  logEv("left", { how });
  beep(); clearInterval(beepT);
  let n = 0; beepT = setInterval(() => { if(++n > 6 || document.visibilityState === "visible" && document.hasFocus()) return clearInterval(beepT); beep(); }, 4000);
  showLock(); saveNow();
}
function back(){
  if(!running || !awaySince) return;
  const ms = now() - awaySince; awaySince = 0;
  logEv("back", { ms });
  if(ST.locked) beep();
}
document.addEventListener("visibilitychange", () => { if(document.visibilityState === "hidden") left("switched to another window or app"); else { back(); keepAwake(); } });
window.addEventListener("blur", () => setTimeout(() => { if(!document.hasFocus()) left("clicked outside the test"); }, 150));
window.addEventListener("focus", back);
document.addEventListener("fullscreenchange", () => { if(!document.fullscreenElement && running && !ST.locked && !ST.endedAt) left("left full screen"); });
function showLock(){ $("#scrLock").classList.remove("hidden"); $("#lkCode").value = ""; $("#lkErr").textContent = ""; setTimeout(() => $("#lkCode").focus(), 50); }
async function teacherOK(code){ return (await BC.codeHash(code, EXAM.unlock.salt, EXAM.unlock.iter)) === EXAM.unlock.hash; }
$("#lkGo").onclick = async () => {
  const c = $("#lkCode").value;
  if(!c || !(await teacherOK(c))){ $("#lkErr").textContent = "That's not the teacher code."; logEv("wrong teacher code"); return; }
  ST.locked = null; logEv("unlocked by teacher"); $("#scrLock").classList.add("hidden"); changed(); saveNow(); goFull(); keepAwake();
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
function tick(){
  if(!ST || ST.endedAt || !EXAM.timeMin) return;
  const ms = leftMs(), t = $("#bTimer");
  t.classList.remove("hidden"); t.textContent = "⏱ " + dur(ms); t.classList.toggle("low", ms < 5 * 60000);
  ST.warned = ST.warned || {};
  if(ms < 10 * 60000 && !ST.warned[10] && ms > 5 * 60000){ ST.warned[10] = 1; toast("10 minutes left.", 6000); }
  if(ms < 5 * 60000 && !ST.warned[5] && ms > 0){ ST.warned[5] = 1; toast("5 minutes left. Check your answers.", 7000); }
  if(ms <= 0) endTest("time");
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
  $("#tInfo").innerHTML = `${esc(ST.name)} · started ${hm(ST.startedAt)}${EXAM.timeMin ? ` · time allowed ${EXAM.timeMin + (ST.extraMin || 0)} min` : ""} · left the test ${lefts} time${lefts === 1 ? "" : "s"}`;
}
document.querySelectorAll("#tMenu [data-add]").forEach(b => b.onclick = () => {
  const m = +b.dataset.add; ST.extraMin = (ST.extraMin || 0) + m; ST.warned = {}; logEv("time added by teacher", { min: m }); changed(); saveNow(); tick(); teacherInfo(); toast(`${m} minutes added.`);
});
$("#tEnd").onclick = () => { closeM("#mTeacher"); endTest("teacher"); };
