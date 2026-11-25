/* ---------------- 🧮 BEEcalc: an offline calculator inside the student file ----------------
   One small maths engine (tokenise → parse → a tree of plain JavaScript closures; nothing typed is ever run
   as code) shared by the Basic, Scientific and Graphing calculators. Degrees by default. */
const BC_FN = {
  sin: 1, cos: 1, tan: 1, asin: 1, acos: 1, atan: 1, arcsin: 1, arccos: 1, arctan: 1, sinh: 1, cosh: 1, tanh: 1,
  sec: 1, csc: 1, cot: 1, sqrt: 1, cbrt: 1, ln: 1, log: 1, exp: 1, abs: 1, floor: 1, ceil: 1, round: 1, sign: 1, nroot: 2, mod: 2, min: 1, max: 1,
  // statistics: a list [1, 2, 3], a table column (x1) or numbers
  mean: 1, median: 1, mode: 1, sum: 1, count: 1, range: 1, stdev: 1, stdevp: 1, var: 1, varp: 1, quartile: 2, total: 1,
  boxplot: 1, histogram: 1
};
const BC_LISTFN = new Set(["mean", "median", "mode", "sum", "count", "range", "stdev", "stdevp", "var", "varp", "quartile", "total", "min", "max", "boxplot", "histogram"]);
// the statistics, as taught at school (quartiles: median of each half, the middle value left out, like most calculators)
const BC_STATS = (() => {
  const sorted = L => L.slice().sort((a, b) => a - b);
  const med = S => { const n = S.length; return n ? (n % 2 ? S[(n - 1) / 2] : (S[n / 2 - 1] + S[n / 2]) / 2) : NaN; };
  const mean = L => L.length ? L.reduce((a, b) => a + b, 0) / L.length : NaN;
  const ss = L => { const m = mean(L); return L.reduce((a, b) => a + (b - m) ** 2, 0); };
  function quartile(L, q){ const S = sorted(L), n = S.length; if(!n) return NaN; if(q <= 0) return S[0]; if(q >= 4) return S[n - 1]; if(q === 2) return med(S);
    const lo = S.slice(0, Math.floor(n / 2)), hi = S.slice(Math.ceil(n / 2)); return med(q === 1 ? lo : hi); }
  function mode(L){ const c = new Map(); L.forEach(v => c.set(v, (c.get(v) || 0) + 1)); let best = NaN, n = 1; c.forEach((k, v) => { if(k > n){ n = k; best = v; } }); return best; }
  return { sorted, med, mean, quartile, mode,
    run(f, L, extra){
      switch(f){
        case "mean": return mean(L); case "median": return med(sorted(L)); case "mode": return mode(L);
        case "sum": case "total": return L.reduce((a, b) => a + b, 0); case "count": return L.length;
        case "min": return L.length ? Math.min(...L) : NaN; case "max": return L.length ? Math.max(...L) : NaN;
        case "range": return L.length ? Math.max(...L) - Math.min(...L) : NaN;
        case "stdev": return L.length > 1 ? Math.sqrt(ss(L) / (L.length - 1)) : NaN; case "stdevp": return L.length ? Math.sqrt(ss(L) / L.length) : NaN;
        case "var": return L.length > 1 ? ss(L) / (L.length - 1) : NaN; case "varp": return L.length ? ss(L) / L.length : NaN;
        case "quartile": return quartile(L, extra);
      }
      return NaN;
    } };
})();
const BC_CONST = { pi: Math.PI, "π": Math.PI, tau: 2 * Math.PI, "τ": 2 * Math.PI };
const BCalc = (() => {
  "use strict";
  class CalcError extends Error {}
  const err = m => { throw new CalcError(m); };
  // ---- tokens
  function tokenize(src, known){
    const s = String(src).replace(/\s+/g, " ").replace(/[×·∙]/g, "*").replace(/[÷]/g, "/").replace(/[−–—]/g, "-").replace(/≤/g, "<=").replace(/≥/g, ">=")
      .replace(/√/g, " sqrt ").replace(/∛/g, " cbrt ").replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁻¹/g, "^-1").replace(/\*\*/g, "^");
    const T = []; let i = 0;
    const names = Object.keys(BC_FN).concat(Object.keys(BC_CONST), ["ans", "Ans", "e"]).sort((a, b) => b.length - a.length);
    while(i < s.length){
      const c = s[i];
      if(c === " "){ i++; continue; }
      const num = s.slice(i).match(/^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/);
      if(num){ T.push({ t: "num", v: parseFloat(num[0]) }); i += num[0].length; continue; }
      if(/[a-zA-Zπτθ]/.test(c)){
        const rest = s.slice(i);
        // longest known name first (sin, sqrt, pi, ans…), then a variable: one letter (+ digits if that name is known, e.g. x1)
        const kn = names.find(n => rest.startsWith(n));
        const v = rest.match(/^[a-zA-Zθ](\d+|_\d+)?/), vName = v && v[0].replace("_", "");
        if(v && v[1] && known && known.has(vName)){ T.push({ t: "id", v: vName }); i += v[0].length; continue; }     // data columns: x1, y1
        if(kn){ T.push(BC_FN[kn] ? { t: "fn", v: kn } : { t: "id", v: kn === "Ans" ? "ans" : kn }); i += kn.length; continue; }
        T.push({ t: "id", v: rest[0] }); i++; continue;
      }
      const op = s.slice(i).match(/^(<=|>=|[+\-*/^!%(),=<>~|\[\]])/);
      if(op){ T.push({ t: "op", v: op[0] }); i += op[0].length; continue; }
      err("I don't understand “" + c + "”");
    }
    return T;
  }
  // ---- parser (precedence climbing); implicit multiplication like 2x, 3(4), (2)(3), 2π, x sin x
  function parse(src, known){
    const T = tokenize(src, known); let p = 0, bars = 0;
    const peek = () => T[p], next = () => T[p++];
    const isOp = (t, v) => t && t.t === "op" && t.v === v;
    const startsOperand = t => t && (t.t === "num" || t.t === "id" || t.t === "fn" || isOp(t, "(") || isOp(t, "[") || (isOp(t, "|") && bars === 0));
    function primary(){
      const t = next(); if(!t) err("Something is missing at the end");
      if(t.t === "num") return { k: "num", v: t.v };
      if(t.t === "id"){
        if(isOp(peek(), "(")){ next(); const a = expr(); if(isOp(peek(), ",")){ next(); const b = expr(); if(!isOp(next(), ")")) err("A bracket is missing"); return { k: "mul", a: { k: "var", v: t.v }, b: { k: "point", a, b } }; }
          if(!isOp(next(), ")")) err("A bracket is missing"); return { k: "call", v: t.v, a }; }         // f(x): a function of yours, or a × (…)
        return { k: "var", v: t.v };
      }
      if(t.t === "fn"){
        let pow = null;
        if(isOp(peek(), "^")){ next(); pow = unary(); }                 // sin^2 x
        let args;
        if(isOp(peek(), "(")){ next(); args = [expr()]; while(isOp(peek(), ",")){ next(); args.push(expr()); } if(!isOp(next(), ")")) err("A bracket is missing"); }
        else args = [implicitTerm()];                                     // sin 30, √2
        if(args.length < BC_FN[t.v] && !(t.v === "log" && args.length === 1)) err(t.v + " needs " + BC_FN[t.v] + " numbers" + (t.v === "quartile" ? " (a list and 1, 2 or 3)" : ""));
        let n = { k: "fn", f: t.v, a: args };
        if(pow){ if(pow.k === "neg" && pow.a.k === "num" && pow.a.v === 1) n = { k: "fn", f: { sin: "asin", cos: "acos", tan: "atan" }[t.v] || t.v, a: args, inv: !{ sin: 1, cos: 1, tan: 1 }[t.v] }; else n = { k: "pow", a: n, b: pow }; }
        if(n.inv) n = { k: "pow", a: { k: "fn", f: t.v, a: args }, b: { k: "num", v: -1 } };
        return n;
      }
      if(isOp(t, "(")){ const e = expr(); if(isOp(peek(), ",")){ next(); const e2 = expr(); if(!isOp(next(), ")")) err("A bracket is missing"); return { k: "point", a: e, b: e2 }; } if(!isOp(next(), ")")) err("A bracket is missing"); return e; }
      if(isOp(t, "[")){        // [1, 2, 3] is a list; [2 + 3] is just brackets
        const items = [expr()]; while(isOp(peek(), ",")){ next(); items.push(expr()); }
        if(!isOp(next(), "]")) err("A ] is missing");
        return items.length > 1 ? { k: "list", items } : items[0];
      }
      if(isOp(t, "|")){ bars++; const e = expr(); if(!isOp(next(), "|")) err("A | is missing"); bars--; return { k: "fn", f: "abs", a: [e] }; }
      if(isOp(t, "-")) return { k: "neg", a: power() };
      if(isOp(t, "+")) return power();
      err("Something is missing before “" + t.v + "”");
    }
    function postfix(){
      let n = primary();
      for(;;){
        if(isOp(peek(), "!")){ next(); n = { k: "fact", a: n }; continue; }
        if(isOp(peek(), "%")){ next(); n = { k: "pct", a: n }; continue; }
        return n;
      }
    }
    function power(){ const b = postfix(); if(isOp(peek(), "^")){ next(); return { k: "pow", a: b, b: unary() }; } return b; }
    function unary(){ if(isOp(peek(), "-")){ next(); return { k: "neg", a: unary() }; } if(isOp(peek(), "+")){ next(); return unary(); } return power(); }
    function implicitTerm(){ let n = power(); while(startsOperand(peek()) && !isOp(peek(), "|") && peek().t !== "fn"){ n = { k: "mul", a: n, b: power() }; } return n; }
    function term(){
      let n = unary();
      for(;;){
        const t = peek();
        if(isOp(t, "*") || isOp(t, "/")){ next(); const r = unary(); n = { k: t.v === "*" ? "mul" : "div", a: n, b: r }; continue; }
        if(startsOperand(t)){ n = { k: "mul", a: n, b: power() }; continue; }
        return n;
      }
    }
    function expr(){
      let n = term();
      for(;;){ const t = peek(); if(isOp(t, "+") || isOp(t, "-")){ next(); n = { k: t.v === "+" ? "add" : "sub", a: n, b: term() }; } else return n; }
    }
    const tree = expr();
    if(p < T.length){ const t = T[p]; err(t.t === "op" && (t.v === ")" || t.v === "]") ? "There is an extra " + t.v : "I don't understand “" + t.v + "” here"); }
    return tree;
  }
  // ---- evaluation (closures over a small environment: vars, functions, degrees)
  const fact = n => { if(n < 0 || n !== Math.floor(n)) return NaN; if(n > 170) return Infinity; let r = 1; for(let i = 2; i <= n; i++) r *= i; return r; };
  function compile(node){
    switch(node.k){
      case "num": { const v = node.v; return () => v; }
      case "var": { const v = node.v; return env => {
        if(env.vars && v in env.vars) return env.vars[v];
        if(v in BC_CONST) return BC_CONST[v];
        if(v === "e") return Math.E;
        if(v === "ans") return env.ans != null ? env.ans : 0;
        if(env.free) env.free.add(v);
        return NaN; }; }
      case "neg": { const a = compile(node.a); return env => -a(env); }
      case "add": { const a = compile(node.a), b = compile(node.b); return env => a(env) + b(env); }
      case "sub": { const a = compile(node.a), b = compile(node.b); return env => a(env) - b(env); }
      case "call": { const name = node.v, a = compile(node.a), self = compile({ k: "var", v: name }); return env => env.fns && env.fns[name] ? env.fns[name](a(env), env) : self(env) * a(env); }
      case "mul": { const a = compile(node.a), b = compile(node.b); return env => a(env) * b(env); }
      case "div": { const a = compile(node.a), b = compile(node.b); return env => a(env) / b(env); }
      case "pow": { const a = compile(node.a), b = compile(node.b); return env => { const x = a(env), y = b(env);
        if(x < 0 && Math.abs(y) < 1 && y !== 0){ const q = 1 / y; if(Math.abs(q - Math.round(q)) < 1e-9 && Math.round(q) % 2) return -Math.pow(-x, y); }    // cube roots of negatives
        return Math.pow(x, y); }; }
      case "fact": { const a = compile(node.a); return env => fact(a(env)); }
      case "pct": { const a = compile(node.a); return env => a(env) / 100; }
      case "point": err("A point (x, y) can only be drawn on the graph");
      case "list": { const I = node.items.map(compile); return env => I.map(f => f(env)); }
      case "fn": {
        const A = node.a.map(compile), f = node.f;
        const toR = env => env.deg ? Math.PI / 180 : 1, fromR = env => env.deg ? 180 / Math.PI : 1;
        if(BC_LISTFN.has(f)){
          if(f === "boxplot" || f === "histogram") return () => { err(f + " draws on the graph: use it in BEEcalc Graphing"); };
          return env => {
            const vals = (f === "quartile" ? [A[0]] : A).flatMap(a => { const v = a(env); return Array.isArray(v) ? v : [v]; }).filter(Number.isFinite);
            return BC_STATS.run(f, vals, f === "quartile" ? A[1](env) : undefined);
          };
        }
        return env => {
          const x = A[0](env);
          if(Array.isArray(x)) return NaN;
          switch(f){
            case "sin": { const r = Math.sin(x * toR(env)); return Math.abs(r) < 1e-15 ? 0 : r; }
            case "cos": { const r = Math.cos(x * toR(env)); return Math.abs(r) < 1e-15 ? 0 : r; }
            case "tan": { if(env.deg && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-12) return NaN; const r = Math.tan(x * toR(env)); return Math.abs(r) < 1e-15 ? 0 : r; }
            case "sec": return 1 / Math.cos(x * toR(env));
            case "csc": return 1 / Math.sin(x * toR(env));
            case "cot": return 1 / Math.tan(x * toR(env));
            case "asin": case "arcsin": return Math.asin(x) * fromR(env);
            case "acos": case "arccos": return Math.acos(x) * fromR(env);
            case "atan": case "arctan": return Math.atan(x) * fromR(env);
            case "sinh": return Math.sinh(x); case "cosh": return Math.cosh(x); case "tanh": return Math.tanh(x);
            case "sqrt": return Math.sqrt(x);
            case "cbrt": return Math.cbrt(x);
            case "ln": return Math.log(x);
            case "log": return A[1] ? Math.log(x) / Math.log(A[1](env)) : Math.log10(x);
            case "exp": return Math.exp(x);
            case "abs": return Math.abs(x);
            case "floor": return Math.floor(x); case "ceil": return Math.ceil(x); case "round": return Math.round(x); case "sign": return Math.sign(x);
            case "nroot": { const n = A[1](env); return x < 0 && n % 2 === 1 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n); }
            case "mod": { const m = A[1](env); return ((x % m) + m) % m; }
          }
          return NaN;
        };
      }
    }
    err("I don't understand this");
  }
  // the letters an expression uses (for sliders)
  function letters(node, out = new Set()){
    if(!node || typeof node !== "object") return out;
    if(node.k === "var" || node.k === "call") out.add(node.v);
    for(const k of ["a", "b"]) if(node[k] && typeof node[k] === "object" && !Array.isArray(node[k])) letters(node[k], out);
    if(node.k === "call" && node.a) letters(node.a, out);
    if(node.k === "list") node.items.forEach(n => letters(n, out));
    if(Array.isArray(node.a)) node.a.forEach(n => letters(n, out));
    return out;
  }
  // ---- numbers as people write them
  function fmt(v, sig = 10){
    if(typeof v !== "number" || Number.isNaN(v)) return "undefined";
    if(!Number.isFinite(v)) return v > 0 ? "∞" : "−∞";
    if(v === 0) return "0";
    const a = Math.abs(v);
    if(a >= 1e12 || a < 1e-6){ const [m, e] = v.toExponential(sig - 1).split("e"); return m.replace(/\.?0+$/, "").replace(/^-/, "−") + " × 10^" + (+e); }
    let s = (+v.toPrecision(sig)).toString();
    if(/e/.test(s)) s = (+v.toPrecision(sig)).toFixed(Math.min(20, sig));
    return s.replace(/^-/, "−");
  }
  // a decimal as a fraction when it is one (0.75 → 3/4), else null
  function frac(v){
    if(!Number.isFinite(v) || Math.abs(v) > 1e9 || Number.isInteger(v)) return null;
    let h1 = 1, h0 = 0, k1 = 0, k0 = 1, b = Math.abs(v);
    for(let i = 0; i < 30; i++){
      const a = Math.floor(b); [h1, h0] = [a * h1 + h0, h1]; [k1, k0] = [a * k1 + k0, k1];
      if(Math.abs(Math.abs(v) - h1 / k1) < 1e-10 * Math.max(1, Math.abs(v))) break;
      b = 1 / (b - a); if(!Number.isFinite(b)) break;
    }
    if(k1 > 10000 || Math.abs(Math.abs(v) - h1 / k1) > 1e-9) return null;
    return { n: (v < 0 ? -1 : 1) * h1, d: k1, s: (v < 0 ? "−" : "") + h1 + "/" + k1 };
  }
  function evaluate(src, env){
    const tree = parse(src, env && env.known);
    return compile(tree)(env || {});
  }
  return { tokenize, parse, compile, evaluate, letters, fmt, frac, CalcError };
})();

