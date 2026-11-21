"""BEE regression suite: one check per feature or bug fixed since the first release.
Run after `python3 build/build.py`:   python3 tests/suite.py
Every check prints PASS/FAIL; the script exits with 1 if anything failed."""
import asyncio, base64, os, sys, traceback
from playwright.async_api import async_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import APP, FIX, OFFLINE, OUT, ROOT, chrome

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

async def lead_in(b):
    # a short "Refer to the picture below." note must never be left alone at the foot of a page
    c, pg, errs = await fresh(b); hit = 0; bad = []
    for n in range(10, 40):
        items = [{"id": f"f{k}", "type": "q", "text": "Filler question number %d." % k, "marks": "1"} for k in range(n)]
        items += [{"id": "lead", "type": "note", "text": "Refer to the picture below."},
                  {"id": "pic", "type": "q", "text": "{img: p1 | 60% | center}\nWhat does the picture show?", "marks": "2", "lines": 4,
                   "pics": {"p1": {"src": IMG, "w": 400, "h": 300}}}]
        await pg.evaluate("it => __exam.set({d:{}, items: it})", items)
        r = await build(pg); a, z = pages_of(r, "lead"), pages_of(r, "pic")
        if a and z and a[-1] != z[0]: bad.append(n)
        if a and z and a[0] > 1 and min(x["y0"] for x in r["regions"] if x["id"] == "lead") < 40: hit += 1
    ok("lead-in note stays with the picture question it introduces", not bad, f"split at {bad}")
    ok("lead-in check really reached a page edge", hit >= 1, f"{hit} cases moved"); await c.close()

async def settings_tabs(b):
    c, pg, errs = await fresh(b)
    vis = lambda k: pg.evaluate(f"!!document.querySelector('[data-k={k}]').offsetParent")
    first = [await vis("title"), await vis("style"), await vis("paper")]
    await pg.click("#setTabs [data-tab=look]"); look = [await vis("title"), await vis("style"), await vis("accent")]
    await pg.click("#setTabs [data-tab=print]"); prn = [await vis("paper"), await vis("showMarks"), await vis("answerMode")]
    keys = await pg.evaluate("[...document.querySelectorAll('#setTabs ~ .tabpane [data-k]')].map(e => e.dataset.k)")
    ok("settings tabs: Exam / Look / Printing each show their own settings", first == [True, False, False] and look == [False, True, True] and all(prn), (first, look, prn))
    ok("settings tabs: every setting is in exactly one tab", len(keys) == len(set(keys)) == 28, len(keys))
    await pg.reload(); await pg.wait_for_timeout(1200)
    ok("settings tabs: last tab is remembered", await pg.evaluate("$('#setTabs .on').dataset.tab") == "print")
    await pg.evaluate("localStorage.removeItem('bee.tab')"); await c.close()

async def more_menu(b):
    c, pg, errs = await fresh(b)
    await pg.evaluate("__exam.set({d:{}, items:[{id:'q1',type:'q',text:'What is 2+2?',marks:'1'}]})"); await pg.wait_for_timeout(300)
    card = ".card[data-id=q1]"
    before = await pg.evaluate(f"[...document.querySelector('{card} [data-ins]').closest('.row, div').querySelectorAll(':scope > .btn, :scope > .ins-wrap > .btn')].filter(b => b.offsetParent).length")
    await pg.click(f"{card} [data-ins]:has-text('More')"); await pg.click(f"{card} .ins-it[data-act=nonum]"); await pg.wait_for_timeout(300)
    st = await pg.evaluate("S.items[0].nonum")
    chip = await pg.evaluate(f"!!document.querySelector('{card} .flag[data-act=nonum]')")
    await pg.click(f"{card} .flag[data-act=nonum]"); await pg.wait_for_timeout(300)
    await pg.click(f"{card} [data-ins]:has-text('More')"); await pg.click(f"{card} .ins-it[data-act=half]"); await pg.wait_for_timeout(300)
    ok("More ▾ menu: switches work and show as a chip", st and chip and not await pg.evaluate("S.items[0].nonum") and await pg.evaluate("S.items[0].width") == "half")
    ok("More ▾ menu: card has fewer buttons on show", before <= 4, f"{before} buttons in the bottom row"); await c.close()

