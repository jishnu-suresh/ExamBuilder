/* ---------------- events ---------------- */
function openModal(id){ $(id).classList.add("open"); }
document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", e => { if((e.target === m && !m.hasAttribute("data-sticky")) || e.target.hasAttribute("data-close")) m.classList.remove("open"); }));

const drop = $("#drop");
$("#tilePaste").onclick = () => $("#pasteText").click();
$("#tilePhoto").onclick = () => { if(PREFS.photoMode === "ask"){ $("#photoRemember").checked = false; openModal("#photoAskModal"); } else pickPhotos(); };
$("#tileFile").onclick = () => { pendingImgTarget = null; $("#fileIn").accept = ".txt,.text,.md,.markdown,.tex,text/plain,text/markdown"; $("#fileIn").click(); };
$("#pasteCopyIxl").onclick = e => { e.preventDefault(); copyPrompt("ixl"); };
$("#pasteCopyPrompt").onclick = async e => { e.preventDefault(); try{ await navigator.clipboard.writeText(USER_AI_PROMPT); toast("Prompt copied — paste it into your AI chat"); }catch(_){ $("#pasteModal").classList.remove("open"); openModal("#promptModal"); } };
$("#pasteClip").onclick = async () => { try{ const t = await navigator.clipboard.readText(); if(t){ $("#pasteArea").value = t; pasteCount(); } else toast("The clipboard is empty"); }catch(_){ toast("Click in the box and press Ctrl+V (⌘+V on Mac)"); $("#pasteArea").focus(); } };
function pasteCount(){
  const it = parseText($("#pasteArea").value || ""), X = extractExtras($("#pasteArea").value || "");
  const q = it.filter(x => x.type === "q").length, p = it.filter(x => x.type === "section").length, m = it.reduce((a, x) => a + (x.type === "q" ? qMarks(x) : 0), 0);
  const pics = it.reduce((a, x) => a + picsOf(x.text).length, 0);
  $("#pasteCount").textContent = it.length ? `Found ${q} question${q === 1 ? "" : "s"}${p ? " in " + p + " part" + (p === 1 ? "" : "s") : ""}${m ? " · " + fmt(m) + " marks" : ""}${X.rubric ? " · a rubric" : ""}${Object.keys(X.details).length ? " · exam details" : ""}${pics ? " · " + pics + " missing picture" + (pics > 1 ? "s" : "") : ""}` : "";
}
$("#pasteArea").addEventListener("input", pasteCount);
["dragenter", "dragover"].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => document.addEventListener(ev, e => { e.preventDefault(); if(ev === "drop" || !e.relatedTarget) drop.classList.remove("over"); }));
document.addEventListener("drop", e => { const fs = [...(e.dataTransfer?.files || [])]; if(!fs.length) return;
  const ex = fs.find(f => /\.json$/i.test(f.name));                 // a saved exam dropped on BEE opens it
  if(ex) openExamFile(ex); else handleFiles(fs); });
