"""BEE regression suite: one check per feature or bug fixed since the first release.
Run after `python3 build/build.py`:   python3 tests/suite.py
Every check prints PASS/FAIL; the script exits with 1 if anything failed."""
import asyncio, base64, os, sys, traceback
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import APP, FIX, OUT, ROOT, chrome

R = []
def ok(name, cond, extra=""):
    R.append((name, bool(cond))); print(("PASS " if cond else "FAIL ") + name + ("  " + str(extra) if extra else ""), flush=True)

IMG = "data:image/png;base64," + base64.b64encode(open(os.path.join(FIX, "picture.png"), "rb").read()).decode()
LONG = "This is a deliberately long answer option that wraps over two or three printed lines so the question becomes tall."

async def fresh(b, **ctx):
    c = await b.new_context(**({"viewport": {"width": 1400, "height": 1000}} | ctx)); pg = await c.new_page(); errs = []
    pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("dialog", lambda d: asyncio.ensure_future(d.accept("2x2") if d.type == "prompt" else d.accept()))
    await pg.goto(APP); await pg.wait_for_timeout(1400)
    await pg.evaluate("document.getElementById('startModal').classList.remove('open')")
    return c, pg, errs

async def build(pg, opt="{final:true}"):
    return await pg.evaluate(f"""async () => {{ await prepareMath(); const doc = __exam.buildPDF({opt});
        return {{ regions: doc.__regions, H: doc.__size[1], pages: doc.getNumberOfPages() }}; }}""")

async def paste(pg, text):
    await pg.evaluate("t => { $('#pasteText').click(); $('#pasteArea').value = t; }", text)
    await pg.click("#pasteGo"); await pg.wait_for_timeout(1500)

def pages_of(r, id_): return sorted({x["p"] for x in r["regions"] if x["id"] == id_})

# ------------------------------------------------------------------ checks
async def phones(b):
    for w, h in [(375, 667), (390, 844), (412, 915), (768, 1024)]:
        c, pg, errs = await fresh(b, viewport={"width": w, "height": h}, is_mobile=w < 700, has_touch=True)
        sw = await pg.evaluate("document.documentElement.scrollWidth")
        ok(f"phone/tablet {w}px: page fits the screen", sw <= w, f"page {sw}px"); await c.close()

async def sticky_preview(b):
    c, pg, errs = await fresh(b, viewport={"width": 1440, "height": 900})
    t = open(os.path.join(ROOT, "demo", "demo_AI_answer_Giver_ELA.txt")).read()
    await pg.evaluate("t => __exam.set({d:{}, items:[{id:'n1',type:'note',text:t},{id:'q1',type:'q',text:t,marks:'2'}]})", t)
    await pg.evaluate("scrollTo(0, 2500)"); await pg.wait_for_timeout(300)
    top = await pg.evaluate("document.querySelector('.preview').getBoundingClientRect().top")
    ok("desktop: preview stays in view while scrolling", 0 <= top < 200, f"top {top:.0f}px"); await c.close()

async def paste_details_rubric(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{}, items:[]})")
    await paste(pg, open(os.path.join(ROOT, "demo", "demo_AI_answer_Giver_ELA.txt")).read())
    d = await pg.evaluate("({ title: S.d.title, teacher: S.d.teacher, on: S.d.rubricOn, total: rbSum(S.d.rubric), miss: missingPics(), q: S.items.filter(i=>i.type==='q').length })")
    ok("AI paste: exam details filled in", d["title"] and d["teacher"], d)
    ok("AI paste: rubric switched on, total 75", d["on"] and d["total"] == 75)
    ok("AI paste: missing picture marked", d["miss"] >= 1)
    ok("AI paste: no errors", not errs, errs[:1]); await c.close()

