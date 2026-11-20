/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;" }[c]));
const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const fmt = n => (Math.round(n * 100) / 100).toString();
function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2600); }

/* ---------------- text parsing ---------------- */
const RE_Q = /^\s*(?:\*\*)?(?:(?:Q|Question|Exercise|Ex)\s*\.?\s*)?(\d{1,3})\s*[\.\):\-–](?:\*\*)?(?=\s|$)\s*(.*)$/i;
const RE_QONLY = /^\s*(?:\*\*)?(?:Q|Question)\s*\.?\s*(\d{1,3})\s*:?(?:\*\*)?\s*$/i;
const RE_SEC = /^\s*(?:#{1,6}\s*(.+)|(?:\*\*)?((?:part|partie|section)\s+(?:[ivxlc]+|\d+|[a-z])\b.*))$/i;
const RE_MARKS_SQ = /\s*\[\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)?\s*\]\s*$/i;
const RE_MARKS_PAR = /\s*\(\s*(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\s*\)\s*$/i;
const RE_MCQ = /[ \t]*\{\s*mcq\s*:?\s*([a-z ]*)\}[ \t]*/i;
const RE_HALF = /[ \t]*\{\s*(?:half|short|2\s*per\s*row)\s*\}[ \t]*/i;
const RE_COLS = /[ \t]*\{\s*cols?\s*:?\s*([124])\s*\}[ \t]*/i;
const RE_LINES = /[ \t]*\{\s*lines?\s*:?\s*(\d{1,2})\s*\}[ \t]*/i;

function dollarCount(t){ let n = 0; for(let i = 0; i < t.length; i++) if(t[i] === "$" && t[i - 1] !== "\\") n++; return n; }
// "-10..10", "0 to 100 step 10", "-2..8, -5..5", "x -2..8 y -5..5"
function parseRange(str, def){
  const t = String(str || "").replace(/[−–]/g, "-"), st = t.match(/step\s*(\d+(?:\.\d+)?)/i);
  const v = (t.replace(/step\s*\d+(?:\.\d+)?/i, "").match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let x = v.length >= 2 ? [Math.min(v[0], v[1]), Math.max(v[0], v[1])] : def.slice();
  if(x[0] === x[1]) x = def.slice();
  const y = v.length >= 4 && v[2] !== v[3] ? [Math.min(v[2], v[3]), Math.max(v[2], v[3])] : null;
  return { x: x.map(Math.round), y: y && y.map(Math.round), step: st ? +st[1] : 0 };
}
const nlStep = (span, maxTicks) => [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000].find(s => span / s <= maxTicks) || Math.ceil(span / maxTicks);
const labelStep = (step, gap, need) => [1, 2, 5, 10, 20, 50].find(k => gap * k >= need) || 100;
// {numberline: -5..5}  {axes: -6..6}  {grid: 8}  {box: 6}  {blank: 5} in pasted text
const RE_SPACE = /[ \t]*\{\s*(number\s*line|numberline|axes|coordinate\s*grid|grid|box|blank)\s*:?\s*([^}]*)\}[ \t]*/i;
function takeSpace(str){
  const m = String(str || "").match(RE_SPACE); if(!m) return null;
  const k = m[1].toLowerCase().replace(/\s+/g, ""), kind = k === "numberline" ? "numberline" : (k === "axes" || k === "coordinategrid") ? "axes" : k, rng = kind === "numberline" || kind === "axes";
  return { s: str.replace(RE_SPACE, " ").replace(/[ \t]+\n/g, "\n").replace(/\s+$/, ""), space: kind, range: rng ? m[2].trim() : "", lines: rng ? "" : (m[2].match(/\d+/) || [""])[0] };
}
const RE_BREAK = /^\s*\{\s*(?:new\s*page|page\s*break|pagebreak|newpage)\s*\}\s*$/i;
const RE_SUBPART = /^\s*(?:\*\*)?\s*(?:sub-?part|sous-partie)\s*:\s*(.+?)\s*$/i;
function takeMarks(str){
  let m = str.match(RE_MARKS_SQ) || str.match(RE_MARKS_PAR);
  // ignore brackets that sit inside maths ($…$): odd number of unescaped $ before them
  if(m && dollarCount(str.slice(0, m.index)) % 2 === 0)
    { const t = str.slice(0, m.index).replace(/\s+$/, ""); return { s: (t.match(/\*\*/g) || []).length % 2 ? t.replace(/\*\*$/, "") : t, marks: m[1] }; }   // keep a closing ** that pairs with an opening one
  return { s: str, marks: "" };
}
function finishBlock(b){
  let lines = b.lines.slice();
  while(lines.length && !lines[lines.length - 1].trim()) lines.pop();
  while(lines.length && !lines[0].trim()) lines.shift();
  // tags for the question itself are read from its stem only — not from its (a), (b)… sub-question lines
  const firstSub = b.type === "q" ? lines.findIndex(l => RE_SUB.test(l) && !!takeMarks(l.replace(RE_LINES, " ").replace(RE_SPACE, " ").replace(/\s+$/, "")).marks) : -1;
  const tail = firstSub > 0 ? "\n" + lines.slice(firstSub).join("\n") : "";
  let text = (firstSub > 0 ? lines.slice(0, firstSub) : lines).join("\n");
  let ansLines = "";
  const lm = text.match(RE_LINES);
  if(lm){ ansLines = lm[1]; text = text.replace(RE_LINES, " ").replace(/[ \t]+\n/g, "\n").trim(); }
  let spc = null, nonum = false, hideMarks = false;
  if(/\{\s*no-?\s*num(?:ber)?\s*\}/i.test(text)){ nonum = true; text = text.replace(/[ \t]*\{\s*no-?\s*num(?:ber)?\s*\}/ig, "").trim(); }
  if(/\{\s*(?:no-?\s*marks|hide\s*marks)\s*\}/i.test(text)){ hideMarks = true; text = text.replace(/[ \t]*\{\s*(?:no-?\s*marks|hide\s*marks)\s*\}/ig, "").trim(); }
  { const fl = text.split("\n"); const k0 = fl.findIndex(l => RE_SPACE.test(l) && !RE_SUB.test(l)); if(k0 >= 0){ spc = takeSpace(fl[k0]); fl[k0] = spc.s; text = fl.join("\n").trim(); } }
  let mcq = "", optCols = "";
  const mm = text.match(RE_MCQ);
  if(mm){ mcq = /multi|many|several|all/i.test(mm[1] || "") ? "multi" : "single"; text = text.replace(RE_MCQ, " ").replace(/[ \t]+\n/g, "\n").trim(); }
  let width = "";
  if(RE_HALF.test(text)){ width = "half"; text = text.replace(RE_HALF, " ").replace(/[ \t]+\n/g, "\n").trim(); }
  const cm = text.match(RE_COLS);
  if(cm){ optCols = cm[1]; text = text.replace(RE_COLS, " ").replace(/[ \t]+\n/g, "\n").trim(); }
  let marks = "";
  if(firstSub > 0){
    const st = takeMarks(text.split("\n")[0]); if(st.marks){ marks = st.marks; text = [st.s].concat(text.split("\n").slice(1)).join("\n"); }
    const q = { id: nid(), type: "q", text: text + tail, marks, lines: ansLines, img: null, mcq, optCols, width };
    if(spc){ q.space = spc.space; q.range = spc.range; if(spc.lines) q.lines = spc.lines; }
    if(nonum) q.nonum = true; if(hideMarks) q.hideMarks = true;
    if(mcq) extractOptions(q);
    splitSubsAndAnswers(q);
    return q;
  }
  if(b.type === "q" || b.type === "section"){
    const ls = text.split("\n");
    let r = takeMarks(ls[0]);
    if(r.marks){ ls[0] = r.s; marks = r.marks; }
    else if(ls.length > 1 && !RE_SUB.test(ls[ls.length - 1]) && !RE_ANSWER.test(ls[ls.length - 1]) && !ls.some(l => RE_ANSWER.test(l))){ r = takeMarks(ls[ls.length - 1]); if(r.marks){ ls[ls.length - 1] = r.s; marks = r.marks; } }
    text = ls.join("\n").trim();
  }
  if(b.type === "section") return { id: nid(), type: "section", text: text.replace(/^#+\s*/, "").replace(/^\*\*|\*\*$/g, ""), marks: marks };
  if(b.type === "note") return text ? { id: nid(), type: "note", text, img: null } : null;
  const q = { id: nid(), type: "q", text, marks, lines: ansLines, img: null, mcq, optCols, width };
  if(spc){ q.space = spc.space; q.range = spc.range; if(spc.lines) q.lines = spc.lines; }
  if(nonum) q.nonum = true; if(hideMarks) q.hideMarks = true;
  if(mcq) extractOptions(q);
  splitSubsAndAnswers(q);
  return q;
}
const RE_SUB = /^\s*\(([a-h])\)\s*(.*)$/i;
const RE_ANSWER = /^\s*(?:model answer|answer key|mark scheme|marking points?)\s*:\s*(.*)$/i;
// pull "Model answer: …" lines out of a text block
function takeAnswer(lines){
  const k = lines.findIndex(l => RE_ANSWER.test(l));
  if(k < 0) return { lines, answer: "" };
  const ans = [lines[k].match(RE_ANSWER)[1]].concat(lines.slice(k + 1)).join("\n").trim();
  return { lines: lines.slice(0, k), answer: ans };
}
// "(a) … [2]" lines inside a question become sub-questions with their own marks
function splitSubsAndAnswers(q){
  let ls = String(q.text || "").split("\n");
  const starts = [];
  ls.forEach((l, i) => { const m = l.match(RE_SUB); if(m){ const clean = l.replace(RE_LINES, " ").replace(RE_SPACE, " "); if(takeMarks(clean.replace(/\s+$/, "")).marks) starts.push(i); } });
  if(!q.mcq && starts.length){
    const stem = ls.slice(0, starts[0]);
    q.subs = starts.map((st, k) => {
      const block = ls.slice(st, k + 1 < starts.length ? starts[k + 1] : ls.length);
      let first = block[0].replace(RE_SUB, "$2");
      let lines = "", sspc = takeSpace(first);
      if(sspc){ first = sspc.s; if(sspc.lines) lines = sspc.lines; }
      const lm = first.match(RE_LINES); if(lm){ lines = lm[1]; first = first.replace(RE_LINES, " "); }
      const mk = takeMarks(first.replace(/\s+$/, ""));
      const ta = takeAnswer([mk.s].concat(block.slice(1)));
      return { id: nid(), text: ta.lines.join("\n").trim(), marks: mk.marks, lines, space: sspc ? sspc.space : "lines", range: sspc ? sspc.range : "", answer: ta.answer };
    });
    ls = stem;
    if(q.marks && q.subs.some(sb => num(sb.marks) > 0)) q.marks = "";
  }
  const ta = takeAnswer(ls);
  q.text = ta.lines.join("\n").replace(/\s+$/, "");
  if(ta.answer) q.answer = ta.answer;
}
/* ---------------- exam details + rubric found in pasted AI text ---------------- */
const DETAIL_KEYS = [[/^(?:exam\s+)?title$|^titre$/i, "title"], [/^sub-?title$|^sous-titre$/i, "subtitle"], [/^subject|course$|^mati[eè]re$|^discipline$/i, "subject"],
  [/^(?:academic\s+|school\s+)?year$|^ann[ée]e(?:\s+scolaire)?$/i, "year"], [/^duration|time(?:\s+allowed)?$|^dur[ée]e$/i, "duration"], [/^teacher(?:\s+name)?$|^enseignant(?:\(e\)|e)?$|^professeur(?:e)?$/i, "teacher"],
  [/^class(?:\s*\/\s*grade)?|grade$|^classe$|^niveau$/i, "className"], [/^school$|^[ée]tablissement$|^[ée]cole$/i, "school"]];
const cleanCell = c => String(c || "").replace(/\*\*|~~/g, "").replace(/^\s*\*|\*\s*$/g, "").trim();
function extractExtras(txt){
  const L = String(txt || "").replace(/\r\n?/g, "\n").split("\n");
  const drop = new Set(), details = {}; let rubric = null;
  const isQ = l => RE_Q.test(l) || RE_QONLY.test(l) || (RE_SEC.test(l) && !/rubric|scoring|marking|grading/i.test(l));
  // 1) exam details: only in the header, before the first part or question
  for(let i = 0; i < L.length && !isQ(L[i]); i++){
    const raw = L[i].trim(); if(!raw || /^\s*```/.test(raw)) continue;
    const t = cleanCell(raw);
    // student fill-in lines (Name: ____ Date: ____) — the cover page already has them
    if(/^(?:student\s+)?(?:name|nom)\s*:/i.test(t) && /_{3,}/.test(t)){ drop.add(i); continue; }
    const im = t.match(/^(?:instructions?(?:\s+for\s+the\s+exam)?|consignes?)\s*:\s*(.*)$/i);
    if(im){
      drop.add(i); const out = [];
      if(im[1].trim()) out.push(...im[1].trim().split(/(?<=[.!?])\s+(?=[A-Z])/));
      while(i + 1 < L.length && L[i + 1].trim() && !isQ(L[i + 1]) && /^\s*[-•*]\s+|^\s*\d+[.)]\s+/.test(L[i + 1]) && !im[1].trim()){ i++; drop.add(i); out.push(L[i].replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "").trim()); }
      if(out.length) details.instructions = out.join("\n");
      continue;
    }
    const km = t.match(/^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ()/-]{1,24}?)\s*:\s*(.+)$/);
    if(km && !/_{3,}/.test(km[2])){ const hit = DETAIL_KEYS.find(([re]) => re.test(km[1].trim())); if(hit){ details[hit[1]] = km[2].trim(); drop.add(i); } }
  }
  // 1b) an unlabelled header block at the very top (title / year / subject / duration / teacher, one per line)
  if(!Object.keys(details).some(k => k !== "instructions")){
    let i0 = 0; while(i0 < L.length && (!L[i0].trim() || /^\s*```/.test(L[i0]))) i0++;
    let i1 = i0; while(i1 < L.length && L[i1].trim() && !drop.has(i1)) i1++;
    const blk = L.slice(i0, i1).map(cleanCell);
    if(blk.length >= 3 && blk.length <= 7 && blk.every(t => t.length <= 60 && !/[.?!:|\[\]{}$]$/.test(t) && !RE_Q.test(t) && !RE_SEC.test(t) && !/_{3,}/.test(t))){
      const D = {}; const rest = [];
      blk.forEach((t, k) => {
        if(k === 0) D.title = t;
        else if(!D.year && /^(?:\d{4}\s*[-–\/]\s*\d{2,4}|\d{4})$/.test(t)) D.year = t;
        else if(!D.duration && /^\d+(?:[:.,]\d+)?\s*(?:hrs?|hours?|h|mins?|minutes?)\b/i.test(t)) D.duration = t;
        else if(!D.teacher && (/^(?:mr|mrs|ms|miss|mx|dr|prof)\.?\s/i.test(t) || /^[A-Z][a-zà-ÿ'’-]+(?:\s+[A-Z][a-zA-Zà-ÿ'’-]+){1,2}$/.test(t) && k === blk.length - 1)) D.teacher = t;
        else rest.push(t);
      });
      if(rest.length <= 2 && (D.year || D.duration || D.teacher)){
        if(rest[0]) D.subject = rest[0]; if(rest[1]) D.subtitle = rest[1];
        Object.assign(details, D); for(let d = i0; d < i1; d++) drop.add(d);
      }
    }
  }
  // 2) rubric: a heading with rubric / scoring / marking / grading, then a table (or "- name | desc | pts" lines)
  for(let i = 0; i < L.length && !rubric; i++){
    const t = cleanCell(L[i].replace(/^\s*#+\s*/, ""));
    if(!t || t.length > 90 || RE_Q.test(L[i]) || !/\b(rubric|scoring|marking|grading|mark\s*scheme)\b/i.test(t)) continue;
    let j = i + 1; while(j < L.length && !L[j].trim()) j++;
    if(j >= L.length || !/^\s*\||^\s*[-•*].*\||^\s*group\s*:/i.test(L[j])) continue;
    const rows = []; let k = j, header = null;
    for(; k < L.length; k++){
      const l = L[k].trim(); if(!l) break;
      if(/^group\s*:/i.test(l)){ rows.push({ group: cleanCell(l.replace(/^group\s*:/i, "")) }); continue; }
      if(!l.includes("|")) break;
      if(/^\|?\s*:?-{2,}/.test(l)) continue;
      const cells = l.replace(/^[-•*]\s+/, "").replace(/^\||\|$/g, "").split("|").map(cleanCell);
      if(header === null && /^\s*\|/.test(l) && /^\|?\s*:?-{2,}/.test((L[k + 1] || "").trim())){ header = cells; continue; }
      rows.push({ cells });
    }
    const R = { title: t.replace(/^rubric\s*:\s*/i, "").replace(/[:\s]+$/, "") || "Rubric (for Teacher)", showParts: false, showTotal: false, showGrade: false, showComments: false, showDesc: false, groups: [] };
    if(/^rubric$/i.test(R.title)) R.title = "Rubric (for Teacher)";
    const SUB = /^(?:[A-H][.)]|\(?[a-h]\)|[ivx]{1,4}[.)]|Q(?:uestion)?\s*\d+|\d+[.)])\s/i;
    let loose = null, cur = null, n = 0;
    for(const r of rows){
      if(r.group != null){ cur = { heading: r.group, items: [] }; R.groups.push(cur); loose = null; continue; }
      const c = r.cells; if(!c.length || !c[0]) continue;
      const last = c.length > 1 ? c[c.length - 1] : "", name = c[0];
      const pm = last.match(/(\d+(?:[.,]\d+)?)\s*(?:pts?|points?|marks?)?\s*$/i);
      if(/^total\b/i.test(name) || /^total\s+exam\s+grade|grade\s*%?$/i.test(name)){ if(/grade/i.test(name) || /%/.test(last)) R.showGrade = true; else R.showTotal = true; continue; }
      if(/%/.test(last) && !pm) { R.showGrade = true; continue; }
      const it = { name, desc: c.length > 2 ? c.slice(1, -1).filter(Boolean).join(" — ") : "", pts: pm ? pm[1].replace(",", ".") : "" };
      if(it.desc) R.showDesc = true;
      n++;
      if(rows.some(x => x.group != null)){ (cur || (cur = R.groups[R.groups.push({ heading: "", items: [] }) - 1])).items.push(it); continue; }
      // a part row followed by sub-rows (A., B., Question 1…) becomes a group; other rows stand alone
      if(SUB.test(name) && cur){ cur.items.push(it); cur._used = true; continue; }
      if(cur && !cur._used){ cur.heading = ""; cur.items = [cur._self]; }
      cur = { heading: name, items: [], _self: it }; R.groups.push(cur);
    }
    if(cur && !cur._used && cur._self){ cur.heading = ""; cur.items = [cur._self]; }
    // merge neighbouring single rows into one heading-less group, tidy up
    const G = []; R.groups.forEach(g => { delete g._used; delete g._self; if(!g.heading && G.length && !G[G.length - 1].heading) G[G.length - 1].items.push(...g.items); else G.push(g); });
    R.groups = G.filter(g => g.heading || g.items.length);
    if(!n) continue;
    if(!R.showTotal && !R.showGrade){ R.showTotal = true; R.showGrade = true; }
    rubric = R;
    for(let d = i; d < k; d++) drop.add(d);
  }
  return { text: L.filter((_, i) => !drop.has(i)).join("\n"), details, rubric };
}
// fill in the exam details and the rubric page; returns a few words for the toast
function applyExtras(X){
  const said = [];
  const keys = Object.keys(X.details || {});
  if(keys.length){ keys.forEach(k => S.d[k] = X.details[k]); refreshDetails(); said.push("exam details filled in"); }
  if(X.rubric){
    const had = S.d.rubricOn && S.d.rubric && rbSum(S.d.rubric) > 0;
    if(!had || confirm("The pasted text has a rubric (“" + X.rubric.title + "”).\nReplace your current rubric with it?")){
      S.d.rubric = X.rubric; S.d.rubricOn = true; renderRubric();
      said.push("rubric page switched on (" + X.rubric.groups.reduce((a, g) => a + g.items.length, 0) + " rows)");
    }
  }
  return said;
}
function parseText(txt){
  txt = extractExtras(txt).text;
  txt = txt.replace(/\r\n?/g, "\n").replace(/\t/g, "    ").replace(/^﻿/, "");
  const raw = txt.split("\n").filter(l => !/^\s*```/.test(l));
  const hasNumbered = raw.some(l => RE_Q.test(l) || RE_QONLY.test(l));
  const out = []; let cur = null;
  const flush = () => { if(cur){ const r = finishBlock(cur); if(r) out.push(r); } cur = null; };

  if(!hasNumbered){
    // paragraph mode
    let para = [];
    const flushPara = () => { if(para.length){ out.push(finishBlock({ type: "q", lines: para })); para = []; } };
    for(const l of raw){
      if(RE_BREAK.test(l)){ flushPara(); out.push({ id: nid(), type: "note", pagebreak: true, text: "" }); continue; }
      const spm = l.match(RE_SUBPART);
      if(spm){ flushPara(); out.push({ id: nid(), type: "note", heading: true, text: spm[1].replace(/\*\*/g, "").trim(), marks: "" }); continue; }
      if(RE_SEC.test(l) && !para.length){ out.push(finishBlock({ type: "section", lines: [l.match(RE_SEC)[1] || l.match(RE_SEC)[2]] })); continue; }
      if(!l.trim()){ flushPara(); continue; }
      para.push(l);
    }
    flushPara();
    return out.filter(Boolean);
  }
  for(const l of raw){
    if(RE_BREAK.test(l)){ flush(); out.push({ id: nid(), type: "note", pagebreak: true, text: "" }); continue; }
    const spm = l.match(RE_SUBPART);
    if(spm){ flush(); out.push({ id: nid(), type: "note", heading: true, text: spm[1].replace(/\*\*/g, "").trim(), marks: "" }); continue; }
    const sm = l.match(RE_SEC);
    if(sm && !RE_Q.test(l)){ flush(); out.push(finishBlock({ type: "section", lines: [sm[1] || sm[2]] })); continue; }
    const qm = l.match(RE_Q);
    const qo = l.match(RE_QONLY);
    if(qm || qo){ flush(); cur = { type: "q", lines: [qm ? qm[2] : ""] }; continue; }
    // a multiple-choice question ends after its options: a following passage, caption or instruction is its own text block
    if(cur && cur.type === "q" && /\{\s*mcq/i.test(cur.lines[0] || "")){
      const isOpt = OPT_LINE.test(l.replace(/^\s*(?:\*\*|\*|\+\+|~~)+/, ""));
      if(isOpt) cur.optSeen = true;
      else if(cur.optSeen && l.trim() && !/^\s*(?:model answer|answer|correct)\s*:/i.test(l) && !/^\s*\{\s*correct\s*\}\s*$/i.test(l)){ flush(); cur = { type: "note", lines: [] }; }
    }
    if(!cur){ if(!l.trim()) continue; cur = { type: "note", lines: [] }; }
    cur.lines.push(l.replace(/\s+$/, ""));
  }
  flush();
  return out.filter(Boolean);
}