document.addEventListener("paste", async e => {
  const files = [...(e.clipboardData?.files || [])].filter(f => /^image\//.test(f.type));
  if(files.length && !(e.target.matches && e.target.matches("textarea,input"))){ e.preventDefault(); handleFiles(files); }
  else if(files.length){ e.preventDefault(); handleFiles(files); }
});
$("#fileIn").addEventListener("change", async e => {
  const files = [...e.target.files]; e.target.value = "";
  if((pendingInline || pendingImgTarget) && files[0] && fileKind(files[0])){
    pendingInline = null; pendingImgTarget = null;
    toast(fileKind(files[0]) === "PDF" ? "A picture must be an image (PNG or JPG). For a page of a PDF, take a screenshot of it and add that." : "A picture must be an image (PNG or JPG)");
    return;
  }
  if(pendingInline && files[0]){
    const P = pendingInline; pendingInline = null;
    const it = S.items.find(x => x.id === P.id); if(!it) return;
    try{
      const img = await imageFileToData(files[0]), id = "p" + nid().replace(/\W/g, "").slice(-6);
      it.pics = Object.assign({}, it.pics, { [id]: img });
      const tag = "{img: " + id + " | 60% | center}";
      if(P.fill){
        // replace the first [diagram: …] placeholder, in the question or a sub-question
        const swap = t => { const L = String(t || "").split("\n"), k = L.findIndex(l => RE_PIC.test(l)); if(k < 0) return null; L[k] = tag; return L.join("\n"); };
        let done = swap(it.text); if(done != null) it.text = done; else { const sb = (it.subs || []).find(x => swap(x.text) != null); if(sb) sb.text = swap(sb.text); else it.text = (it.text ? it.text + "\n" : "") + tag; }
        toast("Picture added where the placeholder was — change its size or position under the text");
      }else{
        if(P.pos != null && P.tf && P.tf.f === "text") lastTA = { id: it.id, f: "text", sid: P.tf.sid, s: P.pos, e: P.pos }; else if(P.pos == null) lastTA = null;
        insertBlockAt(it, tag);
        toast("Picture added — change its size or position under the text");
      }
      render(); changed();
    }catch(err){ toast(err.message); }
    return;
  }
  if(pendingImgTarget && files[0]){
    const it = S.items.find(x => x.id === pendingImgTarget); pendingImgTarget = null;
    try{ it.img = await imageFileToData(files[0]); it.imgSize = 100; if(picsOf(it.text).length){ it.text = dropFirstPic(it.text); toast("Picture added — the red placeholder is gone"); } render(); changed(); }catch(err){ toast(err.message); }
    return;
  }
  handleFiles(files);
});
$("#list").addEventListener("input", onListInput);
$("#list").addEventListener("change", e => {
  const ch = e.target.closest("[data-pic]"); if(!ch || !(e.target.matches("[data-picsize],[data-picalign]"))) return;
  const card = ch.closest(".card"), it = S.items.find(x => x.id === card.dataset.id); if(!it) return;
  const pos = ch.querySelector("[data-picalign]").value, wrapped = pos.startsWith("wrap-");
  setPicTag(it, ch.dataset.pic, t => ({ size: +ch.querySelector("[data-picsize]").value, align: wrapped ? pos.slice(5) : pos, mode: wrapped ? "wrap" : t.mode === "row" ? "row" : "" }));
  if(wrapped) render();
  const ta = card.querySelector("textarea[data-f=text]"); if(ta) ta.value = it.text;
  card.querySelectorAll("textarea[data-sf=text]").forEach(x => { const sb = (it.subs || []).find(s => s.id === x.dataset.sub); if(sb) x.value = sb.text; });
  updateRich(card, it); lastEdited = it.id; changed();
});
$("#list").addEventListener("click", e => {
  const sv = e.target.closest("[data-picsvg]"); if(sv){ openSvgEdit(sv.closest(".card").dataset.id, sv.closest("[data-pic]").dataset.pic); return; }
  const g = e.target.closest("[data-picgraph]"); if(!g) return;
  const card = g.closest(".card"); openGraph(card.dataset.id, g.closest("[data-pic]").dataset.pic);
});
// ⇆ side by side with the next picture (they share the width: sizes that add up to more than a row are halved)
$("#list").addEventListener("click", e => {
  const b = e.target.closest("[data-picrow]"); if(!b) return;
  const ch = b.closest("[data-pic]"), card = b.closest(".card"), it = S.items.find(x => x.id === card.dataset.id); if(!it) return;
  const T = picTags(it), k = T.findIndex(t => t.id === ch.dataset.pic); if(k < 0) return;
  const t = T[k], n = T[k + 1], on = t.mode !== "row";
  setPicTag(it, t.id, x => ({ size: x.size, align: x.align, mode: on ? "row" : "" }));
  if(on && n && t.size + n.size > 96){ setPicTag(it, t.id, x => Object.assign(x, { size: 46 })); setPicTag(it, n.id, x => Object.assign(x, { size: 46, mode: x.mode === "wrap" ? "" : x.mode })); }
  render(); changed(); lastEdited = it.id;
});
$("#list").addEventListener("click", e => {
  const b = e.target.closest("[data-picdel]"); if(!b) return;
  const ch = b.closest("[data-pic]"), card = b.closest(".card"), it = S.items.find(x => x.id === card.dataset.id); if(!it) return;
  setPicTag(it, ch.dataset.pic, () => null); if(it.pics) delete it.pics[ch.dataset.pic];
  render(); changed();
});
$("#list").addEventListener("keydown", e => {
  const inp = e.target.closest("input[data-opt]"); if(!inp) return;
  const card = inp.closest(".card"); const it = S.items.find(x => x.id === card.dataset.id); if(!it) return;
  const oi = +inp.dataset.opt;
  if(e.key === "Enter"){ e.preventDefault(); ensureOptions(it); it.options.splice(oi + 1, 0, ""); render(); changed(); focusOpt(it.id, oi + 1); }
  else if(e.key === "Backspace" && !inp.value && it.options.length > 1){ e.preventDefault(); it.options.splice(oi, 1); render(); changed(); focusOpt(it.id, Math.max(0, oi - 1)); }
});
$("#list").addEventListener("click", onListClick);
$("#list").addEventListener("change", e => {
  const sel = e.target.closest("select[data-part]"); if(!sel) return;
  const id = sel.closest(".card").dataset.id;
  let target = sel.value;
  if(target === "__new"){
    const n = S.items.filter(x => x.type === "section").length + 1;
    const ROM = ["I","II","III","IV","V","VI","VII","VIII","IX","X","XI","XII"];
    const name = prompt("Name of the new part (e.g. Part " + (ROM[n - 1] || n) + ": MCQ):", "Part " + (ROM[n - 1] || n) + ": ");
    if(name == null){ render(); return; }
    const sec = { id: nid(), type: "section", text: name.trim() || ("Part " + (ROM[n - 1] || n)), marks: "" };
    S.items.push(sec); target = sec.id;
  }
  moveToPart(id, target); render(); changed();
  const c = document.querySelector(`.card[data-id="${id}"]`); if(c) c.scrollIntoView({ behavior: "smooth", block: "center" });
});
function moveToPart(id, secId){
  const i = S.items.findIndex(x => x.id === id); if(i < 0) return;
  const [it] = S.items.splice(i, 1);
  if(!secId){ const f = S.items.findIndex(x => x.type === "section"); S.items.splice(f < 0 ? S.items.length : f, 0, it); return; }
  const si = S.items.findIndex(x => x.id === secId);
  let j = si + 1; while(j < S.items.length && S.items[j].type !== "section") j++;
  S.items.splice(j, 0, it);
}
$("#addQ").onclick = () => { S.items.push({ id: nid(), type: "q", text: "", marks: "", lines: "", img: null }); render(); changed(); focusLast(); };
$("#addS").onclick = () => { const n = S.items.filter(i => i.type === "section").length + 1; S.items.push({ id: nid(), type: "section", text: "Part " + ["I","II","III","IV","V","VI","VII","VIII","IX","X"][n - 1] + ": ", marks: "" }); render(); changed(); focusLast(); };
$("#addSub").onclick = () => {
  // A., B., C. … counting the sub-parts since the last part heading
  let k = 0; for(let i = S.items.length - 1; i >= 0 && S.items[i].type !== "section"; i--) if(S.items[i].heading) k++;
  S.items.push({ id: nid(), type: "note", heading: true, text: "ABCDEFGH"[k] + ". ", marks: "" }); render(); changed(); focusLast();
};
$("#addBreak").onclick = () => { S.items.push({ id: nid(), type: "note", pagebreak: true, text: "" }); render(); changed(); focusLast(); };
$("#addN").onclick = () => { S.items.push({ id: nid(), type: "note", text: "", img: null }); render(); changed(); focusLast(); };
function focusLast(){ const L = S.items[S.items.length - 1]; if(L) lastEdited = L.id; return focusLast0(); }
function focusLast0(){ const c = $("#list").lastElementChild; if(c){ c.scrollIntoView({ behavior: "smooth", block: "center" }); const f = c.querySelector("textarea,input[type=text]"); if(f) setTimeout(() => f.focus(), 250); } }
$("#pasteText").onclick = () => { $("#pasteArea").value = ""; $("#pasteCount").textContent = ""; openModal("#pasteModal"); setTimeout(() => $("#pasteArea").focus(), 50); };
$("#pasteGo").onclick = async () => {
  await keepVersion("Before pasting AI text");
  const DR = await takeDrawings($("#pasteArea").value);
  const raw = DR.text, items = parseText(raw), X = extractExtras(raw);
  if(!items.length && !X.rubric && !Object.keys(X.details).length){ toast("Nothing to add"); return; }
  attachPics(items, DR.pics);
  const said = applyExtras(X); if(DR.n) said.push(DR.n + " drawing" + (DR.n > 1 ? "s" : "") + " made by the AI");
  S.items.push(...items); if(items.length) lastEdited = items[0].id; $("#pasteModal").classList.remove("open"); render(); changed();
  const pics = items.reduce((a, x) => a + picsOf(x.text).length, 0);
  toast(["Added " + items.length + " items"].concat(said, pics ? [pics + " missing picture" + (pics > 1 ? "s" : "") + " marked in red"] : []).join(" · "));
  const firstMiss = items.find(x => picsOf(x.text).length);
  if(firstMiss) setTimeout(() => { const c = $("#list").querySelector(`.card[data-id="${firstMiss.id}"]`); if(c) c.scrollIntoView({ behavior: "smooth", block: "center" }); }, 400);
};
$("#formatHelp").onclick = () => openModal("#helpModal");
// settings tabs: 📝 Exam · 🎨 Look · 🖨 Printing (the last one used is remembered)
function setTab(t){
  if(!document.querySelector(`#setTabs [data-tab="${t}"]`)) t = "exam";
  document.querySelectorAll("#setTabs [data-tab]").forEach(b => { b.classList.toggle("on", b.dataset.tab === t); b.setAttribute("aria-selected", b.dataset.tab === t); });
  document.querySelectorAll(".tabpane[data-pane]").forEach(p => p.classList.toggle("hidden", p.dataset.pane !== t));
  try{ localStorage.setItem("bee.tab", t); }catch(_){}
}
$("#setTabs").addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if(b) setTab(b.dataset.tab); });
try{ setTab(localStorage.getItem("bee.tab") || "exam"); }catch(_){}
$("#clearAll").onclick = () => { $("#qMore").open = false; if(!S.items.length) return toast("There are no questions to delete."); keepVersion("Before deleting all questions"); const n = S.items.filter(i => i.type === "q").length; if(confirm("Delete all " + n + " question" + (n === 1 ? "" : "s") + "?\n\nThe exam details are kept, and you can get the questions back from 🕰️ (earlier versions).")){ S.items = []; render(); changed(); } };
$("#dlMenuBtn").onclick = e => { e.stopPropagation(); $("#dlMenu").classList.toggle("hidden"); };
document.addEventListener("click", e => { if(!e.target.closest(".dl-wrap")) $("#dlMenu").classList.add("hidden"); });
$("#dlMenu").addEventListener("click", e => {
  const b = e.target.closest("[data-dl]"); if(!b) return;
  $("#dlMenu").classList.add("hidden");
  ({ full: () => download(), large: () => download({ large: true }), cover: () => download({ coverOnly: true }), rubric: () => download({ rubricOnly: true }), questions: () => download({ noCover: true }), key: () => download({ key: true }), versions: () => openModal("#verModal"), dys: () => openModal("#dysModal"), student: () => openStudentDialog(), answers: () => pickAnswers() })[b.dataset.dl]();
});
$("#btnRefresh").onclick = preview;
// the Questions menus (⋯, 💬 AI prompts) close when clicking elsewhere or choosing something in them
document.addEventListener("click", e => {
  document.querySelectorAll("details.qmenu[open]").forEach(d => { if(!d.contains(e.target) || e.target.closest(".qm-item, .open-prompt")) d.open = false; });
});
// 📖 the teacher guide opens in a new window: the website's guide.html, or (offline file) the copy built into BEE
document.addEventListener("click", e => {
  const a = e.target.closest("[data-guide]"); if(!a) return;
  if(window.__PWA__) return;                       // website / installed app: the link opens guide.html itself
  e.preventDefault();
  const w = window.open(URL.createObjectURL(new Blob([GUIDE_HTML], { type: "text/html" })), "_blank");
  if(!w) toast("Your browser blocked the new window: allow pop-ups for BEE to open the guide.");
});
// 🌱 Basic / 🐝 Full mode (remembered in this browser)
function setMode(basic){
  document.body.classList.toggle("basic", !!basic);
  $("#btnMode").innerHTML = basic ? '🌱 <span class="lbl">Basic</span>' : '<span class="bees">🍯🐝</span>';
  $("#btnMode").title = basic ? "Basic mode: only the everyday buttons. Click to show all options again." : "All options are shown. Click for Basic mode (only the everyday buttons).";
  $("#btnMode").setAttribute("aria-label", basic ? "Basic mode is on: show all options" : "All options are shown: switch to Basic mode");
  if(basic){ const t = document.querySelector('#setTabs [data-tab="exam"]'); if(t && !t.classList.contains("on")) t.click(); }
  try{ basic ? localStorage.setItem("bee.basic", "1") : localStorage.removeItem("bee.basic"); }catch(_){}
}
$("#btnMode").onclick = () => { const b = !document.body.classList.contains("basic"); setMode(b); toast(b ? "🌱 Basic mode: only the everyday buttons. Everything you set before still applies." : "🍯🐝 All options are back.", 4000); };
try{ setMode(localStorage.getItem("bee.basic") === "1"); }catch(_){}
// the preview: drag its left edge to resize; ⇥ hides it while typing (both remembered in this browser)
(() => {
  const grid = $("main.grid"), get = k => { try{ return localStorage.getItem(k); }catch(_){ return null; } }, put = (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(_){} };
  const setW = px => { if(px) grid.style.setProperty("--pvw", Math.round(px) + "px"); else grid.style.removeProperty("--pvw"); };
  setW(+get("bee.pvw") || 0);
  const hide = on => { grid.classList.toggle("pv-off", on); put("bee.pvOff", on ? "1" : null); if(!on) setTimeout(() => { try{ preview(); }catch(_){} }, 50); };
  if(get("bee.pvOff")) grid.classList.add("pv-off");
  $("#pvHide").onclick = () => hide(true);
  $("#pvShow").onclick = () => hide(false);
  const h = $("#pvResize");
  h.addEventListener("pointerdown", e => {
    e.preventDefault(); h.setPointerCapture(e.pointerId); h.classList.add("drag");
    const right = grid.getBoundingClientRect().right - 22;          // the grid's right padding
    const move = ev => setW(Math.max(380, Math.min(right - ev.clientX, grid.clientWidth - 420 - 66)));
    const up = () => { h.classList.remove("drag"); h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up);
      const v = parseInt(grid.style.getPropertyValue("--pvw")) || 0; put("bee.pvw", v || null); clearTimeout(window.__pvRs); window.__pvRs = setTimeout(() => { try{ preview(); }catch(_){} }, 150); };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
  });
  h.addEventListener("dblclick", () => { setW(0); put("bee.pvw", null); setTimeout(() => { try{ preview(); }catch(_){} }, 50); });
})();
// dyslexia-friendly download (choices remembered)
try{ const p = JSON.parse(localStorage.getItem("bee.dys") || "{}"); if(p.font) document.querySelector(`input[name=dysFont][value=${p.font}]`).checked = true; if(p.cream != null) $("#dysCream").checked = p.cream; }catch(_){}
const dysOpts = () => ({ dys: (document.querySelector("input[name=dysFont]:checked") || {}).value || "atk", cream: $("#dysCream").checked });
$("#dysGo").onclick = async () => {
  const o = dysOpts(); try{ localStorage.setItem("bee.dys", JSON.stringify({ font: o.dys, cream: o.cream })); }catch(_){}
  $("#dysModal").classList.remove("open");
  await download(o);
  if($("#dysKey").checked){ await new Promise(r => setTimeout(r, 450)); await download(Object.assign({ key: true }, o)); }
};
$("#pvKey").addEventListener("change", () => preview());

