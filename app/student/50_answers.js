/* ---- answer areas: each is a list of blocks — text, maths or a drawing ---- */
const AREA_SPEC = {};      // "qid|key" → { kind, lines, range }
function areaBlocks(aid, create){
  const [qid, key] = aid.split("|");
  const A = ST.answers[qid] || (create ? (ST.answers[qid] = {}) : null); if(!A) return null;
  A.areas = A.areas || {};
  return A.areas[key] || (create ? (A.areas[key] = []) : null);
}
function mountArea(it, key, spec){
  const aid = it.id + "|" + key; AREA_SPEC[aid] = spec;
  const bl = areaBlocks(aid, true);
  if(!bl.length){
    // a drawing space (number line, axes, grid) starts as a drawing; everything else starts as text
    if(EXAM.drawing && /^(numberline|axes|grid)$/.test(spec.kind)) bl.push({ t: "draw", bg: { kind: spec.kind, range: spec.range || "" }, ops: [] });
    bl.push({ t: "text", v: "" });
  }
  renderArea(aid);
}
function renderArea(aid){
  const el = document.querySelector(`[data-area="${aid}"]`); if(!el) return;
  const spec = AREA_SPEC[aid] || {}, bl = areaBlocks(aid, true);
  el.className = "ans";
  el.innerHTML = `<div class="lab">Your answer</div><div class="blks"></div>
    <div class="addrow"><button class="btn" data-add="text">＋ Text</button><button class="btn" data-add="math">＋ Maths</button>${EXAM.drawing ? `<button class="btn" data-add="draw">＋ Drawing</button>` : ""}</div>`;
  const box = el.querySelector(".blks");
  bl.forEach((b, i) => box.appendChild(blockEl(aid, b, i, spec)));
  el.querySelectorAll("[data-add]").forEach(btn => btn.onclick = () => {
    const t = btn.dataset.add;
    addBlock(aid, t === "draw" ? { t: "draw", bg: { kind: /^(numberline|axes|grid)$/.test(spec.kind) ? spec.kind : "blank", range: spec.range || "" }, ops: [] } : { t, v: "" }, true);
  });
}
function addBlock(aid, b, focus){
  if(ST.endedAt) return;
  const bl = areaBlocks(aid, true);
  // an empty text block at the end is replaced instead of piling up
  const last = bl[bl.length - 1];
  if(b.t !== "text" && last && last.t === "text" && !String(last.v || "").trim()) bl.pop();
  bl.push(b); if(b.t !== "text") bl.push({ t: "text", v: "" });
  changed(); renderArea(aid); renderNav();
  const el = document.querySelector(`[data-area="${aid}"] .blks`), k = bl.indexOf(b);
  const node = el && el.children[k];
  if(focus && node){
    if(b.t === "draw") openPad(aid, b);
    else { const f = node.querySelector("textarea, math-field"); if(f) setTimeout(() => f.focus(), 30); }
  }
}
function blockEl(aid, b, i, spec){
  const d = document.createElement("div"); d.className = "blk";
  const rm = document.createElement("button"); rm.className = "rm"; rm.title = "Remove this part of your answer"; rm.textContent = "✕";
  rm.onclick = () => {
    const bl = areaBlocks(aid, true), has = b.t === "draw" ? (b.ops || []).length : String(b.v || "").trim();
    if(has && rm.dataset.sure !== "1"){ rm.dataset.sure = "1"; rm.textContent = "?"; rm.title = "Click again to remove it"; setTimeout(() => { rm.dataset.sure = ""; rm.textContent = "✕"; }, 2500); return; }
    bl.splice(bl.indexOf(b), 1); if(!bl.length) bl.push({ t: "text", v: "" });
    changed(); renderArea(aid); renderNav();
  };
  if(b.t === "text"){
    const ta = document.createElement("textarea");
    ta.value = b.v || ""; ta.rows = Math.max(2, Math.min(8, +spec.lines || 3));
    ["spellcheck", "autocorrect", "autocomplete", "autocapitalize"].forEach(a => ta.setAttribute(a, "off")); ta.spellcheck = false;
    ta.setAttribute("data-gramm", "false"); ta.setAttribute("aria-label", "Your answer");
    const grow = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; };
    ta.addEventListener("input", () => { b.v = ta.value; grow(); changed(); if(!ta.dataset.counted){ ta.dataset.counted = 1; renderNav(); } });
    ta.addEventListener("blur", () => { ta.dataset.counted = ""; renderNav(); });
    d.appendChild(ta); requestAnimationFrame(grow);
  }else if(b.t === "math"){
    const k = document.createElement("span"); k.className = "kind"; k.textContent = "maths"; d.appendChild(k);
    const mf = document.createElement("math-field");
    mf.setAttribute("math-virtual-keyboard-policy", "manual");
    mf.setAttribute("aria-label", "Maths answer");
    d.appendChild(mf);
    customElements.whenDefined("math-field").then(() => {
      mf.value = b.v || "";
      try{ mf.smartFence = true; mf.menuItems = []; mf.inlineShortcutTimeout = 0; }catch(_){}
    });
    mf.addEventListener("input", () => { b.v = mf.value; changed(); });
    mf.addEventListener("focusin", () => { if(ST.prefs.mathKb && window.mathVirtualKeyboard) mathVirtualKeyboard.show({ animate: true }); });
    mf.addEventListener("focusout", () => { if(b.v !== mf.value){ b.v = mf.value; changed(); } renderNav(); });
  }else if(b.t === "draw"){
    const k = document.createElement("span"); k.className = "kind"; k.textContent = "drawing — click to draw"; d.appendChild(k);
    const img = document.createElement("img"); img.className = "drawn"; img.alt = "Your drawing (click to change it)";
    if(!b.png) img.dataset.bg = JSON.stringify(b.bg);
    img.src = b.png || padPreview(b); img.onclick = () => openPad(aid, b);
    d.appendChild(img);
  }
  if(!(areaBlocks(aid, true).length === 1 && b.t === "text")) d.appendChild(rm);
  return d;
}