async def tour_and_demo(b):
    for w, h in [(1400, 1000), (390, 844)]:
        c, pg, errs = await fresh(b, viewport={"width": w, "height": h}, is_mobile=w < 700, has_touch=w < 700)
        await pg.evaluate("startTour()"); good = 0
        for k in range(4):
            await pg.wait_for_timeout(250)
            r = await pg.evaluate("""() => { const t = $('#tourTip').getBoundingClientRect(), g = $('#tourRing').getBoundingClientRect();
                return { inside: t.left >= 0 && t.top >= 0 && t.right <= innerWidth && t.bottom <= innerHeight, ring: !$('#tourRing').classList.contains('hidden') && g.height > 10,
                         overlap: !(t.bottom <= g.top || t.top >= g.bottom || t.right <= g.left || t.left >= g.right) }; }""")
            good += r["inside"] and r["ring"]
            if k == 1 and w > 700: await pg.screenshot(path=os.path.join(OUT, "tour_step2.png"))
            await pg.click("#tourNext")
        ok(f"welcome tour {w}px: all 4 steps on screen and pointing at something", good == 4, f"{good}/4")
        ok(f"welcome tour {w}px: closes and is remembered", await pg.evaluate("$('#tourTip').classList.contains('hidden') && localStorage.getItem('bee.toured') === '1'"))
        await c.close()
    c, pg, errs = await fresh(b)
    await pg.evaluate("openStart()"); await pg.click("#stDemo"); await pg.wait_for_timeout(1500)
    d = await pg.evaluate("({ t: S.d.title, q: S.items.filter(i => i.type === 'q').length, file: proj.handle, open: $('#startModal').classList.contains('open') })")
    r = await build(pg)
    ok("demo exam (website): opens with its questions and builds", d["t"] and d["q"] >= 20 and not d["file"] and not d["open"] and r["pages"] >= 3, (d, r["pages"]))
    await pg.evaluate("tourAt >= 0 && endTour()"); await c.close()
    c = await b.new_context(viewport={"width": 1400, "height": 1000}); pg = await c.new_page()
    await pg.goto("file://" + OFFLINE); await pg.wait_for_timeout(2500)
    await pg.evaluate("openStart()"); await pg.click("#stDemo"); await pg.wait_for_timeout(1500)
    n = await pg.evaluate("S.items.filter(i => i.type === 'q').length")
    ok("demo exam (offline file): works without internet", n >= 20, n); await c.close()

