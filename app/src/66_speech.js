/* ---------------- 🔊 reading maths, science and chemistry aloud ----------------
   BEE turns every formula into words when it makes the student file, the way a teacher would say it:
   "3/5" → "three fifths", "x^2" → "x squared", "9.8 m/s²" → "9.8 metres per second squared",
   "\ce{CH4 + 2O2 -> CO2 + 2H2O}" → "C H 4 plus 2 O 2 gives C O 2 plus 2 H 2 O". English and French. */
const SPEECH = (() => {
  "use strict";
  const W = {
    en: { plus: "plus", minus: "minus", times: "times", div: "divided by", eq: "equals", ne: "is not equal to", lt: "is less than", gt: "is greater than", le: "is less than or equal to", ge: "is greater than or equal to",
      approx: "is approximately", equiv: "is equivalent to", prop: "is proportional to", pm: "plus or minus", sq: "squared", cube: "cubed", pow: "to the power of", over: "over", sqrt: "the square root of", root: "root of",
      cuberoot: "the cube root of", deg: "degrees", pct: "percent", of: "of", obr: "open bracket", cbr: "close bracket", fact: "factorial", prime: "prime", inv: "inverse", base: "base",
      sum: "the sum", int: "the integral", lim: "the limit as", tends: "tends to", approaches: "approaches", from: "from", to: "to", gives: "gives", equil: "is in equilibrium with", implies: "implies", iff: "if and only if",
      abs: "the absolute value of", choose: "choose", bar: "bar", vec: "vector", seg: "line segment", angle: "angle", tri: "triangle", par: "is parallel to", perp: "is perpendicular to", cong: "is congruent to", sim: "is similar to",
      in: "is in", notin: "is not in", subset: "is a subset of", union: "union", inter: "intersection", empty: "the empty set", inf: "infinity", therefore: "therefore", because: "because",
      aq: "aqueous", s: "solid", l: "liquid", g: "gas", ion_p: "plus", ion_m: "minus", up: "given off as a gas", down: "precipitate",
      N: "the natural numbers", Z: "the integers", Q: "the rational numbers", R: "the real numbers",
      fn: { sin: "sine", cos: "cosine", tan: "tangent", log: "log", ln: "natural log", exp: "exponential", sec: "secant", csc: "cosecant", cot: "cotangent", max: "maximum", min: "minimum" },
      greek: { alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta", epsilon: "epsilon", varepsilon: "epsilon", theta: "theta", lambda: "lambda", mu: "mu", pi: "pi", rho: "rho", sigma: "sigma", tau: "tau", phi: "phi", varphi: "phi", omega: "omega", Delta: "delta", Sigma: "sigma", Omega: "omega", Theta: "theta", Phi: "phi", Lambda: "lambda", eta: "eta", zeta: "zeta", chi: "chi", psi: "psi", nu: "nu", xi: "xi", kappa: "kappa" },
      ord: ["", "", "half", "third", "quarter", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"], ordUS4: "fourth", nums: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"],
      celsius: "degrees Celsius", fahr: "degrees Fahrenheit", per: "per", square: "square", cubic: "cubic",
      units: { mm: ["millimetre", "millimetres"], cm: ["centimetre", "centimetres"], m: ["metre", "metres"], km: ["kilometre", "kilometres"], mg: ["milligram", "milligrams"], g: ["gram", "grams"], kg: ["kilogram", "kilograms"], t: ["tonne", "tonnes"],
        ms: ["millisecond", "milliseconds"], s: ["second", "seconds"], min: ["minute", "minutes"], h: ["hour", "hours"], ml: ["millilitre", "millilitres"], mL: ["millilitre", "millilitres"], L: ["litre", "litres"], l: ["litre", "litres"],
        N: ["newton", "newtons"], kN: ["kilonewton", "kilonewtons"], J: ["joule", "joules"], kJ: ["kilojoule", "kilojoules"], MJ: ["megajoule", "megajoules"], W: ["watt", "watts"], kW: ["kilowatt", "kilowatts"], kWh: ["kilowatt hour", "kilowatt hours"],
        V: ["volt", "volts"], mA: ["milliamp", "milliamps"], A: ["amp", "amps"], "Ω": ["ohm", "ohms"], ohm: ["ohm", "ohms"], Pa: ["pascal", "pascals"], kPa: ["kilopascal", "kilopascals"], Hz: ["hertz", "hertz"], kHz: ["kilohertz", "kilohertz"], mol: ["mole", "moles"], K: ["kelvin", "kelvin"], C: ["coulomb", "coulombs"] } },
    fr: { plus: "plus", minus: "moins", times: "fois", div: "divisé par", eq: "égale", ne: "est différent de", lt: "est inférieur à", gt: "est supérieur à", le: "est inférieur ou égal à", ge: "est supérieur ou égal à",
      approx: "est environ égal à", equiv: "est équivalent à", prop: "est proportionnel à", pm: "plus ou moins", sq: "au carré", cube: "au cube", pow: "puissance", over: "sur", sqrt: "racine carrée de", root: "racine de",
      cuberoot: "racine cubique de", deg: "degrés", pct: "pour cent", of: "de", obr: "parenthèse", cbr: "fermez la parenthèse", fact: "factorielle", prime: "prime", inv: "inverse", base: "base",
      sum: "la somme", int: "l'intégrale", lim: "la limite quand", tends: "tend vers", approaches: "tend vers", from: "de", to: "à", gives: "donne", equil: "est en équilibre avec", implies: "implique", iff: "si et seulement si",
      abs: "la valeur absolue de", choose: "parmi", bar: "barre", vec: "vecteur", seg: "le segment", angle: "l'angle", tri: "le triangle", par: "est parallèle à", perp: "est perpendiculaire à", cong: "est isométrique à", sim: "est semblable à",
      in: "appartient à", notin: "n'appartient pas à", subset: "est inclus dans", union: "union", inter: "inter", empty: "l'ensemble vide", inf: "l'infini", therefore: "donc", because: "car",
      aq: "aqueux", s: "solide", l: "liquide", g: "gaz", ion_p: "plus", ion_m: "moins", up: "dégagement gazeux", down: "précipité",
      N: "l'ensemble des entiers naturels", Z: "l'ensemble des entiers relatifs", Q: "l'ensemble des rationnels", R: "l'ensemble des réels",
      fn: { sin: "sinus", cos: "cosinus", tan: "tangente", log: "log", ln: "logarithme népérien", exp: "exponentielle", max: "maximum", min: "minimum" },
      greek: { alpha: "alpha", beta: "bêta", gamma: "gamma", delta: "delta", epsilon: "epsilon", varepsilon: "epsilon", theta: "thêta", lambda: "lambda", mu: "mu", pi: "pi", rho: "rhô", sigma: "sigma", tau: "tau", phi: "phi", varphi: "phi", omega: "oméga", Delta: "delta", Sigma: "sigma", Omega: "oméga", Theta: "thêta", Phi: "phi", Lambda: "lambda", eta: "êta", zeta: "dzêta", chi: "khi", psi: "psi", nu: "nu", xi: "xi", kappa: "kappa" },
      ord: ["", "", "demi", "tiers", "quart", "cinquième", "sixième", "septième", "huitième", "neuvième", "dixième", "onzième", "douzième"], nums: ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"],
      celsius: "degrés Celsius", fahr: "degrés Fahrenheit", per: "par", square: "carré", cubic: "cube",
      units: { mm: ["millimètre", "millimètres"], cm: ["centimètre", "centimètres"], m: ["mètre", "mètres"], km: ["kilomètre", "kilomètres"], mg: ["milligramme", "milligrammes"], g: ["gramme", "grammes"], kg: ["kilogramme", "kilogrammes"], t: ["tonne", "tonnes"],
        ms: ["milliseconde", "millisecondes"], s: ["seconde", "secondes"], min: ["minute", "minutes"], h: ["heure", "heures"], ml: ["millilitre", "millilitres"], mL: ["millilitre", "millilitres"], L: ["litre", "litres"], l: ["litre", "litres"],
        N: ["newton", "newtons"], kN: ["kilonewton", "kilonewtons"], J: ["joule", "joules"], kJ: ["kilojoule", "kilojoules"], MJ: ["mégajoule", "mégajoules"], W: ["watt", "watts"], kW: ["kilowatt", "kilowatts"], kWh: ["kilowattheure", "kilowattheures"],
        V: ["volt", "volts"], mA: ["milliampère", "milliampères"], A: ["ampère", "ampères"], "Ω": ["ohm", "ohms"], ohm: ["ohm", "ohms"], Pa: ["pascal", "pascals"], kPa: ["kilopascal", "kilopascals"], Hz: ["hertz", "hertz"], kHz: ["kilohertz", "kilohertz"], mol: ["mole", "moles"], K: ["kelvin", "kelvins"], C: ["coulomb", "coulombs"] } }
  };
  const ELEMENTS = new Set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm".split(" "));
  const sp = s => " " + s + " ";
  const clean = s => s.replace(/\s+([,.])/g, "$1").replace(/\s+/g, " ").trim();

  // a whole number word for small numbers ("three fifths"), digits otherwise
  function fraction(a, b, w, us){
    const A = +a, B = +b;
    if(/^\d+$/.test(a) && /^\d+$/.test(b) && A >= 1 && A <= 12 && B >= 2 && B <= 12){
      let o = w.ord[B]; if(B === 4 && us && w.ordUS4) o = w.ordUS4;
      if(w === W.fr){ return A === 1 ? (B === 2 ? "un demi" : "un " + o) : w.nums[A] + " " + (B === 2 ? "demis" : B === 3 ? "tiers" : B === 4 ? "quarts" : o + "s"); }
      return (A === 1 ? (B === 2 ? "one" : "one") : w.nums[A]) + " " + (A === 1 ? o : (B === 2 ? "halves" : o + "s"));
    }
    return null;
  }
  // chemistry: formulas spelled out, coefficients and subscripts as numbers, state symbols and arrows in words
  function chem(s, w){
    s = String(s).replace(/<=>|<->|⇌|\\rightleftharpoons/g, " ⇌ ").replace(/->|→|\\rightarrow|\\to/g, " → ").replace(/\\uparrow|↑/g, " ↑ ").replace(/\\downarrow|↓/g, " ↓ ");
    s = s.replace(/\\mathrm\{([^{}]*)\}/g, "$1").replace(/\\text\{([^{}]*)\}/g, "$1").replace(/[{}]/g, "").replace(/\\,/g, " ");
    s = s.replace(/[₀-₉]/g, c => "₀₁₂₃₄₅₆₇₈₉".indexOf(c)).replace(/[⁺]/g, "^+").replace(/[⁻]/g, "^-").replace(/[⁰¹²³⁴-⁹]/g, c => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c));
    const out = [];
    for(const tok of s.split(/\s+/).filter(Boolean)){
      if(tok === "+"){ out.push(", " + w.plus); continue; }
      if(tok === "→"){ out.push(", " + w.gives); continue; }
      if(tok === "⇌"){ out.push(", " + w.equil); continue; }
      if(tok === "↑"){ out.push(w.up); continue; }
      if(tok === "↓"){ out.push(w.down); continue; }
      let t = tok, words = [];
      const coef = t.match(/^(\d+)(?=[A-Z(])/); if(coef){ words.push(coef[1]); t = t.slice(coef[1].length); }
      const state = t.match(/\((aq|s|l|g)\)$/); if(state) t = t.slice(0, -state[0].length);
      const charge = t.match(/\^?(\d*)([+-])$/); if(charge && /[A-Za-z)\]\d]/.test(t[t.length - charge[0].length - 1] || "")){ t = t.slice(0, -charge[0].length); }
      for(const m of t.matchAll(/([A-Z][a-z]?)|_?(\d+)|([()\[\]])|(.)/g)){
        if(m[1]) words.push(m[1].split("").join(" ").toUpperCase());
        else if(m[2]) words.push(m[2]);
      }
      if(charge && /[A-Za-z)\]\d]/.test(tok[tok.length - charge[0].length - 1 - (state ? state[0].length : 0)] || tok)) words.push((charge[1] || "") + " " + (charge[2] === "+" ? w.ion_p : w.ion_m));
      if(state) words.push(w[state[1]]);
      out.push(words.join(" "));
    }
    return clean(out.join(" "));
  }
  const isFormula = t => { const p = t.match(/[A-Z][a-z]?/g); return !!p && p.join("") === t.replace(/\d+/g, "") && p.every(x => ELEMENTS.has(x)) && (/\d/.test(t) || p.length >= 2) && t.length <= 14; };
  // a unit after a number: "9.8 m/s^2" → "metres per second squared"
  function unitWords(u, n, w){
    u = u.replace(/\\,|\s/g, "").replace(/\^\{?(\d)\}?/g, "^$1").replace(/[²]/g, "^2").replace(/[³]/g, "^3");
    if(/^(°|\^\\circ|\^∘)?C$/.test(u) && /°|circ|∘/.test(u)) return w.celsius;
    if(/^°F$/.test(u)) return w.fahr;
    const parts = u.split("/");
    const one = (p, plural) => { const m = p.match(/^([A-Za-zΩµ]+)(\^([23]))?$/); if(!m || !w.units[m[1]]) return null; const nm = w.units[m[1]][plural ? 1 : 0];
      if(!m[3]) return nm;
      if(parts.length > 1 && p !== parts[0]) return nm + " " + (m[3] === "2" ? w.sq : w.cube);   // per second squared
      return (m[3] === "2" ? w.square : w.cubic) + " " + nm; };
    const plural = !(+n === 1);
    const first = one(parts[0], plural); if(!first) return null;
    const rest = parts.slice(1).map(p => one(p, false)); if(rest.some(r => !r)) return null;
    return [first].concat(rest.map(r => w.per + " " + r)).join(" ");
  }
  const UNIT_RE = /(\d(?:[\d.,]*\d)?)\s?((?:°C|°F|km\/h|kWh|kPa|kHz|kJ|MJ|kN|kW|mA|mol|min|Hz|Pa|mm|cm|km|kg|mg|ml|mL|ms|Ω|m|g|s|N|J|W|V|h|L)(?:[²³]|\^[23])?(?:\/(?:s|h|min|kg|mol|m)(?:[²³]|\^2)?)?)(?![A-Za-z])/g;

  // plain text (not maths): units after numbers, chemical formulas, symbols
  function text(s, lang){
    const w = W[lang] || W.en;
    s = String(s || "");
    s = s.replace(UNIT_RE, (all, n, u) => { const x = unitWords(u, n, w); return x ? n + " " + x : all; });
    s = s.replace(/\b(mm|cm|km|m)([²³])/g, (a, u, p) => (p === "²" ? w.square : w.cubic) + " " + w.units[u][1]);
    s = s.replace(/[A-Z][A-Za-z0-9₀-₉]*(?:\([a-z]{1,2}\))?/g, t => { const core = t.replace(/[₀-₉]/g, c => "₀₁₂₃₄₅₆₇₈₉".indexOf(c)).replace(/\((aq|s|l|g)\)$/, ""); return isFormula(core) ? chem(t, w) : t; });
    s = s.replace(/°/g, sp(w.deg)).replace(/²/g, sp(w.sq)).replace(/³/g, sp(w.cube)).replace(/→/g, sp(w.gives)).replace(/⇌/g, sp(w.equil))
      .replace(/≤/g, sp(w.le)).replace(/≥/g, sp(w.ge)).replace(/≠/g, sp(w.ne)).replace(/≈/g, sp(w.approx)).replace(/×/g, sp(w.times)).replace(/÷/g, sp(w.div)).replace(/±/g, sp(w.pm))
      .replace(/√/g, sp(w.sqrt)).replace(/π/g, " pi ").replace(/∞/g, sp(w.inf)).replace(/Δ/g, " delta ").replace(/θ/g, " theta ").replace(/µ|μ/g, " micro ").replace(/Ω/g, " ohms ").replace(/%/g, sp(w.pct))
      .replace(/_{3,}|\.{4,}|…{2,}/g, ", blank, ");
    return clean(s);
  }

  // LaTeX maths → words
  function tex(src, lang, opts){
    const w = W[lang] || W.en, us = opts && opts.us;
    let i = 0; const s = String(src || "");
    const group = () => {        // {…} or one token
      while(s[i] === " ") i++;
      if(s[i] === "{"){ let d = 1, j = i + 1; while(j < s.length && d){ if(s[j] === "\\"){ j += 2; continue; } if(s[j] === "{") d++; else if(s[j] === "}") d--; j++; } const g = s.slice(i + 1, j - 1); i = j; return g; }
      if(s[i] === "\\"){ const m = s.slice(i).match(/^\\([a-zA-Z]+|.)/); i += m[0].length; return m[0]; }
      return s[i++] || "";
    };
    const opt = () => { if(s[i] !== "[") return null; const j = s.indexOf("]", i); const g = s.slice(i + 1, j); i = j + 1; return g; };
    const out = [];
    let prev = "", ofNext = 0;
    const say = x => { out.push(x); prev = x; };
    while(i < s.length){
      const c = s[i];
      if(c === " " || c === "~"){ i++; continue; }
      if(c === "\\"){
        const m = s.slice(i).match(/^\\([a-zA-Z]+|.)/); i += m[0].length; const cmd = m[1];
        if(/^[dt]?frac$/.test(cmd)){ const a = group(), b = group(); const f = fraction(a.trim(), b.trim(), w, us); say(f || (", " + tex(a, lang, opts) + " " + w.over + " " + tex(b, lang, opts) + ", ")); continue; }
        if(cmd === "sqrt"){ const n = opt(), g = group(); say(n == null ? w.sqrt + " " + tex(g, lang, opts) + "," : n.trim() === "3" ? w.cuberoot + " " + tex(g, lang, opts) + "," : "the " + tex(n, lang, opts) + " " + w.root + " " + tex(g, lang, opts) + ","); continue; }
        if(cmd === "ce"){ say(chem(group(), w)); continue; }
        if(/^(text|mathrm|textrm|textbf|textit|mathbf|mathit|mathsf|operatorname|textnormal|mbox)$/.test(cmd)){
          const g = group();
          // a unit right after a number, a chemical formula, or ordinary words
          const lastNum = (out[out.length - 1] || "").match(/(\d(?:[\d.,]*\d)?)$/);
          let rest = ""; const sup = s.slice(i).match(/^\s*\^\s*(\{[23]\}|[23])/); if(sup && lastNum){ rest = "^" + sup[1].replace(/[{}]/g, ""); i += sup[0].length; }
          const u = lastNum ? unitWords(g + rest, lastNum[1], w) : null;
          if(u){ say(u); continue; }
          const sub = s.slice(i).match(/^\s*_\s*(\{\d+\}|\d)/);
          if(/^[A-Z][a-z]?$/.test(g.trim()) && (sub || ELEMENTS.has(g.trim()))){ say(g.trim().split("").join(" ").toUpperCase()); continue; }
          if(isFormula(g.replace(/_\{?(\d+)\}?/g, "$1"))){ say(chem(g, w)); continue; }
          say(text(g, lang)); continue;
        }
        if(cmd === "left" || cmd === "right" || /^(big|Big|bigg|Bigg)[lr]?$/.test(cmd) || /^(displaystyle|textstyle|limits|nolimits|quad|qquad|,|;|:|!| |mathstrut|strut|phantom)$/.test(cmd)){ if(cmd === "phantom") group(); continue; }
        if(cmd === "times" || cmd === "cdot" || cmd === "ast"){ say(w.times); continue; }
        if(cmd === "div"){ say(w.div); continue; }
        if(cmd === "pm"){ say(w.pm); continue; }
        if(cmd === "mp"){ say(w.minus + " " + w.plus); continue; }
        if(/^(le|leq|leqslant)$/.test(cmd)){ say(w.le); continue; }
        if(/^(ge|geq|geqslant)$/.test(cmd)){ say(w.ge); continue; }
        if(/^(ne|neq)$/.test(cmd)){ say(w.ne); continue; }
        if(cmd === "approx" || cmd === "simeq"){ say(w.approx); continue; }
        if(cmd === "equiv"){ say(w.equiv); continue; }
        if(cmd === "propto"){ say(w.prop); continue; }
        if(cmd === "to" || cmd === "rightarrow" || cmd === "longrightarrow"){ say(out.join(" ").includes(w.lim) ? w.approaches : w.gives); continue; }
        if(cmd === "Rightarrow" || cmd === "implies"){ say(w.implies); continue; }
        if(cmd === "Leftrightarrow" || cmd === "iff"){ say(w.iff); continue; }
        if(cmd === "rightleftharpoons"){ say(w.equil); continue; }
        if(cmd === "uparrow"){ say(w.up); continue; }
        if(cmd === "downarrow"){ say(w.down); continue; }
        if(cmd === "infty"){ say(w.inf); continue; }
        if(cmd === "circ" || cmd === "degree"){ say(w.deg); continue; }
        if(cmd === "%"){ say(w.pct); continue; }
        if(cmd === "angle" || cmd === "measuredangle"){ say(w.angle); continue; }
        if(cmd === "triangle"){ say(w.tri); continue; }
        if(cmd === "parallel"){ say(w.par); continue; }
        if(cmd === "perp"){ say(w.perp); continue; }
        if(cmd === "cong"){ say(w.cong); continue; }
        if(cmd === "sim"){ say(w.sim); continue; }
        if(cmd === "in"){ say(w.in); continue; }
        if(cmd === "notin"){ say(w.notin); continue; }
        if(cmd === "subset" || cmd === "subseteq"){ say(w.subset); continue; }
        if(cmd === "cup"){ say(w.union); continue; }
        if(cmd === "cap"){ say(w.inter); continue; }
        if(cmd === "emptyset" || cmd === "varnothing"){ say(w.empty); continue; }
        if(cmd === "therefore"){ say(w.therefore); continue; }
        if(cmd === "because"){ say(w.because); continue; }
        if(cmd === "ldots" || cmd === "dots" || cmd === "cdots"){ say(", and so on,"); continue; }
        if(cmd === "prime"){ say(w.prime); continue; }
        if(cmd === "mathbb"){ const g = group().trim(); say(w[g] || g); continue; }
        if(cmd === "N" || cmd === "Z" || cmd === "Q" || cmd === "R"){ say(w[cmd]); continue; }
        if(cmd === "binom"){ const a = group(), b = group(); say(tex(a, lang, opts) + " " + w.choose + " " + tex(b, lang, opts)); continue; }
        if(cmd === "bar" || cmd === "overline"){ const g = group(); say(/^[A-Z]{2}$/.test(g.trim()) ? w.seg + " " + g.trim().split("").join(" ") : tex(g, lang, opts) + " " + w.bar); continue; }
        if(cmd === "vec" || cmd === "overrightarrow"){ say(w.vec + " " + tex(group(), lang, opts).split("").join(/^[A-Z]+$/.test(s) ? " " : "")); continue; }
        if(cmd === "hat" || cmd === "dot" || cmd === "tilde" || cmd === "overset" || cmd === "underline"){ if(cmd === "overset") group(); say(tex(group(), lang, opts)); continue; }
        if(cmd === "sum" || cmd === "int" || cmd === "lim" || cmd === "prod"){
          let lo = null, hi = null;
          for(let k = 0; k < 2; k++){ while(s[i] === " ") i++; if(s[i] === "_"){ i++; lo = group(); } else if(s[i] === "^"){ i++; hi = group(); } }
          if(cmd === "lim") say(w.lim + " " + tex(lo || "", lang, opts).replace(w.gives, w.tends) + ",");
          else say((cmd === "int" ? w.int : cmd === "prod" ? "the product" : w.sum) + (lo != null ? " " + w.from + " " + tex(lo, lang, opts) : "") + (hi != null ? " " + w.to + " " + tex(hi, lang, opts) : "") + " " + w.of);
          continue;
        }
        if(w.fn[cmd]){
          let name = w.fn[cmd];
          const inv = s.slice(i).match(/^\s*\^\s*\{\s*-\s*1\s*\}/); if(inv){ i += inv[0].length; name = w.inv + " " + name; }
          const base = s.slice(i).match(/^\s*_/); if(base && cmd === "log"){ i += base[0].length; name += " " + w.base + " " + tex(group(), lang, opts); }
          say(name + " " + w.of); ofNext = 1; continue;
        }
        if(cmd === "Omega" && /\d$/.test(prev)){ say(w.units["Ω"][+prev === 1 ? 0 : 1]); continue; }
        if(cmd === "mu" && /^\\mathrm\{?[a-zA-Z]/.test(s.slice(i).trim())){ say("micro"); continue; }
        if(w.greek[cmd]){ say(w.greek[cmd]); continue; }
        if(cmd === "{" || cmd === "}" || cmd === "|" || cmd === "\\" || cmd === "&"){ if(cmd === "\\") say(","); continue; }
        continue;   // anything else: say nothing rather than nonsense
      }
      if(c === "^"){
        i++; const g = group().trim();
        if(g === "2") say(w.sq); else if(g === "3") say(w.cube);
        else if(g === "\\circ" || g === "∘" || g === "\\degree"){
          const cm = s.slice(i).match(/^\s*(\\mathrm\{C\}|\\text\{C\}|C)/); if(cm){ i += cm[0].length; say(w.celsius); } else say(w.deg);
        }
        else if(g === "\\prime" || g === "'") say(w.prime);
        else if(/^[+-]$|^\d[+-]$/.test(g)) say(g.replace(/[+-]/, x => " " + (x === "+" ? w.ion_p : w.ion_m)));
        else say(w.pow + " " + tex(g, lang, opts) + ",");
        continue;
      }
      if(c === "_"){ i++; say(tex(group(), lang, opts)); continue; }
      if(c === "{" ){ say(tex(group(), lang, opts)); continue; }
      if(c === "}"){ i++; continue; }
      if(/[\d.]/.test(c)){ const m = s.slice(i).match(/^\d*\.?\d+|^\d+/); if(m){ i += m[0].length; say(m[0]); continue; } i++; continue; }
      if(/[a-zA-Z]/.test(c)){ i++; say(c); continue; }
      i++;
      if(c === "+") say(w.plus);
      else if(c === "-" || c === "−") say(w.minus);
      else if(c === "=") say(w.eq);
      else if(c === "<") say(w.lt);
      else if(c === ">") say(w.gt);
      else if(c === "(" ){ if(ofNext || /^[fghPp]$/.test(prev)){ if(!ofNext) say(w.of); ofNext = 0; } else say(w.obr); }
      else if(c === ")"){ const opened = out.lastIndexOf(w.obr); if(opened >= 0 && out.slice(opened).indexOf(w.cbr) < 0) say(w.cbr); }
      else if(c === "!") say(w.fact);
      else if(c === "'") say(w.prime);
      else if(c === "%") say(w.pct);
      else if(c === "," || c === ";") say(",");
      else if(c === "|"){ /* absolute value bars: say nothing */ }
      else if(c === "°") say(w.deg);
      else if("≤≥≠≈×÷±→".includes(c)) say(text(c, lang));
    }
    return clean(out.join(" "));
  }
  return { tex, text, chem };
})();
