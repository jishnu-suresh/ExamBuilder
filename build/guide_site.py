"""📖 The illustrated teacher guide: app/guide/pages/*.html (+ the clips in app/guide/media) → docs/guide/.

A page is plain HTML, plus four tags of our own:
  <clip name="add_mcq">Caption</clip>                 a looping screen recording (plays when on screen)
  <step clip="add_mcq" title="Add a question">…</step>  a numbered step: words on the left, the clip on the right
  <shot name="start_screen">Caption</shot>           a still picture
  <screenmap/>                                        the main screen with numbered pins (welcome page)
"""
import html, json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "guide")

PAGES = [  # slug, emoji, title, one line for the welcome page
    ("index", "🐝", "Welcome", "What BEE is, and a map of the screen"),
    ("start", "🚀", "Getting started", "Open BEE, start an exam, take the tour"),
    ("first-exam", "✏️", "Your first exam", "From an empty page to a printed paper in 5 steps"),
    ("questions", "📝", "Writing questions", "Maths, parts (a)(b), answer space, model answers"),
    ("insert", "🖼", "Tables, graphs & pictures", "Insert anything a question needs"),
    ("ai-photos", "🤖", "From AI, photos & files", "Bring in questions you already have"),
    ("paper", "🎨", "Make the paper yours", "Look, printing, rubric, large print, versions A–D"),
    ("saving", "💾", "Saving & going back", "Where your work is, undo and earlier versions"),
    ("computer", "💻", "Exams on computers", "Make the file, run the exam, mark the answers"),
    ("students", "🧑‍🎓", "What students see", "Answer boxes, maths, drawing and reading help"),
    ("read-aloud", "🔊", "Read aloud", "The computer voice, or your own voice"),
    ("calculator", "🧮", "Calculator", "BEEcalc Basic, Scientific, Graphing, and Desmos"),
    ("help", "🛟", "Help & tips", "If something goes wrong, and how to tell Jishnu"),
]

