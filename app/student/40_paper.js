/* ---- the question paper (the HTML was made by BEE, from the same text as the printed paper) ---- */
function renderPaper(){
  const P = PAPER, c = P.cover, el = $("#paper");
  const facts = [c.subject && ["Subject", c.subject], (EXAM.timeMin || c.durationText) && ["Time", EXAM.timeMin ? EXAM.timeMin + " minutes" : c.durationText], c.total && ["Total", c.total + " marks"], c.teacher && ["Teacher", c.teacher], c.date && ["Date", c.date]].filter(Boolean);
  let h = `<div class="cover"><h1>${esc(c.title)}</h1>${c.subtitle ? `<div class="sub">${esc(c.subtitle)}</div>` : ""}
    <div class="meta">${facts.map(([k, v]) => `<span>${esc(k)}: <b>${esc(v)}</b></span>`).join("")}</div>
    ${c.instructionsHTML ? `<div class="instr rich">${c.instructionsHTML}</div>` : ""}</div>`;
  for(const it of P.items){
    if(it.k === "sec"){ h += `<h2 class="sec rich">${it.html}</h2>`; continue; }
    if(it.k === "note"){ h += `<div class="note rich ${it.heading ? "heading" : ""}" data-plain="${esc(it.plain)}">${it.html}${EXAM.readAloud && !it.heading && it.plain.length > 30 ? `<div style="text-align:right"><button class="ico" data-say title="Read this aloud">🔊</button></div>` : ""}</div>`; continue; }
    h += `<section class="q" id="q-${it.id}" data-q="${it.id}">
      <div class="qh"><span class="no">${esc(it.no || "")}</span>
        <div class="body"><div class="rich" data-plain="${esc(it.plain)}">${it.html}</div>
          ${it.mcq ? optsHTML(it) : ""}
          ${it.ans ? `<div data-area="${it.id}|main"></div>` : ""}
          ${(it.subs || []).map(sb => `<div class="sub"><div class="sl"><b>${esc(sb.L)}</b><div class="rich" style="flex:1" data-plain="${esc(sb.plain)}">${sb.html}</div>
              ${sb.marks ? `<span class="mk">[${esc(sb.marks)}]</span>` : ""}${EXAM.readAloud ? `<button class="ico" data-say title="Read (${esc(sb.L)}) aloud">🔊</button>` : ""}</div>
              <div data-area="${it.id}|s:${sb.key}"></div></div>`).join("")}
        </div>
        <div class="tools">${it.marks ? `<span class="mk">[${esc(it.marks)}]</span>` : ""}
          ${EXAM.readAloud ? `<button class="ico" data-say title="Read the question aloud">🔊</button>` : ""}
          <button class="ico" data-flag title="Come back to this question later">🚩</button></div>
      </div></section>`;
  }
  el.innerHTML = h;
  // answer areas
  for(const it of P.items){
    if(it.k !== "q") continue;
    if(it.ans) mountArea(it, "main", it.ans);
    (it.subs || []).forEach(sb => mountArea(it, "s:" + sb.key, sb.ans || { kind: "lines", lines: 3 }));
  }
  // "draw on this picture" under every picture of a question that has somewhere to answer
  if(EXAM.drawing) $$("#paper .q img.pic[data-pic]").forEach(img => {
    const q = img.closest(".q"), sub = img.closest(".sub");
    const area = (sub && sub.querySelector("[data-area]")) || q.querySelector('[data-area$="|main"]') || q.querySelector("[data-area]");
    if(!area) return;
    const b = document.createElement("button"); b.className = "btn drawon"; b.textContent = "✏️ Draw or label on this picture";
    b.onclick = () => addBlock(area.dataset.area, { t: "draw", bg: { pic: img.dataset.pic } }, true);
    (img.closest(".picwrap") || img).after(b);
  });
  $$("#paper .q").forEach(q => { if(ST.flags[q.dataset.q]) q.querySelector("[data-flag]").classList.add("on"); });
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
  $("#navGrid").innerHTML = qs.map(it => `<a href="#q-${it.id}" class="${isAnswered(it) ? "done" : ""} ${ST.flags[it.id] ? "flag" : ""}" title="Question ${esc(it.no || "")}">${esc(it.no || "•")}</a>`).join("");
}
