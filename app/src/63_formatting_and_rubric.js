/* ---------------- text formatting (per question) ---------------- */
const SWATCHES = [["#111111", "Black"], ["#C0392B", "Red"], ["#1F5FBF", "Blue"], ["#2E7D32", "Green"], ["#D35400", "Orange"], ["#7B3FA0", "Purple"]];
const alDef = () => S.d.justify !== false ? "justify" : "left";   // what a line with no alignment of its own looks like
// ⋯ More: the less-used switches of a card; whatever is switched on also shows as a chip so it's never hidden
const MORE = {
  nonum:     { ic: "#", label: "No number", sub: "print it without a question number", on: it => it.nonum, q: true },
  hidemarks: { ic: "✕", label: "Hide marks", sub: "don't print [marks] (they still count)", on: it => it.hideMarks, q: true },
  half:      { ic: "◧", label: "Half width", sub: "two short questions side by side", on: it => it.width === "half", q: true },
  newpage:   { ic: "⤓", label: "Start on a new page", sub: "", on: it => it.newPage },
  linenums:  { ic: "№", label: "Line numbers", sub: "number every 5th line (passages)", on: it => it.lineNums }
};
function moreMenu(it){
  const keys = Object.keys(MORE).filter(k => it.type === "q" || !MORE[k].q);
  return `<span class="ins-wrap adv"><button type="button" class="btn sm" data-ins title="More options for this ${it.type === "q" ? "question" : "text"}">⋯ More ▾</button><div class="ins-menu hidden">
    ${keys.map(k => { const m = MORE[k], on = !!m.on(it); return `<button type="button" class="ins-it ${on ? "is-on" : ""}" data-act="${k}"><span class="ic">${on ? "✓" : m.ic}</span><span><b>${m.label}</b>${m.sub ? `<small>${m.sub}</small>` : ""}</span></button>`; }).join("")}
  </div></span>`;
}
function moreChips(it){
  const on = Object.keys(MORE).filter(k => (it.type === "q" || !MORE[k].q) && MORE[k].on(it));
  return on.length ? `<div class="flags">${on.map(k => `<button type="button" class="flag" data-act="${k}" title="Switch off">${MORE[k].ic} ${MORE[k].label} ✕</button>`).join("")}</div>` : "";
}
function insertMenu(it){
  const I = (act, ic, label, sub, title) => `<button type="button" class="ins-it" data-act="${act}" title="${title || ""}"><span class="ic">${ic}</span><span><b>${label}</b><small>${sub}</small></span></button>`;
  return `<span class="ins-wrap"><button type="button" class="btn sm" data-ins title="Put a table, equation, graph, molecule or picture where the cursor is">＋ Insert ▾</button><div class="ins-menu hidden">
    ${I("table", "▦", "Table", "data table, Punnett square… at the cursor")}
    ${I("eq", "∑", "Equation", "maths, physics, chemistry at the cursor")}
    ${I("graph", "📈", it.graph ? "Edit graph" : "Graph", it.graph ? "the graph of this question" : "functions or blank axes at the cursor")}
    ${I("mol", "⌬", "Molecule", "a chemical structure at the cursor")}
    ${I("inspic", "🖼", "Picture", "a photo or diagram at the cursor")}
    ${I("cutpdfins", "📄", "Picture from a PDF", "cut a diagram out of a PDF, at the cursor")}
    ${it.img ? "" : I("addimg", "⇲", "Picture beside the text", "one picture with the text wrapping round it")}
  </div></span>`;
}
document.addEventListener("click", e => {
  const t = e.target.closest("[data-ins]");
  document.querySelectorAll(".ins-menu").forEach(m => { if(!t || m !== t.nextElementSibling) m.classList.add("hidden"); });
  if(t){ const m = t.nextElementSibling; m.classList.toggle("hidden"); if(!m.classList.contains("hidden")){ keepOnScreen(m); const r = m.getBoundingClientRect(); m.classList.toggle("up", r.bottom > innerHeight - 8 && r.top > r.height + 60); } }
});
// a menu never runs off the side of the screen (phones): shift it back in
function keepOnScreen(m){
  m.style.transform = ""; const r = m.getBoundingClientRect(), pad = 8;
  const dx = r.left < pad ? pad - r.left : (r.right > innerWidth - pad ? innerWidth - pad - r.right : 0);
  if(dx) m.style.transform = `translateX(${Math.round(dx)}px)`;
  if(r.width > innerWidth - 2 * pad) m.style.maxWidth = (innerWidth - 2 * pad) + "px";
}
document.addEventListener("toggle", e => { const d = e.target; if(d.matches && d.matches("details.qmenu") && d.open){ const p = d.querySelector(".qmenu-pop"); if(p) keepOnScreen(p); } }, true);
function fmtBar(it){
  const f = it.fmt || {};
  return `<div class="fmtbar" title="Select words to format just them — or select nothing to format the whole question">
    <button type="button" data-fmt="b" class="${f.b ? "on" : ""}" title="Bold"><b>B</b></button>
    <button type="button" data-fmt="i" class="${f.i ? "on" : ""}" title="Italic"><i>I</i></button>
    <button type="button" data-fmt="u" class="${f.u ? "on" : ""}" title="Underline"><u>U</u></button>
    <button type="button" data-fmt="x" class="${f.x ? "on" : ""}" title="Strikethrough"><s>S</s></button>
    <span class="fsep"></span>
    <button type="button" data-fmt="sz" data-d="-1" class="sz" title="Smaller text — select lines, or nothing = whole question">A<small>−</small></button>
    <button type="button" data-fmt="sz" data-d="1" class="sz" title="Bigger text (e.g. a title) — select lines, or nothing = whole question"><b>A</b><small>+</small></button>
    <span class="fsep"></span>
    <button type="button" data-fmt="al" data-a="left" class="al ${(f.align || alDef()) === "left" ? "on" : ""}" title="Align left — select lines, or nothing = whole question"><svg viewBox="0 0 16 16" width="15" height="15"><path d="M2 3h12M2 6.5h8M2 10h12M2 13.5h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    <button type="button" data-fmt="al" data-a="center" class="al ${(f.align || alDef()) === "center" ? "on" : ""}" title="Centre — select lines, or nothing = whole question"><svg viewBox="0 0 16 16" width="15" height="15"><path d="M2 3h12M4 6.5h8M2 10h12M4 13.5h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    <button type="button" data-fmt="al" data-a="right" class="al ${(f.align || alDef()) === "right" ? "on" : ""}" title="Align right — select lines, or nothing = whole question"><svg viewBox="0 0 16 16" width="15" height="15"><path d="M2 3h12M6 6.5h8M2 10h12M6 13.5h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    <button type="button" data-fmt="al" data-a="justify" class="al ${(f.align || alDef()) === "justify" ? "on" : ""}" title="Justify (straight right edge) — select lines, or nothing = whole question"><svg viewBox="0 0 16 16" width="15" height="15"><path d="M2 3h12M2 6.5h12M2 10h12M2 13.5h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
    <span class="fsep"></span>
    <span class="swdd"><button type="button" class="swbtn" data-swtoggle title="Text colour" style="--c:${f.c || "#24211C"}"><span class="dot"></span>▾</button><span class="swpop">
    ${SWATCHES.map(([c, n]) => `<button type="button" data-fmt="color" data-c="${c}" class="sw ${f.c === c ? "on" : ""}" title="${n} text" style="--c:${c}"></button>`).join("")}
    <label class="sw custom ${f.c && !SWATCHES.some(x => x[0] === f.c) ? "on" : ""}" title="Other colour…" style="--c:${f.c && !SWATCHES.some(x => x[0] === f.c) ? f.c : "#fff"}"><input type="color" data-fmt="colorpick" value="${f.c || "#1F5FBF"}"></label></span></span>
    <span class="fsep"></span>
    <button type="button" data-fmt="clear" title="Remove formatting">⌫ Clear</button>
  </div>`;
}
let fmtSel = null; // selection saved before a colour picker steals focus
function curSel(card){
  const ta = card.querySelector("textarea[data-f=text]"); if(!ta) return null;
  if(document.activeElement === ta) return { ta, a: ta.selectionStart, e: ta.selectionEnd };
  if(fmtSel && fmtSel.id === card.dataset.id) return { ta, a: fmtSel.a, e: fmtSel.e };
  if(lastTA && lastTA.id === card.dataset.id && !lastTA.sid && (!lastTA.f || lastTA.f === "text")) return { ta, a: lastTA.s, e: lastTA.e };
  return { ta, a: 0, e: 0 };
}
function applyToggle(card, it, key, val){
  const sel = curSel(card); if(!sel || sel.e <= sel.a) return false;   // nothing selected → whole question
  const r = toggleFmtRange(sel.ta.value, sel.a, sel.e, key, val);
  if(!r) return false;
  it.text = r.text; sel.ta.value = r.text; autoGrow(sel.ta);
  sel.ta.focus(); sel.ta.setSelectionRange(r.a, r.e);
  lastTA = { id: it.id, s: r.a, e: r.e };
  return true;
}
function stripFmt(t){ return t.replace(/^(?:\s*\{(?:center|centre|right|left|justify|small|big|bigger|huge)\}\s*)+/gm, "").replace(/\{\/?color[^}]*\}/g, "").replace(/\*\*|\+\+|~~/g, "").replace(/(^|[^\w*])\*([^\s*][^*]*?)\*(?!\*)/g, "$1$2"); }
function onFmt(btn, card, it, colorVal){
  const k = btn.dataset.fmt;
  it.fmt = it.fmt || {};
  if(k === "b" || k === "i" || k === "u" || k === "x"){
    if(!applyToggle(card, it, k)) it.fmt[k] = !it.fmt[k];
  }else if(k === "color" || k === "colorpick"){
    const c = colorVal || btn.dataset.c;
    if(!applyToggle(card, it, "c", c)) it.fmt.c = (it.fmt.c === c && k === "color") ? "" : c;
  }else if(k === "sz"){
    const d = +btn.dataset.d, r = curSel(card), step = cur => SIZES[Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(cur || "") + d))];
    if(r && r.e > r.a){
      const v = r.ta.value, a0 = v.lastIndexOf("\n", r.a - 1) + 1, e1 = v.indexOf("\n", r.e - (v[r.e - 1] === "\n" ? 1 : 0)), e0 = e1 < 0 ? v.length : e1;
      const whole = it.fmt.size || "";
      const seg = v.slice(a0, e0).split("\n").map(l => { const P = linePre(l); if(!P.rest.trim()) return l; const ns = step(P.size || whole); return buildLine(P.align, ns === whole ? "" : ns, P.rest); }).join("\n");
      it.text = v.slice(0, a0) + seg + v.slice(e0); r.ta.value = it.text;
      r.ta.focus(); r.ta.setSelectionRange(a0, a0 + seg.length);
      toast("Text size: " + ({ small: "small", "": "normal", big: "big", bigger: "bigger", huge: "huge" })[linePre(seg.split("\n").find(l => l.trim()) || "").size || whole]);
    }else{ it.fmt.size = step(it.fmt.size); toast("Whole question: " + (it.fmt.size || "normal") + " text"); }
  }else if(k === "al"){
    const want = btn.dataset.a, r = curSel(card);
    if(r && r.e > r.a){
      // align only the lines touched by the selection
      const v = r.ta.value, a0 = v.lastIndexOf("\n", r.a - 1) + 1, e1 = v.indexOf("\n", r.e - (v[r.e - 1] === "\n" ? 1 : 0)), e0 = e1 < 0 ? v.length : e1;
      const whole = (it.fmt.align || alDef());
      const seg = v.slice(a0, e0).split("\n").map(l => { const P = linePre(l); return !P.rest.trim() ? l : buildLine(want === whole ? "" : want, P.size, P.rest); }).join("\n");
      it.text = v.slice(0, a0) + seg + v.slice(e0); r.ta.value = it.text;
      r.ta.focus(); r.ta.setSelectionRange(a0, a0 + seg.length);
    }else it.fmt.align = want === alDef() ? "" : want;
  }else if(k === "clear"){
    if(!applyToggle(card, it, "clear")) it.fmt = {};
  }
  lastEdited = it.id; fmtSel = null;
  refreshFmtBar(card, it);
  updateRich(card, it); changed();
}
// light up B / I / U / colour for the selected words (or the whole-question style when nothing is selected)
function refreshFmtBar(card, it){
  const bar = card.querySelector(".fmtbar"); if(!bar) return;
  const ta = card.querySelector("textarea[data-f=text]");
  let f = it.fmt || {};
  if(ta && document.activeElement === ta && ta.selectionEnd > ta.selectionStart){ const ss = selStyle(ta.value, ta.selectionStart, ta.selectionEnd); if(ss) f = ss; }
  bar.querySelectorAll("button[data-fmt=b],button[data-fmt=i],button[data-fmt=u],button[data-fmt=x]").forEach(x => x.classList.toggle("on", !!f[x.dataset.fmt]));
  { let al = it.fmt && it.fmt.align || alDef();
    if(ta && document.activeElement === ta && ta.selectionEnd > ta.selectionStart){
      const v = ta.value, a0 = v.lastIndexOf("\n", ta.selectionStart - 1) + 1, e1 = v.indexOf("\n", ta.selectionEnd), L = v.slice(a0, e1 < 0 ? v.length : e1).split("\n").filter(l => l.trim());
      const set = new Set(L.map(l => linePre(l).align || (it.fmt && it.fmt.align || alDef())));
      al = set.size === 1 ? [...set][0] : "";
    }
    bar.querySelectorAll("button[data-fmt=al]").forEach(x => x.classList.toggle("on", x.dataset.a === al)); }
  // (al: "" from a line means the exam default)
  bar.querySelectorAll("button[data-fmt=color]").forEach(x => x.classList.toggle("on", !!f.c && f.c.toLowerCase() === x.dataset.c.toLowerCase()));
  const sb = bar.querySelector(".swbtn"); if(sb) sb.style.setProperty("--c", f.c || "#24211C");
  const cu = bar.querySelector(".custom"); if(cu){ const custom = f.c && !SWATCHES.some(x => x[0].toLowerCase() === f.c.toLowerCase()); cu.classList.toggle("on", !!custom); cu.style.setProperty("--c", custom ? cssHex(f.c) : "#fff"); }
}
["select", "keyup", "mouseup", "focusin", "focusout"].forEach(ev => $("#list").addEventListener(ev, e => {
  const ta = e.target.closest && e.target.closest("textarea[data-f=text]"); if(!ta) return;
  const card = ta.closest(".card"); const it = S.items.find(x => x.id === card.dataset.id);
  if(it) setTimeout(() => refreshFmtBar(card, it), 0);
}));
$("#list").addEventListener("mousedown", e => { if(e.target.closest(".fmtbar button")) e.preventDefault(); });
// the colour button opens the colours; picking one (or clicking anywhere else) closes them
document.addEventListener("click", e => {
  const t = e.target.closest("[data-swtoggle]"), inPop = e.target.closest(".swpop");
  document.querySelectorAll(".swdd.open").forEach(d => { if((!t || d !== t.parentElement) && !(inPop && inPop.parentElement === d && e.target.closest(".custom"))) d.classList.remove("open"); });
  if(t) t.parentElement.classList.toggle("open");
});
// the formatting bar shows only on the card being edited
// (only typing places count, not buttons; the page scrolls so that what was clicked stays under the pointer)
document.addEventListener("focusin", e => {
  const t = e.target; if(!t.matches || !t.matches("textarea, input[type=text], math-field")) return;
  const c = t.closest("#list .card"); if(!c || c.classList.contains("editing")) return;
  const before = t.getBoundingClientRect().top;
  document.querySelectorAll("#list .card.editing").forEach(x => x.classList.remove("editing")); c.classList.add("editing"); window.editingId = c.dataset.id;
  const d = t.getBoundingClientRect().top - before; if(Math.abs(d) > 1) window.scrollBy(0, d);
});
$("#list").addEventListener("pointerdown", e => {
  const lab = e.target.closest(".fmtbar .custom"); if(!lab) return;
  const card = lab.closest(".card"), ta = card.querySelector("textarea[data-f=text]");
  if(ta) fmtSel = document.activeElement === ta ? { id: card.dataset.id, a: ta.selectionStart, e: ta.selectionEnd } : (lastTA && lastTA.id === card.dataset.id && !lastTA.sid && (!lastTA.f || lastTA.f === "text") ? { id: card.dataset.id, a: lastTA.s, e: lastTA.e } : { id: card.dataset.id, a: 0, e: 0 });
});
$("#list").addEventListener("click", e => {
  const btn = e.target.closest(".fmtbar button[data-fmt]"); if(!btn) return;
  const card = btn.closest(".card"); const it = S.items.find(x => x.id === card.dataset.id); if(!it) return;
  onFmt(btn, card, it);
});
$("#list").addEventListener("change", e => {
  const inp = e.target.closest(".fmtbar input[data-fmt=colorpick]"); if(!inp) return;
  const card = inp.closest(".card"); const it = S.items.find(x => x.id === card.dataset.id); if(!it) return;
  onFmt(inp, card, it, inp.value);
});

