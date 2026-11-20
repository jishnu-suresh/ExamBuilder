/* ---- the question paper (the HTML was made by BEE, from the same text as the printed paper) ---- */
const READ_ONLY = () => EXAM.mode === "read";
let UNITS = [];         // the parts that can be read aloud, in reading order: { text, label, el }
function renderPaper(){
  const P = PAPER, c = P.cover, el = $("#paper"), RO = READ_ONLY();
  UNITS = [];
  // tidy the spoken text: no " ." or "?." (they make some voices pause oddly)
  const unit = (label, text) => { UNITS.push({ label, text: String(text || "").replace(/\s+([.,;:?!])/g, "$1").replace(/([.?!:])(\s*\.)+/g, "$1").replace(/\s+/g, " ").trim() }); return UNITS.length - 1; };
  const sayBtn = (u, t) => EXAM.readAloud ? `<button class="ico" data-say="${u}" title="${esc(t || "Read this aloud")}">🔊</button>` : "";
  const facts = [c.subject && ["Subject", c.subject], (EXAM.timeMin || c.durationText) && ["Time", EXAM.timeMin ? EXAM.timeMin + " minutes" : c.durationText], c.total && ["Total", c.total + " marks"], c.teacher && ["Teacher", c.teacher], c.date && ["Date", c.date]].filter(Boolean);
  let h = `<div class="cover"><h1>${esc(c.title)}</h1>${c.subtitle ? `<div class="sub">${esc(c.subtitle)}</div>` : ""}
    <div class="meta">${facts.map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join("")}</div>
    ${c.instructionsHTML ? `<div class="instr rich" data-u="${unit("Instructions", "Instructions. " + (c.instructionsPlain || ""))}">${c.instructionsHTML}<div style="text-align:right">${sayBtn(UNITS.length - 1, "Read the instructions")}</div></div>` : ""}</div>`;
  for(const it of P.items){
    if(it.k === "sec"){ h += `<h2 class="sec rich" data-u="${unit(it.plain.slice(0, 40), it.plain)}">${it.html}</h2>`; continue; }
    if(it.k === "note"){
      if(it.heading){ h += `<div class="note rich heading" data-u="${unit(it.plain.slice(0, 40), it.plain)}">${it.html}</div>`; continue; }
      const u = unit(it.plain.length > 30 ? "Text" : it.plain, it.plain);
      h += `<div class="note rich" data-u="${u}">${it.html}${it.plain.length > 30 || RO ? `<div style="text-align:right">${sayBtn(u)}</div>` : ""}</div>`; continue;
    }
    const qn = it.no ? "Question " + it.no : "Question";
    const opts = it.mcq ? it.opts.map(o => o.L + ": " + o.plain).join(". ") : "";
    const u = unit(qn, qn + ". " + it.plain + (opts ? ". " + opts : "") + (it.marks ? ". " + it.marks + (it.marks === "1" ? " mark." : " marks.") : ""));
    h += `<section class="q" id="q-${it.id}" data-q="${it.id}">
      <div class="qh"><span class="no">${esc(it.no || "")}</span>
        <div class="body"><div data-u="${u}"><div class="rich">${it.html}</div>
          ${it.mcq ? (RO ? `<div class="ro-opts">${it.opts.map(o => `<div><b>${esc(o.L)}.</b><span class="rich">${o.html}</span></div>`).join("")}</div>` : optsHTML(it)) : ""}</div>
          ${it.ans && !RO ? `<div data-area="${it.id}|main"></div>` : ""}
          ${(it.subs || []).map(sb => { const su = unit(qn + " " + sb.L, "Part " + sb.L.replace(/[()]/g, "") + ". " + sb.plain + (sb.marks ? ". " + sb.marks + (sb.marks === "1" ? " mark." : " marks.") : "")); return `<div class="sub"><div class="sl" data-u="${su}"><b>${esc(sb.L)}</b><div class="rich" style="flex:1">${sb.html}</div>
              ${sb.marks ? `<span class="mk">[${esc(sb.marks)}]</span>` : ""}${sayBtn(su, "Read " + sb.L + " aloud")}</div>
              ${RO ? "" : `<div data-area="${it.id}|s:${sb.key}"></div>`}</div>`; }).join("")}
        </div>
        <div class="tools">${it.marks ? `<span class="mk">[${esc(it.marks)}]</span>` : ""}
          ${sayBtn(u, "Read the question aloud")}
          ${RO ? "" : `<button class="ico" data-flag title="Come back to this question later">🚩</button>`}</div>
      </div></section>`;
  }
  el.innerHTML = h;
  UNITS.forEach((x, k) => { x.el = el.querySelector(`[data-u="${k}"]`); });
  if(!RO) for(const it of P.items){
    if(it.k !== "q") continue;
    if(it.ans) mountArea(it, "main", it.ans);
    (it.subs || []).forEach(sb => mountArea(it, "s:" + sb.key, sb.ans || { kind: "lines", lines: 3 }));
  }
  // "draw on this picture" under every picture of a question that has somewhere to answer
  if(EXAM.drawing && !RO) $$("#paper .q img.pic[data-pic]").forEach(img => {
    const q = img.closest(".q"), sub = img.closest(".sub");
    const area = (sub && sub.querySelector("[data-area]")) || q.querySelector('[data-area$="|main"]') || q.querySelector("[data-area]");
    if(!area) return;
    const b = document.createElement("button"); b.className = "btn drawon"; b.textContent = "✏️ Draw or label on this picture";
    b.onclick = () => addBlock(area.dataset.area, { t: "draw", bg: { pic: img.dataset.pic } }, true);
    (img.closest(".picwrap") || img).after(b);
  });
  $$("#paper .q").forEach(q => { const f = q.querySelector("[data-flag]"); if(f && ST.flags[q.dataset.q]) f.classList.add("on"); });
  renderNav();
}
function optsHTML(it){
  const sel = new Set(((ST.answers[it.id] || {}).choice) || []), type = it.mcq === "multi" ? "checkbox" : "radio";
  return `${it.mcq === "multi" ? `<div class="multi-hint">Choose all the answers that are right.</div>` : ""}<div class="opts" role="${type === "radio" ? "radiogroup" : "group"}">${it.opts.map(o => `
    <label class="opt ${sel.has(o.i) ? "sel" : ""}"><input type="${type}" name="o-${it.id}" value="${o.i}" ${sel.has(o.i) ? "checked" : ""} data-choice="${it.id}"><b>${esc(o.L)}.</b><span class="rich" data-plain="${esc(o.L + ". " + o.plain)}">${o.html}</span></label>`).join("")}</div>`;
}
document.addEventListener("change", e => {
  const inp = e.target.closest("[data-choice]"); if(!inp || ST.endedAt) return;
  const id = inp.dataset.choice, A = ST.answers[id] || (ST.answers[id] = {});
  A.choice = $$(`input[data-choice="${id}"]`).filter(x => x.checked).map(x => +x.value);
  $$(`input[data-choice="${id}"]`).forEach(x => x.closest(".opt").classList.toggle("sel", x.checked));
  changed(); renderNav();
});
// a radio answer can be taken back: click the chosen one again
document.addEventListener("click", e => {
  const inp = e.target.closest('input[type=radio][data-choice]'); if(!inp) return;
  if(inp.dataset.was === "1"){ inp.checked = false; inp.dispatchEvent(new Event("change", { bubbles: true })); }
  $$(`input[data-choice="${inp.dataset.choice}"]`).forEach(x => x.dataset.was = x.checked ? "1" : "");
});
document.addEventListener("click", e => {
  const f = e.target.closest("[data-flag]"); if(!f) return;
  const id = f.closest(".q").dataset.q; ST.flags[id] = !ST.flags[id]; if(!ST.flags[id]) delete ST.flags[id];
  f.classList.toggle("on", !!ST.flags[id]); changed(); renderNav();
});
function isAnswered(it){
  const A = ST.answers[it.id]; if(!A) return false;
  if((A.choice || []).length) return true;
  return Object.values(A.areas || {}).some(bl => bl.some(b => b.t === "draw" ? (b.ops || []).length : String(b.v || "").trim()));
}
function renderNav(){
  const qs = PAPER.items.filter(it => it.k === "q");
  const RO = READ_ONLY();
  $("#navGrid").innerHTML = qs.map(it => `<a href="#q-${it.id}" class="${!RO && isAnswered(it) ? "done" : ""} ${ST.flags[it.id] ? "flag" : ""}" title="Question ${esc(it.no || "")}">${esc(it.no || "•")}</a>`).join("");
}