async def switch_files(b):
    # teacher feedback: switching to another file in the installed app. The old file must keep its own exam,
    # even when a save runs while the "Allow editing?" question is open, or while a save is still running.
    c, pg, errs = await fresh(b)
    # real files need a web address (run_all.py serves docs/ on port 8765); the offline file:// copy can't have them
    await pg.goto("http://127.0.0.1:8765/"); await pg.wait_for_timeout(1500); await pg.evaluate("$('#startModal').classList.remove('open')")
    await pg.evaluate("""async () => { const root = await navigator.storage.getDirectory();
      for(const n of 'ABC'){ const h = await root.getFileHandle(n + '.exam.json', {create:true}), w = await h.createWritable();
        await w.write(JSON.stringify({app:'exam-builder', version:2, savedAt:1, d:{title:'T' + n}, items:[{id:'q' + n, type:'q', text:'Q ' + n}]})); await w.close(); }
      window.showOpenFilePicker = async () => [await root.getFileHandle(window.__pick)];
      FileSystemFileHandle.prototype.queryPermission = async () => 'granted';
      window.__disk = async n => JSON.parse(await (await (await root.getFileHandle(n + '.exam.json')).getFile()).text()).d.title; }""")
    async def op(n, delay=0):
        await pg.evaluate(f"() => {{ window.__pick = '{n}.exam.json'; FileSystemFileHandle.prototype.requestPermission = () => new Promise(r => setTimeout(() => r('granted'), {delay})); }}")
        await pg.click("#btnOpen")
    seq = []
    for n in "ABCACB":
        await op(n); await pg.wait_for_timeout(500); seq.append(await pg.evaluate("S.d.title") == "T" + n)
    ok("switching files: each file opens, back to back", all(seq), seq)
    await op("A"); await pg.wait_for_timeout(500); await pg.evaluate("setFold('detPanel', false)"); await pg.fill("[data-k=title]", "A edited"); await pg.wait_for_timeout(500)
    await op("B", 2000); await pg.wait_for_timeout(600); await pg.evaluate("writeProject(true)"); await pg.wait_for_timeout(2000)
    d = await pg.evaluate("Promise.all([S.d.title, __disk('A'), __disk('B'), proj.name])")
    ok("switching files: the old file keeps its own edits, never the next exam", d == ["TB", "A edited", "TB", "B.exam.json"], d)
    await pg.evaluate("setFold('detPanel', false)"); await pg.fill("[data-k=title]", "B edited"); await pg.wait_for_timeout(500)
    await pg.evaluate("""() => { const o = FileSystemFileHandle.prototype.createWritable; FileSystemFileHandle.prototype.createWritable = async function(){ await new Promise(r => setTimeout(r, 1000)); return o.call(this); }; writeProject(); }""")
    await pg.wait_for_timeout(100); await op("C"); await pg.wait_for_timeout(2500)
    d = await pg.evaluate("Promise.all([S.d.title, __disk('B'), __disk('C')])")
    ok("switching files: a save still running doesn't cross files", d == ["TC", "B edited", "TC"], d); await c.close()

async def maths_keyboard_close(b):
    # the maths keyboard has its own ✕ Close button, and the equation dialog moves up above the keyboard
    c, pg, errs = await fresh(b)
    await pg.evaluate("openEq()"); await pg.wait_for_timeout(600)
    await pg.click("#kbToggle"); await pg.wait_for_timeout(900)
    st = await pg.evaluate("({ kb: mathVirtualKeyboard.visible, btn: getComputedStyle($('#kbClose')).display, pad: getComputedStyle($('#eqModal')).paddingBottom })")
    ok("maths keyboard: ✕ Close button shows on the keyboard", st["kb"] and st["btn"] == "block", st)
    ok("equation dialog moves up above the keyboard", float(st["pad"].replace("px", "")) > 100, st)
    await pg.click("#kbClose"); await pg.wait_for_timeout(900)
    ok("✕ Close hides the keyboard", not await pg.evaluate("mathVirtualKeyboard.visible") and await pg.evaluate("getComputedStyle($('#kbClose')).display") == "none")
    await c.close()

async def beta_switch(b):
    # the student version is hidden until launch; the secret link switches it on for one browser
    c, pg, errs = await fresh(b)
    vis = lambda: pg.evaluate("[...document.querySelectorAll('#dlMenu [data-dl=student], #dlMenu [data-dl=answers]')].map(x => getComputedStyle(x).display !== 'none')")
    await pg.click("#dlMenuBtn"); hidden = await vis()
    await pg.goto(pg.url.split("?")[0] + "?beta=bee"); await pg.wait_for_timeout(1500); await pg.evaluate("$('#startModal').classList.remove('open')")
    await pg.click("#dlMenuBtn"); shown = await vis()
    await pg.goto(pg.url.split("?")[0]); await pg.wait_for_timeout(1500); await pg.evaluate("$('#startModal').classList.remove('open')")
    await pg.click("#dlMenuBtn"); kept = await vis()
    await pg.goto(pg.url.split("?")[0] + "?beta=off"); await pg.wait_for_timeout(1500); await pg.evaluate("$('#startModal').classList.remove('open')")
    await pg.click("#dlMenuBtn"); off = await vis()
    ok("student version hidden until the secret link, remembered, and ?beta=off hides it again", hidden == [False, False] and shown == [True, True] and kept == [True, True] and off == [False, False], [hidden, shown, kept, off])
    await c.close()

