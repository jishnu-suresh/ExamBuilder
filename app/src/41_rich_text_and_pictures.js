/* ---------------- rich text: Markdown + LaTeX ---------------- */
const OPT_LINE = /^\s*(?:\(?[a-hA-H]\)|[a-hA-H][\.\)]|\(?(?:i|ii|iii|iv|v|vi|vii|viii)\))(?:\s+|$)/;
const OPT_LETTER = /^\s*\(?([a-hA-H])[\).]\s*/;
const LETTERS = "abcdefghijklmnop";
// question text as printed: stem + MCQ options
function qText(it, key){
  if(!it || !Array.isArray(it.options) || !it.options.length) return (it && it.text) || "";
  const cor = new Set(it.correct || []);
  const opts = it.options.map((o, i) => [o, i]).filter(([o]) => String(o || "").trim());
  if(!opts.length) return it.text || "";
  return (it.text || "").replace(/\s+$/, "") + "\n" + opts.map(([o, i], k) => {
    const L = LETTERS[k].toUpperCase() + ". ";
    return key && cor.has(i) ? "{color:#C0392B}**" + L + o + "  ✓**{/color}" : L + o;
  }).join("\n");
}
// marks of a question: the sum of its sub-questions when they carry marks
function qMarks(it){
  if(it && Array.isArray(it.subs) && it.subs.some(sb => num(sb.marks) > 0)) return it.subs.reduce((a, sb) => a + num(sb.marks), 0);
  return num(it && it.marks);
}
// pull "a) … b) …" lines out of the text into separate options
function extractOptions(it){
  const keep = [], opts = [];
  const cor = [];
  String(it.text || "").split("\n").forEach(l => {
    if(OPT_LETTER.test(l) && /^\s*\(?[a-hA-H][\).](\s|$)/.test(l)){
      let o = l.replace(OPT_LETTER, "").trim();
      // "{correct}", "(correct)", "[correct]" or a trailing ✓ marks the right answer
      if(/\{\s*correct\s*\}|\((?:correct)\)|\[(?:correct)\]|\s*[✓✔]\s*$/i.test(o)){ cor.push(opts.length); o = o.replace(/\s*(\{\s*correct\s*\}|\(correct\)|\[correct\]|[✓✔])\s*/ig, " ").trim(); }
      opts.push(o);
    } else keep.push(l);
  });
  it.text = keep.join("\n").replace(/\s+$/, "");
  it.options = opts.length ? opts : ["", "", "", ""];
  if(cor.length) it.correct = cor;
}
function ensureOptions(it){ if(it.type === "q" && it.mcq && !Array.isArray(it.options)) extractOptions(it); }
const RE_COLOR_OPEN = /^\{color:\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\s*\}/;
function mathColor(tex, col){ return col ? "{\\color{" + col + "}" + tex + "}" : tex; }
// One scanner for inline Markdown + maths, shared by the PDF/preview renderer and the B/I/U/colour buttons.
// Returns content units (characters or whole maths pieces), each with the style in force.
function scanInline(s){
  const units = []; let b = false, it = false, u = false, x = false; const cols = [];
  const st = () => ({ b, i: it, u, x, c: cols.length ? cols[cols.length - 1] : "" });
  for(let i = 0; i < s.length;){
    const c = s[i], n = s[i + 1];
    if(c === "{"){
      const m = s.slice(i).match(RE_COLOR_OPEN);
      if(m){ cols.push(m[1]); i += m[0].length; continue; }
      if(s.startsWith("{/color}", i)){ cols.pop(); i += 8; continue; }
    }
    if(c === "+" && n === "+" && (u ? !/\s/.test(s[i - 1] || " ") : (s[i + 2] && !/[\s+]/.test(s[i + 2]) && s.indexOf("++", i + 3) > 0))){ u = !u; i += 2; continue; }
    if(c === "\\" && n === "$"){ units.push({ r: i, raw: "\\$", ch: "$", st: st() }); i += 2; continue; }
    if(c === "\\" && n === "("){ const j = s.indexOf("\\)", i + 2); if(j > 0){ units.push({ r: i, raw: s.slice(i, j + 2), math: s.slice(i + 2, j), st: st() }); i = j + 2; continue; } }
    if(c === "$" && n === "$"){ const j = s.indexOf("$$", i + 2); if(j > 0){ units.push({ r: i, raw: s.slice(i, j + 2), math: s.slice(i + 2, j), display: true, st: st() }); i = j + 2; continue; } }
    if(c === "$" && n && !/\s/.test(n)){
      let j = i + 1, found = -1;
      while((j = s.indexOf("$", j)) > 0){
        const body = s.slice(i + 1, j);
        // a space before the closing $ is fine when the content is clearly maths (\frac, ^, =, …) — "$5 and $10" stays text
        if(s[j - 1] !== "\\" && !/\d/.test(s[j + 1] || "") && (!/\s/.test(s[j - 1]) || /[\\^_{}=<>]/.test(body))){ found = j; break; }
        j++;
      }
      if(found > 0){ units.push({ r: i, raw: s.slice(i, found + 1), math: s.slice(i + 1, found).trim(), st: st() }); i = found + 1; continue; }
    }
    if(c === "*" && n === "*" && (b || s.indexOf("**", i + 2) > 0)){ b = !b; i += 2; continue; }
    if(c === "~" && n === "~" && (x || (s[i + 2] && !/\s/.test(s[i + 2]) && s.indexOf("~~", i + 3) > 0))){ x = !x; i += 2; continue; }
    if(c === "*" && (it ? !/\s/.test(s[i - 1] || " ") : (n && !/\s/.test(n) && /(^|[^\w])$/.test(s.slice(0, i)) && /[^\s]\*/.test(s.slice(i + 1))))){ it = !it; i++; continue; }
    units.push({ r: i, raw: c, ch: c, st: st() }); i++;
  }
  return units;
}
function parseInline(s, base){
  base = base || {};
  const runs = [];
  for(const un of scanInline(s)){
    const c = un.st.c || base.c || "";
    if(un.math != null){ runs.push({ t: "math", tex: mathColor(un.math, c), display: !!un.display }); continue; }
    const sty = { b: un.st.b || !!base.b, i: un.st.i || !!base.i, u: un.st.u || !!base.u, x: un.st.x || !!base.x, c };
    const last = runs[runs.length - 1];
    if(last && last.t === "text" && last.b === sty.b && last.i === sty.i && last.u === sty.u && last.x === sty.x && last.c === sty.c) last.s += un.ch;
    else runs.push(Object.assign({ t: "text", s: un.ch }, sty));
  }
  return runs;
}
// Write units back as canonical markers: colour ⊃ underline ⊃ bold ⊃ italic, markers hugging the words.
function serializeUnits(units){
  const LV = ["c", "u", "x", "b", "i"];
  const OPEN = { c: v => "{color:" + v + "}", u: () => "++", x: () => "~~", b: () => "**", i: () => "*" };
  const CLOSE = { c: "{/color}", u: "++", x: "~~", b: "**", i: "*" };
  const on = (st, k) => k === "c" ? !!st.c : !!st[k];
  const same = (p, q, k) => k === "c" ? (p.c || "") === (q.c || "") : !!p[k] === !!q[k];
  // a space between two words styled alike takes their style, so a phrase gets one pair of markers (**a b c**, not **a** **b** **c**)
  const eff = units.map(x => Object.assign({}, x.st));
  units.forEach((x, k) => {
    if(x.math != null || !/^\s$/.test(x.ch)) return;
    let p = k - 1; while(p >= 0 && units[p].math == null && /^\s$/.test(units[p].ch)) p--;
    let q = k + 1; while(q < units.length && units[q].math == null && /^\s$/.test(units[q].ch)) q++;
    const A = p >= 0 ? units[p].st : {}, B = q < units.length ? units[q].st : {};
    eff[k] = { b: !!(A.b && B.b), i: !!(A.i && B.i), u: !!(A.u && B.u && x.st.u), x: !!(A.x && B.x && x.st.x), c: (A.c && A.c === B.c && x.st.c === A.c) ? A.c : "" };
  });
  let out = "", cur = { b: false, i: false, u: false, x: false, c: "" };
  const pos = [];
  const trans = nx => {
    let k = LV.findIndex(L => !same(cur, nx, L)); if(k < 0) return;
    for(let j = LV.length - 1; j >= k; j--) if(on(cur, LV[j])) out += CLOSE[LV[j]];
    for(let j = k; j < LV.length; j++) if(on(nx, LV[j])) out += OPEN[LV[j]](nx.c);
    cur = Object.assign({}, nx);
  };
  units.forEach((x, k) => { trans(eff[k]); pos.push(out.length); out += x.raw; });
  trans({ b: false, i: false, u: false, x: false, c: "" });
  return { text: out, pos };
}
// Toggle a style on [a, e) of the raw text. Returns null when nothing (non-space) is selected.
function toggleFmtRange(text, a, e, key, val){
  const lines = text.split("\n"); let off = 0, touched = false, sel = [];
  const parsed = lines.map(l => { const r = { l, off, units: scanInline(l) }; off += l.length + 1; return r; });
  parsed.forEach(P => P.units.forEach(x => { const ra = P.off + x.r, rb = ra + x.raw.length; if(ra < e && rb > a && (x.math != null || !/^\s$/.test(x.ch))) sel.push(x); }));
  if(!sel.length) return null;
  let turnOn;
  if(key === "clear") turnOn = false;
  else if(key === "c") turnOn = !sel.every(x => x.st.c === val);
  else turnOn = !sel.every(x => x.st[key]);
  parsed.forEach(P => P.units.forEach(x => {
    const ra = P.off + x.r, rb = ra + x.raw.length; if(!(ra < e && rb > a)) return;
    if(key === "clear") x.st = { b: false, i: false, u: false, x: false, c: "" };
    else if(key === "c") x.st.c = turnOn ? val : "";
    else x.st[key] = turnOn;
  }));
  // rebuild every line (also cleans up repeated/nested markers), tracking the new selection
  let na = null, ne = null, acc = 0;
  const outLines = parsed.map(P => {
    const R = serializeUnits(P.units);
    P.units.forEach((x, k) => { if(sel.includes(x)){ const p = acc + R.pos[k]; if(na === null) na = p; ne = p + x.raw.length; } });
    acc += R.text.length + 1; return R.text;
  });
  return { text: outLines.join("\n"), a: na, e: ne, on: turnOn };
}
// style of the current selection (for lighting up the buttons)
function selStyle(text, a, e){
  const lines = text.split("\n"); let off = 0; const sel = [];
  lines.forEach(l => { scanInline(l).forEach(x => { const ra = off + x.r; if(ra < e && ra + x.raw.length > a && (x.math != null || !/^\s$/.test(x.ch))) sel.push(x); }); off += l.length + 1; });
  if(!sel.length) return null;
  const c0 = sel[0].st.c;
  return { b: sel.every(x => x.st.b), i: sel.every(x => x.st.i), u: sel.every(x => x.st.u), x: sel.every(x => x.st.x), c: sel.every(x => x.st.c === c0) ? c0 : "" };
}
const RE_ALIGN = /^\s*\{(center|centre|right|left|justify)\}\s*/i;
const SIZES = ["small", "", "big", "bigger", "huge"], SIZE_K = { small: .85, big: 1.2, bigger: 1.45, huge: 1.75 };
const RE_PRE = /^\s*\{(center|centre|right|left|justify|small|big|bigger|huge)\}\s*/i;
function linePre(l){ let align = "", size = "", rest = String(l); for(let m; (m = rest.match(RE_PRE));){ const t = m[1].toLowerCase().replace("centre", "center"); if(SIZE_K[t]) size = t; else align = t; rest = rest.slice(m[0].length); } return { align, size, rest }; }
const buildLine = (align, size, rest) => (align ? "{" + align + "}" : "") + (size ? "{" + size + "}" : "") + rest;
// a picture placed inside the text:  {img: ID | 60% | center}
const RE_IMG = /^\s*(?:\{(?:center|centre|right|left|justify|small|big|bigger|huge)\}\s*)*\{\s*img\s*:\s*([\w-]+)\s*(?:\|\s*(\d{1,3})\s*%?\s*)?(?:\|\s*(left|center|centre|right)\s*)?\}\s*$/i;
// page hint in a placeholder: "[diagram: page 2 — ladder…]"
const pdfPage = d => { const m = String(d || "").match(/\bp(?:age|g|\.)?\s*(\d{1,3})\b/i); return m ? +m[1] : 0; };
// put a finished picture where it belongs: in place of the first [diagram] placeholder, or at the cursor
function placePicture(T, img, size){
  const it = S.items.find(x => x.id === T.id); if(!it) return;
  const id = "p" + nid().replace(/\W/g, "").slice(-6), tag = "{img: " + id + " | " + (size || 60) + "% | center}";
  it.pics = Object.assign({}, it.pics, { [id]: img });
  if(T.fill){
    const swap = t => { const L = String(t || "").split("\n"), k = L.findIndex(l => RE_PIC.test(l)); if(k < 0) return null; L[k] = tag; return L.join("\n"); };
    let done = swap(it.text); if(done != null) it.text = done; else { const sb = (it.subs || []).find(x => swap(x.text) != null); if(sb) sb.text = swap(sb.text); else it.text = (it.text ? it.text + "\n" : "") + tag; }
  }else{
    if(T.pos != null && T.tf) lastTA = { id: it.id, f: "text", sid: T.tf.sid, s: T.pos, e: T.pos }; else if(T.pos == null) lastTA = null;
    insertBlockAt(it, tag);
  }
  render(); changed(); focusItem(it.id);
}
/* ---------- 📄 cut a picture out of a PDF (works for drawn diagrams and scans alike) ---------- */
let PDFSRC = null, cutT = null, cutPage = 1, cutScale = 1, cutRect = null, cutZoom = 1;   // cutRect: {fx, fy, fw, fh} as parts of the page
async function loadPdfSource(file){
  if(!window.pdfjsLib) throw new Error("The PDF viewer isn't loaded");
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  PDFSRC = { name: file.name, doc };
  return PDFSRC;
}
async function openCut(T){
  cutT = T; cutRect = null; cutZoom = 1; $("#cutSel").classList.add("hidden"); $("#cutGo").disabled = true;
  openModal("#cutModal");
  if(!PDFSRC){ $("#cutName").textContent = "no PDF yet"; $("#cutPageLbl").textContent = "–"; const c = $("#cutCanvas"); c.width = 10; c.height = 10; $("#pdfSrcIn").click(); return; }
  $("#cutName").textContent = PDFSRC.name;
  cutPage = Math.min(Math.max(1, T.page || cutPage || 1), PDFSRC.doc.numPages);
  await drawCutPage();
}
async function drawCutPage(){
  if(!PDFSRC) return;
  const page = await PDFSRC.doc.getPage(cutPage), st = $("#cutStage");
  const base = page.getViewport({ scale: 1 }), fit = Math.min(1.6, (st.clientWidth - 20) / base.width);
  cutScale = fit * cutZoom; const vp = page.getViewport({ scale: cutScale * (window.devicePixelRatio || 1) });
  $("#cutZoomLbl").textContent = Math.round(cutZoom * 100) + "%";
  const c = $("#cutCanvas"); c.width = vp.width; c.height = vp.height; c.style.width = (base.width * cutScale) + "px"; c.style.height = (base.height * cutScale) + "px";
  await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  $("#cutPageLbl").textContent = "page " + cutPage + " of " + PDFSRC.doc.numPages;
  cutPaint();
}
// draw the selection box from its page fractions (works at any zoom)
function cutPaint(){
  const sel = $("#cutSel"), cv = $("#cutCanvas");
  if(!cutRect){ sel.classList.add("hidden"); $("#cutGo").disabled = true; return; }
  sel.style.left = (cv.offsetLeft + cutRect.fx * cv.clientWidth) + "px"; sel.style.top = (cv.offsetTop + cutRect.fy * cv.clientHeight) + "px";
  sel.style.width = (cutRect.fw * cv.clientWidth) + "px"; sel.style.height = (cutRect.fh * cv.clientHeight) + "px";
  sel.classList.remove("hidden"); $("#cutGo").disabled = !(cutRect.fw * cv.clientWidth > 8 && cutRect.fh * cv.clientHeight > 8);
}
async function cutSetZoom(z, keepCenter){
  const st = $("#cutStage"), cv = $("#cutCanvas");
  // keep the selection (or the middle of the view) in sight
  const cx = cutRect ? cutRect.fx + cutRect.fw / 2 : (st.scrollLeft + st.clientWidth / 2 - cv.offsetLeft) / Math.max(1, cv.clientWidth);
  const cy = cutRect ? cutRect.fy + cutRect.fh / 2 : (st.scrollTop + st.clientHeight / 2 - cv.offsetTop) / Math.max(1, cv.clientHeight);
  cutZoom = Math.max(.5, Math.min(4, z)); await drawCutPage();
  st.scrollLeft = cv.offsetLeft + cx * cv.clientWidth - st.clientWidth / 2; st.scrollTop = cv.offsetTop + cy * cv.clientHeight - st.clientHeight / 2;
}
document.getElementById("cutZoomIn").onclick = () => cutSetZoom(cutZoom * 1.25);
document.getElementById("cutZoomOut").onclick = () => cutSetZoom(cutZoom / 1.25);
document.getElementById("cutZoomFit").onclick = () => cutSetZoom(1);
document.getElementById("cutStage").addEventListener("wheel", e => { if(!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); cutSetZoom(cutZoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12)); }, { passive: false });
document.getElementById("pdfSrcIn").addEventListener("change", async e => {
  const f = e.target.files[0]; e.target.value = ""; if(!f) return;
  try{ await loadPdfSource(f); $("#cutName").textContent = f.name; if($("#cutModal").classList.contains("open")){ cutPage = Math.min(Math.max(1, (cutT && cutT.page) || 1), PDFSRC.doc.numPages); await drawCutPage(); } }
  catch(err){ toast("Couldn't open that PDF: " + (err.message || err)); }
});
document.getElementById("cutChoose").onclick = () => $("#pdfSrcIn").click();
document.getElementById("cutPrev").onclick = () => { if(PDFSRC && cutPage > 1){ cutPage--; cutRect = null; drawCutPage(); } };
document.getElementById("cutNext").onclick = () => { if(PDFSRC && cutPage < PDFSRC.doc.numPages){ cutPage++; cutRect = null; drawCutPage(); } };
(() => {
  const sel = document.getElementById("cutSel"), cv = document.getElementById("cutCanvas");
  let drag = null;   // {mode: "new" | "move" | handle, start point, rect at start}
  const P = e => { const r = cv.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)), y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)) }; };
  const begin = (e, mode) => { if(!PDFSRC) return; e.preventDefault(); e.stopPropagation(); const p = P(e);
    drag = { mode, p, r: cutRect ? Object.assign({}, cutRect) : { fx: p.x, fy: p.y, fw: 0, fh: 0 } };
    if(mode === "new") cutRect = { fx: p.x, fy: p.y, fw: 0, fh: 0 };
    (e.target.setPointerCapture ? e.target : cv).setPointerCapture(e.pointerId); cutPaint(); };
  cv.addEventListener("pointerdown", e => begin(e, "new"));
  sel.addEventListener("pointerdown", e => begin(e, e.target.dataset.h || "move"));
  const move = e => {
    if(!drag) return; const p = P(e), dx = p.x - drag.p.x, dy = p.y - drag.p.y, r0 = drag.r; let { fx, fy, fw, fh } = r0;
    if(drag.mode === "new"){ fx = Math.min(drag.p.x, p.x); fy = Math.min(drag.p.y, p.y); fw = Math.abs(p.x - drag.p.x); fh = Math.abs(p.y - drag.p.y); }
    else if(drag.mode === "move"){ fx = Math.max(0, Math.min(1 - fw, r0.fx + dx)); fy = Math.max(0, Math.min(1 - fh, r0.fy + dy)); }
    else{
      let x0 = r0.fx, y0 = r0.fy, x1 = r0.fx + r0.fw, y1 = r0.fy + r0.fh; const h = drag.mode;
      if(h.includes("w")) x0 = Math.min(x1 - .005, Math.max(0, r0.fx + dx)); if(h.includes("e")) x1 = Math.max(x0 + .005, Math.min(1, r0.fx + r0.fw + dx));
      if(h.includes("n")) y0 = Math.min(y1 - .005, Math.max(0, r0.fy + dy)); if(h.includes("s")) y1 = Math.max(y0 + .005, Math.min(1, r0.fy + r0.fh + dy));
      fx = x0; fy = y0; fw = x1 - x0; fh = y1 - y0;
    }
    cutRect = { fx, fy, fw, fh }; cutPaint();
  };
  const end = () => { if(drag && cutRect && (cutRect.fw * cv.clientWidth < 4 || cutRect.fh * cv.clientHeight < 4) && drag.mode === "new") cutRect = null; drag = null; cutPaint(); };
  [cv, sel].forEach(el => { el.addEventListener("pointermove", move); el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end); });
  sel.querySelectorAll("i").forEach(h => { h.addEventListener("pointermove", move); h.addEventListener("pointerup", end); });
})();
document.getElementById("cutGo").onclick = async () => {
  if(!PDFSRC || !cutRect || !cutT) return;
  const page = await PDFSRC.doc.getPage(cutPage), base = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: Math.max(4, cutScale * 3) });   // sharp, whatever the zoom
  const big = document.createElement("canvas"); big.width = vp.width; big.height = vp.height;
  await page.render({ canvasContext: big.getContext("2d"), viewport: vp }).promise;
  const out = document.createElement("canvas"); out.width = Math.round(cutRect.fw * big.width); out.height = Math.round(cutRect.fh * big.height);
  const g = out.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, out.width, out.height);
  g.drawImage(big, cutRect.fx * big.width, cutRect.fy * big.height, out.width, out.height, 0, 0, out.width, out.height);
  const size = Math.max(15, Math.min(100, Math.round(cutRect.fw * 100 / .8 / 5) * 5));   // about as big as on the PDF page (its text is ~80% of the page wide)
  $("#cutModal").classList.remove("open");
  placePicture(cutT, { src: out.toDataURL("image/png"), w: out.width, h: out.height }, size);
  toast("Picture cut from the PDF — resize or move it under the text");
};
/* ---------- ✏️ drawings the AI made as SVG:  {svg} <svg …>…</svg> {/svg} ---------- */
function cleanSvg(code){
  let t = String(code || "").trim().replace(/^```(?:svg|xml|html)?\s*/i, "").replace(/```\s*$/, "");
  const a = t.indexOf("<svg"), b = t.lastIndexOf("</svg>"); if(a < 0 || b < 0) return "";
  t = t.slice(a, b + 6)
    .replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "").replace(/(href\s*=\s*)("|')\s*(?!#)[^"']*\2/gi, "$1$2#$2");
  if(!/xmlns=/.test(t.slice(0, 200))) t = t.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  return t;
}
async function svgToImage(code){
  const svg = cleanSvg(code); if(!svg) throw new Error("No <svg> drawing found");
  let w = +(svg.match(/<svg[^>]*\swidth="([\d.]+)/) || [])[1], h = +(svg.match(/<svg[^>]*\sheight="([\d.]+)/) || [])[1];
  const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1]; if((!w || !h) && vb){ const v = vb.trim().split(/[\s,]+/).map(Number); w = v[2]; h = v[3]; }
  w = w || 300; h = h || 200;
  const sized = svg.replace(/<svg([^>]*)>/, (m, at) => "<svg" + at.replace(/\s(width|height)="[^"]*"/g, "") + ` width="${w}" height="${h}">`);
  const img = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(sized));
  const k = 4, c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);   // transparent: no box around it on the page
  return { src: c.toDataURL("image/png"), w: c.width, h: c.height, svg, sw: w };
}
const RE_SVGBLOCK = /(?:^|\n)[ \t]*\{svg\}[ \t]*\n([\s\S]*?)\n[ \t]*\{\/svg\}[ \t]*(?=\n|$)/gi;
// pasted AI text → drawings become pictures; a [diagram …] line right above a drawing is replaced by it
async function takeDrawings(raw){
  const pics = {}; let out = String(raw || "").replace(/\r\n?/g, "\n"), m, jobs = [];
  RE_SVGBLOCK.lastIndex = 0;
  while((m = RE_SVGBLOCK.exec(out))) jobs.push({ whole: m[0], code: m[1] });
  for(const j of jobs){
    const id = "d" + nid().replace(/\W/g, "").slice(-6);
    try{ const im = await svgToImage(j.code); pics[id] = im;
      const size = Math.max(25, Math.min(80, Math.round(im.sw / 6.8 / 5) * 5));
      out = out.replace(j.whole, (j.whole.startsWith("\n") ? "\n" : "") + "{img: " + id + " | " + size + "% | center}"); }
    catch(e){ out = out.replace(j.whole, ""); }
  }
  // drop a placeholder that sits directly above its drawing
  out = out.replace(/^[ \t]*\[\s*(?:diagram|image|picture|figure|graph|drawing|illustration)[^\]\n]*\][ \t]*\n(?=[ \t]*\{img: d)/gim, "");
  return { text: out, pics, n: jobs.length };
}
function attachPics(items, pics){
  const ids = Object.keys(pics); if(!ids.length) return;
  items.forEach(it => { const all = [it.text, it.answer].concat((it.subs || []).flatMap(sb => [sb.text, sb.answer])).join("\n");
    ids.forEach(id => { if(all.includes("{img: " + id)) it.pics = Object.assign({}, it.pics, { [id]: pics[id] }); }); });
}
let svgTarget = null;
function openSvgEdit(itemId, picId){
  const P = picData(picId); if(!P || !P.svg) return;
  svgTarget = { itemId, picId }; $("#svgCode").value = P.svg.replace(/></g, ">\n<"); $("#svgPrev").src = P.src; $("#svgErr").textContent = "";
  openModal("#svgModal");
}
document.getElementById("svgCode").addEventListener("input", () => { clearTimeout(openSvgEdit._t); openSvgEdit._t = setTimeout(async () => {
  try{ const im = await svgToImage($("#svgCode").value); $("#svgPrev").src = im.src; $("#svgErr").textContent = ""; }catch(e){ $("#svgErr").textContent = "⚠ " + (e.message || "This code doesn't draw"); }
}, 300); });
document.getElementById("svgGo").onclick = async () => {
  if(!svgTarget) return;
  try{ const im = await svgToImage($("#svgCode").value); const own = S.items.find(x => x.pics && x.pics[svgTarget.picId]);
    if(own){ own.pics = Object.assign({}, own.pics, { [svgTarget.picId]: im }); }
    $("#svgModal").classList.remove("open"); render(); changed(); toast("Drawing updated"); }
  catch(e){ toast("⚠ " + (e.message || "This code doesn't draw")); }
};
function picData(id){ for(const it of S.items){ if(it.pics && it.pics[id]) return it.pics[id]; } return null; }
function parseRich(text, base){
  const lines = String(text || "").replace(/\t/g, "    ").split("\n");
  const blocks = [];
  const para = l => {
    let s = l.replace(/\s+$/, ""), ind = 0, bullet = false, align = (base && base.align) || "";
    const pre = linePre(s), am = !!pre.align; if(am) align = pre.align; s = pre.rest;
    const size = pre.size || (base && base.size) || "";
    if(/^\s*[-•]\s+|^\s*\*\s+/.test(s)){ bullet = true; ind = 5; s = s.replace(/^\s*[-•*]\s+/, ""); }
    const opt = !bullet && OPT_LINE.test(s.replace(/^\s*(\{color:[^}]*\}|\*\*|\*|\+\+)+/, ""));   // formatting before "A." still counts as an option
    if(opt) ind = 5;
    return { type: "para", runs: parseInline(s.trim(), base), ind, bullet, opt, align: opt || bullet ? (am ? align : "") : align, scale: SIZE_K[size] || 1 };
  };
  for(let i = 0; i < lines.length; i++){
    const l = lines[i], t = l.trim();
    if(!t){ blocks.push({ type: "gap" }); continue; }
    const pm = l.match(RE_PIC); if(pm){ blocks.push({ type: "pic", desc: pm[1].trim() }); continue; }
    const im = l.match(RE_IMG); if(im){ blocks.push({ type: "img", id: im[1], size: Math.max(5, Math.min(100, +im[2] || 60)), align: (im[3] || "center").toLowerCase().replace("centre", "center") }); continue; }
    const mo = l.match(RE_MOL); if(mo){ blocks.push({ type: "mol", smi: mo[1].trim(), cap: (mo[2] || "").trim() }); continue; }
    const open = t.startsWith("$$") ? "$$" : t.startsWith("\\[") ? "\\[" : null;
    if(open){
      const close = open === "$$" ? "$$" : "\\]";
      let body = t.slice(2), rest = "", k = body.indexOf(close);
      if(k >= 0){ rest = body.slice(k + 2).trim(); body = body.slice(0, k); }
      else{
        const acc = [body]; let j = i + 1, found = false;
        for(; j < lines.length; j++){ const q = lines[j].indexOf(close); if(q >= 0){ acc.push(lines[j].slice(0, q)); rest = lines[j].slice(q + 2).trim(); found = true; break; } acc.push(lines[j]); }
        if(!found){ blocks.push(para(l)); continue; }
        body = acc.join("\n"); i = j;
      }
      if(body.trim()) blocks.push({ type: "display", tex: mathColor(body.trim(), base && base.c) });
      if(rest) blocks.push(para(rest));
      continue;
    }
    if(/^\|.*\|$/.test(t)){
      const rows = []; let header = false; let j = i;
      for(; j < lines.length && /^\|.*\|$/.test(lines[j].trim()); j++){
        const cells = splitRow(lines[j].trim());
        if(cells.every(c => /^\s*:?-{2,}:?\s*$/.test(c))){ if(rows.length === 1) header = true; continue; }
        rows.push(cells.map(c => parseInline(c.trim(), base)));
      }
      i = j - 1;
      blocks.push({ type: "table", rows, header });
      continue;
    }
    blocks.push(para(l));
  }
  while(blocks.length && blocks[0].type === "gap") blocks.shift();
  while(blocks.length && blocks[blocks.length - 1].type === "gap") blocks.pop();
  return blocks;
}
function splitRow(t){
  t = t.replace(/^\|/, "").replace(/\|$/, "");
  const out = []; let cur = "", math = false;
  for(let i = 0; i < t.length; i++){
    const c = t[i];
    if(c === "$" && t[i - 1] !== "\\") math = !math;
    if(c === "|" && !math && t[i - 1] !== "\\"){ out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}
function eachMath(blocks, fn){
  const runs = rs => rs.forEach(r => { if(r.t === "math") fn(r.tex, !!r.display); });
  blocks.forEach(b => {
    if(b.type === "para") runs(b.runs);
    else if(b.type === "display") fn(b.tex, true);
    else if(b.type === "table") b.rows.forEach(r => r.forEach(runs));
  });
}
// a picture the AI could only describe: [diagram: …] / [image: …] / [photo: …] on its own line
const RE_PIC = /^\s*\[\s*(?:diagram|image|picture|figure|fig\.?|graph|photo|photograph|map|chart|illustration|drawing)\s*[:\-–]\s*([^\]]*)\]\s*$/i;
const picsOf = t => String(t || "").split("\n").map(l => l.match(RE_PIC)).filter(Boolean).map(m => m[1].trim());
const dropFirstPic = t => { const L = String(t || "").split("\n"); const k = L.findIndex(l => RE_PIC.test(l)); if(k >= 0){ L.splice(k, 1); if(k < L.length && !L[k].trim() && (k === 0 || !L[k - 1].trim())) L.splice(k, 1); } return L.join("\n"); };
const missingPics = () => S.items.reduce((a, it) => a + (it.type === "section" ? 0 : picsOf(it.text).length + (it.subs || []).reduce((b, sb) => b + picsOf(sb.text).length, 0)), 0);
/* ---------------- molecules: {mol: SMILES | caption} on its own line ---------------- */
const RE_MOL = /^\s*\{\s*(?:mol|molecule|smiles|structure)\s*:\s*([^}|]+?)\s*(?:\|\s*([^}]*?))?\s*\}\s*$/i;
const MOLS = {};   // smiles → { svg, png, w, h, err }
const MOL_BW = { C: "#111", O: "#111", N: "#111", F: "#111", CL: "#111", BR: "#111", I: "#111", P: "#111", S: "#111", B: "#111", SI: "#111", H: "#111", BACKGROUND: "transparent" };
function molSVG(smi){
  return new Promise(res => {
    if(!window.SmilesDrawer) return res({ err: "Molecule drawing isn't loaded" });
    const host = document.createElement("div"); host.style.cssText = "position:fixed;left:-9999px;top:0;width:600px;height:400px";
    const id = "molsvg_" + Math.random().toString(36).slice(2);
    host.innerHTML = `<svg id="${id}" xmlns="http://www.w3.org/2000/svg"></svg>`; document.body.appendChild(host);
    const done = r => { host.remove(); res(r); };
    try{
      const d = new SmilesDrawer.SvgDrawer({ width: 600, height: 400, bondThickness: 1.1, compactDrawing: false, terminalCarbons: false, explicitHydrogens: false, padding: 6, themes: { bw: MOL_BW } });
      SmilesDrawer.parse(smi, tree => {
        try{
          d.draw(tree, id, "bw");
          const el = document.getElementById(id), vb = (el.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number);
          el.setAttribute("width", vb[2]); el.setAttribute("height", vb[3]); el.removeAttribute("style");
          done({ svg: new XMLSerializer().serializeToString(el), w: vb[2], h: vb[3] });
        }catch(e){ done({ err: "Couldn't draw this molecule" }); }
      }, () => done({ err: "That isn't a valid SMILES code" }));
    }catch(e){ done({ err: "Couldn't draw this molecule" }); }
  });
}
async function getMol(smi){
  if(MOLS[smi] && (MOLS[smi].png || MOLS[smi].err)) return MOLS[smi];
  const m = await molSVG(smi);
  if(!m.err){
    try{
      const sc = 4, img = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(m.svg));
      const c = document.createElement("canvas"); c.width = Math.ceil(m.w * sc); c.height = Math.ceil(m.h * sc);
      const g = c.getContext("2d"); g.drawImage(img, 0, 0, c.width, c.height);
      m.png = c.toDataURL("image/png");
    }catch(e){ m.err = "Couldn't draw this molecule"; }
  }
  return MOLS[smi] = m;
}
function molsIn(t){ return String(t || "").split("\n").map(l => l.match(RE_MOL)).filter(Boolean).map(m => m[1].trim()); }
async function prepareMols(){
  const want = new Set();
  S.items.forEach(it => { molsIn(qText(it)).forEach(x => want.add(x)); molsIn(it.answer).forEach(x => want.add(x)); (it.subs || []).forEach(sb => { molsIn(sb.text).forEach(x => want.add(x)); molsIn(sb.answer).forEach(x => want.add(x)); }); });
  await Promise.all([...want].map(getMol));
}
const MOL_PRESETS = [
  ["Alkanes", [["methane", "C"], ["ethane", "CC"], ["propane", "CCC"], ["butane", "CCCC"], ["2-methylpropane", "CC(C)C"], ["pentane", "CCCCC"], ["cyclohexane", "C1CCCCC1"]]],
  ["Alkenes & alkynes", [["ethene", "C=C"], ["propene", "C=CC"], ["but-1-ene", "C=CCC"], ["but-2-ene", "CC=CC"], ["ethyne", "C#C"]]],
  ["Alcohols, acids, esters", [["methanol", "CO"], ["ethanol", "CCO"], ["propan-1-ol", "CCCO"], ["propan-2-ol", "CC(O)C"], ["methanoic acid", "OC=O"], ["ethanoic acid", "CC(=O)O"], ["ethyl ethanoate", "CCOC(C)=O"], ["ethanal", "CC=O"], ["propanone", "CC(C)=O"]]],
  ["Other organic", [["chloromethane", "CCl"], ["ethylamine", "CCN"], ["benzene", "C1=CC=CC=C1"], ["methylbenzene", "CC1=CC=CC=C1"], ["phenol", "OC1=CC=CC=C1"], ["aspirin", "CC(=O)OC1=CC=CC=C1C(=O)O"], ["urea", "NC(N)=O"], ["caffeine", "CN1C=NC2=C1C(=O)N(C)C(=O)N2C"]]],
  ["Biology", [["glucose", "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O"], ["fructose", "OCC1(O)OC[C@@H](O)[C@@H](O)[C@@H]1O"], ["glycine", "NCC(=O)O"], ["alanine", "CC(N)C(=O)O"], ["glycerol", "OCC(O)CO"], ["fatty acid (C6)", "CCCCCC(=O)O"]]],
  ["Small molecules", [["water", "O"], ["ammonia", "N"], ["carbon dioxide", "O=C=O"], ["hydrogen peroxide", "OO"]]]
];
let molTarget = null;
function openMol(id){
  molTarget = id; $("#molSmi").value = ""; $("#molCap").value = ""; $("#molPrev").innerHTML = ""; $("#molMsg").textContent = "Pick a molecule on the left, or type a SMILES code";
  $("#molPresets").innerHTML = MOL_PRESETS.map(([g, L]) => `<div class="g">${g}</div>` + L.map(([n, smi]) => `<button type="button" data-smi="${esc(smi)}" data-n="${esc(n)}">${esc(n)}</button>`).join("")).join("");
  openModal("#molModal"); setTimeout(() => $("#molSmi").focus(), 50);
}
async function molPreview(){
  const smi = $("#molSmi").value.trim(); if(!smi){ $("#molPrev").innerHTML = ""; return; }
  const m = await molSVG(smi); if(smi !== $("#molSmi").value.trim()) return;
  $("#molPrev").innerHTML = m.err ? "" : m.svg; $("#molMsg").textContent = m.err || ($("#molCap").value.trim() ? $("#molCap").value.trim() : "");
}
$("#molSmi").addEventListener("input", () => { clearTimeout(molPreview._t); molPreview._t = setTimeout(molPreview, 200); });
$("#molCap").addEventListener("input", () => { if(!$("#molMsg").textContent.startsWith("Th")) $("#molMsg").textContent = $("#molCap").value; });
$("#molPresets").addEventListener("click", e => { const b = e.target.closest("[data-smi]"); if(!b) return; $("#molSmi").value = b.dataset.smi; if(!$("#molCap").dataset.touched) $("#molCap").value = ""; $("#molMsg").dataset.name = b.dataset.n; molPreview(); $("#molMsg").textContent = b.dataset.n + " — add it as a caption if students may see the name"; });
$("#molCap").addEventListener("change", () => $("#molCap").dataset.touched = "1");
$("#molGo").onclick = async () => {
  const smi = $("#molSmi").value.trim(); if(!smi){ toast("Pick or type a molecule first"); return; }
  const m = await getMol(smi); if(m.err){ toast(m.err); return; }
  const it = S.items.find(x => x.id === molTarget); if(!it) return;
  const line = "{mol: " + smi + ($("#molCap").value.trim() ? " | " + $("#molCap").value.trim() : "") + "}";
  insertBlockAt(it, line);
  $("#molModal").classList.remove("open"); render(); changed(); focusItem(it.id);
};
const hasRich = t => /\$|\\\(|\\\[|\*\*|\*[^\s*]|^\s*\||\\ce\{|\+\+\S|~~\S|\{color:|^\s*\{\s*(?:mol|molecule|smiles|structure|img)\s*:|^\s*\{(?:center|centre|right|left|justify|small|big|bigger|huge)\}/m.test(t || "");
// whole-question formatting chosen on the card (bold / italic / underline / colour)
const fmtOf = it => (it && it.fmt && (it.fmt.b || it.fmt.i || it.fmt.u || it.fmt.x || it.fmt.c || it.fmt.align || it.fmt.size)) ? it.fmt : null;

/* math rendering cache (MathJax → SVG → PNG) */
const MATH = new Map();
const mathReady = (window.MathJax && MathJax.startup && MathJax.startup.promise) || Promise.resolve();
let mathOK = false; mathReady.then(() => { mathOK = !!(window.MathJax && MathJax.tex2svg); });
function prepTex(tex, display){
  let t = /\\colorbox/.test(tex) ? cleanTex(tex) : String(tex).trim();
  if(!display){
    t = t.replace(/\\(lim|limsup|liminf|sum|prod|bigcup|bigcap|max|min|sup|inf)(?![a-zA-Z])(?!\s*\\(?:no)?limits)/g, "\\$1\\limits");
    if(S.d.bigInline !== false && /\\[dt]?frac|\\binom|\\lim|\\sum|\\prod|\\int/.test(t)) t = "\\displaystyle " + t;
  }
  return t;
}
function texSVG(tex, display){
  tex = prepTex(tex, display);
  const key = (display ? "D:" : "I:") + tex;
  let m = MATH.get(key); if(m) return m;
  if(!mathOK) return { err: true, errMsg: "Maths engine still loading", svg: null, w: 0, asc: 0, desc: 0 };
  try{
    const node = MathJax.tex2svg(tex, { display: !!display });
    const svg = node.querySelector("svg");
    const er = svg.querySelector('[data-mml-node="merror"]');
    const vb = svg.getAttribute("viewBox").split(/[\s,]+/).map(Number);
    m = { key, svg: svg.outerHTML, w: vb[2] / 1000, asc: -vb[1] / 1000, desc: (vb[3] + vb[1]) / 1000, err: !!er, errMsg: er ? (er.getAttribute("data-mjx-error") || er.getAttribute("title") || "LaTeX error") : "" };
  }catch(e){ m = { key, err: true, errMsg: e.message, svg: null, w: 0, asc: 0, desc: 0 }; }
  MATH.set(key, m);
  return m;
}
async function mathPNG(m){
  if(m.png || !m.svg) return m;
  const PX = 96;
  const W = Math.max(2, Math.ceil(m.w * PX)), H = Math.max(2, Math.ceil((m.asc + m.desc) * PX));
  const svg = m.svg.replace(/^<svg/, '<svg color="#26221C"').replace(/ width="[^"]*"/, ' width="' + W + '"').replace(/ height="[^"]*"/, ' height="' + H + '"').replace(/ style="[^"]*"/, "");
  const img = await loadImg("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  c.getContext("2d").drawImage(img, 0, 0, W, H);
  m.png = c.toDataURL("image/png");
  return m;
}
// faded black-and-white copy of the logo for the question-page header
const grayLogo = { src: null, png: null };
async function prepareGrayLogo(){
  const src = S.logo && S.logo.src;
  if(!src || grayLogo.src === src) return;
  try{
    const im = await loadImg(src);
    const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
    for(let i = 0; i < p.length; i += 4){
      const lum = .299 * p[i] + .587 * p[i + 1] + .114 * p[i + 2];
      const v = Math.round(95 + lum * .45);           // mid/light grey
      p[i] = p[i + 1] = p[i + 2] = v;
      p[i + 3] = Math.round(p[i + 3] * .55);          // see-through, like a watermark
    }
    g.putImageData(d, 0, 0);
    grayLogo.src = src; grayLogo.png = c.toDataURL("image/png");
  }catch(e){ grayLogo.src = src; grayLogo.png = null; }
}
async function prepareMath(){
  await prepareGrayLogo();
  try{ await prepareMols(); }catch(e){ console.warn(e); }
  if(!FONT_R && window.__PWA__){ try{ await ensureFonts(); }catch(e){ console.warn(e); } }
  await mathReady;
  const jobs = [];
  const want = (t, base) => { if(!t || !(hasRich(t) || base)) return; eachMath(parseRich(t, base), (tex, disp) => { const m = texSVG(tex, disp); if(m.svg && !m.png && !m.err) jobs.push(mathPNG(m).catch(e => { m.err = true; m.errMsg = "Couldn't draw this equation"; })); }); };
  for(const it of S.items){
    want(qText(it), fmtOf(it));
    if(it.options && (it.correct || []).length) want(qText(it, true), fmtOf(it));
    want(it.answer, null);
    (it.subs || []).forEach(sb => { want(sb.text, null); want(sb.answer, null); });
  }
  await Promise.all(jobs);
}
function strHash(s){ let h = 5381; for(let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }

/* HTML preview inside the cards */
function richHTML(text, q){
  const runsH = rs => rs.map(r => {
    if(r.t === "math"){ const m = texSVG(r.tex, !!r.display); return m.err ? `<span class="err" title="${esc(m.errMsg)}">⚠ ${esc(r.tex)}</span>` : m.svg; }
    let h = esc(r.s); if(r.b) h = "<b>" + h + "</b>"; if(r.i) h = "<i>" + h + "</i>"; if(r.u) h = "<u>" + h + "</u>"; if(r.x) h = "<s>" + h + "</s>"; if(r.c) h = `<span style="color:${esc(cssHex(r.c))}">` + h + "</span>"; return h;
  }).join("");
  return parseRich(text, fmtOf(q)).map(b => {
    if(b.type === "gap") return "<div style='height:.5em'></div>";
    if(b.type === "img"){ const P = picData(b.id); return P ? `<div style="text-align:${b.align}"><img src="${P.src}" style="width:${b.size}%;max-width:100%;border-radius:4px"></div>` : `<span class="err">⚠ picture ${esc(b.id)} not found</span>`; }
    if(b.type === "pic") return `<div class="picmiss">🖼 Picture missing: <i>${esc(b.desc)}</i></div>`;
    if(b.type === "mol"){ const m = MOLS[b.smi]; if(!m){ getMol(b.smi).then(() => { const c = q && $("#list").querySelector(`.card[data-id="${q.id}"]`); if(c) updateRich(c, q); }); return `<div class="molbox hint">⌬ drawing ${esc(b.smi)}…</div>`; }
      return m.err ? `<span class="err">⚠ ${esc(b.smi)} — ${esc(m.err)}</span>` : `<div class="molbox"><img src="${m.png}" alt="${esc(b.smi)}">${b.cap ? `<div class="cap">${esc(b.cap)}</div>` : ""}</div>`; }
    if(b.type === "display"){ const m = texSVG(b.tex, true); return `<div class="disp">${m.err ? `<span class="err" title="${esc(m.errMsg)}">⚠ ${esc(b.tex)} — ${esc(m.errMsg)}</span>` : m.svg}</div>`; }
    if(b.type === "table") return "<table>" + b.rows.map((r, i) => "<tr>" + r.map(c => (b.header && i === 0 ? "<th>" : "<td>") + runsH(c) + (b.header && i === 0 ? "</th>" : "</td>")).join("") + "</tr>").join("") + "</table>";
    const mk = "";
    return `<div style="padding-left:${b.ind ? 1.2 : 0}em${b.align ? ";text-align:" + b.align : (!b.opt && !b.bullet && S.d.justify !== false ? ";text-align:justify" : "")}${b.scale && b.scale !== 1 ? ";font-size:" + b.scale + "em;line-height:1.35" : ""}">${b.bullet ? "• " : ""}${mk}${runsH(b.runs) || "&nbsp;"}</div>`;
  }).join("") + (q && q.mcq === "multi" && !/all that apply/i.test(q.text || "") ? '<div><i style="color:var(--muted)">(Select all that apply.)</i></div>' : "");
}
function mathErrors(text){
  const errs = []; if(!hasRich(text)) return errs;
  eachMath(parseRich(text), (tex, d) => { const m = texSVG(tex, d); if(m.err) errs.push(tex + " → " + m.errMsg); });
  return errs;
}
function updateMiss(card, it){
  const el = card.querySelector("[data-miss]"); if(!el) return;
  const P = picsOf(it.text).concat(...(it.subs || []).map(sb => picsOf(sb.text)));
  card.classList.toggle("has-miss", P.length > 0); el.classList.toggle("hidden", !P.length);
  if(!P.length){ el.innerHTML = ""; return; }
  el.innerHTML = `<div><b>🖼 ${P.length === 1 ? "A picture is missing" : P.length + " pictures are missing"}</b> — the AI could only describe ${P.length === 1 ? "it" : "them"}:
    ${P.map(d => `<div class="d">“${esc(d || "picture")}”</div>`).join("")}</div>
    <div class="row"><button class="btn sm" data-act="fillpic">＋ Add the picture here</button><button class="btn sm" data-act="cutpdf" title="Cut the picture out of the PDF you gave the AI">📄 Cut from PDF${pdfPage(P[0]) ? " (page " + pdfPage(P[0]) + ")" : ""}</button><button class="btn sm" data-act="rmpic" title="Delete the [diagram: …] line">Remove the placeholder</button></div>`;
}
function picTags(it){
  const out = [], scan = (txt, where) => String(txt || "").split("\n").forEach((l, li) => { const m = l.match(RE_IMG); if(m) out.push({ id: m[1], size: +m[2] || 60, align: (m[3] || "center").toLowerCase().replace("centre", "center"), where, li }); });
  scan(it.text, null); (it.subs || []).forEach(sb => scan(sb.text, sb.id));
  return out;
}
function setPicTag(it, id, fn){   // rewrite (or with fn → null, delete) the {img: id …} line
  const edit = txt => String(txt || "").split("\n").flatMap(l => { const m = l.match(RE_IMG); if(!m || m[1] !== id) return [l]; const t = fn({ size: +m[2] || 60, align: (m[3] || "center").toLowerCase().replace("centre", "center") }); return t ? ["{img: " + id + " | " + t.size + "% | " + t.align + "}"] : []; }).join("\n");
  it.text = edit(it.text); (it.subs || []).forEach(sb => sb.text = edit(sb.text));
}
function updatePics(card, it){
  const el = card.querySelector("[data-pics]"); if(!el) return;
  const T = picTags(it); el.classList.toggle("hidden", !T.length);
  if(!T.length){ el.innerHTML = ""; return; }
  el.innerHTML = T.map(t => { const P = picData(t.id); return `<div class="picchip" data-pic="${t.id}">${P ? `<img src="${P.src}" alt="">` : "⚠"}
    <select data-picsize title="Picture width">${[5, 10, 15, 20, 25, 33, 40, 50, 60, 75, 100].map(v => `<option value="${v}" ${v === t.size ? "selected" : ""}>${v}%</option>`).join("")}${[5, 10, 15, 20, 25, 33, 40, 50, 60, 75, 100].includes(t.size) ? "" : `<option selected value="${t.size}">${t.size}%</option>`}</select>
    <select data-picalign title="Position">${["left", "center", "right"].map(v => `<option value="${v}" ${v === t.align ? "selected" : ""}>${{ left: "⇤ Left", center: "↔ Centre", right: "⇥ Right" }[v]}</option>`).join("")}</select>
    ${P && P.graph ? `<button class="btn sm" data-picgraph title="Change this graph">📈 Edit</button>` : ""}${P && P.svg ? `<button class="btn sm" data-picsvg title="Change this drawing">✏️ Edit drawing</button>` : ""}<button class="btn sm" data-picdel title="Remove this picture">✕</button></div>`; }).join("");
}
function updateRich(card, it){
  updateMiss(card, it); updatePics(card, it);
  const box = card.querySelector("[data-rich]"); if(!box) return;
  const T = qText(it);
  const blocks = (hasRich(T) || it.mcq || fmtOf(it)) && mathOK ? parseRich(T, fmtOf(it)) : [];
  const rich = ((it.mcq || fmtOf(it)) && blocks.length) || blocks.some(b => b.type === "display" || b.type === "table" || b.type === "mol" || b.type === "img" || b.align || (b.scale && b.scale !== 1) || b.bullet || (b.runs || []).some(r => r.t === "math" || r.b || r.i || r.u || r.x || r.c));
  const subs = it.subs || [];
  const subRich = subs.some(sb => hasRich(sb.text));
  if(!rich && !subRich){ box.classList.add("hidden"); box.innerHTML = ""; return; }
  box.classList.remove("hidden");
  box.innerHTML = (rich ? richHTML(T, it) : "") + subs.map((sb, k) => `<div style="margin-top:4px"><b>(${LETTERS[k]})</b> ${mathOK ? richHTML(sb.text || "") : esc(sb.text || "")}${num(sb.marks) > 0 ? ` <span style="color:var(--muted)">[${fmt(num(sb.marks))}]</span>` : ""}</div>`).join("");
}
