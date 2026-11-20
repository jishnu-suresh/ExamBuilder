/* ---------------- versions A, B, C… (only at download time) ---------------- */
function seededRnd(str){
  let h = 1779033703 ^ str.length;
  for(let i = 0; i < str.length; i++){ h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
function shuffleArr(a, r){ for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const KEEP_LAST = /^(all|none|both|neither)\b.*\b(above|these|options|answers)\b|^both\b.+\band\b|^neither\b.+\bnor\b/i;
function versionItems(items, label, shufQ, shufO){
  const r = seededRnd(label + "|" + (S.d.title || "") + "|" + (S.d.subject || "") + "|" + items.length);
  const out = items.map(cloneItem);
  if(shufQ){
    // only runs of consecutive questions are shuffled: nothing moves past a part heading or a text/passage
    for(let i = 0; i < out.length;){
      if(out[i].type !== "q"){ i++; continue; }
      let j = i; while(j < out.length && out[j].type === "q") j++;
      if(j - i > 1){ const seg = shuffleArr(out.slice(i, j), r); out.splice(i, j - i, ...seg); }
      i = j;
    }
  }
  if(shufO) out.forEach(it => {
    if(it.type !== "q" || !it.mcq || !Array.isArray(it.options)) return;
    const idx = it.options.map((o, i) => i).filter(i => String(it.options[i] || "").trim());
    const fixed = idx.filter(i => KEEP_LAST.test(String(it.options[i]).replace(/\$[^$]*\$/g, "x").trim()));
    const order = shuffleArr(idx.filter(i => !fixed.includes(i)), r).concat(fixed);
    const cor = new Set(it.correct || []);
    it.options = order.map(i => it.options[i]);
    it.correct = order.map((i, k) => cor.has(i) ? k : -1).filter(k => k >= 0);
  });
  return out;
}
$("#verGo").onclick = async () => {
  const n = +$("#verN").value, shufQ = $("#verQ").checked, shufO = $("#verO").checked, keys = $("#verK").checked, large = $("#verL").checked;
  $("#verModal").classList.remove("open");
  try{
    await prepareMath();
    const base = fileName().replace(/\.pdf$/, "") + (large ? " (large print)" : "");
    for(let v = 0; v < n; v++){
      const L = "ABCD"[v];
      const saved = S.items;
      S.items = versionItems(saved, L, shufQ, shufO);
      try{
        buildPDF({ version: L, large, final: true }).save(base + " - Version " + L + ".pdf");
        if(keys){ await new Promise(r => setTimeout(r, 350)); buildPDF({ version: L, key: true, large, final: true }).save(base + " - Version " + L + " (answer key).pdf"); }
      }finally{ S.items = saved; }
      await new Promise(r => setTimeout(r, 450));
    }
    toast("Downloaded " + n + " versions" + (keys ? " with answer keys" : ""));
  }catch(e){ console.error(e); toast("Couldn't create the versions: " + e.message); }
};

/* ---------------- find & replace ---------------- */
function frFields(){
  // every editable text in the exam: [item, label, getter, setter]
  const out = [], { meta } = computeMeta();
  S.items.forEach(it => {
    const tag = it.type === "section" ? "Part" : it.pagebreak ? "Page break" : it.heading ? "Sub-part" : it.type === "note" ? "Text" : it.nonum ? "Q –" : "Q" + meta[it.id];
    out.push([it, tag, () => it.text || "", v => { it.text = v; }]);
    (it.options || []).forEach((o, i) => out.push([it, tag + " · option " + LETTERS[i].toUpperCase(), () => it.options[i] || "", v => { it.options[i] = v; }]));
    if(it.answer) out.push([it, tag + " · model answer", () => it.answer || "", v => { it.answer = v; }]);
    (it.subs || []).forEach((sb, k) => {
      out.push([it, tag + "(" + LETTERS[k] + ")", () => sb.text || "", v => { sb.text = v; }]);
      if(sb.answer) out.push([it, tag + "(" + LETTERS[k] + ") · model answer", () => sb.answer || "", v => { sb.answer = v; }]);
    });
  });
  return out;
}
function frRegex(){
  const f = $("#frFind").value; if(!f) return null;
  let src = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if($("#frWord").checked) src = "(?<![\\p{L}\\p{N}_])" + src + "(?![\\p{L}\\p{N}_])";
  return new RegExp(src, "gu" + ($("#frCase").checked ? "" : "i"));
}
function frSearch(){
  const re = frRegex(), list = $("#frList");
  if(!re){ $("#frInfo").textContent = ""; list.innerHTML = ""; $("#frGo").disabled = true; return; }
  let total = 0; const hits = [];
  frFields().forEach(([it, tag, get]) => {
    const t = get(); const m = t.match(re); if(!m) return;
    total += m.length;
    if(hits.length < 60){ const k = t.search(re); const a = Math.max(0, k - 30), b = Math.min(t.length, k + 60);
      hits.push([it.id, tag, (a ? "…" : "") + esc(t.slice(a, b)).replace(new RegExp(re.source, re.flags.replace("g", "") + "g"), x => "<mark>" + x + "</mark>") + (b < t.length ? "…" : "")]); }
  });
  $("#frInfo").textContent = total ? total + " match" + (total === 1 ? "" : "es") + " in " + hits.length + (hits.length >= 60 ? "+" : "") + " place" + (hits.length === 1 ? "" : "s") : "No matches";
  list.innerHTML = hits.map(([id, tag, html]) => `<button data-go="${id}"><b>${esc(tag)}</b> · ${html}</button>`).join("");
  $("#frGo").disabled = !total;
}
function openFind(){ openModal("#frModal"); setTimeout(() => { $("#frFind").focus(); $("#frFind").select(); }, 30); frSearch(); }
["frFind", "frCase", "frWord"].forEach(id => document.getElementById(id).addEventListener(id === "frFind" ? "input" : "change", frSearch));
$("#frBtn").onclick = openFind;
$("#frList").addEventListener("click", e => { const b = e.target.closest("[data-go]"); if(!b) return; $("#frModal").classList.remove("open"); lastEdited = b.dataset.go; focusItem(b.dataset.go); });
$("#frGo").onclick = () => {
  keepVersion("Before Replace all");
  const re = frRegex(); if(!re) return;
  const rep = $("#frRep").value; let n = 0;
  frFields().forEach(([it, tag, get, set]) => { const t = get(); const nt = t.replace(re, () => { n++; return rep; }); if(nt !== t) set(nt); });
  render(); changed(); frSearch();
  toast("Replaced " + n + " time" + (n === 1 ? "" : "s") + " — Ctrl/⌘ + Z to undo");
};
document.addEventListener("keydown", e => { if((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key || "").toLowerCase() === "h"){ e.preventDefault(); openFind(); } });

/* ---------------- quick-add helpers ---------------- */
function focusItem(id, selectAll){
  const c = document.querySelector(`.card[data-id="${id}"]`); if(!c) return;
  c.scrollIntoView({ behavior: "smooth", block: "center" });
  const f = c.querySelector("textarea,input[type=text]");
  if(f) setTimeout(() => { f.focus(); if(selectAll) f.select(); }, 280);
}
$("#addMCQ").onclick = () => {
  const n = { id: nid(), type: "q", text: "", marks: "1", lines: "", img: null, mcq: "single", options: ["", "", "", ""] };
  S.items.push(n); lastEdited = n.id; render(); changed(); focusItem(n.id);
};
$("#bottomBar").addEventListener("click", e => {
  const b = e.target.closest("[data-add]"); if(!b) return;
  ({ q: () => $("#addQ").click(), mcq: () => $("#addMCQ").click(), s: () => $("#addS").click(), n: () => $("#addN").click(), sub: () => $("#addSub").click(), brk: () => $("#addBreak").click(),
     eq: () => openEq(null), graph: () => openGraph(null), arrange: () => openArrange(),
     img: () => { pendingImgTarget = null; $("#fileIn").accept = "image/*"; $("#fileIn").click(); } })[b.dataset.add]();
});
// a block goes on its own line(s): before the cursor's line if the cursor is at its start, otherwise right after that line.
// Without a cursor in this question's text it goes at the end.
function insertBlockAt(it, block){
  const ok = lastTA && lastTA.id === it.id && lastTA.f === "text";
  const tf = ok ? { f: "text", sid: lastTA.sid } : null;
  const v = tfGet(it, tf), pos = ok ? Math.min(lastTA.e, v.length) : v.length;
  const ls = v.lastIndexOf("\n", pos - 1) + 1, le = v.indexOf("\n", pos), cut = pos === ls ? ls : (le < 0 ? v.length : le);
  const before = v.slice(0, cut), after = v.slice(cut);
  const nv = before + (before && !before.endsWith("\n") ? "\n" : "") + block + (after && !after.startsWith("\n") ? "\n" : "") + after;
  tfSet(it, tf, nv);
  const at = nv.indexOf(block, Math.max(0, cut - 1)) + block.length;
  lastTA = { id: it.id, f: "text", sid: tf ? tf.sid : null, s: at, e: at };   // the next insert goes after this one
}
function insertTable(it){
  const ans = prompt("Table size: rows × columns (e.g. 3x4).\nTip: a 2-gene Punnett square is 3x3, a dihybrid one is 5x5.", "3x3");
  if(!ans) return;
  const m = ans.match(/(\d+)\s*[x×*, ]\s*(\d+)/i); if(!m){ toast("Write it like 3x4"); return; }
  const R = Math.min(30, Math.max(1, +m[1])), C = Math.min(10, Math.max(1, +m[2]));
  const row = "|" + "   |".repeat(C);
  const tbl = [row, "|" + "---|".repeat(C)].concat(Array(Math.max(0, R - 1)).fill(row)).join("\n");
  insertBlockAt(it, tbl);
  render(); changed(); focusItem(it.id);
  toast("Table added — type inside the cells (between the | bars). Empty cells stay blank for students.");
}

/* ---------------- arrange view ---------------- */
let sortable = null;
function plainSnippet(t){
  return String(t || "").replace(/\{\/?color[^}]*\}/g, "").replace(/\+\+/g, "").replace(/\$\$?([^$]*)\$\$?/g, "$1").replace(/\\d?frac\{([^}]*)\}\{([^}]*)\}/g, "$1/$2")
    .replace(/\\[a-zA-Z]+/g, " ").replace(/[{}*|]/g, "").replace(/-{3,}/g, "").replace(/\s+/g, " ").trim().slice(0, 90);
}
function renderArrange(){
  const { meta } = computeMeta(); let seq = 0;
  $("#arrGrid").innerHTML = S.items.map(it => {
    if(it.type === "section") return `<div class="tile sec" data-id="${it.id}">§ ${esc(it.text || "Part")}<span class="mk">${fmt(meta[it.id] || 0)} pts</span></div>`;
    if(it.type === "note") return `<div class="tile note" data-id="${it.id}"><div class="n">¶ <span style="font-weight:500;color:var(--muted)">Text</span></div><div class="t">${esc(plainSnippet(it.text)) || (it.img ? "🖼 image" : "")}</div></div>`;
    seq++;
    return `<div class="tile" data-id="${it.id}" title="Position ${seq}"><div class="n"><span class="hx">${meta[it.id]}</span>${it.img ? "🖼" : ""}${it.mcq ? (it.mcq === "multi" ? "☐" : "○") : ""}</div><div class="t">${esc(plainSnippet(it.text)) || "(image only)"}</div>${qMarks(it) > 0 ? `<span class="mk">${fmt(qMarks(it))}</span>` : ""}${(it.subs || []).length ? `<span style="font-size:11px"> (a–${LETTERS[it.subs.length - 1]})</span>` : ""}</div>`;
  }).join("");
}
function openArrange(){
  renderArrange(); openModal("#arrModal");
  if(!sortable && window.Sortable){
    sortable = Sortable.create($("#arrGrid"), { animation: 160, ghostClass: "ghost", chosenClass: "chosen", forceFallback: false,
      onEnd(){ const map = Object.fromEntries(S.items.map(x => [x.id, x])); S.items = [...$("#arrGrid").children].map(t => map[t.dataset.id]).filter(Boolean); renderArrange(); render(); changed(); } });
  }
}
$("#arrangeBtn").onclick = openArrange;
$("#mvGo").onclick = () => {
  const qs = S.items.filter(x => x.type === "q");
  const a = Math.round(num($("#mvFrom").value)) - 1, b = Math.round(num($("#mvTo").value)) - 1;
  if(a < 0 || b < 0 || a >= qs.length || b >= qs.length){ toast("Use numbers between 1 and " + qs.length); return; }
  if(a === b) return;
  const src = qs[a], tgt = qs[b];
  S.items.splice(S.items.indexOf(src), 1);
  const ti = S.items.indexOf(tgt);
  S.items.splice(a < b ? ti + 1 : ti, 0, src);
  renderArrange(); render(); changed(); toast("Moved question " + (a + 1) + " → " + (b + 1));
  $("#mvFrom").value = ""; $("#mvTo").value = "";
};