async def save_light(b):
    # 1a–1e: the save light, the • in the tab title, the banner, the close warning, the start screen
    c, pg, errs = await fresh(b)
    st = lambda: pg.evaluate("({ chip: $('#saveChip').textContent, cls: $('#saveChip').className, title: document.title, banner: !$('#saveBanner').classList.contains('hidden'), unsaved: unsavedWork() })")
    await pg.evaluate("__exam.set({ d: { title: 'Light test' }, items: [{ id: 'q1', type: 'q', text: 'What is 2+2?', marks: '1' }] }); proj.unsavedSince = 0; updateChip()")
    a = await st()
    ok("save light: 🟠 only in this browser, • in the tab title, close warning on", "Only in this browser" in a["chip"] and "warn" in a["cls"] and a["title"].startswith("• ") and a["unsaved"] and not a["banner"], a)
    await pg.evaluate("proj.unsavedSince = Date.now() - 11 * 60000; updateChip()"); b2 = await st()
    ok("save light: 🔴 after 10 minutes, with a banner nobody can miss", "bad" in b2["cls"] and b2["banner"] and "only in this browser" in await pg.text_content("#saveBannerText"), b2)
    # a real project file (the browser's private file system stands in for the computer)
    await pg.goto("http://127.0.0.1:8765/"); await pg.wait_for_timeout(1500); await pg.evaluate("$('#startModal').classList.remove('open')")
    await pg.evaluate("""async () => { const root = await navigator.storage.getDirectory(); const h = await root.getFileHandle('light.exam.json', { create: true });
      FileSystemFileHandle.prototype.queryPermission = async () => 'granted';
      __exam.set({ d: { title: 'Light test' }, items: [{ id: 'q1', type: 'q', text: 'Q', marks: '1' }] }); await setHandle(h); proj.perm = 'granted'; await writeProject(true); }""")
    await pg.wait_for_timeout(300); c3 = await st()
    ok("save light: 🟢 saved in the project file, no •, no warning", "Saved in light.exam.json" in c3["chip"] and "ok" in c3["cls"] and not c3["title"].startswith("•") and not c3["unsaved"] and not c3["banner"], c3)
    await pg.evaluate("proj.perm = 'prompt'; updateChip()"); d = await st()
    ok("save light: 🔴 when saving has stopped (permission lost)", "Not saving" in d["chip"] and d["banner"] and await pg.text_content("#saveBannerGo") == "Allow saving", d)
    await c.close()
    # Safari / Firefox: no saving to files; a downloaded copy counts as safe
    c, pg, errs = await fresh(b)
    await pg.evaluate("1")
    c2 = await b.new_context(accept_downloads=True); p2 = await c2.new_page()
    await p2.add_init_script("delete window.showSaveFilePicker; delete window.showOpenFilePicker;")
    await p2.goto("http://127.0.0.1:8765/"); await p2.wait_for_timeout(1500); await p2.evaluate("$('#startModal').classList.remove('open')")
    await p2.evaluate("__exam.set({ d: { title: 'Safari test' }, items: [{ id: 'q1', type: 'q', text: 'Q', marks: '1' }] }); proj.unsavedSince = 0; localStorage.removeItem('examBuilder.lastDownload'); updateChip()")
    e1 = await p2.text_content("#saveChip")
    async with p2.expect_download(): await p2.evaluate("downloadProject('x')")
    await p2.wait_for_timeout(300); e2 = await p2.text_content("#saveChip")
    ok("Safari/Firefox: 🟠 until a copy is downloaded, then 🟢", "Download a copy" in e1 and "Copy downloaded" in e2, [e1, e2])
    # start screen: says where "continue" comes from
    await p2.evaluate("storedLocal = { d: { title: 'Safari test' }, items: [{ type: 'q' }], savedAt: Date.now() }; storedHandle = null; openStart()")
    ok("start screen: “Continue” says it is only in this browser", "Only in this browser" in await p2.text_content("#stLocalInfo"))
    await c2.close(); await c.close()

