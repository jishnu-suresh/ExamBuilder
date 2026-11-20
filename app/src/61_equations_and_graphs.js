/* ---------------- equation editor ---------------- */
const PAL = {
  maths: [
    ["Basics", [["a⁄b","\\frac{#?}{#?}"],["xⁿ","#@^{#?}"],["xₙ","#@_{#?}"],["√","\\sqrt{#?}"],["ⁿ√","\\sqrt[#?]{#?}"],["|x|","\\left|#?\\right|"],["( )","\\left(#?\\right)"],["±","\\pm "],["×","\\times "],["÷","\\div "],["·","\\cdot "],["≠","\\neq "],["≈","\\approx "],["≤","\\le "],["≥","\\ge "],["∞","\\infty "],["°","^{\\circ}"],["%","\\%"]]],
    ["Algebra & calculus", [["logₐ","\\log_{#?}\\left(#?\\right)"],["ln","\\ln\\left(#?\\right)"],["sin","\\sin\\left(#?\\right)"],["cos","\\cos\\left(#?\\right)"],["tan","\\tan\\left(#?\\right)"],["Σ","\\sum_{#?}^{#?}"],["∫","\\int #?\\,d#?"],["∫ₐᵇ","\\int_{#?}^{#?} #?\\,d#?"],["lim","\\lim_{#?\\to #?}"],["d/dx","\\frac{d#?}{d#?}"],["∂","\\partial "],["f′","#@'"],["→","\\to "],["{ :","\\begin{cases} #? \\\\ #? \\end{cases}"],["[ ]","\\begin{pmatrix} #? & #? \\\\ #? & #? \\end{pmatrix}"],["ⁿCᵣ","\\binom{#?}{#?}"]]],
    ["Geometry & vectors", [["∠","\\angle "],["△","\\triangle "],["∥","\\parallel "],["⊥","\\perp "],["AB̄","\\overline{#?}"],["AB →","\\overrightarrow{#?}"],["vec v","\\vec{#?}"],["≅","\\cong "],["∼","\\sim "],["θ","\\theta "],["π","\\pi "]]],
    ["Sets & logic", [["∈","\\in "],["∉","\\notin "],["⊂","\\subset "],["⊆","\\subseteq "],["∪","\\cup "],["∩","\\cap "],["∅","\\varnothing "],["ℕ","\\mathbb{N}"],["ℤ","\\mathbb{Z}"],["ℚ","\\mathbb{Q}"],["ℝ","\\mathbb{R}"],["⇒","\\Rightarrow "],["⟺","\\Leftrightarrow "],["∀","\\forall "],["∃","\\exists "]]],
    ["Greek", [["α","\\alpha "],["β","\\beta "],["γ","\\gamma "],["δ","\\delta "],["Δ","\\Delta "],["ε","\\varepsilon "],["λ","\\lambda "],["μ","\\mu "],["ρ","\\rho "],["σ","\\sigma "],["τ","\\tau "],["φ","\\varphi "],["ω","\\omega "],["Ω","\\Omega "]]],
    ["Biology", [["µm","\\,\\mu\\mathrm{m}"],["nm","\\,\\mathrm{nm}"],["°C","\\,^{\\circ}\\mathrm{C}"],["→","\\rightarrow "],["⇌","\\rightleftharpoons "],["× cross","\\times "],["CO₂","\\ce{CO2}"],["O₂","\\ce{O2}"],["H₂O","\\ce{H2O}"],["C₆H₁₂O₆","\\ce{C6H12O6}"],["ATP","\\mathrm{ATP}"],["Aa","\\mathit{#?}\\mathit{#?}"],["XᴬXᵃ","X^{#?}X^{#?}"],["%","\\%"],["ratio","#?:#?"]]],
    ["Physics & units", [["unit","\\,\\mathrm{#?}"],["m/s²","\\,\\mathrm{m/s^2}"],["×10ⁿ","\\times 10^{#?}"],["x̄","\\bar{#?}"],["ẋ","\\dot{#?}"],["ħ","\\hbar "],["⟨ ⟩","\\langle #?\\rangle "],["⇌","\\rightleftharpoons "],["Å","\\text{Å}"]]]
  ],
  chem: [
    ["Arrows", [["→"," -> "],["⇌"," <=> "],["←"," <- "],["→ (heat)"," ->[\\Delta] "],["→ (cat.)"," ->[catalyst] "]]],
    ["Charges & states", [["ion +","^+"],["ion −","^-"],["²⁺","^{2+}"],["²⁻","^{2-}"],["(aq)","(aq)"],["(s)","(s)"],["(l)","(l)"],["(g)","(g)"],["gas ↑"," ^"],["ppt ↓"," v"]]],
    ["Other", [["· hydrate","*"],["isotope","^{14}_{6}C"],["e⁻","e-"],["+"," + "]]]
  ]
};
const eq = { target: null, sel: null, tab: "visual", mf: null };
let lastTA = null;
document.addEventListener("focusout", e => {
  const t = e.target;
  if(t && t.matches && t.matches('.card textarea[data-f=text], .card textarea[data-f=answer], .card textarea[data-sub]'))
    lastTA = { id: t.closest(".card").dataset.id, f: t.dataset.f || t.dataset.sf, sid: t.dataset.sub || null, s: t.selectionStart, e: t.selectionEnd };
});
function buildPalette(){
  const set = eq.tab === "chem" ? PAL.chem : PAL.maths;
  $("#eqPal").innerHTML = set.map(([g, items], gi) => `<div class="grp"><span>${g}</span>${items.map(([l, t], i) => `<button type="button" data-g="${gi}" data-i="${i}" title="${esc(t.replace(/#[?@]/g, "□"))}">${esc(l)}</button>`).join("")}</div>`).join("");
}
$("#eqPal").addEventListener("mousedown", e => e.preventDefault()); // keep focus/caret
$("#eqPal").addEventListener("click", e => {
  const b = e.target.closest("button[data-g]"); if(!b) return;
  const set = eq.tab === "chem" ? PAL.chem : PAL.maths;
  const snip = set[+b.dataset.g][1][+b.dataset.i][1];
  if(eq.tab === "visual" && eq.mf){ eq.mf.insert(snip, { selectionMode: "placeholder", focus: true }); eqPreview(); return; }
  const el = eq.tab === "chem" ? $("#eqCe") : $("#eqTex");
  const txt = snip.replace(/#@/g, "");
  const first = txt.indexOf("#?");
  const clean = txt.replace(/#\?/g, "");
  const s0 = el.selectionStart ?? el.value.length, e0 = el.selectionEnd ?? el.value.length;
  el.setRangeText(clean, s0, e0, "end");
  if(first >= 0){ const p = s0 + first; el.setSelectionRange(p, p); }
  el.focus(); eqPreview();
});
// remove \colorbox{…}{…} wrappers (keep their content) and stray text-mode $ signs
function cleanTex(t){
  t = String(t || "");
  for(let guard = 0; guard < 20; guard++){
    const k = t.indexOf("\\colorbox"); if(k < 0) break;
    let i = k + 9, depth = 0, a = -1, args = [];
    while(i < t.length && args.length < 2){
      const ch = t[i];
      if(ch === "{"){ if(depth === 0) a = i + 1; depth++; }
      else if(ch === "}"){ depth--; if(depth === 0){ args.push(t.slice(a, i)); } }
      else if(depth === 0 && !/\s/.test(ch)) break;
      i++;
    }
    if(args.length < 2) break;
    t = t.slice(0, k) + args[1] + t.slice(i);
  }
  return t.replace(/(^|[^\\])\$/g, "$1").replace(/\s+/g, " ").trim();
}
function eqTex(){
  if(eq.tab === "visual") return eq.mf ? cleanTex(String(eq.mf.getValue ? eq.mf.getValue("latex") : eq.mf.value).replace(/\\placeholder(\[[^\]]*\])?\{\}/g, "\\square")) : "";
  if(eq.tab === "latex") return $("#eqTex").value.trim();
  const v = $("#eqCe").value.trim(); return v ? "\\ce{" + v + "}" : "";
}
function eqSetTab(t, carry){
  const prev = carry ? eqTex() : null;
  eq.tab = t; setSeg($("#eqTabs"), t);
  $("#eqVisual").classList.toggle("hidden", t !== "visual");
  $("#eqLatex").classList.toggle("hidden", t !== "latex");
  $("#eqChem").classList.toggle("hidden", t !== "chem");
  if(prev != null){
    const ce = prev.match(/^\\ce\{([\s\S]*)\}$/);
    if(t === "latex") $("#eqTex").value = prev;
    else if(t === "chem") $("#eqCe").value = ce ? ce[1] : $("#eqCe").value;
    else if(t === "visual" && eq.mf && !ce) eq.mf.value = prev;
  }
  if(window.mathVirtualKeyboard && t !== "visual") try{ mathVirtualKeyboard.hide(); }catch(e){}
  buildPalette(); eqPreview();
  setTimeout(() => { if(t === "visual" && eq.mf) eq.mf.focus(); else (t === "chem" ? $("#eqCe") : $("#eqTex")).focus(); }, 30);
}
function eqPreview(){
  const tex = eqTex();
  $("#eqCode").textContent = tex ? (document.querySelector('input[name=eqMode]:checked').value === "display" ? "$$" + tex + "$$" : "$" + tex + "$") : "";
  if(!tex){ $("#eqPrev").innerHTML = '<span class="hint">Your equation will appear here</span>'; return; }
  const m = texSVG(tex, true);
  $("#eqPrev").innerHTML = m.err ? `<span class="err" style="color:var(--danger);font-size:13px">⚠ ${esc(m.errMsg)}</span>` : m.svg;
}
function ensureMF(){
  let mf = document.getElementById("mf");
  if(!mf && window.customElements && customElements.get("math-field")){
    mf = document.createElement("math-field"); mf.id = "mf";
    mf.setAttribute("math-virtual-keyboard-policy", "manual");
    $("#mfHost").appendChild(mf);
    mf.addEventListener("input", eqPreview);
    try{ mf.menuItems = mf.menuItems.filter(m => m.id !== "background-color"); }catch(e){}
  }
  return mf;
}
// read/write the text box an equation goes into
function tfSel(id, t){ return t && t.sid ? `.card[data-id="${id}"] textarea[data-sub="${t.sid}"][data-sf="${t.f}"]` : `.card[data-id="${id}"] textarea[data-f="${(t && t.f) || "text"}"]`; }
function tfGet(it, t){ if(t && t.sid){ const sb = (it.subs || []).find(x => x.id === t.sid); return sb ? (sb[t.f] || "") : ""; } return it[(t && t.f) || "text"] || ""; }
function tfSet(it, t, v){ if(t && t.sid){ const sb = (it.subs || []).find(x => x.id === t.sid); if(sb) sb[t.f] = v; } else it[(t && t.f) || "text"] = v; }
function openEq(targetId){
  eq.mf = ensureMF();
  // where will it go?
  eq.target = null; eq.sel = null; eq.tf = null;
  let ta = null;
  if(targetId){
    eq.target = targetId;
    if(lastTA && lastTA.id === targetId){ eq.tf = lastTA.f ? { f: lastTA.f, sid: lastTA.sid } : null; eq.sel = [lastTA.s, lastTA.e]; ta = document.querySelector(tfSel(targetId, eq.tf)); }
    else { ta = document.querySelector(tfSel(targetId, null)); eq.sel = ta ? [ta.value.length, ta.value.length] : null; }
  }else if(lastTA && S.items.some(x => x.id === lastTA.id)){
    eq.target = lastTA.id; eq.tf = lastTA.f ? { f: lastTA.f, sid: lastTA.sid } : null; eq.sel = [lastTA.s, lastTA.e]; ta = document.querySelector(tfSel(lastTA.id, eq.tf));
  }
  // editing an existing equation?
  let pre = "", disp = false;
  if(ta && eq.sel && eq.sel[1] > eq.sel[0]){
    const m = ta.value.slice(eq.sel[0], eq.sel[1]).match(/^\s*(\$\$?)([\s\S]+?)\1\s*$/);
    if(m){ pre = m[2].trim(); disp = m[1] === "$$"; }
  }
  document.querySelector(`input[name=eqMode][value=${disp ? "display" : "inline"}]`).checked = true;
  const ce = pre.match(/^\\ce\{([\s\S]*)\}$/);
  $("#eqTex").value = pre; $("#eqCe").value = ce ? ce[1] : "";
  if(eq.mf){ try{ eq.mf.value = ce ? "" : pre; }catch(e){} }
  $("#eqInsert").textContent = pre ? "Update equation" : (eq.target ? "Insert equation" : "Add as new question");
  openModal("#eqModal");
  eqSetTab(ce ? "chem" : (eq.mf && window.MathfieldElement ? "visual" : "latex"));
}
function insertEq(){
  const tex = eqTex(); if(!tex){ toast("Build an equation first"); return; }
  const disp = document.querySelector('input[name=eqMode]:checked').value === "display";
  const it = eq.target && S.items.find(x => x.id === eq.target);
  if(it){
    const v = tfGet(it, eq.tf); const [a, b] = eq.sel || [v.length, v.length];
    let ins = disp ? "$$" + tex + "$$" : "$" + tex + "$";
    if(disp){ if(a > 0 && v[a - 1] !== "\n") ins = "\n" + ins; if(b < v.length && v[b] !== "\n") ins += "\n"; }
    else { if(a > 0 && !/\s/.test(v[a - 1])) ins = " " + ins; }
    tfSet(it, eq.tf, v.slice(0, a) + ins + v.slice(b));
    lastTA = { id: it.id, f: eq.tf ? eq.tf.f : "text", sid: eq.tf ? eq.tf.sid : null, s: a + ins.length, e: a + ins.length };
  }else{
    S.items.push({ id: nid(), type: "q", text: disp ? "$$" + tex + "$$" : "$" + tex + "$", marks: "", lines: "", img: null });
  }
  closeEq(); render(); changed();
  const card = document.querySelector(`.card[data-id="${it ? it.id : S.items[S.items.length - 1].id}"]`);
  if(card){ card.scrollIntoView({ behavior: "smooth", block: "center" }); }
}
/* ✕ Close keyboard: a button on the top edge of the maths keyboard, whatever tab is showing */
function kbCloseButton(){
  const K = window.mathVirtualKeyboard; if(!K || document.getElementById("kbClose")) return;
  const b = document.createElement("button"); b.id = "kbClose"; b.type = "button"; b.textContent = "✕ Close keyboard"; b.title = "Close the maths keyboard";
  b.style.cssText = "position:fixed;right:14px;z-index:2147482000;display:none;font:600 13px system-ui,sans-serif;padding:6px 12px;border-radius:9px 9px 0 0;border:1px solid #c9c2b3;border-bottom:0;background:#fff;color:#2a2620;cursor:pointer;box-shadow:0 -2px 8px rgba(0,0,0,.12)";
  b.addEventListener("pointerdown", e => e.preventDefault());       // keep the maths box focused
  b.addEventListener("click", () => { try{ K.hide(); }catch(_){} });
  document.body.appendChild(b);
  const place = () => {
    const h = K.visible ? (K.boundingRect && K.boundingRect.height) || 0 : 0;
    b.style.display = h > 0 ? "block" : "none"; b.style.bottom = h + "px";
    document.body.style.setProperty("--kbh", h + "px");
  };
  K.addEventListener("geometrychange", place); K.addEventListener("virtual-keyboard-toggle", place);
  setInterval(place, 700);           // the keyboard sometimes changes without telling anyone
}
if(document.readyState !== "loading") setTimeout(kbCloseButton, 500); else document.addEventListener("DOMContentLoaded", () => setTimeout(kbCloseButton, 500));
function closeEq(){ $("#eqModal").classList.remove("open"); if(window.mathVirtualKeyboard) try{ mathVirtualKeyboard.hide(); }catch(e){} }
$("#eqTabs").addEventListener("click", e => { const b = e.target.closest("button"); if(b) eqSetTab(b.dataset.m, true); });
$("#eqTex").addEventListener("input", eqPreview);
$("#eqCe").addEventListener("input", eqPreview);
document.querySelectorAll("input[name=eqMode]").forEach(r => r.addEventListener("change", eqPreview));
$("#eqInsert").onclick = insertEq;
$("#kbToggle").onclick = () => { const k = window.mathVirtualKeyboard; if(!k) return; eq.mf.focus(); k.visible ? k.hide() : k.show(); };
$("#eqGlobal").onclick = () => openEq(null);
$("#eqModal").addEventListener("click", e => { if(e.target.hasAttribute && e.target.hasAttribute("data-close")) closeEq(); }, true);

/* ---------------- graph tool ---------------- */
const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  sec: x => 1 / Math.cos(x), csc: x => 1 / Math.sin(x), cot: x => 1 / Math.tan(x), sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, ln: Math.log, log: Math.log10,
  exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round };