CSS = r"""
:root{--ink:#24211C;--muted:#6E665A;--gold:#B5892E;--gold-d:#8A6418;--gold-l:#FBF3DF;--line:#E8E0D0;--paper:#FFFDF8;--bg:#F6F1E6}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:70px}
body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
a{color:var(--gold-d)}
.top{position:sticky;top:0;z-index:20;background:rgba(255,253,248,.94);backdrop-filter:blur(6px);border-bottom:1px solid var(--line);display:flex;align-items:center;gap:14px;padding:10px 22px}
.top .brand{font:700 21px Georgia,serif;color:var(--ink);text-decoration:none;display:flex;align-items:center;gap:8px}
.top .brand small{font:600 11px system-ui;letter-spacing:.18em;color:var(--gold);text-transform:uppercase}
.top .grow{flex:1}
.top .open-bee{background:var(--gold);color:#fff;text-decoration:none;font-weight:600;padding:7px 14px;border-radius:9px;font-size:15px;white-space:nowrap}
.top .menu{display:none;border:1px solid var(--line);background:#fff;border-radius:9px;padding:6px 11px;font:inherit;cursor:pointer}
.wrap{display:grid;grid-template-columns:270px minmax(0,1fr);max-width:1320px;margin:0 auto;gap:28px;padding:22px}
nav.side{position:sticky;top:76px;align-self:start;max-height:calc(100vh - 96px);overflow:auto;padding-right:4px}
nav.side a{display:flex;gap:10px;align-items:center;padding:8px 11px;border-radius:10px;color:var(--ink);text-decoration:none;font-size:15.5px;line-height:1.3}
nav.side a .e{width:24px;text-align:center;flex:none}
nav.side a:hover{background:#fff}
nav.side a.on{background:var(--gold-l);font-weight:650;box-shadow:inset 3px 0 0 var(--gold)}
nav.side .toc{margin:2px 0 8px 45px;border-left:2px solid var(--line);padding-left:10px}
nav.side .toc a{font-size:13.5px;padding:3px 6px;color:var(--muted)}
main{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:38px 48px 46px;box-shadow:0 6px 24px rgba(60,45,20,.07);min-width:0}
h1{font:700 36px/1.15 Georgia,serif;margin:0 0 6px;display:flex;align-items:center;gap:12px}
h1 .e{font-size:34px}
.lead{color:var(--muted);font-size:19px;margin:0 0 26px}
h2{font:700 25px/1.25 Georgia,serif;margin:46px 0 12px;padding-top:18px;border-top:1px solid var(--line)}
h3{font-size:19px;margin:26px 0 8px}
p{margin:0 0 12px}
code{background:#F3EDE0;border-radius:5px;padding:1px 6px;font-size:.9em}
kbd{border:1px solid var(--line);border-bottom-width:2px;background:#fff;border-radius:6px;padding:0 6px;font:600 .88em system-ui}
.btn{display:inline-block;border:1px solid var(--line);background:#fff;border-radius:7px;padding:0 7px;font-weight:600;white-space:nowrap;font-size:.92em}
.tip,.note,.warn{border-radius:12px;padding:12px 16px;margin:16px 0;display:flex;gap:12px}
.tip{background:#EEF6EC;border:1px solid #CFE3C9}.note{background:var(--gold-l);border:1px solid #EBDDBA}.warn{background:#FCEDEA;border:1px solid #F0CFC8}
.tip::before{content:"💡"}.note::before{content:"🐝"}.warn::before{content:"⚠️"}
.tip>div,.note>div,.warn>div{flex:1}
table{border-collapse:collapse;width:100%;margin:12px 0 16px;font-size:15.5px}
th,td{border:1px solid var(--line);padding:8px 11px;text-align:left;vertical-align:top}
th{background:var(--gold-l)}
figure.clip,figure.shot{margin:16px 0 22px}
.media{position:relative;border-radius:12px;overflow:hidden;border:1px solid var(--line);background:#EEE8DA;box-shadow:0 8px 24px rgba(60,45,20,.12);cursor:zoom-in}
.media video,.media img{display:block;width:100%;height:auto}
.media .play{position:absolute;inset:0;margin:auto;width:64px;height:64px;border-radius:50%;background:rgba(36,33,28,.75);color:#fff;border:0;font-size:24px;display:none;cursor:pointer}
.media.paused .play{display:block}
.media .badge{position:absolute;left:10px;top:10px;background:rgba(36,33,28,.72);color:#fff;font:600 12px system-ui;padding:2px 8px;border-radius:20px;opacity:.85}
figcaption{color:var(--muted);font-size:14.5px;margin-top:8px;text-align:center}
.step{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,8fr);gap:26px;align-items:start;margin:24px 0 34px}
.step .txt{position:relative;padding-left:52px}
.step .num{position:absolute;left:0;top:0;width:38px;height:38px;border-radius:50%;background:var(--gold);color:#fff;font:700 18px Georgia,serif;display:flex;align-items:center;justify-content:center}
.step h3{margin:4px 0 8px}
.step figure{margin:0}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;margin:18px 0}
.card{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;color:var(--ink);text-decoration:none;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-3px);box-shadow:0 10px 24px rgba(60,45,20,.12)}
.card img{width:100%;aspect-ratio:16/10;object-fit:cover;object-position:top left;display:block;border-bottom:1px solid var(--line)}
.card div{padding:10px 14px 13px}
.card b{display:block;font-size:16.5px}
.card span{color:var(--muted);font-size:14px;line-height:1.35;display:block;margin-top:2px}
.map{position:relative;margin:14px 0 8px}
.map .pin{position:absolute;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;background:#C0392B;color:#fff;font:700 15px system-ui;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 4px rgba(255,255,255,.85),0 4px 10px rgba(0,0,0,.25);cursor:pointer}
.map .pin:hover,.map .pin.on{background:var(--gold-d)}
ol.legend{columns:2;column-gap:30px;padding-left:22px;margin:10px 0 20px}
ol.legend li{margin:0 0 8px;break-inside:avoid}
ol.legend li.on{background:var(--gold-l);border-radius:6px}
.pager{display:flex;justify-content:space-between;gap:14px;margin-top:46px;padding-top:20px;border-top:1px solid var(--line)}
.pager a{flex:1;max-width:48%;border:1px solid var(--line);background:#fff;border-radius:12px;padding:12px 16px;text-decoration:none;color:var(--ink)}
.pager a small{display:block;color:var(--muted);font-size:13px}
.pager a.next{text-align:right;margin-left:auto}
.hero{display:grid;grid-template-columns:minmax(0,4fr) minmax(0,6fr);gap:30px;align-items:center;margin:6px 0 10px}
.foot{max-width:1320px;margin:0 auto;padding:6px 22px 30px;color:var(--muted);font-size:14px;text-align:center}
#lb{position:fixed;inset:0;z-index:100;background:rgba(20,18,14,.9);display:none;align-items:center;justify-content:center;padding:3vw;cursor:zoom-out}
#lb.on{display:flex}
#lb video,#lb img{max-width:100%;max-height:100%;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
@media (max-width:980px){.wrap{grid-template-columns:1fr;padding:12px}nav.side{display:none;position:static;max-height:none}nav.side.open{display:block}.top .menu{display:block}main{padding:24px 20px}.step,.hero{grid-template-columns:1fr}ol.legend{columns:1}h1{font-size:30px}}
@media print{.top,nav.side,.pager,.media .play,.media .badge{display:none!important}.wrap{display:block;padding:0}main{border:0;box-shadow:none;padding:0}video{display:none!important}.media img.poster{display:block!important}.step,figure{break-inside:avoid}}
.media img.poster{display:none}
"""