/* ---------------- rubric page ---------------- */
const RUBRIC_PRESETS = {
  essay: { label: "ELA — Essay writing", title: "Scoring by Section (for Teacher)", groups: [{ heading: "Essay Breakdown of Grade", items: [
    ["Main Idea", "Clear, focused thesis that answers the prompt", 10], ["Supporting Ideas", "Relevant reasons, examples and evidence", 10], ["Voice", "Engaging, appropriate tone for audience and purpose", 10],
    ["Word Choice", "Precise, varied vocabulary", 10], ["Sentence Fluency", "Varied sentence structure that reads smoothly", 10], ["Organization", "Logical order, paragraphs, introduction and conclusion", 10],
    ["Grammar", "Correct verb tense, agreement and sentence structure", 10], ["Spelling & Punctuation", "Accurate spelling, capitals and punctuation", 10],
    ["Writing Process", "Evidence of planning, drafting and revising", 10], ["Format & Presentation", "Neat, legible, follows the required format", 10]] }] },
  lab: { label: "Science — Lab report", title: "Lab Report Rubric (for Teacher)", groups: [{ heading: "Lab report", items: [
    ["Research question & hypothesis", "Testable question and a reasoned prediction", 10], ["Variables & method", "Independent, dependent and controlled variables; clear steps", 15],
    ["Data collection", "Accurate measurements recorded in a table with units", 15], ["Graphs", "Correct type, labelled axes, units, scale and title", 15],
    ["Analysis", "Trends and patterns described using the data", 15], ["Conclusion & evaluation", "Answers the question; sources of error and improvements", 20],
    ["Safety & presentation", "Risks identified; neat and complete report", 10]] }] },
  maths: { label: "Maths — Problem solving", title: "Problem-Solving Rubric (for Teacher)", groups: [{ heading: "Problem solving", items: [
    ["Understanding the problem", "Identifies what is given and what is asked", 20], ["Strategy & reasoning", "Chooses a suitable method and justifies steps", 25],
    ["Accuracy", "Correct calculations and final answer", 25], ["Working shown", "Clear, complete and logical working", 20], ["Communication & notation", "Correct symbols, units and a stated answer", 10]] }] },
  project: { label: "Presentation / project", title: "Project Rubric (for Teacher)", groups: [{ heading: "Project", items: [
    ["Content & research", "Accurate, relevant and well researched", 25], ["Organisation", "Clear structure with a logical flow", 20], ["Visuals", "Clear, relevant and well designed", 15],
    ["Delivery", "Confident, audible, good eye contact", 20], ["Time management", "Within the time limit", 10], ["Questions & answers", "Answers questions with understanding", 10]] }] },
  blank: { label: "Blank", title: "Rubric (for Teacher)", groups: [{ heading: "Criteria", items: [["", "", 10]] }] }
};
function rubricFromPreset(k){
  const P = RUBRIC_PRESETS[k] || RUBRIC_PRESETS.essay;
  return { title: P.title, showParts: true, showTotal: true, showGrade: true, showComments: false, showDesc: false,
    groups: P.groups.map(g => ({ heading: g.heading, items: g.items.map(([name, desc, pts]) => ({ name, desc, pts: String(pts) })) })) };
}
function rubric(){ if(!S.d.rubric || !Array.isArray(S.d.rubric.groups)) S.d.rubric = rubricFromPreset("essay"); return S.d.rubric; }
const rbSum = R => R.groups.reduce((a, g) => a + g.items.reduce((b, it) => b + num(it.pts), 0), 0);
function renderRubric(){
  $("#rbOn").checked = !!S.d.rubricOn;
  $("#rubricBox").classList.toggle("hidden", !S.d.rubricOn);
  $("#dlRubric").classList.toggle("hidden", !S.d.rubricOn);
  if(!S.d.rubricOn) return;
  const R = rubric(), M = computeMeta();
  const chk = (k, l) => `<label><input type="checkbox" data-rb-opt="${k}" ${R[k] ? "checked" : ""}> ${l}</label>`;
  $("#rubricBox").innerHTML = `
    <div class="rb-top">
      <label class="f">Title of the page<input data-rb="title" value="${esc(R.title)}"></label>
      <label class="f">Start from a template<select id="rbPreset"><option value="">Choose…</option>${Object.entries(RUBRIC_PRESETS).map(([k, p]) => `<option value="${k}">${esc(p.label)}</option>`).join("")}</select></label>
    </div>
    <div class="rb-opts">
      ${chk("showParts", "List the exam's parts with their points")}${chk("showTotal", "TOTAL row")}${chk("showGrade", "Total exam grade (%) row")}
      ${chk("showDesc", "Show descriptions (for students)")}${chk("showComments", "Teacher comments box")}
    </div>
    ${R.groups.map((g, gi) => `<div class="rb-group" data-gi="${gi}">
      <div class="rb-ghead"><input data-rb="heading" value="${esc(g.heading)}" placeholder="Group heading, e.g. Essay Breakdown of Grade">
        <button class="btn icon" data-rba="gup" title="Move group up" ${gi === 0 ? "disabled" : ""}>↑</button>
        <button class="btn icon danger" data-rba="gdel" title="Remove this group">✕</button></div>
      ${g.items.map((it, ii) => `<div class="rb-row" data-ii="${ii}">
        <input data-rb="name" value="${esc(it.name)}" placeholder="Criterion, e.g. Main Idea">
        <input data-rb="desc" value="${esc(it.desc || "")}" placeholder="Description (optional)">
        <input data-rb="pts" type="number" min="0" step="0.5" value="${esc(it.pts)}" placeholder="pts">
        <span class="t"><button class="btn icon" data-rba="up" title="Move up" ${ii === 0 ? "disabled" : ""}>↑</button><button class="btn icon danger" data-rba="del" title="Remove">✕</button></span>
      </div>`).join("")}
      <button class="btn sm" data-rba="add">＋ Add criterion</button>
      <span class="hint" style="margin-left:8px">Group total: <b>${fmt(g.items.reduce((a, it) => a + num(it.pts), 0))}</b></span>
    </div>`).join("")}
    <button class="btn sm" data-rba="gadd">＋ Add group</button>
    <div class="rb-sum" style="margin-top:8px">${R.showParts && M.secs.length ? `TOTAL on the rubric = exam total <b>${fmt(M.total)}</b> (from the parts)` : `TOTAL on the rubric = sum of the criteria <b>${fmt(rbSum(R))}</b>`}</div>`;
}
function rbChanged(rerender){ lastEdited = "__rubric"; if(rerender) renderRubric(); changed(); }
$("#rbOn").addEventListener("change", e => { S.d.rubricOn = e.target.checked; if(S.d.rubricOn) rubric(); lastEdited = "__rubric"; renderRubric(); window.__rbInit = 1; updateFolds(); changed(); });
$("#rubricBox").addEventListener("input", e => {
  const R = rubric(), k = e.target.dataset.rb; if(!k) return;
  const g = e.target.closest(".rb-group"), r = e.target.closest(".rb-row");
  if(k === "title") R.title = e.target.value;
  else if(k === "heading") R.groups[+g.dataset.gi].heading = e.target.value;
  else R.groups[+g.dataset.gi].items[+r.dataset.ii][k] = e.target.value;
  rbChanged(k === "pts" ? false : false);
  if(k === "pts"){ const tot = g.querySelector(".hint b"); if(tot) tot.textContent = fmt(R.groups[+g.dataset.gi].items.reduce((a, it) => a + num(it.pts), 0)); }
});
$("#rubricBox").addEventListener("change", e => {
  const R = rubric();
  if(e.target.dataset.rbOpt){ R[e.target.dataset.rbOpt] = e.target.checked; rbChanged(true); return; }
  if(e.target.id === "rbPreset" && e.target.value){
    if(confirm("Replace the current rubric with the “" + RUBRIC_PRESETS[e.target.value].label + "” template?")){ S.d.rubric = rubricFromPreset(e.target.value); rbChanged(true); }
    else e.target.value = "";
  }
});
$("#rubricBox").addEventListener("click", e => {
  const b = e.target.closest("[data-rba]"); if(!b) return;
  const R = rubric(), g = b.closest(".rb-group"), gi = g ? +g.dataset.gi : -1, r = b.closest(".rb-row"), ii = r ? +r.dataset.ii : -1;
  const a = b.dataset.rba;
  if(a === "add"){ R.groups[gi].items.push({ name: "", desc: "", pts: "10" }); rbChanged(true); const rows = $("#rubricBox").querySelectorAll(`.rb-group[data-gi="${gi}"] .rb-row`); const last = rows[rows.length - 1]; if(last) last.querySelector("input").focus(); return; }
  if(a === "del"){ R.groups[gi].items.splice(ii, 1); }
  if(a === "up" && ii > 0){ const L = R.groups[gi].items; [L[ii - 1], L[ii]] = [L[ii], L[ii - 1]]; }
  if(a === "gadd"){ R.groups.push({ heading: "", items: [{ name: "", desc: "", pts: "10" }] }); }
  if(a === "gdel"){ if(!confirm("Remove this whole group?")) return; R.groups.splice(gi, 1); }
  if(a === "gup" && gi > 0){ [R.groups[gi - 1], R.groups[gi]] = [R.groups[gi], R.groups[gi - 1]]; }
  rbChanged(true);
});