/* ---- Basic and Scientific: type or tap; the answer shows as you type; = keeps it in the history ---- */
const BC_KEYS = {
  basic: [
    ["C", "⌫", "%", "÷"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "−"],
    ["1", "2", "3", "+"],
    ["√", "0", ".", "="],
    ["(", ")", "x²", "Ans"]
  ],
  scientific: [
    ["DEG", "S⇔D", "Ans", "C", "⌫"],
    ["sin", "cos", "tan", "π", "e"],
    ["sin⁻¹", "cos⁻¹", "tan⁻¹", "ln", "log"],
    ["x²", "xʸ", "√", "∛", "ⁿ√"],
    ["(", ")", "|x|", "n!", "%"],
    ["7", "8", "9", "÷", "×10ⁿ"],
    ["4", "5", "6", "×", "a/b"],
    ["1", "2", "3", "−", "(−)"],
    ["0", ".", "eˣ", "+", "="],
    ["[", "]", ",", "mean", "stdev"]
  ]
};
const BC_INS = { "÷": "÷", "×": "×", "−": "−", "+": "+", "%": "%", "√": "√(", "x²": "²", "xʸ": "^", "∛": "∛(", "ⁿ√": "nroot(", "|x|": "abs(", "n!": "!", "×10ⁿ": "E", "a/b": "/", "(−)": "−",
  "sin": "sin(", "cos": "cos(", "tan": "tan(", "sin⁻¹": "sin⁻¹(", "cos⁻¹": "cos⁻¹(", "tan⁻¹": "tan⁻¹(", "ln": "ln(", "log": "log(", "eˣ": "e^(", "π": "π", "e": "e", "Ans": "Ans", "[": "[", "]": "]", ",": ", ", "mean": "mean([", "stdev": "stdev([" };
