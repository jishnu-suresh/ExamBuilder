/* ---------------- UI render ---------------- */
function bindDetails(){
  document.querySelectorAll("[data-k]").forEach(el => {
    const k = el.dataset.k;
    if(el.type === "checkbox") el.checked = !!S.d[k]; else el.value = S.d[k] ?? "";
    el.addEventListener(el.type === "checkbox" || el.tagName === "SELECT" || el.type === "color" ? "change" : "input", () => {
      S.d[k] = el.type === "checkbox" ? el.checked : el.value;
      if(k === "accent") S.d.accentChosen = true;
      lastEdited = null;
      if(k === "justify" || k === "restartNumbering" || k === "totalOverride" || k === "bigInline" || k === "answerMode") render();
      changed();
    });
  });
}
function syncStyleUI(){
  const c = S.d.style === "colour";
  document.querySelectorAll("[data-show-colour]").forEach(el => el.classList.toggle("hidden", !c));
  const acc = document.querySelector('[data-k="accent"]'); if(acc) acc.closest("label").classList.toggle("hidden", c);
}
document.addEventListener("change", e => { if(e.target.matches && e.target.matches('[data-k="style"]')) setTimeout(syncStyleUI, 0); });
setTimeout(syncStyleUI, 0); addEventListener("load", () => setTimeout(syncStyleUI, 50));
function refreshDetails(){
  try{ renderRubric(); }catch(e){}
  setTimeout(syncStyleUI, 0);
  document.querySelectorAll("[data-k]").forEach(el => {
    const k = el.dataset.k;
    if(el.type === "checkbox") el.checked = !!S.d[k]; else el.value = S.d[k] ?? "";
  });
}
function updateLogoUI(){
  const src = S.logo && S.logo.src;
  $("#logoThumb").src = src || "";
  $("#logoThumb").classList.toggle("hidden", !src);
  $("#topLogo").src = src || DEFAULT_LOGO;
}

