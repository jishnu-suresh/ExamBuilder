/* ---------------- PDF ---------------- */
const WIN_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function needsUnicode(s){
  for(const ch of s){
    const c = ch.codePointAt(0);
    if(c < 0x7F || (c >= 0xA0 && c <= 0xFF) || WIN_EXTRA.has(ch)) continue;
    return true;
  }
  return false;
}
const NAMED = { black: "#000000", red: "#C0392B", blue: "#1F5FBF", green: "#2E7D32", orange: "#D35400", purple: "#7B3FA0", brown: "#795548", gray: "#666666", grey: "#666666", teal: "#00796B", magenta: "#AD1457", navy: "#1A237E", white: "#FFFFFF" };
function cssHex(c){ c = String(c || "").trim(); return /^#/.test(c) ? c : (NAMED[c.toLowerCase()] || "#000000"); }
function hexRgb(h){ h = (h || "#B5892E").replace("#", ""); if(h.length === 3) h = h.split("").map(c => c + c).join(""); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
function tint(rgb, t){ return rgb.map(v => Math.round(v + (255 - v) * t)); }
function shade(rgb, t){ return rgb.map(v => Math.round(v * (1 - t))); }
function imgFmt(src){ return /^data:image\/png/i.test(src) ? "PNG" : "JPEG"; }

const TR_FR = { "Part": "Partie", "Other questions": "Autres questions", "DURATION": "DURÉE", "TOTAL": "TOTAL", "FORMAT": "FORMAT", "Large print": "Gros caractères",
  "ANSWERS": "RÉPONSES", "Separate sheet": "Feuille séparée", "VERSION": "VERSION", "ANSWER KEY": "CORRIGÉ", "Teacher copy": "Exemplaire enseignant",
  "Student name": "Nom de l'élève", "Class / Grade": "Classe", "Date": "Date", "Teacher": "Enseignant(e)", "INSTRUCTIONS": "CONSIGNES",
  "FOR EXAMINER USE": "RÉSERVÉ AU CORRECTEUR", "Total points": "Note totale", "Criteria": "Critères", "Points": "Points", "TOTAL EXAM GRADE": "NOTE FINALE",
  "TEACHER COMMENTS": "COMMENTAIRES DE L'ENSEIGNANT", "ANSWER KEY · TEACHER COPY": "CORRIGÉ · EXEMPLAIRE ENSEIGNANT", "NAME": "NOM",
  "(Select all that apply.)": "(Plusieurs réponses possibles.)", " mark]": " point]", " marks]": " points]", " MARK": " POINT", " MARKS": " POINTS",
  "END OF EXAM": "FIN DE L'ÉPREUVE", "(continued)": "(suite)", " of ": " sur ", "MODEL ANSWER": "RÉPONSE ATTENDUE", "Diagram": "Schéma", " points": " points" };
function buildPDF(opt){
  const PT = w => (S.d.lang === "fr" && TR_FR[w] != null) ? TR_FR[w] : w;   // words printed on the paper
  const FINAL = !!(opt && opt.final);   // downloads: placeholders print as a plain grey frame, not red
  opt = opt || {};
  const { jsPDF } = window.jspdf;
  const D = S.d;
  const M = computeMeta();
  const LARGE = opt.large != null ? !!opt.large : !!D.largePrint;
  const DYS = opt.dys || "";                 // dyslexia-friendly: "atk" (Atkinson Hyperlegible) or "ody" (OpenDyslexic)
  const doc = new jsPDF({ unit: "mm", format: D.paper === "letter" ? "letter" : "a4", compress: true });
  // PDF fonts can't draw emoji (🐝, 😀…): drop them instead of printing garbage
  const noEmoji = t => typeof t === "string" ? t.replace(/[\u{1F000}-\u{1FAFF}\u{FE0F}\u{200D}]/gu, "").replace(/\s{2,}(?=\S)/g, m => m.length > 2 ? m : " ") : Array.isArray(t) ? t.map(noEmoji) : t;
  ["text", "getTextWidth", "splitTextToSize", "getStringUnitWidth"].forEach(fn => { const orig = doc[fn].bind(doc); doc[fn] = (t, ...rest) => orig(noEmoji(t), ...rest); });
  const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
  // 🎨 colourful mode: every part gets its own colour from the palette
  const PALETTES = { "": ["#E4572E", "#2E86AB", "#7B4FB5", "#2A9D5C", "#E9A31B", "#D63A7A"], honey: ["#D99A0B", "#C0571B", "#8C6A1E", "#B8860B"],
    ocean: ["#1F77B4", "#0F9D9A", "#3D5A98", "#1AA0C8"], garden: ["#2A9D5C", "#6A994E", "#3E7C59", "#99A824"], berry: ["#B5367A", "#7B4FB5", "#D63A5A", "#5E3B8C"] };
  const COLOUR = D.style === "colour";
  const PAL = (PALETTES[D.palette || ""] || PALETTES[""]).map(hexRgb);
  const ACC = COLOUR ? PAL[0] : hexRgb(D.accent), ACC_D = shade(ACC, .28), ACC_L = tint(ACC, .82), ACC_XL = tint(ACC, .92);
  let PC = PAL[0];   // colour of the part being drawn
  const INK = [38, 34, 28], MUTED = [118, 110, 98], RULE = [196, 190, 178];

  // fonts
  const allText = [D.title, D.subtitle, D.year, D.subject, D.duration, D.teacher, D.className, D.date, D.instructions, D.school, ...S.items.map(i => qText(i).replace(/\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g, ""))].join("\n");
  let SANS = "helvetica", SERIF = "times";
  const uni = needsUnicode(allText) || !!opt.resp;     // a student's typing can hold any character
  let HAS_DJV = false;
  if((uni || opt.key) && FONT_R){
    doc.addFileToVFS("DejaVuSans.ttf", FONT_R); doc.addFont("DejaVuSans.ttf", "DejaVu", "normal");
    doc.addFileToVFS("DejaVuSans-Bold.ttf", FONT_B); doc.addFont("DejaVuSans-Bold.ttf", "DejaVu", "bold");
    doc.addFileToVFS("DejaVuSans-Oblique.ttf", FONT_I); doc.addFont("DejaVuSans-Oblique.ttf", "DejaVu", "italic");
    HAS_DJV = true;
  }
  if(uni && HAS_DJV){
    SANS = "DejaVu";
    if(needsUnicode((D.title || "") + (D.school || ""))) SERIF = "DejaVu";
  }
  // dyslexia-friendly: one clear font everywhere (titles too). Text with letters outside it keeps DejaVu.
  if(DYS && EASY && EASY[DYS] && !uni){
    const F = EASY[DYS];
    doc.addFileToVFS("Easy-R.ttf", F.r); doc.addFont("Easy-R.ttf", "EasyRead", "normal");
    doc.addFileToVFS("Easy-B.ttf", F.b); doc.addFont("Easy-B.ttf", "EasyRead", "bold");
    doc.addFileToVFS("Easy-I.ttf", F.i); doc.addFont("Easy-I.ttf", "EasyRead", "italic");
    SANS = SERIF = "EasyRead";
  }
  if(opt.cream){             // cream paper: a light tint under everything, on every page
    const tintPage = () => { doc.setFillColor(255, 248, 228); doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), "F"); };
    tintPage(); doc.internal.events.subscribe("addPage", tintPage);
  }
  const font = (fam, style, size, color) => { doc.setFont(fam, style); doc.setFontSize(size); doc.setTextColor(...(color || INK)); };
  const mmPt = .3528;
  const hasLogo = !!(S.logo && S.logo.src);

  doc.setProperties({ title: [D.subject, D.title].filter(Boolean).join(" — ") || "Exam", author: D.teacher || D.school || "", creator: "BEE · Build • Edit • Evaluate · © Jishnu" });

  /* --- decorative primitives --- */
  function hexagon(cx, cy, r, style){
    const p = []; for(let i = 0; i < 6; i++){ const a = Math.PI / 3 * i; p.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    const d = []; for(let i = 1; i < 6; i++) d.push([p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]]);
    doc.lines(d, p[0][0], p[0][1], [1, 1], style, true);
  }
  function frame(){
    const o = 7.5, i = 9.3;
    doc.setDrawColor(...ACC); doc.setLineWidth(.75); doc.rect(o, o, PW - 2 * o, PH - 2 * o, "S");
    doc.setLineWidth(.2); doc.rect(i, i, PW - 2 * i, PH - 2 * i, "S");
    // corner hexagons
    doc.setFillColor(255, 255, 255); doc.setLineWidth(.45);
    [[o, o], [PW - o, o], [o, PH - o], [PW - o, PH - o]].forEach(([x, y]) => {
      doc.setDrawColor(...ACC); doc.setFillColor(255, 255, 255); hexagon(x, y, 3.1, "FD");
      doc.setFillColor(...ACC); hexagon(x, y, 1.45, "F");
    });
  }
  function ornament(cy, half){
    const cx = PW / 2;
    doc.setDrawColor(...ACC); doc.setLineWidth(.35);
    doc.line(cx - half, cy, cx - 7, cy); doc.line(cx + 7, cy, cx + half, cy);
    doc.setFillColor(...ACC); hexagon(cx, cy, 2.1, "F");
    doc.setFillColor(...ACC_L); hexagon(cx - 4.6, cy, 1.2, "F"); hexagon(cx + 4.6, cy, 1.2, "F");
  }
  function spaced(str, cx, y, cs){ // centred letter-spaced text
    const w = doc.getTextWidth(str) + cs * Math.max(0, str.length - 1);
    doc.text(str, cx - w / 2, y, { charSpace: cs });
  }
  function fitText(str, maxW){
    if(doc.getTextWidth(str) <= maxW) return str;
    while(str.length > 1 && doc.getTextWidth(str + "…") > maxW) str = str.slice(0, -1);
    return str + "…";
  }

  /* ================= COVER ================= */
  // The cover is laid out in two passes: measure with a set of sizes, tighten step by step until it fits one page, then draw.
  const ML = 20, MR = 20, CW = PW - ML - MR;
  const COVER_TOP = 20, COVER_BOTTOM = PH - 20;
  const instr = (D.instructions || "").split("\n").map(s => s.trim()).filter(Boolean);
  const showTable = D.scoreTable && (M.total > 0 || M.secs.length > 0);
  const scoreRows = showTable ? (M.secs.length ? M.secs.map(s => [s.item.text || PT("Part"), s.total]) : []) : [];
  if(showTable && M.looseMarks > 0 && M.secs.length) scoreRows.unshift([PT("Other questions"), M.looseMarks]);
  const pills = [];
  if(D.duration) pills.push([PT("DURATION"), D.duration]);
  if(M.total > 0) pills.push([PT("TOTAL"), fmt(M.total) + " points"]);
  if(LARGE) pills.push([PT("FORMAT"), PT("Large print")]);
  else if(DYS) pills.push([PT("FORMAT"), PT("Dyslexia-friendly")]);
  if(D.answerMode === "sheet") pills.push([PT("ANSWERS"), PT("Separate sheet")]);
  if(opt.version) pills.unshift([PT("VERSION"), opt.version]);
  if(opt.key) pills.unshift([PT("ANSWER KEY"), PT("Teacher copy")]);

  function cover(P, draw){
    let y = COVER_TOP;
    const g = P.gap;
    if(hasLogo){
      let lh = P.logoH, lw = lh * S.logo.w / S.logo.h;
      if(lw > 92){ lw = 92; lh = lw * S.logo.h / S.logo.w; }
      if(draw) doc.addImage(S.logo.src, imgFmt(S.logo.src), (PW - lw) / 2, y, lw, lh, "logo", "FAST");
      y += lh + 7 * g;
    }else if(D.school){
      font(SERIF, "bold", 22 * P.title / 30, ACC_D); if(draw) doc.text(D.school, PW / 2, y + 9, { align: "center" }); y += 16 * g;
    }
    if(draw) ornament(y, 55);
    y += 15 * g;
    font(SERIF, "bold", P.title, INK);
    const tl = doc.splitTextToSize(D.title || "Exam", CW - 10), tStep = P.title * .383;
    tl.forEach(l => { if(draw) doc.text(l, PW / 2, y, { align: "center" }); y += tStep; });
    y -= tStep * .35;
    if(D.subtitle && D.subtitle.trim()){
      font(SERIF, "italic", P.sub, [92, 84, 72]);
      doc.splitTextToSize(D.subtitle.trim(), CW - 20).slice(0, 2).forEach(l => { y += 1.5 * g; if(draw) doc.text(l, PW / 2, y + 3, { align: "center" }); y += P.sub * .43; });
      y += 2 * g;
    }
    if(D.year){ font(SANS, "normal", 11, MUTED); if(draw) spaced(D.year, PW / 2, y + 2, .6); y += 8 * g; }
    if(D.subject){
      y += 7 * g; font(SANS, "bold", P.subj, ACC_D);
      const subj = D.subject.toUpperCase(), cs = 1.4;
      while(doc.getTextWidth(subj) + cs * subj.length > CW && doc.getFontSize() > 10) doc.setFontSize(doc.getFontSize() - 1);
      if(draw) spaced(subj, PW / 2, y, cs);
      y += 4;
    }
    // pills — wrap onto extra rows instead of running off the page
    if(pills.length){
      y += 6 * g;
      const ph = 9, gap = 5, rowGap = 3;
      const kws = pills.map(([k]) => { font(SANS, "bold", 7.5); return doc.getTextWidth(k) + k.length * .9; });
      const widths = pills.map(([k, v], i) => { font(SANS, "bold", 10.5); return Math.min(CW, kws[i] + doc.getTextWidth(v) + 14); });
      const rows = []; let cur = [], cw = 0;
      pills.forEach((p2, i) => { const w = widths[i]; if(cur.length && cw + gap + w > CW){ rows.push(cur); cur = []; cw = 0; } cur.push(i); cw += (cur.length > 1 ? gap : 0) + w; });
      if(cur.length) rows.push(cur);
      rows.forEach((r, ri) => {
        const tot = r.reduce((a, i) => a + widths[i], 0) + gap * (r.length - 1);
        let px = PW / 2 - tot / 2;
        r.forEach(i => {
          const [k, v] = pills[i];
          if(draw){
            doc.setFillColor(...ACC_XL); doc.setDrawColor(...ACC_L); doc.setLineWidth(.3);
            doc.roundedRect(px, y, widths[i], ph, ph / 2, ph / 2, "FD");
            font(SANS, "bold", 7.5, ACC_D); doc.text(k, px + 5.5, y + 5.9, { charSpace: .9 });
            const kw = kws[i];
            font(SANS, "bold", 10.5, INK);
            const vText = widths[i] >= CW ? fitText(v, CW - kw - 14) : v;      // only shorten if it can't fit across the page
            doc.text(vText, px + 5.5 + kw + 3, y + 6.1);
          }
          px += widths[i] + gap;
        });
        y += ph + (ri < rows.length - 1 ? rowGap : 0);
      });
    }
    // student box
    y += 9 * g;
    const rowH = P.boxRow, boxH = rowH * 2 + 2;
    const fv = LARGE ? 12.5 : 11.5;
    if(draw){
      doc.setDrawColor(...ACC_L); doc.setLineWidth(.4); doc.setFillColor(255, 255, 255);
      doc.roundedRect(ML, y, CW, boxH, 2.5, 2.5, "S");
      const field = (x, w, yy, label, value) => {
        font(SANS, "bold", 7, MUTED); doc.text(label.toUpperCase(), x, yy + 5.2, { charSpace: .7 });
        if(value){ font(SANS, "normal", fv, INK); doc.text(fitText(value, w - 2), x, yy + rowH - 3.9); }
        else { doc.setDrawColor(...RULE); doc.setLineWidth(.25); doc.line(x, yy + rowH - 3.1, x + w - 4, yy + rowH - 3.1); }
      };
      const bx = ML + 6, bw = CW - 12;
      field(bx, bw * .62, y + 1, PT("Student name"), "");
      field(bx + bw * .64, bw * .36, y + 1, PT("Class / Grade"), D.className);
      doc.setDrawColor(...ACC_XL); doc.setLineWidth(.3); doc.line(ML + 4, y + rowH + 1.2, ML + CW - 4, y + rowH + 1.2);
      field(bx, bw * .4, y + rowH + 1.5, PT("Date"), D.date);
      field(bx + bw * .44, bw * .56, y + rowH + 1.5, PT("Teacher"), D.teacher);
    }
    y += boxH;
    // instructions
    let instrTop = null, ih = 0, wrapped = null, ifs = P.instr, ilh = 0;
    const bulletW = 4.5, iw = CW - 16 - bulletW;
    if(instr.length){
      y += 8 * g;
      font(SANS, "normal", ifs);
      ilh = ifs * mmPt * P.instrLH;
      const styled = t => !/\$/.test(t) && /\*|\+\+|~~|\{color:/.test(t);
      // styled instruction → lines of words, each word keeps its own style
      const coverRich = t => {
        const words = [];
        parseInline(t, {}).forEach(r => { if(r.t !== "text") return;
          const st = r.b && r.i ? "bolditalic" : r.b ? "bold" : r.i ? "italic" : "normal";
          String(r.s).split(/(\s+)/).forEach(w => { if(!w) return; if(/^\s+$/.test(w)){ words.push({ sp: true }); return; }
            font(SANS, st, ifs); words.push({ s: w, st, u: !!r.u, x: !!r.x, c: r.c || "", w: doc.getTextWidth(w) }); }); });
        font(SANS, "normal", ifs); const SPW = doc.getTextWidth(" ");
        const lines = [[]]; let lw = 0;
        words.forEach(w => { if(w.sp){ if(lines[lines.length - 1].length) lines[lines.length - 1].push({ sp: true, w: SPW }); lw += SPW; return; }
          if(lw + w.w > iw && lines[lines.length - 1].some(x => !x.sp)){ const L = lines[lines.length - 1]; while(L.length && L[L.length - 1].sp) L.pop(); lines.push([]); lw = 0; }
          lines[lines.length - 1].push(w); lw += w.w; });
        return { lines };
      };
      wrapped = instr.map(t => styled(t) ? coverRich(t) : doc.splitTextToSize(t, iw));
      ih = 13 + wrapped.reduce((a, w) => a + (w.lines ? w.lines.length : w.length) * ilh, 0) + (instr.length - 1) * 1.2 + 3;
      instrTop = y; y += ih;
    }
    // points per part: 1 column, or 2 columns when there are many parts
    let tH = 0, tLines = null, twoCol = false;
    if(showTable){
      tLines = scoreRows.map(([n, mk]) => [stripFmt(n).replace(/\$+([^$]*)\$+/g, "$1").replace(/[:\s]+$/, ""), mk]);
      twoCol = P.scoreCols === 2 && tLines.length > 2;
      const nRows = twoCol ? Math.ceil(tLines.length / 2) : tLines.length;
      tH = 10 + P.scoreRow * (nRows + 1) + 4;
    }
    const contentBottom = y + (showTable ? 8 * g + tH : 0);
    if(draw){
      if(instr.length){
        doc.setFillColor(...ACC_XL); doc.roundedRect(ML, instrTop, CW, ih, 2.5, 2.5, "F");
        doc.setFillColor(...ACC); doc.rect(ML, instrTop, 1.6, ih, "F");
        font(SANS, "bold", 8.5, ACC_D); doc.text(PT("INSTRUCTIONS"), ML + 8, instrTop + 7.5, { charSpace: 1 });
        let iy = instrTop + 13.5;
        wrapped.forEach(w => {
          doc.setFillColor(...ACC); hexagon(ML + 9.2, iy - ifs * mmPt * .35, .95, "F");
          font(SANS, "normal", ifs, INK);
          if(w.lines) w.lines.forEach(L => {
            let cx = ML + 8 + bulletW;
            L.forEach(p => { if(p.sp){ cx += p.w; return; }
              const tc = p.c ? hexRgb(cssHex(p.c)) : INK; font(SANS, p.st, ifs, tc); doc.text(p.s, cx, iy);
              if(p.x){ doc.setDrawColor(...tc); doc.setLineWidth(.2); doc.line(cx, iy - ifs * mmPt * .27, cx + p.w, iy - ifs * mmPt * .27); }
              if(p.u){ doc.setDrawColor(...tc); doc.setLineWidth(.2); doc.line(cx, iy + ifs * mmPt * .14, cx + p.w, iy + ifs * mmPt * .14); }
              cx += p.w; });
            iy += ilh; });
          else w.forEach(l => { doc.text(l, ML + 8 + bulletW, iy); iy += ilh; });
          iy += 1.2;
        });
      }
      if(showTable){
        // sit at the bottom of the page when there is room, otherwise right after the instructions
        const tTop = Math.max(y + 8 * g, COVER_BOTTOM - 2 - tH);
        const bw2 = twoCol ? CW : Math.min(140, CW), bx2 = (PW - bw2) / 2;
        doc.setFillColor(255, 255, 255); doc.setDrawColor(...ACC_L); doc.setLineWidth(.4);
        doc.roundedRect(bx2, tTop, bw2, tH, 2.5, 2.5, "S");
        font(SANS, "bold", 7.5, MUTED); spaced(PT("FOR EXAMINER USE"), PW / 2, tTop + 6.5, 1);
        const R = P.scoreRow, fsN = LARGE ? 11.5 : 11, fsT = LARGE ? 12.5 : 12;
        const colW = twoCol ? (bw2 - 16) / 2 : bw2 - 16;
        const blen = twoCol ? 18 : 30;
        const drawRow = (lx, ty, w, label, mk, bold) => {
          font(SANS, bold ? "bold" : "normal", bold ? fsT : fsN, INK);
          let labW = 0; (bold ? [[label]] : tLines).forEach(([n]) => { labW = Math.max(labW, doc.getTextWidth(n + ":")); });
          labW = Math.min(labW, w - blen - 14);
          doc.text(fitText(label + ":", labW), lx, ty);
          const bxs = lx + labW + 4;
          doc.setDrawColor(...(bold ? ACC : RULE)); doc.setLineWidth(bold ? .45 : .3); doc.line(bxs, ty + .8, bxs + blen, ty + .8);
          font(SANS, bold ? "bold" : "normal", bold ? fsT : fsN, bold ? INK : MUTED);
          doc.text("/ " + fmt(mk), bxs + blen + 2.5, ty);
        };
        let ty = tTop + 10 + R * .78;
        drawRow(bx2 + 8, ty, colW, PT("Total points"), M.total, true);
        if(tLines.length){ doc.setDrawColor(...ACC_XL); doc.setLineWidth(.3); doc.line(bx2 + 6, ty + R * .45, bx2 + bw2 - 6, ty + R * .45); }
        ty += R;
        const per = twoCol ? Math.ceil(tLines.length / 2) : tLines.length;
        tLines.forEach(([n, mk], i) => {
          const col = twoCol ? Math.floor(i / per) : 0, row = twoCol ? i % per : i;
          drawRow(bx2 + 8 + col * (colW + 0), ty + row * R, colW - 4, n, mk, false);
        });
      }
    }
    return contentBottom;
  }
  // tighter and tighter versions of the cover until it fits on one page
  const iBase = LARGE ? 13 : 10.5, iMin = LARGE ? 11 : 8.5;
  const levels = [
    { logoH: 34, title: 30, sub: 15, subj: 17, gap: 1,   boxRow: 15.5, instr: iBase,       instrLH: LARGE ? 1.8 : 1.45, scoreRow: 8.4, scoreCols: 1 },
    { logoH: 34, title: 30, sub: 15, subj: 17, gap: 1,   boxRow: 15.5, instr: iBase,       instrLH: LARGE ? 1.8 : 1.45, scoreRow: 8.4, scoreCols: 2 },
    { logoH: 28, title: 28, sub: 14, subj: 16, gap: .8,  boxRow: 14.5, instr: iBase,       instrLH: LARGE ? 1.65 : 1.4, scoreRow: 7.6, scoreCols: 2 },
    { logoH: 24, title: 26, sub: 13, subj: 15, gap: .65, boxRow: 13.5, instr: iBase - .5,  instrLH: LARGE ? 1.55 : 1.35, scoreRow: 7,   scoreCols: 2 },
    { logoH: 20, title: 24, sub: 12, subj: 14, gap: .5,  boxRow: 13,   instr: iBase - 1,   instrLH: LARGE ? 1.45 : 1.3, scoreRow: 6.4, scoreCols: 2 },
    { logoH: 17, title: 22, sub: 11.5, subj: 13, gap: .4, boxRow: 12.5, instr: iBase - 1.5, instrLH: LARGE ? 1.4 : 1.25, scoreRow: 6,  scoreCols: 2 },
  ];
  for(let f = levels[5].instr - .5; f >= iMin; f -= .5) levels.push(Object.assign({}, levels[5], { instr: f, instrLH: LARGE ? 1.35 : 1.22 }));
  let P = levels[levels.length - 1];
  for(const L of levels){ if(cover(L, false) <= COVER_BOTTOM){ P = L; break; } }
  frame();
  cover(P, true);
  let y = 0;   // question pages reset this via newPage()

  /* ================= RUBRIC PAGE (teacher) ================= */
  let rubricPage = 0;
  if(D.rubricOn && D.rubric && !opt.coverOnly){
    const R = D.rubric;
    doc.addPage(); frame(); rubricPage = doc.getNumberOfPages();
    // rows: parts, group headings, criteria, totals
    const rows = [];
    if(R.showParts && M.secs.length){
      if(M.looseMarks > 0) rows.push({ k: "part", label: PT("Other questions"), pts: M.looseMarks });
      M.secs.forEach(sx => rows.push({ k: "part", label: stripFmt(sx.item.text || PT("Part")).replace(/\$+([^$]*)\$+/g, "$1"), pts: sx.total }));
    }
    (R.groups || []).forEach(g => {
      const its = (g.items || []).filter(it => (it.name || "").trim() || num(it.pts) > 0);
      if(!its.length && !(g.heading || "").trim()) return;
      if((g.heading || "").trim()) rows.push({ k: "head", label: g.heading.trim(), pts: its.reduce((a, it) => a + num(it.pts), 0) });
      else if(R.groups.length > 1){ its.forEach(it => rows.push({ k: "part", label: (it.name || "").trim(), pts: num(it.pts) })); return; }
      its.forEach(it => rows.push({ k: "crit", label: (it.name || "").trim(), desc: R.showDesc ? (it.desc || "").trim() : "", pts: num(it.pts) }));
    });
    const total = R.showParts && M.secs.length ? M.total : rbSum(R);
    if(R.showTotal) rows.push({ k: "total", label: PT("TOTAL"), pts: total });
    if(R.showGrade) rows.push({ k: "grade", label: PT("TOTAL EXAM GRADE"), pts: null });
    const RX = ML, RW = CW, PCOL = 44, LCOL = RW - PCOL;
    let top = 22;
    font(SERIF, "bold", LARGE ? 20 : 18, INK); doc.text(fitText(R.title || "Rubric", RW), PW / 2, top + 6, { align: "center" });
    font(SANS, "normal", 9, MUTED);
    const sub = [D.subject, D.title, D.className].filter(Boolean).join("  ·  ");
    if(sub) doc.text(fitText(sub, RW), PW / 2, top + 12.5, { align: "center" });
    ornament(top + 17.5, 45);
    top += 24;
    const commentsH = R.showComments ? 42 : 0;
    const avail = (PH - 20) - top - 8 - (commentsH ? commentsH + 8 : 0);
    // row heights: shrink to fit one page
    const fsBase = LARGE ? 12.5 : 11.5;
    const rowHeights = sc => rows.map(r => {
      let h = (r.k === "total" || r.k === "grade" ? 11 : r.k === "head" ? 9.5 : 8.6) * sc;
      if(r.k === "crit" && r.desc){ font(SANS, "italic", (fsBase - 2.5) * Math.max(.85, sc)); h += doc.splitTextToSize(r.desc, LCOL - 16).length * (fsBase - 2.5) * Math.max(.85, sc) * mmPt * 1.25 + 1; }
      return h;
    });
    let sc = 1, hs = rowHeights(1);
    const headerH = 10;
    while(hs.reduce((a, b) => a + b, 0) + headerH > avail && sc > .62){ sc -= .04; hs = rowHeights(sc); }
    // few rows: make them taller (up to 1.35×) so the table uses the page and leaves room to write scores
    while(sc < 1.35 && rowHeights(sc + .05).reduce((a, b) => a + b, 0) + headerH <= avail * .92){ sc += .05; hs = rowHeights(sc); }
    const fsR = fsBase * Math.max(.82, sc);
    // header row
    let ry = top;
    doc.setFillColor(...ACC); doc.rect(RX, ry, RW, headerH, "F");
    font(SANS, "bold", fsR, [255, 255, 255]);
    doc.text(PT("Criteria"), RX + 4, ry + headerH * .66);
    doc.text(PT("Points"), RX + LCOL + PCOL / 2, ry + headerH * .66, { align: "center" });
    ry += headerH;
    const pointsCell = (pts, y0, h, bold) => {
      const cx = RX + LCOL, by = y0 + h * .66;
      font(SANS, bold ? "bold" : "normal", fsR, INK);
      if(pts == null){ doc.setDrawColor(...RULE); doc.setLineWidth(.3); doc.line(cx + 8, by + .8, cx + PCOL - 12, by + .8); doc.text("%", cx + PCOL - 4, by, { align: "right" }); return; }
      const t = "/ " + fmt(pts);
      doc.setDrawColor(...RULE); doc.setLineWidth(.3); doc.line(cx + 5, by + .8, cx + PCOL - 4 - doc.getTextWidth(t) - 2, by + .8);
      doc.text(t, cx + PCOL - 4, by, { align: "right" });
    };
    rows.forEach((r, i) => {
      const h = hs[i];
      // backgrounds
      if(r.k === "head"){ doc.setFillColor(...ACC_L); doc.rect(RX, ry, RW, h, "F"); }
      else if(r.k === "total" || r.k === "grade"){ doc.setFillColor(...ACC_XL); doc.rect(RX, ry, RW, h, "F"); }
      else if(i % 2 === 0){ doc.setFillColor(...ACC_XL); doc.rect(RX, ry, RW, h, "F"); }
      const by = ry + Math.min(h, 8.6 * sc) * .66 + (r.k === "total" || r.k === "grade" ? 1.2 : 0);
      if(r.k === "part"){ font(SANS, "bold", fsR, INK); doc.text(fitText(r.label, LCOL - 8), RX + 4, by); pointsCell(r.pts, ry, Math.min(h, 8.6 * sc), true); }
      else if(r.k === "head"){ font(SERIF, "bold", fsR + .5, INK); doc.text(fitText(r.label, LCOL - 8), RX + 4, by); font(SANS, "bold", fsR - 1.5, MUTED); doc.text(fmt(r.pts) + " pts", RX + LCOL + PCOL / 2, by, { align: "center" }); }
      else if(r.k === "crit"){
        font(SERIF, "italic", fsR + .5, INK); doc.text(fitText(r.label || "—", LCOL - 14), RX + 10, by);
        if(r.desc){ font(SANS, "italic", (fsBase - 2.5) * Math.max(.85, sc), MUTED); let dy = by + (fsBase - 2.5) * Math.max(.85, sc) * mmPt * 1.35; doc.splitTextToSize(r.desc, LCOL - 16).forEach(l => { doc.text(l, RX + 10, dy); dy += (fsBase - 2.5) * Math.max(.85, sc) * mmPt * 1.25; }); }
        pointsCell(r.pts, ry, Math.min(h, 8.6 * sc), false);
      }else{ font(SANS, "bold", fsR + .5, INK); doc.text(r.label, RX + LCOL - 4, by, { align: "right" }); pointsCell(r.pts, ry, h, true); }
      // lines
      doc.setDrawColor(...shade(ACC_L, .12)); doc.setLineWidth(.2); doc.line(RX, ry + h, RX + RW, ry + h);
      ry += h;
    });
    doc.setDrawColor(...ACC); doc.setLineWidth(.45); doc.rect(RX, top, RW, ry - top, "S"); doc.line(RX + LCOL, top, RX + LCOL, ry);
    if(R.showComments){
      const cy = ry + 8;
      font(SANS, "bold", 8.5, ACC_D); doc.text(PT("TEACHER COMMENTS"), RX, cy + 3, { charSpace: 1 });
      doc.setDrawColor(...ACC_L); doc.setLineWidth(.35); doc.roundedRect(RX, cy + 6, RW, commentsH - 6, 2, 2, "S");
      doc.setDrawColor(...RULE); doc.setLineWidth(.2); for(let ly = cy + 15; ly < cy + commentsH - 2; ly += 8) doc.line(RX + 4, ly, RX + RW - 4, ly);
    }
  }

  /* ================= QUESTION PAGES ================= */
  const items = (opt.coverOnly || opt.rubricOnly) ? [] : S.items.filter(it => it.type === "section" || it.pagebreak || (it.text && it.text.trim()) || it.img || it.type === "q");
  const TOP = 30, BOTTOM = PH - 19;
  let firstQPage = null;
  const pageOf = {};
  const regions = [];   // where each item sits: click the preview → jump to it
  const mark = (id, y0, y1, x0, x1) => regions.push({ id, p: doc.getNumberOfPages(), y0, y1, x0: x0 == null ? 0 : x0, x1: x1 == null ? 1e3 : x1 });
  function header(){
    let hx = ML;
    if(hasLogo){
      let lh = 9, lw = lh * S.logo.w / S.logo.h; if(lw > 42){ lw = 42; lh = lw * S.logo.h / S.logo.w; }
      const gl = grayLogo.src === S.logo.src && grayLogo.png ? grayLogo.png : S.logo.src;
      doc.addImage(gl, imgFmt(gl), ML, 13.5 + (9 - lh) / 2, lw, lh, "logoGray", "FAST");
      hx = ML + lw + 6;
    }
    const right = PW - MR;
    let rx = right;
    if(opt.key){
      font(SANS, "bold", 8, [192, 57, 43]); const kl = PT("ANSWER KEY · TEACHER COPY");
      const kw = doc.getTextWidth(kl) + kl.length * .4; doc.text(kl, right - kw, 19.5, { charSpace: .4 }); rx = right - kw - 6;
    }else if(D.nameEveryPage){
      font(SANS, "bold", 7.5, MUTED); const lab = PT("NAME"); const lw2 = doc.getTextWidth(lab) + 2.5;
      const lineW = 46; rx = right - lineW - lw2;
      doc.text(lab, rx, 19.5, { charSpace: .5 });
      doc.setDrawColor(...RULE); doc.setLineWidth(.25); doc.line(rx + lw2 + 1, 20, right, 20);
      rx -= 6;
    }
    font(SANS, "normal", 8.5, MUTED);
    const label = [D.subject, D.title, opt.version ? "Version " + opt.version : ""].filter(Boolean).join("  ·  ");
    if(label){
      const maxW = rx - hx;
      const leftAl = D.nameEveryPage || opt.key;
      if(maxW > 15){ const s = fitText(label, maxW); doc.text(s, leftAl ? hx : right, 19.5, { align: leftAl ? "left" : "right" }); }
    }
    doc.setDrawColor(...ACC); doc.setLineWidth(.35); doc.line(ML, 24, PW - MR, 24);
  }
  function newPage(){ doc.addPage(); frame(); header(); y = TOP; if(firstQPage === null) firstQPage = doc.getNumberOfPages(); }

  let fs = LARGE ? Math.max(16, num(D.fontSize) || 11) : DYS ? Math.max(12, num(D.fontSize) || 11) : (num(D.fontSize) || 11);
  const JUST = D.justify !== false && !DYS;     // dyslexia-friendly: never stretch text to both edges
  const SPC = LARGE ? 2 : DYS ? Math.max(1.5, num(D.lineSpacing) || 1) : (num(D.lineSpacing) || 1);
  const SHEET = D.answerMode === "sheet";
  const COMPACT = SHEET && !LARGE && SPC < 1.5;      // separate answer sheet → tighter paper (not for accommodations)
  let LH = fs * mmPt * (SPC >= 2 ? 2.34 : SPC >= 1.5 ? 1.78 : COMPACT ? 1.3 : 1.42);
  const QGAP = COMPACT ? 4.5 : DYS ? 10 : 7, NGAP = COMPACT ? 3.5 : DYS ? 7 : 5;
  let TASC = fs * mmPt * .8 + (LH - fs * mmPt * 1.05) / 2;   // baseline position inside a line
  const NUMW = Math.max(9, fs * .78), MARKW = D.showMarks ? Math.max(21, fs * 1.75) : 0;
  let EM = fs * mmPt;               // mm per em for maths
  const styleName = st => (SANS === "DejaVu" && st === "bolditalic") ? "bold" : st;
  const setSt = st => doc.setFont(SANS, styleName(st));
  const mAlias = m => "mx" + strHash(m.key);
  // measure like jsPDF draws: without kerning
  const tw = t => doc.getStringUnitWidth(t, { kerning: {} }) * doc.getFontSize() / doc.internal.scaleFactor;

  // turn inline runs into words (pieces glued together between spaces)
  function wordsOf(runs){
    const words = []; let cur = [];
    for(const r of runs){
      if(r.t === "math"){
        const m = texSVG(r.tex, !!r.display);
        if(m.png) cur.push({ t: "math", m, w: m.w * EM, asc: m.asc * EM, desc: m.desc * EM });
        else { setSt("normal"); const s = "[LaTeX error: " + r.tex + "]"; cur.push({ t: "text", s, st: "normal", w: tw(s), err: true }); }
        continue;
      }
      const st = r.b && r.i ? "bolditalic" : r.b ? "bold" : r.i ? "italic" : "normal";
      setSt(st);
      r.s.split(/(\s+)/).forEach(p => {
        if(!p) return;
        if(/^\s+$/.test(p)){ if(cur.length){ words.push(cur); cur = []; } return; }
        if(HAS_DJV && SANS !== "DejaVu" && needsUnicode(p)){ doc.setFont("DejaVu", st === "normal" ? "normal" : "bold"); cur.push({ t: "text", s: p, st, djv: true, w: tw(p), u: !!r.u, x: !!r.x, c: r.c || "" }); setSt(st); }
        else cur.push({ t: "text", s: p, st, w: tw(p), u: !!r.u, x: !!r.x, c: r.c || "" });
      });
    }
    if(cur.length) words.push(cur);
    return words;
  }
  // wrap = { narrow:{w,h,dx}, acc }: rows that start above narrow.h use the narrow width (text beside a picture)
  function layoutPara(b, width, wrap){
    const k = b.scale || 1; if(k === 1) return layoutPara0(b, width, wrap);
    const sv = [fs, LH, TASC, EM], sc = [fs * k, LH * k, TASC * k, EM * k], set = v => { [fs, LH, TASC, EM] = v; };
    set(sc); let rows; try{ rows = layoutPara0(b, width, wrap); } finally{ set(sv); }
    return rows.map(r => Object.assign({}, r, { draw(...a){ set(sc); try{ r.draw(...a); } finally{ set(sv); } } }));
  }
  function layoutPara0(b, width, wrap){
    doc.setFontSize(fs);
    const words = wordsOf(b.runs);
    setSt("normal"); const SP = tw(" ");
    const rowH = r => { let a = TASC, d = LH - TASC; r.forEach(w => w.forEach(p => { if(p.t === "math"){ a = Math.max(a, p.asc + .7); d = Math.max(d, p.desc + .7); } })); return a + d; };
    let accY = wrap ? wrap.acc : 0;
    const isN = () => !!(wrap && wrap.narrow && accY < wrap.narrow.h);
    let avail = (isN() ? wrap.narrow.w : width) - (b.ind || 0);
    const rows = [], rowN = [];
    let row = [], rw = 0;
    const pushRow = r => { rows.push(r); rowN.push(isN()); accY += rowH(r); avail = (isN() ? wrap.narrow.w : width) - (b.ind || 0); };
    for(const w of words){
      const ww = w.reduce((a, p) => a + p.w, 0);
      if(row.length && rw + SP + ww > avail){ pushRow(row); row = []; rw = 0; }
      // a single over-long plain word: break it by characters
      if(!row.length && ww > avail && w.length === 1 && w[0].t === "text"){
        setSt(w[0].st); let chunk = "";
        for(const ch of w[0].s){ if(tw(chunk + ch) > avail && chunk){ pushRow([[{ t: "text", s: chunk, st: w[0].st, w: tw(chunk) }]]); chunk = ""; } chunk += ch; }
        row = [[{ t: "text", s: chunk, st: w[0].st, w: tw(chunk) }]]; rw = row[0][0].w; continue;
      }
      row.push(w); rw += (row.length > 1 ? SP : 0) + ww;
    }
    if(row.length) pushRow(row);
    if(!rows.length) pushRow([]);
    return rows.map((r, ri) => {
      let asc = TASC, desc = LH - TASC;
      const rowW = r.reduce((a, w) => a + w.reduce((x, p) => x + p.w, 0), 0) + SP * Math.max(0, r.length - 1);
      const rowAvail = ((wrap && wrap.narrow && rowN[ri]) ? wrap.narrow.w : width) - (b.ind || 0);
      const shift = b.align === "center" ? Math.max(0, (rowAvail - rowW) / 2) : b.align === "right" ? Math.max(0, rowAvail - rowW) : 0;
      // justified: spread the spaces of every line except the last one of the paragraph
      const just = (b.align === "justify" || (!b.align && b.type === "para" && !b.opt && JUST)) && ri < rows.length - 1 && r.length > 1;
      let gap = SP; if(just){ const g = SP + (rowAvail - rowW) / (r.length - 1); if(g > SP && g < SP * 4.5) gap = g; }
      r.forEach(w => w.forEach(p => { if(p.t === "math"){ asc = Math.max(asc, p.asc + .7); desc = Math.max(desc, p.desc + .7); } }));
      return { h: asc + desc, asc, txt: true, dx: (wrap && wrap.narrow && rowN[ri]) ? wrap.narrow.dx : 0, width: r.reduce((a, w) => a + w.reduce((x, p) => x + p.w, 0), 0) + SP * Math.max(0, r.length - 1), draw(x, y, color){
        doc.setFontSize(fs); doc.setTextColor(...(color || INK));
        let cx = x + (b.ind || 0) + shift;
        if(b.bullet && ri === 0){ setSt("bold"); doc.text("•", x + 1, y + asc); }
        if(b.mark && ri === 0){
          const r = EM * .37, cy = y + asc - EM * .34, cx0 = x + 1.2 + r;
          doc.setDrawColor(...(COLOUR ? PC : INK)); doc.setLineWidth(.32);
          if(b.mark === "multi") doc.rect(cx0 - r, cy - r, 2 * r, 2 * r, "S"); else doc.circle(cx0, cy, r, "S");
        }
        r.forEach((w, wi) => {
          if(wi) cx += gap;
          // underline continues across the space between two underlined words
          if(wi && w[0].u && r[wi - 1][r[wi - 1].length - 1].u){ const uc = w[0].c ? hexRgb(cssHex(w[0].c)) : (color || INK); doc.setDrawColor(...uc); doc.setLineWidth(Math.max(.18, fs * .018)); doc.line(cx - gap, y + asc + fs * mmPt * .14, cx, y + asc + fs * mmPt * .14); }
          if(wi && w[0].x && r[wi - 1][r[wi - 1].length - 1].x){ const xc = w[0].c ? hexRgb(cssHex(w[0].c)) : (color || INK); doc.setDrawColor(...xc); doc.setLineWidth(Math.max(.18, fs * .018)); doc.line(cx - gap, y + asc - fs * mmPt * .27, cx, y + asc - fs * mmPt * .27); }
          w.forEach(p => {
            if(p.t === "math") doc.addImage(p.m.png, "PNG", cx, y + asc - p.asc, p.w, p.asc + p.desc, mAlias(p.m), "FAST");
            else {
              if(p.djv) doc.setFont("DejaVu", p.st === "normal" ? "normal" : "bold"); else setSt(p.st);
              const tc = p.err ? [180, 60, 40] : p.c ? hexRgb(cssHex(p.c)) : (COLOUR && b.opt && ri === 0 && wi === 0 ? PC : (color || INK));
              doc.setTextColor(...tc);
              doc.text(p.s, cx, y + asc);
              if(p.x){ doc.setDrawColor(...tc); doc.setLineWidth(Math.max(.18, fs * .018)); doc.line(cx, y + asc - fs * mmPt * .27, cx + p.w, y + asc - fs * mmPt * .27); }
              if(p.u){ doc.setDrawColor(...tc); doc.setLineWidth(Math.max(.18, fs * .018)); doc.line(cx, y + asc + fs * mmPt * .14, cx + p.w, y + asc + fs * mmPt * .14); }
              doc.setTextColor(...(color || INK));
            }
            cx += p.w;
          });
        });
      } };
    });
  }
  function layoutTable(b, width){
    const PAD = 2, ncol = Math.max(...b.rows.map(r => r.length));
    // natural (single-line) width of every column
    const nat = Array(ncol).fill(18);
    b.rows.forEach(r => r.forEach((c, j) => { const l = layoutPara({ runs: c }, 1e4); nat[j] = Math.max(nat[j], (l[0] ? l[0].width : 0) + 2 * PAD + .5); }));
    let tot = nat.reduce((a, v) => a + v, 0);
    const cw = tot <= width ? nat : nat.map(v => Math.max(14, v * width / tot));
    tot = cw.reduce((a, v) => a + v, 0);
    const grid = b.rows.map((r, ri) => {
      const cells = cw.map((w, j) => { const c = r[j] || []; const ls = layoutPara({ runs: ri === 0 && b.header ? c.map(x => Object.assign({}, x, { b: true })) : c }, w - 2 * PAD); return { ls, h: ls.reduce((a, l) => a + l.h, 0) }; });
      return { cells, h: Math.max(LH * 1.25, ...cells.map(c => c.h)) + 2 * PAD * .8 };
    });
    const H = grid.reduce((a, r) => a + r.h, 0);
    return { h: H + 3, draw(x, y){
      let ry = y + 1;
      grid.forEach((r, ri) => {
        if(ri === 0 && b.header){ doc.setFillColor(...ACC_XL); doc.rect(x, ry, tot, r.h, "F"); }
        let cx = x;
        r.cells.forEach((c, j) => { let ly = ry + PAD * .8 + (r.h - 2 * PAD * .8 - c.h) / 2; c.ls.forEach(l => { l.draw(cx + PAD, ly); ly += l.h; }); cx += cw[j]; });
        ry += r.h;
      });
      doc.setDrawColor(...shade(ACC_L, .15)); doc.setLineWidth(.25);
      let ly = y + 1; doc.line(x, ly, x + tot, ly); grid.forEach(r => { ly += r.h; doc.line(x, ly, x + tot, ly); });
      let lx = x; doc.line(lx, y + 1, lx, y + 1 + H); cw.forEach(w => { lx += w; doc.line(lx, y + 1, lx, y + 1 + H); });
    } };
  }
  // narrow = { w, h, dx }: blocks that start within the first h mm are laid out w wide and shifted dx (text wrapping beside an image)
  function layoutRich(text, width, q, narrow){
    const out = []; let acc = 0;
    const isNarrow = () => !!narrow && acc < narrow.h;
    const curW = () => isNarrow() ? narrow.w : width;
    const add = ls => { const n = isNarrow(); ls.forEach(l => { if(l.dx === undefined) l.dx = n ? narrow.dx : 0; out.push(l); acc += l.h; }); };
    const mark = q && q.mcq ? q.mcq : "";
    const cols = q ? Math.max(1, +q.optCols || 1) : 1;
    const grouped = !!(mark || cols > 1);
    let group = [], noted = false;
    const note = () => {
      if(mark !== "multi" || noted || /all that apply|more than one|two answers|three answers/i.test(q.text || "")) return;
      noted = true; add(layoutPara({ runs: [{ t: "text", s: PT("(Select all that apply.)"), i: true }] }, curW()));
    };
    const flush = () => {
      if(!group.length) return;
      note();
      const ind = 5;
      for(let r = 0; r < group.length; r += cols){
        const colW = curW() / cols;
        const cells = group.slice(r, r + cols).map(b => layoutPara(Object.assign({}, b, { ind }), colW - (cols > 1 ? 3 : 0)));
        const h = Math.max(...cells.map(c => c.reduce((a, l) => a + l.h, 0))) + (mark ? .8 : 0);
        add([{ h, opt: r, asc: cells[0][0] ? cells[0][0].asc : TASC, draw(x, y){ cells.forEach((c, ci) => { let ly = y; c.forEach(l => { l.draw(x + ci * colW, ly); ly += l.h; }); }); } }]);   // opt: index of the first option on this row
      }
      group = [];
    };
    for(const b of parseRich(text, fmtOf(q))){
      if(grouped && b.type === "para" && b.opt){ group.push(b); continue; }
      if(grouped && b.type === "gap" && group.length) continue;
      flush();
      const bw = curW();
      if(b.type === "gap"){ add([{ h: LH * .5, gap: true }]); continue; }
      if(b.type === "display"){
        const m = texSVG(b.tex, true);
        if(!m.png){ add(layoutPara({ runs: [{ t: "text", s: "[" + b.tex + "]", b: false, i: false }] }, bw)); continue; }
        let w = m.w * EM * 1.05, h = (m.asc + m.desc) * EM * 1.05;
        if(w > bw){ h *= bw / w; w = bw; }
        add([{ h: h + 4, asc: h / 2 + 2, draw(x, y){ doc.addImage(m.png, "PNG", x + (bw - w) / 2, y + 2, w, h, mAlias(m), "FAST"); } }]);
        continue;
      }
      if(b.type === "table"){ add([layoutTable(b, bw)]); continue; }
      if(b.type === "img"){
        const P = picData(b.id); if(!P) continue;
        let w = bw * b.size / 100, h = w * P.h / P.w;
        const maxH = Math.max(30, BOTTOM - TOP - 16); if(h > maxH){ w *= maxH / h; h = maxH; }
        const off = b.align === "left" ? 0 : b.align === "right" ? bw - w : (bw - w) / 2;
        add([{ h: h + 4, asc: TASC, draw(x, y){ doc.addImage(P.src, P.src.startsWith("data:image/png") ? "PNG" : "JPEG", x + off, y + 2, w, h, "pic_" + b.id, "FAST"); } }]);
        continue;
      }
      if(b.type === "mol"){
        const m = MOLS[b.smi];
        if(!m || !m.png){ add(layoutPara({ runs: [{ t: "text", s: "[molecule: " + b.smi + (m && m.err ? " — " + m.err : "") + "]", i: true }] }, bw)); continue; }
        let w = m.w * .4 * (fs / 11), h = m.h * .4 * (fs / 11);           // same bond length for every molecule
        const k = Math.min(1, bw / w, 75 / h); w *= k; h *= k;
        const capH = b.cap ? LH : 0;
        add([{ h: h + 4 + capH, asc: TASC, draw(x, y){
          doc.addImage(m.png, "PNG", x + (bw - w) / 2, y + 2, w, h, "mol_" + strHash(b.smi), "FAST");
          if(b.cap){ font(SANS, "italic", fs - 1, INK); doc.text(b.cap, x + bw / 2, y + 2 + h + capH * .75, { align: "center" }); }
        } }]);
        continue;
      }
      if(b.type === "pic"){
        const ph = 30, pw = Math.min(bw, 110);
        add([{ h: ph + 4, asc: TASC, draw(x, y){
          const red = [192, 57, 43], grey = [150, 150, 150], col = FINAL ? grey : red;
          if(!FINAL){ doc.setFillColor(253, 236, 234); doc.roundedRect(x, y + 2, pw, ph, 1.5, 1.5, "F"); }
          doc.setDrawColor(...col); doc.setLineWidth(.35); doc.setLineDashPattern([1.6, 1.2], 0); doc.roundedRect(x, y + 2, pw, ph, 1.5, 1.5, "S"); doc.setLineDashPattern([], 0);
          font(SANS, "bold", 9, col); doc.text(FINAL ? PT("Diagram") : "PICTURE MISSING — add it in BEE", x + 4, y + 8);
          font(SANS, "italic", 8.5, col); doc.splitTextToSize(b.desc || "", pw - 8).slice(0, 4).forEach((l, k) => doc.text(l, x + 4, y + 13 + k * 4));
          doc.setTextColor(...INK);
        } }]);
        continue;
      }
      add(narrow && isNarrow() ? layoutPara(b, width, { narrow, acc }) : layoutPara(b, bw));
    }
    flush(); note();
    while(out.length && out[out.length - 1].gap) out.pop();
    return out;
  }
  function imgDims(it, width){
    const pct = (it.imgSize || 100) / 100;
    let w = width * pct, h = w * it.img.h / it.img.w;
    const maxH = BOTTOM - TOP - 14;
    if(h > maxH){ h = maxH; w = h * it.img.w / it.img.h; }
    return { w, h };
  }

  if(items.length){
    newPage();
    const ANS = Math.max(8.2, fs * mmPt * (SPC >= 2 ? 2.4 : 1.95));
    const pageAvail = BOTTOM - TOP;
    // a question (or text item) as a list of stackable parts
    const KEY = !!opt.key, KEYC = [192, 57, 43], KEYBG = [253, 240, 237];
    // 💻 a student's typed answers (from the computer version), in blue in the real answer spaces
    const RESP = opt.resp || null, BLUE = [31, 79, 184];
    function respParts(A, key, sp, x0, x1){
      const bl = ((A && A.areas && A.areas[key]) || []).filter(b => b.t === "draw" ? !!b.png : String(b.v || "").trim());
      if(!bl.length) return sp;
      const minH = sp.reduce((a, p) => a + p.h, 0), W = x1 - x0, out = [{ h: 2, draw: () => {} }];
      const rule = (yy, H) => { doc.setDrawColor(...RULE); doc.setLineWidth(.22); doc.line(x0, yy + H, x1, yy + H); };
      for(const b of bl){
        if(b.t === "text"){
          String(b.v).replace(/\s+$/, "").split("\n").forEach(par => {
            if(!par.trim()){ out.push({ h: ANS, draw: yy => rule(yy, ANS) }); return; }
            layoutPara({ type: "para", runs: [{ t: "text", s: par, c: "#1F4FB8" }], ind: 0, scale: 1, align: "left" }, W - 2).forEach(l => {
              const H = Math.max(ANS, l.h);
              out.push({ h: H, draw: yy => { rule(yy, H); font(SANS, "normal", fs, BLUE); l.draw(x0 + 1, yy + H - 1.7 - (l.asc || TASC)); } });
            });
          });
        }else if(b.t === "math"){
          const m = texSVG(mathColor(b.v, "#1F4FB8"), true);
          if(!m.png){ layoutPara({ type: "para", runs: [{ t: "text", s: b.v, c: "#1F4FB8" }], ind: 0, scale: 1, align: "left" }, W - 2).forEach(l => out.push({ h: Math.max(ANS, l.h), draw: yy => l.draw(x0 + 1, yy + 1) })); continue; }
          let w = m.w * EM * 1.05, h = (m.asc + m.desc) * EM * 1.05; if(w > W - 4){ h *= (W - 4) / w; w = W - 4; }
          out.push({ h: h + 4, draw: yy => doc.addImage(m.png, "PNG", x0 + 2, yy + 2, w, h, mAlias(m), "FAST") });
        }else if(b.t === "draw"){
          const bw = b.w || 1000, bh = b.h || 560;
          let w = Math.min(W, 160), h = w * bh / bw; if(h > pageAvail - 24){ h = pageAvail - 24; w = h * bw / bh; }
          out.push({ h: h + 4, draw: yy => { doc.addImage(b.png, "PNG", x0, yy + 2, w, h, "drw_" + strHash(b.png.length + b.png.slice(-400)), "FAST"); doc.setDrawColor(...RULE); doc.setLineWidth(.25); doc.rect(x0, yy + 2, w, h, "S"); } });
        }
      }
      let h = out.reduce((a, p) => a + p.h, 0);
      while(h + ANS <= minH){ out.push({ h: ANS, draw: yy => rule(yy, ANS) }); h += ANS; }
      out.push({ h: 1.5, draw: () => {} });
      return out;
    }
    // answer space: lines | blank | grid | box, n "line heights" tall, from x0 to x1
    function spaceParts(kind, n, x0, x1, range){
      if(kind === "numberline") return numberLine(range, x0, x1);
      if(kind === "axes") return coordGrid(range, x0, x1);
      n = Math.max(0, Math.min(60, Math.round(num(n)))); if(!n) return [];
      if(!kind || kind === "lines"){
        const out = [{ h: 2, draw: () => {} }];
        for(let k = 0; k < n; k++) out.push({ h: ANS, draw: yy => { doc.setDrawColor(...(COLOUR ? tint(PC, .55) : RULE)); doc.setLineWidth(.22); doc.line(x0, yy + ANS, x1, yy + ANS); } });
        return out;
      }
      const H = Math.min(n * ANS, pageAvail - 12);
      return [{ h: H + 4, draw: yy => {
        const y0 = yy + 2;
        if(kind === "grid"){
          doc.setDrawColor(222, 218, 210); doc.setLineWidth(.15);
          for(let gx = x0; gx <= x1 + .01; gx += 5) doc.line(gx, y0, gx, y0 + H);
          for(let gy = y0; gy <= y0 + H + .01; gy += 5) doc.line(x0, gy, x1, gy);
          doc.setDrawColor(...RULE); doc.setLineWidth(.3); doc.rect(x0, y0, x1 - x0, H, "S");
        }else if(kind === "box"){ doc.setDrawColor(...RULE); doc.setLineWidth(.35); doc.roundedRect(x0, y0, x1 - x0, H, 1.5, 1.5, "S"); }
      } }];
    }
    // answer-key box (teacher copy): model answer in red, at least as tall as the student's space
    function answerParts(text, x0, x1, minH){
      const ls = layoutRich(text, x1 - x0 - 8, null);
      const out = [{ h: 6.5, draw: yy => { doc.setFillColor(...KEYBG); doc.rect(x0, yy + 1.5, x1 - x0, 5, "F"); doc.setFillColor(...KEYC); doc.rect(x0, yy + 1.5, 1.2, 5, "F"); font(SANS, "bold", 7, KEYC); doc.text(PT("MODEL ANSWER"), x0 + 4, yy + 5.2, { charSpace: .6 }); } }];
      ls.forEach(l => out.push({ h: l.h, draw: yy => { doc.setFillColor(...KEYBG); doc.rect(x0, yy, x1 - x0, l.h, "F"); doc.setFillColor(...KEYC); doc.rect(x0, yy, 1.2, l.h, "F"); if(l.draw){ font(SANS, "normal", fs, KEYC); l.draw(x0 + 4 + (l.dx || 0), yy, KEYC); } } }));
      let h = out.reduce((a, p) => a + p.h, 0);
      if(h < minH) out.push({ h: minH - h, draw: yy => { doc.setFillColor(...KEYBG); doc.rect(x0, yy, x1 - x0, minH - h, "F"); doc.setFillColor(...KEYC); doc.rect(x0, yy, 1.2, minH - h, "F"); } });
      out.push({ h: 1.5, draw: () => {} });
      return out;
    }
    // ---- number line:  "-10..10"  or  "0..100 step 10"
    function numberLine(range, x0, x1){
      const R = parseRange(range, [-10, 10]);
      const [a, b] = R.x, step = R.step || nlStep(b - a, 30);
      const pad = 6, L = x0 + pad, Rr = x1 - pad, H = 15;
      return [{ h: 3, draw: () => {} }, { h: H, draw: yy => {
        const y = yy + 5, X = v => L + (v - a) / (b - a) * (Rr - L);
        doc.setDrawColor(...INK); doc.setLineWidth(.35); doc.line(x0 + 1, y, x1 - 1, y);
        arrowHead(x1 - 1, y, 1, 0); arrowHead(x0 + 1, y, -1, 0);
        const fsz = Math.min(9, fs - 2); font(SANS, "normal", fsz, INK);
        const gap = (Rr - L) / ((b - a) / step), every = labelStep(1, gap, Math.max(String(a).length, String(b).length) * fsz * .2 + 2);
        for(let k = 0, v = a; v <= b + 1e-9; v = +(a + (++k) * step).toFixed(6)){
          const big = k % every === 0;
          doc.setLineWidth(big ? .3 : .2); doc.line(X(v), y - (big ? 1.8 : 1.1), X(v), y + (big ? 1.8 : 1.1));
          if(big) doc.text(fmt(v), X(v), y + 5.6, { align: "center" });
        }
      } }];
    }
    // ---- coordinate grid with x and y axes:  "-6..6"  or  "-2..8, -5..5"
    function coordGrid(range, x0, x1){
      const R = parseRange(range, [-6, 6]);
      const [xa, xb] = R.x, [ya, yb] = R.y || R.x;
      const nx = Math.max(1, xb - xa), ny = Math.max(1, yb - ya);
      let cell = Math.min(7, (x1 - x0 - 12) / nx, (pageAvail - 24) / ny); cell = Math.max(2.5, cell);
      const W = nx * cell, H = ny * cell, gx0 = x0 + (x1 - x0 - W) / 2;
      return [{ h: 3, draw: () => {} }, { h: H + 8, draw: yy => {
        const gy0 = yy + 4, X = v => gx0 + (v - xa) * cell, Y = v => gy0 + (yb - v) * cell;
        doc.setDrawColor(215, 211, 203); doc.setLineWidth(.15);
        for(let i = 0; i <= nx; i++) doc.line(gx0 + i * cell, gy0, gx0 + i * cell, gy0 + H);
        for(let j = 0; j <= ny; j++) doc.line(gx0, gy0 + j * cell, gx0 + W, gy0 + j * cell);
        const ax = (xa <= 0 && xb >= 0) ? 0 : xa, ay = (ya <= 0 && yb >= 0) ? 0 : ya;
        doc.setDrawColor(...INK); doc.setLineWidth(.35);
        doc.line(gx0, Y(ay), gx0 + W + 2.5, Y(ay)); arrowHead(gx0 + W + 2.5, Y(ay), 1, 0);
        doc.line(X(ax), gy0 + H, X(ax), gy0 - 2.5); arrowHead(X(ax), gy0 - 2.5, 0, -1);
        const fsz = Math.min(8, Math.max(5.5, cell * 1.25)); font(SANS, "normal", fsz, INK);
        const ex = labelStep(1, cell, Math.max(String(xa).length, String(xb).length) * fsz * .22 + 1.2), ey = labelStep(1, cell, fsz * .45);
        for(let v = xa; v <= xb; v++) if(v !== ax && (v - ax) % ex === 0){ doc.setLineWidth(.25); doc.line(X(v), Y(ay) - .9, X(v), Y(ay) + .9); doc.text(fmt(v), X(v), Y(ay) + fsz * .42 + 1.6, { align: "center" }); }
        for(let v = ya; v <= yb; v++) if(v !== ay && (v - ay) % ey === 0){ doc.setLineWidth(.25); doc.line(X(ax) - .9, Y(v), X(ax) + .9, Y(v)); doc.text(fmt(v), X(ax) - 1.6, Y(v) + fsz * .14, { align: "right" }); }
        if(ax === 0 && ay === 0) doc.text("0", X(0) - 1.4, Y(0) + fsz * .42 + 1.4, { align: "right" });
        font(SANS, "italic", fsz + 1.5, INK); doc.text("x", gx0 + W + 3.6, Y(ay) + 1.2); doc.text("y", X(ax) + 1.8, gy0 - 2.2);
      } }];
    }
    function arrowHead(x, y, dx, dy){ const s = 1.6, w = .55; doc.setFillColor(...INK); doc.triangle(x + dx * .4, y + dy * .4, x - dx * s - dy * s * w, y - dy * s - dx * s * w, x - dx * s + dy * s * w, y - dy * s + dx * s * w, "F"); }
    const spaceH = (kind, n) => spaceParts(kind, n, 0, 10).reduce((a, p) => a + p.h, 0);
    // a question (or text item) as a list of stackable parts
    function qBlock(it, X, W){
      const isQ = it.type === "q";
      const half = W < CW - 1;
      const subMarks = isQ && Array.isArray(it.subs) && it.subs.some(sb => num(sb.marks) > 0);
      const markShown = isQ && D.showMarks && !it.hideMarks && qMarks(it) > 0 && !subMarks;
      const mW = isQ ? (half ? Math.min(MARKW, Math.max(15, fs * 1.3)) : MARKW) : 0;
      const nW = isQ && !it.nonum ? NUMW : 0;
      const tx = X + nW, tw = W - nW, twM = tw - mW;     // twM: width beside the [marks] label
      let img = it.img ? imgDims(it, markShown ? twM : tw) : null;
      const WGAP = 5;
      const al = it.imgAlign || "left";
      const T = RESP && it.mcq && Array.isArray(it.options) ? qTextResp(it, ((RESP.answers[it.id] || {}).choice) || [], KEY) : qText(it, KEY);
      const wrap = !!(img && it.imgWrap && al !== "center" && T.trim());
      if(wrap && twM - img.w - WGAP < twM * .3){ const nw = twM * .7 - WGAP; img = { w: nw, h: img.h * nw / img.w }; }   // keep at least 30% for the text
      // beside a wrapped picture: the narrow column; otherwise only the first line steps aside for "[5 marks]"
      const narrow = wrap ? { w: twM - img.w - WGAP, h: img.h + 1, dx: al === "left" ? img.w + WGAP : 0 } : markShown ? { w: twM, h: .01, dx: 0 } : null;
      const lines = layoutRich(T, wrap ? twM : tw, it, narrow);
      const parts = [];
      let lineNo = 0;
      lines.forEach(l => {
        const showNo = it.lineNums && l.txt && (++lineNo % 5 === 0);
        const no = lineNo;
        parts.push({ h: l.h, opt: l.opt, draw: yy => {
          if(l.draw){ font(SANS, "normal", fs, INK); l.draw(tx + (l.dx || 0), yy); }
          if(showNo){ font(SANS, "normal", Math.max(7, fs - 3.5), MUTED); doc.text(String(no), X - 2.4, yy + (l.asc || TASC), { align: "right" }); }
        } });
      });
      if(wrap){
        // the picture sits at the top beside the text; reserve its height if the text is shorter
        const textH = lines.reduce((a, l) => a + l.h, 0);
        if(textH < img.h + 1) parts.push({ h: img.h + 1 - textH, draw: () => {} });
        const fd0 = parts[0].draw, ix = al === "left" ? tx : tx + tw - img.w;
        parts[0].draw = yy => { doc.addImage(it.img.src, imgFmt(it.img.src), ix, yy + .8, img.w, img.h, "img_" + it.id, "FAST"); fd0(yy); };
      }else if(img){
        const pad = lines.length ? 3 : 0;
        parts.push({ h: img.h + pad, draw: yy => {
          const ix = it.imgAlign === "center" ? tx + (tw - img.w) / 2 : it.imgAlign === "right" ? tx + tw - img.w : tx;
          doc.addImage(it.img.src, imgFmt(it.img.src), ix, yy + pad, img.w, img.h, "img_" + it.id, "FAST");
        } });
      }
      // the question's own answer space (or, in the answer key, its model answer)
      if(isQ){
        const sp = SHEET ? [] : spaceParts(it.space, it.lines, tx, X + W, it.range);
        if(RESP){ parts.push(...respParts(RESP.answers[it.id], "main", sp, tx, X + W)); if(KEY && (it.answer || "").trim()) parts.push(...answerParts(it.answer, tx, X + W, 0)); }
        else if(KEY && (it.answer || "").trim()) parts.push(...answerParts(it.answer, tx, X + W, sp.reduce((a, p) => a + p.h, 0) - 3));
        else parts.push(...sp);
      }
      // sub-questions (a), (b), (c)…
      const subs = isQ && Array.isArray(it.subs) ? it.subs : [];
      const subStart = [];
      subs.forEach((sb, k) => {
        subStart.push(parts.length);
        const lab = "(" + LETTERS[k] + ")", SI = Math.max(8, fs * .72);
        const sx = tx + SI, sw = (num(sb.marks) > 0 && D.showMarks ? twM : tw) - SI;
        const sl = layoutRich(sb.text || "", sw, null);
        parts.push({ h: 2.5, draw: () => {} });
        const base0 = sl[0] && sl[0].asc ? sl[0].asc : TASC;
        if(!sl.length) sl.push({ h: LH, asc: TASC });
        sl.forEach((l, li) => parts.push({ h: l.h, draw: yy => {
          if(l.draw){ font(SANS, "normal", fs, INK); l.draw(sx + (l.dx || 0), yy); }
          if(li === 0){
            font(SANS, "bold", fs, INK); doc.text(lab, tx, yy + base0);
            const mk = num(sb.marks);
            if(D.showMarks && mk > 0){ font(SANS, "normal", fs - 1.5, MUTED); doc.text("[" + fmt(mk) + "]", X + W, yy + base0, { align: "right" }); }
          }
        } }));
        const sp = SHEET ? [] : spaceParts(sb.space, sb.lines, sx, X + W, sb.range);
        if(RESP){ parts.push(...respParts(RESP.answers[it.id], "s:" + (sb.id || String(k)), sp, sx, X + W)); if(KEY && (sb.answer || "").trim()) parts.push(...answerParts(sb.answer, sx, X + W, 0)); }
        else if(KEY && (sb.answer || "").trim()) parts.push(...answerParts(sb.answer, sx, X + W, sp.reduce((a, p) => a + p.h, 0) - 3));
        else parts.push(...sp);
      });
      if(!parts.length) parts.push({ h: LH, draw: () => {} });
      if(isQ){
        const base0 = lines[0] && lines[0].asc && !lines[0].gap ? lines[0].asc : TASC;
        const fd = parts[0].draw;
        parts[0].draw = yy => {
          fd(yy);
          if(!it.nonum){
            if(COLOUR){ const r = Math.max(2.7, fs * .3), cx0 = X + r, cy0 = yy + base0 - fs * mmPt * .36; doc.setFillColor(...PC); doc.circle(cx0, cy0, r, "F");
              const t = String(M.meta[it.id]); font(SANS, "bold", Math.min(fs - 1, t.length > 1 ? 8.5 : 10), [255, 255, 255]); doc.text(t, cx0, cy0 + fs * mmPt * .3, { align: "center" }); }
            else{ font(SANS, "bold", fs, ACC_D); doc.text(M.meta[it.id] + ".", X, yy + base0); }
          }
          const mk = it.hideMarks ? 0 : qMarks(it);
          // with sub-questions the marks are shown on each part; otherwise next to the question
          if(COLOUR && D.showMarks && mk > 0 && !subs.some(sb => num(sb.marks) > 0)){
            const t = fmt(mk) + (half ? "" : (mk === 1 ? PT(" mark]") : PT(" marks]")).replace("]", "")); font(SANS, "bold", fs - 2.5, shade(PC, .25));
            const tw2 = doc.getTextWidth(t) + 4.5, ph = fs * mmPt * .95; doc.setFillColor(...tint(PC, .85)); doc.roundedRect(X + W - tw2, yy + base0 - ph * .78, tw2, ph, ph / 2, ph / 2, "F");
            doc.text(t, X + W - tw2 / 2, yy + base0 - ph * .78 + ph * .7, { align: "center" });
          }else
          if(D.showMarks && mk > 0 && !subs.some(sb => num(sb.marks) > 0)){ font(SANS, "normal", fs - 1.5, MUTED); doc.text("[" + fmt(mk) + (half ? "]" : (mk === 1 ? PT(" mark]") : PT(" marks]"))), X + W, yy + base0, { align: "right" }); }
        };
      }
      const h = parts.reduce((a, p) => a + p.h, 0);
      // pieces a question may be split between: the question itself, then each sub-question
      // …or, for a multiple-choice question without sub-questions, before option C, D, E… (A and B stay with the question)
      const breaks = subStart.length ? subStart : parts.map((p, i) => p.opt != null && p.opt >= 2 ? i : -1).filter(i => i >= 0);
      parts.forEach((p, i) => { p.g = breaks.filter(st => st <= i).length; });
      const groupH = [0].concat(breaks.map((_, k) => k + 1)).map(g => parts.filter(p => p.g === g).reduce((a, p) => a + p.h, 0));
      return { parts, h, groupH, first: parts.slice(0, 3).reduce((a, p) => a + p.h, 0), drawAll(yy){ parts.forEach(p => { p.draw(yy); yy += p.h; }); } };
    }
    for(let idx = 0; idx < items.length; idx++){
      const it = items[idx];
      if(it.type === "section"){
        if((D.sectionNewPage || it.newPage) && y > TOP + 1) newPage();
        const h = 11;
        // keep the heading together with (the start of) its first question — never alone at the bottom of a page
        let need = 22;
        const nx = items[idx + 1];
        if(nx && nx.type !== "section"){
          const nb = nx.type === "q" && nx.width === "half" ? qBlock(nx, ML, (CW - 8) / 2) : qBlock(nx, ML, CW);
          need = Math.max(need, (nb.h <= pageAvail - h - 9 ? nb.h : nb.first) + 3);
        }
        if(y > TOP + 1 && y + h + 9 + need > BOTTOM) newPage();
        if(y > TOP + 1) y += 3;
        pageOf[it.id] = doc.getNumberOfPages();
        if(COLOUR){ PC = PAL[items.slice(0, idx).filter(x => x.type === "section").length % PAL.length]; }
        mark(it.id, y, y + h);
        if(COLOUR){ doc.setFillColor(...PC); doc.roundedRect(ML, y, CW, h, 2.2, 2.2, "F"); }
        else{ doc.setFillColor(...ACC_XL); doc.rect(ML, y, CW, h, "F"); doc.setFillColor(...ACC); doc.rect(ML, y, 1.6, h, "F"); }
        const mk = M.meta[it.id];
        font(SANS, "bold", 8.5, COLOUR ? [255, 255, 255] : ACC_D);
        const mtxt = mk > 0 ? fmt(mk) + (mk === 1 ? PT(" MARK") : PT(" MARKS")) : "";
        const mw = mtxt ? doc.getTextWidth(mtxt) + mtxt.length * .5 + 4 : 0;
        if(mtxt) doc.text(mtxt, PW - MR - 3 - doc.getTextWidth(mtxt) - mtxt.length * .5, y + 7.1, { charSpace: .5 });
        font(SANS, "bold", 12.5, COLOUR ? [255, 255, 255] : INK);
        doc.text(fitText(stripFmt(it.text || PT("Part")).replace(/\$+([^$]*)\$+/g, "$1"), CW - 12 - mw), ML + 6, y + 7.4);
        y += h + (COMPACT ? 4.5 : 6);
        continue;
      }
      if(it.pagebreak){ if(y > TOP + 1) newPage(); continue; }
      if(it.newPage && y > TOP + 1) newPage();
      // sub-part heading (A. Definitions …): accent-coloured, a rule underneath, never left alone at the bottom of a page
      if(it.type === "note" && it.heading){
        const hh = fs * mmPt * 1.25 + 4.5;
        // keep the heading with the instructions under it and the start of the first question
        let need = 18, j = idx + 1, acc = 0;
        while(items[j] && items[j].type === "note" && !items[j].heading){ acc += qBlock(items[j], ML, CW).h + NGAP; j++; }
        const nx = items[j];
        if(nx && nx.type === "q"){ const nb = nx.width === "half" ? qBlock(nx, ML, (CW - 8) / 2) : qBlock(nx, ML, CW); acc += nb.h <= pageAvail ? nb.h : nb.first; }   // a question that fits on a page is never split, so reserve all of it
        need = Math.max(need, acc + 2);
        if(need > pageAvail * .7) need = 18 + (items[idx + 1] && items[idx + 1].type !== "section" && !items[idx + 1].heading ? Math.min(qBlock(items[idx + 1], ML, CW).first, 30) : 0);
        if(y > TOP + 1 && y + hh + need > BOTTOM) newPage();
        if(y > TOP + 1) y += 2.5;
        pageOf[it.id] = doc.getNumberOfPages();
        const base = y + fs * mmPt * 1.05; mark(it.id, y - 1, y + hh);
        const mk = num(it.marks), mtxt = mk > 0 ? fmt(mk) + (mk === 1 ? PT(" point") : PT(" points")) : "";
        const SC = COLOUR ? shade(PC, .12) : ACC_D;
        font(SANS, "normal", fs - 1, SC); const mw = mtxt ? doc.getTextWidth(mtxt) + 4 : 0;
        if(mtxt) doc.text(mtxt, ML + CW, base, { align: "right" });
        font(SANS, "bold", fs + 1, SC);
        doc.text(fitText(stripFmt(it.text || "").replace(/\$+([^$]*)\$+/g, "$1"), CW - mw), ML, base);
        doc.setDrawColor(...(COLOUR ? PC : ACC)); doc.setLineWidth(COLOUR ? .8 : .45); doc.line(ML, base + 2, ML + CW, base + 2);
        y += hh + (COMPACT ? 2 : 3);
        continue;
      }
      // half-width questions sit side by side, two per row
      if(it.type === "q" && it.width === "half"){
        const nx = items[idx + 1];
        const pair = nx && nx.type === "q" && nx.width === "half" && !nx.newPage ? [it, nx] : [it];
        const GAP = 8, colW = (CW - GAP) / 2;
        const blocks = pair.map((q, k) => qBlock(q, ML + k * (colW + GAP), colW));
        const h = Math.max(...blocks.map(b => b.h));
        if(y + h > BOTTOM && y > TOP + 1) newPage();
        blocks.forEach((b, k) => { mark(pair[k].id, y, y + h, ML + k * (colW + GAP), ML + k * (colW + GAP) + colW); b.drawAll(y); });
        pair.forEach(q => pageOf[q.id] = doc.getNumberOfPages());
        y += h + QGAP; idx += pair.length - 1;
        continue;
      }
      const blk = qBlock(it, ML, CW);
      // a question with sub-questions may break between them: it starts here if the question + (a) fit,
      // and a later sub-question moves to the next page only when it doesn't fit whole
      const splitSubs = it.type === "q" && blk.groupH && blk.groupH.length > 2 && y + blk.h > BOTTOM && y > TOP + 1;
      // a long reading passage (text only) flows into the space left instead of leaving a gap
      const flowNote = it.type === "note" && !it.heading && !it.img && blk.h > 40 && y > TOP + 1 && BOTTOM - y >= 30 && !picsOf(it.text).length && !/\{img:|\{mol:|^\s*\|/m.test(it.text || "");
      // a short lead-in ("Refer to the image below.", "Figure 2", "Answer questions 5–8:") never sits alone at the
      // bottom of a page: if what it introduces has to start on the next page, the lead-in goes with it
      const leadIn = it.type === "note" && !it.heading && blk.h <= 24 && y > TOP + 1 && y + blk.h <= BOTTOM && (() => {
        const nx = items[idx + 1]; if(!nx || nx.type === "section" || nx.heading || nx.pagebreak || nx.newPage) return false;
        const nb = nx.type === "q" && nx.width === "half" ? qBlock(nx, ML, (CW - 8) / 2) : qBlock(nx, ML, CW);
        const canFlow = nx.type === "note" && !nx.img && nb.h > 40 && !picsOf(nx.text).length && !/\{img:|\{mol:|^\s*\|/m.test(nx.text || "");
        let need = nb.h <= pageAvail && !canFlow ? nb.h : nb.first;
        if(nx.type === "q" && nb.groupH && nb.groupH.length > 2 && nb.h > pageAvail * .5) need = Math.min(need, nb.groupH[0] + nb.groupH[1]);
        const y2 = y + blk.h + NGAP;
        return blk.h + need <= pageAvail * .9 && y2 + need > BOTTOM;
      })();
      if(leadIn) newPage();
      else if(splitSubs){ if(y + blk.groupH[0] + blk.groupH[1] > BOTTOM) newPage(); }
      else if(flowNote){ if(y + blk.first > BOTTOM) newPage(); }
      else if(blk.h <= pageAvail ? y + blk.h > BOTTOM : y + blk.first > BOTTOM) newPage();
      pageOf[it.id] = doc.getNumberOfPages();
      const panel = COLOUR && it.type === "note" && !it.heading && blk.h > 14;
      blk.parts.forEach((p, k) => {
        if(splitSubs && k && p.g !== blk.parts[k - 1].g && y > TOP + 1){
          const gh = blk.groupH[p.g];
          if(gh <= pageAvail - 6 && y + gh > BOTTOM){
            newPage();
            // a small reminder at the top of the new page
            if(!it.nonum){ font(SANS, "italic", fs - 2, MUTED); doc.text(M.meta[it.id] + ". " + PT("(continued)"), ML, y + fs * mmPt * .8); y += fs * mmPt * 1.25 + 1; }
          }
        }
        if(y + p.h > BOTTOM && y > TOP + 1) newPage(); mark(it.id, y, y + p.h);
        if(panel){ const top = k === 0 ? y - 2 : y, bot = y + p.h + (k === blk.parts.length - 1 ? 1.5 : 0); doc.setFillColor(...tint(PC, .93)); doc.rect(ML - 3, top, CW + 6, bot - top, "F"); doc.setFillColor(...PC); doc.rect(ML - 3, top, 1.2, bot - top, "F"); }
        p.draw(y); y += p.h; });
      if(panel) y += 2;
      y += it.type === "q" ? QGAP : NGAP;
    }

    if(D.endMarker){
      if(y + 14 > BOTTOM) newPage();
      y += 4;
      font(SANS, "bold", 8.5, ACC_D);
      const s = PT("END OF EXAM"); const w = doc.getTextWidth(s) + s.length * 1.1;
      doc.setDrawColor(...ACC); doc.setLineWidth(.3);
      doc.line(PW / 2 - w / 2 - 30, y, PW / 2 - w / 2 - 6, y); doc.line(PW / 2 + w / 2 + 6, y, PW / 2 + w / 2 + 30, y);
      doc.setFillColor(...ACC); hexagon(PW / 2 - w / 2 - 3.2, y, 1.1, "F"); hexagon(PW / 2 + w / 2 + 3.2, y, 1.1, "F");
      spaced(s, PW / 2, y + 1.1, 1.1);
    }

    // footers
    const N = doc.getNumberOfPages();
    const qPages = N - firstQPage + 1;
    for(let p = firstQPage; p <= N; p++){
      doc.setPage(p);
      font(SANS, "normal", 8, MUTED);
      doc.text("Page " + (p - firstQPage + 1) + PT(" of ") + qPages, PW / 2, PH - 12.6, { align: "center" });
      if(D.school){ doc.setFontSize(7.5); doc.text(fitText(D.school, 55), ML, PH - 12.6); }
      if(D.year){ doc.setFontSize(7.5); doc.text(D.year, PW - MR, PH - 12.6, { align: "right" }); }
    }
  }
  if(opt.resp) respRecord(doc, opt.resp, { font, SANS, INK, MUTED, PW, PH, ML, MR });
  if(rubricPage) pageOf.__rubric = rubricPage;
  if(!opt.rubricOnly && !opt.noCover){ regions.push({ id: "__cover", p: 1, y0: 0, y1: 1e3, x0: 0, x1: 1e3 }); if(rubricPage) regions.push({ id: "__rubric", p: rubricPage, y0: 0, y1: 1e3, x0: 0, x1: 1e3 }); }
  if(opt.rubricOnly && rubricPage){
    for(let p = doc.getNumberOfPages(); p >= 1; p--) if(p !== rubricPage) doc.deletePage(p);
  }else if(opt.noCover && doc.getNumberOfPages() > 1){
    if(rubricPage) doc.deletePage(rubricPage);
    doc.deletePage(1);
    Object.keys(pageOf).forEach(k => pageOf[k] -= rubricPage ? 2 : 1);
    regions.forEach(r => r.p -= rubricPage ? 2 : 1);
  }
  doc.__pageOf = pageOf; doc.__regions = regions; doc.__size = [PW, PH];
  return doc;
}

function fileName(){
  const base = [S.d.subject, S.d.title, S.d.className].filter(Boolean).join(" - ") || "exam";
  return base.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim().slice(0, 90) + ".pdf";
}
let lastBytes = null, pvT = null, pvZoom = 1, pvRun = 0, pvShownPages = 0;
let pvBusy = false, pvAgain = false;
// Fast in-page preview (pdf.js): renders off-screen, swaps in one go, keeps your scroll position.
let pvMap = { regions: [], size: [210, 297] };
// click (or tap) the preview → open that question in the editor, like Overleaf
function pvLocate(c, ev){
  const r = c.getBoundingClientRect(), [PW, PH] = pvMap.size;
  const x = (ev.clientX - r.left) / r.width * PW, y = (ev.clientY - r.top) / r.height * PH, p = +c.dataset.page;
  const on = pvMap.regions.filter(g => g.p === p && x >= g.x0 - 2 && x <= g.x1 + 2);
  const hit = on.filter(g => y >= g.y0 && y <= g.y1);
  if(hit.length) return hit.find(g => !g.id.startsWith("__")) || hit[0];
  // in the gap between two questions: take the nearest one within 8 mm
  let best = null, bd = 8;
  on.forEach(g => { if(g.id.startsWith("__")) return; const d = y < g.y0 ? g.y0 - y : y - g.y1; if(d < bd){ bd = d; best = g; } });
  return best;
}
function jumpToItem(id){
  if(!id) return;
  if(id === "__cover"){ const pnl = document.querySelector('[data-k="title"]').closest(".panel"); pnl.scrollIntoView({ behavior: "smooth", block: "start" }); flash(pnl); setTimeout(() => document.querySelector('[data-k="title"]').focus({ preventScroll: true }), 350); return; }
  if(id === "__rubric"){ const pnl = document.querySelector(".rubric-panel"); pnl.scrollIntoView({ behavior: "smooth", block: "start" }); flash(pnl); return; }
  const card = document.querySelector(`.card[data-id="${id}"]`); if(!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" }); flash(card);
  const f = card.querySelector("textarea[data-f=text],input[data-f=text]");
  if(f) setTimeout(() => f.focus({ preventScroll: true }), 350);
}
function flash(el){ el.classList.remove("jumped"); void el.offsetWidth; el.classList.add("jumped"); setTimeout(() => el.classList.remove("jumped"), 1600); }
document.getElementById("pv").addEventListener("click", ev => {
  const c = ev.target.closest("canvas[data-page]"); if(!c) return;
  const g = pvLocate(c, ev); if(g) jumpToItem(g.id);
});
document.getElementById("pv").addEventListener("mousemove", ev => {
  const c = ev.target.closest("canvas[data-page]"); if(!c) return;
  const g = pvLocate(c, ev); c.style.cursor = g ? "pointer" : "";
  c.title = g ? (g.id === "__cover" ? "Click to edit the exam details" : g.id === "__rubric" ? "Click to edit the rubric" : "Click to edit this in the editor") : "";
});
async function showPreview(bytes, jumpPage){
  const run = ++pvRun;
  if(!window.pdfjsLib){ return; }
  const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0), isEvalSupported: false }).promise;
  if(run !== pvRun){ pdf.destroy(); return; }
  const box = $("#pv");
  const dpr = Math.min(2.5, window.devicePixelRatio || 1);
  const fitW = Math.max(200, box.clientWidth - 26);
  const wrap = document.createElement("div"); wrap.className = "pv-pages";
  for(let i = 1; i <= pdf.numPages; i++){
    const page = await pdf.getPage(i);
    const v1 = page.getViewport({ scale: 1 });
    const cssScale = fitW / v1.width * pvZoom;
    const vp = page.getViewport({ scale: cssScale * dpr });
    const c = document.createElement("canvas");
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    c.style.width = Math.floor(vp.width / dpr) + "px"; c.style.height = Math.floor(vp.height / dpr) + "px";
    c.dataset.page = i;
    await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
    if(run !== pvRun){ pdf.destroy(); return; }
    wrap.appendChild(c);
  }
  pdf.destroy();
  const st = box.scrollTop, sl = box.scrollLeft;
  box.replaceChildren(wrap);
  box.scrollTop = st; box.scrollLeft = sl;
  pvShownPages = wrap.children.length;
  // bring the edited question's page into view, unless it's already on screen
  if(jumpPage){
    const c = wrap.children[jumpPage - 1];
    if(c){
      const top = c.offsetTop - 12, bot = top + c.offsetHeight;
      const vTop = box.scrollTop, vBot = vTop + box.clientHeight;
      if(bot < vTop + 40 || top > vBot - 40) box.scrollTop = top;
    }
  }
}
async function preview(){
  if(pvBusy){ pvAgain = true; return; }
  pvBusy = true;
  try{
    await prepareMath();
    const doc = buildPDF({ key: !!(document.getElementById("pvKey") || {}).checked });
    lastBytes = doc.output("arraybuffer"); pvMap = { regions: doc.__regions || [], size: doc.__size };
    const pg = (lastEdited && doc.__pageOf && doc.__pageOf[lastEdited]) || (lastEdited === null ? 1 : 0);
    await showPreview(lastBytes, pg);
    $("#status").textContent = doc.getNumberOfPages() + " page" + (doc.getNumberOfPages() > 1 ? "s" : "") + " · updated " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }catch(e){ console.error(e); $("#status").textContent = "Preview error: " + e.message; }
  finally{ pvBusy = false; if(pvAgain){ pvAgain = false; preview(); } }
}
function setZoom(z){ pvZoom = Math.max(.5, Math.min(3, z)); $("#zoomLbl").textContent = Math.abs(pvZoom - 1) < .01 ? "Fit" : Math.round(pvZoom * 100) + "%"; if(lastBytes) showPreview(lastBytes, 0); }
$("#zoomIn").onclick = () => setZoom(pvZoom * 1.25);
$("#zoomOut").onclick = () => setZoom(pvZoom / 1.25);
$("#zoomLbl").onclick = () => setZoom(1);
$("#btnOpenTab").onclick = () => { if(!lastBytes) return; const u = URL.createObjectURL(new Blob([lastBytes], { type: "application/pdf" })); window.open(u, "_blank"); setTimeout(() => URL.revokeObjectURL(u), 60000); };
let pvResizeT; new ResizeObserver(() => { clearTimeout(pvResizeT); pvResizeT = setTimeout(() => { if(lastBytes) showPreview(lastBytes, 0); }, 250); }).observe(document.getElementById("pv"));
/* undo / redo — app-wide history of the whole exam */
const H = { stack: [], idx: -1, t: null, restoring: false };
function cloneItem(it){ const c = Object.assign({}, it); if(Array.isArray(it.options)) c.options = it.options.slice(); if(Array.isArray(it.correct)) c.correct = it.correct.slice(); if(it.fmt) c.fmt = Object.assign({}, it.fmt); if(it.pics) c.pics = Object.assign({}, it.pics); if(Array.isArray(it.subs)) c.subs = it.subs.map(x => Object.assign({}, x)); return c; }
function snapSig(d, items){ return JSON.stringify({ d, items: items.map(i => Object.assign({}, i, { img: i.img ? i.img.src.length + ":" + i.img.w + ":" + i.img.h : null, labels: i.labels ? JSON.stringify(i.labels.pts) : 0, graph: i.graph ? JSON.stringify(i.graph) : 0, pics: i.pics ? Object.keys(i.pics).join(",") : 0 })) }); }
function snapOf(){ const d = JSON.parse(JSON.stringify(S.d)), items = S.items.map(cloneItem); return { d, logo: S.logo, items, sig: snapSig(d, items) }; }
function updUndoBtns(){ const u = document.getElementById("btnUndo"), r = document.getElementById("btnRedo"); if(u) u.disabled = !(H.idx > 0 || H.t); if(r) r.disabled = !(H.idx < H.stack.length - 1); }
function histReset(){ clearTimeout(H.t); H.t = null; H.stack = [snapOf()]; H.idx = 0; updUndoBtns(); }
function histCommit(){
  clearTimeout(H.t); H.t = null;
  const sn = snapOf(); const cur = H.stack[H.idx];
  if(cur && cur.sig === sn.sig){ updUndoBtns(); return; }
  H.stack = H.stack.slice(0, H.idx + 1); H.stack.push(sn);
  if(H.stack.length > 300) H.stack.shift();
  H.idx = H.stack.length - 1; updUndoBtns();
}
function histSchedule(){ if(H.restoring) return; clearTimeout(H.t); H.t = setTimeout(histCommit, 650); updUndoBtns(); }
function restoreSnap(sn){
  // remember where the cursor was
  const ae = document.activeElement, card = ae && ae.closest ? ae.closest(".card") : null;
  const foc = card ? { id: card.dataset.id, f: ae.dataset.f, o: ae.dataset.opt, s: ae.selectionStart } : (ae && ae.dataset && ae.dataset.k ? { k: ae.dataset.k, s: ae.selectionStart } : null);
  H.restoring = true;
  S.d = JSON.parse(JSON.stringify(sn.d)); S.logo = sn.logo; S.items = sn.items.map(cloneItem);
  refreshDetails(); updateLogoUI(); render(); changed();
  H.restoring = false;
  if(foc){
    let el = foc.k ? document.querySelector(`[data-k="${foc.k}"]`) : document.querySelector(`.card[data-id="${foc.id}"] ${foc.o != null ? `input[data-opt="${foc.o}"]` : `[data-f="${foc.f}"]`}`);
    if(!el && foc.id){ el = document.querySelector(`.card[data-id="${foc.id}"] textarea`); }
    if(el){ el.focus(); try{ const p = Math.min(foc.s ?? el.value.length, el.value.length); el.setSelectionRange(p, p); }catch(_){} }
  }
  updUndoBtns();
}
function undo(){ if(H.t) histCommit(); if(H.idx > 0){ H.idx--; restoreSnap(H.stack[H.idx]); toast("Undone"); } }
function redo(){ if(H.t) histCommit(); if(H.idx < H.stack.length - 1){ H.idx++; restoreSnap(H.stack[H.idx]); toast("Redone"); } }
document.addEventListener("keydown", e => {
  if(!(e.ctrlKey || e.metaKey) || e.altKey) return;
  const k = (e.key || "").toLowerCase(); if(k !== "z" && k !== "y") return;
  const t = e.target;
  if(t && t.closest && (t.closest(".modal.open") || t.closest("math-field"))) return;   // dialogs keep their own undo
  e.preventDefault(); e.stopPropagation();
  if(k === "y" || e.shiftKey) redo(); else undo();
}, true);

function changed(){
  histSchedule(); saveLocal(); clearTimeout(pvT); $("#status").textContent = "updating…"; pvT = setTimeout(preview, 400); }
async function download(opt){
  opt = opt || {};
  const name = (opt.name || fileName().replace(/\.pdf$/, "")) + (opt.version ? " - Version " + opt.version : "") + (opt.dys ? " (dyslexia-friendly)" : "") + (opt.key ? " (answer key)" : "") + (opt.coverOnly ? " (cover page)" : opt.rubricOnly ? " (rubric)" : opt.noCover ? " (questions)" : "") + ((opt.large || S.d.largePrint) ? " (large print)" : "") + ".pdf";
  const miss = missingPics();
  if(miss && !confirm(`${miss === 1 ? "1 picture is" : miss + " pictures are"} still missing (the red boxes in the preview).\n\nDownload anyway? They will print as an empty frame with the description.`)) return;
  try{ await prepareMath(); if(opt.dys) await ensureEasyFonts(); buildPDF(Object.assign({ final: true }, opt)).save(name); toast("Saved " + name); }
  catch(e){ console.error(e); toast("Couldn't create the PDF: " + e.message); }
}
