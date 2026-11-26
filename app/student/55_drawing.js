/* ---- drawing pad: pen, straight line, text boxes, eraser — on blank, grid, dotted or lined paper, or the question's axes, number line or picture ---- */
function parseRange(r, def){
  const nums = String(r || "").match(/-?\d+(\.\d+)?\s*\.\.\s*-?\d+(\.\d+)?/g) || [];
  const pr = s => s.split("..").map(Number);
  const st = String(r || "").match(/step\s*(-?\d+(\.\d+)?)/i);
  return { x: nums[0] ? pr(nums[0]) : def, y: nums[1] ? pr(nums[1]) : null, step: st ? +st[1] : 0 };
}
function padSize(bg){
  if(bg.pic){ const P = PAPER.pics[bg.pic] || { w: 4, h: 3 }; const W = 1000; return { W, H: Math.round(Math.min(1100, W * P.h / P.w)) }; }
  if(bg.kind === "numberline") return { W: 1000, H: 220 };
  if(bg.kind === "axes"){ const R = parseRange(bg.range, [-6, 6]), Y = R.y || R.x, nx = R.x[1] - R.x[0], ny = Y[1] - Y[0]; const cell = Math.min(900 / Math.max(1, nx), 700 / Math.max(1, ny), 60); return { W: Math.round(nx * cell + 100), H: Math.round(ny * cell + 90), cell }; }
  return { W: 1000, H: 560 };
}
// the background used: the teacher's (axes, number line, picture, grid), or the paper the student chose for a plain drawing
const plainBg = bg => !bg || (!bg.pic && (!bg.kind || bg.kind === "blank"));
const padBg = b => plainBg(b.bg) && b.paper && b.paper !== "blank" ? { kind: b.paper } : (b.bg || {});
const GRID = 25;   // squares and dots: 25 px apart
const picCache = {};
function loadPic(src){ return picCache[src] || (picCache[src] = new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; })); }
async function drawBg(g, bg, W, H){
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const ink = "#2a2620";
  if(bg.pic){ const P = PAPER.pics[bg.pic]; const im = P && await loadPic(P.src); if(im) g.drawImage(im, 0, 0, W, H); return; }
  if(bg.kind === "grid"){
    for(let x = 0; x <= W; x += GRID){ g.strokeStyle = x % (GRID * 4) ? "#e2ddd2" : "#c9c2b3"; g.lineWidth = 1; g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
    for(let y = 0; y <= H; y += GRID){ g.strokeStyle = y % (GRID * 4) ? "#e2ddd2" : "#c9c2b3"; g.lineWidth = 1; g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
    return;
  }
  if(bg.kind === "dots"){ g.fillStyle = "#a9a294"; for(let x = GRID; x < W; x += GRID) for(let y = GRID; y < H; y += GRID){ g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } return; }
  if(bg.kind === "lines"){ g.strokeStyle = "#cfd8e6"; g.lineWidth = 1.2; for(let y = 50; y < H; y += 40){ g.beginPath(); g.moveTo(20, y + .5); g.lineTo(W - 20, y + .5); g.stroke(); } return; }
  g.font = "16px system-ui, sans-serif"; g.fillStyle = ink; g.textAlign = "center";
  if(bg.kind === "numberline"){
    const R = parseRange(bg.range, [-10, 10]), [a, b] = R.x, n = b - a, step = R.step || (n <= 20 ? 1 : n <= 50 ? 5 : n <= 100 ? 10 : Math.pow(10, Math.floor(Math.log10(n / 10))));
    const L = 50, Rr = W - 50, y = 110, X = v => L + (v - a) / (b - a) * (Rr - L);
    g.strokeStyle = ink; g.lineWidth = 2.5; g.beginPath(); g.moveTo(15, y); g.lineTo(W - 15, y); g.stroke();
    arrow(g, W - 15, y, 1, 0); arrow(g, 15, y, -1, 0);
    const every = Math.max(1, Math.ceil(36 / ((Rr - L) / (n / step))));
    for(let k = 0, v = a; v <= b + 1e-9; v = +(a + (++k) * step).toFixed(6)){
      const big = k % every === 0; g.lineWidth = big ? 2 : 1.2; g.beginPath(); g.moveTo(X(v), y - (big ? 12 : 7)); g.lineTo(X(v), y + (big ? 12 : 7)); g.stroke();
      if(big) g.fillText(String(v), X(v), y + 36);
    }
    return;
  }
  if(bg.kind === "axes"){
    const R = parseRange(bg.range, [-6, 6]), [xa, xb] = R.x, [ya, yb] = R.y || R.x, cell = padSize(bg).cell;
    const x0 = (W - (xb - xa) * cell) / 2, y0 = 40, X = v => x0 + (v - xa) * cell, Y = v => y0 + (yb - v) * cell;
    g.strokeStyle = "#d7d2c7"; g.lineWidth = 1;
    for(let v = xa; v <= xb; v++){ g.beginPath(); g.moveTo(X(v), Y(yb)); g.lineTo(X(v), Y(ya)); g.stroke(); }
    for(let v = ya; v <= yb; v++){ g.beginPath(); g.moveTo(X(xa), Y(v)); g.lineTo(X(xb), Y(v)); g.stroke(); }
    const ax = xa <= 0 && xb >= 0 ? 0 : xa, ay = ya <= 0 && yb >= 0 ? 0 : ya;
    g.strokeStyle = ink; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(X(xa), Y(ay)); g.lineTo(X(xb) + 18, Y(ay)); g.stroke(); arrow(g, X(xb) + 18, Y(ay), 1, 0);
    g.beginPath(); g.moveTo(X(ax), Y(ya)); g.lineTo(X(ax), Y(yb) - 18); g.stroke(); arrow(g, X(ax), Y(yb) - 18, 0, -1);
    g.font = Math.max(11, Math.min(16, cell * .45)) + "px system-ui, sans-serif";
    const ex = Math.max(1, Math.ceil(26 / cell));
    for(let v = xa; v <= xb; v++) if(v !== ax && (v - ax) % ex === 0) g.fillText(String(v), X(v), Y(ay) + 20);
    g.textAlign = "right";
    for(let v = ya; v <= yb; v++) if(v !== ay && (v - ay) % ex === 0) g.fillText(String(v), X(ax) - 7, Y(v) + 5);
    g.font = "italic 18px serif"; g.textAlign = "left"; g.fillText("x", X(xb) + 22, Y(ay) + 6); g.fillText("y", X(ax) + 8, Y(yb) - 14);
  }
}
function arrow(g, x, y, dx, dy){ const s = 12, w = .5; g.fillStyle = "#2a2620"; g.beginPath(); g.moveTo(x + dx * 3, y + dy * 3); g.lineTo(x - dx * s - dy * s * w, y - dy * s - dx * s * w); g.lineTo(x - dx * s + dy * s * w, y - dy * s + dx * s * w); g.closePath(); g.fill(); }
/* ---- maths in a text box: 3/4 stacked, x^2, x_1, √(…) — a small layout drawn straight on the canvas ---- */
const measure = document.createElement("canvas").getContext("2d");
function mathTree(src){
  let i = 0;
  const peek = () => src[i], atEnd = () => i >= src.length;
  function group(open, close){ i++; const kids = seq(close); if(src[i] === close) i++; return { k: "grp", kids }; }   // ( … ) — its brackets show, except round a fraction's parts or a power
  function atom(){
    if(atEnd()) return null;
    const c = peek();
    if(c === "(") return Object.assign(group("(", ")"), { br: true });
    if(c === "√"){ i++; const a = src[i] === "(" ? group("(", ")") : atom(); return { k: "sqrt", in: a ? [a] : [] }; }
    if(src.startsWith("sqrt(", i)){ i += 4; return { k: "sqrt", in: [group("(", ")")] }; }
    let m = /^\d+([.,]\d+)?/.exec(src.slice(i)); if(m){ i += m[0].length; return { k: "t", s: m[0] }; }
    m = /^[α-ωΑ-Ω]/.exec(src.slice(i)); if(m){ i += 1; return { k: "t", s: m[0] }; }                     // π, θ, Δ on their own
    m = /^[A-Za-zÀ-ÿ]+/.exec(src.slice(i)); if(m){ i += m[0].length; return { k: "t", s: m[0], it: m[0].length === 1 }; }   // x, y in italics; words (sin, km, cm) upright and together
    i++; return { k: "t", s: c === "*" ? "×" : c === "-" ? "−" : c, op: /[+\-−×÷=<>≤≥≠±*]/.test(c) };
  }
  function post(a){
    for(;;){
      const c = peek();
      if(c === "^" || c === "_"){ i++; let b = atom(); if(b && b.k === "grp") b.br = false; a = { k: c === "^" ? "sup" : "sub", base: a, x: b }; continue; }
      if(c === "/" && a && a.k !== "t" || c === "/" && a && a.k === "t" && !a.op && a.s !== " "){ i++; let b = post(atom()); if(a.k === "grp") a.br = false; if(b && b.k === "grp") b.br = false; a = { k: "frac", n: a, d: b }; continue; }
      return a;
    }
  }
  function seq(close){ const out = []; while(!atEnd() && peek() !== close){ const a = post(atom()); if(a) out.push(a); } return out; }
  return seq(undefined);
}
function mathLayout(nodes, z){
  const F = (sz, it) => `${it ? "italic " : ""}${sz}px system-ui, sans-serif`;
  const L = (n, sz) => {
    if(!n) return { w: 0, a: 0, d: 0, draw(){} };
    if(n.k === "t"){ measure.font = F(sz, n.it); const pad = n.op ? sz * .18 : 0, w = measure.measureText(n.s).width + pad * 2;
      return { w, a: sz * .78, d: sz * .24, draw(g, x, y){ g.font = F(sz, n.it); g.textBaseline = "alphabetic"; g.fillText(n.s, x + pad, y); } }; }
    if(n.k === "grp"){ const r = row(n.kids, sz); if(!n.br) return r;
      measure.font = F(sz); const pw = measure.measureText("(").width;
      return { w: r.w + pw * 2, a: Math.max(r.a, sz * .78), d: Math.max(r.d, sz * .24), draw(g, x, y){ g.font = F(sz); g.textBaseline = "alphabetic"; g.fillText("(", x, y); r.draw(g, x + pw, y); g.font = F(sz); g.fillText(")", x + pw + r.w, y); } }; }
    if(n.k === "sup" || n.k === "sub"){ const b = L(n.base, sz), x = L(n.x, sz * .68), up = n.k === "sup" ? sz * .42 : -sz * .22;
      return { w: b.w + x.w + 1, a: Math.max(b.a, up + x.a), d: Math.max(b.d, x.d - up), draw(g, X, Y){ b.draw(g, X, Y); x.draw(g, X + b.w + 1, Y - up); } }; }
    if(n.k === "frac"){ const s2 = sz * .82, t = L(n.n, s2), b = L(n.d, s2), w = Math.max(t.w, b.w) + sz * .3, ax = sz * .3, gap = sz * .12;
      return { w, a: ax + gap + t.d + t.a, d: -ax + gap + b.a + b.d, draw(g, X, Y){ t.draw(g, X + (w - t.w) / 2, Y - ax - gap - t.d); b.draw(g, X + (w - b.w) / 2, Y - ax + gap + b.a);
        g.save(); g.lineWidth = Math.max(1.2, sz / 16); g.beginPath(); g.moveTo(X + 1, Y - ax); g.lineTo(X + w - 1, Y - ax); g.stroke(); g.restore(); } }; }
    if(n.k === "sqrt"){ const r = row(n.in, sz), h = sz * .55, top = r.a + sz * .14;
      return { w: r.w + h + 4, a: top + 2, d: Math.max(r.d, sz * .2), draw(g, X, Y){ g.save(); g.lineWidth = Math.max(1.3, sz / 15); g.beginPath();
        g.moveTo(X, Y - sz * .3); g.lineTo(X + h * .3, Y - sz * .38); g.lineTo(X + h * .62, Y + r.d * .8); g.lineTo(X + h, Y - top); g.lineTo(X + h + r.w + 4, Y - top); g.stroke(); g.restore(); r.draw(g, X + h + 2, Y); } }; }
    return { w: 0, a: 0, d: 0, draw(){} };
  };
  const row = (kids, sz) => { const ps = kids.map(k => L(k, sz)); return { w: ps.reduce((t, p) => t + p.w, 0), a: Math.max(sz * .78, ...ps.map(p => p.a)), d: Math.max(sz * .24, ...ps.map(p => p.d)),
    draw(g, x, y){ let X = x; for(const p of ps){ p.draw(g, X, y); X += p.w; } } }; };
  return row(nodes, z);
}
// a text op laid out: each line (plain text, or maths when the box's Maths switch is on), its baseline, and the box it covers
function textLayout(o){
  const z = o.size || 26, lines = String(o.s).split("\n"), out = [];
  let base = o.y + z * .35, w = 20, top = null, bottom = 0;
  lines.forEach((l, i) => {
    let node;
    if(o.m){ node = mathLayout(mathTree(l), z); }
    else { measure.font = `${z}px system-ui, sans-serif`; const tw = measure.measureText(l).width; node = { w: tw, a: z * .78, d: z * .24, draw(g, x, y){ g.font = `${z}px system-ui, sans-serif`; g.textBaseline = "alphabetic"; g.fillText(l, x, y); } }; }
    if(i) base += out[i - 1].node.d + node.a + z * .22;
    out.push({ node, base }); w = Math.max(w, node.w);
    if(top === null) top = base - node.a; bottom = base + node.d;
  });
  return { lines: out, box: { x: o.x - 6, y: top - 4, w: w + 12, h: bottom - top + 8 } };
}
const textBox = o => textLayout(o).box;
function arrowHead(g, x0, y0, x1, y1, w){ const a = Math.atan2(y1 - y0, x1 - x0), s = Math.max(12, w * 3.2); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - s * Math.cos(a - .42), y1 - s * Math.sin(a - .42)); g.lineTo(x1 - s * Math.cos(a + .42), y1 - s * Math.sin(a + .42)); g.closePath(); g.fill(); }
function drawOps(g, ops){
  for(const o of ops){
    if(o.hidden) continue;
    g.save();
    if(o.tool === "erase") g.globalCompositeOperation = "destination-out";
    g.strokeStyle = o.c; g.fillStyle = o.c; g.lineWidth = o.w; g.lineCap = g.lineJoin = "round";
    if(o.tool === "text"){ for(const L of textLayout(o).lines) L.node.draw(g, o.x, L.base); }
    else if(o.tool === "rect"){ const [[x0, y0], [x1, y1]] = o.pts; g.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)); }
    else if(o.tool === "circle"){ const [[x0, y0], [x1, y1]] = o.pts; g.beginPath(); g.arc(x0, y0, Math.hypot(x1 - x0, y1 - y0), 0, Math.PI * 2); g.stroke(); }
    else if(o.tool === "arrow"){ const [[x0, y0], [x1, y1]] = o.pts; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); if(Math.hypot(x1 - x0, y1 - y0) > 4) arrowHead(g, x0, y0, x1, y1, o.w); }
    else if(o.pts.length === 1){ g.beginPath(); g.arc(o.pts[0][0], o.pts[0][1], o.w / 2, 0, 7); g.fill(); }
    else { g.beginPath(); g.moveTo(o.pts[0][0], o.pts[0][1]); for(let i = 1; i < o.pts.length; i++) g.lineTo(o.pts[i][0], o.pts[i][1]); g.stroke(); }
    g.restore();
  }
}
// ✋ Move: what's under a tap, and the box round it
const segDist = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
function opHit(o, p){
  if(o.tool === "erase" || o.hidden) return false;
  if(o.tool === "text"){ const r = textBox(o); return p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h; }
  const tol = o.w / 2 + 10;
  if(o.tool === "rect"){ const [[x0, y0], [x1, y1]] = o.pts, A = [Math.min(x0, x1), Math.min(y0, y1)], B = [Math.max(x0, x1), Math.max(y0, y1)];
    return [[A, [B[0], A[1]]], [[B[0], A[1]], B], [B, [A[0], B[1]]], [[A[0], B[1]], A]].some(([u, v]) => segDist(p, u, v) < tol); }
  if(o.tool === "circle"){ const [[x0, y0], [x1, y1]] = o.pts; return Math.abs(Math.hypot(p[0] - x0, p[1] - y0) - Math.hypot(x1 - x0, y1 - y0)) < tol; }
  if(o.pts.length === 1) return Math.hypot(p[0] - o.pts[0][0], p[1] - o.pts[0][1]) < tol;
  for(let i = 1; i < o.pts.length; i++) if(segDist(p, o.pts[i - 1], o.pts[i]) < tol) return true;
  return false;
}
function opBox(o){
  if(o.tool === "text") return textBox(o);
  let pts = o.pts; if(o.tool === "circle"){ const [[x0, y0], [x1, y1]] = o.pts, r = Math.hypot(x1 - x0, y1 - y0); pts = [[x0 - r, y0 - r], [x0 + r, y0 + r]]; }
  const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]), m = o.w / 2 + 6;
  return { x: Math.min(...xs) - m, y: Math.min(...ys) - m, w: Math.max(...xs) - Math.min(...xs) + 2 * m, h: Math.max(...ys) - Math.min(...ys) + 2 * m };
}
function moveOp(o, dx, dy){ if(o.tool === "text"){ o.x += dx; o.y += dy; } else o.pts = o.pts.map(q => [q[0] + dx, q[1] + dy]); }
// the picture a drawing block shows before it is drawn on
const previews = {};
function padPreview(b){
  const bg = padBg(b), key = JSON.stringify(bg); if(previews[key]) return previews[key];
  const { W, H } = padSize(bg), c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  previews[key] = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/></svg>`);
  drawBg(g, bg, W, H).then(() => {
    g.fillStyle = "rgba(31,79,184,.75)"; g.font = "600 26px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("✏️ Click to draw", W / 2, Math.min(H - 24, 44));
    previews[key] = c.toDataURL("image/png");
    $$("img.drawn").forEach(im => { if(im.dataset.bg === key) im.src = previews[key]; });
  });
  return previews[key];
}

async function openPad(aid, b){
  if(ST.endedAt) return;
  const canPaper = plainBg(b.bg);
  let paper = canPaper ? (b.paper || "blank") : null;
  const bgNow = () => canPaper ? (paper === "blank" ? {} : { kind: paper }) : (b.bg || {});
  const { W, H } = padSize(bgNow());
  const ops = JSON.parse(JSON.stringify(b.ops || [])), hist = [];
  const snap = () => { hist.push(JSON.stringify(ops)); if(hist.length > 80) hist.shift(); };    // undo goes back one change (drawn, typed, moved, deleted…)
  let tool = "pen", col = "#1F4FB8", thick = 4, cur = null, drag = null, sel = null, mathsOn = false;
  const SHAPES = ["line", "arrow", "rect", "circle"];
  const pad = document.createElement("div"); pad.className = "pad";
  pad.innerHTML = `<div class="in" role="dialog" aria-label="Drawing">
    <div class="tb">
      <button class="btn on" data-tool="pen" title="Pen">✏️ Pen</button><button class="btn" data-tool="line" title="Straight line (on grid or dotted paper it snaps to the points)">╱ Line</button>
      <button class="btn" data-tool="arrow" title="Arrow">➝ Arrow</button><button class="btn" data-tool="rect" title="Box: drag from one corner to the other">▭ Box</button><button class="btn" data-tool="circle" title="Circle: drag from the centre outwards">◯ Circle</button>
      <button class="btn" data-tool="text" title="Text: tap to type (Enter for a new line). Tap a text to change it.">🅃 Text</button>
      <button class="btn" data-tool="move" title="Move: tap something you drew, then drag it (or delete it)">✋ Move</button><button class="btn" data-tool="erase" title="Eraser">⌫ Eraser</button>
      <button class="btn hidden" data-del disabled title="Delete what is selected (or press Delete)">✕ Delete</button>
      <span class="sep"></span>
      ${["#1F4FB8", "#24211C", "#C0392B", "#2A7D4F"].map((c, i) => `<span class="sw ${i ? "" : "on"}" data-col="${c}" style="background:${c}" title="Colour"></span>`).join("")}
      <span class="sep"></span>
      <button class="btn" data-th="2" title="Thin">thin</button><button class="btn on" data-th="4" title="Medium">medium</button><button class="btn" data-th="8" title="Thick">thick</button>
      <span class="sep"></span>
      <button class="btn" data-undo title="Undo">↶ Undo</button><button class="btn" data-clear title="Rub everything out">🗑 Clear</button>
      ${canPaper ? `<span class="sep"></span><span class="lbl">Paper</span>${[["blank", "Blank"], ["grid", "▦ Grid"], ["dots", "⋯ Dots"], ["lines", "☰ Lined"]].map(([k, t]) => `<button class="btn ${k === paper ? "on" : ""}" data-paper="${k}" title="${t.replace(/^\S+ /, "")} paper">${t}</button>`).join("")}` : ""}
    </div>
    <canvas width="${W}" height="${H}"></canvas>
    <div class="tb" style="justify-content:flex-end"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-done>✓ Done</button></div></div>`;
  document.body.appendChild(pad);
  const cv = pad.querySelector("canvas"), g = cv.getContext("2d");
  const bgC = document.createElement("canvas"); bgC.width = W; bgC.height = H; await drawBg(bgC.getContext("2d"), bgNow(), W, H);
  const layer = document.createElement("canvas"); layer.width = W; layer.height = H; const lg = layer.getContext("2d");
  const paint = () => {
    lg.clearRect(0, 0, W, H); drawOps(lg, cur ? ops.concat([cur]) : ops); g.clearRect(0, 0, W, H); g.drawImage(bgC, 0, 0); g.drawImage(layer, 0, 0);
    if(sel && ops.includes(sel)){ const r = opBox(sel); g.save(); g.setLineDash([7, 5]); g.strokeStyle = "#B5892E"; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h); g.restore(); }
    const del = pad.querySelector("[data-del]"); del.classList.toggle("hidden", tool !== "move"); del.disabled = !(sel && ops.includes(sel));
  };
  paint();
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)]; };
  const snapsTo = () => { const k = bgNow().kind; return k === "grid" || k === "dots"; };
  const toGrid = p => snapsTo() ? p.map(v => Math.round(v / GRID) * GRID) : p;
  const topAt = (p, only) => { for(let i = ops.length - 1; i >= 0; i--) if((!only || ops[i].tool === only) && opHit(ops[i], p)) return ops[i]; return null; };
  // type a text box (new, or change one): several lines, Enter = new line; a symbol bar; "Maths" lays it out (3/4 stacked, x^2…)
  const SYM = [["a/b", "/", "Fraction: 3/4 (with Maths on)"], ["x²", "^", "Power: x^2"], ["x₂", "_", "Small number below: x_1"], ["√", "√()", "Root: √(…)"], ["π", "π"], ["°", "°"], ["±", "±"], ["×", "×"], ["÷", "÷"], ["≤", "≤"], ["≥", "≥"], ["≠", "≠"], ["≈", "≈"], ["θ", "θ"], ["∞", "∞"], ["→", "→"], ["Δ", "Δ"]];
  const typeText = (o, isNew) => {
    const r = cv.getBoundingClientRect(), k = r.width / W, z = (o.size || 26) * k;
    const box = document.createElement("div"); box.className = "txtbox";
    box.innerHTML = `<textarea class="txtin multi" spellcheck="false" autocorrect="off" autocomplete="off" autocapitalize="off" placeholder="Type here (Enter: new line)"></textarea>
      <div class="symbar"><button type="button" class="mth ${o.m || (isNew && mathsOn) ? "on" : ""}" title="Maths layout: 3/4 as a fraction, x^2 as a power, √(…) as a root">∑ Maths</button>${SYM.map(([t, ins, tip]) => `<button type="button" data-ins="${ins}" title="${tip || t}">${t}</button>`).join("")}</div>`;
    const ta = box.querySelector("textarea"), mth = box.querySelector(".mth"); ta.value = isNew ? "" : o.s;
    Object.assign(box.style, { left: Math.max(4, Math.min(r.left + (o.x - 6) * k, innerWidth - 300)) + "px", top: Math.max(4, r.top + o.y * k - z * .8) + "px" });
    Object.assign(ta.style, { fontSize: Math.max(13, z) + "px", color: o.c });
    const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; ta.style.width = Math.max(240, Math.min(innerWidth - 20, ta.value.split("\n").reduce((m, l) => Math.max(m, l.length), 0) * z * .62 + 40)) + "px"; };
    if(!isNew) o.hidden = true; paint();
    pad.appendChild(box); fit(); ta.addEventListener("input", fit);
    // the bar keeps the typing where it is (it never takes the focus)
    box.querySelector(".symbar").addEventListener("mousedown", e => e.preventDefault());
    box.querySelector(".symbar").addEventListener("pointerdown", e => e.preventDefault());
    mth.onclick = () => { mth.classList.toggle("on"); mathsOn = mth.classList.contains("on"); ta.focus(); };
    box.querySelectorAll("[data-ins]").forEach(x => x.onclick = () => {
      let ins = x.dataset.ins; const plain = !mth.classList.contains("on");
      if(plain && ins === "^") ins = "²"; if(plain && ins === "_") ins = "₂";
      const a = ta.selectionStart, e2 = ta.selectionEnd; ta.setRangeText(ins, a, e2, "end");
      if(ins === "√()") ta.setSelectionRange(a + 2, a + 2);
      ta.focus(); fit();
    });
    let fin = false;
    const end = keep => { if(fin) return; fin = true; const v = ta.value.replace(/\s+$/, ""), m = mth.classList.contains("on"); box.remove(); delete o.hidden;
      if(keep && (v !== (isNew ? "" : o.s) || !!o.m !== m)){ snap(); if(isNew){ if(v) ops.push(Object.assign(o, { s: v, m })); } else if(v) Object.assign(o, { s: v, m }); else ops.splice(ops.indexOf(o), 1); }
      paint(); };
    ta.addEventListener("keydown", e => { if(e.key === "Escape"){ e.preventDefault(); end(false); } e.stopPropagation(); });
    setTimeout(() => { ta.focus(); ta.addEventListener("blur", () => end(true)); }, 120);
  };
  cv.addEventListener("pointerdown", e => {
    e.preventDefault(); const p = at(e);
    if(tool === "text"){
      const o = topAt(p, "text");
      if(o){ drag = { o, x0: p[0], y0: p[1], moved: false, edit: true }; cv.setPointerCapture(e.pointerId); return; }
      typeText({ tool: "text", s: "", x: p[0], y: p[1], c: col, size: 22 + thick * 2 }, true); return;
    }
    if(tool === "move"){
      sel = topAt(p); paint();
      if(sel){ drag = { o: sel, x0: p[0], y0: p[1], lx: p[0], ly: p[1], moved: false }; cv.setPointerCapture(e.pointerId); }
      return;
    }
    cv.setPointerCapture(e.pointerId);
    const q = SHAPES.includes(tool) ? toGrid(p) : p;
    cur = { tool, c: col, w: tool === "erase" ? thick * 5 : thick, pts: SHAPES.includes(tool) ? [q, q] : [q] }; paint();
  });
  cv.addEventListener("pointermove", e => {
    const p = at(e);
    if(drag){
      if(!drag.moved && Math.hypot(p[0] - drag.x0, p[1] - drag.y0) > 5){ drag.moved = true; snap(); drag.lx = drag.x0; drag.ly = drag.y0; }
      if(drag.moved){ moveOp(drag.o, p[0] - drag.lx, p[1] - drag.ly); drag.lx = p[0]; drag.ly = p[1]; paint(); }
      return;
    }
    if(!cur) return;
    if(SHAPES.includes(cur.tool)) cur.pts = [cur.pts[0], toGrid(p)]; else cur.pts.push(p);
    paint();
  });
  const up = () => {
    if(drag){ const d = drag; drag = null;
      if(d.moved && snapsTo() && d.o.tool !== "text" && d.o.pts){ const p0 = d.o.pts[0], s0 = toGrid(p0); moveOp(d.o, s0[0] - p0[0], s0[1] - p0[1]); }   // a moved shape lands on the grid again
      if(!d.moved && d.edit) typeText(d.o, false); paint(); return; }
    if(cur){ if(SHAPES.includes(cur.tool) && Math.hypot(cur.pts[1][0] - cur.pts[0][0], cur.pts[1][1] - cur.pts[0][1]) < 3){ cur = null; paint(); return; }
      snap(); ops.push(cur); cur = null; paint(); }
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  const delSel = () => { if(sel && ops.includes(sel)){ snap(); ops.splice(ops.indexOf(sel), 1); sel = null; paint(); } };
  pad.querySelector("[data-del]").onclick = delSel;
  pad.addEventListener("keydown", e => { if((e.key === "Delete" || e.key === "Backspace") && sel && !e.target.closest("textarea, input")){ e.preventDefault(); delSel(); } });
  pad.tabIndex = -1;
  pad.querySelectorAll("[data-tool]").forEach(x => x.onclick = () => { tool = x.dataset.tool; if(tool !== "move") sel = null; paint(); pad.querySelectorAll("[data-tool]").forEach(y => y.classList.toggle("on", y === x)); cv.style.cursor = tool === "text" ? "text" : tool === "move" ? "move" : "crosshair"; if(tool === "move") pad.focus(); });
  pad.querySelectorAll("[data-col]").forEach(x => x.onclick = () => { col = x.dataset.col; pad.querySelectorAll("[data-col]").forEach(y => y.classList.toggle("on", y === x)); if(sel && ops.includes(sel)){ snap(); sel.c = col; paint(); } });
  pad.querySelectorAll("[data-th]").forEach(x => x.onclick = () => { thick = +x.dataset.th; pad.querySelectorAll("[data-th]").forEach(y => y.classList.toggle("on", y === x)); if(sel && ops.includes(sel) && sel.tool !== "text"){ snap(); sel.w = thick; paint(); } });
  pad.querySelectorAll("[data-paper]").forEach(x => x.onclick = async () => { paper = x.dataset.paper; pad.querySelectorAll("[data-paper]").forEach(y => y.classList.toggle("on", y === x)); await drawBg(bgC.getContext("2d"), bgNow(), W, H); paint(); });
  pad.querySelector("[data-undo]").onclick = () => { if(hist.length){ ops.splice(0, ops.length, ...JSON.parse(hist.pop())); sel = null; paint(); } };
  pad.querySelector("[data-clear]").onclick = () => { if(ops.length){ snap(); ops.length = 0; sel = null; paint(); } };
  pad.querySelector("[data-cancel]").onclick = () => pad.remove();
  pad.querySelector("[data-done]").onclick = () => {
    sel = null; paint();                       // no selection box in the saved picture
    if(canPaper) b.paper = paper;
    b.ops = ops; b.png = ops.length ? cv.toDataURL("image/png") : null; b.w = W; b.h = H;
    pad.remove(); changed(); renderArea(aid); renderNav();
  };
}
