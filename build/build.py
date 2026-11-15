#!/usr/bin/env python3
"""Builds Exam Builder.
  docs/                          -> installable web app (GitHub Pages serves this folder)
  docs/download/Exam_Builder_offline.html -> single-file version (works from a USB stick, no install)
Usage:  build/fetch_vendor.sh   (once)   then   python3 build/build.py
"""
import base64, hashlib, json, os, re, shutil
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = os.path.join(ROOT, ".vendor"); A = os.path.join(ROOT, "assets"); OUT = os.path.join(ROOT, "docs")
rd = lambda p: open(p, encoding="utf-8").read()
b64 = lambda p: base64.b64encode(open(p, "rb").read()).decode()
src = rd(os.path.join(ROOT, "app", "app.html"))
logo = os.path.join(A, "logo.png"); LW, LH = Image.open(logo).size
common = {"__LOGO__": "data:image/png;base64," + b64(logo), "__LOGO_W__": str(LW), "__LOGO_H__": str(LH)}

def mathlive_css(inline):
    css = rd(os.path.join(V, "mathlive", "mathlive-fonts.css"))
    if inline:
        return re.sub(r"url\((?:\./)?fonts/([^)]+)\)", lambda m: "url(data:font/woff2;base64," + b64(os.path.join(V, "mathlive", "fonts", m.group(1))) + ")", css)
    return css

def fill(s, rep):
    for k, v in rep.items():
        assert k in s, k
        s = s.replace(k, v)
    return s

# ---------------------------------------------------------------- single file
single = dict(common)
single.update({
    "<!--__PWA_HEAD__-->": "",
    "/*__JSPDF__*/": rd(os.path.join(V, "jspdf", "jspdf.umd.min.js")).replace("</script", "<\\/script"),
    "__FONT_R__": b64(os.path.join(A, "DejaVuSans.ttf")), "__FONT_B__": b64(os.path.join(A, "DejaVuSans-Bold.ttf")), "__FONT_I__": b64(os.path.join(A, "DejaVuSans-Oblique.ttf")),
    "/*__TESS_LIB__*/": rd(os.path.join(V, "ocr", "tesseract.min.js")),
    "__TESS_WORKER__": rd(os.path.join(V, "ocr", "worker.min.js")),
    "__TESS_CORE__": rd(os.path.join(V, "ocr", "tesseract-core-simd-lstm.wasm.js")),
    "__TESS_ENG__": b64(os.path.join(V, "ocr", "lang", "eng.traineddata.gz")),
    "/*__MATHJAX__*/": rd(os.path.join(V, "mathjax", "tex-svg-full.js")).replace("/<!--.*?-->/g", "/<\\!--.*?-->/g"),
    "/*__MATHLIVE__*/": rd(os.path.join(V, "mathlive", "mathlive.min.js")),
    "/*__MLFONTS__*/": mathlive_css(True),
    "/*__SORTABLE__*/": rd(os.path.join(V, "sortable", "Sortable.min.js")),
    "/*__PDFJS__*/": rd(os.path.join(V, "pdfjs", "pdf.min.js")),
    "__PDFJS_WORKER__": rd(os.path.join(V, "pdfjs", "pdf.worker.min.js")),
})
single_html = fill(src, single)

# ---------------------------------------------------------------- web app (PWA)
# keep hand-made demo files across rebuilds
DEMO = os.path.join(ROOT, "demo")
if os.path.isdir(OUT): shutil.rmtree(OUT)
os.makedirs(OUT)
if os.path.isdir(DEMO): shutil.copytree(DEMO, os.path.join(OUT, "demo"))
def cp(rel_src, rel_dst):
    d = os.path.join(OUT, rel_dst); os.makedirs(os.path.dirname(d), exist_ok=True); shutil.copy(os.path.join(V, rel_src), d)
cp("jspdf/jspdf.umd.min.js", "vendor/jspdf.umd.min.js")
cp("mathjax/tex-svg-full.js", "vendor/mathjax/tex-svg-full.js")
cp("mathlive/mathlive.min.js", "vendor/mathlive/mathlive.min.js")
open(os.path.join(OUT, "vendor/mathlive/fonts.css"), "w").write(mathlive_css(True))
cp("sortable/Sortable.min.js", "vendor/sortable.min.js")
cp("pdfjs/pdf.min.js", "vendor/pdfjs/pdf.min.js"); cp("pdfjs/pdf.worker.min.js", "vendor/pdfjs/pdf.worker.min.js")
for f in ["tesseract.min.js", "worker.min.js", "tesseract-core-simd-lstm.wasm.js"]: cp("ocr/" + f, "vendor/ocr/" + f)
cp("ocr/lang/eng.traineddata.gz", "vendor/ocr/lang/eng.traineddata.gz")
open(os.path.join(OUT, "vendor/fonts.js"), "w").write("window.__FONTS__=" + json.dumps({"r": b64(os.path.join(A, "DejaVuSans.ttf")), "b": b64(os.path.join(A, "DejaVuSans-Bold.ttf")), "i": b64(os.path.join(A, "DejaVuSans-Oblique.ttf"))}) + ";")

