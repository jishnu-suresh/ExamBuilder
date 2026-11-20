/* ---- the student's own choices: how it looks, keyboards, reading aloud ---- */
function applyPrefs(){
  const p = ST.prefs, B = document.body;
  document.documentElement.style.setProperty("--fs", (p.size || 17) + "px");
  B.classList.toggle("sp-wide", p.space === "wide");
  B.classList.toggle("f-easy", p.font === "easy"); B.classList.toggle("f-dys", p.font === "dys");
  B.classList.toggle("c-cream", p.colour === "cream"); B.classList.toggle("c-dark", p.colour === "dark");
  $("#bMathKb").classList.toggle("on", !!p.mathKb); $("#bAccents").classList.toggle("on", !!p.accents);
  $$("#mView .seg").forEach(s => { const k = s.dataset.pref, v = String(p[k] == null ? (k === "size" ? 17 : k === "rate" ? 1 : "") : p[k]); s.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === v)); });
  if(!p.accents) $("#accBar").classList.add("hidden");
  $$("#paper textarea").forEach(t => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; });
}
$("#bView").onclick = () => openM("#mView");
$$("#mView .seg").forEach(s => s.addEventListener("click", e => {
  const b = e.target.closest("button[data-v]"); if(!b) return;
  const k = s.dataset.pref; ST.prefs[k] = k === "size" || k === "rate" ? +b.dataset.v : b.dataset.v; changed(); applyPrefs();
}));
$("#bMathKb").onclick = () => {
  ST.prefs.mathKb = !ST.prefs.mathKb; changed(); applyPrefs();
  if(!ST.prefs.mathKb && window.mathVirtualKeyboard) mathVirtualKeyboard.hide();
  toast(ST.prefs.mathKb ? "The maths keyboard opens when you click in a maths box (＋ Maths)." : "Maths keyboard off.");
};

/* French accents */
const ACC = "é è ê ë à â ä ç î ï ô ö ù û ü ÿ œ æ « » ’ €".split(" ");
let accShift = false, lastText = null;
function accBar(){
  $("#accBar").innerHTML = `<button class="shift ${accShift ? "on" : ""}" data-shift title="Capital letters">⇧</button>` +
    ACC.map(c => { const C = accShift ? c.toUpperCase() : c; return `<button data-ch="${C}">${C}</button>`; }).join("");
}
$("#bAccents").onclick = () => { ST.prefs.accents = !ST.prefs.accents; changed(); applyPrefs(); if(ST.prefs.accents){ accBar(); $("#accBar").classList.remove("hidden"); toast("Click a letter to add it where you are typing."); } };
document.addEventListener("focusin", e => { if(e.target.matches && e.target.matches("textarea, .txtin, #stName, #stClass")) lastText = e.target; });
$("#accBar").addEventListener("mousedown", e => e.preventDefault());
$("#accBar").addEventListener("click", e => {
  if(e.target.closest("[data-shift]")){ accShift = !accShift; accBar(); return; }
  const b = e.target.closest("[data-ch]"); if(!b || !lastText || !document.body.contains(lastText)) return toast("Click in your answer first.");
  const t = lastText, s = t.selectionStart, en = t.selectionEnd;
  t.setRangeText(b.dataset.ch, s, en, "end"); t.dispatchEvent(new Event("input", { bubbles: true })); t.focus();
  if(accShift){ accShift = false; accBar(); }
});

/* 🔊 read aloud (the computer's own voice, works offline) */
let speaking = null;
function voiceFor(lang){
  const vs = speechSynthesis.getVoices(), L = lang || "en";
  return vs.find(v => v.lang && v.lang.toLowerCase().startsWith(L) && v.localService) || vs.find(v => v.lang && v.lang.toLowerCase().startsWith(L)) || null;
}
function say(text, btn){
  if(!("speechSynthesis" in window)) return toast("This computer can't read aloud.");
  speechSynthesis.cancel();
  if(speaking === btn){ speaking = null; btn.classList.remove("on"); return; }
  $$("[data-say].on").forEach(b => b.classList.remove("on"));
  const u = new SpeechSynthesisUtterance(text), v = voiceFor(PAPER.lang);
  if(v) u.voice = v; u.lang = (v && v.lang) || (PAPER.lang === "fr" ? "fr-FR" : "en-GB");
  u.rate = ST.prefs.rate || 1;
  u.onend = u.onerror = () => { btn.classList.remove("on"); if(speaking === btn) speaking = null; };
  speaking = btn; btn.classList.add("on"); speechSynthesis.speak(u);
  logEv("read aloud");
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-say]"); if(!b) return;
  let text = "";
  const sub = b.closest(".sl"), note = b.closest(".note"), q = b.closest(".q");
  if(sub) text = sub.querySelector("[data-plain]").dataset.plain;
  else if(note) text = note.dataset.plain;
  else if(q){ text = [q.querySelector(".body > .rich").dataset.plain].concat($$(`#${q.id} .opt .rich`).map(o => o.dataset.plain)).join(". \n"); }
  if(text) say(text, b);
});