JS = r"""
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vids = [...document.querySelectorAll(".media video")];
  const io = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target, m = v.parentElement;
    if (e.isIntersecting && e.intersectionRatio > .45) { if (!still && !m.dataset.stopped) { v.play().catch(() => m.classList.add("paused")); } }
    else v.pause();
  }), { threshold: [0, .45, .9] });
  vids.forEach(v => { if (still) v.parentElement.classList.add("paused"); io.observe(v); });
  // ▶ on a paused clip plays it; a click on a playing clip opens it big
  const lb = document.getElementById("lb");
  document.addEventListener("click", e => {
    const p = e.target.closest(".media .play");
    if (p) { const m = p.parentElement, v = m.querySelector("video"); delete m.dataset.stopped; m.classList.remove("paused"); v.play(); return; }
    const m = e.target.closest(".media");
    if (m) {
      const v = m.querySelector("video"), i = m.querySelector("img:not(.poster)");
      lb.innerHTML = ""; const el = v ? Object.assign(document.createElement("video"), { src: v.currentSrc || v.src, muted: true, loop: true, autoplay: true, playsInline: true, controls: true }) : Object.assign(document.createElement("img"), { src: i.src, alt: i.alt });
      if (v) { el.currentTime = v.currentTime; }
      lb.appendChild(el); lb.classList.add("on"); return;
    }
    if (e.target === lb || e.target.closest("#lb") && e.target.tagName !== "VIDEO") { lb.classList.remove("on"); lb.innerHTML = ""; }
    const pin = e.target.closest(".pin");
    if (pin) { document.querySelectorAll(".pin,.legend li").forEach(x => x.classList.remove("on")); pin.classList.add("on"); const li = document.getElementById("pin-" + pin.dataset.n); if (li) { li.classList.add("on"); li.scrollIntoView({ block: "nearest", behavior: "smooth" }); } }
  });
  addEventListener("keydown", e => { if (e.key === "Escape") { lb.classList.remove("on"); lb.innerHTML = ""; } });
  const mb = document.querySelector(".top .menu"); if (mb) mb.onclick = () => document.querySelector("nav.side").classList.toggle("open");
})();
"""

MAP = [  # pin → label (welcome page)
    ("details", "<b>1 · Exam details</b>: title, subject, time, instructions. Folds to one line once filled in."),
    ("questions", "<b>2 · Questions</b>: every question, part and text of the paper, in order."),
    ("preview", "<b>3 · Preview</b>: the real PDF, updated as you type. Tick <b>Key</b> for the answer key."),
    ("save", "<b>Save light</b>: green = saved in your file; orange = only in this browser."),
    ("mode", "<b>🍯🐝 / 🌱</b>: all options, or Basic mode with only the everyday buttons."),
    ("undo", "<b>↩️ ↪️</b>: undo and redo."),
    ("history", "<b>🕰️ History</b>: earlier versions BEE kept while you worked."),
    ("file", "<b>📁 File</b>: new, open, save as."),
    ("download", "<b>⬇ Download</b>: the paper, the key, large print, versions, the computer version."),
]


def _media(name, cap="", kind="clip"):
    cap_html = f"<figcaption>{cap}</figcaption>" if cap.strip() else ""
    if kind == "shot":
        return f'<figure class="shot"><div class="media"><img src="media/{name}.jpg" alt="{html.escape(re.sub("<[^>]+>", "", cap))}" loading="lazy"></div>{cap_html}</figure>'
    return (f'<figure class="clip"><div class="media"><video src="media/{name}.mp4" poster="media/{name}.jpg" muted loop playsinline preload="none" '
            f'aria-label="{html.escape(re.sub("<[^>]+>", "", cap))}"></video><img class="poster" src="media/{name}.jpg" alt="" loading="lazy">'
            f'<button class="play" aria-label="Play">▶</button><span class="badge">▶ clip</span></div>{cap_html}</figure>')


