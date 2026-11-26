/* ---- start → test → end ---- */
let RESUME = null, saveDir = null, lastBackup = 0, picking = false;
const fileStem = (...parts) => parts.flat().filter(Boolean).map(p => String(p).normalize("NFC")
  .replace(/[\\/:*?"<>|()\[\]{}#%&+,;=@!$'`~^]+/g, " ").trim().replace(/\s*[-–—]\s*/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, ""))
  .filter(Boolean).join("_").slice(0, 110) || "exam";
function saveFile(text, name, type){
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" })); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

let STORE_OK = true;

/* ---- 📂 the student link (any browser; the workaround for iPads, shared by Jishnu): an empty player that opens a student file ----
   iPad Safari can't open an HTML file from Files, so the student opens this page and chooses the file.
   The exam stays sealed: only the start code opens it, exactly as in the file itself. */
function examFromFile(text){
  const at = text.indexOf("let EXAM = ") >= 0 ? text.indexOf("let EXAM = ") + 11 : text.indexOf("const EXAM = ") >= 0 ? text.indexOf("const EXAM = ") + 13 : -1;
  if(at < 0 || text[at] !== "{") return null;
  let depth = 0, str = false, esc = false, end = -1;            // the end of the exam's data: matching braces, outside strings
  for(let i = at; i < text.length; i++){
    const ch = text[i];
    if(str){ if(esc) esc = false; else if(ch === "\\") esc = true; else if(ch === '"') str = false; continue; }
    if(ch === '"') str = true; else if(ch === "{") depth++; else if(ch === "}" && --depth === 0){ end = i + 1; break; }
  }
  if(end < 0) return null;
  try{ const ex = JSON.parse(text.slice(at, end).replace(/<\\!--/g, "<!--")); return ex && ex.bee === "student-exam" ? ex : null; }catch(_){ return null; }
}
function pickExam(){
  document.title = "BEE · take a test";
  const L = document.createElement("div"); L.id = "pick"; L.className = "screen pick-layer";
  L.innerHTML = `<div class="box pick">
    <div class="logo">🐝</div><h1>Take a test</h1>
    <p>Your teacher gives you the test file (it ends in <b>.html</b>). Choose it here: it opens in this browser, and your answers save on this device.</p>
    <label class="btn primary big" id="pkBtn" tabindex="0">📂 Choose the exam file<input type="file" id="pkFile" accept=".html,.htm,text/html"></label>
    <div class="err" id="pkErr" role="alert"></div>
    <p class="muted small">Opened this test before on this device? Choose the same file again: you carry on where you were.</p>
  </div>`;
  document.body.appendChild(L);
  $("#pkBtn").onkeydown = e => { if(e.key === "Enter" || e.key === " "){ e.preventDefault(); $("#pkFile").click(); } };
  $("#pkFile").onchange = async e => {
    const f = e.target.files && e.target.files[0]; if(!f) return;
    $("#pkErr").textContent = "Opening…";
    const ex = examFromFile(await f.text().catch(() => ""));
    e.target.value = "";
    if(!ex){ $("#pkErr").textContent = "That isn't a BEE test file. Choose the file your teacher gave you (it ends in computer-version.html or read-aloud.html)."; return; }
    EXAM = ex; L.remove(); boot();
  };
}
async function boot(){
  if(!EXAM) return pickExam();          // the student link (a website of its own, see student-site/): the student chooses the exam file
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
  // opened in a preview (not a web browser): answers can't be saved here — say so plainly
  STORE_OK = await DB.works().catch(() => false);
  if(!STORE_OK && !READ_ONLY()) $("#stPreview").classList.remove("hidden");
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

// developer tools docked in the window make the page much smaller than the window (browser zoom can look the same,
// so the teacher code lets the test start anyway — and the log says so)
// (not on iPads and phones: they have no developer tools here, and their on-screen keyboard changes the window's size)
const touchOnly = () => navigator.maxTouchPoints > 0 && matchMedia("(pointer: coarse)").matches && !matchMedia("(any-pointer: fine)").matches;
const devtoolsLikely = () => !touchOnly() && outerWidth > 0 && (outerWidth - innerWidth > 200 || outerHeight - innerHeight > 260);
let devOK = false, devOverride = false;
$("#stDevGo").onclick = async () => {
  if(!(await teacherOK($("#stDevCode").value))){ $("#stErr").textContent = "That's not the teacher code."; return; }
  devOK = devOverride = true; $("#stDevRow").classList.add("hidden"); $("#stErr").textContent = ""; toast("OK — now press Start the test.", 4000); $("#stGo").focus();
};
$("#stDevCode").addEventListener("keydown", e => { if(e.key === "Enter") $("#stDevGo").click(); });
$("#stGo").onclick = async () => {
  const err = $("#stErr"); err.textContent = "";
  if(!devOK && devtoolsLikely()){
    err.textContent = "The browser's developer tools look open (F12). Close them, then press Start again. If they aren't open (for example the page is zoomed), the teacher can type the teacher code to start anyway.";
    $("#stDevRow").classList.remove("hidden"); return;
  }
  // Chrome / Edge: a backup copy in a folder (a USB stick…) is rewritten every minute — ask once before starting without one
  if("showDirectoryPicker" in window && !saveDir && !READ_ONLY() && !window.__noFolderOK && !navigator.webdriver){
    window.__noFolderOK = true;
    err.textContent = "No backup folder yet. Choose a folder or USB stick (button below): a backup copy is rewritten there every minute, so nothing is lost if this laptop stops. Or press Start again to go without.";
    $("#stSaveRow").classList.add("nudge"); $("#stSaveBtn").focus(); return;
  }
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
      if(devOverride) logEv("started with the teacher code although the developer tools looked open");
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
  $("#bFinish").classList.toggle("hidden", !RO);
  $("#bReadAll").classList.toggle("hidden", !(RO || EXAM.readAloud));
  $("#bReadAll").textContent = RO ? "▶ Read from the start" : "🔊 Read aloud";
  $("#bReadAll").title = RO ? "Read the paper aloud from the beginning" : "Read aloud from the part on the screen (or press 🔊 next to any part)";
  $(".nav .key").classList.toggle("hidden", RO);
  // the paper comes first: an extra that can't start here (in a preview, an old browser…) never stops the questions appearing
  const safe = (f, what) => { try{ f(); }catch(e){ console.warn("BEE: " + what + " could not start here", e); } };
  show("#scrExam"); safe(() => { if(!RO) setupMathKeyboard(); }, "the maths keyboard"); renderPaper();
  safe(applyPrefs, "the display settings"); safe(setupReading, "read aloud"); safe(setupCalc, "the calculator");
  safe(() => { if(ST.prefs.accents && !RO){ accBar(); $("#accBar").classList.remove("hidden"); } }, "the accents bar");
  safe(guardStart, "the exam lock"); tick(); changed(); saveNow();
  window.scrollTo(0, 0);
  if(ST.breakAt) showBreak();          // carried on during a rest break: still paused
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
$("#stSaveBtn").onclick = async () => { if(await chooseFolder()){ $("#stSaveName").textContent = saveDir.name + " ✓"; $("#stSaveRow").classList.remove("nudge"); if(/backup folder/.test($("#stErr").textContent)) $("#stErr").textContent = ""; } };
window.backupTick = async box => {
  if(!saveDir || now() - lastBackup < 60000 && !ST.endedAt) return;
  lastBackup = now();
  try{
    const f = await saveDir.getFileHandle(fileStem(EXAM.title, ST.name, "backup") + ".bee-backup", { create: true });
    const w = await f.createWritable(); await w.write(JSON.stringify({ bee: "backup", v: 1, examId: EXAM.examId, name: ST.name, savedAt: now(), box })); await w.close();
    window.lastFolderSave = now();
  }catch(e){ console.warn("backup", e); }
};
$("#stBackup").onclick = () => {
  const old = document.getElementById("stFilePick"); if(old) old.remove();   // kept on the page until used (see BEE's fileChooser)
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".bee-backup"; inp.id = "stFilePick";
  inp.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0"; document.body.appendChild(inp);
  inp.addEventListener("cancel", () => inp.remove());
  inp.onchange = async () => {
    try{
      const o = JSON.parse(await inp.files[0].text());
      if(o.bee !== "backup" || !o.box) throw new Error("This isn't a BEE backup file.");
      if(o.examId !== EXAM.examId) throw new Error("This backup is from a different test.");
      setResume({ name: o.name, box: o.box }, "backup"); $("#stErr").textContent = "";
      toast("Backup found for " + o.name + ". Your teacher types the start code to carry on.", 5000);
    }catch(e){ $("#stErr").textContent = e.message; }
    inp.remove();
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
  if(ST.breakAt){ ST.paused = (ST.paused || 0) + now() - ST.breakAt; ST.breakAt = null; }
  guardStop(); stopReading(); $("#scrLock").classList.add("hidden"); $("#scrBreak").classList.add("hidden"); $$(".modal").forEach(m => m.classList.add("hidden"));
  await saveNow();
  show("#scrEnded");
  $("#scrEnded h1").textContent = "Finished";
  $("#enWho").textContent = by === "time" ? "Time is up." : by === "teacher" ? "Your teacher closed the paper." : "";
  $("#scrEnded p:nth-of-type(2)").textContent = "Hand in your printed paper. You can close this window.";
  $("#enWhere").classList.add("hidden"); $("#enAgain").classList.add("hidden"); $("#enNewRow").classList.add("hidden");
}
async function endTest(by){
  if(READ_ONLY()) return finishReading(by);
  if(!ST || ST.endedAt) return;
  ST.endedAt = now(); ST.endedBy = by; logEv("ended", { by });
  if(ST.breakAt){ ST.paused = (ST.paused || 0) + now() - ST.breakAt; ST.breakAt = null; }
  guardStop(); stopReading(); $("#scrLock").classList.add("hidden"); $("#scrBreak").classList.add("hidden"); $$(".modal").forEach(m => m.classList.add("hidden"));
  if(window.mathVirtualKeyboard) try{ mathVirtualKeyboard.hide(); }catch(_){}
  const payload = { examId: EXAM.examId, name: ST.name, cls: ST.cls, startedAt: ST.startedAt, endedAt: ST.endedAt, endedBy: by,
    timeMin: EXAM.timeMin, baseMin: EXAM.baseMin, extraPct: EXAM.extraPct, extraMin: ST.extraMin || 0, log: ST.log, answers: ST.answers, flags: ST.flags, prefs: ST.prefs, ua: ST.ua,
    paused: ST.paused || 0, breaks: ST.breaks || 0, hlCount: ST.hlCount || 0, acc: EXAM.acc || {} };
  const file = { bee: "answers", v: 1, kid: EXAM.kid, examId: EXAM.examId, title: EXAM.title, created: now(), sealed: await BC.seal(payload, EXAM.pub), teacher: EXAM.teacher };
  const name = fileStem(EXAM.title, ST.name) + ".bee-answers", text = JSON.stringify(file);
  const done = { name, text, who: ST.name, at: ST.endedAt, by, folder: "" };
  // into the chosen folder; if there is none (or it was unplugged), into Downloads
  if(saveDir){ try{ const f = await saveDir.getFileHandle(name, { create: true }); const w = await f.createWritable(); await w.write(text); await w.close(); done.folder = saveDir.name; }catch(e){ console.warn(e); } }
  if(!done.folder) saveFile(text, name);
  await DB.set(DONE(), done);
  await saveNow();
  showEnded(done);
}
/* the same laptop, the next student: the teacher code clears this computer for a new start.
   The finished student's sealed file was already saved; a copy also stays here, just in case. */
$("#enNew").onclick = () => { $("#enNewRow").classList.add("hidden"); $("#enNewBox").classList.remove("hidden"); $("#enCode").value = ""; $("#enErr").textContent = ""; setTimeout(() => $("#enCode").focus(), 50); };
$("#enCancel").onclick = () => { $("#enNewBox").classList.add("hidden"); $("#enNewRow").classList.remove("hidden"); };
$("#enCode").addEventListener("keydown", e => { if(e.key === "Enter") $("#enNewGo").click(); });
$("#enNewGo").onclick = async () => {
  if(!(await teacherOK($("#enCode").value))){ $("#enErr").textContent = "That's not the teacher code."; return; }
  const done = await DB.get(DONE());
  if(done) await DB.set("archive:" + EXAM.examId + ":" + (done.at || now()), done);
  await DB.set(DONE(), null); await DB.set(RUN(), null);
  location.reload();
};
function showEnded(done){
  show("#scrEnded");
  $("#enWho").textContent = (done.who ? done.who + " · " : "") + "ended at " + hm(done.at) + (done.by === "time" ? " (time was up)" : done.by === "teacher" ? " (by the teacher)" : "");
  $("#enFile").textContent = done.name;
  if(done.folder) $("#enWhere").innerHTML = `It is in the folder <b>${esc(done.folder)}</b> that your teacher chose. (The button below puts another copy in Downloads.)`;
  $("#enAgain").onclick = () => saveFile(done.text, done.name);
}
boot();
