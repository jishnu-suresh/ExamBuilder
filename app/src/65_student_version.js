/* ---------------- 💻 computer version for students ----------------
   Export: the exam becomes one offline HTML file (app/student/). The questions inside are locked with the start code;
   the full exam (with the answer key) is sealed for the teacher only and simply carried along.
   Answers: the student's file seals their answers with the teacher's public key. Only this BEE (teacher key) opens them. */
/* 🧪 not launched yet: hidden from everyone except browsers switched on with the secret link  …/?beta=bee
   (…/?beta=off switches it off again). To launch: make BETA always true. */
const BETA = (() => {
  try{
    const q = new URLSearchParams(location.search).get("beta");
    if(q === "bee"){ localStorage.setItem("bee.beta", "1"); setTimeout(() => toast("🧪 Test features are on in this browser (💻 student version). ?beta=off turns them off."), 1500); }
    if(q === "off"){ localStorage.removeItem("bee.beta"); setTimeout(() => toast("Test features are off in this browser."), 1500); }
    return localStorage.getItem("bee.beta") === "1";
  }catch(_){ return false; }
})();
document.body.classList.toggle("beta", BETA);
const PLAYER = /*__PLAYER__*/null;        // the offline BEE carries the template inside; the website fetches it
const BLUE_HEX = "#1F4FB8";

/* ---- teacher key: kept in this browser, one backup file for safety ---- */
/* The private half of the key is kept encrypted with the teacher's password (PBKDF2 + AES-GCM): in this browser
   and in the backup file. It is opened only in memory, once per session, to open students' answers. */
