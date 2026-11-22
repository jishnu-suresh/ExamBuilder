/* ---------------- images ---------------- */
function readAsDataURL(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
function loadImg(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
async function fileToBitmap(file){
  if(window.createImageBitmap){
    try{ return await createImageBitmap(file, { imageOrientation: "from-image" }); }catch(e){}
  }
  return await loadImg(await readAsDataURL(file));
}
// smaller files: pictures are stored no bigger than print needs, as PNG for drawings and JPEG when that is much smaller (photos, scans)
function fitCanvas(c, maxSide){
  const k = Math.min(1, maxSide / Math.max(c.width, c.height)); if(k >= 1) return c;
  const o = document.createElement("canvas"); o.width = Math.round(c.width * k); o.height = Math.round(c.height * k);
  const g = o.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(c, 0, 0, o.width, o.height); return o;
}
function encodeBest(c){
  const png = c.toDataURL("image/png"); if(png.length < 400e3) return png;
  const jpg = c.toDataURL("image/jpeg", .9); return jpg.length < png.length * .5 ? jpg : png;
}
function drawToJpeg(src, w, h, maxSide, rotate){
  const sc = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.round(w * sc), th = Math.round(h * sc);
  const rot = ((rotate || 0) % 360 + 360) % 360;
  const c = document.createElement("canvas");
  c.width = rot % 180 ? th : tw; c.height = rot % 180 ? tw : th;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2); g.rotate(rot * Math.PI / 180);
  g.drawImage(src, -tw / 2, -th / 2, tw, th);
  return { src: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height };
}
async function imageFileToData(file){
  let bmp;
  try{ bmp = await fileToBitmap(file); }
  catch(e){ throw new Error("This browser can't open " + file.name + (/\.hei[cf]$/i.test(file.name) ? " (HEIC photo — export it as JPG first)" : "")); }
  return drawToJpeg(bmp, bmp.width, bmp.height, 1600, 0);   // ≈240 dpi across an A4 page: plenty for print
}
async function rotateImg(img){
  const i = await loadImg(img.src);
  return drawToJpeg(i, i.naturalWidth, i.naturalHeight, 1600, 90);
}

/* ---------------- adding content ---------------- */
// files BEE can't read: they would be read as text and freeze the page
function fileKind(f){
  const n = (f && f.name || "").toLowerCase(), t = (f && f.type || "").toLowerCase();
  if(t === "application/pdf" || /\.pdf$/.test(n)) return "PDF";
  if(/\.(docx?|odt|rtf|pages)$/.test(n) || /wordprocessing|msword|opendocument\.text|rtf/.test(t)) return "Word document";
  if(/\.(pptx?|odp|key)$/.test(n) || /presentation|powerpoint/.test(t)) return "presentation";
  if(/\.(xlsx?|ods|numbers|csv)$/.test(n) && !/\.csv$/.test(n) || /spreadsheet|excel/.test(t)) return "spreadsheet";
  if(/\.(zip|rar|7z|epub|exe|dmg|mp4|mov|mp3|wav)$/.test(n)) return "file";
  return null;
}
function showBlocked(kind, names){
  const pdf = kind === "PDF";
  $("#pdfTitle").textContent = pdf ? "📄 BEE can't open PDF files" : "📄 BEE can't open this " + kind;
  $("#pdfWhy").textContent = pdf
    ? "A PDF is made for printing, so BEE can't take the questions out of it. Your AI tool can do that in a few seconds, using BEE's ready-made prompt:"
    : "BEE reads typed text, photos and its own project files. For a " + kind + ", let your AI tool convert it with BEE's ready-made prompt" + (kind === "Word document" ? " (or copy all the text from Word and paste it into BEE)" : "") + ":";
  document.querySelectorAll(".pdf-kind").forEach(el => el.textContent = kind === "file" ? "file" : kind);
  $("#pdfFiles").textContent = names && names.length ? "Not opened: " + names.join(", ") : "";
  $("#pdfKept").parentElement.classList.toggle("hidden", !pdf);
  openModal("#pdfModal");
}
document.getElementById("pdfCopyIxl").onclick = e => copyPrompt("ixl", e.currentTarget);
document.getElementById("pdfCopy").onclick = async () => {
  try{ await navigator.clipboard.writeText(USER_AI_PROMPT); toast("Prompt copied — paste it into your AI chat with the file attached"); $("#pdfCopy").textContent = "✓ Copied"; setTimeout(() => $("#pdfCopy").textContent = "📋 Copy the AI prompt", 2500); }
  catch(_){ $("#pdfModal").classList.remove("open"); $("#pasteText").click(); toast("Copy the prompt from the box at the top"); }
};
document.getElementById("pdfPaste").onclick = () => { $("#pdfModal").classList.remove("open"); $("#pasteText").click(); };
async function handleFiles(files){
  // stop PDFs, Word files… before anything tries to read them
  const blocked = files.filter(f => fileKind(f));
  const pdf = blocked.find(f => fileKind(f) === "PDF");
  if(pdf) loadPdfSource(pdf).catch(() => {});
  if(blocked.length){ showBlocked(fileKind(blocked[0]), blocked.map(f => f.name)); files = files.filter(f => !fileKind(f)); if(!files.length) return; }
  let added = 0; const newPhotos = [];
  for(const f of files){
    try{
      if(/^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|bmp|heic|heif)$/i.test(f.name)){
        const img = await imageFileToData(f);
        const it = { id: nid(), type: "q", text: "", marks: "", lines: "", img, imgSize: 100 };
        S.items.push(it); newPhotos.push(it.id);
        added++;
      }else{
        if(f.size > 3e6){ showBlocked("file", [f.name + " (too big for a text file)"]); continue; }
        const txt = await f.text();
        if(/\u0000|\uFFFD{4,}/.test(txt.slice(0, 4000)) || /^%PDF-/.test(txt)){ showBlocked(/^%PDF-/.test(txt) ? "PDF" : "file", [f.name]); continue; }
        const DR = await takeDrawings(txt);
        const items = parseText(DR.text); attachPics(items, DR.pics);
        const said = applyExtras(extractExtras(DR.text));
        if(said.length) setTimeout(() => toast(said.join(" · ")), 1600);
        if(!items.length){ if(!said.length) toast(f.name + " looks empty"); continue; }
        S.items.push(...items); added += items.length;
      }
    }catch(e){ toast(e.message || ("Couldn't read " + f.name)); }
  }
  if(added){ const L = S.items[S.items.length - added]; if(L) lastEdited = L.id; render(); changed(); toast("Added " + added + " item" + (added > 1 ? "s" : "")); }
  const pm = photoModeNow();                       // a one-time choice from the photo question is used once, then forgotten
  if(newPhotos.length && pm === "offline") queueOcr(newPhotos);
}

/* ---------------- numbering & totals ---------------- */
function computeMeta(){
  const meta = {}; let n = 0; let curSec = null;
  const secs = []; let looseMarks = 0;
  for(const it of S.items){
    if(it.type === "section"){
      if(S.d.restartNumbering) n = 0;
      curSec = { item: it, qsum: 0 }; secs.push(curSec);
    }else if(it.type === "q"){
      if(it.nonum) meta[it.id] = ""; else { n++; meta[it.id] = n; }
      if(curSec) curSec.qsum += qMarks(it); else looseMarks += qMarks(it);
    }
  }
  secs.forEach(s => { s.total = s.item.marks !== "" && s.item.marks != null && num(s.item.marks) > 0 ? num(s.item.marks) : s.qsum; meta[s.item.id] = s.total; });
  const auto = looseMarks + secs.reduce((a, s) => a + s.total, 0);
  const total = S.d.totalOverride !== "" && S.d.totalOverride != null ? num(S.d.totalOverride) : auto;
  return { meta, secs, auto, total, looseMarks, qCount: n };
}