async def formatting(b):
    c, pg, errs = await fresh(b)
    r = await pg.evaluate("""() => [toggleFmtRange('one two three', 0, 13, 'x'), toggleFmtRange('This informational text', 0, 23, 'i'), stripFmt('{center}{big}**Title** ~~x~~')]""")
    t = lambda v: v if isinstance(v, str) else v.get("text")
    ok("strikethrough marker", t(r[0]) == "~~one two three~~", t(r[0]))
    ok("italic wraps the whole phrase", t(r[1]) == "*This informational text*", t(r[1]))
    ok("alignment/size tags are stripped from plain text", r[2] == "Title x", r[2]); await c.close()

async def pdf_guard(b):
    c, pg, errs = await fresh(b)
    pdfpath = os.path.join(OUT, "suite_sample.pdf")
    await pg.evaluate("__exam.set({d:{title:'Sample'}, items:[{id:'q',type:'q',text:'A question',marks:'1',lines:'3'}]})")
    data = await pg.evaluate("(async()=>{await prepareMath(); return __exam.buildPDF({final:true}).output('datauristring')})()")
    open(pdfpath, "wb").write(base64.b64decode(data.split(",", 1)[1]))
    n0 = await pg.evaluate("S.items.length")
    await pg.set_input_files("#fileIn", pdfpath); await pg.wait_for_timeout(1500)
    st = await pg.evaluate("[$('#pdfModal').classList.contains('open'), S.items.length, PDFSRC && PDFSRC.doc.numPages]")
    ok("a PDF is stopped with the help pop-up", st[0] and st[1] == n0, st)
    ok("the PDF is kept open for 📄 Cut from PDF", (st[2] or 0) >= 1); await c.close()

async def cut_from_pdf(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{}, items:[{id:'q',type:'q',text:'Find x.\\n[diagram: page 1 — a triangle]',marks:'2',lines:'3'}]})")
    await pg.set_input_files("#fileIn", os.path.join(OUT, "suite_sample.pdf")); await pg.wait_for_timeout(1200)
    await pg.evaluate("$('#pdfModal').classList.remove('open')")
    await pg.click(".card[data-id=q] [data-act=cutpdf]"); await pg.wait_for_timeout(1200)
    await pg.evaluate("$('#cutStage').scrollTop = 0")
    bb = await pg.locator("#cutCanvas").bounding_box()
    x0, y0 = bb["x"] + bb["width"] * .1, bb["y"] + 40; x1, y1 = bb["x"] + bb["width"] * .5, bb["y"] + 140
    await pg.mouse.move(x0, y0); await pg.mouse.down(); await pg.mouse.move(x1, y1, steps=5); await pg.mouse.up()
    se = await pg.locator("#cutSel i[data-h=se]").bounding_box()
    await pg.mouse.move(se["x"] + 6, se["y"] + 6); await pg.mouse.down(); await pg.mouse.move(se["x"] + 60, se["y"] + 30, steps=5); await pg.mouse.up()
    r1 = await pg.evaluate("cutRect.fw")
    await pg.click("#cutZoomIn"); await pg.wait_for_timeout(500)
    r2 = await pg.evaluate("cutRect.fw")
    ok("cut box can be resized with a handle", r1 > (x1 - x0) / bb["width"] + .02, round(r1, 3))
    ok("zooming keeps the cut box on the same spot", abs(r1 - r2) < 1e-9)
    await pg.click("#cutGo"); await pg.wait_for_timeout(800)
    ok("cut picture replaces the placeholder", await pg.evaluate("missingPics() === 0 && Object.keys(S.items[0].pics||{}).length === 1")); await c.close()

async def drawings(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{}, items:[]})")
    svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><polygon points="20,100 180,100 20,20" fill="none" stroke="#000" stroke-width="2"/><text x="90" y="116" font-size="14">8 cm</text></svg>'
    await paste(pg, f"1. Find the hypotenuse. [2] {{lines: 3}}\n[diagram: page 1 — right triangle]\n{{svg}}\n{svg}\n{{/svg}}\n2. Next question [1]")
    d = await pg.evaluate("[S.items.length, S.items[0].text, Object.values(S.items[0].pics||{}).filter(p=>p.svg).length, missingPics()]")
    ok("AI drawing becomes a picture (placeholder above it removed)", d[2] == 1 and d[3] == 0 and "{img: d" in d[1], d[1])
    await pg.click(".card [data-picsvg]"); await pg.wait_for_timeout(200)
    code = await pg.input_value("#svgCode"); await pg.fill("#svgCode", code.replace("8 cm", "9 cm")); await pg.click("#svgGo"); await pg.wait_for_timeout(400)
    ok("✏️ Edit drawing updates it", await pg.evaluate("Object.values(S.items[0].pics)[0].svg.includes('9 cm')")); await c.close()