const KEY_ITER = 300000, OPEN_KEYS = {};          // kid → private key, for this session only
async function teacherKeys(){ return (await IDB.get("teacherKeys")) || []; }
async function saveKeys(ks){ await IDB.set("teacherKeys", ks); }
async function boxPriv(priv, pw){ const salt = BC.b64e(BC.rnd(16)); return { salt, iter: KEY_ITER, box: await BC.lock(await BC.codeKey(pw, salt, KEY_ITER), priv) }; }
// the password dialog: mode "set" (new password, typed twice) or "enter"
function askPassword(mode, info){
  return new Promise(res => {
    const set = mode === "set";
    $("#pwTitle").textContent = set ? "🔐 Choose the school key password" : "🔐 School key password";
    $("#pwText").innerHTML = info || (set ? "It protects the school key: <b>without it, nobody can open students' answers</b>, not even on this computer." : "Type the school key password to open the answers.");
    $("#pw1").value = ""; $("#pw2").value = ""; $("#pwErr").textContent = "";
    $("#pw2Row").classList.toggle("hidden", !set); $("#pwWarn").classList.toggle("hidden", !set);
    $("#pwGo").textContent = set ? "Save the password" : "Open";
    openModal("#pwModal"); setTimeout(() => $("#pw1").focus(), 60);
    const done = v => { $("#pwModal").classList.remove("open"); $("#pwGo").onclick = null; $("#pwCancel").onclick = null; res(v); };
    $("#pwCancel").onclick = () => done(null);
    $("#pwGo").onclick = () => {
      const a = $("#pw1").value;
      if(set){
        if(a.length < 6) return $("#pwErr").textContent = "At least 6 characters, please.";
        if(a !== $("#pw2").value) return $("#pwErr").textContent = "The two passwords are different.";
      }else if(!a) return;
      done(a);
    };
  });
}
["#pw1", "#pw2"].forEach(s => $(s).addEventListener("keydown", e => { if(e.key === "Enter") $("#pwGo").click(); }));
// the school key: one key for the whole school, made once by one person and loaded by every teacher (file + password)
// making or changing the school key is only offered with the admin link  …/?beta=bee&keyadmin=hive  (not remembered),
// and replacing an existing key also needs the current school key password
const KEYADMIN = (() => { try{ return new URLSearchParams(location.search).get("keyadmin") === "hive"; }catch(_){ return false; } })();
document.querySelectorAll(".key-admin").forEach(el => el.classList.toggle("hidden", !KEYADMIN));
const SCHOOL_FILE = () => fileStem(S.d.school || "School", "BEE school key") + ".beekey";
async function currentKey(){ return (await teacherKeys())[0] || null; }
async function needSchoolKey(){
  const k = await currentKey(); if(k) return k;
  return new Promise(res => {
    openModal("#needKeyModal");
    const box = $("#needKeyModal");
    const go = async e => {
      const b = e.target.closest("[data-needkey]"); if(!b) return;
      const act = b.dataset.needkey; let key = null;
      if(act === "load") key = await loadKeyFile();
      if(act === "make") key = await makeSchoolKey();
      if(act !== "cancel" && !key) return;           // still here: try again or cancel
      box.removeEventListener("click", go); box.classList.remove("open"); res(key);
    };
    box.addEventListener("click", go);
  });
}
async function makeSchoolKey(){
  if(!KEYADMIN) return null;
  const cur = await currentKey();
  if(cur && !(await openKey(cur))) return null;        // replacing the school key: prove you know its password first
  const pw = await askPassword("set", "Choose the <b>school key password</b>. Every teacher will type it to open students' answers. Keep it away from students.");
  if(!pw) return null;
  const k = await BC.newTeacherKey();
  const rec = { pub: k.pub, kid: k.kid, created: k.created, privBox: await boxPriv(k.priv, pw) };
  const ks = (await teacherKeys()).filter(x => x.kid !== k.kid); ks.unshift(rec);
  await saveKeys(ks); OPEN_KEYS[k.kid] = k.priv;
  downloadKeyFile(rec); await IDB.set("teacherKeyBackup", rec.kid);
  toast("✨ School key made. Its file is in your Downloads: put it on the staff drive for the other teachers.");
  return rec;
}
function downloadKeyFile(k){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ bee: "teacher-key", v: 2, school: S.d.school || "", kid: k.kid, created: k.created, pub: k.pub, privBox: k.privBox })], { type: "application/json" }));
  a.download = SCHOOL_FILE(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// the private key, after the password (asked once per session); older keys without a password get one now
async function openKey(k){
  if(OPEN_KEYS[k.kid]) return OPEN_KEYS[k.kid];
  if(k.priv){
    const pw = await askPassword("set", "This key (" + esc(k.kid.slice(0, 6)) + ") has no password yet. Choose the school key password now, so <b>nobody else can open students' answers</b>, not even on this computer.");
    if(!pw) return null;
    const ks = await teacherKeys(), x = ks.find(y => y.kid === k.kid);
    x.privBox = await boxPriv(k.priv, pw); OPEN_KEYS[k.kid] = k.priv; delete x.priv;
    await saveKeys(ks); return OPEN_KEYS[k.kid];
  }
  let msg = "";
  for(let tries = 0; tries < 5; tries++){
    const pw = await askPassword("enter", msg || ("Type the school key password to open the answers (key " + esc(k.kid.slice(0, 6)) + ")."));
    if(pw == null) return null;
    try{ OPEN_KEYS[k.kid] = await BC.unlock(await BC.codeKey(pw, k.privBox.salt, k.privBox.iter), k.privBox.box); return OPEN_KEYS[k.kid]; }
    catch(_){ msg = "<b style='color:var(--danger)'>That password isn't right.</b> Try again."; }
  }
  return null;
}
async function keyRow(){
  const k = await currentKey(), el = $("#stuKey");
  if(!k){ el.className = "key-row warn"; el.innerHTML = `🐝 This computer doesn't have <b>the school key</b> yet. BEE will ask you to load it (once). <button class="btn sm" type="button" data-keymodal>About the school key</button>`; }
  else if(k.priv){ el.className = "key-row warn"; el.innerHTML = `🐝 This key has <b>no password yet</b>: anyone using this browser could open the answers. <button class="btn sm primary" type="button" data-keymodal>Fix it</button>`; }
  else { el.className = "key-row"; el.innerHTML = `🐝 Sealed with <b>the school key</b> (${esc(k.kid.slice(0, 6))}) 🔐 — any teacher with the school key and its password can open the answers. <button class="btn sm" type="button" data-keymodal>School key</button>`; }
}
document.addEventListener("click", e => { if(e.target.closest("[data-keymodal]")) openKeyModal(); });
async function openKeyModal(){
  const k = await currentKey(), ks = await teacherKeys();
  $("#keyInfo").innerHTML = k ? `On this computer: school key <b>${esc(k.kid.slice(0, 6))}</b> (from ${new Date(k.created).toLocaleDateString()}) · ${k.priv ? "<b style='color:var(--danger)'>no password yet</b>" : "locked with the school password 🔐" + (OPEN_KEYS[k.kid] ? " — open for now" : "")}` + (ks.length > 1 ? ` · ${ks.length - 1} older key${ks.length > 2 ? "s" : ""} kept, so older answers still open` : "") : "This computer doesn't have the school key yet. Load the school key file (from the staff drive).";
  $("#keyBackup").disabled = !k; $("#keyPw").disabled = !k; $("#keyLock").classList.toggle("hidden", !k || !OPEN_KEYS[k.kid]);
  openModal("#keyModal");
}
$("#keyBackup").onclick = async () => {
  let k = await currentKey(); if(!k) return;
  if(k.priv){ if(!(await openKey(k))) return; k = await currentKey(); }
  downloadKeyFile(k); await IDB.set("teacherKeyBackup", k.kid);
  toast("School key file saved (locked with the school password). Share it only with teachers."); keyRow(); openKeyModal();
};
$("#keyPw").onclick = async () => {
  if(!KEYADMIN) return;
  const k = await currentKey(); if(!k) return;
  const priv = await openKey(k); if(!priv) return;
  if(k.priv){ toast("Password saved."); keyRow(); return openKeyModal(); }
  const pw = await askPassword("set", "Choose the new school key password. Then <b>share the new school key file</b>: the old file still opens with the old password, so delete it.");
  if(!pw) return;
  const ks = await teacherKeys(), x = ks.find(y => y.kid === k.kid); x.privBox = await boxPriv(priv, pw); await saveKeys(ks);
  downloadKeyFile(x);
  toast("Password changed. The new school key file is in your Downloads: share it, and delete the old one."); keyRow(); openKeyModal();
};
$("#keyMake").onclick = async () => {
  if(!KEYADMIN) return;
  if(await currentKey() && !confirm("Make a NEW school key?\n\nEvery teacher will need to load the new school key file. Answers sealed with the current key still open on computers that have it.")) return;
  if(await makeSchoolKey()){ keyRow(); openKeyModal(); }
};
$("#keyLock").onclick = () => { Object.keys(OPEN_KEYS).forEach(k => delete OPEN_KEYS[k]); toast("🔒 Locked. The school password is needed again to open answers."); openKeyModal(); };
$("#keyImport").onclick = async () => { if(await loadKeyFile()){ openKeyModal(); keyRow(); } };
// a file chooser kept on the page until it is used: a detached one can be thrown away by the browser while the
// file window is open, and then the chosen file is silently ignored
function fileChooser(accept, multiple, onFiles){
  const old = document.getElementById("beeFilePick"); if(old) old.remove();
  const inp = document.createElement("input"); inp.type = "file"; inp.id = "beeFilePick"; inp.accept = accept; inp.multiple = !!multiple;
  inp.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0";
  inp.addEventListener("change", () => { const fs = [...inp.files]; inp.remove(); if(fs.length) onFiles(fs); });
  inp.addEventListener("cancel", () => inp.remove());
  document.body.appendChild(inp); inp.click();
}
function loadKeyFile(){
  return new Promise(resolve => {
    const picked = async files => {
      try{
        const o = JSON.parse(await files[0].text());
        if(o.bee !== "teacher-key" || !o.pub || !(o.privBox || o.priv)) throw new Error("This isn't a BEE school key file.");
        const kid = await BC.kidOf(o.pub);
        const rec = { pub: o.pub, kid, created: o.created || Date.now() };
        if(o.privBox){
          rec.privBox = o.privBox;
          if(!(await openKey(rec))) throw new Error("the school key password is needed");     // checked now, while the teacher is here
        }else{
          const pw = await askPassword("set", "This key file has no password. Choose the school key password to protect it.");
          if(!pw) throw new Error("a password is needed");
          rec.privBox = await boxPriv(o.priv, pw); OPEN_KEYS[kid] = o.priv;
        }
        const ks = (await teacherKeys()).filter(k => k.kid !== kid); ks.unshift(rec);
        await saveKeys(ks); await IDB.set("teacherKeyBackup", kid);
        toast("🐝 The school key is ready on this computer."); resolve(rec);
      }catch(e){ toast("Couldn't load the school key: " + e.message); resolve(null); }
    };
    fileChooser(".beekey,.json", false, picked);
    const pick = document.getElementById("beeFilePick"); pick.addEventListener("cancel", () => resolve(null));
  });
}

/* ---- time ---- */
function parseDur(s){
  s = String(s || "").toLowerCase().replace(",", ".").replace("½", ".5");
  let m = 0;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|heure|heures)\b/), mm = s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/), hm = s.match(/(\d+)\s*h\s*(\d{1,2})\b/);
  if(hm) return +hm[1] * 60 + +hm[2];
  if(h) m += Math.round(parseFloat(h[1]) * 60);
  if(mm) m += +mm[1];
  if(!m && /^\s*\d+\s*$/.test(s)) m = +s;
  return m;
}
function stuTotal(){
  const no = $("#stuNoTime").checked, base = Math.max(0, +$("#stuMin").value || 0), ex = +$("#stuExtra").value;
  $("#stuMin").disabled = $("#stuExtra").disabled = no;
  $("#stuTotal").innerHTML = no ? "The student has as long as they need." : base ? `Total time: <b>${Math.round(base * (1 + ex / 100))} minutes</b>${ex ? ` (${base} + ${ex}% extra)` : ""}. You can add more during the test (👩‍🏫 teacher menu).` : "Type the time in minutes.";
}
["#stuMin", "#stuExtra", "#stuNoTime"].forEach(s => $(s).addEventListener("input", stuTotal));
const stuMode = () => (document.querySelector('input[name="stuMode"]:checked') || {}).value || "answer";
function stuModeUI(){
  const read = stuMode() === "read";
  $("#stuReadRow").classList.toggle("hidden", read); $("#stuDrawRow").classList.toggle("hidden", read);
  $("#stuVoiceRow").classList.toggle("hidden", (S.d.lang || "en") !== "en");
  $("#stuGo").textContent = read ? "⬇ Download the read-aloud file" : "⬇ Download the student file";
}
document.querySelectorAll('input[name="stuMode"]').forEach(r => r.addEventListener("change", stuModeUI));
$("#stuCodeNew").onclick = () => { $("#stuCode").value = BC.newCode(8); };
$("#stuTCodeNew").onclick = () => { $("#stuTCode").value = BC.newCode(6, true); };
async function openStudentDialog(){
  if(!S.items.some(it => it.type === "q")){ toast("Add some questions first."); return; }
  if(!(window.crypto && crypto.subtle)){ toast("This browser can't make sealed files. Please use Chrome, Edge, Firefox or Safari."); return; }
  $("#stuForm").classList.remove("hidden"); $("#stuDone").classList.add("hidden");
  $("#stuMin").value = parseDur(S.d.duration) || 60; $("#stuExtra").value = "0"; $("#stuNoTime").checked = false; $("#stuVer").value = "";
  $("#stuCode").value = BC.newCode(8); $("#stuTCode").value = BC.newCode(6, true);
  stuTotal(); keyRow(); stuModeUI(); openModal("#stuModal");
}

