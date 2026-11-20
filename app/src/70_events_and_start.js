/* ---------------- events ---------------- */
function openModal(id){ $(id).classList.add("open"); }
document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", e => { if((e.target === m && !m.hasAttribute("data-sticky")) || e.target.hasAttribute("data-close")) m.classList.remove("open"); }));

const drop = $("#drop");
$("#tilePaste").onclick = () => $("#pasteText").click();
$("#tilePhoto").onclick = () => { pendingImgTarget = null; $("#fileIn").accept = "image/*"; $("#fileIn").click(); };
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
document.addEventListener("drop", e => { const fs = [...(e.dataTransfer?.files || [])]; if(fs.length) handleFiles(fs); });
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
  setPicTag(it, ch.dataset.pic, t => ({ size: +ch.querySelector("[data-picsize]").value, align: ch.querySelector("[data-picalign]").value }));
  const ta = card.querySelector("textarea[data-f=text]"); if(ta) ta.value = it.text;
  card.querySelectorAll("textarea[data-sf=text]").forEach(x => { const sb = (it.subs || []).find(s => s.id === x.dataset.sub); if(sb) x.value = sb.text; });
  updateRich(card, it); lastEdited = it.id; changed();
});
$("#list").addEventListener("click", e => {
  const sv = e.target.closest("[data-picsvg]"); if(sv){ openSvgEdit(sv.closest(".card").dataset.id, sv.closest("[data-pic]").dataset.pic); return; }
  const g = e.target.closest("[data-picgraph]"); if(!g) return;
  const card = g.closest(".card"); openGraph(card.dataset.id, g.closest("[data-pic]").dataset.pic);
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
$("#clearAll").onclick = () => { if(!S.items.length) return; keepVersion("Before Clear all"); if(confirm("Remove all questions? (Exam details are kept.)")){ S.items = []; render(); changed(); } };
$("#btnDownload").onclick = () => download();
$("#dlMenuBtn").onclick = e => { e.stopPropagation(); $("#dlMenu").classList.toggle("hidden"); };
document.addEventListener("click", e => { if(!e.target.closest(".dl-wrap")) $("#dlMenu").classList.add("hidden"); });
$("#dlMenu").addEventListener("click", e => {
  const b = e.target.closest("[data-dl]"); if(!b) return;
  $("#dlMenu").classList.add("hidden");
  ({ full: () => download(), large: () => download({ large: true }), cover: () => download({ coverOnly: true }), rubric: () => download({ rubricOnly: true }), questions: () => download({ noCover: true }), key: () => download({ key: true }), versions: () => openModal("#verModal") })[b.dataset.dl]();
}); $("#btnDownload2").onclick = () => download();
$("#btnRefresh").onclick = preview;
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
$("#saveChip").onclick = async () => {
  if(proj.handle && proj.perm !== "granted"){
    try{ proj.perm = await proj.handle.requestPermission({ mode: "readwrite" }); }catch(_){}
    if(proj.perm === "granted"){ await writeProject(true); toast("Saving to " + proj.name + " again"); }
    updateChip(); return;
  }
  if(proj.handle){ if(await writeProject(true)) toast("Saved to " + proj.name); return; }
  saveAs();
};
$("#projIn").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  if(fileKind(f)){ showBlocked(fileKind(f), [f.name]); return; }
  if(/\.(txt|md|markdown|text)$/i.test(f.name)){ handleFiles([f]); $("#startModal").classList.remove("open"); return; }
  try{ const o = JSON.parse(await f.text()); if(!o || !Array.isArray(o.items)) throw 0; await keepVersion("Before opening " + f.name); applyState(o); saveLocal(); $("#startModal").classList.remove("open"); toast("Opened " + f.name); }
  catch(err){ toast("That file isn't a valid exam project"); }
});

/* start screen */
let storedHandle = null, storedLocal = null;
function openStart(isNew){
  $("#startLogo").src = (S.logo && S.logo.src) || DEFAULT_LOGO;
  const fileBtn = $("#stContinueFile"), locBtn = $("#stContinueLocal");
  fileBtn.classList.toggle("hidden", !!isNew || !storedHandle);
  if(storedHandle) $("#stFileName").textContent = "Continue “" + storedHandle.name + "”";
  const hasLocal = !isNew && storedLocal && Array.isArray(storedLocal.items) && (storedLocal.items.length || storedLocal.d && storedLocal.d.subject);
  locBtn.classList.toggle("hidden", !hasLocal || !!storedHandle);
  if(hasLocal) $("#stLocalInfo").textContent = (storedLocal.d.subject || storedLocal.d.title || "Exam") + " · " + storedLocal.items.filter(x => x.type === "q").length + " questions" + (storedLocal.savedAt ? " · last edited " + new Date(storedLocal.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "");
  $("#stNote").textContent = FS_OK ? "" : "This browser (e.g. Safari or Firefox) doesn't let web pages save to a file on your computer automatically — Chrome and Edge do. Your work is still kept safely in this browser, and 💾 Save as… downloads a project copy whenever you like.";
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
  try{ perm = await h.requestPermission({ mode: "readwrite" }); }catch(_){}
  if(perm !== "granted"){ toast("Permission is needed to keep saving to " + h.name); return; }
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
  mathReady.then(() => { mathOK = !!(window.MathJax && MathJax.tex2svg); render(); preview(); }).catch(e => { console.error(e); preview(); });
})();
window.__exam = { S: () => S, set: o => { S = mergeState(o); refreshDetails(); updateLogoUI(); render(); }, parseText, buildPDF };
</script>