# icons from the hexagon mark
os.makedirs(os.path.join(OUT, "icons"))
mark = Image.open(os.path.join(A, "logo-mark.png")).convert("RGBA")
def icon(size, pad, bg, name, round_=False):
    im = Image.new("RGBA", (size, size), bg)
    m = mark.copy(); inner = int(size * (1 - 2 * pad)); m.thumbnail((inner, inner), Image.LANCZOS)
    im.alpha_composite(m, ((size - m.width) // 2, (size - m.height) // 2))
    if round_:
        from PIL import ImageDraw
        mask = Image.new("L", (size, size), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=255)
        im.putalpha(mask)
    im.save(os.path.join(OUT, "icons", name))
BG = (250, 247, 240, 255)
icon(192, .14, BG, "icon-192.png", True); icon(512, .14, BG, "icon-512.png", True)
icon(512, .24, BG, "maskable-512.png"); icon(180, .12, BG, "apple-touch-icon.png"); icon(32, .06, (0, 0, 0, 0), "favicon-32.png")

manifest = {
    "name": "Exam Builder", "short_name": "Exam Builder", "id": "./", "start_url": "./", "scope": "./",
    "display": "standalone", "display_override": ["window-controls-overlay", "standalone"],
    "background_color": "#FAF7F0", "theme_color": "#FAF7F0",
    "description": "Create formatted exam papers (PDF) from typed questions, photos, maths, science and AI output. Works offline.",
    "icons": [{"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png"},
              {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png"},
              {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
    "file_handlers": [{"action": "./", "accept": {"application/json": [".json"]}, "icons": [{"src": "icons/icon-192.png", "sizes": "192x192"}], "launch_type": "single-client"}],
    "launch_handler": {"client_mode": "focus-existing"},
    "categories": ["education", "productivity"]
}
open(os.path.join(OUT, "manifest.webmanifest"), "w").write(json.dumps(manifest, indent=2))

head = """<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#FAF7F0">
<meta name="application-name" content="Exam Builder">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Exam Builder">
<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<script>window.__PWA__ = true;</script>"""
pwa = dict(common)
pwa.update({
    "<!--__PWA_HEAD__-->": head,
    "<script>/*__JSPDF__*/</script>": '<script src="vendor/jspdf.umd.min.js"></script>',
    "__FONT_R__": "", "__FONT_B__": "", "__FONT_I__": "",
    "<script>/*__TESS_LIB__*/</script>": "",
    '<script type="text/plain" id="tess-worker">__TESS_WORKER__</script>': "",
    '<script type="text/plain" id="tess-core">__TESS_CORE__</script>': "",
    '<script type="text/plain" id="tess-eng">__TESS_ENG__</script>': "",
    "<script>/*__MATHJAX__*/</script>": '<script src="vendor/mathjax/tex-svg-full.js"></script>',
    "<script>/*__MATHLIVE__*/</script>": '<script src="vendor/mathlive/mathlive.min.js"></script>',
    "<style>/*__MLFONTS__*/</style>": '<link rel="stylesheet" href="vendor/mathlive/fonts.css">',
    "<script>/*__SORTABLE__*/</script>": '<script src="vendor/sortable.min.js"></script>',
    "<script>/*__PDFJS__*/</script>": '<script src="vendor/pdfjs/pdf.min.js"></script>',
    '<script type="text/plain" id="pdfjs-worker">__PDFJS_WORKER__</script>': "",
})
index_html = fill(src, pwa)
open(os.path.join(OUT, "index.html"), "w").write(index_html)
os.makedirs(os.path.join(OUT, "download"))
open(os.path.join(OUT, "download", "Exam_Builder_offline.html"), "w").write(single_html)
open(os.path.join(OUT, ".nojekyll"), "w").write("")

# service worker: core files cached on install; photo reader + extra fonts cached in the background
def h(paths):
    m = hashlib.sha256()
    for p in paths: m.update(open(os.path.join(OUT, p), "rb").read())
    return m.hexdigest()[:12]
CORE = ["./", "index.html", "manifest.webmanifest", "vendor/jspdf.umd.min.js", "vendor/mathjax/tex-svg-full.js", "vendor/mathlive/mathlive.min.js",
        "vendor/mathlive/fonts.css", "vendor/sortable.min.js", "vendor/pdfjs/pdf.min.js", "vendor/pdfjs/pdf.worker.min.js",
        "icons/icon-192.png", "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png", "icons/favicon-32.png"]
LAZY = ["vendor/fonts.js", "vendor/ocr/tesseract.min.js", "vendor/ocr/worker.min.js", "vendor/ocr/tesseract-core-simd-lstm.wasm.js", "vendor/ocr/lang/eng.traineddata.gz"]
sw = rd(os.path.join(ROOT, "build", "sw.template.js"))
sw = sw.replace("__CORE_VERSION__", h([p for p in CORE if p != "./"])).replace("__LAZY_VERSION__", h(LAZY))
sw = sw.replace("__CORE__", json.dumps(CORE)).replace("__LAZY__", json.dumps(LAZY))
open(os.path.join(OUT, "sw.js"), "w").write(sw)

size = lambda p: os.path.getsize(p) / 1e6
print("docs/index.html  %.2f MB" % size(os.path.join(OUT, "index.html")))
print("docs total       %.1f MB" % (sum(os.path.getsize(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs) / 1e6))
print("offline single   %.1f MB" % size(os.path.join(OUT, "download", "Exam_Builder_offline.html")))
