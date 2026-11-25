/* ---------------- 📈 BEEcalc Graphing: an offline graphing calculator ----------------
   Typed like Desmos:  y = 2x + 1 · x^2 − 3 · f(x) = sin(x) · x = 3 · (2, 5) · y > x^2 · a = 2 (a slider)
   Data: a table (x1, y1) → points;  y1 ~ m x1 + b  fits a model (any model; parameters are found by least squares).
   Key points (roots, highest/lowest points, crossings) show on the graph you are working on. Degrees by default. */
const BG_COLORS = ["#c74440", "#2d70b3", "#388c46", "#6042a6", "#fa7e19", "#000000"];
const BG_FITS = [["Linear", "m X + b"], ["Quadratic", "a X^2 + b X + c"], ["Exponential", "a b^X"], ["Power", "a X^b"], ["Logarithmic", "a + b ln(X)"]];
function beeGraphUI(box, S){
  "use strict";
  // S = saved state (ST.calc.graph): { items, view, deg, nid }
  if(!S.items){ S.items = [{ id: 1, type: "expr", text: "", color: BG_COLORS[0] }]; S.nid = 2; }
  if(!S.view) S.view = { cx: 0, cy: 0, s: 40 };
  if(S.deg == null) S.deg = true;
  const V = S.view;
  box.innerHTML = `<div class="bg">
    <div class="bg-side">
      <div class="bg-tools"><button type="button" class="btn sm" data-add="expr" title="Add an expression">＋ Expression</button><button type="button" class="btn sm" data-add="table" title="Add a table of data">＋ Table</button>
        <button type="button" class="btn sm bg-deg" title="Degrees or radians">${S.deg ? "DEG" : "RAD"}</button></div>
      <div class="bg-sym">${["x²", "^", "√", "π", "θ", "≤", "≥", "~", "(", ")", "|", "sin(", "cos(", "tan(", "ln(", "log("].map(k => `<button type="button" data-s="${esc(k)}">${esc(k.length > 1 ? k.replace("(", "") : k)}</button>`).join("")}</div>
      <div class="bg-list"></div>
    </div>
    <div class="bg-plot"><canvas aria-label="Graph"></canvas>
      <div class="bg-zoom"><button type="button" data-z="in" title="Zoom in">＋</button><button type="button" data-z="out" title="Zoom out">－</button><button type="button" data-z="home" title="Back to the start">⌂</button><button type="button" data-z="fit" title="Zoom to fit all the points">🔍</button></div>
      <div class="bg-tip" hidden></div>
    </div>
  </div>`;
  const list = box.querySelector(".bg-list"), cv = box.querySelector("canvas"), plot = box.querySelector(".bg-plot"), tip = box.querySelector(".bg-tip");
  const ctx = cv.getContext("2d");
  let A = null, sel = null, label = null, lastInput = null, saveT = null;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(changed, 600); };
  const nextColor = () => { const used = S.items.map(i => i.color); return BG_COLORS.find(c => !used.includes(c)) || BG_COLORS[S.items.length % BG_COLORS.length]; };
  const fmt4 = v => BCalc.fmt(Math.abs(v) < 1e-10 ? 0 : v, 4);

  /* ---------- understanding what was typed ---------- */
  function splitRel(t){
    let d = 0;
    for(let i = 0; i < t.length; i++){
      const c = t[i];
      if(c === "(" || c === "[") d++; else if(c === ")" || c === "]") d--;
      else if(d === 0){
        const two = t.slice(i, i + 2);
        if(two === "<=" || two === ">=") return [t.slice(0, i), two, t.slice(i + 2)];
        if("=<>~≤≥".includes(c)) return [t.slice(0, i), { "≤": "<=", "≥": ">=" }[c] || c, t.slice(i + 1)];
      }
    }
    return [t, null, null];
  }
  function splitTop(t){ const out = []; let d = 0, s = 0; for(let i = 0; i < t.length; i++){ const c = t[i]; if(c === "(") d++; else if(c === ")") d--; else if(c === "," && d === 0){ out.push(t.slice(s, i)); s = i + 1; } } out.push(t.slice(s)); return out; }
  const RESERVED = new Set(["x", "y", "r", "e", "π", "pi", "θ", "ans", "tau", "τ"]);
  function analyse(){
    const R = { vars: {}, fns: {}, known: new Set(), rows: {}, items: {}, deg: S.deg };
    // 1. data tables: columns x1, y1… (a column can also be the values of a graph: a table of values)
    let tn = 0;
    for(const it of S.items) if(it.type === "table"){
      tn++; it.n = it.n || tn;
      it.cols.forEach(c => R.known.add(c.name));
    }
    const env = (extra) => Object.assign({ deg: S.deg, vars: R.vars, fns: R.fns, known: R.known }, extra || {});
    const comp = (src) => BCalc.compile(BCalc.parse(src, R.known));
    // 2. constants/sliders and function definitions (two passes so they can use each other)
    for(let pass = 0; pass < 2; pass++) for(const it of S.items){
      if(it.type !== "expr") continue;
      const t = (it.text || "").trim(); if(!t) continue;
      const [l, op, r] = splitRel(t); if(op !== "=") continue;
      const L = l.trim();
      const fm = L.match(/^([a-zA-Z])\s*\(\s*([a-zA-Z])\s*\)$/);
      try{
        if(fm && fm[1] !== "y"){ const body = comp(r), p = fm[2]; R.fns[fm[1]] = (v, e) => body(Object.assign({}, e, { vars: Object.assign({}, e.vars, { [p]: v }) })); continue; }
        if(/^[a-zA-Z]$/.test(L) && !RESERVED.has(L)){
          const tree = BCalc.parse(r, R.known), uses = BCalc.letters(tree);
          if(uses.has("x") || uses.has("y")) continue;
          const v = BCalc.compile(tree)(env());
          if(Array.isArray(v)){ R.vars[L] = v; if(pass) R.items[it.id] = { kind: "list", name: L, v }; }
          else if(Number.isFinite(v)){ R.vars[L] = v; if(pass) R.items[it.id] = { kind: "const", name: L, v, slider: tree.k === "num" || (tree.k === "neg" && tree.a.k === "num") }; }
        }
      }catch(_){}
    }
    // data columns become lists the fits can read (columns that are a graph's values are filled in after the graphs)
    const rowsOf = it => {
      const rows = []; const n = Math.max(...it.cols.map(c => (c.vals || []).length), 0);
      for(let i = 0; i < n; i++){ const row = {}; let ok = true;
        for(const c of it.cols){
          let v;
          if(c.ref){ const f = R.items[c.ref] && R.items[c.ref].fx; const x0 = row[it.cols[0].name]; v = f && Number.isFinite(x0) ? f(x0) : NaN; }
          else { const s = String((c.vals || [])[i] ?? "").trim(); if(!s){ ok = false; break; } try{ v = BCalc.evaluate(s, env()); }catch(_){ v = NaN; } }
          row[c.name] = v;
        }
        if(ok) rows.push(row);
      }
      return rows;
    };
    for(const it of S.items) if(it.type === "table") R.rows[it.id] = rowsOf(it);
    const colLists = () => { for(const it of S.items) if(it.type === "table") for(const c of it.cols) R.vars[c.name] = (R.rows[it.id] || []).map(r => r[c.name]).filter(Number.isFinite); };
    colLists();
    // 3. graphs, points, inequalities, fits
    for(const it of S.items){
      if(it.type !== "expr") continue;
      const t = (it.text || "").trim(); if(!t) { R.items[it.id] = { kind: "empty" }; continue; }
      if(R.items[it.id] && (R.items[it.id].kind === "const" || R.items[it.id].kind === "list")) continue;
      let [l, op, r] = splitRel(t); l = l.trim(); r = r == null ? null : r.trim();
      R.items[it.id] = one(it, t, l, op, r);
      // letters nobody defined → offer sliders
      const ri = R.items[it.id];
      if(ri && ri.kind === "fx" && ri.src){ try{ const u = [...BCalc.letters(BCalc.parse(ri.src, R.known))].filter(v => !RESERVED.has(v) && !(v in R.vars) && !R.fns[v] && !R.known.has(v) && !BC_FN[v]); if(u.length) R.items[it.id] = { kind: "err", msg: "Add a slider for " + u.join(", "), free: u }; }catch(_){} }
    }
    // an equation or a region in x and y (x² + y² = 25, x² + y² < 25): drawn by looking at the whole screen
    function implicit(l, r, op){
      const L = comp(l), Rr = comp(r);
      return { kind: "imp", op, F: (x, y) => { const e = env({ vars: Object.assign({}, R.vars, { x, y }) }); return L(e) - Rr(e); } };
    }
    function one(it, t, l, op, r){
      try{
        if(op === "~") return fit(l, r, R, env);
        if(op && op !== "=" && op !== "~"){
          // y > f(x) (or f(x) < y)
          let f = null, dir = op;
          const usesY = s => BCalc.letters(BCalc.parse(s, R.known)).has("y");
          if(l === "y" && !usesY(r)) f = r; else if(r === "y" && !usesY(l)){ f = l; dir = { "<": ">", ">": "<", "<=": ">=", ">=": "<=" }[op]; }
          if(f != null){ const g = comp(f); return { kind: "fx", fx: x => g(env({ vars: Object.assign({}, R.vars, { x }) })), shade: dir, src: f }; }
          return implicit(l, r, op);
        }
        if(op === "="){
          const fm = l.match(/^([a-zA-Z])\s*\(\s*x\s*\)$/);
          if(fm && fm[1] !== "y"){ const g = comp(r); return { kind: "fx", fx: x => g(env({ vars: Object.assign({}, R.vars, { x }) })), src: r }; }
          if(/^[a-zA-Z]\s*\(\s*[a-zA-Z]\s*\)$/.test(l)){ return { kind: "def" }; }
          const lu = BCalc.letters(BCalc.parse(l, R.known)), ru = BCalc.letters(BCalc.parse(r, R.known));
          // polar: r = f(θ)
          if(l === "r" && !ru.has("x") && !ru.has("y") && !ru.has("r")){ const g = comp(r); return { kind: "polar", fr: th => g(env({ vars: Object.assign({}, R.vars, { "θ": th }) })), src: r }; }
          if(l === "y" && !ru.has("y")){ const g = comp(r); return { kind: "fx", fx: x => g(env({ vars: Object.assign({}, R.vars, { x }) })), src: r }; }
          if(r === "y" && !lu.has("y")){ const g = comp(l); return { kind: "fx", fx: x => g(env({ vars: Object.assign({}, R.vars, { x }) })), src: l }; }
          if(l === "x" && !ru.has("x")){ const g = comp(r); return { kind: "fy", fy: y => g(env({ vars: Object.assign({}, R.vars, { y }) })) }; }
          if(r === "x" && !lu.has("x")){ const g = comp(l); return { kind: "fy", fy: y => g(env({ vars: Object.assign({}, R.vars, { y }) })) }; }
          if(lu.has("x") || lu.has("y") || ru.has("x") || ru.has("y")) return implicit(l, r, "=");
          if(/^[a-zA-Z]$/.test(l)){ const u = [...BCalc.letters(BCalc.parse(r, R.known))].filter(v => !RESERVED.has(v) && !(v in R.vars) && !R.fns[v] && !R.known.has(v)); return { kind: "err", msg: u.length ? "Add a slider for " + u.join(", ") : "BEEcalc can't draw this one yet", free: u }; }
          return { kind: "err", msg: "BEEcalc draws equations in x and y, r = … (polar), points and inequalities" };
        }
        // statistics plots: boxplot(L), histogram(L, width)
        const sp = t.match(/^(boxplot|histogram)\s*\(/);
        if(sp){
          const tr = BCalc.parse(t, R.known); if(tr.k !== "fn") throw new BCalc.CalcError("Write it as " + sp[1] + "(L)");
          const vals = BCalc.compile(tr.a[0])(env()), L = (Array.isArray(vals) ? vals : [vals]).filter(Number.isFinite);
          if(L.length < 1) throw new BCalc.CalcError("The list is empty");
          if(sp[1] === "boxplot"){ const S2 = BC_STATS.sorted(L); return { kind: "box", n: L.length, q: [S2[0], BC_STATS.quartile(L, 1), BC_STATS.med(S2), BC_STATS.quartile(L, 3), S2[S2.length - 1]] }; }
          const w = tr.a[1] ? BCalc.compile(tr.a[1])(env()) : 1; if(!(w > 0)) throw new BCalc.CalcError("The bar width must be more than 0");
          const lo = Math.floor(Math.min(...L) / w) * w, bins = [];
          L.forEach(v => { const k = Math.floor((v - lo) / w + 1e-9); bins[k] = (bins[k] || 0) + 1; });
          return { kind: "hist", n: L.length, w, bins: [...bins].map((c, k) => ({ a: lo + k * w, b: lo + (k + 1) * w, c: c || 0 })) };
        }
        // no = : a point list, a graph of x, or a value
        if(/^\(/.test(t) && /,/.test(t)){
          const pts = splitTop(t).map(p => { const tr = BCalc.parse(p.trim(), R.known); if(tr.k !== "point") throw new BCalc.CalcError("Points are written (x, y)"); const fx = BCalc.compile(tr.a), fy = BCalc.compile(tr.b); return [fx(env()), fy(env())]; });
          return { kind: "pts", pts };
        }
        const tree = BCalc.parse(t, R.known), uses = BCalc.letters(tree), g = BCalc.compile(tree);
        if(uses.has("y")) throw new BCalc.CalcError("Write an equation, like x^2 + y^2 = 25");
        if(uses.has("x")){ return { kind: "fx", fx: x => g(env({ vars: Object.assign({}, R.vars, { x }) })), src: t }; }
        const free = new Set(); const v = g(env({ free }));
        const fr = [...free].filter(x => !RESERVED.has(x));
        return fr.length ? { kind: "err", msg: "Add a slider for " + fr.join(", "), free: fr } : { kind: "value", v };
      }catch(e){ return { kind: "err", msg: e instanceof BCalc.CalcError ? e.message : "I don't understand this" }; }
    }
    // tables: their points
    for(const it of S.items) if(it.type === "table" && it.cols.some(c => c.ref)) R.rows[it.id] = rowsOf(it);
    colLists();
    for(const it of S.items) if(it.type === "table"){
      const rows = R.rows[it.id] || [], xs = it.cols[0];
      R.items[it.id] = { kind: "table", sets: it.cols.slice(1).map((c, k) => ({ color: k === 0 ? it.color : BG_COLORS[(BG_COLORS.indexOf(it.color) + k) % BG_COLORS.length], pts: rows.map(r => [r[xs.name], r[c.name]]).filter(p => p.every(Number.isFinite)) })) };
    }
    return R;
  }
  // y1 ~ m x1 + b: least squares (Levenberg–Marquardt) for any model; the parameters become values you can use
  function fit(l, r, R, env){
    const yName = l.trim(); if(!R.known.has(yName)) throw new BCalc.CalcError("Start with a table column, like y1 ~ m x1 + b");
    const tree = BCalc.parse(r, R.known), g = BCalc.compile(tree);
    const used = [...BCalc.letters(tree)], dataVars = used.filter(v => R.known.has(v));
    const params = used.filter(v => !R.known.has(v) && !RESERVED.has(v) && !(v in R.vars) && !R.fns[v]);
    if(!dataVars.length) throw new BCalc.CalcError("Use a table column on the right, like x1");
    if(!params.length) throw new BCalc.CalcError("There are no letters left to find: " + used.filter(v => v in R.vars).join(", ") + " already have values. Use other letters.");
    const tbl = Object.keys(R.rows).find(id => R.rows[id].length && yName in R.rows[id][0] && dataVars.every(v => v in R.rows[id][0]));
    const rows = tbl ? R.rows[tbl].filter(rw => [yName, ...dataVars].every(k => Number.isFinite(rw[k]))) : [];   // (the same row objects as the table's, so its residuals line up)
    if(rows.length < Math.max(2, params.length)) throw new BCalc.CalcError("Type at least " + Math.max(2, params.length) + " rows of data");
    const model = (p, rw) => g(env({ vars: Object.assign({}, R.vars, rw, p) }));
    const best = { p: null, sse: Infinity };
    for(const start of [1, 0.5, 2, -1]){
      let p = Object.fromEntries(params.map(k => [k, start])), lam = 1e-3, sse = rows.reduce((a, rw) => a + (rw[yName] - model(p, rw)) ** 2, 0);
      for(let it = 0; it < 300 && Number.isFinite(sse); it++){
        const J = rows.map(rw => params.map(k => { const h = 1e-6 * Math.max(1, Math.abs(p[k])); const q = Object.assign({}, p, { [k]: p[k] + h }); return (model(q, rw) - model(p, rw)) / h; }));
        const res = rows.map(rw => rw[yName] - model(p, rw));
        const n = params.length, M = Array.from({ length: n }, () => new Array(n).fill(0)), v = new Array(n).fill(0);
        J.forEach((row, i) => { for(let a = 0; a < n; a++){ v[a] += row[a] * res[i]; for(let b = 0; b < n; b++) M[a][b] += row[a] * row[b]; } });
        for(let a = 0; a < n; a++) M[a][a] *= 1 + lam;
        const d = solve(M, v); if(!d) break;
        const q = Object.fromEntries(params.map((k, i) => [k, p[k] + d[i]]));
        const s2 = rows.reduce((a, rw) => a + (rw[yName] - model(q, rw)) ** 2, 0);
        if(Number.isFinite(s2) && s2 < sse){ const done = sse - s2 < 1e-14 * (1 + sse); p = q; sse = s2; lam = Math.max(lam / 10, 1e-12); if(done) break; } else lam *= 10;
        if(lam > 1e12) break;
      }
      if(sse < best.sse){ best.p = p; best.sse = sse; }
      if(best.sse < 1e-12) break;
    }
    if(!best.p) throw new BCalc.CalcError("These data can't be fitted with this model");
    Object.assign(R.vars, best.p);
    const mean = rows.reduce((a, rw) => a + rw[yName], 0) / rows.length, sst = rows.reduce((a, rw) => a + (rw[yName] - mean) ** 2, 0);
    const xVar = dataVars[0];
    const resid = rows.map(rw => [rw[xVar], rw[yName] - model(best.p, rw)]);
    return { kind: "fit", params: best.p, r2: sst > 0 ? 1 - best.sse / sst : 1, fx: x => model(best.p, { [xVar]: x }), resid, tbl: +tbl, yName, rowsUsed: rows };
  }
  function corr(a, b){ const n = Math.min(a.length, b.length), ma = BC_STATS.mean(a.slice(0, n)), mb = BC_STATS.mean(b.slice(0, n)); let sab = 0, saa = 0, sbb = 0; for(let i = 0; i < n; i++){ sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb); }
  function solve(M, v){
    const n = v.length, A2 = M.map((r, i) => r.concat([v[i]]));
    for(let c = 0; c < n; c++){
      let p = c; for(let r = c + 1; r < n; r++) if(Math.abs(A2[r][c]) > Math.abs(A2[p][c])) p = r;
      if(Math.abs(A2[p][c]) < 1e-300) return null; [A2[c], A2[p]] = [A2[p], A2[c]];
      for(let r = 0; r < n; r++) if(r !== c){ const f = A2[r][c] / A2[c][c]; for(let k = c; k <= n; k++) A2[r][k] -= f * A2[c][k]; }
    }
    return A2.map((r, i) => r[n] / r[i]);
  }

  /* ---------- drawing ---------- */
  let W = 0, H = 0, dpr = 1;
  const SY = () => V.s * (V.r || 1);                 // y has its own scale after "zoom to fit" (V.r = y scale ÷ x scale)
  const X = x => W / 2 + (x - V.cx) * V.s, Y = y => H / 2 - (y - V.cy) * SY();
  const ux = px => V.cx + (px - W / 2) / V.s, uy = py => V.cy - (py - H / 2) / SY();
  function nice(raw){ const p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  function size(){ const r = plot.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; W = Math.max(50, r.width); H = Math.max(50, r.height); cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px"; }
  function draw(){
    if(!W) size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dark = document.body.classList.contains("c-dark");
    ctx.fillStyle = dark ? "#1c1c1c" : "#fff"; ctx.fillRect(0, 0, W, H);
    const step = nice(90 / V.s), minor = step / 5, ystep = nice(90 / SY()), yminor = ystep / 5;
    const gx0 = ux(0), gx1 = ux(W), gy0 = uy(H), gy1 = uy(0);
    ctx.lineWidth = 1;
    ctx.strokeStyle = dark ? "#2a2a2a" : "#eef0f3"; ctx.beginPath();
    for(let x = Math.ceil(gx0 / minor) * minor; x <= gx1; x += minor){ ctx.moveTo(Math.round(X(x)) + .5, 0); ctx.lineTo(Math.round(X(x)) + .5, H); }
    for(let y = Math.ceil(gy0 / yminor) * yminor; y <= gy1; y += yminor){ ctx.moveTo(0, Math.round(Y(y)) + .5); ctx.lineTo(W, Math.round(Y(y)) + .5); }
    ctx.stroke();
    ctx.strokeStyle = dark ? "#3a3a3a" : "#d5d9e0"; ctx.beginPath();
    for(let x = Math.ceil(gx0 / step) * step; x <= gx1; x += step){ ctx.moveTo(Math.round(X(x)) + .5, 0); ctx.lineTo(Math.round(X(x)) + .5, H); }
    for(let y = Math.ceil(gy0 / ystep) * ystep; y <= gy1; y += ystep){ ctx.moveTo(0, Math.round(Y(y)) + .5); ctx.lineTo(W, Math.round(Y(y)) + .5); }
    ctx.stroke();
    // axes and numbers
    const ax = Math.min(Math.max(Y(0), 0), H), ay = Math.min(Math.max(X(0), 0), W);
    ctx.strokeStyle = dark ? "#bbb" : "#333"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(0, ax); ctx.lineTo(W, ax); ctx.moveTo(ay, 0); ctx.lineTo(ay, H); ctx.stroke();
    ctx.fillStyle = dark ? "#ccc" : "#444"; ctx.font = "12px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const lbl = v => BCalc.fmt(+v.toPrecision(10), 6);
    for(let x = Math.ceil(gx0 / step) * step; x <= gx1; x += step){ if(Math.abs(x) < step / 2) continue; const t = lbl(x), py = Math.min(Math.max(ax + 4, 2), H - 16); ctx.fillText(t, X(x), py); }
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    for(let y = Math.ceil(gy0 / ystep) * ystep; y <= gy1; y += ystep){ if(Math.abs(y) < ystep / 2) continue; const t = lbl(y); ctx.fillText(t, Math.min(Math.max(ay - 5, ctx.measureText(t).width + 2), W - 4), Y(y)); }
    if(gx0 < 0 && gx1 > 0 && gy0 < 0 && gy1 > 0){ ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillText("0", ay - 4, ax + 3); }
    if(!A) return;
    // inequalities first (under the lines), then lines, then points
    for(const it of S.items){ const a = A.items[it.id]; if(it.hidden || !a) continue; if((a.kind === "fx" || a.kind === "fit") && a.shade) shade(a, it.color); }
    for(const it of S.items){ const a = A.items[it.id]; if(it.hidden || !a) continue;
      if(a.kind === "imp") implicitDraw(a, it.color, sel === it.id);
      if(a.kind === "polar") polarDraw(a, it, sel === it.id);
      if(a.kind === "box") boxDraw(a, it.color);
      if(a.kind === "hist") histDraw(a, it.color);
      if(a.kind === "fx" || a.kind === "fit") curve(a.fx, it.color, a.shade && a.shade.length === 1, sel === it.id);
      if(a.kind === "fy") curveY(a.fy, it.color, sel === it.id);
    }
    for(const it of S.items){ const a = A.items[it.id]; if(it.hidden || !a) continue;
      if(a.kind === "pts") a.pts.forEach(p => dot(p[0], p[1], it.color, 5));
      if(a.kind === "table") a.sets.forEach(s => s.pts.forEach(p => dot(p[0], p[1], s.color, 4.5)));
      if(a.kind === "fit" && it.resid) a.resid.forEach(p => ring(p[0], p[1], it.color));
    }
    // key points of the graph you're working on
    KP = []; const sa = sel != null && A.items[sel];
    if(sa && (sa.kind === "fx" || sa.kind === "fit") && !S.items.find(i => i.id === sel).hidden){
      KP = keyPoints(sa.fx, sel);
      KP.forEach(k => { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#777"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(k.x), Y(k.y), 4.5, 0, 7); ctx.fill(); ctx.stroke(); });
    }
    if(label){ dot(label.x, label.y, label.color || "#555", 5.5); const t = "(" + fmt4(label.x) + ", " + fmt4(label.y) + ")"; ctx.font = "bold 13px system-ui, sans-serif"; const w = ctx.measureText(t).width + 12, px = Math.min(Math.max(X(label.x) + 10, 2), W - w - 2), py = Math.min(Math.max(Y(label.y) - 30, 2), H - 24);
      ctx.fillStyle = dark ? "#333" : "#fff"; ctx.strokeStyle = dark ? "#666" : "#bbb"; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(px, py, w, 22, 5) : ctx.rect(px, py, w, 22); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark ? "#fff" : "#222"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(t, px + 6, py + 11); }
  }
  let KP = [];
  function curve(f, color, dashed, bold){
    ctx.strokeStyle = color; ctx.lineWidth = bold ? 3.2 : 2.5; ctx.setLineDash(dashed ? [7, 6] : []); ctx.beginPath();
    let pen = false, lastY = null;
    for(let px = -1; px <= W + 1; px += .5){
      const y = f(ux(px)), py = Y(y);
      if(!Number.isFinite(py) || Math.abs(py) > 1e6){ pen = false; lastY = null; continue; }
      if(pen && lastY != null && Math.abs(py - lastY) > H * 1.5){ pen = false; }        // a jump (tan x, 1/x): don't join it
      if(pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
      lastY = py;
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function curveY(f, color, bold){
    ctx.strokeStyle = color; ctx.lineWidth = bold ? 3.2 : 2.5; ctx.beginPath(); let pen = false;
    for(let py = -1; py <= H + 1; py += .5){ const x = f(uy(py)), px = X(x); if(!Number.isFinite(px) || Math.abs(px) > 1e6){ pen = false; continue; } if(pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; } }
    ctx.stroke();
  }
  function shade(a, color){
    ctx.fillStyle = color; ctx.globalAlpha = .16; const up = a.shade[0] === ">";
    for(let px = 0; px < W; px += 1){ const py = Y(a.fx(ux(px + .5))); if(Number.isNaN(py)) continue; const c = Math.min(Math.max(py, 0), H); if(up) ctx.fillRect(px, 0, 1, c); else ctx.fillRect(px, c, 1, H - c); }
    ctx.globalAlpha = 1;
  }
  // marching squares on a 3-pixel grid: the line where F = 0, and the region where the inequality holds
  function implicitDraw(a, color, bold){
    const c = 3, nx = Math.ceil(W / c) + 1, ny = Math.ceil(H / c) + 1, v = new Float64Array(nx * ny);
    for(let j = 0; j < ny; j++){ const y = uy(j * c); for(let i = 0; i < nx; i++){ const f = a.F(ux(i * c), y); v[j * nx + i] = Number.isFinite(f) ? f : NaN; } }
    if(a.op !== "="){
      const ok = { "<": f => f < 0, "<=": f => f <= 0, ">": f => f > 0, ">=": f => f >= 0 }[a.op];
      ctx.fillStyle = color; ctx.globalAlpha = .16;
      for(let j = 0; j < ny - 1; j++) for(let i = 0; i < nx - 1; i++){ const f = (v[j * nx + i] + v[j * nx + i + 1] + v[(j + 1) * nx + i] + v[(j + 1) * nx + i + 1]) / 4; if(ok(f)) ctx.fillRect(i * c, j * c, c, c); }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = color; ctx.lineWidth = bold ? 3.2 : 2.5; ctx.setLineDash(a.op === "<" || a.op === ">" ? [7, 6] : []); ctx.beginPath();
    const lerp = (p, q) => p / (p - q);
    for(let j = 0; j < ny - 1; j++) for(let i = 0; i < nx - 1; i++){
      const f0 = v[j * nx + i], f1 = v[j * nx + i + 1], f2 = v[(j + 1) * nx + i + 1], f3 = v[(j + 1) * nx + i];
      if(!(Number.isFinite(f0) && Number.isFinite(f1) && Number.isFinite(f2) && Number.isFinite(f3))) continue;
      const P = [], x0 = i * c, y0 = j * c;
      if((f0 < 0) !== (f1 < 0)) P.push([x0 + c * lerp(f0, f1), y0]);
      if((f1 < 0) !== (f2 < 0)) P.push([x0 + c, y0 + c * lerp(f1, f2)]);
      if((f3 < 0) !== (f2 < 0)) P.push([x0 + c * lerp(f3, f2), y0 + c]);
      if((f0 < 0) !== (f3 < 0)) P.push([x0, y0 + c * lerp(f0, f3)]);
      if(P.length < 2) continue;
      const big = Math.max(Math.abs(f0), Math.abs(f1), Math.abs(f2), Math.abs(f3)), small = Math.min(Math.abs(f0), Math.abs(f1), Math.abs(f2), Math.abs(f3));
      if(big > 1e6 && small > 1) continue;             // a jump across a gap (like 1/x), not a real crossing
      ctx.moveTo(P[0][0], P[0][1]); ctx.lineTo(P[1][0], P[1][1]);
      if(P.length === 4){ ctx.moveTo(P[2][0], P[2][1]); ctx.lineTo(P[3][0], P[3][1]); }
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  // polar: r = f(θ), θ from the item's range (0 to 360° or 0 to 2π)
  function polarDraw(a, it, bold){
    const th = polarRange(it), toR = S.deg ? Math.PI / 180 : 1, N = 2400;
    ctx.strokeStyle = it.color; ctx.lineWidth = bold ? 3.2 : 2.5; ctx.beginPath(); let pen = false, lp = null;
    for(let k = 0; k <= N; k++){
      const t = th[0] + (th[1] - th[0]) * k / N, r = a.fr(t);
      if(!Number.isFinite(r)){ pen = false; continue; }
      const px = X(r * Math.cos(t * toR)), py = Y(r * Math.sin(t * toR));
      if(pen && lp && Math.hypot(px - lp[0], py - lp[1]) > Math.max(W, H)){ pen = false; }
      if(pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; } lp = [px, py];
    }
    ctx.stroke();
  }
  const polarRange = it => it.th ? [it.th.min, it.th.max] : [0, S.deg ? 360 : 2 * Math.PI];
  function boxDraw(a, color){
    const [q0, q1, q2, q3, q4] = a.q, yc = 1, h = .5;
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = color; ctx.globalAlpha = .18;
    ctx.fillRect(X(q1), Y(yc + h), X(q3) - X(q1), Y(yc - h) - Y(yc + h)); ctx.globalAlpha = 1;
    ctx.strokeRect(X(q1), Y(yc + h), X(q3) - X(q1), Y(yc - h) - Y(yc + h));
    ctx.beginPath(); ctx.moveTo(X(q2), Y(yc + h)); ctx.lineTo(X(q2), Y(yc - h));
    ctx.moveTo(X(q0), Y(yc)); ctx.lineTo(X(q1), Y(yc)); ctx.moveTo(X(q3), Y(yc)); ctx.lineTo(X(q4), Y(yc));
    ctx.moveTo(X(q0), Y(yc + h / 2)); ctx.lineTo(X(q0), Y(yc - h / 2)); ctx.moveTo(X(q4), Y(yc + h / 2)); ctx.lineTo(X(q4), Y(yc - h / 2)); ctx.stroke();
  }
  function histDraw(a, color){
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    a.bins.forEach(b => { if(!b.c) return; ctx.fillStyle = color; ctx.globalAlpha = .25; ctx.fillRect(X(b.a), Y(b.c), X(b.b) - X(b.a), Y(0) - Y(b.c)); ctx.globalAlpha = 1; ctx.strokeRect(X(b.a), Y(b.c), X(b.b) - X(b.a), Y(0) - Y(b.c)); });
  }
  function ring(x, y, color){ const px = X(x), py = Y(y); if(!Number.isFinite(px) || !Number.isFinite(py)) return; ctx.fillStyle = "#fff"; ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
  function dot(x, y, color, r){ const px = X(x), py = Y(y); if(!Number.isFinite(px) || !Number.isFinite(py)) return; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, r, 0, 7); ctx.fill(); }
  // roots, highest/lowest points, crossings with the other graphs, where it meets the y-axis
  function keyPoints(f, id){
    const out = [], x0 = ux(0), x1 = ux(W), N = Math.min(1600, Math.max(200, W * 2)), dx = (x1 - x0) / N;
    const bis = (g, a, b) => { let ga = g(a); for(let i = 0; i < 60; i++){ const m = (a + b) / 2, gm = g(m); if(!Number.isFinite(gm)) return null; if(Math.sign(gm) === Math.sign(ga)){ a = m; ga = gm; } else b = m; } return (a + b) / 2; };
    const add = (x, y, kind) => { if(!Number.isFinite(x) || !Number.isFinite(y)) return; if(out.some(p => Math.abs(X(p.x) - X(x)) < 3 && Math.abs(Y(p.y) - Y(y)) < 3)) return; out.push({ x: Math.abs(x) < 1e-9 * (x1 - x0) ? 0 : x, y: Math.abs(y) < 1e-9 * (x1 - x0) ? 0 : y, kind }); };
    let px = x0, py = f(px);
    const slope = x => (f(x + dx / 50) - f(x - dx / 50));
    let ps = slope(px);
    for(let i = 1; i <= N; i++){
      const x = x0 + i * dx, y = f(x), s = slope(x);
      if(Number.isFinite(y) && Number.isFinite(py)){
        if(y === 0) add(x, 0, "root");
        else if(Math.sign(y) !== Math.sign(py) && Math.abs(y - py) < (Math.abs(y) + Math.abs(py)) * 4 + 1e-9){ const r = bis(f, px, x); if(r != null && Math.abs(f(r)) < 1e-6 * (1 + Math.abs(py) + Math.abs(y))) add(r, 0, "root"); }
        if(Number.isFinite(s) && Number.isFinite(ps) && Math.sign(s) !== Math.sign(ps) && s !== 0){ const r = bis(slope, px, x); if(r != null){ const yr = f(r); if(Math.abs(Y(yr) - Y(f(r - dx)) ) < H / 2) add(r, yr, s < 0 ? "max" : "min"); } }
      }
      px = x; py = y; ps = s;
    }
    if(x0 < 0 && x1 > 0) add(0, f(0), "y");
    // crossings with the other graphs on screen
    for(const it of S.items){ const b = A.items[it.id]; if(it.id === id || it.hidden || !b || !(b.kind === "fx" || b.kind === "fit")) continue;
      const g = x => f(x) - b.fx(x); let gx = x0, gy = g(gx);
      for(let i = 1; i <= N; i++){ const x = x0 + i * dx, y = g(x); if(Number.isFinite(y) && Number.isFinite(gy) && Math.sign(y) !== Math.sign(gy) && Math.abs(y - gy) < (Math.abs(y) + Math.abs(gy)) * 4 + 1e-9){ const r = bis(g, gx, x); if(r != null && Math.abs(g(r)) < 1e-6 * (1 + Math.abs(f(r)))) add(r, f(r), "cross"); } gx = x; gy = y; } }
    return out.slice(0, 60);
  }

  /* ---------- the list of expressions ---------- */
  function renderList(){
    list.innerHTML = S.items.map((it, k) => it.type === "table" ? tableHTML(it) : `<div class="bg-it ${sel === it.id ? "sel" : ""}" data-id="${it.id}">
      <button type="button" class="bg-dot ${it.hidden ? "off" : ""}" style="--c:${it.color}" data-act="hide" title="${it.hidden ? "Show" : "Hide"} this graph" aria-label="Show or hide"></button>
      <div class="bg-main"><input class="bg-in" value="${esc(it.text || "")}" spellcheck="false" autocomplete="off" placeholder="${k === 0 ? "Type y = 2x + 1" : ""}" aria-label="Expression ${k + 1}">
        <div class="bg-st"></div></div>
      <div class="bg-acts"><button type="button" data-act="tbl" title="Table of values">▦</button><button type="button" data-act="del" title="Delete">✕</button></div></div>`).join("");
    status();
  }
  // the fits of a table that show their residuals (each adds a column e1, e1b…)
  const residFits = it => S.items.filter(f => f.resid && A && A.items[f.id] && A.items[f.id].kind === "fit" && A.items[f.id].tbl === it.id);
  function tableHTML(it){
    const n = Math.max(...it.cols.map(c => (c.vals || []).length), 0), RF = residFits(it);
    const rows = []; for(let i = 0; i <= n; i++) rows.push(i);
    return `<div class="bg-it bg-tbl" data-id="${it.id}">
      <button type="button" class="bg-dot ${it.hidden ? "off" : ""}" style="--c:${it.color}" data-act="hide" title="Show or hide the points" aria-label="Show or hide"></button>
      <div class="bg-main"><table><tr>${it.cols.map(c => `<th>${esc(c.name)}${c.ref ? `<small> = graph ${S.items.findIndex(x => x.id === c.ref) + 1}</small>` : ""}</th>`).join("")}${RF.map((f, k) => `<th class="res" style="color:${f.color}" title="Residuals: ${esc(A.items[f.id].yName)} − the fitted value">e${it.n || 1}${k ? String.fromCharCode(97 + k) : ""}</th>`).join("")}</tr>
        ${rows.map(i => `<tr>${it.cols.map((c, ci) => c.ref ? `<td class="ref" data-r="${i}" data-c="${ci}"></td>` : `<td><input data-r="${i}" data-c="${ci}" value="${esc((c.vals || [])[i] ?? "")}" inputmode="decimal" aria-label="${esc(c.name)} row ${i + 1}"></td>`).join("")}${RF.map(f => `<td class="ref res" data-res="${f.id}" data-r="${i}"></td>`).join("")}</tr>`).join("")}</table>
        <div class="bg-fit">${it.cols.some(c => c.ref) ? "" : `<select data-act="fit" aria-label="Fit a model"><option value="">Fit ▾</option>${BG_FITS.map(([nm]) => `<option>${nm}</option>`).join("")}</select>`}<button type="button" class="btn sm" data-act="col">＋ column</button><button type="button" class="btn sm" data-act="zfit" title="Move and zoom the graph to these points">🔍 Zoom to fit</button><button type="button" class="btn sm ${it.stats ? "on" : ""}" data-act="stats" aria-pressed="${!!it.stats}">📊 Statistics</button></div>
        <div class="bg-stats"></div></div>
      <div class="bg-acts"><button type="button" data-act="del" title="Delete">✕</button></div></div>`;
  }
  // the line under each expression: errors, values, sliders, fits
  function status(){
    for(const it of S.items){
      const el = list.querySelector(`.bg-it[data-id="${it.id}"]`); if(!el) continue;
      const a = A && A.items[it.id], st = el.querySelector(".bg-st");
      if(it.type === "table"){ const sb = el.querySelector(".bg-stats");
        if(sb){ if(!it.stats || !A) sb.innerHTML = ""; else { const rows = A.rows[it.id] || [], C = it.cols.map(c => ({ n: c.name, L: rows.map(r => r[c.name]).filter(Number.isFinite) }));
          const R2 = [["n", L => L.length], ["mean", L => BC_STATS.run("mean", L)], ["median", L => BC_STATS.run("median", L)], ["min", L => BC_STATS.run("min", L)], ["Q1", L => BC_STATS.quartile(L, 1)], ["Q3", L => BC_STATS.quartile(L, 3)], ["max", L => BC_STATS.run("max", L)], ["s", L => BC_STATS.run("stdev", L)], ["σ", L => BC_STATS.run("stdevp", L)]];
          sb.innerHTML = `<table><tr><th></th>${C.map(c => `<th>${esc(c.n)}</th>`).join("")}</tr>${R2.map(([nm, f]) => `<tr><th>${nm}</th>${C.map(c => `<td>${c.L.length ? esc(BCalc.fmt(f(c.L), 5)) : ""}</td>`).join("")}</tr>`).join("")}</table>`
            + (C.length >= 2 && C[0].L.length > 1 && C[1].L.length === C[0].L.length ? `<div class="hint">r (correlation of ${esc(C[0].n)} and ${esc(C[1].n)}) = ${esc(BCalc.fmt(corr(C[0].L, C[1].L), 4))}</div>` : ""); } }
        el.querySelectorAll("td.ref:not(.res)").forEach(td => { const c = it.cols[+td.dataset.c], rows = A && A.rows[it.id], rw = rows && rows[+td.dataset.r]; td.textContent = rw && Number.isFinite(rw[c.name]) ? fmt4(rw[c.name]) : ""; });
        el.querySelectorAll("td.res").forEach(td => { const f = A && A.items[+td.dataset.res], rw = A && (A.rows[it.id] || [])[+td.dataset.r], k = f && f.rowsUsed ? f.rowsUsed.indexOf(rw) : -1; td.textContent = k >= 0 ? fmt4(f.resid[k][1]) : ""; });
        continue; }
      el.classList.toggle("bad", !!(a && a.kind === "err"));
      if(a && a.kind === "polar"){ const th = polarRange(it), u = S.deg ? "°" : "";
        if(!st.querySelector(".bg-th")) st.innerHTML = `<div class="bg-sl bg-th"><input type="number" class="tmn" value="${+th[0].toFixed(4)}" aria-label="Smallest θ"><span>≤ θ ≤</span><input type="number" class="tmx" value="${+th[1].toFixed(4)}" aria-label="Largest θ"><span>${u}</span></div>`; continue; }
      if(a && a.kind === "box"){ st.innerHTML = ["min", "Q1", "median", "Q3", "max"].map((n, k) => `<span class="pr">${n} ${esc(BCalc.fmt(a.q[k], 6))}</span>`).join(" ") + ` <span class="pr r2">n = ${a.n}</span>`; continue; }
      if(a && a.kind === "hist"){ st.innerHTML = `<span class="pr">${a.bins.length} bars of width ${esc(BCalc.fmt(a.w, 6))}</span> <span class="pr r2">n = ${a.n}</span>`; continue; }
      if(a && a.kind === "list"){ st.innerHTML = `<span class="pr">list of ${a.v.length}</span>`; continue; }
      if(!a || a.kind === "empty" || a.kind === "fx" && !a.shade || a.kind === "fy" || a.kind === "pts" || a.kind === "def" || a.kind === "imp"){ st.innerHTML = a && a.kind === "fx" && S.deg && /sin|cos|tan/.test(it.text) && V.s > 2 ? `<span class="hint">Degrees: zoom out (－) to see the wave, or switch to RAD.</span>` : ""; continue; }
      if(a.kind === "fx" && a.shade){ st.innerHTML = ""; continue; }
      if(a.kind === "err") st.innerHTML = `<span class="e">${esc(a.msg)}</span>${(a.free || []).map(v => ` <button type="button" class="btn sm" data-slider="${esc(v)}">＋ slider ${esc(v)}</button>`).join("")}`;
      else if(a.kind === "value") st.innerHTML = `<b>= ${esc(BCalc.fmt(a.v))}</b>`;
      else if(a.kind === "const"){
        if(a.slider){ const sl = it.sl || (it.sl = { min: -10, max: 10, step: .1 });
          st.innerHTML = `<div class="bg-sl"><input type="number" class="mn" value="${sl.min}" aria-label="Smallest ${esc(a.name)}"><input type="range" min="${sl.min}" max="${sl.max}" step="${sl.step}" value="${a.v}" aria-label="Slider ${esc(a.name)}"><input type="number" class="mx" value="${sl.max}" aria-label="Largest ${esc(a.name)}"></div>`; }
        else st.innerHTML = `<b>= ${esc(BCalc.fmt(a.v))}</b>`;
      }
      else if(a.kind === "fit") st.innerHTML = Object.entries(a.params).map(([k, v]) => `<span class="pr">${esc(k)} = ${esc(BCalc.fmt(v, 6))}</span>`).join(" ") + ` <span class="pr r2">R² = ${esc(BCalc.fmt(a.r2, 4))}</span>`
        + ` <button type="button" class="btn sm ${it.resid ? "on" : ""}" data-act="resid" aria-pressed="${!!it.resid}" title="Residuals: how far each point is from the fitted graph (y − the fitted value)">📉 Residuals${it.resid ? " ✓" : ""}</button>`;
    }
  }
  function update(rebuild){ A = analyse(); if(rebuild) renderList(); else status(); draw(); save(); }

  /* ---------- editing ---------- */
  list.addEventListener("input", e => {
    const el = e.target.closest(".bg-it"); if(!el) return; const it = S.items.find(i => i.id === +el.dataset.id); if(!it) return;
    if(e.target.classList.contains("bg-in")){ it.text = e.target.value.replace(/<=/g, "≤").replace(/>=/g, "≥"); if(it.text !== e.target.value){ const p = e.target.selectionStart - 1; e.target.value = it.text; e.target.setSelectionRange(p, p); } sel = it.id; label = null; update(false); return; }
    if(e.target.type === "range"){ const [l] = splitRel(it.text); it.text = l.trim() + " = " + (+e.target.value); el.querySelector(".bg-in").value = it.text; update(false); return; }
    if(e.target.classList.contains("tmn") || e.target.classList.contains("tmx")){ const th = polarRange(it); it.th = { min: th[0], max: th[1] }; const v = +e.target.value; if(Number.isFinite(v)) it.th[e.target.classList.contains("tmn") ? "min" : "max"] = v; update(false); return; }
    if(e.target.classList.contains("mn") || e.target.classList.contains("mx")){ const sl = it.sl; sl[e.target.classList.contains("mn") ? "min" : "max"] = +e.target.value; const r = el.querySelector("input[type=range]"); r.min = sl.min; r.max = sl.max; sl.step = Math.max((sl.max - sl.min) / 200, 1e-6); r.step = sl.step; save(); return; }
    if(e.target.dataset.r != null){ const c = it.cols[+e.target.dataset.c], r = +e.target.dataset.r; c.vals = c.vals || []; c.vals[r] = e.target.value;
      const n = Math.max(...it.cols.map(x => (x.vals || []).length)); if(r === n - 1 && e.target.value){ update(false); const tb = el.querySelector("table"); if(!tb.querySelector(`input[data-r="${n}"]`)){ const tr = document.createElement("tr"); tr.innerHTML = it.cols.map((cc, ci) => cc.ref ? `<td class="ref" data-r="${n}" data-c="${ci}"></td>` : `<td><input data-r="${n}" data-c="${ci}" inputmode="decimal" aria-label="${esc(cc.name)} row ${n + 1}"></td>`).join(""); tb.appendChild(tr); } }
      else update(false);
      autoFit(it); }
  });
  list.addEventListener("focusin", e => { if(e.target.matches("input")) lastInput = e.target; const el = e.target.closest(".bg-it"); if(el && e.target.classList.contains("bg-in")){ sel = +el.dataset.id; list.querySelectorAll(".bg-it").forEach(x => x.classList.toggle("sel", x === el)); draw(); } });
  list.addEventListener("keydown", e => {
    if(!e.target.classList.contains("bg-in")) return;
    const el = e.target.closest(".bg-it"), i = S.items.findIndex(x => x.id === +el.dataset.id);
    if(e.key === "Enter"){ e.preventDefault(); const it = { id: S.nid++, type: "expr", text: "", color: nextColor() }; S.items.splice(i + 1, 0, it); sel = it.id; update(true); list.querySelector(`.bg-it[data-id="${it.id}"] .bg-in`).focus(); }
    else if(e.key === "Backspace" && !e.target.value && S.items.length > 1){ e.preventDefault(); S.items.splice(i, 1); update(true); const p = list.querySelectorAll(".bg-in")[Math.max(0, i - 1)]; if(p) p.focus(); }
    else if(e.key === "ArrowDown" || e.key === "ArrowUp"){ const all = [...list.querySelectorAll(".bg-in")], k = all.indexOf(e.target) + (e.key === "ArrowDown" ? 1 : -1); if(all[k]){ e.preventDefault(); all[k].focus(); } }
  });
  list.addEventListener("click", e => {
    const el = e.target.closest(".bg-it"); const it = el && S.items.find(i => i.id === +el.dataset.id);
    const sb = e.target.closest("[data-slider]");
    if(sb){ const v = sb.dataset.slider; let at = S.items.indexOf(it);
      while(S.items[at + 1] && S.items[at + 1].type === "expr" && /^\s*[a-zA-Z]\s*=\s*-?[\d.]+\s*$/.test(S.items[at + 1].text || "")) at++;      // after the sliders already there, in order
      S.items.splice(at + 1, 0, { id: S.nid++, type: "expr", text: v + " = 1", color: nextColor(), sl: { min: -10, max: 10, step: .1 } }); update(true); return; }
    const b = e.target.closest("[data-act]"); if(!b || !it) return;
    const act = b.dataset.act;
    if(act === "hide"){ it.hidden = !it.hidden; b.classList.toggle("off", it.hidden); update(false); }
    else if(act === "del"){ S.items.splice(S.items.indexOf(it), 1); if(!S.items.length) S.items.push({ id: S.nid++, type: "expr", text: "", color: BG_COLORS[0] }); if(sel === it.id) sel = null; update(true); }
    else if(act === "tbl"){ const a = A && A.items[it.id]; if(!a || a.kind !== "fx"){ toast("Type a graph of x first (like y = 2x + 1)."); return; } const n = tableNum(); S.items.splice(S.items.indexOf(it) + 1, 0, { id: S.nid++, type: "table", n, color: it.color, cols: [{ name: "x" + n, vals: ["-2", "-1", "0", "1", "2"] }, { name: "y" + n, ref: it.id }] }); update(true); }
    else if(act === "stats"){ it.stats = !it.stats; update(true); }
    else if(act === "zfit"){ zoomFit(tablePts(it)); }
    else if(act === "resid"){ it.resid = !it.resid; update(true); const a = A.items[it.id];
      if(a && a.kind === "fit"){ const t = S.items.find(x => x.id === a.tbl); zoomFit(it.resid ? a.resid : tablePts(t)); }
      toast(it.resid ? "Residuals: the column e" + ((S.items.find(x => x.id === (a && a.tbl)) || {}).n || 1) + " in the table, and the hollow dots on the graph." : "Residuals hidden."); }
    else if(act === "col"){ const n = it.n || tableNum(), k = it.cols.length, L = ["x", "y", "z", "w", "u", "v"][k]; if(!L){ toast("A table can have up to 6 columns."); return; } it.cols.push({ name: L + n, vals: [] }); update(true); }
  });
  list.addEventListener("change", e => {
    if(e.target.dataset.act !== "fit" || !e.target.value) return;
    const el = e.target.closest(".bg-it"), it = S.items.find(i => i.id === +el.dataset.id), f = BG_FITS.find(x => x[0] === e.target.value);
    if(it && f && it.cols.length >= 2){
      // the model's letters (m, b, a, c) — any already in use get the next free letter
      const taken = new Set([...Object.keys((A && A.vars) || {}), ...Object.keys((A && A.fns) || {}), "x", "y", "e"]), free = [..."mbacdkpqstuvwnhgj"].filter(c => !taken.has(c) && !RESERVED.has(c));   // never r (polar graphs), e or θ
      const map = {}; const model = f[1].replace(/\b([mbac])\b/g, L => { if(!taken.has(L) && !Object.values(map).includes(L)){ map[L] = L; return L; } if(!map[L]){ map[L] = free.find(c => !Object.values(map).includes(c) && !"mbac".includes(c)) || free.shift(); } return map[L]; });
      const xs = it.cols[0].name, ys = it.cols[1].name;
      S.items.splice(S.items.indexOf(it) + 1, 0, { id: S.nid++, type: "expr", text: ys + " ~ " + model.replace(/X/g, xs), color: nextColor() }); sel = S.nid - 1; update(true);
    }
    e.target.value = "";
  });
  const tableNum = () => { const used = new Set(S.items.filter(i => i.type === "table").map(i => i.n)); let n = 1; while(used.has(n)) n++; return n; };
  box.querySelector(".bg-tools").addEventListener("click", e => {
    const b = e.target.closest("button"); if(!b) return;
    if(b.dataset.add === "expr"){ const it = { id: S.nid++, type: "expr", text: "", color: nextColor() }; S.items.push(it); sel = it.id; update(true); list.querySelector(`.bg-it[data-id="${it.id}"] .bg-in`).focus(); }
    else if(b.dataset.add === "table"){ const n = tableNum(); S.items.push({ id: S.nid++, type: "table", n, color: nextColor(), cols: [{ name: "x" + n, vals: [] }, { name: "y" + n, vals: [] }] }); update(true); const f = list.querySelector(`.bg-it[data-id="${S.nid - 1}"] input`); if(f) f.focus(); }
    else if(b.classList.contains("bg-deg")){ S.deg = !S.deg; b.textContent = S.deg ? "DEG" : "RAD"; S.items.forEach(i => { if(i.th) i.th = { min: S.deg ? i.th.min * 180 / Math.PI : i.th.min * Math.PI / 180, max: S.deg ? i.th.max * 180 / Math.PI : i.th.max * Math.PI / 180 }; }); update(true); }
  });
  box.querySelector(".bg-sym").addEventListener("click", e => {
    const b = e.target.closest("[data-s]"); if(!b) return;
    const inp = lastInput && document.body.contains(lastInput) ? lastInput : list.querySelector(".bg-in"); if(!inp) return;
    let t = b.dataset.s; if(t === "x²") t = "^2"; if(t === "√") t = "sqrt(";
    const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a;
    inp.value = inp.value.slice(0, a) + t + inp.value.slice(z); const c = a + t.length; inp.focus(); inp.setSelectionRange(c, c);
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });

  /* ---------- moving around the graph ---------- */
  // one redraw per screen frame, however many wheel / pointer events arrive
  let frame = 0; const redraw = () => { if(!frame) frame = requestAnimationFrame(() => { frame = 0; draw(); }); };
  // glide to a view (buttons, zoom to fit)
  let glide = 0;
  function goTo(t){
    cancelAnimationFrame(glide); const f = { cx: V.cx, cy: V.cy, s: V.s, r: V.r || 1 }, t0 = performance.now(), D = 220;
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3);
      V.cx = f.cx + (t.cx - f.cx) * e; V.cy = f.cy + (t.cy - f.cy) * e; V.s = f.s * Math.pow(t.s / f.s, e); V.r = f.r * Math.pow((t.r || 1) / f.r, e);
      draw(); if(k < 1) glide = requestAnimationFrame(step); else { if(Math.abs(V.r - 1) < 1e-9) delete V.r; status(); save(); } };
    glide = requestAnimationFrame(step);
  }
  const tablePts = it => { const a = it && A && A.items[it.id]; return a && a.kind === "table" ? a.sets.flatMap(s => s.pts) : []; };
  // every point on the screen with a margin; x and y get their own scales when they need very different ones (years against marks)
  function zoomFit(pts){
    pts = (pts || []).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if(!pts.length){ toast("Type some points in the table first."); return; }
    if(!W) size();
    let x0 = Math.min(...pts.map(p => p[0])), x1 = Math.max(...pts.map(p => p[0])), y0 = Math.min(...pts.map(p => p[1])), y1 = Math.max(...pts.map(p => p[1]));
    const pad = (a, b) => { const d = b - a || Math.max(1, Math.abs(a) * .2); return [a - d * .15, b + d * .15]; };
    [x0, x1] = pad(x0, x1); [y0, y1] = pad(y0, y1);
    // keep 0 in view when the data is close to it, as a person would
    if(x0 > 0 && x0 < (x1 - x0) * .6) x0 = -(x1 - x0) * .05; if(x1 < 0 && -x1 < (x1 - x0) * .6) x1 = (x1 - x0) * .05;
    if(y0 > 0 && y0 < (y1 - y0) * .6) y0 = -(y1 - y0) * .05; if(y1 < 0 && -y1 < (y1 - y0) * .6) y1 = (y1 - y0) * .05;
    const sx = W / (x1 - x0), sy = H / (y1 - y0), q = sy / sx;
    const same = q > .4 && q < 2.5, s = same ? Math.min(sx, sy) : sx;
    goTo({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(1e6, Math.max(1e-6, s)), r: same ? 1 : q });
  }
  // typing data far from what's on the screen: the graph moves there by itself (once you pause)
  let autoT = null;
  function autoFit(it){
    clearTimeout(autoT);
    autoT = setTimeout(() => { const pts = tablePts(it); if(pts.length < 2 || !W) return;
      const seen = pts.filter(p => { const px = X(p[0]), py = Y(p[1]); return px >= 0 && px <= W && py >= 0 && py <= H; }).length;
      if(seen < pts.length / 2) zoomFit(pts); }, 900);
  }
  const P = new Map(); let drag = null, pinch = null;
  function hitCurve(px, py){
    let best = null;
    for(const it of S.items){ const a = A && A.items[it.id]; if(it.hidden || !a || !(a.kind === "fx" || a.kind === "fit")) continue; const y = a.fx(ux(px)), d = Math.abs(Y(y) - py); if(Number.isFinite(d) && d < 12 && (!best || d < best.d)) best = { d, it, a }; }
    return best;
  }
  function hitPoint(px, py){
    const near = (x, y) => Math.hypot(X(x) - px, Y(y) - py) < 11;
    const k = KP.find(p => near(p.x, p.y)); if(k) return { x: k.x, y: k.y, color: "#555" };
    for(const it of S.items){ const a = A && A.items[it.id]; if(it.hidden || !a) continue;
      if(a.kind === "pts"){ const p = a.pts.find(q => near(q[0], q[1])); if(p) return { x: p[0], y: p[1], color: it.color }; }
      if(a.kind === "table") for(const s of a.sets){ const p = s.pts.find(q => near(q[0], q[1])); if(p) return { x: p[0], y: p[1], color: s.color }; } }
    return null;
  }
  cv.addEventListener("pointerdown", e => {
    cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
    P.set(e.pointerId, { x: px, y: py });
    cancelAnimationFrame(glide);
    if(P.size === 2){ const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: V.s, cx: V.cx, cy: V.cy, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; drag = null; return; }
    const hp = hitPoint(px, py); if(hp){ label = hp; drag = { mode: "none", x0: px, y0: py }; draw(); return; }
    const hc = hitCurve(px, py);
    if(hc){ sel = hc.it.id; list.querySelectorAll(".bg-it").forEach(x => x.classList.toggle("sel", +x.dataset.id === sel)); const x = ux(px); label = { x, y: hc.a.fx(x), color: hc.it.color }; drag = { mode: "trace", a: hc.a, color: hc.it.color }; draw(); return; }
    drag = { mode: "pan", x0: px, y0: py, cx: V.cx, cy: V.cy, moved: false };
  });
  cv.addEventListener("pointermove", e => {
    if(!P.has(e.pointerId)) return; const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top; P.set(e.pointerId, { x: px, y: py });
    if(pinch && P.size === 2){ const [a, b] = [...P.values()], d = Math.hypot(a.x - b.x, a.y - b.y); const ns = Math.min(1e6, Math.max(1e-4, pinch.s * d / pinch.d)); const r = V.r || 1, mx = pinch.cx + (pinch.mx - W / 2) / pinch.s, my = pinch.cy - (pinch.my - H / 2) / (pinch.s * r); V.s = ns; V.cx = mx - (pinch.mx - W / 2) / ns; V.cy = my + (pinch.my - H / 2) / (ns * r); redraw(); return; }
    if(!drag) return;
    if(drag.mode === "pan"){ V.cx = drag.cx - (px - drag.x0) / V.s; V.cy = drag.cy + (py - drag.y0) / SY(); if(Math.abs(px - drag.x0) + Math.abs(py - drag.y0) > 3) drag.moved = true; redraw(); }
    else if(drag.mode === "trace"){ const x = ux(px), y = drag.a.fx(x); if(Number.isFinite(y)){ label = { x, y, color: drag.color }; draw(); } }
  });
  const up = e => { P.delete(e.pointerId); if(P.size < 2) pinch = null; if(drag && drag.mode === "pan" && !drag.moved){ label = null; draw(); } if(!P.size){ drag = null; save(); } };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  // wheel / trackpad: a notch zooms about ×1.35; lines (Firefox) and pages are turned into pixels; a trackpad pinch (Ctrl + wheel) is quicker
  cv.addEventListener("wheel", e => { e.preventDefault(); cancelAnimationFrame(glide);
    const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, mx = ux(px), my = uy(py);
    const d = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? H : 1), k = Math.exp(-Math.max(-300, Math.min(300, d)) * (e.ctrlKey ? .01 : .003));
    V.s = Math.min(1e6, Math.max(1e-6, V.s * k)); V.cx = mx - (px - W / 2) / V.s; V.cy = my + (py - H / 2) / SY(); redraw(); save(); }, { passive: false });
  box.querySelector(".bg-zoom").addEventListener("click", e => {
    const z = e.target.closest("[data-z]"); if(!z) return;
    if(z.dataset.z === "home") goTo({ cx: 0, cy: 0, s: 40, r: 1 });
    else if(z.dataset.z === "fit"){ const pts = S.items.filter(i => !i.hidden).flatMap(i => { const a = A && A.items[i.id]; return !a ? [] : a.kind === "table" ? a.sets.flatMap(s => s.pts) : a.kind === "pts" ? a.pts : []; }); if(pts.length) zoomFit(pts); else goTo({ cx: 0, cy: 0, s: 40, r: 1 }); }
    else goTo({ cx: V.cx, cy: V.cy, s: V.s * (z.dataset.z === "in" ? 1.6 : 1 / 1.6), r: V.r || 1 });
  });
  new ResizeObserver(() => { size(); draw(); }).observe(plot);
  update(true);
  return { focus: () => { const f = list.querySelector(".bg-in"); if(f) f.focus(); }, analyse: () => analyse(), state: S };
}
