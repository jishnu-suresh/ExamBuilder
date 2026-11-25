/* ---------------- 🧮 the calculator: the one the teacher chose ----------------
   BEEcalc Basic / Scientific / Graphing are built in and work offline (77_beecalc.js, 78_beegraph.js).
   Desmos Graphing loads from desmos.com when first opened (their terms don't allow putting it inside this file),
   so it needs the internet; without it the panel says so and the test carries on.
   The teacher can switch it on, change it or take it away during the exam (👩‍🏫 menu, with the teacher code). */
const DESMOS_KEY = "dcb31709b452b1cf9dc26972add0fda6";      // Desmos's documented demo key: replace with BEE's own free key before release
const CALC_NAMES = { basic: "BEEcalc Basic", scientific: "BEEcalc Scientific", graphing: "BEEcalc Graphing", desmos: "Desmos Graphing" };
const CALC = { loading: null, ui: null, kind: null };
const calcKind = () => (ST && ST.calcKind != null ? ST.calcKind : EXAM.calc) || "";
function loadDesmos(){
  if(window.Desmos) return Promise.resolve();
  if(CALC.loading) return CALC.loading;
  CALC.loading = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://www.desmos.com/api/v1.12/calculator.js?apiKey=" + DESMOS_KEY;
    const t = setTimeout(() => rej(new Error("timeout")), 15000);
    s.onload = () => { clearTimeout(t); window.Desmos ? res() : rej(new Error("no Desmos")); };
    s.onerror = () => { clearTimeout(t); rej(new Error("offline")); };
    document.head.appendChild(s);
  }).catch(e => { CALC.loading = null; throw e; });
  return CALC.loading;
}
// a phone screen is too small for a graphing calculator: it gets BEEcalc Scientific instead (screen size, so turning the phone or resizing a window doesn't change it)
const smallScreen = () => Math.min(screen.width || innerWidth, screen.height || innerHeight) < 600;
const shownCalc = k => (k === "graphing" || k === "desmos") && smallScreen() ? "scientific" : k;
function calcMsg(t){ const m = $("#calcMsg"); m.textContent = t || ""; m.classList.toggle("hidden", !t); $("#calcBox").classList.toggle("hidden", !!t); }
async function openCalc(){
  const chosen = calcKind(); if(!CALC_NAMES[chosen]) return;
  const k = shownCalc(chosen), P = $("#calcPanel");
  P.classList.remove("hidden"); P.classList.toggle("graph", k === "graphing" || k === "desmos"); P.classList.toggle("basic", k === "basic"); P.classList.toggle("scientific", k === "scientific"); $("#calcKind").textContent = CALC_NAMES[k] + (k !== chosen ? " · graphing needs a bigger screen" : "");
  if(CALC.kind === k && CALC.ui) return;
  CALC.kind = k; CALC.ui = null; $("#calcBox").innerHTML = "";
  ST.calc = ST.calc || {};
  logEv("calculator opened", k !== chosen ? { calc: k, chosen, why: "small screen" } : { calc: k });
  if(k !== "desmos"){
    calcMsg("");
    CALC.ui = k === "graphing" ? beeGraphUI($("#calcBox"), ST.calc.graphing = ST.calc.graphing || {}) : beeCalcUI($("#calcBox"), k, ST.calc[k] = ST.calc[k] || {});
    return;
  }
  if(navigator.onLine === false){ calcMsg("Desmos needs the internet, and this computer is offline. Tell your teacher."); return; }
  calcMsg("Loading the calculator…");
  try{
    await loadDesmos();
    if(CALC.kind !== "desmos") return;
    calcMsg("");
    CALC.ui = window.Desmos.GraphingCalculator($("#calcBox"), { settingsMenu: false, border: false, links: false, images: false, folders: false, notes: false, pasteGraphLink: false, degreeMode: true, language: EXAM.lang === "fr" ? "fr" : "en" });
  }catch(e){ calcMsg("Desmos couldn't load (it needs the internet). Tell your teacher. Everything else works as normal."); logEv("calculator could not load"); }
}
function closeCalc(){ $("#calcPanel").classList.add("hidden"); }
$("#bCalc").onclick = () => { if($("#calcPanel").classList.contains("hidden")) openCalc(); else closeCalc(); };
$("#calcClose").onclick = closeCalc;
// move the panel by its title bar
(() => { const P = $("#calcPanel"), H = $("#calcHead"); let d = null;
  H.addEventListener("pointerdown", e => { if(e.target.closest("button")) return; const r = P.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; H.setPointerCapture(e.pointerId); });
  H.addEventListener("pointermove", e => { if(!d) return; P.style.left = Math.max(0, Math.min(innerWidth - 80, e.clientX - d.x)) + "px"; P.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - d.y)) + "px"; P.style.right = P.style.bottom = "auto"; });
  H.addEventListener("pointerup", () => { d = null; });
})();
function setupCalc(){
  const k = calcKind(), on = !!CALC_NAMES[k] && !READ_ONLY();
  $("#bCalc").classList.toggle("hidden", !on);
  $("#bCalc").title = on ? CALC_NAMES[k] : "Calculator";
  if(!on) closeCalc();
}
// 👩‍🏫 the teacher switches it on, changes it or takes it away
$("#tCalc").addEventListener("change", e => {
  const v = e.target.value; if(v === calcKind()) return;
  const from = calcKind();
  ST.calcKind = v; logEv("calculator changed by the teacher", { from: from || "none", to: v || "none" });
  changed(); saveNow(); closeCalc(); CALC.kind = null; setupCalc();
  toast(v ? CALC_NAMES[v] + " is on for this student." : "The calculator is off for this student.");
});