/* ---- the paper as HTML (same reader as the printed paper) ---- */
// spoken form of maths and text (66_speech.js): language and British/American set when the file is made
let SAY = { lang: "en", us: false };
const speakTex = t => " " + SPEECH.tex(t, SAY.lang, SAY) + " ";
const speakText = t => SPEECH.text(t, SAY.lang);
// a table cell counts as "to fill in" when it is empty (or only ___ … ?) and is not a header cell
const blankCell = runs => !runs.length || /^[\s_.…?-]*$/.test(runs.map(r => r.t === "math" ? "x" : r.s).join(""));
function studentRich(text, q, pics){
  const plain = []; let ti = -1;
  const runsH = rs => rs.map(r => {
    if(r.t === "math"){ const m = texSVG(r.tex, !!r.display); plain.push(speakTex(r.tex)); return m.err || !m.svg ? esc(r.tex) : `<span class="math" role="img" aria-label="${esc(speakTex(r.tex).trim())}">${m.svg}</span>`; }
    plain.push(speakText(r.s));
    let h = esc(r.s); if(r.b) h = "<b>" + h + "</b>"; if(r.i) h = "<i>" + h + "</i>"; if(r.u) h = "<u>" + h + "</u>"; if(r.x) h = "<s>" + h + "</s>"; if(r.c) h = `<span style="color:${esc(cssHex(r.c))}">` + h + "</span>"; return h;
  }).join("");
  const pic = (id, P, size, align) => { pics[id] = { src: P.src, w: P.w, h: P.h }; plain.push(" (picture) "); return `<div class="picwrap" style="text-align:${align || "center"}"><img class="pic" data-pic="${esc(id)}" src="${P.src}" alt="Picture" style="width:${size || 100}%"></div>`; };
  const html = parseRich(text, fmtOf(q)).map(b => {
    if(b.type === "gap"){ plain.push(". "); return "<div style='height:.6em'></div>"; }
    if(b.type === "img"){ const P = picData(b.id); return P ? pic(b.id, P, b.size, b.align) : ""; }
    if(b.type === "pic"){ plain.push(" (picture: " + b.desc + ") "); return `<div class="picmiss">Picture: ${esc(b.desc)}</div>`; }
    if(b.type === "mol"){ const m = MOLS[b.smi]; plain.push(" (molecule " + (b.cap || "") + ") "); return m && m.png ? `<div class="molbox"><img src="${m.png}" alt="Molecule ${esc(b.cap || b.smi)}">${b.cap ? `<div>${esc(b.cap)}</div>` : ""}</div>` : esc(b.smi); }
    if(b.type === "display"){ const m = texSVG(b.tex, true); plain.push(speakTex(b.tex)); return `<div class="disp"><span class="math" role="img" aria-label="${esc(speakTex(b.tex).trim())}">${m.err || !m.svg ? esc(b.tex) : m.svg}</span></div>`; }
    if(b.type === "table"){ ti++; const h = "<table>" + b.rows.map((r, i) => "<tr>" + r.map((c, k) => { const head = b.header && i === 0, t = head ? "th" : "td";
      const x = !head && blankCell(c) ? `<td class="blank" data-cell="${ti}:${i}:${k}"></td>` : `<${t}>` + runsH(c) + `</${t}>`; plain.push(", "); return x; }).join("") + "</tr>").join("") + "</table>"; plain.push(". "); return h; }
    const x = `<div style="padding-left:${b.ind ? 1.2 : 0}em${b.align ? ";text-align:" + b.align : ""}${b.scale && b.scale !== 1 ? ";font-size:" + b.scale + "em" : ""}">${b.bullet ? "• " : ""}${runsH(b.runs) || "&nbsp;"}</div>`;
    plain.push(". "); return x;
  }).join("");
  return { html, plain: plain.join("").replace(/\s*\.\s*(\.\s*)+/g, ". ").replace(/\s+/g, " ").replace(/^[\s.]+|[\s.]+$/g, "") };
}
function attachedPic(it, pics){
  if(!it.img || !it.img.src) return "";
  const id = "q_" + it.id; pics[id] = { src: it.img.src, w: it.img.w, h: it.img.h };
  return `<div class="picwrap" style="text-align:${it.imgAlign || "left"}"><img class="pic" data-pic="${id}" src="${it.img.src}" alt="Picture" style="width:${it.imgSize || 100}%"></div>`;
}
function optionList(it){
  return (it.options || []).map((o, i) => [String(o || ""), i]).filter(([o]) => o.trim()).map(([o, i], k) => ({ o, i, L: LETTERS[k].toUpperCase() }));
}
const SPACE_KINDS = /^(lines|blank|grid|box|numberline|axes)$/;
function areaSpec(space, lines, range, dflt){
  const kind = SPACE_KINDS.test(space || "") ? space : "lines";
  return { kind, lines: num(lines) || dflt, range: range || "" };
}
function buildPaper(items){
  const pics = {}, M = (() => { const saved = S.items; S.items = items; try{ return computeMeta(); }finally{ S.items = saved; } })();
  const out = [];
  for(const it0 of items){
    const it = cloneItem(it0); ensureOptions(it);
    if(it.type === "section"){ const r = studentRich(it.text, it, pics); out.push({ k: "sec", html: r.html, plain: r.plain }); continue; }
    if(it.type !== "q"){
      if(it.pagebreak || !((it.text || "").trim() || it.img)) continue;
      const r = studentRich(it.text, it, pics); out.push({ k: "note", heading: !!it.heading, html: r.html + attachedPic(it, pics), plain: r.plain }); continue;
    }
    const subs = Array.isArray(it.subs) ? it.subs : [], subMarks = subs.some(sb => num(sb.marks) > 0);
    const r = studentRich(it.text, it, pics);
    const q = { k: "q", id: it.id, no: it.nonum ? "" : String(M.meta[it.id] || ""), marks: S.d.showMarks !== false && !it.hideMarks && qMarks(it) > 0 && !subMarks ? fmt(qMarks(it)) : "",
      html: r.html + attachedPic(it, pics), plain: r.plain, mcq: it.mcq || "" };
    if(it.mcq){ q.opts = optionList(it).map(({ o, i, L }) => { const x = studentRich(o, null, pics); return { i, L, html: x.html, plain: x.plain }; }); }
    const hasSpace = num(it.lines) > 0 || /^(numberline|axes)$/.test(it.space || "");
    q.ans = it.mcq ? (hasSpace ? areaSpec(it.space, it.lines, it.range, 3) : null) : subs.length ? (hasSpace ? areaSpec(it.space, it.lines, it.range, 3) : null) : areaSpec(it.space, it.lines, it.range, 3);
    q.subs = subs.map((sb, k) => { const x = studentRich(sb.text || "", null, pics); return { key: sb.id || String(k), L: "(" + LETTERS[k] + ")", marks: S.d.showMarks !== false && num(sb.marks) > 0 ? fmt(num(sb.marks)) : "", html: x.html, plain: x.plain, ans: areaSpec(sb.space, sb.lines, sb.range, 3) }; });
    out.push(q);
  }
  const insR = S.d.instructions ? studentRich(String(S.d.instructions), null, pics) : { html: "", plain: "" }, ins = insR.html;
  return { paper: { lang: S.d.lang || "en", cover: { title: S.d.title || "Exam", subtitle: S.d.subtitle || "", subject: S.d.subject || "", teacher: S.d.teacher || "", date: S.d.date || "", durationText: S.d.duration || "", total: M.total ? fmt(M.total) : "", instructionsHTML: ins, instructionsPlain: insR.plain }, items: out, pics },
           nq: out.filter(x => x.k === "q").length, total: M.total };
}

