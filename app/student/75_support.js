/* ---- accommodations the teacher allowed (EXAM.acc): coloured overlay, reading ruler, letter spacing,
        highlighter, supervised rest breaks — plus a big pointer and keyboard shortcuts for everyone ---- */
const ALLOW = () => EXAM.acc || {};
function applySupport(){
  const p = ST.prefs, A = ALLOW(), B = document.body;
  // only what the teacher allowed is offered
  $$("#mView [data-acc]").forEach(el => el.classList.toggle("hidden", !A[el.dataset.acc]));
  $("#bRuler").classList.toggle("hidden", !A.ruler);
  $("#bHigh").classList.toggle("hidden", !A.highlight);
  $("#tBreakRow").classList.toggle("hidden", !A.breaks);
  const ov = A.overlay ? p.overlay || "" : "";
  $("#ovl").className = "overlay" + (ov ? " " + ov : " hidden");
  B.classList.toggle("lt-wide", !!A.spacing && p.letters === "wide"); B.classList.toggle("lt-wider", !!A.spacing && p.letters === "wider");
  B.classList.toggle("big-ptr", p.pointer === "big");
  setRuler(!!A.ruler && !!p.ruler);
  B.classList.toggle("hl-on", !!A.highlight && !!HL.on);
}

/* 📏 reading ruler: everything is dimmed except a band around the line being read (follows the mouse, or the answer being typed) */
let rulerY = innerHeight / 3;
function setRuler(on){
  document.body.classList.toggle("ruler-on", on);
  $("#rulerTop").classList.toggle("hidden", !on); $("#rulerBot").classList.toggle("hidden", !on);
  if(on) placeRuler();
}
function placeRuler(){
  if(!document.body.classList.contains("ruler-on")) return;
  const lh = parseFloat(getComputedStyle(document.body).fontSize) * 1.7 * 1.6, half = Math.max(26, lh);
  $("#rulerTop").style.height = Math.max(0, rulerY - half) + "px";
  $("#rulerBot").style.top = (rulerY + half) + "px";
}
document.addEventListener("pointermove", e => { if(document.body.classList.contains("ruler-on")){ rulerY = e.clientY; placeRuler(); } }, { passive: true });
document.addEventListener("focusin", e => { if(!document.body.classList.contains("ruler-on")) return; const r = e.target.getBoundingClientRect && e.target.getBoundingClientRect(); if(r && r.height){ rulerY = r.top + Math.min(r.height, 60) / 2; placeRuler(); } });
$("#bRuler").onclick = () => { ST.prefs.ruler = !ST.prefs.ruler; if(ST.prefs.ruler) logEv("reading ruler on"); changed(); applySupport(); };

/* 🖍 highlighter: select words in a question to highlight them; click a highlight to remove it. Kept with the answers. */
const HL = { on: false };
$("#bHigh").onclick = () => { HL.on = !HL.on; applySupport(); toast(HL.on ? "Select words in a question to highlight them. Click a highlight to remove it." : "Highlighter off."); };
function richOf(n){ const el = n && (n.nodeType === 1 ? n : n.parentElement); return el && el.closest("#paper .rich"); }
function saveHighlights(){
  ST.hl = {};
  $$("#paper .rich[data-r]").forEach(el => { if(!el.querySelector("mark.hl")) return; const c = el.cloneNode(true); c.querySelectorAll(".drawon").forEach(x => x.remove()); ST.hl[el.dataset.r] = c.innerHTML; });
  changed();
}
function restoreHighlights(){
  $$("#paper .rich").forEach((el, k) => { el.dataset.r = k; if(ST.hl && ST.hl[k]) el.innerHTML = ST.hl[k]; });
}
document.addEventListener("mouseup", () => {
  if(!HL.on || ST.endedAt) return;
  const sel = getSelection(); if(!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  if(!richOf(range.startContainer) || !richOf(range.endContainer)) return;
  // wrap every piece of text inside the selection (it can cross bold, italics, lines…)
  const texts = [], root = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => range.intersectsNode(n) && n.textContent.trim() && richOf(n) && !n.parentElement.closest("mark.hl, svg, button") ? 1 : 2 });
  for(let n; (n = w.nextNode());) texts.push(n);
  texts.forEach(n => {
    let s = 0, e = n.textContent.length;
    if(n === range.startContainer) s = range.startOffset;
    if(n === range.endContainer) e = range.endOffset;
    if(e <= s) return;
    const mid = n.splitText(s); mid.splitText(e - s);
    const m = document.createElement("mark"); m.className = "hl"; mid.before(m); m.appendChild(mid);
  });
  sel.removeAllRanges();
  if(texts.length){ ST.hlCount = (ST.hlCount || 0) + 1; if(ST.hlCount === 1) logEv("used the highlighter"); saveHighlights(); }
});
document.addEventListener("click", e => {
  const m = e.target.closest && e.target.closest("mark.hl"); if(!m || !HL.on) return;
  m.replaceWith(...m.childNodes); saveHighlights();
});

/* ☕ supervised rest break: the teacher starts it (teacher code), the clock stops, the paper is covered */
function showBreak(){
  try{ stopReading(); }catch(_){}
  $("#brkCode").value = ""; $("#brkErr").textContent = ""; $("#brkSince").textContent = "Started at " + hm(ST.breakAt) + ". Time left when you carry on: " + dur(leftMs()) + ".";
  $("#scrBreak").classList.remove("hidden"); setTimeout(() => $("#brkCode").focus(), 60);
}
$("#tBreak").onclick = () => {
  closeM("#mTeacher"); ST.breakAt = now(); logEv("rest break started"); changed(); saveNow(); showBreak();
};
$("#brkGo").onclick = async () => {
  soundOn(); goFull();
  if(!(await teacherOK($("#brkCode").value))){ $("#brkErr").textContent = "That's not the teacher code."; return; }
  const ms = now() - ST.breakAt; ST.paused = (ST.paused || 0) + ms; ST.breakAt = null; ST.breaks = (ST.breaks || 0) + 1;
  logEv("rest break ended", { ms }); $("#scrBreak").classList.add("hidden"); changed(); saveNow(); tick();
};
$("#brkCode").addEventListener("keydown", e => { if(e.key === "Enter") $("#brkGo").click(); });

/* ⌨ keyboard: Alt+↓ / Alt+↑ go to the next / previous question (and into its answer) */
document.addEventListener("keydown", e => {
  if(!e.altKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp") || !PAPER || $("#scrExam").classList.contains("hidden")) return;
  e.preventDefault();
  const qs = $$("#paper .q"); if(!qs.length) return;
  const cur = document.activeElement && document.activeElement.closest && document.activeElement.closest(".q");
  let i = cur ? qs.indexOf(cur) : qs.findIndex(q => q.getBoundingClientRect().top > 70) - (e.key === "ArrowDown" ? 1 : 0);
  i = Math.max(0, Math.min(qs.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)));
  qs[i].scrollIntoView({ block: "start" });
  const f = qs[i].querySelector("textarea, math-field, input, [data-say]"); if(f) f.focus({ preventScroll: true });
});