$("#btnLogo").onclick = () => $("#logoIn").click();
$("#logoIn").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  if(fileKind(f)){ toast("The logo must be an image (PNG or JPG)" + (fileKind(f) === "PDF" ? " — take a screenshot of it from the PDF" : "")); return; }
  try{
    const src = await readAsDataURL(f); const i = await loadImg(src);
    const sc = Math.min(1, 1400 / Math.max(i.naturalWidth, i.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(i.naturalWidth * sc); c.height = Math.round(i.naturalHeight * sc);
    c.getContext("2d").drawImage(i, 0, 0, c.width, c.height);
    S.logo = { src: c.toDataURL("image/png"), w: c.width, h: c.height, isDefault: false };
    updateLogoUI(); changed();
  }catch(err){ toast("Couldn't read that image"); }
});
$("#btnLogoReset").onclick = () => { S.logo = defaults().logo; updateLogoUI(); changed(); };
$("#btnLogoNone").onclick = () => { S.logo = { src: "", w: 1, h: 1, isDefault: false }; updateLogoUI(); changed(); };

$("#btnSave").onclick = () => saveAs();
$("#btnUndo").onclick = undo; $("#btnRedo").onclick = redo;
$("#btnOpen").onclick = () => openProject();
$("#btnNew").onclick = async () => {
  if(proj.dirty && proj.handle) await writeProject();
  openStart(true);
};
$("#saveBannerGo").onclick = () => $("#saveChip").click();
$("#saveChip").onclick = async () => {
  if(proj.handle && proj.perm !== "granted"){
    try{ proj.perm = await proj.handle.requestPermission({ mode: "readwrite" }); }catch(_){}
    if(proj.perm === "granted"){ await writeProject(true); toast("Saving to " + proj.name + " again"); }
    updateChip(); return;
  }
  if(proj.handle){ if(await writeProject(true)) toast("Saved to " + proj.name); return; }
  await saveAs(); updateChip();
};
$("#projIn").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  if(fileKind(f)){ showBlocked(fileKind(f), [f.name]); return; }
  if(/\.(txt|md|markdown|text)$/i.test(f.name)){ handleFiles([f]); $("#startModal").classList.remove("open"); return; }
  await openExamFile(f);
});