const CONST = { pi: Math.PI, "π": Math.PI, e: Math.E };
function compileExpr(src){
  src = src.replace(/[−–]/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/²/g, "^2").replace(/³/g, "^3").replace(/√/g, "sqrt");
  const names = Object.keys(FN).concat(["pi", "x", "e", "π"]).sort((a, b) => b.length - a.length);
  const toks = [];
  for(let i = 0; i < src.length;){
    const c = src[i];
    if(/\s/.test(c)){ i++; continue; }
    const nm = src.slice(i).match(/^\d*\.?\d+(?:e[+-]?\d+)?/i);
    if(nm && /[\d.]/.test(c)){ toks.push({ k: "n", v: parseFloat(nm[0]) }); i += nm[0].length; continue; }
    if(/[a-zπ]/i.test(c)){
      const rest = src.slice(i).toLowerCase(); const n = names.find(n => rest.startsWith(n));
      if(!n) throw new Error("Unknown name “" + src.slice(i).match(/^[a-zπ]+/i)[0] + "” — only x is allowed as the variable");
      toks.push(FN[n] ? { k: "f", v: n } : n === "x" ? { k: "x" } : { k: "n", v: CONST[n] }); i += n.length; continue;
    }
    if("+-*/^(),".includes(c)){ toks.push({ k: c }); i++; continue; }
    throw new Error("Unexpected “" + c + "”");
  }
  // implicit multiplication: 2x, 3(…), x(…), )(, )x, 2sin(x)
  const t2 = [];
  toks.forEach((t, i) => { const p = toks[i - 1]; if(p && (p.k === "n" || p.k === "x" || p.k === ")") && (t.k === "n" || t.k === "x" || t.k === "(" || t.k === "f")) t2.push({ k: "*" }); t2.push(t); });
  let p = 0;
  const peek = () => t2[p], eat = k => { if(!t2[p] || t2[p].k !== k) throw new Error("Check the brackets / operators"); return t2[p++]; };
  function expr(){ let a = term(); while(peek() && (peek().k === "+" || peek().k === "-")){ const o = t2[p++].k, b = term(), A = a; a = o === "+" ? x => A(x) + b(x) : x => A(x) - b(x); } return a; }
  function term(){ let a = unary(); while(peek() && (peek().k === "*" || peek().k === "/")){ const o = t2[p++].k, b = unary(), A = a; a = o === "*" ? x => A(x) * b(x) : x => A(x) / b(x); } return a; }
  function unary(){ if(peek() && peek().k === "-"){ p++; const a = unary(); return x => -a(x); } if(peek() && peek().k === "+"){ p++; return unary(); } return power(); }
  function power(){ const a = primary(); if(peek() && peek().k === "^"){ p++; const b = unary(); return x => { const B = b(x), A = a(x); if(A < 0 && Number.isFinite(B)){ const r = Math.round(1 / B); if(Math.abs(1 / B - r) < 1e-9 && r % 2) return -Math.pow(-A, B); } return Math.pow(A, B); }; } return a; }
  function primary(){
    const t = t2[p++]; if(!t) throw new Error("The expression ends too early");
    if(t.k === "n"){ const v = t.v; return () => v; }
    if(t.k === "x") return x => x;
    if(t.k === "("){ const a = expr(); eat(")"); return a; }
    if(t.k === "f"){ const f = FN[t.v]; let a; if(peek() && peek().k === "("){ p++; a = expr(); eat(")"); } else a = power(); return x => f(a(x)); }
    throw new Error("Unexpected “" + t.k + "”");
  }
  const f = expr(); if(p < t2.length) throw new Error("Couldn't understand the end of “" + src + "”");
  return f;
}
function niceStep(range){ const raw = range / 10, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
function prettyLabel(s){ return s.replace(/\^2(?![\d.])/g, "²").replace(/\^3(?![\d.])/g, "³").replace(/\*/g, "·").replace(/sqrt/g, "√").replace(/pi/g, "π"); }
let graphTarget = null;
function graphCfg(){
  return { funcs: $("#gFuncs").value, x0: num($("#gX0").value), x1: num($("#gX1").value), y0: num($("#gY0").value), y1: num($("#gY1").value),
    step: $("#gStep").value, shape: $("#gShape").value, xl: $("#gXL").value, yl: $("#gYL").value,
    grid: $("#gGrid").checked, fine: $("#gFine").checked, nums: $("#gNums").checked, labels: $("#gLabels").checked };
}
function setGraphCfg(g){
  $("#gFuncs").value = g.funcs || ""; $("#gX0").value = g.x0 ?? -5; $("#gX1").value = g.x1 ?? 5; $("#gY0").value = g.y0 ?? -5; $("#gY1").value = g.y1 ?? 5;
  $("#gStep").value = g.step || ""; $("#gShape").value = g.shape || "square"; $("#gXL").value = g.xl ?? "x"; $("#gYL").value = g.yl ?? "y";
  $("#gGrid").checked = g.grid !== false; $("#gFine").checked = !!g.fine; $("#gNums").checked = g.nums !== false; $("#gLabels").checked = g.labels !== false;
}
function drawGraph(cv, g){
  const W = 1600, H = g.shape === "wide" ? 1000 : g.shape === "tall" ? 2000 : 1600;
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  let { x0, x1, y0, y1 } = g;
  if(!(x1 > x0)) throw new Error("“x to” must be bigger than “x from”");
  if(!(y1 > y0)) throw new Error("“y to” must be bigger than “y from”");
  const m = { l: 70, r: 70, t: 70, b: 70 };
  const X = x => m.l + (x - x0) / (x1 - x0) * (W - m.l - m.r);
  const Y = y => H - m.b - (y - y0) / (y1 - y0) * (H - m.t - m.b);
  const sx = num(g.step) > 0 ? num(g.step) : niceStep(x1 - x0), sy = num(g.step) > 0 ? num(g.step) : niceStep(y1 - y0);
  const ink = "#1E1B16";
  const gridLines = (st, col, lw) => {
    c.strokeStyle = col; c.lineWidth = lw; c.beginPath();
    for(let v = Math.ceil(x0 / st) * st; v <= x1 + 1e-9; v += st){ c.moveTo(X(v), Y(y0)); c.lineTo(X(v), Y(y1)); }
    for(let v = Math.ceil(y0 / st) * st; v <= y1 + 1e-9; v += st){ c.moveTo(X(x0), Y(v)); c.lineTo(X(x1), Y(v)); }
    c.stroke();
  };
  if(g.fine){ gridLines(Math.min(sx, sy) / 5, "#ECE7DD", 1.5); }
  if(g.grid){ c.strokeStyle = "#CFC8BA"; c.lineWidth = 2; c.beginPath();
    for(let v = Math.ceil(x0 / sx) * sx; v <= x1 + 1e-9; v += sx){ c.moveTo(X(v), Y(y0)); c.lineTo(X(v), Y(y1)); }
    for(let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy){ c.moveTo(X(x0), Y(v)); c.lineTo(X(x1), Y(v)); }
    c.stroke(); }
  // axes
  const ax = (y0 <= 0 && y1 >= 0) ? 0 : y0, ay = (x0 <= 0 && x1 >= 0) ? 0 : x0;
  c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 4;
  c.beginPath(); c.moveTo(X(x0) - 20, Y(ax)); c.lineTo(X(x1) + 30, Y(ax)); c.moveTo(X(ay), Y(y0) + 20); c.lineTo(X(ay), Y(y1) - 30); c.stroke();
  const arrow = (x, y, dx, dy) => { c.beginPath(); c.moveTo(x + dx * 22, y + dy * 22); c.lineTo(x - dy * 11, y + dx * 11); c.lineTo(x + dy * 11, y - dx * 11); c.closePath(); c.fill(); };
  arrow(X(x1) + 30, Y(ax), 1, 0); arrow(X(ay), Y(y1) - 30, 0, -1);
  c.font = "italic 56px 'Times New Roman', serif"; c.textBaseline = "middle";
  if(g.xl){ c.textAlign = "right"; c.fillText(g.xl, W - 6, Y(ax) - 34); }
  if(g.yl){ c.textAlign = "left"; c.fillText(g.yl, X(ay) + 26, 40); }
  if(g.nums){
    c.font = "40px Arial, Helvetica, sans-serif"; const f = v => (+v.toFixed(6) + "").replace("-", "−");
    c.textAlign = "center"; c.textBaseline = "top";
    for(let v = Math.ceil(x0 / sx) * sx; v <= x1 + 1e-9; v += sx){ if(Math.abs(v - ay) < 1e-9) continue; c.beginPath(); c.moveTo(X(v), Y(ax) - 9); c.lineTo(X(v), Y(ax) + 9); c.stroke(); c.fillText(f(v), X(v), Y(ax) + 14); }
    c.textAlign = "right"; c.textBaseline = "middle";
    for(let v = Math.ceil(y0 / sy) * sy; v <= y1 + 1e-9; v += sy){ if(Math.abs(v - ax) < 1e-9) continue; c.beginPath(); c.moveTo(X(ay) - 9, Y(v)); c.lineTo(X(ay) + 9, Y(v)); c.stroke(); c.fillText(f(v), X(ay) - 16, Y(v)); }
    if(ax === 0 && ay === 0){ c.textAlign = "right"; c.textBaseline = "top"; c.fillText("O", X(0) - 12, Y(0) + 10); }
  }
  // functions, lines, points
  const dashes = [[], [26, 14], [6, 12], [30, 10, 6, 10]];
  let fi = 0;
  c.save(); c.beginPath(); c.rect(m.l - 2, m.t - 2, W - m.l - m.r + 4, H - m.t - m.b + 4); c.clip();
  const labels = [], points = [];
  for(const raw of g.funcs.split("\n")){
    const line = raw.trim(); if(!line) continue;
    const pt = line.match(/^\(\s*(-?[\d.]+)\s*[,;]\s*(-?[\d.]+)\s*\)\s*(.*)$/);
    if(pt){ points.push([+pt[1], +pt[2], pt[3]]); continue; }
    const vx = line.match(/^x\s*=\s*(-?[\d.]+)\s*$/i);
    c.setLineDash(dashes[fi % dashes.length]); c.lineWidth = 5; c.strokeStyle = ink;
    if(vx){ const v = +vx[1]; c.beginPath(); c.moveTo(X(v), Y(y0)); c.lineTo(X(v), Y(y1)); c.stroke(); if(g.labels) labels.push(["x = " + v, X(v) + 12, m.t + 30, "left"]); fi++; continue; }
    const exprSrc = line.replace(/^(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\)|h\s*\(\s*x\s*\))\s*=\s*/i, "");
    let f; try{ f = compileExpr(exprSrc); }catch(e){ throw new Error(line + ": " + e.message); }
    c.beginPath(); let pen = false, last = null, lastPt = null;
    const N = 1600, span = (y1 - y0);
    for(let i = 0; i <= N; i++){
      const x = x0 + (x1 - x0) * i / N, y = f(x);
      if(!Number.isFinite(y) || (last != null && Math.abs(y - last) > span * 3)){ pen = false; last = Number.isFinite(y) ? y : null; continue; }
      if(!pen){ c.moveTo(X(x), Y(y)); pen = true; } else c.lineTo(X(x), Y(y));
      last = y; if(y >= y0 && y <= y1) lastPt = [X(x), Y(y)];
    }
    c.stroke();
    if(g.labels && lastPt) labels.push([(/^\w\s*\(|^y\s*=/i.test(line) ? "" : "y = ") + prettyLabel(line.replace(/\s+/g, " ")), Math.min(lastPt[0], W - m.r - 10), Math.max(m.t + 24, Math.min(H - m.b - 24, lastPt[1] - 26)), "right"]);
    fi++;
  }
  c.restore(); c.setLineDash([]);
  c.font = "italic 46px 'Times New Roman', serif"; c.textBaseline = "middle";
  const boxes = [];
  labels.forEach(([t, x, y, al]) => {
    const w = c.measureText(t).width; let bx = al === "right" ? x - w : x;
    if(bx < m.l + 4){ bx = m.l + 4; } if(bx + w > W - 8) bx = W - 8 - w;
    let tries = 0; const hit = () => boxes.some(b => bx < b[0] + b[2] && bx + w > b[0] && y - 26 < b[1] + 52 && y + 26 > b[1]);
    while(hit() && tries++ < 30) y += 56;
    boxes.push([bx, y - 26, w]);
    c.textAlign = "left"; c.lineWidth = 12; c.strokeStyle = "#fff"; c.strokeText(t, bx, y); c.fillStyle = ink; c.fillText(t, bx, y);
  });
  points.forEach(([px, py, lab]) => {
    c.fillStyle = ink; c.beginPath(); c.arc(X(px), Y(py), 10, 0, 7); c.fill();
    if(lab){ c.font = "italic 50px 'Times New Roman', serif"; c.textAlign = "left"; c.lineWidth = 10; c.strokeStyle = "#fff"; c.strokeText(lab, X(px) + 16, Y(py) - 22); c.fillText(lab, X(px) + 16, Y(py) - 22); }
  });
}
function graphPreview(){
  try{ drawGraph($("#gCanvas"), graphCfg()); $("#gErr").textContent = ""; return true; }
  catch(e){ $("#gErr").textContent = "⚠ " + e.message; return false; }
}
let graphPic = null;   // editing a graph that sits inside the text
function openGraph(targetId, picId){
  graphTarget = targetId || null; graphPic = picId || null;
  const it = targetId && S.items.find(x => x.id === targetId);
  const P = picId && picData(picId);
  setGraphCfg(P && P.graph ? P.graph : it && it.graph ? it.graph : { funcs: "" });
  $("#gInsert").textContent = P ? "Update graph" : it && it.graph ? "Update graph" : it ? "Insert graph here" : "Add as new question";
  openModal("#graphModal"); graphPreview();
}
["gFuncs", "gX0", "gX1", "gY0", "gY1", "gStep", "gShape", "gXL", "gYL", "gGrid", "gFine", "gNums", "gLabels"].forEach(id => {
  const el = document.getElementById(id); el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input", () => { clearTimeout(el._t); el._t = setTimeout(graphPreview, 150); });
});
$("#gInsert").onclick = () => {
  if(!graphPreview()) return;
  const g = graphCfg(), cv = $("#gCanvas");
  const img = { src: cv.toDataURL("image/png"), w: cv.width, h: cv.height };
  const size = g.shape === "wide" ? 85 : g.shape === "tall" ? 55 : 65;
  let it = graphTarget && S.items.find(x => x.id === graphTarget);
  if(graphPic){
    // update a graph inside the text, wherever it is
    const own = S.items.find(x => x.pics && x.pics[graphPic]); if(own){ own.pics = Object.assign({}, own.pics, { [graphPic]: Object.assign(img, { graph: g }) }); it = own; }
  }else if(it && it.graph){ it.img = img; it.graph = g; }                     // older exams: the graph is the question's picture
  else if(it){
    const id = "g" + nid().replace(/\W/g, "").slice(-6);
    it.pics = Object.assign({}, it.pics, { [id]: Object.assign(img, { graph: g }) });
    insertBlockAt(it, "{img: " + id + " | " + size + "% | center}");
  }
  else { it = { id: nid(), type: "q", text: "", marks: "", lines: "", img, imgSize: size, imgAlign: "center", graph: g }; S.items.push(it); }
  $("#graphModal").classList.remove("open"); render(); changed();
  const card = document.querySelector(`.card[data-id="${it.id}"]`); if(card) card.scrollIntoView({ behavior: "smooth", block: "center" });
};
$("#graphGlobal").onclick = () => openGraph(null);