/* ---- the maths keyboard: BEE's own tabs, with the things students reach for most ---- */
function setupMathKeyboard(){
  if(!window.mathVirtualKeyboard) return;
  const K = (latex, insert, extra) => Object.assign({ latex, insert: insert || latex }, extra || {});
  const NAV = ["[left]", "[right]", "[backspace]", { label: "↵", command: ["performWithFeedback", "commit"], class: "action" }];
  const SEP = { class: "separator w5" };
  const frac = K("\\frac{\\square}{\\square}", "\\frac{#@}{#?}", { class: "small", width: 1.5, aside: "fraction" });
  const layouts = [
    { label: "123", tooltip: "Numbers", rows: [
      ["7", "8", "9", "\\div", SEP, frac, K("\\square\\frac{\\square}{\\square}", "#?\\frac{#?}{#?}", { class: "small", aside: "mixed" }), K("\\square^2", "#@^{2}"), K("\\square^{\\square}", "#@^{#?}"), K("\\sqrt{\\square}", "\\sqrt{#0}"), K("\\sqrt[\\square]{\\square}", "\\sqrt[#?]{#0}")],
      ["4", "5", "6", "\\times", SEP, "(", ")", "\\%", "\\pm", "\\pi", K("0.\\overline{3}", "\\overline{#0}", { aside: "recurring" })],
      ["1", "2", "3", "-", SEP, "<", ">", "\\le", "\\ge", "\\ne", "\\approx"],
      ["0", ".", ",", "+", SEP, "=", ...NAV]
    ] },
    { label: "x y", tooltip: "Algebra", rows: [
      ["x", "y", "z", "a", "b", "c", "n", K("\\square_{\\square}", "#@_{#?}", { aside: "small below" }), K("|\\square|", "\\left|#0\\right|")],
      ["(", ")", "[", "]", "\\{", "\\}", K("f(x)", "f(#0)"), "\\infty", "\\propto"],
      ["\\Rightarrow", "\\Leftrightarrow", "\\therefore", "\\because", "\\equiv", ":", "\\ldots", "\\cdot", "!"],
      ["=", "<", ">", "\\le", "\\ge", ...NAV]
    ] },
    { label: "△ °", tooltip: "Geometry and units", rows: [
      ["^{\\circ}", "\\angle", "\\triangle", "\\parallel", "\\perp", "\\cong", "\\sim", "\\theta", "\\alpha", "\\beta"],
      [K("\\overline{AB}", "\\overline{#0}"), K("\\overrightarrow{AB}", "\\overrightarrow{#0}"), K("\\overset{\\frown}{AB}", "\\overset{\\frown}{#0}"), "\\pi", "r", "h", "A", "B", "C"],
      [K("\\mathrm{mm}"), K("\\mathrm{cm}"), K("\\mathrm{m}"), K("\\mathrm{km}"), K("\\mathrm{cm}^2"), K("\\mathrm{m}^2"), K("\\mathrm{cm}^3"), K("\\mathrm{m/s}"), K("\\mathrm{kg}"), K("^{\\circ}\\mathrm{C}")],
      [K("\\mathrm{g}"), K("\\mathrm{L}"), K("\\mathrm{mL}"), K("\\mathrm{s}"), K("\\mathrm{h}"), ...NAV]
    ] },
    { label: "f(x)", tooltip: "Functions", rows: [
      [K("\\sin"), K("\\cos"), K("\\tan"), K("\\sin^{-1}"), K("\\cos^{-1}"), K("\\tan^{-1}"), K("\\log"), K("\\ln"), K("e^{\\square}", "e^{#0}")],
      [K("\\log_{\\square}", "\\log_{#?}"), K("\\lim_{x\\to\\square}", "\\lim_{x\\to#?}"), K("\\frac{d}{dx}", "\\frac{d}{dx}"), K("\\frac{dy}{dx}"), K("\\int", "\\int"), K("\\int_{\\square}^{\\square}", "\\int_{#?}^{#?}"), K("\\sum_{\\square}^{\\square}", "\\sum_{#?}^{#?}"), K("f'(x)"), K("f^{-1}(x)")],
      ["(", ")", "x", "y", "\\pi", "e", "\\infty", "\\to", "\\mapsto"],
      ["=", ...NAV]
    ] },
    { label: "Σ ∈", tooltip: "Statistics and sets", rows: [
      [K("\\bar{x}", "\\bar{#0}"), "\\sum", "\\sigma", "\\mu", K("P(A)", "P(#0)"), K("P(A|B)", "P(#?|#?)"), K("n!", "#@!"), K("\\binom{n}{r}", "\\binom{#?}{#?}"), K("{}^nC_r", "{}^{#?}C_{#?}")],
      ["\\in", "\\notin", "\\subset", "\\subseteq", "\\cup", "\\cap", "\\emptyset", K("A'", "#@'"), "\\setminus"],
      ["\\N", "\\Z", "\\Q", "\\R", "\\{", "\\}", "|", ":", "\\varnothing"],
      ["=", ...NAV]
    ] },
    { label: "H₂O", tooltip: "Chemistry", rows: [
      [K("\\square_{\\square}", "#@_{#?}", { aside: "subscript" }), K("\\square^{\\square}", "#@^{#?}", { aside: "charge" }), "\\rightarrow", "\\rightleftharpoons", "\\uparrow", "\\downarrow", "\\Delta", "+", "-"],
      [K("\\mathrm{(s)}"), K("\\mathrm{(l)}"), K("\\mathrm{(g)}"), K("\\mathrm{(aq)}"), K("\\mathrm{H}"), K("\\mathrm{O}"), K("\\mathrm{C}"), K("\\mathrm{N}"), K("\\mathrm{Na}")],
      [K("\\mathrm{Cl}"), K("\\mathrm{Ca}"), K("\\mathrm{Mg}"), K("\\mathrm{Fe}"), K("\\mathrm{Cu}"), K("\\mathrm{S}"), K("\\mathrm{K}"), K("e^-"), "\\cdot"],
      ["2", "3", "4", ...NAV]
    ] },
    "alphabetic", "greek"
  ];
  try{ mathVirtualKeyboard.layouts = layouts; }catch(e){ console.warn("keyboard layouts", e); mathVirtualKeyboard.layouts = ["numeric", "symbols", "alphabetic", "greek"]; }
  mathVirtualKeyboard.addEventListener("geometrychange", () => {
    const h = mathVirtualKeyboard.boundingRect.height || 0;
    document.body.style.setProperty("--keyboard-height", h + "px");
    document.body.classList.toggle("kb-up", h > 0);
    document.body.style.paddingBottom = h ? h + 20 + "px" : "";
  });
}