async def mcq_ends_after_options(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{}, items:[]})")
    await paste(pg, open(os.path.join(FIX, "passages_mcq.txt")).read())
    d = await pg.evaluate("S.items.map(i => i.type + (i.type==='q' ? '' : ':' + i.text.slice(0, 12)))")
    ok("a passage after MCQ options becomes its own text block", d[:6] == ["q", "note:Read the fol", "q", "q", "note:Refer to th"][:5] or d[1].startswith("note:Read"), d)
    q1 = await pg.evaluate("S.items[0].text")
    ok("…and is not swallowed into the question", "charter" not in q1); await c.close()

async def sub_question_split(b):
    c, pg, errs = await fresh(b)
    subs = [{"id": f"s{k}", "text": f"Part {k}: explain in your own words.", "marks": "2", "lines": "4", "space": "lines"} for k in range(5)]
    await pg.evaluate("subs => __exam.set({d:{}, items:[{id:'q1',type:'q',text:'Long first',marks:'4',lines:'16'},{id:'q2',type:'q',text:'Question with parts',marks:'',lines:'',subs},{id:'q3',type:'q',text:'Last',marks:'1',lines:'2'}]})", subs)
    r = await build(pg); p1 = max(pages_of(r, "q1")); p2 = pages_of(r, "q2")
    ok("sub-questions: question starts where the last one ended and continues", p2[0] == p1 and len(p2) == 2, p2); await c.close()

async def mcq_split(b):
    c, pg, errs = await fresh(b)
    for q1lines in range(14, 30):
        await pg.evaluate("([L, n]) => __exam.set({d:{}, items:[{id:'q1',type:'q',text:'Long first',marks:'4',lines:String(n)},{id:'q2',type:'q',text:'Which statement is true?',marks:'1',mcq:'single',options:[L,L,L,L,L]},{id:'q3',type:'q',text:'Last',marks:'1',lines:'2'}]})", [LONG, q1lines])
        r = await build(pg); p1 = max(pages_of(r, "q1"))
        left = r["H"] - 19 - max(x["y1"] for x in r["regions"] if x["id"] == "q1" and x["p"] == p1)
        if p1 == 2 and 45 <= left <= 70: break
    p2 = pages_of(r, "q2")
    ok("long MCQ continues on the next page from option C", p2 == [p1, p1 + 1], f"{p2}, {left:.0f} mm left"); await c.close()

async def page_breaks(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{}, items:[{id:'s1',type:'section',text:'Part 1'},{id:'q1',type:'q',text:'One',marks:'1',lines:'2'},{id:'br',type:'note',pagebreak:true,text:''},{id:'q2',type:'q',text:'Two',marks:'1',lines:'2'},{id:'s2',type:'section',text:'Part 2',newPage:true},{id:'q3',type:'q',text:'Three',marks:'1',lines:'2'}]})")
    r = await build(pg); a, b2, s2 = pages_of(r, "q1")[0], pages_of(r, "q2")[0], pages_of(r, "s2")[0]
    ok("page break item and part 'New page' start new pages", b2 == a + 1 and s2 == b2 + 1, (a, b2, s2)); await c.close()