function render(){
  const { meta, auto, total, qCount, secs } = computeMeta();
  $("#autoTotalHint").textContent = "auto: " + fmt(auto);
  $("#summary").innerHTML = S.items.length
    ? `<span><b>${qCount}</b> question${qCount === 1 ? "" : "s"}</span><span><b>${secs.length}</b> part${secs.length === 1 ? "" : "s"}</span><span>Total <b>${fmt(total)}</b> marks${S.d.totalOverride !== "" ? " (set manually)" : ""}</span>`
    : "";
  S.items.forEach(ensureOptions);
  const list = $("#list");
  if(!S.items.length){
    list.innerHTML = `<div class="empty">No questions yet. Drop a .txt file or some photos above, or click <b>＋ Question</b>.</div>`;
    return;
  }
  const secQs = sid => { const out = []; let on = false; for(const x of S.items){ if(x.type === "section"){ on = x.id === sid; continue; } if(on && x.type === "q") out.push(x); } return out; };
  const secAllHalf = sid => { const q = secQs(sid); return q.length > 0 && q.every(x => x.width === "half"); };
  window.__secQs = secQs; window.__secAllHalf = secAllHalf;
  const opt = (v, l, cur) => `<option value="${v}" ${String(cur || "") === v ? "selected" : ""}>${l}</option>`;
  const partSecs = S.items.filter(x => x.type === "section");
  const partOf = {}; let curSec = "";
  S.items.forEach(x => { if(x.type === "section") curSec = x.id; else partOf[x.id] = curSec; });
  const partOpts = id => `<option value="">${partSecs.length ? "— no part —" : "— none yet —"}</option>` +
    partSecs.map((x, i) => `<option value="${x.id}" ${partOf[id] === x.id ? "selected" : ""}>${esc((x.text || "Part " + (i + 1)).replace(/\$+([^$]*)\$+/g, "$1").slice(0, 40))}</option>`).join("") +
    `<option value="__new">＋ New part…</option>`;
  list.innerHTML = S.items.map((it, idx) => {
    const tools = `<div class="tools">
        <button class="btn icon" data-act="up" title="Move up" ${idx === 0 ? "disabled" : ""}>↑</button>
        <button class="btn icon" data-act="down" title="Move down" ${idx === S.items.length - 1 ? "disabled" : ""}>↓</button>
        <button class="btn icon" data-act="insbelow" title="Insert a new question below this one">＋</button>
        <button class="btn icon" data-act="dup" title="Duplicate">⧉</button>
        <button class="btn icon danger" data-act="del" title="Delete">✕</button></div>`;
    const imgBlock = it.img ? `<div class="img"><img src="${it.img.src}" alt=""></div>
        <div class="row"><label>Image width <input type="range" min="5" max="100" step="5" data-f="imgSize" value="${it.imgSize || 100}"> <span>${it.imgSize || 100}%</span></label>
        <span class="seg algn" title="Image position">${[["left","⇤ Left"],["center","↔ Centre"],["right","Right ⇥"]].map(([v,l]) => `<button type="button" data-act="align" data-v="${v}" class="${(it.imgAlign || "left") === v ? "on" : ""}">${l}</button>`).join("")}</span>
        ${(it.imgAlign || "left") !== "center" ? `<label class="wrapchk" title="Put the question text ${(it.imgAlign || "left") === "left" ? "to the right" : "to the left"} of the picture"><input type="checkbox" data-f="imgWrap" ${it.imgWrap ? "checked" : ""}> Wrap text ${(it.imgAlign || "left") === "left" ? "on the right" : "on the left"}</label>` : ""}</div>
        <div class="row">
        <button class="btn sm" data-act="label" title="Add label lines to a diagram (biology, physics…)">🏷 Label diagram</button><button class="btn sm" data-act="ocr" title="Turn the text in this photo into typed questions">🔍 Read text</button><button class="btn sm" data-act="rot">⟳ Rotate</button><button class="btn sm danger" data-act="rmimg">Remove image</button></div>` : "";
    if(it.type === "section"){
      return `<div class="card section" data-id="${it.id}"><div class="badge">§</div><div class="body">
        <div class="row"><span class="kind">Part / section</span>${tools}</div>
        <input type="text" data-f="text" value="${esc(it.text)}" placeholder="Part heading, e.g. Part I: FCQ">
        <div class="row"><label>Marks for this part <input type="number" min="0" step="0.5" data-f="marks" value="${esc(it.marks)}" placeholder="${fmt(meta[it.id] || 0)}"></label><span class="hint">blank = sum of its questions</span><span class="grow"></span><button class="btn sm ${it.newPage ? "on-t" : ""}" data-act="newpage" title="Start this part on a new page">⤓ New page</button><button class="btn sm" data-act="sec2col" title="Print the short questions of this part two per row">⫴ ${secAllHalf(it.id) ? "Back to 1 column" : "2 columns for this part"}</button></div>
      </div></div>`;
    }
    if(it.type === "note" && it.pagebreak){
      return `<div class="card note pagebreak" data-id="${it.id}"><div class="badge">⤓</div><div class="body">
        <div class="row"><span class="kind">Page break — what follows starts on a new page</span>${tools}</div>
      </div></div>`;
    }
    if(it.type === "note" && it.heading){
      return `<div class="card note subpart" data-id="${it.id}"><div class="badge">A</div><div class="body">
        <div class="row"><span class="kind">Sub-part heading</span>${tools}</div>
        <input type="text" data-f="text" value="${esc(it.text)}" placeholder="e.g. A. Definitions (18 points)">
        <div class="row"><label>Points shown on the right <input type="number" min="0" step="0.5" data-f="marks" value="${esc(it.marks || "")}" placeholder="—"></label><span class="hint">optional · for show only, the total comes from the questions</span><span class="grow"></span><button class="btn sm ${it.newPage ? "on-t" : ""}" data-act="newpage" title="Start this sub-part on a new page">⤓ New page</button></div>
      </div></div>`;
    }
    if(it.type === "note"){
      return `<div class="card note" data-id="${it.id}"><div class="badge">¶</div><div class="body">
        <div class="row"><span class="kind">Text / passage (not numbered)</span>${tools}</div>
        ${fmtBar(it)}
      <textarea data-f="text" placeholder="Instructions, a reading passage, a diagram caption…">${esc(it.text)}</textarea>
        <div class="miss hidden" data-miss></div><div class="picstrip hidden" data-pics></div>
        <div class="rich hidden" data-rich></div>
        ${imgBlock}<div class="row">${insertMenu(it)}
        <span class="grow"></span>${moreMenu(it)}</div>${moreChips(it)}
      </div></div>`;
    }
    return `<div class="card" data-id="${it.id}"><div class="badge">${it.nonum ? "–" : meta[it.id]}</div><div class="body">
      <div class="row"><span class="kind">${it.nonum ? "Question (no number)" : "Question " + meta[it.id]}</span>${tools}</div>
      ${fmtBar(it)}
      <textarea data-f="text" placeholder="${it.img ? "Optional text above the image…" : "Type the question… maths: $x^2+1$ · or use ∑ Equation"}">${esc(it.text)}</textarea>
      <div class="miss hidden" data-miss></div><div class="picstrip hidden" data-pics></div>
      ${it.mcq ? `<div class="opts">${(it.options || []).map((o, oi) => `<div class="opt-row" data-oi="${oi}"><b>${LETTERS[oi].toUpperCase()}.</b><input type="text" data-opt="${oi}" value="${esc(o)}" placeholder="Option ${LETTERS[oi].toUpperCase()} — maths: $x^2$"><button class="btn icon cor ${(it.correct || []).includes(oi) ? "on" : ""}" data-act="correct" data-oi="${oi}" title="Mark as the correct answer (for the answer key)">✓</button><button class="btn icon danger" data-act="optdel" data-oi="${oi}" title="Remove option">✕</button></div>`).join("")}
        <div class="opt-add"><button class="btn sm" data-act="optadd">＋ Add option</button><span class="hint">Press Enter in an option to add the next one</span></div></div>` : ""}
      <div class="rich hidden" data-rich></div>
      ${imgBlock}
      ${subsBlock(it)}
      ${it.mcq ? "" : ansBlock(it, null)}
      <div class="row">
        ${(it.subs || []).some(sb => num(sb.marks) > 0) ? `<label title="The sum of the sub-question marks">Marks <input type="number" disabled value="${fmt(qMarks(it))}" style="opacity:.7"></label>` : `<label>Marks <input type="number" min="0" step="0.5" data-f="marks" value="${esc(it.marks)}"></label>`}
        ${it.mcq ? "" : spaceCtl(it, "data-f")}
        <label>Part <select data-part>${partOpts(it.id)}</select></label>
        <label>Type <select data-f="mcq">${opt("", "Written", it.mcq)}${opt("single", "MCQ · one answer", it.mcq)}${opt("multi", "MCQ · multiple answers", it.mcq)}</select></label>
        ${it.mcq || /^\s*\(?[a-hA-H][\).]/m.test(qText(it)) ? `<label>Options <select data-f="optCols">${opt("", "1 per line", it.optCols)}${opt("2", "2 columns", it.optCols)}${opt("4", "4 columns", it.optCols)}</select></label>` : ""}
        <span class="grow"></span>
        ${it.mcq ? "" : `<button class="btn sm" data-act="subadd" title="Add (a), (b), (c)… parts with their own marks">＋ Sub-question</button>`}
        ${it.mcq || (it.answer || "").trim() || it._ans ? "" : `<button class="btn sm" data-act="showans" title="Model answer for the answer key (teacher copy)">✎ Model answer</button>`}
        ${insertMenu(it)}
        ${moreMenu(it)}
      </div>
      ${moreChips(it)}
    </div></div>`;
  }).join("");
  list.querySelectorAll("textarea").forEach(autoGrow);
  list.querySelectorAll(".card").forEach(c => { const it = S.items.find(x => x.id === c.dataset.id); if(it && it.type !== "section") updateRich(c, it); });
  if(S.d.rubricOn && !document.activeElement.closest?.("#rubricBox")) renderRubric();
}
// answer space selector + size (for a question or a sub-question)
function spaceCtl(o, attr, sid){
  if(S.d.answerMode === "sheet") return `<label title="Students answer on a separate sheet — change this under Exam details">Answer space <input type="number" disabled placeholder="sheet" style="opacity:.5;width:64px"></label>`;
  const a = sid ? `data-sub="${sid}" data-sf` : attr;
  const k = o.space || "lines";
  return `<label>Answer <select ${a}="space">${[["lines", "Lines"], ["blank", "Blank space"], ["grid", "Grid"], ["box", "Box"], ["numberline", "Number line"], ["axes", "Coordinate grid (x, y)"]].map(([v, l]) => `<option value="${v}" ${k === v ? "selected" : ""}>${l}</option>`).join("")}</select>
    ${k === "numberline" || k === "axes"
      ? `<input type="text" ${a}="range" value="${esc(o.range || "")}" style="width:${k === "axes" ? 130 : 110}px" title="${k === "axes" ? "x from..to, y from..to — e.g. -6..6 (both) or -2..8, -5..5" : "From..to, e.g. -10..10 or 0..100 step 10"}" placeholder="${k === "axes" ? "-6..6, -6..6" : "-10..10"}">`
      : `<input type="number" min="0" max="40" ${a}="lines" value="${esc(o.lines || "")}" title="${k === "lines" ? "Number of lines" : "Height, in answer-line heights"}" placeholder="${k === "lines" ? "lines" : "size"}">`}</label>`;
}
function ansBlock(it, sb){
  const o = sb || it, show = (o.answer || "").trim() || o._ans;
  if(!show) return "";
  const a = sb ? `data-sub="${sb.id}" data-sf="answer"` : `data-f="answer"`;
  return `<div class="ansbox"><span class="kind" style="color:#B03A2E">✎ Model answer · only on the answer key</span><textarea ${a} placeholder="Model answer or marking points — shown in red on the answer key">${esc(o.answer || "")}</textarea></div>`;
}
function subsBlock(it){
  const subs = it.subs || [];
  if(!subs.length) return "";
  return `<div class="subs">${subs.map((sb, k) => `<div class="sub" data-sid="${sb.id}">
      <div class="sub-row"><b>(${LETTERS[k]})</b>
        <textarea data-sub="${sb.id}" data-sf="text" placeholder="Sub-question (${LETTERS[k]})…">${esc(sb.text || "")}</textarea></div>
      <div class="row sub-ctl">
        <label>Marks <input type="number" min="0" step="0.5" data-sub="${sb.id}" data-sf="marks" value="${esc(sb.marks || "")}"></label>
        ${spaceCtl(sb, null, sb.id)}
        <span class="grow"></span>
        ${(sb.answer || "").trim() || sb._ans ? "" : `<button class="btn sm" data-act="subans" data-sid="${sb.id}">✎ Model answer</button>`}
        <button class="btn icon" data-act="subup" data-sid="${sb.id}" title="Move up" ${k === 0 ? "disabled" : ""}>↑</button>
        <button class="btn icon danger" data-act="subdel" data-sid="${sb.id}" title="Remove">✕</button>
      </div>
      ${ansBlock(it, sb)}
    </div>`).join("")}
    <button class="btn sm" data-act="subadd">＋ Add (${LETTERS[subs.length]})</button></div>`;
}
function autoGrow(t){ t.style.height = "auto"; t.style.height = Math.min(420, t.scrollHeight + 2) + "px"; }

