/* ---- drawing pad: pen, straight line, text labels, eraser — on blank paper, a grid, axes, a number line or a picture from the question ---- */
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
const picCache = {};
function loadPic(src){ return picCache[src] || (picCache[src] = new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; })); }
async function drawBg(g, bg, W, H){
  g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
  const ink = "#2a2620";
  if(bg.pic){ const P = PAPER.pics[bg.pic]; const im = P && await loadPic(P.src); if(im) g.drawImage(im, 0, 0, W, H); return; }
  if(bg.kind === "grid"){ g.strokeStyle = "#dcd7cc"; g.lineWidth = 1; for(let x = .5; x < W; x += 25){ g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for(let y = .5; y < H; y += 25){ g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } return; }
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
    if(o.tool === "text"){ g.font = `${o.size || 26}px system-ui, sans-serif`; g.textBaseline = "middle"; g.fillText(o.s, o.x, o.y); }
    else if(o.pts.length === 1){ g.beginPath(); g.arc(o.pts[0][0], o.pts[0][1], o.w / 2, 0, 7); g.fill(); }
    else { g.beginPath(); g.moveTo(o.pts[0][0], o.pts[0][1]); for(let i = 1; i < o.pts.length; i++) g.lineTo(o.pts[i][0], o.pts[i][1]); g.stroke(); }
    g.restore();
  }
}
// the picture a drawing block shows before it is drawn on
const previews = {};
function padPreview(b){
  const key = JSON.stringify(b.bg); if(previews[key]) return previews[key];
  const { W, H } = padSize(b.bg), c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  previews[key] = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/></svg>`);
  drawBg(g, b.bg, W, H).then(() => {
    g.fillStyle = "rgba(31,79,184,.75)"; g.font = "600 26px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("✏️ Click to draw", W / 2, Math.min(H - 24, 44));
    previews[key] = c.toDataURL("image/png");
    $$("img.drawn").forEach(im => { if(im.dataset.bg === key) im.src = previews[key]; });
  });
  return previews[key];
}

async function openPad(aid, b){
  if(ST.endedAt) return;
  const { W, H } = padSize(b.bg);
  const ops = JSON.parse(JSON.stringify(b.ops || []));
  let tool = "pen", col = "#1F4FB8", thick = 4, cur = null;
  const pad = document.createElement("div"); pad.className = "pad";
  pad.innerHTML = `<div class="in" role="dialog" aria-label="Drawing">
    <div class="tb">
      <button class="btn on" data-tool="pen" title="Pen">✏️ Pen</button><button class="btn" data-tool="line" title="Straight line">╱ Line</button>
      <button class="btn" data-tool="text" title="Write a label: click where it goes">🅃 Label</button><button class="btn" data-tool="erase" title="Eraser">⌫ Eraser</button>
      <span class="sep"></span>
      ${["#1F4FB8", "#24211C", "#C0392B", "#2A7D4F"].map((c, i) => `<span class="sw ${i ? "" : "on"}" data-col="${c}" style="background:${c}" title="Colour"></span>`).join("")}
      <span class="sep"></span>
      <button class="btn" data-th="2" title="Thin">thin</button><button class="btn on" data-th="4" title="Medium">medium</button><button class="btn" data-th="8" title="Thick">thick</button>
      <span class="sep"></span>
      <button class="btn" data-undo title="Undo">↶ Undo</button><button class="btn" data-clear title="Rub everything out">🗑 Clear</button>
    </div>
    <canvas width="${W}" height="${H}"></canvas>
    <div class="tb" style="justify-content:flex-end"><button class="btn" data-cancel>Cancel</button><button class="btn primary" data-done>✓ Done</button></div></div>`;
  document.body.appendChild(pad);
  const cv = pad.querySelector("canvas"), g = cv.getContext("2d");
  const bgC = document.createElement("canvas"); bgC.width = W; bgC.height = H; await drawBg(bgC.getContext("2d"), b.bg, W, H);
  const layer = document.createElement("canvas"); layer.width = W; layer.height = H; const lg = layer.getContext("2d");
  const paint = () => { lg.clearRect(0, 0, W, H); drawOps(lg, cur ? ops.concat([cur]) : ops); g.clearRect(0, 0, W, H); g.drawImage(bgC, 0, 0); g.drawImage(layer, 0, 0); };
  paint();
  const at = e => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * W / r.width), Math.round((e.clientY - r.top) * H / r.height)]; };
  cv.addEventListener("pointerdown", e => {
    e.preventDefault(); const p = at(e);
    if(tool === "text"){ askLabel(e.clientX, e.clientY, s => { if(s){ ops.push({ tool: "text", s, x: p[0], y: p[1], c: col, size: 22 + thick * 2 }); paint(); } }); return; }
    cv.setPointerCapture(e.pointerId);
    cur = { tool, c: col, w: tool === "erase" ? thick * 5 : thick, pts: [p] }; paint();
  });
  cv.addEventListener("pointermove", e => {
    if(!cur) return; const p = at(e);
    if(cur.tool === "line") cur.pts = [cur.pts[0], p]; else cur.pts.push(p);
    paint();
  });
  const up = () => { if(cur){ ops.push(cur); cur = null; paint(); } };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  pad.querySelectorAll("[data-tool]").forEach(x => x.onclick = () => { tool = x.dataset.tool; pad.querySelectorAll("[data-tool]").forEach(y => y.classList.toggle("on", y === x)); cv.style.cursor = tool === "text" ? "text" : "crosshair"; });
  pad.querySelectorAll("[data-col]").forEach(x => x.onclick = () => { col = x.dataset.col; pad.querySelectorAll("[data-col]").forEach(y => y.classList.toggle("on", y === x)); });
  pad.querySelectorAll("[data-th]").forEach(x => x.onclick = () => { thick = +x.dataset.th; pad.querySelectorAll("[data-th]").forEach(y => y.classList.toggle("on", y === x)); });
  pad.querySelector("[data-undo]").onclick = () => { ops.pop(); paint(); };
  pad.querySelector("[data-clear]").onclick = () => { ops.length = 0; paint(); };
  pad.querySelector("[data-cancel]").onclick = () => pad.remove();
  pad.querySelector("[data-done]").onclick = () => {
    b.ops = ops; b.png = ops.length ? cv.toDataURL("image/png") : null; b.w = W; b.h = H;
    pad.remove(); changed(); renderArea(aid); renderNav();
  };
}
function askLabel(x, y, done){
  const inp = document.createElement("input"); inp.className = "txtin"; inp.placeholder = "Type, then Enter";
  ["spellcheck", "autocorrect", "autocomplete"].forEach(a => inp.setAttribute(a, "off"));
  inp.style.left = Math.min(x, innerWidth - 200) + "px"; inp.style.top = y - 16 + "px";
  document.body.appendChild(inp);
  let fin = false; const end = ok => { if(fin) return; fin = true; const v = inp.value.trim(); inp.remove(); done(ok ? v : ""); };
  inp.addEventListener("keydown", e => { if(e.key === "Enter") end(true); if(e.key === "Escape") end(false); });
  // the click that made the box is still finishing: focus it after that, and only then treat "clicked away" as done
  setTimeout(() => { inp.focus(); inp.addEventListener("blur", () => end(true)); }, 120);
}