async def click_to_jump(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{title:'Jump'}, items:[{id:'q1',type:'q',text:'First',marks:'1',lines:'3'},{id:'q2',type:'q',text:'Second',marks:'1',lines:'3'}]})")
    await pg.evaluate("preview()"); await pg.wait_for_timeout(4000)
    g = await pg.evaluate("pvMap.regions.find(r => r.id === 'q2')"); W, H = await pg.evaluate("pvMap.size")
    cv = pg.locator(f'#pv canvas[data-page="{g["p"]}"]'); await cv.scroll_into_view_if_needed(); bb = await cv.bounding_box()
    await pg.mouse.click(bb["x"] + bb["width"] * .4, bb["y"] + (g["y0"] + g["y1"]) / 2 / H * bb["height"]); await pg.wait_for_timeout(1300)
    ok("clicking the preview opens that question", await pg.evaluate("(document.activeElement.closest('.card')||{}).dataset?.id") == "q2"); await c.close()

async def insert_menu(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{}, items:[{id:'q1',type:'q',text:'Line one.\\nLine two.',marks:'1',lines:'2'}]})")
    await pg.locator(".card[data-id=q1] textarea[data-f=text]").evaluate("t => { t.focus(); t.setSelectionRange(3,3); t.dispatchEvent(new Event('keyup', {bubbles:true})); }")
    await pg.click(".card[data-id=q1] [data-ins]"); await pg.click(".card[data-id=q1] .ins-it[data-act=table]"); await pg.wait_for_timeout(400)
    t = await pg.evaluate("S.items[0].text.split('\\n')")
    ok("Insert ▾ → Table goes in after the cursor's line", t[0] == "Line one." and t[1].startswith("|"), t[:3]); await c.close()

async def save_dialog(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("window.__picked=[]; window.showSaveFilePicker = async (o) => { __picked.push(o.suggestedName); return { name:o.suggestedName, kind:'file', createWritable: async () => ({ write: async()=>{}, close: async()=>{} }), queryPermission: async()=>'granted', requestPermission: async()=>'granted' }; }; 0")
    await pg.click("#btnSave"); await pg.wait_for_timeout(300)
    await pg.fill("#svName", "ELA 7 / Semester 1: final?"); await pg.click("#svGo"); await pg.wait_for_timeout(500)
    ok("Save as: the typed name (tidied) reaches the folder picker", (await pg.evaluate("__picked")) == ["ELA 7 - Semester 1 - final.exam.json"], await pg.evaluate("__picked")); await c.close()

async def prompts(b):
    c, pg, errs = await fresh(b)
    g, x = await pg.evaluate("[PROMPTS.gen, PROMPTS.ixl]")
    ok("generic prompt: drawings rule, no IXL rules", "{svg}" in g and "IXL MATERIAL" not in g)
    ok("IXL prompt: IXL rules + generic rules", "IXL MATERIAL" in x and "{svg}" in x and "Unit 3 Test" not in x); await c.close()

async def looks(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{title:'Look', lang:'fr', style:'colour'}, items:[{id:'s',type:'section',text:'Partie A'},{id:'q1',type:'q',text:'Bonjour 🐝 $x^2$',marks:'2',lines:'2'},{id:'q2',type:'q',text:'{mol: CCO}',marks:'1'},{id:'q3',type:'q',text:'Place 3.',marks:'1',space:'numberline',range:'-5..5'}]})")
    try: r = await build(pg); ok("French + colourful + molecule + number line + emoji build a PDF", r["pages"] >= 2)
    except Exception as e: ok("French + colourful + molecule + number line + emoji build a PDF", False, e)
    ok("molecule drawing library works", await pg.evaluate("(async()=>!!(await getMol('CCO')).png)()")); await c.close()

CHECKS = [phones, sticky_preview, paste_details_rubric, formatting, pdf_guard, cut_from_pdf, drawings, mcq_ends_after_options,
          sub_question_split, mcq_split, page_breaks, click_to_jump, insert_menu, save_dialog, prompts, looks]

async def main():
    os.chdir(OUT)
    async with async_playwright() as p:
        b = await p.chromium.launch(**chrome())
        for chk in CHECKS:
            try: await chk(b)
            except Exception as e:
                ok(chk.__name__ + " (crashed)", False, repr(e)[:200]); traceback.print_exc(limit=1)
        await b.close()
    bad = [n for n, good in R if not good]
    print(f"\n{len(R) - len(bad)}/{len(R)} passed"); sys.exit(1 if bad else 0)

asyncio.run(main())