let pendingImgTarget = null, pendingInline = null;
function focusOpt(id, oi){ setTimeout(() => { const el = document.querySelector(`.card[data-id="${id}"] input[data-opt="${oi}"]`); if(el){ el.focus(); el.select(); } }, 30); }
function onListInput(e){
  const card = e.target.closest(".card"); if(!card) return;
  const it = S.items.find(x => x.id === card.dataset.id); if(!it) return;
  lastEdited = it.id;
  if(e.target.dataset.f === "imgWrap"){
    it.imgWrap = e.target.checked;
    if(it.imgWrap && (it.imgSize || 100) > 60) it.imgSize = 40;     // a sensible size for text beside a picture
    render(); changed(); return;
  }
  if(e.target.dataset.sub){
    const sb = (it.subs || []).find(x => x.id === e.target.dataset.sub); if(!sb) return;
    const f = e.target.dataset.sf; sb[f] = e.target.value;
    if(e.target.tagName === "TEXTAREA") autoGrow(e.target);
    if(f === "space"){ render(); changed(); return; }
    if(f === "marks"){
      // keep the question's own marks box in step (it shows the sum when the parts carry marks) — without redrawing, so typing isn't interrupted
      const mi = card.querySelector('input[data-f=marks]') || card.querySelector('input[title^="The sum"]');
      const sum = it.subs.some(x => num(x.marks) > 0);
      if(mi){ mi.disabled = sum; mi.style.opacity = sum ? .7 : 1; mi.value = sum ? fmt(qMarks(it)) : (it.marks || ""); mi.title = sum ? "The sum of the sub-question marks" : ""; if(sum) mi.removeAttribute("data-f"); else mi.setAttribute("data-f", "marks"); }
      refreshTotals();
    }
    clearTimeout(card._rt); card._rt = setTimeout(() => updateRich(card, it), 250);
    changed(); return;
  }
  if(e.target.dataset.f === "space"){ it.space = e.target.value; render(); changed(); return; }
  if(e.target.dataset.opt != null){ ensureOptions(it); it.options[+e.target.dataset.opt] = e.target.value; clearTimeout(card._rt); card._rt = setTimeout(() => updateRich(card, it), 250); changed(); return; }
  const f = e.target.dataset.f; if(!f) return;
  it[f] = f === "imgSize" ? +e.target.value : e.target.value;
  if(f === "mcq"){
    if(it.mcq) ensureOptions(it);
    else if(Array.isArray(it.options)){ it.text = qText(it); delete it.options; }
    render(); changed(); return;
  }
  if(f === "optCols" || f === "width"){ updateRich(card, it); changed(); return; }
  if(e.target.tagName === "TEXTAREA"){ autoGrow(e.target); clearTimeout(card._rt); card._rt = setTimeout(() => updateRich(card, it), 250); }
  if(f === "imgSize") e.target.nextElementSibling.textContent = e.target.value + "%";
  if(f === "marks") refreshTotals();
  changed();
}
// update totals without re-rendering inputs
function refreshTotals(){
  const { auto, total, qCount, secs, meta } = computeMeta();
  $("#autoTotalHint").textContent = "auto: " + fmt(auto);
  $("#summary").innerHTML = `<span><b>${qCount}</b> question${qCount === 1 ? "" : "s"}</span><span><b>${secs.length}</b> part${secs.length === 1 ? "" : "s"}</span><span>Total <b>${fmt(total)}</b> marks</span>`;
  secs.forEach(s => { const inp = document.querySelector(`.card[data-id="${s.item.id}"] input[data-f=marks]`); if(inp) inp.placeholder = fmt(meta[s.item.id]); });
}
async function onListClick(e){
  const b = e.target.closest("[data-act]"); if(!b) return;
  const card = b.closest(".card"); const i = S.items.findIndex(x => x.id === card.dataset.id); if(i < 0) return;
  const it = S.items[i];
  lastEdited = it.id;
  switch(b.dataset.act){
    case "up": if(i > 0){ [S.items[i - 1], S.items[i]] = [S.items[i], S.items[i - 1]]; } break;
    case "down": if(i < S.items.length - 1){ [S.items[i + 1], S.items[i]] = [S.items[i], S.items[i + 1]]; } break;
    case "dup": S.items.splice(i + 1, 0, Object.assign(JSON.parse(JSON.stringify(it)), { id: nid() })); break;
    case "del": S.items.splice(i, 1); break;
    case "rmimg": it.img = null; delete it.graph; delete it.labels; break;
    case "align": it.imgAlign = b.dataset.v; break;
    case "newpage": it.newPage = !it.newPage; break;
    case "nonum": it.nonum = !it.nonum; break;
    case "hidemarks": it.hideMarks = !it.hideMarks; break;
    case "linenums": it.lineNums = !it.lineNums; break;
    case "half": it.width = it.width === "half" ? "" : "half"; break;
    case "correct": { ensureOptions(it); const oi = +b.dataset.oi; let c = new Set(it.correct || []); if(c.has(oi)) c.delete(oi); else { if(it.mcq !== "multi") c = new Set(); c.add(oi); } it.correct = [...c].sort((a, b2) => a - b2); break; }
    case "showans": it._ans = true; render(); setTimeout(() => { const t = document.querySelector(`.card[data-id="${it.id}"] textarea[data-f=answer]`); if(t) t.focus(); }, 30); return;
    case "subadd": { it.subs = it.subs || []; const sb = { id: nid(), text: "", marks: "", lines: "", space: "lines", answer: "" }; it.subs.push(sb); render(); changed(); setTimeout(() => { const t = document.querySelector(`.card[data-id="${it.id}"] textarea[data-sub="${sb.id}"][data-sf=text]`); if(t) t.focus(); }, 30); return; }
    case "subdel": { const k = (it.subs || []).findIndex(x => x.id === b.dataset.sid); if(k >= 0) it.subs.splice(k, 1); if(!it.subs.length) delete it.subs; break; }
    case "subup": { const k = (it.subs || []).findIndex(x => x.id === b.dataset.sid); if(k > 0) [it.subs[k - 1], it.subs[k]] = [it.subs[k], it.subs[k - 1]]; break; }
    case "subans": { const sb = (it.subs || []).find(x => x.id === b.dataset.sid); if(sb) sb._ans = true; render(); setTimeout(() => { const t = document.querySelector(`.card[data-id="${it.id}"] textarea[data-sub="${b.dataset.sid}"][data-sf=answer]`); if(t) t.focus(); }, 30); return; }
    case "sec2col": { const all = window.__secAllHalf(it.id); window.__secQs(it.id).forEach(q => q.width = all ? "" : "half"); toast(all ? "Part set back to one column" : "Questions in this part now print two per row"); lastEdited = it.id; break; }
    case "optadd": ensureOptions(it); it.options.push(""); lastEdited = it.id; render(); changed(); focusOpt(it.id, it.options.length - 1); return;
    case "optdel": it.options.splice(+b.dataset.oi, 1); break;
    case "insbelow": { const n = { id: nid(), type: "q", text: "", marks: "", lines: "", img: null }; S.items.splice(i + 1, 0, n); render(); changed(); focusItem(n.id); return; }
    case "table": insertTable(it); return;
    case "label": openLabel(it.id); return;
    case "ocr": queueOcr([it.id]); return;
    case "eq": openEq(it.id); return;
    case "graph": openGraph(it.id); return;
    case "mol": openMol(it.id); return;
    case "rot": b.disabled = true; it.img = await rotateImg(it.img); delete it.graph; delete it.labels; break;
    case "addimg": pendingImgTarget = it.id; $("#fileIn").accept = "image/*"; $("#fileIn").click(); return;
    case "inspic": {
      const tf = lastTA && lastTA.id === it.id && lastTA.f && lastTA.f !== "answer" && lastTA.f !== "range" ? { f: lastTA.f, sid: lastTA.sid } : null;
      pendingInline = { id: it.id, tf, pos: lastTA && lastTA.id === it.id ? lastTA.e : null };
      $("#fileIn").accept = "image/*"; $("#fileIn").click(); return; }
    case "cutpdf": openCut({ id: it.id, fill: true, page: pdfPage(picsOf(it.text)[0] || ((it.subs || []).map(sb => picsOf(sb.text)[0]).find(Boolean)) || "") }); return;
    case "cutpdfins": openCut({ id: it.id, tf: lastTA && lastTA.id === it.id && lastTA.f === "text" ? { f: "text", sid: lastTA.sid } : null, pos: lastTA && lastTA.id === it.id ? lastTA.e : null }); return;
    case "fillpic": pendingInline = { id: it.id, fill: true }; $("#fileIn").accept = "image/*"; $("#fileIn").click(); return;
    case "rmpic": if(picsOf(it.text).length) it.text = dropFirstPic(it.text); else { const sb = (it.subs || []).find(x => picsOf(x.text).length); if(sb) sb.text = dropFirstPic(sb.text); } break;
  }
  render(); changed();
}