def _expand(body):
    n = [0]
    def step(m):
        n[0] += 1
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        clip = _media(attrs["clip"], attrs.get("cap", "")) if attrs.get("clip") else (_media(attrs["shot"], attrs.get("cap", ""), "shot") if attrs.get("shot") else "")
        return f'<div class="step"><div class="txt"><span class="num">{n[0]}</span><h3>{attrs.get("title", "")}</h3>{m.group(2)}</div><div>{clip}</div></div>'
    body = re.sub(r"<h2([^>]*)>", lambda m: (n.__setitem__(0, 0) or f"<h2{m.group(1)}>"), body)   # steps count again in each section
    body = re.sub(r"<step\s([^>]*)>(.*?)</step>", step, body, flags=re.S)
    body = re.sub(r'<clip name="([^"]+)">(.*?)</clip>', lambda m: _media(m.group(1), m.group(2)), body, flags=re.S)
    body = re.sub(r'<shot name="([^"]+)">(.*?)</shot>', lambda m: _media(m.group(1), m.group(2), "shot"), body, flags=re.S)
    if "<screenmap/>" in body:
        pos = json.load(open(os.path.join(SRC, "media", "editor_map.json")))
        pins = "".join(f'<span class="pin" data-n="{i + 1}" style="left:{pos[k][0]}%;top:{pos[k][1]}%" title="{html.escape(re.sub("<[^>]+>", "", t))}">{i + 1}</span>' for i, (k, t) in enumerate(MAP) if k in pos)
        legend = "".join(f'<li id="pin-{i + 1}">{t}</li>' for i, (k, t) in enumerate(MAP))
        body = body.replace("<screenmap/>", f'<div class="map"><div class="media"><img src="media/editor_map.jpg" alt="BEE\'s main screen"></div>{pins}</div><ol class="legend">{legend}</ol>')
    return body


def _cards():
    out = []
    for slug, e, t, line in PAGES[1:]:
        img = {"start": "start_screen", "first-exam": "add_mcq", "questions": "q_subparts", "insert": "ins_row", "ai-photos": "ai_paste", "paper": "look",
               "saving": "save_chip", "computer": "stu_dialog", "students": "stu_draw", "read-aloud": "read_computer", "calculator": "calc_curves", "help": "editor_map"}[slug]
        out.append(f'<a class="card" href="{slug}.html"><img src="media/{img}.jpg" alt="" loading="lazy"><div><b>{e} {t}</b><span>{line}</span></div></a>')
    return '<div class="cards">' + "".join(out) + "</div>"


def page(i, version):
    slug, e, title, line = PAGES[i]
    body = open(os.path.join(SRC, "pages", slug + ".html"), encoding="utf-8").read()
    body = body.replace("<chapters/>", _cards())
    body = _expand(body)
    heads = re.findall(r'<h2 id="([^"]+)"[^>]*>(.*?)</h2>', body)
    nav = []
    for k, (s2, e2, t2, _) in enumerate(PAGES):
        nav.append(f'<a href="{s2}.html" class="{"on" if k == i else ""}"><span class="e">{e2}</span>{t2}</a>')
        if k == i and heads:
            nav.append('<div class="toc">' + "".join(f'<a href="#{h}">{re.sub("<[^>]+>", "", t)}</a>' for h, t in heads) + "</div>")
    prev = f'<a href="{PAGES[i - 1][0]}.html"><small>← Back</small>{PAGES[i - 1][1]} {PAGES[i - 1][2]}</a>' if i > 0 else ""
    nxt = f'<a class="next" href="{PAGES[i + 1][0]}.html"><small>Next →</small>{PAGES[i + 1][1]} {PAGES[i + 1][2]}</a>' if i < len(PAGES) - 1 else ""
    head_title = "BEE teacher guide" if slug == "index" else f"{title} · BEE teacher guide"
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{head_title}</title><meta name="description" content="{html.escape(line)}"><link rel="icon" href="../icons/bee-favicon-32.png">
<style>{CSS}</style></head><body>
<header class="top"><button class="menu" aria-label="Chapters">☰</button><a class="brand" href="index.html">🐝 BEE <small>Teacher guide</small></a><span class="grow"></span><a class="open-bee" href="../" target="_blank" rel="noopener">Open BEE →</a></header>
<div class="wrap"><nav class="side" aria-label="Chapters">{"".join(nav)}</nav>
<main><h1><span class="e">{e}</span>{title}</h1><p class="lead">{line}</p>
{body}
<div class="pager">{prev}{nxt}</div></main></div>
<div class="foot">🐝 BEE {version} · Build • Edit • Evaluate · © Jishnu · <a href="https://forms.cloud.microsoft/r/KXXUcfCRvs" target="_blank" rel="noopener">💬 Feedback</a></div>
<div id="lb" aria-hidden="true"></div>
<script>{JS}</script></body></html>"""


def build(out_dir, version):
    """write docs/guide/*.html and copy the clips"""
    g = os.path.join(out_dir, "guide"); md = os.path.join(g, "media")
    os.makedirs(md, exist_ok=True)
    for i, (slug, *_r) in enumerate(PAGES):
        open(os.path.join(g, slug + ".html"), "w", encoding="utf-8").write(page(i, version))
    want = set()
    for f in sorted(os.listdir(os.path.join(SRC, "media"))):
        if f.endswith((".mp4", ".jpg")):
            want.add(f); src, dst = os.path.join(SRC, "media", f), os.path.join(md, f)
            if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(src): shutil.copyfile(src, dst)
    for f in os.listdir(md):
        if f not in want: os.remove(os.path.join(md, f))
    return [p[0] for p in PAGES]
