/* ---------------- 🔊 reading maths, science and chemistry aloud ----------------
   BEE turns every formula into words when it makes the student file, the way a teacher would say it:
   "3/5" → "three fifths", "x^2" → "x squared", "9.8 m/s²" → "9.8 metres per second squared",
   "\ce{CH4 + 2O2 -> CO2 + 2H2O}" → "C H 4 plus 2 O 2 gives C O 2 plus 2 H 2 O", "|x|" → "the absolute value of x",
   "[0, 1]" → "the closed interval from 0 to 1", "\ce{Fe^{3+}}" → "iron 3 plus". English and French. */
const SPEECH = (() => {
  "use strict";
  const W = {
    en: { plus: "plus", minus: "minus", times: "times", div: "divided by", eq: "equals", ne: "is not equal to", lt: "is less than", gt: "is greater than", le: "is less than or equal to", ge: "is greater than or equal to",
      approx: "is approximately", equiv: "is equivalent to", prop: "is proportional to", pm: "plus or minus", sq: "squared", cube: "cubed", pow: "to the power of", tpow: "to the power", over: "over", allover: "all over", by: "by", sqrt: "the square root of", root: "root of",
      cuberoot: "the cube root of", deg: "degrees", pct: "percent", of: "of", obr: "open bracket", cbr: "close bracket", fact: "factorial", prime: "prime", inv: "inverse", finv: "inverse", base: "base",
      sum: "the sum", prod: "the product", int: "the integral", lim: "the limit as", tends: "tends to", approaches: "approaches", from: "from", to: "to", gives: "gives", equil: "is in equilibrium with", implies: "implies", iff: "if and only if",
      abs: "the absolute value of", given: "given", set: "the set", suchthat: "such that", conc: "the concentration of", choose: "choose", bar: "bar", vec: "vector", seg: "line segment", angle: "angle", tri: "triangle", par: "is parallel to", perp: "is perpendicular to", cong: "is congruent to", sim: "is similar to",
      in: "is in", notin: "is not in", subset: "is a subset of", union: "union", inter: "intersection", empty: "the empty set", inf: "infinity", therefore: "therefore", because: "because", etc: ", and so on,",
      matrix: "the matrix", det: "the determinant", row: "row", endm: "end of matrix", enddet: "end of determinant", colvec: "the column vector",
      ival: (a, b, lo, hi) => lo && hi ? `the closed interval from ${a} to ${b}` : !lo && !hi ? `the open interval from ${a} to ${b}` : `the interval from ${a}, ${lo ? "included" : "excluded"}, to ${b}, ${hi ? "included" : "excluded"}`,
      aq: "aqueous", s: "solid", l: "liquid", g: "gas", ion_p: "plus", ion_m: "minus", up: "given off as a gas", down: "precipitate",
      N: "the natural numbers", Z: "the integers", Q: "the rational numbers", R: "the real numbers",
      fn: { sin: "sine", cos: "cosine", tan: "tangent", log: "log", ln: "natural log", exp: "exponential", sec: "secant", csc: "cosecant", cot: "cotangent", max: "maximum", min: "minimum", sinh: "hyperbolic sine", cosh: "hyperbolic cosine", tanh: "hyperbolic tangent", arcsin: "arc sine", arccos: "arc cosine", arctan: "arc tangent" },
      greek: { alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta", epsilon: "epsilon", varepsilon: "epsilon", theta: "theta", vartheta: "theta", lambda: "lambda", mu: "mu", pi: "pi", rho: "rho", sigma: "sigma", tau: "tau", phi: "phi", varphi: "phi", omega: "omega", Delta: "delta", Sigma: "sigma", Omega: "omega", Theta: "theta", Phi: "phi", Lambda: "lambda", Gamma: "gamma", Pi: "pi", Psi: "psi", eta: "eta", zeta: "zeta", chi: "chi", psi: "psi", nu: "nu", xi: "xi", kappa: "kappa", partial: "partial" },
      ord: ["", "", "half", "third", "quarter", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"], ordUS4: "fourth", hundredth: "hundredth", nums: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"],
      celsius: "degrees Celsius", fahr: "degrees Fahrenheit", per: "per", square: "square", cubic: "cubic",
      pre: { k: "kilo", M: "mega", G: "giga", m: "milli", "µ": "micro", "μ": "micro", n: "nano", p: "pico", c: "centi", d: "deci" },
      units: { mm: ["millimetre", "millimetres"], cm: ["centimetre", "centimetres"], m: ["metre", "metres"], km: ["kilometre", "kilometres"], mg: ["milligram", "milligrams"], g: ["gram", "grams"], kg: ["kilogram", "kilograms"], t: ["tonne", "tonnes"],
        ms: ["millisecond", "milliseconds"], s: ["second", "seconds"], min: ["minute", "minutes"], h: ["hour", "hours"], ml: ["millilitre", "millilitres"], mL: ["millilitre", "millilitres"], L: ["litre", "litres"], l: ["litre", "litres"],
        N: ["newton", "newtons"], J: ["joule", "joules"], W: ["watt", "watts"], kWh: ["kilowatt hour", "kilowatt hours"], Wh: ["watt hour", "watt hours"], V: ["volt", "volts"], A: ["amp", "amps"], F: ["farad", "farads"], T: ["tesla", "teslas"],
        "Ω": ["ohm", "ohms"], "kΩ": ["kilohm", "kilohms"], "MΩ": ["megohm", "megohms"], ohm: ["ohm", "ohms"], Pa: ["pascal", "pascals"], Hz: ["hertz", "hertz"], mol: ["mole", "moles"], K: ["kelvin", "kelvin"], C: ["coulomb", "coulombs"],
        eV: ["electronvolt", "electronvolts"], M: ["molar", "molar"], dB: ["decibel", "decibels"], rad: ["radian", "radians"], Bq: ["becquerel", "becquerels"], Gy: ["gray", "grays"] },
      els: "H hydrogen,He helium,Li lithium,Be beryllium,B boron,C carbon,N nitrogen,O oxygen,F fluorine,Ne neon,Na sodium,Mg magnesium,Al aluminium,Si silicon,P phosphorus,S sulfur,Cl chlorine,Ar argon,K potassium,Ca calcium,Ti titanium,Cr chromium,Mn manganese,Fe iron,Co cobalt,Ni nickel,Cu copper,Zn zinc,Br bromine,Kr krypton,Rb rubidium,Sr strontium,Ag silver,Sn tin,I iodine,Xe xenon,Cs caesium,Ba barium,Pt platinum,Au gold,Hg mercury,Pb lead,Rn radon,Ra radium,U uranium,Pu plutonium",
      anion: { Cl: "chloride", F: "fluoride", Br: "bromide", I: "iodide", O: "oxide", S: "sulfide", N: "nitride" },
      abbr: [[/\be\.g\.(?=[\s,]|$)/gi, "for example"], [/\bi\.e\.(?=[\s,]|$)/gi, "that is"], [/\bd\.p\.(?=[\s,.)]|$)/gi, "decimal places"], [/\bs\.f\.(?=[\s,.)]|$)/gi, "significant figures"], [/\bapprox\.(?=\s)/gi, "approximately"], [/\betc\.(?=[\s,)]|$)/gi, "et cetera"]] },
    fr: { plus: "plus", minus: "moins", times: "fois", div: "divisé par", eq: "égale", ne: "est différent de", lt: "est inférieur à", gt: "est supérieur à", le: "est inférieur ou égal à", ge: "est supérieur ou égal à",
      approx: "est environ égal à", equiv: "est équivalent à", prop: "est proportionnel à", pm: "plus ou moins", sq: "au carré", cube: "au cube", pow: "puissance", tpow: "puissance", over: "sur", allover: "le tout sur", by: "sur", sqrt: "racine carrée de", root: "racine de",
      cuberoot: "racine cubique de", deg: "degrés", pct: "pour cent", of: "de", obr: "ouvrez la parenthèse", cbr: "fermez la parenthèse", fact: "factorielle", prime: "prime", inv: "inverse", finv: "réciproque", base: "base",
      sum: "la somme", prod: "le produit", int: "l'intégrale", lim: "la limite quand", tends: "tend vers", approaches: "tend vers", from: "de", to: "à", gives: "donne", equil: "est en équilibre avec", implies: "implique", iff: "si et seulement si",
      abs: "la valeur absolue de", given: "sachant", set: "l'ensemble", suchthat: "tel que", conc: "la concentration en", choose: "parmi", bar: "barre", vec: "vecteur", seg: "le segment", angle: "l'angle", tri: "le triangle", par: "est parallèle à", perp: "est perpendiculaire à", cong: "est isométrique à", sim: "est semblable à",
      in: "appartient à", notin: "n'appartient pas à", subset: "est inclus dans", union: "union", inter: "inter", empty: "l'ensemble vide", inf: "l'infini", therefore: "donc", because: "car", etc: ", et ainsi de suite,",
      matrix: "la matrice", det: "le déterminant", row: "ligne", endm: "fin de la matrice", enddet: "fin du déterminant", colvec: "le vecteur colonne",
      ival: (a, b, lo, hi) => lo && hi ? `l'intervalle fermé de ${a} à ${b}` : !lo && !hi ? `l'intervalle ouvert de ${a} à ${b}` : `l'intervalle de ${a}, ${lo ? "inclus" : "exclu"}, à ${b}, ${hi ? "inclus" : "exclu"}`,
      aq: "aqueux", s: "solide", l: "liquide", g: "gaz", ion_p: "plus", ion_m: "moins", up: "dégagement gazeux", down: "précipité",
      N: "l'ensemble des entiers naturels", Z: "l'ensemble des entiers relatifs", Q: "l'ensemble des rationnels", R: "l'ensemble des réels",
      fn: { sin: "sinus", cos: "cosinus", tan: "tangente", log: "log", ln: "logarithme népérien", exp: "exponentielle", max: "maximum", min: "minimum", sinh: "sinus hyperbolique", cosh: "cosinus hyperbolique", tanh: "tangente hyperbolique", arcsin: "arc sinus", arccos: "arc cosinus", arctan: "arc tangente" },
      greek: { alpha: "alpha", beta: "bêta", gamma: "gamma", delta: "delta", epsilon: "epsilon", varepsilon: "epsilon", theta: "thêta", vartheta: "thêta", lambda: "lambda", mu: "mu", pi: "pi", rho: "rhô", sigma: "sigma", tau: "tau", phi: "phi", varphi: "phi", omega: "oméga", Delta: "delta", Sigma: "sigma", Omega: "oméga", Theta: "thêta", Phi: "phi", Lambda: "lambda", Gamma: "gamma", Pi: "pi", Psi: "psi", eta: "êta", zeta: "dzêta", chi: "khi", psi: "psi", nu: "nu", xi: "xi", kappa: "kappa", partial: "d rond" },
      ord: ["", "", "demi", "tiers", "quart", "cinquième", "sixième", "septième", "huitième", "neuvième", "dixième", "onzième", "douzième"], hundredth: "centième", nums: ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"],
      celsius: "degrés Celsius", fahr: "degrés Fahrenheit", per: "par", square: "carré", cubic: "cube", after: true,
      pre: { k: "kilo", M: "méga", G: "giga", m: "milli", "µ": "micro", "μ": "micro", n: "nano", p: "pico", c: "centi", d: "déci" },
      units: { mm: ["millimètre", "millimètres"], cm: ["centimètre", "centimètres"], m: ["mètre", "mètres"], km: ["kilomètre", "kilomètres"], mg: ["milligramme", "milligrammes"], g: ["gramme", "grammes"], kg: ["kilogramme", "kilogrammes"], t: ["tonne", "tonnes"],
        ms: ["milliseconde", "millisecondes"], s: ["seconde", "secondes"], min: ["minute", "minutes"], h: ["heure", "heures"], ml: ["millilitre", "millilitres"], mL: ["millilitre", "millilitres"], L: ["litre", "litres"], l: ["litre", "litres"],
        N: ["newton", "newtons"], J: ["joule", "joules"], W: ["watt", "watts"], kWh: ["kilowattheure", "kilowattheures"], Wh: ["wattheure", "wattheures"], V: ["volt", "volts"], A: ["ampère", "ampères"], F: ["farad", "farads"], T: ["tesla", "teslas"],
        "Ω": ["ohm", "ohms"], "kΩ": ["kiloohm", "kiloohms"], "MΩ": ["mégaohm", "mégaohms"], ohm: ["ohm", "ohms"], Pa: ["pascal", "pascals"], Hz: ["hertz", "hertz"], mol: ["mole", "moles"], K: ["kelvin", "kelvins"], C: ["coulomb", "coulombs"],
        eV: ["électronvolt", "électronvolts"], M: ["mole par litre", "moles par litre"], dB: ["décibel", "décibels"], rad: ["radian", "radians"], Bq: ["becquerel", "becquerels"], Gy: ["gray", "grays"] },
      els: "H hydrogène,He hélium,Li lithium,Be béryllium,B bore,C carbone,N azote,O oxygène,F fluor,Ne néon,Na sodium,Mg magnésium,Al aluminium,Si silicium,P phosphore,S soufre,Cl chlore,Ar argon,K potassium,Ca calcium,Ti titane,Cr chrome,Mn manganèse,Fe fer,Co cobalt,Ni nickel,Cu cuivre,Zn zinc,Br brome,Kr krypton,Rb rubidium,Sr strontium,Ag argent,Sn étain,I iode,Xe xénon,Cs césium,Ba baryum,Pt platine,Au or,Hg mercure,Pb plomb,Rn radon,Ra radium,U uranium,Pu plutonium",
      anion: { Cl: "chlorure", F: "fluorure", Br: "bromure", I: "iodure", O: "oxyde", S: "sulfure", N: "nitrure" },
      abbr: [[/\bp\. ?ex\.(?=[\s,]|$)/gi, "par exemple"], [/\bc\.-à-d\.(?=[\s,]|$)/gi, "c'est-à-dire"], [/\betc\.(?=[\s,)]|$)/gi, "et cetera"]] }
  };
  for(const w of Object.values(W)) w.el = Object.fromEntries(w.els.split(",").map(x => x.split(" ")));
  const BASE = new Set("m g s A V W J F Hz Pa L l N C Ω eV mol M T Wh".split(" "));
  const ELEMENTS = new Set("H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm".split(" "));
  const sp = s => " " + s + " ";
  const clean = s => String(s).replace(/\s+([,.;:])/g, "$1").replace(/,(\s*,)+/g, ",").replace(/([.;:]),/g, "$1").replace(/\s+/g, " ").replace(/^[\s,]+|[\s,]+$/g, "");
  const supDigit = c => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c);
  // French says decimals with "virgule"; English voices already say "point"
  const numSay = (n, w) => w === W.fr ? String(n).replace(/(\d)[.,](\d)/g, "$1 virgule $2") : String(n);
  const isPlural = (n, w) => { const v = parseFloat(String(n).replace(",", ".")); return w === W.fr ? !(Math.abs(v) < 2) : v !== 1; };

  // a whole number word for small numbers ("three fifths"), digits otherwise
  function fraction(a, b, w, us){
    const A = +a, B = +b;
    if(/^\d+$/.test(a) && /^\d+$/.test(b) && A >= 1 && A <= 12 && (B >= 2 && B <= 12 || B === 100)){
      let o = B === 100 ? w.hundredth : w.ord[B]; if(B === 4 && us && w.ordUS4) o = w.ordUS4;
      if(w === W.fr){ return A === 1 ? (B === 2 ? "un demi" : "un " + o) : w.nums[A] + " " + (B === 2 ? "demis" : B === 3 ? "tiers" : B === 4 ? "quarts" : o + "s"); }
      return (A === 1 ? "one" : w.nums[A]) + " " + (A === 1 ? o : (B === 2 ? "halves" : o + "s"));
    }
    return null;
  }

  // ---- chemistry: formulas spelled out, coefficients and subscripts as numbers, state symbols and arrows in words.
  // A single element or ion on its own is said by name: "Cu" → "copper", "Fe³⁺" → "iron 3 plus", "Cl⁻" → "chloride".
  function species(tok, w, alone){
    let t = tok, words = [];
    const iso = t.match(/^(?:\^(\d+)(?:_\d+)?|_\d+\^(\d+))([A-Z][a-z]?)$/);      // ¹⁴₆C → carbon 14
    if(iso) return (w.el[iso[3]] || iso[3].split("").join(" ").toUpperCase()) + " " + (iso[1] || iso[2]);
    const coef = t.match(/^(\d+)(?=[A-Z(\[])/); if(coef){ words.push(coef[1]); t = t.slice(coef[1].length); }
    const state = t.match(/\((aq|s|l|g)\)$/); if(state) t = t.slice(0, -state[0].length);
    let charge = null;
    const ch = t.match(/\^(\d*)([+-])$/) || t.match(/([A-Za-z)\]])(\d?)([+-])$/);
    if(ch){ if(ch.length === 3){ charge = [ch[1], ch[2]]; t = t.slice(0, -ch[0].length); } else { charge = [ch[2], ch[3]]; t = t.slice(0, -(ch[2].length + 1)); } }
    if(alone && !coef && !state && /^[A-Z][a-z]?$/.test(t) && w.el[t] && t !== "H"){
      if(!charge) return w.el[t];
      if(charge[1] === "-" && w.anion[t]) return w.anion[t];
      if(charge[1] === "+") return w.el[t] + " " + (charge[0] && charge[0] !== "1" ? charge[0] + " " : "") + w.ion_p;
    }
    for(const m of t.matchAll(/([A-Z][a-z]?)|(\d+)|([(\[])|([)\]])/g)){
      if(m[1]) words.push(m[1].split("").join(" ").toUpperCase());
      else if(m[2]) words.push(m[2]);
      else if(m[3]) words.push(w.obr);
      else if(m[4]) words.push(w.cbr);
    }
    if(charge) words.push((charge[0] || "") + " " + (charge[1] === "+" ? w.ion_p : w.ion_m));
    if(state) words.push(w[state[1]]);
    return words.join(" ");
  }
  function chem(s, w){
    s = String(s).replace(/<=>|<->|⇌|\\rightleftharpoons/g, " ⇌ ").replace(/->|→|\\rightarrow|\\to\b/g, " → ").replace(/\\uparrow|↑/g, " ↑ ").replace(/\\downarrow|↓/g, " ↓ ");
    s = s.replace(/\\mathrm\{([^{}]*)\}/g, "$1").replace(/\\text\{([^{}]*)\}/g, "$1").replace(/[{}]/g, "").replace(/\\,/g, " ");
    s = s.replace(/([⁰¹²³⁴-⁹]+)([⁺⁻])/g, (a, d, g) => "^" + [...d].map(supDigit).join("") + (g === "⁺" ? "+" : "-")).replace(/[₀-₉]/g, c => "₀₁₂₃₄₅₆₇₈₉".indexOf(c)).replace(/⁺/g, "^+").replace(/⁻/g, "^-").replace(/[⁰¹²³⁴-⁹]/g, supDigit).replace(/\^(\d+)\^([+-])/g, "^$1$2");
    const toks = s.split(/\s+/).filter(Boolean), alone = toks.length === 1, out = [];
    for(const tok of toks){
      if(tok === "+"){ out.push(", " + w.plus); continue; }
      if(tok === "→"){ out.push(", " + w.gives); continue; }
      if(tok === "⇌"){ out.push(", " + w.equil); continue; }
      if(tok === "↑"){ out.push(w.up); continue; }
      if(tok === "↓"){ out.push(w.down); continue; }
      out.push(species(tok, w, alone));
    }
    return clean(out.join(" "));
  }
  const isFormula = t => { const p = t.match(/[A-Z][a-z]?/g); return !!p && p.join("") === t.replace(/\d+/g, "") && p.every(x => ELEMENTS.has(x)) && (/\d/.test(t) || p.length >= 2 && /[a-z]/.test(t)) && t.length <= 14; };

  // ---- units: "m/s^2", "m s^-2", "kJ mol^-1", "µF", "kg/m³" → words
  function uname(sym, w){
    if(w.units[sym]) return w.units[sym];
    const p = sym[0], b = sym.slice(1);
    if(w.pre[p] && b && BASE.has(b) && w.units[b]) return w.units[b].map(x => w.pre[p] + x);
    return null;
  }
  function unitWords(u, n, w){
    u = String(u).replace(/\\Omega\s*/g, "Ω").replace(/\\mu\s*/g, "µ").replace(/\\(?:mathrm|text|textrm)\{([^{}]*)\}/g, "$1").replace(/\\[,;: !]|\\cdot|\\quad|·|⋅|~/g, " ")
      .replace(/\^\{\s*([^{}]*?)\s*\}/g, "^$1").replace(/²/g, "^2").replace(/³/g, "^3").replace(/⁻¹/g, "^-1").replace(/⁻²/g, "^-2").replace(/⁻³/g, "^-3").replace(/−/g, "-").replace(/\s+/g, " ").trim();
    if(/^(°|\^\\circ|\^∘|\\circ)\s*C$/.test(u)) return w.celsius;
    if(/^°\s*F$/.test(u)) return w.fahr;
    const num = [], den = [], parts = u.split("/");
    for(let k = 0; k < parts.length; k++) for(const p of parts[k].trim().split(" ").filter(Boolean)){
      const m = p.match(/^([A-Za-zΩµμ]+)(?:\^(-?)([123]))?$/); if(!m) return null;
      const nm = uname(m[1], w); if(!nm) return null;
      (k > 0 || m[2] === "-" ? den : num).push({ nm, e: m[3] ? +m[3] : 1 });
    }
    if(!num.length && !den.length) return null;
    const pl = isPlural(n, w);
    const a = num.map((x, j) => { const one = pl && j === num.length - 1, name = x.nm[one ? 1 : 0];
      if(x.e === 1) return name;
      if(w.after) return name + " " + (x.e === 2 ? w.square : w.cubic) + (one ? "s" : "");     // mètres carrés
      return (x.e === 2 ? w.square : w.cubic) + " " + name; });
    const b = den.map(x => w.per + " " + x.nm[0] + (x.e === 2 ? " " + w.sq : x.e === 3 ? " " + w.cube : ""));
    return a.concat(b).join(" ");
  }
  const TXT_UNITS = "°C °F km/h kWh Wh kPa kHz MHz GHz kJ MJ kN kW MW GW mW mA µA μA mV kV kΩ MΩ mol min Hz Pa mm cm km dm nm µm μm kg mg µg μg ml mL cL dL ms µs μs ns µF μF nF pF eV keV MeV dB Ω m g s N J W V h L"
    .split(" ").sort((a, b) => b.length - a.length).map(x => x.replace(/[/]/g, "\\/")).join("|");
  const U1 = `(?:${TXT_UNITS})(?:[²³]|⁻[¹²³]|\\^-?[123])?`;
  const UNIT_RE = new RegExp(`(\\d(?:[\\d.,]*\\d)?)\\s?(${U1}(?:\\s?\\/\\s?${U1}|\\s(?=[A-Za-zΩµμ]+(?:⁻|\\^-))${U1})*)(?![A-Za-z])`, "g");
  const U_TAIL = `\\/\\s?${U1}|\\s(?=[A-Za-zΩµμ]+(?:⁻|\\^-))${U1}`, U_ALL = TXT_UNITS.split("|");
  const UNIT_ALONE = new RegExp(`(\\b(?:in|en)\\s|(?:^|\\s)\\()((?:${U_ALL.filter(x => x.length > 1 || /[NJWV]/.test(x)).join("|")})(?:[²³]|\\^[23])?(?:${U_TAIL})*|(?:${U_ALL.filter(x => x.length === 1).join("|")})(?:${U_TAIL})+)(?=[\\s.,;:?!)]|$)`, "g");

  // ---- plain text (not maths): units after numbers, chemical formulas, symbols, abbreviations
  function text(s, lang){
    const w = W[lang] || W.en;
    s = String(s || "");
    for(const [re, to] of w.abbr) s = s.replace(re, to);
    s = s.replace(UNIT_RE, (all, n, u, off, whole) => {
      const adj = w === W.en && /\b(a|an)\s$/i.test(whole.slice(Math.max(0, off - 4), off));      // "a 60 W bulb" → "a 60 watt bulb"
      const x = unitWords(u, adj ? 1 : n, w); return x ? n + " " + x : all; });
    s = s.replace(UNIT_ALONE, (all, pre, u) => { const x = unitWords(u, 2, w); return x ? pre + x : all; });
    s = s.replace(/(\d)\s?M(?=\s+[A-Z][a-z]?[A-Z0-9₀-₉a-z]*\b)/g, (a, d) => d + " " + w.units.M[1]);            // 0.1 M HCl
    s = s.replace(/\b(mm|cm|km|m)([²³])/g, (a, u, p) => w.after ? w.units[u][1] + " " + (p === "²" ? w.square : w.cubic) + "s" : (p === "²" ? w.square : w.cubic) + " " + w.units[u][1]);
    s = s.replace(/[A-Z][A-Za-z0-9₀-₉]*[⁰¹²³⁴-⁹]*[⁺⁻]?(?:\([a-z]{1,2}\))?/g, t => {
      const core = t.replace(/[₀-₉]/g, c => "₀₁₂₃₄₅₆₇₈₉".indexOf(c)).replace(/\((aq|s|l|g)\)$/, ""), ion = /[⁺⁻]$/.test(core), body = core.replace(/[⁰¹²³⁴-⁹]*[⁺⁻]$/, "");
      return isFormula(body) || ion && (ELEMENTS.has(body) || isFormula(body + "1")) ? chem(t, w) : t; });
    s = s.replace(/(\d)\s?\/\s?(\d{1,3})(?![\d\/])/g, (a, x, y, off, whole) => { if(/[\d\/]/.test(whole[off - 1] || "")) return a; const f = +x < +y ? fraction(x, y, w) : null; return f || a; });
    s = s.replace(/(\S)\s\+\s(?=\S)/g, "$1" + sp(w.plus)).replace(/\s=\s/g, sp(w.eq)).replace(/(^|[\s(=])[-−](?=\d)/g, "$1" + w.minus + " ");
    s = s.replace(/°/g, sp(w.deg)).replace(/²/g, sp(w.sq)).replace(/³/g, sp(w.cube)).replace(/→/g, sp(w.gives)).replace(/⇌/g, sp(w.equil))
      .replace(/≤/g, sp(w.le)).replace(/≥/g, sp(w.ge)).replace(/≠/g, sp(w.ne)).replace(/≈/g, sp(w.approx)).replace(/×/g, sp(w.times)).replace(/÷/g, sp(w.div)).replace(/±/g, sp(w.pm))
      .replace(/√/g, sp(w.sqrt)).replace(/π/g, " pi ").replace(/∞/g, sp(w.inf)).replace(/Δ/g, " delta ").replace(/θ/g, " theta ").replace(/µ|μ/g, " micro ").replace(/Ω/g, sp(w.units["Ω"][1])).replace(/%/g, sp(w.pct))
      .replace(/_{3,}|\.{4,}|…{2,}/g, ", blank, ");
    if(w === W.fr) s = s.replace(/(\d)[.,](\d)/g, "$1 virgule $2");
    return clean(s);
  }

  // ---- LaTeX maths → words
  function tex(src, lang, opts){
    const w = W[lang] || W.en, us = opts && opts.us;
    let i = 0; const s = String(src || "").replace(/\\(left|right)(?![a-zA-Z])\s*\.?/g, "");
    const group = () => {        // {…} or one token
      while(s[i] === " ") i++;
      if(s[i] === "{"){ let d = 1, j = i + 1; while(j < s.length && d){ if(s[j] === "\\"){ j += 2; continue; } if(s[j] === "{") d++; else if(s[j] === "}") d--; j++; } const g = s.slice(i + 1, j - 1); i = j; return g; }
      if(s[i] === "\\"){ const m = s.slice(i).match(/^\\([a-zA-Z]+|.)/); i += m[0].length; return m[0]; }
      return s[i++] || "";
    };
    const opt = () => { if(s[i] !== "[") return null; const j = s.indexOf("]", i); const g = s.slice(i + 1, j); i = j + 1; return g; };
    const T = g => tex(g, lang, opts);
    const out = [];
    let prev = "", ofNext = 0, numCtx = null, unitCtx = false, absOpen = 0, setOpen = 0;
    const say = (x, n, unit) => { out.push(x); prev = x; numCtx = n || null; unitCtx = !!unit; };
    const nextIs = re => re.test(s.slice(i).replace(/^\s+/, ""));
    while(i < s.length){
      const c = s[i];
      if(c === " " || c === "~"){ i++; continue; }
      if(c === "\\"){
        const m = s.slice(i).match(/^\\([a-zA-Z]+|.)/); i += m[0].length; const cmd = m[1];
        if(/^[dt]?frac$/.test(cmd)){
          const a = group().trim(), b = group().trim(); const f = fraction(a, b, w, us);
          if(f){ say(f); continue; }
          const A = T(a), B = T(b);
          if(/^(d|\\partial\s*)(\^\{?\d\}?)?\s*[a-zA-Z]?$/.test(a) && /^(d|\\partial\s*)\s*[a-zA-Z](\^\{?\d\}?)?$/.test(b)){ say(A + " " + w.by + " " + B); continue; }                  // dy/dx → "d y by d x"
          const ops = new RegExp(`\\b(${[w.plus, w.minus, w.times, w.div].join("|")})\\b`);
          say(ops.test(A) ? ", " + A + ", " + w.allover + " " + B + ", " : ", " + A + " " + w.over + " " + B + ", "); continue;
        }
        if(cmd === "sqrt"){ const n = opt(), g = group(); say(n == null ? w.sqrt + " " + T(g) + "," : n.trim() === "3" ? w.cuberoot + " " + T(g) + "," : "the " + T(n) + " " + w.root + " " + T(g) + ","); continue; }
        if(cmd === "ce"){ say(chem(group(), w)); continue; }
        if(cmd === "begin"){
          const env = group().trim(), endTag = "\\end{" + env + "}", j = s.indexOf(endTag, i);
          let body = j < 0 ? s.slice(i) : s.slice(i, j); i = j < 0 ? s.length : j + endTag.length;
          if(env === "array") body = body.replace(/^\s*\{[^{}]*\}/, "");
          const rows = body.split(/\\\\/).map(r => r.trim()).filter(Boolean).map(r => r.split("&").map(x => T(x)).filter(Boolean));
          if(/matrix$/.test(env) || env === "array"){
            const det = /^[vV]matrix$/.test(env);
            if(!det && rows.length > 1 && rows.every(r => r.length === 1)) say(w.colvec + " " + rows.map(r => r[0]).join(", ") + ",");
            else say((det ? w.det : w.matrix) + ", " + rows.map((r, k) => w.row + " " + (k + 1) + ": " + r.join(", ")).join("; ") + "; " + (det ? w.enddet : w.endm) + ",");
          } else say(rows.map(r => r.join(env === "cases" ? ", " : " ")).join("; ") + ",");
          continue;
        }
        if(cmd === "end"){ group(); continue; }
        if(/^(text|mathrm|textrm|textbf|textit|mathbf|mathit|mathsf|operatorname|textnormal|mbox)$/.test(cmd)){
          const g = group();
          // a unit right after a number (or after another unit: kJ mol⁻¹), a chemical formula, or ordinary words
          let rest = ""; const sup = s.slice(i).match(/^\s*\^\s*(\{\s*-?\s*[123]\s*\}|[23])/);
          if(sup && (numCtx || unitCtx)){ rest = "^" + sup[1].replace(/[{}\s]/g, ""); i += sup[0].length; }
          const u = numCtx || unitCtx ? unitWords(g + rest, numCtx || 2, w) : null;
          if(u){ say(u, null, true); continue; }
          if(rest){ i -= sup[0].length; }
          const sub = s.slice(i).match(/^\s*_\s*(\{\d+\}|\d)/);
          if(/^[A-Z][a-z]?$/.test(g.trim()) && (sub || ELEMENTS.has(g.trim()))){ say(g.trim().split("").join(" ").toUpperCase()); continue; }
          if(isFormula(g.replace(/_\{?(\d+)\}?/g, "$1")) || /\^\{?\d*[+-]\}?$/.test(g)){ say(chem(g, w)); continue; }
          say(text(g, lang)); continue;
        }
        if(cmd === "mu" && numCtx){ const mm = s.slice(i).match(/^\s*\\(?:mathrm|text)\{([^{}]*)\}/); if(mm){ const u = unitWords("µ" + mm[1], numCtx, w); if(u){ i += mm[0].length; say(u, null, true); continue; } } }
        if(cmd === "left" || cmd === "right" || /^(big|Big|bigg|Bigg)[lr]?$/.test(cmd) || /^(displaystyle|textstyle|limits|nolimits|quad|qquad|,|;|:|!| |mathstrut|strut|phantom)$/.test(cmd)){
          if(cmd === "phantom") group();
          if(/^(,|;|:|!| |quad|qquad)$/.test(cmd)) continue;     // a thin space keeps "9.8 \, m" together
          continue;
        }
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
        if(cmd === "ldots" || cmd === "dots" || cmd === "cdots"){ say(w.etc); continue; }
        if(cmd === "prime"){ say(w.prime); continue; }
        if(cmd === "mid"){ say(setOpen ? w.suchthat : w.given); continue; }
        if(cmd === "lvert" || cmd === "rvert" || cmd === "vert"){ i -= 0; if(absOpen){ absOpen--; say(","); } else if(/\\(rvert|vert)|\|/.test(s.slice(i))){ absOpen++; say(w.abs); } continue; }
        if(cmd === "{"){ setOpen++; say(w.set); continue; }
        if(cmd === "}"){ if(setOpen) setOpen--; say(","); continue; }
        if(cmd === "mathbb"){ const g = group().trim(); say(w[g] || g); continue; }
        if(cmd === "N" || cmd === "Z" || cmd === "Q" || cmd === "R"){ say(w[cmd]); continue; }
        if(cmd === "binom"){ const a = group(), b = group(); say(T(a) + " " + w.choose + " " + T(b)); continue; }
        if(cmd === "bar" || cmd === "overline"){ const g = group(); say(/^[A-Z]{2}$/.test(g.trim()) ? w.seg + " " + g.trim().split("").join(" ") : T(g) + " " + w.bar); continue; }
        if(cmd === "vec" || cmd === "overrightarrow"){ const g = group().trim(); say(w.vec + " " + (/^[A-Z]+$/.test(g) ? g.split("").join(" ") : T(g))); continue; }
        if(cmd === "hat" || cmd === "dot" || cmd === "tilde" || cmd === "overset" || cmd === "underline"){ if(cmd === "overset") group(); say(T(group())); continue; }
        if(cmd === "sum" || cmd === "int" || cmd === "lim" || cmd === "prod"){
          let lo = null, hi = null;
          for(let k = 0; k < 2; k++){ while(s[i] === " ") i++; if(s[i] === "_"){ i++; lo = group(); } else if(s[i] === "^"){ i++; hi = group(); } }
          if(cmd === "lim") say(w.lim + " " + T(lo || "").replace(w.gives, w.tends) + ",");
          else say((cmd === "int" ? w.int : cmd === "prod" ? w.prod : w.sum) + (lo != null ? " " + w.from + " " + T(lo) : "") + (hi != null ? " " + w.to + " " + T(hi) : "") + " " + w.of);
          continue;
        }
        if(w.fn[cmd]){
          let name = w.fn[cmd];
          const inv = s.slice(i).match(/^\s*\^\s*\{\s*-\s*1\s*\}/); if(inv){ i += inv[0].length; name = w.inv + " " + name; }
          const pw = !inv && s.slice(i).match(/^\s*\^\s*(?:\{\s*(\d+)\s*\}|(\d))/);            // sin²x → "sine squared of x"
          if(pw){ i += pw[0].length; const d = pw[1] || pw[2]; name += " " + (d === "2" ? w.sq : d === "3" ? w.cube : w.pow + " " + d); }
          const base = s.slice(i).match(/^\s*_/); if(base && cmd === "log"){ i += base[0].length; name += " " + w.base + " " + T(group()); }
          say(name + " " + w.of); ofNext = 1; continue;
        }
        if(cmd === "Omega" && numCtx){ say(w.units["Ω"][isPlural(numCtx, w) ? 1 : 0], null, true); continue; }
        if(cmd === "mu" && /^\\mathrm\{?[a-zA-Z]/.test(s.slice(i).trim())){ say("micro"); continue; }
        if(w.greek[cmd]){ say(w.greek[cmd]); continue; }
        if(cmd === "|" || cmd === "\\" || cmd === "&"){ if(cmd === "\\") say(","); continue; }
        continue;   // anything else: say nothing rather than nonsense
      }
      if(c === "^"){
        i++; const g = group().trim();
        const timesTen = prev === "10" && out[out.length - 2] === w.times;
        if(prev === "10" && (timesTen || !/^[23]$/.test(g)) && /^-?\d+$/.test(g.replace(/[\s−]/g, "").replace("−", "-"))){ say(w.tpow + " " + T(g), "2"); continue; }   // 10³ in standard form → "10 to the power 3"
        if(g === "2") say(w.sq); else if(g === "3") say(w.cube);
        else if(g === "\\circ" || g === "∘" || g === "\\degree"){
          const cm = s.slice(i).match(/^\s*(\\mathrm\{C\}|\\text\{C\}|C)/); if(cm){ i += cm[0].length; say(w.celsius); } else say(w.deg);
        }
        else if(g === "\\prime" || g === "'") say(w.prime);
        else if(g === "-1" && /^[fgh]$/.test(prev)){ say(w.finv + (nextIs(/^\(/) ? " " + w.of : "")); ofNext = nextIs(/^\(/) ? 1 : 0; }
        else if(/^[+-]$|^\d[+-]$/.test(g)) say(g.replace(/[+-]/, x => " " + (x === "+" ? w.ion_p : w.ion_m)));
        else if(/^\d+\/\d+$/.test(g)){ const [a, b] = g.split("/"); say(w.pow + " " + (fraction(a, b, w, us) || a + " " + w.over + " " + b) + ","); }
        else say(w.pow + " " + T(g) + ",");
        continue;
      }
      if(c === "_"){
        i++; const g = group(), t = g.trim();
        say(/^[a-z]{3,}$/.test(t) && /[aeiouy]/.test(t) || /^(in|out|eq|on|off)$/.test(t) ? t : T(g));     // F_net → "F net", v_max → "v max"
        continue;
      }
      if(c === "{" ){ say(T(group())); continue; }
      if(c === "}"){ i++; continue; }
      if(/[\d.]/.test(c)){
        const r = s.slice(i); let m, n;
        if((m = r.match(/^(\d+)\{,\}(\d+)/))) n = m[1] + "." + m[2];                                          // 1{,}5 → 1.5
        else if(w === W.en && (m = r.match(/^\d{1,3}(?:(?:\{,\}|,)\d{3})+(?![\d])(?:\.\d+)?/))) n = m[0].replace(/\{,\}|,/g, "");   // 1,000,000
        else if(w === W.fr && (m = r.match(/^\d+,\d+(?![\d,])/))) n = m[0].replace(",", ".");                // 3,5 in a French paper
        else if((m = r.match(/^\d*\.?\d+/))) n = m[0];
        if(m){ i += m[0].length; say(numSay(n, w), n); continue; }
        i++; continue;
      }
      if(/[a-zA-Z]/.test(c)){ i++; say(c); continue; }
      if(c === "[" || c === "]"){
        const iv = s.slice(i).match(/^([\[\]])\s*([^\[\],;]+?)\s*[,;]\s*([^\[\],;]+?)\s*([\[\])])/);
        if(iv){ i += iv[0].length; say(w.ival(T(iv[2]), T(iv[3]), iv[1] === "[", iv[4] === "]") + ","); continue; }       // [0, 1] → "the closed interval from 0 to 1"
        if(c === "["){
          const j = s.indexOf("]", i), inner = j > 0 ? s.slice(i + 1, j).trim() : "";
          if(inner && (/^\\(mathrm|ce|text)\{/.test(inner) || /^[A-Z][a-z]?[A-Z0-9a-z]*\^?\{?\d*[+-]?\}?$/.test(inner))){ i = j + 1; say(w.conc + " " + chem(inner.replace(/^\\ce\{(.*)\}$/, "$1"), w)); continue; }   // [H⁺]
        }
        i++; continue;
      }
      if(c === "|"){
        i++;
        if(absOpen){ absOpen--; say(","); continue; }
        if(s.indexOf("|", i) >= 0 || /\\(rvert|vert)/.test(s.slice(i))){ absOpen++; say(w.abs); continue; }              // |x − 3|
        say(setOpen ? w.suchthat : w.given); continue;                                                                    // P(A|B) → "P of A given B"
      }
      i++;
      if(c === "+") say(w.plus);
      else if(c === "-" || c === "−") say(w.minus);
      else if(c === "=") say(w.eq);
      else if(c === "<") say(w.lt);
      else if(c === ">") say(w.gt);
      else if(c === "/") say(w.over);
      else if(c === "(" ){ if(ofNext || /^[fghPp]$/.test(prev)){ if(!ofNext) say(w.of); ofNext = 0; } else say(w.obr); }
      else if(c === ")"){ const opened = out.lastIndexOf(w.obr); if(opened >= 0 && out.slice(opened).indexOf(w.cbr) < 0) say(w.cbr); }
      else if(c === "!") say(w.fact);
      else if(c === "'") say(w.prime);
      else if(c === "%") say(w.pct);
      else if(c === "," || c === ";") say(",");
      else if(c === ":"){ if(setOpen) say(w.suchthat); }
      else if(c === "°") say(w.deg);
      else if("≤≥≠≈×÷±→".includes(c)) say(text(c, lang));
    }
    return clean(out.join(" "));
  }
  return { tex, text, chem };
})();