/* start screen */
let storedHandle = null, storedLocal = null;
function openStart(isNew){

  const fileBtn = $("#stContinueFile"), locBtn = $("#stContinueLocal");
  fileBtn.classList.toggle("hidden", !!isNew || !storedHandle);
  if(storedHandle) $("#stFileName").textContent = "Continue “" + storedHandle.name + "”";
  const hasLocal = !isNew && storedLocal && Array.isArray(storedLocal.items) && (storedLocal.items.length || storedLocal.d && storedLocal.d.subject);
  locBtn.classList.toggle("hidden", !hasLocal || !!storedHandle);
  if(hasLocal) $("#stLocalInfo").textContent = "🟠 Only in this browser, not in a file · " + (storedLocal.d.subject || storedLocal.d.title || "Exam") + " · " + storedLocal.items.filter(x => x.type === "q").length + " questions" + (storedLocal.savedAt ? " · last edited " + new Date(storedLocal.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
  $("#stNote").textContent = FS_OK ? "" : typeof window.showSaveFilePicker === "function"
    ? "ⓘ This computer doesn't let websites save into folders (a school setting). Your work is kept here in the browser. Use 💾 Save as… (under 📁 File) to download a copy, and 📂 Open to open it again."
    : "ⓘ In this browser (Safari or Firefox), your work is kept here in the browser, not in a file. Use 💾 Save as… (under 📁 File) to keep a copy on your computer, or use Chrome or Edge to save to a file automatically.";
  $("#stSkip").parentElement.classList.toggle("hidden", !!isNew);
  $("#startModal").classList.add("open");
}
$("#stNew").onclick = async () => { if(await newProject()) $("#startModal").classList.remove("open"); };
$("#stOpen").onclick = async () => { if(await openProject()) $("#startModal").classList.remove("open"); };
$("#stContinueLocal").onclick = () => { $("#startModal").classList.remove("open"); updateChip(); };
$("#stSkip").onclick = e => { e.preventDefault(); $("#startModal").classList.remove("open"); updateChip(); };
$("#stContinueFile").onclick = async () => {
  const h = storedHandle; if(!h) return;
  let perm = "prompt";
  // the browser asks "Allow this site to edit …?" in a small pop-up near the address bar: say so, so BEE doesn't look stuck
  const lbl = $("#stFileName"), was = lbl.textContent;
  const hint = setTimeout(() => { lbl.textContent = "⏳ Click Allow in the browser's pop-up (top of the window)"; }, 400);
  try{ perm = await h.requestPermission({ mode: "readwrite" }); }catch(_){}
  clearTimeout(hint); lbl.textContent = was;
  if(perm !== "granted"){ toast("BEE needs your permission to open and keep saving to " + h.name + ". Click Continue again and choose Allow, or use 📂 Open.", 6000); return; }
  try{
    const o = JSON.parse(await (await h.getFile()).text());
    // use whichever copy is newer: the file, or this browser's autosave
    if(!(storedLocal && (storedLocal.savedAt || 0) > (o.savedAt || 0) && Array.isArray(storedLocal.items))) applyState(o);
    proj.handle = h; proj.name = h.name; proj.perm = "granted";
    proj.dirty = !!(storedLocal && (storedLocal.savedAt || 0) > (o.savedAt || 0));
    if(proj.dirty) writeProject(true);
    updateChip();
    $("#startModal").classList.remove("open");
  }catch(e){ toast("Couldn't open " + h.name + " — was it moved or deleted?"); }
};

/* ---------------- 🐝 demo exam + first-time tour ---------------- */
const DEMO = /*__DEMO__*/null, DEMO_SIMPLE = /*__DEMO_SIMPLE__*/null;   // the offline file carries the demos inside it; the website fetches them
async function loadDemo(kind){
  const simple = kind === "simple";
  let o = simple ? DEMO_SIMPLE : DEMO;
  if(!o){ try{ o = await (await fetch(simple ? "demo/demo_simple.exam.json" : "demo/demo_all_features.exam.json")).json(); }catch(_){ toast("The demo exam needs an internet connection the first time"); return false; } }
  await keepVersion("Before opening the demo exam");
  // the teacher's own exam is saved into its file first; the demo is never written into it
  await leaveCurrentFile(); storedHandle = null;
  applyState(JSON.parse(JSON.stringify(o)));
  try{ await IDB.del("handle"); }catch(_){}
  saveLocal(); updateChip();
  toast("🐝 Demo exam opened — change anything you like. Your earlier work is in 🕰️ History.");
  return true;
}
$("#stDemo").onclick = async () => { if(await loadDemo()){ $("#startModal").classList.remove("open"); setTimeout(() => startTour(), 500); } };
$("#stDemoSimple").onclick = async () => { if(await loadDemo("simple")){ $("#startModal").classList.remove("open"); setTimeout(() => startTour(), 500); } };
$("#stTour").onclick = e => { e.preventDefault(); $("#startModal").classList.remove("open"); setTimeout(() => startTour(), 300); };

const TOUR = [
  { el: "#setTabs", t: "Exam details", p: "Title, subject and teacher go in <b>📝 Exam</b>. <b>🎨 Look</b> changes the font, colours and logo; <b>🖨 Printing</b> sets the paper and answer lines." },
  { el: "#drop", t: "Add your questions", p: "Paste what ChatGPT, Claude or Gemini wrote, add photos of a worksheet, or type your own with <b>＋ Question</b>. Each question gets its own card you can edit." },
  { el: ".preview", t: "Check the preview", p: "This is the real PDF, updated as you type. Click any question in it to jump straight to its card." },
  { el: "#dlMenuBtn", t: "Download", p: "Choose what you need: the student paper, large print, the answer key, versions… Your work saves itself every minute, and <b>🕰️</b> keeps earlier versions in case you want to go back." }
];
let tourAt = -1;
function startTour(){ setFold("detPanel", false); tourAt = 0; showTourStep(); }
function endTour(){ tourAt = -1; $("#tourTip").classList.add("hidden"); $("#tourRing").classList.add("hidden"); try{ localStorage.setItem("bee.toured", "1"); }catch(_){} }
function placeTour(){
  if(tourAt < 0) return;
  const st = TOUR[tourAt], el = document.querySelector(st.el), tip = $("#tourTip"), ring = $("#tourRing");
  if(!el || !el.offsetParent && el.tagName !== "ASIDE"){ ring.classList.add("hidden"); tip.style.left = (innerWidth - tip.offsetWidth) / 2 + "px"; tip.style.top = (innerHeight - tip.offsetHeight) / 2 + "px"; return; }
  const r = el.getBoundingClientRect(), pad = 6;
  const top = Math.max(4, r.top - pad), bot = Math.min(innerHeight - 4, r.bottom + pad);
  Object.assign(ring.style, { left: r.left - pad + "px", top: top + "px", width: r.width + pad * 2 + "px", height: Math.max(0, bot - top) + "px" }); ring.classList.remove("hidden");
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let y = bot + 12 + h < innerHeight ? bot + 12 : top - 12 - h >= 0 ? top - 12 - h : Math.max(8, innerHeight - h - 12);
  let x = Math.min(Math.max(12, r.left + Math.min(r.width, 300) / 2 - w / 2), innerWidth - w - 12);
  // a tall target (the preview) leaves no room above or below: sit beside it instead
  if(r.height > innerHeight * .6){ x = r.left > w + 24 ? r.left - w - 16 : Math.min(r.right + 16, innerWidth - w - 12); y = Math.min(Math.max(12, r.top + 40), innerHeight - h - 12); }
  tip.style.left = x + "px"; tip.style.top = y + "px";
}
function showTourStep(){
  const st = TOUR[tourAt], el = document.querySelector(st.el);
  $("#tourStep").textContent = "Step " + (tourAt + 1) + " of " + TOUR.length;
  $("#tourTitle").textContent = st.t; $("#tourText").innerHTML = st.p;
  $("#tourBack").classList.toggle("hidden", tourAt === 0);
  $("#tourNext").textContent = tourAt === TOUR.length - 1 ? "Got it 🐝" : "Next →";
  $("#tourTip").classList.remove("hidden");
  if(el && el.getBoundingClientRect){ const r = el.getBoundingClientRect(); if(r.top < 60 || r.bottom > innerHeight - 20) el.scrollIntoView({ block: r.height > innerHeight * .6 ? "start" : "center" }); }
  placeTour(); setTimeout(placeTour, 60);
}
$("#tourNext").onclick = () => { if(tourAt >= TOUR.length - 1) endTour(); else { tourAt++; showTourStep(); } };
$("#tourBack").onclick = () => { if(tourAt > 0){ tourAt--; showTourStep(); } };
$("#tourSkip").onclick = e => { e.preventDefault(); endTour(); };
addEventListener("resize", placeTour); addEventListener("scroll", placeTour, { passive: true });
document.addEventListener("keydown", e => { if(tourAt >= 0 && e.key === "Escape") endTour(); });
// first visit: once the start screen is closed, offer the tour (not in automated browsers, so tests aren't interrupted)
new MutationObserver(() => {
  if($("#startModal").classList.contains("open") || tourAt >= 0 || navigator.webdriver) return;
  let seen = "1"; try{ seen = localStorage.getItem("bee.toured"); }catch(_){}
  if(!seen) setTimeout(() => { if(tourAt < 0 && !document.querySelector(".modal.open")) startTour(); }, 600);
}).observe($("#startModal"), { attributes: true, attributeFilter: ["class"] });

/* ---------------- phones: jump between the editor and the preview ---------------- */
(() => {
  const fab = document.getElementById("pvFab"), pv = document.querySelector(".preview");
  let lastY = 0;
  const inPreview = () => { const r = pv.getBoundingClientRect(); return r.top < innerHeight * .5 && r.bottom > innerHeight * .3; };
  const label = () => { fab.innerHTML = inPreview() ? "✎ <span>Edit</span>" : "👁 <span>Preview</span>"; };
  fab.onclick = () => { if(inPreview()) window.scrollTo({ top: lastY, behavior: "smooth" }); else { lastY = scrollY; pv.scrollIntoView({ behavior: "smooth", block: "start" }); } };
  addEventListener("scroll", () => { clearTimeout(fab._t); fab._t = setTimeout(label, 120); }, { passive: true });
})();

/* ---------------- installed app (PWA) ---------------- */
let updateRequested = false;
if(window.__PWA__){
  let installEvt = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; $("#btnInstall").classList.remove("hidden"); });
  window.addEventListener("appinstalled", () => { $("#btnInstall").classList.add("hidden"); toast("🐝 BEE is installed — find it in your apps"); });
  $("#btnInstall").onclick = async () => { if(!installEvt) return; installEvt.prompt(); try{ await installEvt.userChoice; }catch(_){} installEvt = null; $("#btnInstall").classList.add("hidden"); };
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").then(reg => {
      const offer = w => { if(!w || !navigator.serviceWorker.controller) return; $("#updBar").classList.remove("hidden"); $("#updGo").onclick = async () => { if(proj.dirty && proj.handle) await writeProject(); updateRequested = true; w.postMessage("skipWaiting"); }; };
      if(reg.waiting) offer(reg.waiting);
      reg.addEventListener("updatefound", () => { const w = reg.installing; w && w.addEventListener("statechange", () => { if(w.state === "installed") offer(w); }); });
      setInterval(() => reg.update().catch(() => {}), 3600 * 1000);
    }).catch(e => console.warn("Service worker:", e));
    let reloading = false;
    // reload only when the teacher clicked "Update now" (not when the app is first installed)
    navigator.serviceWorker.addEventListener("controllerchange", () => { if(reloading || !updateRequested) return; reloading = true; location.reload(); });
  }
  // double-clicking an .exam.json file opens it here (installed app, Chrome/Edge)
  if("launchQueue" in window){
    launchQueue.setConsumer(async params => {
      if(params.files && params.files.length){ if(await openFromHandle(params.files[0])) $("#startModal").classList.remove("open"); }
    });
  }
}

