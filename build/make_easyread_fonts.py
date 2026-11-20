#!/usr/bin/env python3
"""Makes the TrueType fonts for the dyslexia-friendly PDF (run once; the results are kept in assets/).
jsPDF can only embed TrueType ('glyf') fonts: Atkinson Hyperlegible already is; OpenDyslexic (CFF) is converted.
Needs:  pip install fonttools brotli   and the npm packages @fontsource/atkinson-hyperlegible, @fontsource/opendyslexic (5.3.0)."""
import os, subprocess, sys, tempfile, tarfile, glob
from fontTools.ttLib import TTFont, newTable
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); OUT = os.path.join(ROOT, "assets")
def to_truetype(f):
    if "glyf" in f: return f
    gs = f.getGlyphSet(); glyf = newTable("glyf"); glyf.glyphOrder = f.getGlyphOrder(); glyf.glyphs = {}
    for name in f.getGlyphOrder():
        pen = TTGlyphPen(gs); gs[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True)); glyf.glyphs[name] = pen.glyph()
    f["glyf"] = glyf; f["loca"] = newTable("loca")
    del f["CFF "]
    if "VORG" in f: del f["VORG"]
    f["maxp"] = newTable("maxp"); m = f["maxp"]; m.tableVersion = 0x00010000
    for k in ("maxZones", "maxTwilightPoints", "maxStorage", "maxFunctionDefs", "maxInstructionDefs", "maxStackElements", "maxSizeOfInstructions"): setattr(m, k, 0)
    m.maxZones = 1; m.numGlyphs = len(f.getGlyphOrder())
    for k in ("maxPoints", "maxContours", "maxCompositePoints", "maxCompositeContours", "maxComponentElements", "maxComponentDepth"): setattr(m, k, 0)
    f["head"].glyphDataFormat = 0
    f.sfntVersion = "\x00\x01\x00\x00"
    return f
tmp = tempfile.mkdtemp()
for pkg, stem, fam in [("@fontsource/atkinson-hyperlegible@5.3.0", "atkinson-hyperlegible", "AtkinsonHyperlegible"), ("@fontsource/opendyslexic@5.3.0", "opendyslexic", "OpenDyslexic")]:
    subprocess.run(["npm", "pack", pkg, "--silent"], cwd=tmp, check=True, stdout=subprocess.DEVNULL)
    tgz = sorted(glob.glob(os.path.join(tmp, "*.tgz")), key=os.path.getmtime)[-1]
    d = os.path.join(tmp, stem); tarfile.open(tgz).extractall(d, filter="data")
    for w, st, name in [(400, "normal", "Regular"), (700, "normal", "Bold"), (400, "italic", "Italic")]:
        f = TTFont(os.path.join(d, "package", "files", f"{stem}-latin-{w}-{st}.woff2")); f.flavor = None
        f = to_truetype(f); p = os.path.join(OUT, f"{fam}-{name}.ttf"); f.save(p)
        print(p, os.path.getsize(p) // 1024, "KB")