/* ---- make the student file ---- */
async function playerTemplate(){
  if(PLAYER) return PLAYER;
  const r = await fetch("student/player.html"); if(!r.ok) throw new Error("couldn't load the student version (" + r.status + ")");
  return r.text();
}
let lastExport = null;
$("#stuGo").onclick = async () => {
  const btn = $("#stuGo");
  const code = $("#stuCode").value.trim(), tcode = $("#stuTCode").value.trim();
  if(BC.norm(code).length < 6){ toast("The start code needs at least 6 letters or numbers."); return; }
  if(BC.norm(tcode).length < 4){ toast("The teacher code needs at least 4 characters."); return; }
  if(BC.norm(code) === BC.norm(tcode)){ toast("Use two different codes."); return; }
  btn.disabled = true; const lbl = btn.textContent; btn.textContent = "Making the file…";
  try{
    const ver = $("#stuVer").value, mode = stuMode(), accent = (S.d.lang || "en") === "en" ? $("#stuVoice").value : (S.d.lang === "fr" ? "fr-FR" : S.d.lang);
    SAY = { lang: S.d.lang === "fr" ? "fr" : "en", us: accent === "en-US" };
    const items = ver ? versionItems(S.items, ver, true, true) : S.items.map(cloneItem);
    await prepareMath({ items, logo: S.logo });
    const { paper, nq, total } = buildPaper(items);
    const noTime = $("#stuNoTime").checked, base = noTime ? 0 : Math.max(1, +$("#stuMin").value || 60), extraPct = noTime ? 0 : +$("#stuExtra").value;
    const key = await needSchoolKey();
    if(!key){ toast("The school key is needed to make student files."); return; }
    const salt = BC.b64e(BC.rnd(16)), iter = 250000, salt2 = BC.b64e(BC.rnd(16)), iter2 = 150000;
    const snap = { d: JSON.parse(JSON.stringify(S.d)), logo: S.logo, items: JSON.parse(JSON.stringify(items)), version: ver, exportedAt: Date.now() };
    const EXAM = {
      bee: "student-exam", v: 1, examId: BC.b64e(BC.rnd(12)).replace(/[+/=]/g, "x"), title: S.d.title || "Exam", subject: S.d.subject || "", version: ver,
      nq, total: total ? fmt(total) : "", timeMin: noTime ? 0 : Math.round(base * (1 + extraPct / 100)), baseMin: base, extraPct,
      acc: { overlay: $("#accOverlay").checked, ruler: $("#accRuler").checked, spacing: $("#accSpacing").checked, highlight: $("#accHigh").checked, breaks: $("#accBreaks").checked, clock: $("#accClock").value },
      mode, accent, readAloud: mode === "read" || $("#stuRead").checked, drawing: mode !== "read" && $("#stuDraw").checked, lang: S.d.lang || "en",
      kid: key.kid, pub: key.pub, salt, iter, paper: await BC.lock(await BC.codeKey(code, salt, iter), paper),
      unlock: { salt: salt2, iter: iter2, hash: await BC.codeHash(tcode, salt2, iter2) },
      teacher: await BC.seal({ snap, startCode: code, teacherCode: tcode }, key.pub)
    };
    const tpl = await playerTemplate();
    const html = tpl.replace("/*__EXAM" + "__*/null", () => JSON.stringify(EXAM).replace(/<\//g, "<\\/").replace(/<!--/g, "<\\!--"));
    const name = fileStem(S.d.title || "Exam", ver && "Version " + ver, mode === "read" ? "read-aloud" : "computer version") + ".html";
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    lastExport = { mode, name, code, tcode, title: S.d.title || "Exam", subject: S.d.subject || "", ver, base, extraPct, timeMin: EXAM.timeMin, nq, kid: key.kid, readAloud: EXAM.readAloud };
    $("#stuFile").textContent = name; $("#stuShowCode").textContent = code; $("#stuShowTCode").textContent = tcode;
    $("#stuForm").classList.add("hidden"); $("#stuDone").classList.remove("hidden");
  }catch(e){ console.error(e); toast("Couldn't make the student file: " + e.message); }
  finally{ btn.disabled = false; btn.textContent = lbl; }
};

/* ---- 🖨 invigilator sheet ---- */
$("#stuSheet").onclick = () => {
  const X = lastExport; if(!X) return;
  const { jsPDF } = window.jspdf, doc = new jsPDF({ unit: "mm", format: S.d.paper === "letter" ? "letter" : "a4" });
  const PW = doc.internal.pageSize.getWidth(); let y = 20;
  const T = (s, size, style, col, x, opt) => { doc.setFont("helvetica", style || "normal"); doc.setFontSize(size); doc.setTextColor(...(col || [38, 34, 28])); doc.text(s, x || 20, y, opt); };
  const para = (s, size) => { doc.setFont("helvetica", "normal"); doc.setFontSize(size || 10.5); doc.setTextColor(38, 34, 28); doc.splitTextToSize(s, PW - 46).forEach(l => { doc.text(l, 26, y); y += 5; }); };
  T(X.mode === "read" ? "INVIGILATOR SHEET - READ-ALOUD VERSION" : "INVIGILATOR SHEET - COMPUTER VERSION", 9, "bold", [140, 102, 32]); y += 7;
  T(X.title, 17, "bold"); y += 6;
  T([X.subject, X.ver ? "Version " + X.ver : "", X.nq + " questions"].filter(Boolean).join("   |   "), 10.5, "normal", [118, 110, 98]); y += 6;
  T(X.timeMin ? `Time: ${X.timeMin} minutes` + (X.extraPct ? `  (${X.base} min + ${X.extraPct}% extra time)` : "") : "Time: no limit", 10.5, "bold"); y += 9;
  const box = (x, label, code, note) => {
    doc.setDrawColor(181, 137, 46); doc.setLineWidth(.6); doc.setLineDashPattern([2, 1.4], 0); doc.roundedRect(x, y, 80, 30, 3, 3, "S"); doc.setLineDashPattern([], 0);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(118, 110, 98); doc.text(label, x + 40, y + 7, { align: "center" });
    doc.setFont("courier", "bold"); doc.setFontSize(21); doc.setTextColor(38, 34, 28); doc.text(code, x + 40, y + 18, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(118, 110, 98); doc.text(note, x + 40, y + 25, { align: "center" });
  };
  box(20, "START CODE", X.code, "to start, or carry on after a problem"); box(PW - 100, "TEACHER CODE", X.tcode, "unlocks a locked test - teacher menu");
  y += 40;
  const step = (n, title, body) => { T(n + "  " + title, 11.5, "bold"); y += 6; body.forEach(b => para("•  " + b)); y += 3; };
  if(X.mode === "read"){
    step("1", "Before the test", ["Copy \u201C" + X.name + "\u201D to the student's laptop. The questions stay locked inside it until you type the start code.", "Give the student the printed paper as usual: they write their answers on paper. The laptop only shows and reads the questions.", "Open the file with Chrome or Edge (Firefox and Safari also work). No internet is needed. Plug in the charger and give the student headphones.", "Voices: the most natural ones (marked with a star) are Edge\u2019s \u201CNatural\u201D voices and Chrome\u2019s Google voices, but they need the internet. With no internet, Windows uses its standard voices (clear, a little robotic). On a Mac, download an Enhanced or Premium voice beforehand (System Settings > Accessibility > Spoken Content > System voice > Manage voices) for a natural voice offline."]);
    step("2", "Starting", ["Type the START CODE and press Open the paper. It goes full screen."]);
    step("3", "During the test", ["The student clicks the speaker next to a question. The reading bar can pause, stop, go back or forward, slow down, change the voice and keep reading by itself.", "If the student leaves the screen, the laptop beeps and the paper LOCKS. Type the TEACHER CODE to unlock it.", "If the file closes by mistake, open it again and type the START CODE."]);
    step("4", "At the end", ["The student presses Finish (or time runs out). Collect the printed paper as usual: there is nothing to collect from the laptop."]);
  }else{
    step("1", "Before the test", ["Copy “" + X.name + "” to each student's laptop (USB stick or shared folder). The questions stay locked inside it until you type the start code.", "Open it with Chrome or Edge (Firefox and Safari also work). No internet is needed.", "Plug in the chargers. Close other programs and switch off notifications if you can.", "Chrome/Edge: press “Choose a folder or USB stick” on the start screen. Backup copies (every minute) and the final answers file are saved there. Without it, the answers file goes to the laptop’s Downloads folder."]);
    step("2", "Starting", ["The student types their name. You type the START CODE and press Start. The test goes full screen and the clock starts."]);
    step("3", "During the test", ["If the student leaves the test screen (another window, Alt+Tab, Esc), the laptop beeps and the test LOCKS. Type the TEACHER CODE to unlock it. Every time is recorded on the answer PDF.", "Teacher menu (the teacher button at the top, then the TEACHER CODE): add time, or end the test for this student.", "Rest break (if allowed): teacher menu, then “Start a rest break”. The paper is covered and the clock stops; type the TEACHER CODE to carry on. Breaks are on the answer record.", "If the laptop crashes or the file closes: open the same file again and type the START CODE. The student carries on where they were; the clock kept running (add time if needed).", "On another laptop: copy the same file there, press “Carry on from a backup”, choose the backup file from the save folder, type the START CODE."]);
    step("4", "At the end", ["The student presses End the test (or time runs out). A sealed answers file is saved in the folder you chose, or in Downloads: “<title> - <name>.bee-answers”. Collect these files.", "In BEE: the small arrow next to Download PDF, then Open student answers. BEE makes a PDF of each paper with the answers in blue, ready to mark, plus the record of times and exits.", "Only a BEE with the school key (" + X.kid.slice(0, 6) + ") and its password can open these files."]);
  }
  doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(118, 110, 98);
  doc.text("Keep this sheet away from students. Made with BEE - " + new Date().toLocaleDateString(), PW / 2, doc.internal.pageSize.getHeight() - 12, { align: "center" });
  doc.save(fileStem(X.title, X.ver && "Version " + X.ver, X.mode === "read" ? "read-aloud" : "", "invigilator sheet") + ".pdf");
};

/* ---- 📥 open student answers ---- */
const ANS = [];
function pickAnswers(){
  fileChooser(".bee-answers", true, files => { toast("Opening " + (files.length === 1 ? files[0].name : files.length + " answer files") + "…", 2500); loadAnswers(files); });
}
$("#ansMore").onclick = pickAnswers;
async function loadAnswers(files){
  const ks = await teacherKeys();
  for(const f of files){
    const row = { file: f.name };
    try{
      const o = JSON.parse(await f.text());
      if(o.bee !== "answers" || !o.sealed) throw new Error("not a BEE answers file");
      const k = ks.find(k => k.kid === o.kid);
      if(!k) throw new Error("sealed with a school key this computer doesn't have (" + String(o.kid).slice(0, 6) + "). Load the school key file first (🐝 School key)");
      const priv = await openKey(k); if(!priv) throw new Error("the school key password is needed to open it");
      row.P = await BC.unseal(o.sealed, priv); row.T = await BC.unseal(o.teacher, priv);
      const dup = ANS.findIndex(r => r.P && r.P.examId === row.P.examId && r.P.name === row.P.name && r.P.startedAt === row.P.startedAt);
      if(dup >= 0) ANS.splice(dup, 1);
    }catch(e){ row.err = e.message; }
    ANS.push(row);
  }
  renderAnswers(); openModal("#ansModal");
}
const minsOf = ms => Math.round(ms / 60000);
function renderAnswers(){
  $("#ansList").innerHTML = ANS.length ? `<table class="ans-table"><tr><th>Student</th><th>Ended</th><th>Time used</th><th>Left the test</th><th></th></tr>${ANS.map((r, i) => r.err ? `<tr><td colspan="4" class="bad">⚠ ${esc(r.file)}: ${esc(r.err)}</td><td></td></tr>` : `<tr>
    <td><b>${esc(r.P.name)}</b>${r.P.cls ? `<br><span class="hint">${esc(r.P.cls)}</span>` : ""}<br><span class="hint">${esc(r.T.snap.d.title || "")}${r.T.snap.version ? " · Version " + esc(r.T.snap.version) : ""}</span></td>
    <td>${new Date(r.P.endedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}${r.P.endedBy === "time" ? "<br><span class='hint'>time was up</span>" : r.P.endedBy === "teacher" ? "<br><span class='hint'>by the teacher</span>" : ""}</td>
    <td>${minsOf(r.P.endedAt - r.P.startedAt)} min${r.P.timeMin ? ` <span class="hint">of ${r.P.timeMin + (r.P.extraMin || 0)}</span>` : ""}</td>
    <td class="${leftCount(r.P) ? "bad" : ""}">${leftCount(r.P) ? leftCount(r.P) + "×" : "never"}</td>
    <td><button class="btn sm primary" data-anspdf="${i}">⬇ PDF</button></td></tr>`).join("")}</table>
    <p class="hint">Blue in the PDF = what the student typed or chose. Mark it like any paper.</p>` : "<p>No files yet.</p>";
  $("#ansZip").classList.toggle("hidden", ANS.filter(r => r.P).length < 2);   // one student: their own ⬇ PDF is enough
}
const leftCount = P => (P.log || []).filter(l => l.kind === "left").length;
$("#ansList").addEventListener("click", async e => {
  const b = e.target.closest("[data-anspdf]"); if(!b) return;
  b.disabled = true;
  try{ const r = await answerPDF(ANS[+b.dataset.anspdf]); r.doc.save(r.name); }catch(err){ console.error(err); toast("Couldn't make the PDF: " + err.message); }
  b.disabled = false;
});
// write a student's table entries into the question's own table text (same counting as studentRich)
function fillTables(text, cells){
  if(!text || !cells || !Object.keys(cells).length) return text;
  const lines = String(text).split("\n"); let ti = -1;
  for(let i = 0; i < lines.length; i++){
    if(!/^\|.*\|$/.test(lines[i].trim())) continue;
    ti++; let r = -1, j = i;
    for(; j < lines.length && /^\|.*\|$/.test(lines[j].trim()); j++){
      const cs = splitRow(lines[j].trim());
      if(cs.every(c => /^\s*:?-{2,}:?\s*$/.test(c))) continue;
      r++;
      let hit = false;
      cs.forEach((c, k) => { const v = cells[ti + ":" + r + ":" + k]; if(v && String(v).trim()){ cs[k] = " {color:" + BLUE_HEX + "}**" + String(v).replace(/[*_$`{}|\\]/g, " ").trim() + "**{/color} "; hit = true; } });
      if(hit) lines[j] = "|" + cs.join("|") + "|";
    }
    i = j - 1;
  }
  return lines.join("\n");
}
function withTables(snap, P){
  return snap.items.map(it0 => {
    const A = P.answers[it0.id]; if(!A || !A.cells) return it0;
    const pick = src => { const o = {}; Object.entries(A.cells).forEach(([k, v]) => { const [s, c] = k.split("|"); if(s === src) o[c] = v; }); return o; };
    const it = JSON.parse(JSON.stringify(it0));
    it.text = fillTables(it.text, pick("main"));
    (it.subs || []).forEach((sb, k) => { sb.text = fillTables(sb.text, pick("s:" + (sb.id || String(k)))); });
    return it;
  });
}
async function answerPDF(r){
  const snap = r.T.snap, P = r.P;
  await prepareMath(snap);
  // the student's own maths, drawn in blue
  const jobs = [];
  Object.values(P.answers || {}).forEach(A => Object.values(A.areas || {}).forEach(bl => bl.forEach(b => { if(b.t === "math" && String(b.v || "").trim()){ const m = texSVG(mathColor(b.v, BLUE_HEX), true); if(m.svg && !m.png && !m.err) jobs.push(mathPNG(m).catch(() => {})); } })));
  await Promise.all(jobs);
  const resp = Object.assign({}, P, { title: snap.d.title, version: snap.version });
  // the student's exam is in place only while the PDF is drawn — no waiting, so nothing can save it over yours
  const saved = S; let doc;
  S = { d: snap.d, logo: snap.logo, items: withTables(snap, P) };
  const key = $("#ansKey").checked;
  try{ doc = buildPDF({ final: true, resp, key, version: snap.version || undefined }); }finally{ S = saved; }
  return { doc, name: fileStem(snap.d.title || "Exam", P.name, key ? "answers and key" : "answers") + ".pdf" };
}
$("#ansZip").onclick = async () => {
  const btn = $("#ansZip"), lbl = btn.textContent; btn.disabled = true;
  try{
    const files = [], used = {};
    for(const r of ANS.filter(r => r.P)){
      btn.textContent = "Making PDFs… " + (files.length + 1) + "/" + ANS.filter(r => r.P).length;
      const x = await answerPDF(r); let n = x.name; if(used[n]){ n = n.replace(/\.pdf$/, "_" + (++used[n]) + ".pdf"); } else used[n] = 1;
      files.push({ name: n, data: new Uint8Array(x.doc.output("arraybuffer")) });
    }
    const title = (ANS.find(r => r.P) || {}).T.snap.d.title || "Exam";
    const a = document.createElement("a"); a.href = URL.createObjectURL(zipStore(files)); a.download = fileStem(title, "student answers") + ".zip"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }catch(e){ console.error(e); toast("Couldn't make the ZIP: " + e.message); }
  btn.disabled = false; btn.textContent = lbl;
};
// a ZIP with no compression (PDFs are already compressed): enough for "all papers in one download"
function zipStore(files){
  const crcT = zipStore.t || (zipStore.t = Array.from({ length: 256 }, (_, n) => { let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
  const crc = d => { let c = 0xFFFFFFFF; for(let i = 0; i < d.length; i++) c = crcT[(c ^ d[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  for(const f of files){
    const nm = enc.encode(f.name), c = crc(f.data), h = new DataView(new ArrayBuffer(30));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, dt, 2], [12, dd, 2], [14, c, 4], [18, f.data.length, 4], [22, f.data.length, 4], [26, nm.length, 2], [28, 0, 2]].forEach(([o, v, s]) => s === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    parts.push(new Uint8Array(h.buffer), nm, f.data);
    const cd = new DataView(new ArrayBuffer(46));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, dt, 2], [14, dd, 2], [16, c, 4], [20, f.data.length, 4], [24, f.data.length, 4], [28, nm.length, 2], [30, 0, 2], [32, 0, 2], [34, 0, 2], [36, 0, 2], [38, 0, 4], [42, off, 4]].forEach(([o, v, s]) => s === 4 ? cd.setUint32(o, v, true) : cd.setUint16(o, v, true));
    central.push(new Uint8Array(cd.buffer), nm);
    off += 30 + nm.length + f.data.length;
  }
  const cs = central.reduce((a, x) => a + x.length, 0), end = new DataView(new ArrayBuffer(22));
  [[0, 0x06054b50, 4], [4, 0, 2], [6, 0, 2], [8, files.length, 2], [10, files.length, 2], [12, cs, 4], [16, off, 4], [20, 0, 2]].forEach(([o, v, s]) => s === 4 ? end.setUint32(o, v, true) : end.setUint16(o, v, true));
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

/* ---- inside buildPDF: the chosen MCQ options in blue, and the answer record page ---- */
// chosen options in blue ◀; with the answer key, the right ones also get a red ✓
function qTextResp(it, chosen, key){
  const ch = new Set(chosen || []), co = new Set(key ? it.correct || [] : []), L = optionList(it);
  if(!L.length) return it.text || "";
  const tick = "  {color:#C0392B}**✓**{/color}";
  return (it.text || "").replace(/\s+$/, "") + "\n" + L.map(({ o, i, L }) =>
    ch.has(i) ? "{color:" + BLUE_HEX + "}**" + L + ". " + o + "  ◀**{/color}" + (co.has(i) ? tick : "") :
    co.has(i) ? "{color:#C0392B}" + L + ". " + o + "{/color}" + tick : L + ". " + o).join("\n");
}
function respRecord(doc, R, h){
  const { font, SANS, INK, MUTED, PW, PH, ML, MR } = h, BLUE = [31, 79, 184];
  const N0 = doc.getNumberOfPages();
  // every page: who answered it
  for(let p = 1; p <= N0; p++){ doc.setPage(p); font(SANS, "normal", 7.5, BLUE); doc.text((R.name || "") + (R.cls ? " · " + R.cls : "") + "  —  answered on a computer", PW - MR, 7, { align: "right" }); }
  doc.insertPage(1); doc.setPage(1);
  let y = 22;
  font(SANS, "bold", 8.5, [140, 102, 32]); doc.text("ANSWER RECORD  ·  COMPUTER VERSION", ML, y); y += 8;
  font(SANS, "bold", 17, INK); doc.splitTextToSize(R.title || "Exam", PW - ML - MR).slice(0, 2).forEach(l => { doc.text(l, ML, y); y += 7; });
  if(R.version){ font(SANS, "normal", 10, MUTED); doc.text("Version " + R.version, ML, y); y += 6; }
  y += 3;
  doc.setFillColor(234, 240, 252); doc.roundedRect(ML, y, PW - ML - MR, 17, 2, 2, "F");
  font(SANS, "bold", 15, BLUE); doc.text(R.name || "", ML + 5, y + 7.5);
  font(SANS, "normal", 9.5, BLUE); doc.text((R.cls ? R.cls + "  ·  " : "") + "Answered on a computer  ·  answers in blue", ML + 5, y + 13);
  y += 25;
  const T = t => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const used = R.endedAt - R.startedAt - (R.paused || 0), allowed = R.timeMin ? R.timeMin + (R.extraMin || 0) : 0;
  const facts = [
    ["Date", new Date(R.startedAt).toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" })],
    ["Started", T(R.startedAt)], ["Ended", T(R.endedAt) + (R.endedBy === "time" ? "  (time was up)" : R.endedBy === "teacher" ? "  (ended by the teacher)" : "  (the student ended it)")],
    ["Time used", Math.round(used / 60000) + " minutes" + (R.paused ? "  (+ " + (R.paused < 60000 ? "less than 1" : Math.round(R.paused / 60000)) + " min of rest breaks, clock paused)" : "")],
    ...(R.breaks ? [["Rest breaks", R.breaks + " (supervised)"]] : []),
    ["Time allowed", allowed ? allowed + " minutes" + (R.extraPct ? `  (${R.baseMin} + ${R.extraPct}% extra)` : "") + (R.extraMin ? `  + ${R.extraMin} added by the teacher` : "") : "no limit"]
  ];
  facts.forEach(([k, v]) => { font(SANS, "normal", 10, MUTED); doc.text(k, ML, y); font(SANS, "bold", 10, INK); doc.text(String(v), ML + 34, y); y += 6; });
  // what the student used (access arrangements record)
  const p = R.prefs || {}, used2 = [];
  if(p.size && p.size !== 17) used2.push("text size " + (p.size > 17 ? "larger" : "smaller") + " (" + p.size + " px)");
  if(p.font) used2.push(p.font === "dys" ? "OpenDyslexic font" : "easy-read font");
  if(p.space) used2.push("wide line spacing");
  if(p.colour) used2.push(p.colour + " colours");
  if(p.overlay) used2.push(p.overlay + " overlay");
  if(p.letters) used2.push(p.letters + " letter spacing");
  if(p.pointer) used2.push("big pointer");
  if((R.log || []).some(l => l.kind === "reading ruler on")) used2.push("reading ruler");
  if(R.hlCount) used2.push("highlighter");
  const reads = (R.log || []).filter(l => l.kind === "read aloud").length; if(reads) used2.push("read aloud (" + reads + "×)");
  if(p.accents) used2.push("French accents");
  if(used2.length){
    font(SANS, "normal", 10, MUTED); doc.text("Used", ML, y);
    font(SANS, "bold", 10, INK); doc.splitTextToSize(used2.join(" · "), PW - ML - MR - 34).forEach(l => { doc.text(l, ML + 34, y); y += 5.2; }); y += .8;
  }
  y += 4;
  // leaving the test
  const lefts = (R.log || []).filter(l => l.kind === "left");
  font(SANS, "bold", 11.5, INK); doc.text(lefts.length ? `Left the test screen: ${lefts.length} time${lefts.length === 1 ? "" : "s"}` : "Left the test screen: never", ML, y); y += 6;
  const shown = (R.log || []).filter(l => !/^(read aloud|reading ruler on|used the highlighter)$/.test(l.kind));
  const say = l => l.kind === "rest break ended" ? "rest break ended (" + Math.max(1, Math.round((l.ms || 0) / 60000)) + " min)" : l.kind === "left" ? "left the test — " + (l.how || "") : l.kind === "back" ? "came back after " + Math.max(1, Math.round((l.ms || 0) / 1000)) + " s" : l.kind === "time added by teacher" ? "teacher added " + l.min + " minutes" : l.kind === "ended" ? "ended" : l.kind === "tried to leave with the keyboard" ? "tried to leave with the keyboard (" + (l.key || "") + ")" : l.kind === "test reopened" || /backup/.test(l.kind) ? l.kind + (l.ms ? " (" + Math.round(l.ms / 60000) + " min after the last save)" : "") : l.kind;
  if(lefts.length || shown.some(l => /paste|reopened|backup|wrong|tried|rest break/.test(l.kind))){
    const list = shown.slice(0, 40);
    list.forEach(l => { if(y > PH - 60) return; font(SANS, "normal", 9, /left|paste|wrong|tried/.test(l.kind) ? [180, 69, 47] : INK); doc.text(T(l.t), ML + 2, y); doc.text(say(l), ML + 18, y); y += 4.6; });
    if(shown.length > list.length){ font(SANS, "italic", 8.5, MUTED); doc.text("… and " + (shown.length - list.length) + " more", ML + 18, y); y += 4.6; }
  }
  y += 5;
  font(SANS, "italic", 8.5, MUTED);
  doc.text("The student's typing and choices are in blue; empty answer spaces were left blank.", ML, PH - 14);
}