async def dyslexia_pdf(b):
    # 3a–3c: the grouped download menu, the dyslexia-friendly PDF (easy-read font, cream, spacing), also for versions
    c, pg, errs = await fresh(b)
    await pg.evaluate("loadDemo()"); await pg.wait_for_timeout(2500); await pg.evaluate("tourAt >= 0 && endTour(); $('#startModal').classList.remove('open')")
    await pg.click("#dlMenuBtn"); await pg.wait_for_timeout(200)
    m = await pg.evaluate("({ cols: [...document.querySelectorAll('#dlMenu .dl-col')].filter(x => x.offsetParent).length, h: $('#dlMenu').getBoundingClientRect().height, dys: !!document.querySelector('#dlMenu [data-dl=dys]').offsetParent })")
    ok("download menu: three groups, compact", m["cols"] == 3 and m["h"] < 330 and m["dys"], m)
    await pg.click("#dlMenu [data-dl=dys]")
    async with pg.expect_download(timeout=60000) as dl: await pg.click("#dysGo")
    d = await dl.value
    ok("dyslexia-friendly PDF downloads", d.suggested_filename == "Integrated-Studies_End-of-Term-Examination_dyslexia-friendly.pdf", d.suggested_filename)
    r = await pg.evaluate("""(async () => { await ensureEasyFonts(); const a = buildPDF({ final: true, dys: 'atk', cream: true }), o = buildPDF({ final: true, dys: 'ody' }), n = buildPDF({ final: true });
      return { atk: Object.keys(a.getFontList()).includes('EasyRead'), ody: Object.keys(o.getFontList()).includes('EasyRead'), pa: a.getNumberOfPages(), pn: n.getNumberOfPages(), cream: a.output().includes('1. 0.973 0.894 rg') || /1(\.0*)? 0\.97\d* 0\.89\d* rg/.test(a.output()) }; })()""")
    ok("dyslexia-friendly PDF: easy-read font (both choices), cream paper, more room", r["atk"] and r["ody"] and r["cream"] and r["pa"] >= r["pn"], r)
    g = await pg.evaluate("""(async () => { const saved = S.items; S.items = saved.concat([{ id: 'gk', type: 'q', text: 'Find the angle θ when α = 30°.', marks: '1' }]);
      try{ const d = buildPDF({ final: true, dys: 'atk' }); return Object.keys(d.getFontList()).includes('DejaVu'); } finally { S.items = saved; } })()""")
    ok("dyslexia-friendly PDF: Greek letters fall back to the Unicode font (no missing letters)", g)
    await pg.click("#dlMenuBtn"); await pg.click("#dlMenu [data-dl=versions]"); await pg.select_option("#verN", "2"); await pg.uncheck("#verK"); await pg.check("#verD")
    names = []; pg.on("download", lambda x: names.append(x.suggested_filename))
    await pg.click("#verGo"); await pg.wait_for_timeout(5000)
    ok("versions A, B can be dyslexia-friendly too", len(names) == 2 and sorted(names) == ["Integrated-Studies_End-of-Term-Examination_dyslexia-friendly_Version-A.pdf", "Integrated-Studies_End-of-Term-Examination_dyslexia-friendly_Version-B.pdf"], names)
    await c.close()

CHECKS = [phones, sticky_preview, paste_details_rubric, formatting, pdf_guard, cut_from_pdf, drawings, mcq_ends_after_options,
          sub_question_split, mcq_split, page_breaks, click_to_jump, insert_menu, save_dialog, prompts, looks,
          lead_in, settings_tabs, more_menu, tour_and_demo, switch_files, maths_keyboard_close, beta_switch, save_light, dyslexia_pdf]

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

if __name__ == "__main__":
    if len(sys.argv) > 1: CHECKS = [globals()[n] for n in sys.argv[1:]]
    asyncio.run(main())
