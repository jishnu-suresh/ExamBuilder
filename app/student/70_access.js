/* ---- the student's own choices: how it looks, keyboards, reading aloud ---- */
function applyPrefs(){
  const p = ST.prefs, B = document.body;
  document.documentElement.style.setProperty("--fs", (p.size || 17) + "px");
  B.classList.toggle("sp-wide", p.space === "wide");
  B.classList.toggle("f-easy", p.font === "easy"); B.classList.toggle("f-dys", p.font === "dys");
  B.classList.toggle("c-cream", p.colour === "cream"); B.classList.toggle("c-dark", p.colour === "dark");
  $("#bMathKb").classList.toggle("on", !!p.mathKb); $("#bAccents").classList.toggle("on", !!p.accents);
  $$("#mView .seg").forEach(s => { const k = s.dataset.pref, v = String(p[k] == null ? (k === "size" ? 17 : "") : p[k]); s.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.v === v)); });
  if(!p.accents) $("#accBar").classList.add("hidden");
  applySupport();
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

/* 🔊 read aloud — the computer's own voices (they work offline); sentence by sentence, with pause, stop, speed and voice */
const TTS = { i: -1, chunks: [], k: 0, paused: false, tok: 0 };
const hasTTS = () => "speechSynthesis" in window;
function voiceList(){
  if(!hasTTS()) return [];
  const L = (PAPER && PAPER.lang) || EXAM.lang || "en", want = (EXAM.accent || (L === "fr" ? "fr-FR" : "en-GB")).toLowerCase();
  return speechSynthesis.getVoices().filter(v => (v.lang || "").toLowerCase().replace("_", "-").startsWith(L)).map(v => {
    const lang = v.lang.toLowerCase().replace("_", "-");
    let score = 0;
    if(/natural|neural|premium|enhanced|siri/i.test(v.name)) score += 6;      // the most human-sounding voices
    if(/google/i.test(v.name)) score += 3;
    if(lang === want) score += 4;
    if(!v.localService && !navigator.onLine) score -= 20;                       // online voices need the internet
    if(v.localService) score += 1;
    const acc = lang.endsWith("-gb") ? "British" : lang.endsWith("-us") ? "American" : lang.endsWith("-au") ? "Australian" : lang.endsWith("-ie") ? "Irish" : lang.endsWith("-ca") ? "Canadian" : lang.endsWith("-in") ? "Indian" : lang.endsWith("-fr") ? "France" : lang.split("-")[1] ? lang.split("-")[1].toUpperCase() : "";
    const nm = v.name.replace(/^(Microsoft|Google|Apple)\s+/i, "").replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+-\s+.*$/, "").replace(/Online|Natural/g, "").trim();
    return { v, score, label: (nm || v.name) + (acc ? " — " + acc : "") + (/natural|neural|premium|enhanced/i.test(v.name) ? " ★" : "") + (!v.localService ? " (internet)" : "") };
  }).sort((a, b) => b.score - a.score);
}
// 🎙️ the teacher recorded some of the paper: their voice comes first (the computer voice reads the rest)
const hasRec = () => !!(PAPER && PAPER.audio && Object.keys(PAPER.audio).length);
const TEACHER = "__teacher";
function fillVoices(){
  const vs = voiceList(), sel = $("#ttsVoice");
  sel.innerHTML = (hasRec() ? `<option value="${TEACHER}">🎙️ Your teacher's voice</option>` : "") + vs.map((x, k) => `<option value="${esc(x.v.voiceURI)}">${esc(x.label)}</option>`).join("");
  sel.classList.toggle("hidden", !sel.options.length);
  const keep = ST && ST.prefs.voice && [...sel.options].some(o => o.value === ST.prefs.voice);
  if(keep) sel.value = ST.prefs.voice; else if(sel.options[0]) sel.value = sel.options[0].value;
}
const teacherOn = () => hasRec() && $("#ttsVoice").value === TEACHER;
if(hasTTS()) speechSynthesis.addEventListener("voiceschanged", () => { if(PAPER) fillVoices(); });
function curVoice(){ const id = $("#ttsVoice").value; if(id === TEACHER){ const b = voiceList()[0]; return b ? b.v : null; } return speechSynthesis.getVoices().find(v => v.voiceURI === id) || null; }
// one player for all the recordings: Safari lets the same player carry on to the next question by itself
const VO = new Audio(); VO.preload = "auto";
function playRec(){
  const tok = ++TTS.tok, U = UNITS[TTS.i]; let started = false;
  // the computer voice steps in only if the recording never started (some browsers report an error at the very end)
  const fallback = () => {
    if(tok !== TTS.tok || TTS.k >= 1) return;
    if(started){ TTS.k = 1; unitDone(); return; }
    U.audioBad = true; if(hasTTS()) readUnit(TTS.i); else { toast("This computer can't play the recording."); stopReading(); }
  };
  VO.onplaying = () => { if(tok === TTS.tok) started = true; };
  VO.onended = () => { if(tok !== TTS.tok || TTS.k >= 1) return; TTS.k = 1; unitDone(); };
  VO.onerror = fallback;
  if(VO.src !== U.audio) VO.src = U.audio; else VO.currentTime = 0;
  VO.playbackRate = ST.prefs.rate || 1;
  const p = VO.play();
  if(p && p.catch) p.catch(e => { if(tok !== TTS.tok) return; if(e && e.name === "NotAllowedError"){ TTS.paused = true; $("#ttsPlay").textContent = "▶"; } else if(!(e && e.name === "AbortError")) fallback(); });
}
function unitDone(){
  if($("#ttsGo").checked && TTS.i + 1 < UNITS.length) return readUnit(TTS.i + 1);
  TTS.paused = false; $("#ttsPlay").textContent = "▶";
}
// short pieces: Chrome stops long readings, and a pause or a new speed is quicker to apply.
// A piece only ends at . ! ? ; : followed by a space, so "9.8" is never cut. "‖" starts a new piece after a short pause.
function chunks(t){
  const out = [];
  String(t || "").split("‖").forEach((seg, k) => {
    const parts = seg.replace(/\s+/g, " ").trim().match(/.+?(?:[.!?;:]+(?=\s|$)|$)/g) || [];
    let first = true;
    for(const p0 of parts){
      const p = p0.trim(), last = out[out.length - 1]; if(!p) continue;
      if(!first && last && (last.t + " " + p).length < 160) last.t += " " + p;
      else out.push({ t: p, gap: first && k > 0 && out.length > 0 });
      first = false;
    }
  });
  return out;
}
function mark(){ $$(".reading").forEach(e => e.classList.remove("reading")); const u = UNITS[TTS.i]; if(u && u.el){ u.el.classList.add("reading"); const r = u.el.getBoundingClientRect(); if(r.top < 70 || r.bottom > innerHeight - 100) u.el.scrollIntoView({ behavior: "smooth", block: "center" }); } }
function readUnit(i){
  if(i < 0 || i >= UNITS.length) return stopReading();
  const rec = !!(UNITS[i].audio && !UNITS[i].audioBad && teacherOn());
  if(!rec && !hasTTS()) return toast("This computer can't read aloud.");
  if(hasTTS()) speechSynthesis.cancel();
  try{ VO.pause(); }catch(_){}
  TTS.i = i; TTS.rec = rec; TTS.chunks = rec ? [{ t: "" }] : chunks(UNITS[i].text); TTS.k = 0; TTS.paused = false; TTS.tok++;
  $("#tts").classList.remove("hidden"); document.body.classList.add("tts-up");
  $("#ttsLab").textContent = "🔊 " + UNITS[i].label; $("#ttsPlay").textContent = "⏸";
  mark(); if(rec) playRec(); else speakChunk();
  logEv("read aloud");
}
function speakChunk(){
  const tok = ++TTS.tok;
  if(TTS.k >= TTS.chunks.length) return unitDone();
  const u = new SpeechSynthesisUtterance(TTS.chunks[TTS.k].t), v = curVoice();
  if(v){ try{ u.voice = v; }catch(_){} u.lang = v.lang; } else u.lang = (PAPER.lang === "fr" ? "fr-FR" : EXAM.accent || "en-GB");
  u.rate = ST.prefs.rate || 1;
  u.onend = () => { if(tok !== TTS.tok) return; TTS.k++;
    const nx = TTS.chunks[TTS.k];
    if(nx && nx.gap) setTimeout(() => { if(tok === TTS.tok && !TTS.paused) speakChunk(); }, 600 / (ST.prefs.rate || 1));   // a breath before each answer
    else speakChunk(); };
  u.onerror = e => { if(tok !== TTS.tok || e.error === "interrupted" || e.error === "canceled") return; TTS.k++; speakChunk(); };
  speechSynthesis.speak(u);
}
function stopReading(){ TTS.tok++; if(hasTTS()) speechSynthesis.cancel(); try{ VO.pause(); }catch(_){} TTS.rec = false; TTS.i = -1; TTS.paused = false; $$(".reading").forEach(e => e.classList.remove("reading")); $("#tts").classList.add("hidden"); document.body.classList.remove("tts-up"); }
function again(){ if(TTS.rec) return readUnit(TTS.i); TTS.tok++; speechSynthesis.cancel(); TTS.paused = false; $("#ttsPlay").textContent = "⏸"; speakChunk(); }   // the same sentence again, with a new speed or voice
$("#ttsPlay").onclick = () => {
  if(TTS.i < 0) return;
  if(TTS.k >= TTS.chunks.length) return readUnit(TTS.i);              // finished: read it again
  if(TTS.rec){
    if(TTS.paused){ TTS.paused = false; $("#ttsPlay").textContent = "⏸"; VO.play().catch(() => {}); }
    else { TTS.paused = true; $("#ttsPlay").textContent = "▶"; VO.pause(); }
    return;
  }
  if(TTS.paused){
    TTS.paused = false; $("#ttsPlay").textContent = "⏸"; speechSynthesis.resume();
    setTimeout(() => { if(!TTS.paused && !speechSynthesis.speaking) again(); }, 400);   // some voices can't carry on after a pause
  }else{ TTS.paused = true; $("#ttsPlay").textContent = "▶"; speechSynthesis.pause(); }
};
$("#ttsStop").onclick = stopReading;
$("#ttsPrev").onclick = () => readUnit(Math.max(0, TTS.i - 1));
$("#ttsNext").onclick = () => readUnit(Math.min(UNITS.length - 1, TTS.i + 1));
$("#ttsRate").addEventListener("input", e => { ST.prefs.rate = +e.target.value; VO.playbackRate = ST.prefs.rate; $("#ttsRateV").textContent = (+e.target.value).toFixed(2).replace(/0$/, "") + "×"; changed(); });
$("#ttsRate").addEventListener("change", () => { if(TTS.i >= 0 && !TTS.paused && !TTS.rec) again(); });     // a recording just changes speed
$("#ttsVoice").addEventListener("change", e => { ST.prefs.voice = e.target.value; changed();
  if(TTS.i < 0) return;
  if(!TTS.paused) readUnit(TTS.i);
  else { TTS.tok++; if(hasTTS()) speechSynthesis.cancel(); try{ VO.pause(); }catch(_){} TTS.k = TTS.chunks.length; }   // paused: ▶ starts this part again in the new voice
});
$("#ttsGo").addEventListener("change", e => { ST.prefs.keepReading = e.target.checked; changed(); });
function setupReading(){
  if(!EXAM.readAloud) return;
  fillVoices();
  $("#ttsRate").value = ST.prefs.rate || 1; $("#ttsRateV").textContent = (+(ST.prefs.rate || 1)).toFixed(2).replace(/0$/, "") + "×";
  $("#ttsGo").checked = ST.prefs.keepReading != null ? !!ST.prefs.keepReading : READ_ONLY();
}
document.addEventListener("click", e => {
  const b = e.target.closest("[data-say]"); if(!b) return;
  const i = +b.dataset.say;
  if(TTS.i === i && !TTS.paused && TTS.k < TTS.chunks.length) return stopReading();
  readUnit(i);
});
$("#bReadAll").onclick = () => readUnit(0);