function beeCalcUI(box, kind, S){
  // S = saved state (in ST.calc): { hist: [{q, a}], ans, deg, frac }
  if(S.deg == null) S.deg = true;
  S.hist = S.hist || [];
  box.innerHTML = `<div class="bc ${kind}">
    <div class="bc-hist" aria-live="polite"></div>
    <div class="bc-line"><input class="bc-in" type="text" inputmode="none" autocomplete="off" spellcheck="false" aria-label="Calculation" placeholder="Type or tap a calculation"><div class="bc-out" aria-live="polite"></div></div>
    <div class="bc-keys">${BC_KEYS[kind].map(r => r.map(k => `<button type="button" class="bc-k ${/^[0-9.]$/.test(k) ? "d" : k === "=" ? "eq" : /^(C|⌫)$/.test(k) ? "c" : ""}" data-k="${esc(k)}">${esc(k === "DEG" ? (S.deg ? "DEG" : "RAD") : k)}</button>`).join("")).join("")}</div>
  </div>`;
  const inp = box.querySelector(".bc-in"), out = box.querySelector(".bc-out"), hist = box.querySelector(".bc-hist");
  box.querySelector(".bc-keys").style.gridTemplateColumns = `repeat(${BC_KEYS[kind][0].length}, 1fr)`;
  const show = v => { if(S.frac){ const f = BCalc.frac(v); if(f) return f.s; } return BCalc.fmt(v); };
  const env = () => ({ deg: kind === "basic" ? true : S.deg, ans: S.ans });
  function live(){
    const q = inp.value.trim(); if(!q){ out.textContent = ""; out.classList.remove("err"); return; }
    try{ const v = BCalc.evaluate(q, env()); out.textContent = "= " + show(v); out.classList.toggle("err", !Number.isFinite(v)); }
    catch(e){ out.textContent = ""; out.classList.remove("err"); }
  }
  function drawHist(){
    hist.innerHTML = S.hist.slice(-30).map((h, i) => `<div class="bc-h" data-i="${S.hist.length - Math.min(30, S.hist.length) + i}"><span class="bc-hq">${esc(h.q)}</span><span class="bc-ha">${esc(h.a)}</span></div>`).join("");
    hist.scrollTop = hist.scrollHeight;
  }
  function equals(){
    const q = inp.value.trim(); if(!q) return;
    try{
      const v = BCalc.evaluate(q, env());
      if(!Number.isFinite(v)){ out.textContent = Number.isNaN(v) ? "This has no answer (undefined)" : "Too big (∞)"; out.classList.add("err"); return; }
      S.ans = v; S.hist.push({ q, a: show(v) }); if(S.hist.length > 100) S.hist.shift();
      inp.value = ""; out.textContent = ""; drawHist(); changed();
    }catch(e){ out.textContent = e instanceof BCalc.CalcError ? e.message : "I don't understand this"; out.classList.add("err"); }
  }
  function insert(t){
    const a = inp.selectionStart ?? inp.value.length, b = inp.selectionEnd ?? a;
    if((t === ")" || t === "]") && a === b && inp.value[a] === t){ inp.setSelectionRange(a + 1, a + 1); return; }      // step over a ) or ] we added
    // after an answer, an operator carries on from Ans (like a real calculator)
    if(!inp.value && /^[+−×÷^²!%E/]/.test(t) && S.ans != null) t = "Ans" + t;
    inp.value = inp.value.slice(0, a) + t + inp.value.slice(b);
    let c = a + t.length;
    if(/\(\[$/.test(t)){ inp.value = inp.value.slice(0, c) + "])" + inp.value.slice(c); }
    else if(/\($/.test(t) && !/\)/.test(inp.value.slice(c))){ inp.value = inp.value.slice(0, c) + ")" + inp.value.slice(c); }
    inp.setSelectionRange(c, c); live();
  }
  box.querySelector(".bc-keys").addEventListener("click", e => {
    const b = e.target.closest("[data-k]"); if(!b) return;
    const k = b.dataset.k;
    if(k === "=") equals();
    else if(k === "C"){ inp.value = ""; live(); }
    else if(k === "⌫"){ const a = inp.selectionStart ?? inp.value.length, z = inp.selectionEnd ?? a; if(a !== z){ inp.value = inp.value.slice(0, a) + inp.value.slice(z); inp.setSelectionRange(a, a); } else if(a > 0){ const cut = /(sin⁻¹\(|cos⁻¹\(|tan⁻¹\(|sin\(|cos\(|tan\(|log\(|ln\(|√\(|∛\(|nroot\(|abs\(|Ans)$/.exec(inp.value.slice(0, a)); const n = cut ? cut[0].length : 1; inp.value = inp.value.slice(0, a - n) + inp.value.slice(a); inp.setSelectionRange(a - n, a - n); } live(); }
    else if(k === "DEG"){ S.deg = !S.deg; b.textContent = S.deg ? "DEG" : "RAD"; changed(); live(); }
    else if(k === "S⇔D"){ S.frac = !S.frac; b.classList.toggle("on", !!S.frac); changed(); live(); }
    else insert(BC_INS[k] != null ? BC_INS[k] : k);
    if(matchMedia("(pointer:fine)").matches) inp.focus();
  });
  box.querySelector(".bc-keys [data-k='S⇔D']") && box.querySelector(".bc-keys [data-k='S⇔D']").classList.toggle("on", !!S.frac);
  hist.addEventListener("click", e => { const h = e.target.closest(".bc-h"); if(!h) return; const x = S.hist[+h.dataset.i]; if(x) insert(e.target.closest(".bc-ha") ? x.a.replace(/−/g, "-").replace(/ × 10\^/, "E") : x.q); });
  inp.addEventListener("input", live);
  inp.addEventListener("keydown", e => {
    if(e.key === "Enter"){ e.preventDefault(); equals(); }
    else if(e.key === "Escape"){ inp.value = ""; live(); }
    else if(e.key === "*"){ e.preventDefault(); insert("×"); }
    else if(e.key === ")"){ e.preventDefault(); insert(")"); }
    else if(e.key === "("){ e.preventDefault(); insert("("); }
    else if(e.key === "/" && kind === "basic"){ e.preventDefault(); insert("÷"); }
  });
  drawHist();
  if(matchMedia("(pointer:fine)").matches) setTimeout(() => inp.focus(), 50);
  return { focus: () => inp.focus() };
}
