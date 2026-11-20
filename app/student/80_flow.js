/* ---- start → test → end ---- */
let RESUME = null, saveDir = null, lastBackup = 0, picking = false;
const safeName = s => String(s || "").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "exam";
function saveFile(text, name, type){
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

async function boot(){
  if(!EXAM){ document.body.innerHTML = '<div class="screen"><div class="box"><h1>🐝 BEE student version</h1><p>This is an empty template. Teachers make the real file in BEE: ⬇ ▾ → 💻 Computer version for students.</p></div></div>'; return; }
  document.title = EXAM.title + " — computer version";
  if(!window.crypto || !crypto.subtle){ document.body.innerHTML = '<div class="screen"><div class="box"><h1>This browser can\'t open the test</h1><p>Please open this file with Chrome, Edge, Firefox or Safari.</p></div></div>'; return; }
  $("#stTitle").textContent = EXAM.title; $("#stSub").textContent = EXAM.subject || "";
  const facts = [];
  if(EXAM.timeMin) facts.push(["Time", EXAM.timeMin + " minutes" + (EXAM.extraPct ? ` (includes ${EXAM.extraPct}% extra time)` : "")]); else facts.push(["Time", "no time limit"]);
  if(EXAM.total) facts.push(["Total", EXAM.total + " marks"]);
  facts.push(["Questions", EXAM.nq]);
  $("#stFacts").innerHTML = facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("");
  if(!("showDirectoryPicker" in window)){ $("#stSaveBtn").classList.add("hidden"); $("#stSaveName").textContent = "this computer's Downloads folder (this browser can't choose another one)"; }
  else { const h = await DB.get("dir:" + EXAM.examId); if(h && h.name) $("#stSaveName").textContent = h.name + " — click Choose to connect it again"; }
  if(READ_ONLY()){
    $("#stSub").textContent = (EXAM.subject ? EXAM.subject + " · " : "") + "Read-aloud version";
    $("#stRules").innerHTML = "<li>Click 🔊 next to a question to hear it. You can pause, slow down, change the voice, or let it keep reading.</li><li><b>Write your answers on your printed paper.</b></li><li>Stay on this screen. <b>If you leave it, it locks</b> with a sound and only your teacher can open it again.</li>";
    ["#stNew", "#stSaveRow", "#stBackup"].forEach(s => $(s).classList.add("hidden"));
    $("#stGo").textContent = "Open the paper";
  }
  const done = await DB.get(DONE());
  if(done) return showEnded(done);
  const run = await DB.get(RUN());
  if(run && !run.ended && !READ_ONLY()) setResume(run, "this computer");
  if(run && !run.ended && READ_ONLY()) RESUME = Object.assign(run, { where: "this computer" });
  show("#scrStart"); setTimeout(() => (RESUME ? $("#stCode") : $("#stName")).focus(), 60);
}
function setResume(run, where){
  RESUME = run; RESUME.where = where;
  $("#stNew").classList.add("hidden"); $("#stResume").classList.remove("hidden"); $("#stResName").textContent = run.name || "";
  $("#stGo").textContent = "Carry on with the test";
}
$("#stCode").addEventListener("keydown", e => { if(e.key === "Enter") $("#stGo").click(); });
$("#stName").addEventListener("keydown", e => { if(e.key === "Enter") $("#stClass").focus(); });
$("#stClass").addEventListener("keydown", e => { if(e.key === "Enter") $("#stCode").focus(); });

$("#stGo").onclick = async () => {
  const err = $("#stErr"); err.textContent = "";
  const name = $("#stName").value.trim();
  if(!RESUME && !READ_ONLY() && name.length < 2){ err.textContent = "Please type your name first."; $("#stName").focus(); return; }
  const code = $("#stCode").value;
  if(!code){ err.textContent = "Your teacher needs to type the start code."; $("#stCode").focus(); return; }
  goFull(); soundOn();                       // must happen right away, while the click still counts
  $("#stGo").disabled = true; $("#stGo").textContent = "Opening…";
  try{
    const key = await BC.codeKey(code, EXAM.salt, EXAM.iter);
    try{ PAPER = await BC.unlock(key, EXAM.paper); }
    catch(_){ throw new Error("code"); }
    CK = key;
    if(RESUME){
      ST = await BC.unlock(CK, RESUME.box);
      const gap = now() - (ST.savedAt || now());
      logEv(RESUME.where === "this computer" ? "test reopened" : "carried on from a backup (another computer)", { ms: gap });
      if(ST.locked){ ST.locked = null; logEv("unlocked by teacher (start code)"); }
    }else{
      ST = { v: 1, examId: EXAM.examId, name, cls: $("#stClass").value.trim(), startedAt: now(), extraMin: 0, answers: {}, flags: {}, log: [], prefs: { size: 17, rate: 1, mathKb: true, accents: false }, ua: navigator.userAgent };
      logEv("started");
    }
    startExam();
  }catch(e){
    if(e.message !== "code") console.error(e);
    err.textContent = e.message === "code" ? "That start code isn't right. Check it with your teacher." : "Something went wrong: " + e.message;
    if(document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }finally{ $("#stGo").disabled = false; $("#stGo").textContent = READ_ONLY() ? "Open the paper" : RESUME ? "Carry on with the test" : "Start the test"; }
};
function startExam(){
  const RO = READ_ONLY();
  $("#bTitle").textContent = EXAM.title; $("#bWho").textContent = RO ? "· read-aloud version" : "· " + ST.name + (ST.cls ? " · " + ST.cls : "");
  ["#bMathKb", "#bAccents", "#bEnd"].forEach(s => $(s).classList.toggle("hidden", RO));
  ["#bFinish", "#bReadAll"].forEach(s => $(s).classList.toggle("hidden", !RO));
  $(".nav .key").classList.toggle("hidden", RO);
  show("#scrExam"); if(!RO) setupMathKeyboard(); renderPaper(); applyPrefs(); setupReading(); if(ST.prefs.accents && !RO){ accBar(); $("#accBar").classList.remove("hidden"); }
  guardStart(); tick(); changed(); saveNow();
  window.scrollTo(0, 0);
}

/* ---- backup copy on a USB stick or folder (Chrome / Edge) ---- */
/* ---- where files are saved: one folder (a USB stick, a shared drive…) for backups and the answers file; Chrome / Edge ---- */
async function chooseFolder(){
  picking = true;                         // the folder window takes the focus: that is not leaving the test
  try{
    const old = await DB.get("dir:" + EXAM.examId);
    saveDir = await showDirectoryPicker(Object.assign({ id: "bee-answers", mode: "readwrite" }, old ? { startIn: old } : {}));
    await DB.set("dir:" + EXAM.examId, saveDir);
    lastBackup = 0;
    return true;
  }catch(_){ return false; }
  finally{ setTimeout(() => { picking = false; }, 600); }
}
const saveWhere = () => saveDir ? saveDir.name : "this computer's Downloads folder";
$("#stSaveBtn").onclick = async () => { if(await chooseFolder()) $("#stSaveName").textContent = saveDir.name + " ✓"; };
window.backupTick = async box => {
  if(!saveDir || now() - lastBackup < 60000 && !ST.endedAt) return;
  lastBackup = now();
  try{
    const f = await saveDir.getFileHandle(safeName(EXAM.title + " - " + ST.name) + " (backup).bee-backup", { create: true });
    const w = await f.createWritable(); await w.write(JSON.stringify({ bee: "backup", v: 1, examId: EXAM.examId, name: ST.name, savedAt: now(), box })); await w.close();
    window.lastFolderSave = now();
  }catch(e){ console.warn("backup", e); }
};
$("#stBackup").onclick = () => {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".bee-backup";
  inp.onchange = async () => {
    try{
      const o = JSON.parse(await inp.files[0].text());
      if(o.bee !== "backup" || !o.box) throw new Error("This isn't a BEE backup file.");
      if(o.examId !== EXAM.examId) throw new Error("This backup is from a different test.");
      setResume({ name: o.name, box: o.box }, "backup"); $("#stErr").textContent = "";
      toast("Backup found for " + o.name + ". Your teacher types the start code to carry on.", 5000);
    }catch(e){ $("#stErr").textContent = e.message; }
  };
  inp.click();
};

/* ---- end the test ---- */
$("#bEnd").onclick = () => {
  const qs = PAPER.items.filter(it => it.k === "q"), miss = qs.filter(it => !isAnswered(it)), fl = qs.filter(it => ST.flags[it.id]);
  $("#endInfo").innerHTML = (miss.length ? `<p>You haven't answered <b>${miss.length}</b> question${miss.length === 1 ? "" : "s"}:</p><div class="list-miss">${miss.map(it => `<a href="#q-${it.id}" data-close>${esc(it.no || "•")}</a>`).join("")}</div>` : "<p>✓ You have answered every question.</p>") +
    (fl.length ? `<p>🚩 You wanted to come back to:</p><div class="list-miss">${fl.map(it => `<a class="f" href="#q-${it.id}" data-close>${esc(it.no || "•")}</a>`).join("")}</div>` : "") +
    (EXAM.timeMin && leftMs() > 0 ? `<p class="muted">You still have ${dur(leftMs())} left.</p>` : "");
  openM("#mEnd");
};
$("#endGo").onclick = () => { closeM("#mEnd"); endTest("student"); };
$("#bFinish").onclick = () => openM("#mFinish");
$("#finGo").onclick = () => { closeM("#mFinish"); finishReading("student"); };
async function finishReading(by){
  if(!ST || ST.endedAt) return;
  ST.endedAt = now(); ST.endedBy = by; logEv("finished", { by });
  guardStop(); stopReading(); $("#scrLock").classList.add("hidden"); $$(".modal").forEach(m => m.classList.add("hidden"));
  await saveNow();
  show("#scrEnded");
  $("#scrEnded h1").textContent = "Finished";
  $("#enWho").textContent = by === "time" ? "Time is up." : by === "teacher" ? "Your teacher closed the paper." : "";
  $("#scrEnded p:nth-of-type(2)").textContent = "Hand in your printed paper. You can close this window.";
  $("#enWhere").classList.add("hidden"); $("#enAgain").classList.add("hidden");
}
async function endTest(by){
  if(READ_ONLY()) return finishReading(by);
  if(!ST || ST.endedAt) return;
  ST.endedAt = now(); ST.endedBy = by; logEv("ended", { by });
  guardStop(); stopReading(); $("#scrLock").classList.add("hidden"); $$(".modal").forEach(m => m.classList.add("hidden"));
  if(window.mathVirtualKeyboard) try{ mathVirtualKeyboard.hide(); }catch(_){}
  const payload = { examId: EXAM.examId, name: ST.name, cls: ST.cls, startedAt: ST.startedAt, endedAt: ST.endedAt, endedBy: by,
    timeMin: EXAM.timeMin, baseMin: EXAM.baseMin, extraPct: EXAM.extraPct, extraMin: ST.extraMin || 0, log: ST.log, answers: ST.answers, flags: ST.flags, prefs: ST.prefs, ua: ST.ua };
  const file = { bee: "answers", v: 1, kid: EXAM.kid, examId: EXAM.examId, title: EXAM.title, created: now(), sealed: await BC.seal(payload, EXAM.pub), teacher: EXAM.teacher };
  const name = safeName(EXAM.title + " - " + ST.name) + ".bee-answers", text = JSON.stringify(file);
  const done = { name, text, who: ST.name, at: ST.endedAt, by, folder: "" };
  // into the chosen folder; if there is none (or it was unplugged), into Downloads
  if(saveDir){ try{ const f = await saveDir.getFileHandle(name, { create: true }); const w = await f.createWritable(); await w.write(text); await w.close(); done.folder = saveDir.name; }catch(e){ console.warn(e); } }
  if(!done.folder) saveFile(text, name);
  await DB.set(DONE(), done);
  await saveNow();
  showEnded(done);
}
function showEnded(done){
  show("#scrEnded");
  $("#enWho").textContent = (done.who ? done.who + " · " : "") + "ended at " + hm(done.at) + (done.by === "time" ? " (time was up)" : done.by === "teacher" ? " (by the teacher)" : "");
  $("#enFile").textContent = done.name;
  if(done.folder) $("#enWhere").innerHTML = `It is in the folder <b>${esc(done.folder)}</b> that your teacher chose. (The button below puts another copy in Downloads.)`;
  $("#enAgain").onclick = () => saveFile(done.text, done.name);
}
boot();