/* ---------------- ✨ what's new (newest first; add an entry at the top for each update teachers should know about) ---------------- */
document.querySelectorAll(".ver").forEach(e => { e.textContent = BEE_VERSION; });   // the corner pill and the start screen always show the real version
const NEWS = [
  { id: "2026-11-25-v3", title: "v3 · November 2026", items: [
    "🧮 <b>A calculator in the computer version.</b> In ⬇ Download → 👩‍🏫 Teacher → 💻 Computer version, choose <b>🧮 Calculator</b>: None (the default), BEEcalc Basic, Scientific or Graphing, or Desmos Graphing.",
    "<b>BEEcalc works offline</b> and starts in degrees. Scientific has fractions, powers, roots, trigonometry, and mean and standard deviation of a list.",
    "<b>BEEcalc Graphing:</b> y = …, x = …, circles and other curves (x² + y² = 25), shaded regions (y < 2x + 1), polar graphs (r = 4cos 2θ), sliders, tables of values, data plots with regression (linear, quadratic, exponential…), box plots, histograms and statistics.",
    "<b>Desmos Graphing</b> needs the internet in the exam room. Without it, the student sees a message and the test carries on.",
    "<b>During the exam</b>, the 👩‍🏫 teacher menu (with the teacher code) can switch the calculator on, change it or take it away for one student. Each change is noted in the report.",
    "On a phone-sized screen, graphing is replaced by BEEcalc Scientific. On an iPad it works fully.",
    "🔊 The computer version now has a <b>🔊 Read aloud</b> button in the top bar too. It reads from the part on the screen."
  ] },
  { id: "2026-11-23-v2.2", title: "v2.2 · November 2026", items: [
    "🎙️ <b>Read aloud in your own voice.</b> In ⬇ Download → 👩‍🏫 Teacher → 💻 Computer version, press <b>🎙️ Record…</b> and read each question once. Students hear you instead of the computer voice, on every laptop and iPad, even offline.",
    "<b>Don't say the question number</b>, because versions A–D can change it. For multiple choice, read the options too.",
    "Anything you don't record is still read by the computer voice. If you change a question after recording it, BEE marks it <b>⚠ text changed</b> so the wrong words are never played.",
    "Your recordings are saved with the exam, in its .exam.json file.",
    "📂 Opening a saved exam no longer waits on the start screen for the browser's \"Allow editing\" question."
  ] },
  { id: "2026-11-22-v2.1", title: "v2.1 · November 2026", items: [
    "🔊 <b>Read aloud sounds more like a teacher</b> in the 💻 computer version, in English and French.",
    "<b>Multiple-choice questions:</b> \"Choose one answer\", then a short pause before each option (\"Option A…\", \"Option B…\").",
    "<b>Maths:</b> absolute values, intervals, sets, matrices, \"P of A given B\", sin² x, f⁻¹(x), dy/dx, long fractions (\"…all over…\"), and 2.5 × 10³ said as \"10 to the power 3\".",
    "<b>Physics:</b> more units in words (nm, µF, kΩ, kJ mol⁻¹, m s⁻², \"in km/h\"), and F<sub>net</sub> said as \"F net\".",
    "<b>Chemistry:</b> Cu → \"copper\", Fe³⁺ → \"iron 3 plus\", Cl⁻ → \"chloride\", Ca(OH)₂ with its brackets, ¹⁴C → \"carbon 14\", [H⁺] → \"the concentration of H plus\".",
    "<b>French papers:</b> decimals with \"virgule\", \"Consignes\", \"Partie\", \"points\" and \"Réponse A\" in the reading.",
    "💡 For the most natural voices, use <b>Microsoft Edge</b> with internet, or download a Premium voice on a Mac."
  ] },
  { id: "2026-11-22-v2", title: "v2 · November 2026", items: [
    "🎉 <b>💻 Exams on computers.</b> ⬇ Download → 👩‍🏫 Teacher → <b>💻 Computer version</b> makes one offline file students answer on a laptop: maths keyboard, read aloud, accommodations, a timer, and a lock with an alarm if they leave the test.",
    "Each file has a <b>start code</b> (you give it to the students) and a <b>teacher code</b> (for you only: unlock, add time, finish). 🖨 The invigilator sheet lists both.",
    "When the test ends, the student's answers are saved as one sealed file. <b>📥 Student answers</b> turns them into PDFs to mark, with the answers in blue.",
    "The first time on a computer, BEE asks for the <b>school key</b> file and its password (ask Jishnu)."
  ] },
  { id: "2026-11-22", title: "v1 · November 2026", items: [
    "🎉 <b>BEE v1</b> — the first version for all teachers.",
    "The <b>Questions</b> section is more compact: 🤖 Paste from AI, 📷 Add photos, 📄 Open .txt / .md and 💬 AI prompts sit in one row. 🔎 Find &amp; replace and ⓘ help are on the Questions heading.",
    "<b>📁 File</b> at the top holds New, Open and Save as…",
    "<b>Add a question anywhere:</b> point between two questions and choose ＋ Question, ＋ MCQ, ＋ Text or ＋ Part.",
    "📷 Add photos asks whether you want <b>pictures</b> or the <b>text</b> (you can tell BEE to remember).",
    "<b>Subject subtitle</b> (optional) in Exam details, e.g. “Higher Level · Paper 2”.",
    "🗑 <b>Delete all questions</b> is under ⋯ and always asks first.",
    "Two demos to try: a 📝 simple quiz and ✨ every feature.",
    "📖 Teacher guide on the start screen, and 💬 in the corner to report a problem or share an idea."
  ] }
];
function showNews(){
  $("#newsList").innerHTML = NEWS.slice(0, 3).map(n => `<h4>${n.title}</h4><ul>${n.items.map(i => "<li>" + i + "</li>").join("")}</ul>`).join("");
  openModal("#newsModal");
  try{ localStorage.setItem("bee.news", NEWS[0].id); }catch(_){}
}
$("#stNews").onclick = e => { e.preventDefault(); showNews(); };
function maybeNews(){
  let seen = null, known = false;
  try{ seen = localStorage.getItem("bee.news"); known = !!(localStorage.getItem("bee.toured") || storedLocal || storedHandle); }catch(_){}
  if(seen === NEWS[0].id) return;
  if(!known || navigator.webdriver){ try{ localStorage.setItem("bee.news", NEWS[0].id); }catch(_){} return; }   // first visit: the tour comes first
  setTimeout(showNews, 400);
}

/* ---------------- init ---------------- */
(async () => {
  storedLocal = await loadLocal();
  if(storedLocal) S = mergeState(storedLocal);
  try{ storedHandle = FS_OK ? (await IDB.get("handle")) || null : null; }catch(e){ storedHandle = null; }
  bindDetails();
  renderRubric();
  updateLogoUI();
  render();
  updateChip();
  histReset();
  openStart(false);
  maybeNews();
  mathReady.then(() => { mathOK = !!(window.MathJax && MathJax.tex2svg); render(); preview(); }).catch(e => { console.error(e); preview(); });
})();
window.__exam = { S: () => S, set: o => { S = mergeState(o); refreshDetails(); updateLogoUI(); render(); }, parseText, buildPDF };
</script>