/* ---------------- label a diagram ---------------- */
const lab = { id: null, base: null, img: null, pts: [], geo: null };
function labTag(i, style){ return style === "letters" || style === "lettersOnly" ? String.fromCharCode(65 + (i % 26)) : style === "numbers" ? String(i + 1) : ""; }
function composeLabels(cv, im, pts, style, size){
  const bw = im.naturalWidth, bh = im.naturalHeight;
  const fsz = Math.max(24, Math.round(Math.max(bw, bh) / 24 * size));
  const anyL = pts.some(p => p.side === "left"), anyR = pts.some(p => p.side === "right");
  const MW = Math.round(style === "lettersOnly" ? fsz * 2.5 : Math.max(bw * .42, fsz * 9));
  const L = anyL ? MW : 0, R = anyR ? MW : 0, pad = Math.round(fsz * .9);
  const W = bw + L + R, H = bh + 2 * pad;
  cv.width = W; cv.height = H;
  const c = cv.getContext("2d");
  c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
  c.drawImage(im, L, pad, bw, bh);
  const ink = "#1E1B16", lw = Math.max(2, fsz / 11);
  pts.forEach((p, i) => p._i = i);
  ["left", "right"].forEach(side => {
    const arr = pts.filter(p => p.side === side).sort((a, b) => a.y - b.y);
    const gap = fsz * 1.9; const ly = arr.map(p => pad + p.y * bh);
    for(let k = 1; k < ly.length; k++) ly[k] = Math.max(ly[k], ly[k - 1] + gap);
    if(ly.length && ly[ly.length - 1] > H - fsz) { ly[ly.length - 1] = H - fsz; for(let k = ly.length - 2; k >= 0; k--) ly[k] = Math.min(ly[k], ly[k + 1] - gap); }
    arr.forEach((p, k) => {
      const y = Math.max(fsz, ly[k]);
      const px = L + p.x * bw, py = pad + p.y * bh;
      const ax = side === "left" ? L - fsz * .4 : L + bw + fsz * .4;
      c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = lw;
      c.beginPath(); c.moveTo(px, py); c.lineTo(ax, y); c.stroke();
      c.beginPath(); c.arc(px, py, fsz / 5, 0, 7); c.fill();
      const tag = labTag(p._i, style);
      c.font = `${fsz}px Arial, Helvetica, sans-serif`; c.textBaseline = "alphabetic";
      const x0 = side === "left" ? fsz * .4 : ax, x1 = side === "left" ? ax : W - fsz * .4;
      if(style === "lettersOnly"){ c.font = `bold ${fsz}px Arial, sans-serif`; c.textAlign = side === "left" ? "right" : "left"; c.fillText(tag, side === "left" ? ax - fsz * .3 : ax + fsz * .3, y + fsz * .35); return; }
      if(p.text){
        c.textAlign = side === "left" ? "right" : "left";
        const t = (tag ? tag + "  " : "") + p.text;
        c.fillText(t, side === "left" ? ax - fsz * .3 : ax + fsz * .3, y + fsz * .35);
      }else{
        let sx = x0, ex = x1;
        if(tag){ c.font = `bold ${fsz}px Arial, sans-serif`; c.textAlign = "left"; c.fillText(tag, x0, y - fsz * .2); if(side === "left") sx = x0 + fsz * 1.3; else sx = ax; }
        c.beginPath(); c.lineWidth = lw * .8; c.moveTo(side === "left" ? (tag ? sx : x0) : ax, y); c.lineTo(side === "left" ? ax : x1, y); c.stroke();
      }
    });
  });
  return { L, pad, bw, bh };
}
function drawLabel(){
  if(!lab.img) return;
  lab.geo = composeLabels($("#labCanvas"), lab.img, lab.pts, $("#labStyle").value, +$("#labSize").value);
}
function renderLabList(){
  const st = $("#labStyle").value;
  $("#labList").innerHTML = lab.pts.length ? lab.pts.map((p, i) => `<div class="lab-row" data-i="${i}"><b>${labTag(i, st) || "•"}</b>
    <input type="text" value="${esc(p.text || "")}" placeholder="${st === "lettersOnly" ? "(letter only)" : "empty = blank line"}" data-k="text">
    <select data-k="side"><option value="left" ${p.side === "left" ? "selected" : ""}>Left</option><option value="right" ${p.side === "right" ? "selected" : ""}>Right</option></select>
    <button class="btn icon danger" data-k="del" title="Remove">✕</button></div>`).join("")
    : `<div class="hint">No labels yet — click on the picture.</div>`;
}
function openLabel(id){
  const it = S.items.find(x => x.id === id); if(!it || !it.img) return;
  lab.id = id; lab.base = it.labels ? it.labels.base : it.img;
  lab.pts = it.labels ? JSON.parse(JSON.stringify(it.labels.pts)) : [];
  $("#labStyle").value = it.labels ? it.labels.style : "blank"; $("#labSize").value = it.labels ? String(it.labels.size) : "1";
  lab.img = null; openModal("#labModal");
  loadImg(lab.base.src).then(im => { lab.img = im; drawLabel(); renderLabList(); });
}
$("#labCanvas").addEventListener("click", e => {
  if(!lab.geo) return;
  const cv = e.currentTarget, r = cv.getBoundingClientRect();
  const x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
  const g = lab.geo, rx = (x - g.L) / g.bw, ry = (y - g.pad) / g.bh;
  if(rx < 0 || rx > 1 || ry < 0 || ry > 1) return;
  lab.pts.push({ x: rx, y: ry, side: rx < .5 ? "left" : "right", text: "" });
  drawLabel(); renderLabList();
});
$("#labList").addEventListener("input", e => { const row = e.target.closest(".lab-row"); if(!row) return; const p = lab.pts[+row.dataset.i]; p[e.target.dataset.k] = e.target.value; drawLabel(); });
$("#labList").addEventListener("click", e => { const b = e.target.closest("[data-k=del]"); if(!b) return; lab.pts.splice(+b.closest(".lab-row").dataset.i, 1); drawLabel(); renderLabList(); });
$("#labStyle").addEventListener("change", () => { drawLabel(); renderLabList(); });
$("#labSize").addEventListener("change", drawLabel);
$("#labClear").onclick = () => { lab.pts = []; drawLabel(); renderLabList(); };
$("#labApply").onclick = () => {
  const it = S.items.find(x => x.id === lab.id); if(!it || !lab.img) return;
  if(!lab.pts.length){ it.img = lab.base; delete it.labels; }
  else{
    const cv = document.createElement("canvas");
    composeLabels(cv, lab.img, lab.pts, $("#labStyle").value, +$("#labSize").value);
    it.img = { src: cv.toDataURL("image/jpeg", .92), w: cv.width, h: cv.height };
    it.labels = { base: lab.base, pts: lab.pts.map(({ x, y, side, text }) => ({ x, y, side, text })), style: $("#labStyle").value, size: +$("#labSize").value };
  }
  $("#labModal").classList.remove("open"); render(); changed();
};
