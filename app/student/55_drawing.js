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
function drawOps(g, ops){
  for(const o of ops){
    g.save();
    if(o.tool === "erase") g.globalCompositeOperation = "destination-out";
    g.strokeStyle = o.c; g.fillStyle = o.c; g.lineWidth = o.w; g.lineCap = g.lineJoin = "round";
    if(o.tool === "text"){ g.font = `${o.size || 26}px system-ui, sans-serif`; g.textBaseline = "middle"; String(o.s).split("\n").forEach((l, i) => g.fillText(l, o.x, o.y + i * (o.size || 26) * 1.25)); }
    else if(o.pts.length === 1){ g.beginPath(); g.arc(o.pts[0][0], o.pts[0][1], o.w / 2, 0, 7); g.fill(); }
    else { g.beginPath(); g.moveTo(o.pts[0][0], o.pts[0][1]); for(let i = 1; i < o.pts.length; i++) g.lineTo(o.pts[i][0], o.pts[i][1]); g.stroke(); }
    g.restore();
  }
}
const measure = document.createElement("canvas").getContext("2d");
function textBox(o){
  const z = o.size || 26, lines = String(o.s).split("\n"); measure.font = `${z}px system-ui, sans-serif`;
  const w = Math.max(20, ...lines.map(l => measure.measureText(l).width));
  return { x: o.x - 6, y: o.y - z * .65, w: w + 12, h: (lines.length - 1) * z * 1.25 + z * 1.3 };
}
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
  const snap = () => { hist.push(JSON.stringify(ops)); if(hist.length > 60) hist.shift(); };    // undo goes back one change (drawn, typed, moved…)
  let tool = "pen", col = "#1F4FB8", thick = 4, cur = null, drag = null;
  const pad = document.createElement("div"); pad.className = "pad";
  pad.innerHTML = `<div class="in" role="dialog" aria-label="Drawing">
    <div class="tb">
      <button class="btn on" data-tool="pen" title="Pen">✏️ Pen</button><button class="btn" data-tool="line" title="Straight line (on grid or dotted paper it snaps to the points)">╱ Line</button>
      <button class="btn" data-tool="text" title="Text: tap to type (Enter for a new line). Tap a text to change it, or drag it to move it.">🅃 Text</button><button class="btn" data-tool="erase" title="Eraser">⌫ Eraser</button>
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
  const paint = () => { lg.clearRect(0, 0, W, H); drawOps(lg, cur ? ops.concat([cur]) : ops); g.clearRect(0, 0, W, H); g.drawImage(bgC, 0, 0); g.drawImage(layer, 0, 0); };
  paint();
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)]; };
  const snapsTo = () => { const k = bgNow().kind; return k === "grid" || k === "dots"; };
  const toGrid = p => snapsTo() ? p.map(v => Math.round(v / GRID) * GRID) : p;
  const textAt = p => { for(let i = ops.length - 1; i >= 0; i--){ const o = ops[i]; if(o.tool !== "text") continue; const r = textBox(o); if(p[0] >= r.x && p[0] <= r.x + r.w && p[1] >= r.y && p[1] <= r.y + r.h) return o; } return null; };
  // type a text box (new, or change one): several lines, Enter = new line; tapping elsewhere finishes, Esc leaves it as it was
  const typeText = (o, isNew) => {
    const r = cv.getBoundingClientRect(), k = r.width / W, z = (o.size || 26) * k;
    const ta = document.createElement("textarea"); ta.className = "txtin multi"; ta.value = isNew ? "" : o.s;
    ["spellcheck", "autocorrect", "autocomplete", "autocapitalize"].forEach(a => ta.setAttribute(a, "off"));
    ta.placeholder = "Type here (Enter: new line)";
    Object.assign(ta.style, { left: Math.max(4, Math.min(r.left + (o.x - 6) * k, innerWidth - 280)) + "px", top: Math.max(4, r.top + o.y * k - z * .8) + "px", fontSize: Math.max(13, z) + "px", color: o.c });
    const fit = () => { ta.style.height = "auto"; ta.style.height = ta.scrollHeight + 2 + "px"; ta.style.width = Math.max(220, Math.min(innerWidth - 20, ta.value.split("\n").reduce((m, l) => Math.max(m, l.length), 0) * z * .62 + 40)) + "px"; };
    if(!isNew) o.hidden = true; paint();
    pad.appendChild(ta); fit(); ta.addEventListener("input", fit);
    let fin = false;
    const end = keep => { if(fin) return; fin = true; const v = ta.value.replace(/\s+$/, ""); ta.remove(); delete o.hidden;
      if(keep && v !== (isNew ? "" : o.s)){ snap(); if(isNew){ if(v) ops.push(Object.assign(o, { s: v })); } else if(v) o.s = v; else ops.splice(ops.indexOf(o), 1); }
      paint(); };
    ta.addEventListener("keydown", e => { if(e.key === "Escape"){ e.preventDefault(); end(false); } e.stopPropagation(); });
    setTimeout(() => { ta.focus(); ta.addEventListener("blur", () => end(true)); }, 120);
  };
  cv.addEventListener("pointerdown", e => {
    e.preventDefault(); const p = at(e);
    if(tool === "text"){
      const o = textAt(p);
      if(o){ drag = { o, x0: p[0], y0: p[1], ox: o.x, oy: o.y, moved: false }; cv.setPointerCapture(e.pointerId); return; }
      typeText({ tool: "text", s: "", x: p[0], y: p[1], c: col, size: 22 + thick * 2 }, true); return;
    }
    cv.setPointerCapture(e.pointerId);
    cur = { tool, c: col, w: tool === "erase" ? thick * 5 : thick, pts: [tool === "line" ? toGrid(p) : p] }; paint();
  });
  cv.addEventListener("pointermove", e => {
    const p = at(e);
    if(drag){ if(!drag.moved && Math.hypot(p[0] - drag.x0, p[1] - drag.y0) > 5){ drag.moved = true; snap(); } if(drag.moved){ drag.o.x = drag.ox + p[0] - drag.x0; drag.o.y = drag.oy + p[1] - drag.y0; paint(); } return; }
    if(!cur) return;
    if(cur.tool === "line") cur.pts = [cur.pts[0], toGrid(p)]; else cur.pts.push(p);
    paint();
  });
  const up = () => {
    if(drag){ const d = drag; drag = null; if(!d.moved) typeText(d.o, false); return; }
    if(cur){ snap(); ops.push(cur); cur = null; paint(); }
  };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  pad.querySelectorAll("[data-tool]").forEach(x => x.onclick = () => { tool = x.dataset.tool; pad.querySelectorAll("[data-tool]").forEach(y => y.classList.toggle("on", y === x)); cv.style.cursor = tool === "text" ? "text" : "crosshair"; });
  pad.querySelectorAll("[data-col]").forEach(x => x.onclick = () => { col = x.dataset.col; pad.querySelectorAll("[data-col]").forEach(y => y.classList.toggle("on", y === x)); });
  pad.querySelectorAll("[data-th]").forEach(x => x.onclick = () => { thick = +x.dataset.th; pad.querySelectorAll("[data-th]").forEach(y => y.classList.toggle("on", y === x)); });
  pad.querySelectorAll("[data-paper]").forEach(x => x.onclick = async () => { paper = x.dataset.paper; pad.querySelectorAll("[data-paper]").forEach(y => y.classList.toggle("on", y === x)); await drawBg(bgC.getContext("2d"), bgNow(), W, H); paint(); });
  pad.querySelector("[data-undo]").onclick = () => { if(hist.length){ ops.splice(0, ops.length, ...JSON.parse(hist.pop())); paint(); } };
  pad.querySelector("[data-clear]").onclick = () => { if(ops.length){ snap(); ops.length = 0; paint(); } };
  pad.querySelector("[data-cancel]").onclick = () => pad.remove();
  pad.querySelector("[data-done]").onclick = () => {
    if(canPaper) b.paper = paper;
    b.ops = ops; b.png = ops.length ? cv.toDataURL("image/png") : null; b.w = W; b.h = H;
    pad.remove(); changed(); renderArea(aid); renderNav();
  };
}
