"""🎬 The clips and pictures of the illustrated teacher guide (app/guide/pages/*.html use them by name).
Run:  python3 build/guide_clips.py            → all of them
      python3 build/guide_clips.py dl_menu …  → just these
Needs docs/ served on 127.0.0.1:8765 (cd docs && python3 -m http.server 8765) and ffmpeg.
Re-run after a change to BEE's screens, so the guide shows BEE as it is."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from guide_rec import Clip, shot, WEB, W, H
from playwright.async_api import async_playwright

CLIPS = {}
def clip(f): CLIPS[f.__name__] = f; return f


async def open_bee(c, demo=None, basic=False):
    """BEE with the start screen closed; demo = 'simple' or 'full' loads a demo exam (set-up, before the clip starts)"""
    pg = c.pg
    if not basic: await pg.add_init_script("try{ localStorage.removeItem('bee.basic'); localStorage.setItem('bee.tourDone', '1'); }catch(_){}")
    await pg.goto(WEB); await pg.wait_for_selector("#startModal.open", timeout=20000); await pg.wait_for_timeout(400)
    if demo:
        await pg.click("#stDemo" if demo == "full" else "#stDemoSimple"); await pg.wait_for_timeout(3000)
        await pg.evaluate("typeof tourAt !== 'undefined' && tourAt >= 0 && endTour()")
        await pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.classList.add('hidden'))")
    else:
        await pg.evaluate("$('#startModal').classList.remove('open')")
    await pg.mouse.move(W / 2, H / 2); await pg.wait_for_timeout(500)


# a pretend "Save as" window: BEE gets a file to save to, without a real window opening (set-up only)
FAKE_SAVE = """(() => {
  const mk = name => ({ kind: 'file', name, isSameEntry: async () => false, queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    createWritable: async () => ({ write: async () => {}, close: async () => {}, truncate: async () => {} }), getFile: async () => new File(['{}'], name) });
  window.showSaveFilePicker = async o => mk((o && o.suggestedName) || 'My exam.exam.json');
})();"""

def contact(name, cols=4, every=1.0):
    """a sheet of frames from a clip, to check it by eye"""
    import subprocess
    from guide_rec import MEDIA
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", os.path.join(MEDIA, name + ".mp4"), "-vf", f"fps=1/{every},scale=480:-1,tile={cols}x4", "-frames:v", "1", f"/tmp/g/cs_{name}.png"])

# ---------------------------------------------------------------- welcome / getting started
@clip
async def overview(b):
    async with Clip(b, "overview") as c:
        await c.pg.add_init_script("localStorage.setItem('bee.toured','1')")
        await c.pg.goto(WEB); await c.pg.wait_for_selector("#startModal.open", timeout=20000)
        await c.pg.mouse.move(640, 300); await c.go(0.8)
        await c.click("#stDemo", wait=2500)
        await c.pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.classList.add('hidden'))")
        await c.pg.mouse.wheel(0, 500); await c.wait(1.2)
        await c.click("#pvKey", wait=1500) if await c.pg.locator("#pvKey").count() else await c.wait(0.5)
        await c.click("#dlMenuBtn", wait=1800)

@clip
async def start_screen(b):
    async with Clip(b, "start_screen") as c:
        await c.pg.add_init_script("localStorage.setItem('bee.toured','1')")
        await c.pg.goto(WEB); await c.pg.wait_for_selector("#startModal.open", timeout=20000); await c.wait(0.6)
        await shot(c.pg, "start_screen", clip={"x": 380, "y": 230, "width": 520, "height": 340})
        await c.go(0)

@clip
async def new_exam(b):
    async with Clip(b, "new_exam") as c:
        await c.pg.add_init_script("localStorage.setItem('bee.toured','1');" + FAKE_SAVE)
        await c.pg.goto(WEB); await c.pg.wait_for_selector("#startModal.open", timeout=20000); await c.pg.mouse.move(640, 600); await c.go(0.6)
        await c.click("#stNew", wait=900)
        await c.type("Grade 7 Maths - Unit 4 test", delay=50, wait=500)
        await c.click("#svGo", wait=1500)
        await c.move("#saveChip"); await c.wait(1.5)

@clip
async def tour(b):
    async with Clip(b, "tour") as c:
        await c.pg.goto(WEB); await c.pg.wait_for_selector("#startModal.open", timeout=20000); await c.pg.mouse.move(640, 600)
        await c.pg.evaluate("$('#startModal').classList.remove('open')"); await c.pg.evaluate("typeof tourAt !== 'undefined' && tourAt >= 0 && endTour()")
        await c.pg.evaluate("$('#startModal').classList.add('open')"); await c.go(0.5)
        await c.click("#stTour", wait=1800)
        for _ in range(3): await c.click("#tourNext", wait=1700)

@clip
async def basic_mode(b):
    async with Clip(b, "basic_mode", crop=(0, 0, 1280, 800)) as c:
        await open_bee(c, "full"); await c.go()
        await c.click("#btnMode", wait=1600); await c.click("#dlMenuBtn", wait=1500); await c.pg.mouse.click(640, 780); await c.wait(0.4)
        await c.click("#btnMode", wait=1200)

# ---------------------------------------------------------------- your first exam
async def blank(c):
    await c.pg.add_init_script("localStorage.setItem('bee.toured','1');" + FAKE_SAVE)
    await c.pg.goto(WEB); await c.pg.wait_for_selector("#startModal.open", timeout=20000)
    await c.pg.click("#stNew"); await c.pg.wait_for_timeout(600); await c.pg.fill("#svName", "Grade 7 Maths - Unit 4 test"); await c.pg.click("#svGo"); await c.pg.wait_for_timeout(1500)
    await c.pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.classList.add('hidden'))")
    await c.pg.mouse.move(640, 400)

@clip
async def details(b):
    async with Clip(b, "details") as c:
        await blank(c); await c.pg.evaluate("for (const k of ['title','subject','duration','teacher']) { const i = document.querySelector(`#detPanel [data-k=${k}]`); i.value=''; i.dispatchEvent(new Event('input',{bubbles:true})); }")
        await c.go()
        await c.click("#detPanel [data-k=title]"); await c.type("Unit 4 test: Fractions")
        await c.click("#detPanel [data-k=subject]"); await c.type("Mathematics")
        await c.click("#detPanel [data-k=duration]"); await c.type("45 min")
        await c.click("#detPanel [data-k=teacher]"); await c.type("Ms. Martin", wait=1400)

@clip
async def add_question(b):
    async with Clip(b, "add_question") as c:
        await blank(c); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]') && document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.5)
        await c.go()
        await c.click("[data-add=q]", wait=700)
        await c.type("Work out $\\frac{3}{4} + \\frac{1}{8}$. Give your answer in its simplest form.", delay=40)
        await c.click(".card >> nth=-1 >> [data-f=marks]"); await c.pg.keyboard.press("Control+A"); await c.type("2")
        await c.click(".card >> nth=-1 >> [data-f=space]", wait=500); await c.pg.locator(".card").last.locator("[data-f=space]").select_option("box"); await c.wait(1.5)

@clip
async def add_mcq(b):
    async with Clip(b, "add_mcq") as c:
        await blank(c); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]') && document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.5)
        await c.go()
        await c.click("[data-add=mcq]", wait=700)
        await c.type("Which fraction is the largest?", delay=45)
        for k, o in enumerate(["$\\frac{2}{3}$", "$\\frac{3}{5}$", "$\\frac{5}{8}$", "$\\frac{1}{2}$"]):
            await c.click(f".card >> nth=-1 >> [data-opt='{k}']" if await c.pg.locator(".card").last.locator(f"[data-opt='{k}']").count() else ".card >> nth=-1 >> [data-act=optadd]", wait=300)
            if not await c.pg.evaluate(f"document.activeElement.matches('[data-opt=\"{k}\"]')"): await c.click(f".card >> nth=-1 >> [data-opt='{k}']", wait=200)
            await c.type(o, delay=45, wait=200)
        await c.click(".card >> nth=-1 >> .opt-row[data-oi='0'] .cor", wait=1500)

@clip
async def add_part(b):
    async with Clip(b, "add_part") as c:
        await open_bee(c, "simple"); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]') && document.querySelector('#detPanel [data-fold]').click(); window.scrollTo(0, 0)"); await c.go()
        await c.click("[data-add=s]", wait=700); await c.type("Part B: Problem solving", wait=500)
        await c.click("[data-add=q]", wait=600); await c.type("A recipe needs $\\frac{2}{3}$ cup of sugar. How much for 3 recipes?", delay=35, wait=1500)

@clip
async def preview_key(b):
    async with Clip(b, "preview_key") as c:
        await open_bee(c, "simple"); await c.go()
        await c.pg.evaluate("document.querySelector('#pvPages, .pv-scroll, #pvScroll') && 0")
        await c.click("#pvKey", wait=1800)
        await c.moveto(1000, 600); await c.pg.mouse.wheel(0, 700); await c.wait(1.5)
        await c.click("#pvKey", wait=900)

@clip
async def download_full(b):
    async with Clip(b, "download_full") as c:
        await open_bee(c, "simple"); await c.go()
        await c.click("#dlMenuBtn", wait=900)
        async with c.pg.expect_download() as d: await c.click("[data-dl=full]", wait=1800)
        await (await d.value).save_as("/tmp/g/demo_simple.pdf")

# ---------------------------------------------------------------- writing questions
ASSETS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "guide_assets")
TRI, CHART = os.path.join(ASSETS, "triangle.png"), os.path.join(ASSETS, "chart.png")

async def one_q(c, text="", mcq=False):
    """a new exam with one question (set-up), the details folded so the question is in view"""
    await blank(c)
    await c.pg.evaluate("document.querySelector('#detPanel [data-fold]') && document.querySelector('#detPanel [data-fold]').click()")
    await c.pg.click("[data-add=mcq]" if mcq else "[data-add=q]"); await c.pg.wait_for_timeout(400)
    if text:
        await c.pg.locator(".card").last.locator("textarea[data-f=text]").fill(text)
        await c.pg.locator(".card").last.locator("textarea[data-f=text]").dispatch_event("input")
    await c.pg.evaluate("document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0)"); await c.pg.wait_for_timeout(1200)
    await c.pg.mouse.move(400, 600)

LAST = ".card >> nth=-1 >> "

@clip
async def q_maths(b):
    async with Clip(b, "q_maths") as c:
        await one_q(c); await c.go()
        await c.click(LAST + "textarea[data-f=text]", wait=300)
        await c.type("Pythagoras: for a right-angled triangle, ", delay=55, wait=600)
        await c.click(LAST + "[data-ins] >> nth=0", wait=600); await c.click(LAST + ".ins-it[data-act=eq]", wait=1200)
        await c.click("#mfHost", wait=300)
        for t, k in [("a^2", "ArrowRight"), ("+b^2", "ArrowRight"), ("=c^2", None)]:
            await c.type(t, delay=120, wait=150)
            if k: await c.pg.keyboard.press(k)
        await c.wait(0.8); await c.click("#eqInsert", wait=1800)

@clip
async def q_format(b):
    async with Clip(b, "q_format", crop=(0, 60, 760, 520)) as c:
        await one_q(c, "Explain why the moon looks different each night. Use the word orbit in your answer."); await c.go()
        ta = c.pg.locator(".card").last.locator("textarea[data-f=text]")
        await c.move(LAST + "textarea[data-f=text]")
        await ta.evaluate("t => { const i = t.value.indexOf('orbit'); t.focus(); t.setSelectionRange(i, i + 5); }"); await c.wait(0.6)
        await c.click(LAST + "[data-fmt=b]", wait=900)
        await ta.evaluate("t => { const i = t.value.indexOf('moon'); t.focus(); t.setSelectionRange(i, i + 4); }"); await c.wait(0.4)
        await c.click(LAST + "[data-fmt=u]", wait=1500)

@clip
async def q_subparts(b):
    async with Clip(b, "q_subparts") as c:
        await one_q(c, "A shop sells pens for $1.20 each."); await c.go()
        await c.click(LAST + "[data-act=subadd]", wait=600); await c.type("How much do 5 pens cost?", delay=45)
        await c.click(LAST + ".sub >> nth=-1 >> [data-sf=marks]"); await c.type("1")
        await c.click(LAST + "[data-act=subadd] >> nth=-1", wait=600); await c.type("How many pens can you buy with $10?", delay=45)
        await c.click(LAST + ".sub >> nth=-1 >> [data-sf=marks]"); await c.type("2", wait=1500)

@clip
async def q_space(b):
    async with Clip(b, "q_space") as c:
        await one_q(c, "Plot the points A(2, 3) and B(-1, 4).")
        await c.pg.locator(".card").last.locator("[data-f=lines]").fill("6"); await c.pg.locator(".card").last.locator("[data-f=lines]").dispatch_event("input"); await c.wait(1); await c.go()
        sel = c.pg.locator(".card").last.locator("[data-f=space]")
        for v in ["grid", "box", "numberline", "axes"]:
            await c.move(LAST + "[data-f=space]"); await sel.select_option(v); await c.say({"grid": "Grid", "box": "Box", "numberline": "Number line", "axes": "Coordinate grid"}[v], 1400); await c.wait(1.8)

@clip
async def q_answer(b):
    async with Clip(b, "q_answer") as c:
        await one_q(c, "Name the gas plants take in for photosynthesis."); await c.go()
        await c.click(LAST + "[data-act=showans]", wait=500); await c.type("Carbon dioxide (CO₂)", delay=55, wait=500)
        await c.click("#pvKey", wait=2000)

@clip
async def q_more(b):
    async with Clip(b, "q_more") as c:
        await one_q(c, "$\\frac{1}{2} + \\frac{1}{4} = $ ______")
        await c.pg.click("[data-add=q]"); await c.pg.wait_for_timeout(300)
        await c.pg.locator(".card").last.locator("textarea[data-f=text]").fill("$\\frac{2}{3} - \\frac{1}{6} = $ ______"); await c.pg.locator(".card").last.locator("textarea[data-f=text]").dispatch_event("input")
        await c.pg.evaluate("document.activeElement.blur(); window.scrollTo(0,0)"); await c.wait(1.2); await c.go()
        for n in [0, 1]:
            await c.click(f".card >> nth={n} >> .ins-wrap.adv [data-ins]", wait=600); await c.click(f".card >> nth={n} >> .ins-it[data-act=half]", wait=1100)

@clip
async def q_arrange(b):
    async with Clip(b, "q_arrange") as c:
        await open_bee(c, "full"); await c.go()
        await c.click("[data-add=arrange]", wait=1500)
        await c.click("#mvFrom"); await c.type("9", delay=120); await c.click("#mvTo"); await c.type("7", delay=120)
        await c.click("#mvGo", wait=2200)

@clip
async def q_find(b):
    async with Clip(b, "q_find", crop=(240, 80, 800, 560)) as c:
        await open_bee(c, "full"); await c.go()
        await c.click("#frBtn", wait=700); await c.click("#frFind"); await c.type("Calculate", delay=70)
        await c.click("#frRep"); await c.type("Work out", delay=70, wait=1500)

@clip
async def q_text(b):
    async with Clip(b, "q_text") as c:
        await blank(c); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.5); await c.go()
        await c.click("[data-add=n]", wait=500)
        await c.type("Read the passage, then answer questions 1 to 3.\n\nThe honeybee visits about a hundred flowers on each trip. Back at the hive, it dances to show the others where the flowers are.", delay=22, wait=500)
        await c.click("[data-add=sub]", wait=500); await c.type("A. Understanding the text", delay=50, wait=1500)

# ---------------------------------------------------------------- inserting things
async def insert(c, act):
    await c.click(LAST + ".ins-wrap:not(.adv) [data-ins]", wait=600); await c.click(LAST + f".ins-it[data-act={act}]", wait=900)

@clip
async def ins_menu(b):
    async with Clip(b, "ins_menu", crop=(0, 60, 760, 560)) as c:
        await one_q(c, "Look at the table."); await c.go()
        await c.click(LAST + ".ins-wrap:not(.adv) [data-ins]", wait=2200)

@clip
async def ins_table(b):
    async with Clip(b, "ins_table") as c:
        await one_q(c, "Complete the table.\n"); await c.go()
        await c.click(LAST + "textarea[data-f=text]"); await c.pg.keyboard.press("Control+End")
        c.pg.once("dialog", lambda dlg: asyncio.ensure_future(dlg.accept("3x3")))
        await insert(c, "table"); await c.say("Rows × columns: 3x3", 1600); await c.wait(1.8)
        ta = c.pg.locator(".card").last.locator("textarea[data-f=text]")
        await ta.fill("Complete the table.\n| Fraction | Decimal | Percent |\n|---|---|---|\n| 1/2 | 0.5 |   |\n| 3/4 |   | 75% |"); await ta.dispatch_event("input")
        await c.say("Type between the | bars", 1800); await c.wait(2.5)

@clip
async def ins_graph(b):
    async with Clip(b, "ins_graph") as c:
        await one_q(c, "The graph shows $y = x^2 - 4$. Where does it cross the x-axis?\n"); await c.go()
        await c.click(LAST + "textarea[data-f=text]"); await c.pg.keyboard.press("Control+End")
        await insert(c, "graph")
        await c.click("#gFuncs"); await c.pg.keyboard.press("Control+A"); await c.type("x^2 - 4", delay=90, wait=1200)
        await c.click("#gInsert", wait=2000)

@clip
async def ins_mol(b):
    async with Clip(b, "ins_mol") as c:
        await one_q(c, "Name this molecule.\n"); await c.go()
        await c.click(LAST + "textarea[data-f=text]"); await c.pg.keyboard.press("Control+End")
        await insert(c, "mol")
        await c.click("#molSmi"); await c.type("CCO", delay=150, wait=1200)
        await c.click("#molGo", wait=2000)

@clip
async def ins_picture(b):
    async with Clip(b, "ins_picture") as c:
        await one_q(c, "Find the length of the side marked x.\n"); await c.go()
        await c.click(LAST + "textarea[data-f=text]"); await c.pg.keyboard.press("Control+End")
        await c.click(LAST + ".ins-wrap:not(.adv) [data-ins]", wait=600)
        async with c.pg.expect_file_chooser() as fc: await c.click(LAST + ".ins-it[data-act=inspic]", wait=300)
        await (await fc.value).set_files(TRI); await c.wait(1.5)
        await c.move(LAST + "[data-picsize]"); await c.pg.locator(".card").last.locator("[data-picsize]").first.select_option("40"); await c.wait(1.2)
        await c.move(LAST + "[data-picalign]"); await c.pg.locator(".card").last.locator("[data-picalign]").first.select_option("wrap-right"); await c.say("Text beside the picture", 1500); await c.wait(2)

@clip
async def ins_row(b):
    async with Clip(b, "ins_row") as c:
        await one_q(c, "Compare the two pictures.\n"); 
        for f in [TRI, CHART]:
            await c.pg.click(".card >> nth=-1 >> textarea[data-f=text]"); await c.pg.keyboard.press("Control+End")
            await c.pg.locator(".card").last.locator(".ins-wrap:not(.adv) [data-ins]").click()
            async with c.pg.expect_file_chooser() as fc: await c.pg.locator(".card").last.locator(".ins-it[data-act=inspic]").click()
            await (await fc.value).set_files(f); await c.pg.wait_for_timeout(900)
        await c.pg.evaluate("document.activeElement.blur(); window.scrollTo(0,0)"); await c.wait(1); await c.go()
        await c.click(LAST + "[data-picrow]", wait=2200)

@clip
async def ins_pdf(b):
    async with Clip(b, "ins_pdf") as c:
        await one_q(c, "Use the diagram.\n"); await c.go()
        await c.click(LAST + "textarea[data-f=text]"); await c.pg.keyboard.press("Control+End")
        await c.click(LAST + ".ins-wrap:not(.adv) [data-ins]", wait=600)
        await c.click(LAST + ".ins-it[data-act=cutpdfins]", wait=900)
        if await c.pg.locator("#cutChoose").is_visible():
            async with c.pg.expect_file_chooser() as fc: await c.click("#cutChoose", wait=300)
            await (await fc.value).set_files(os.path.join(ASSETS, "worksheet.pdf")); await c.wait(2.5)
        bb = await c.pg.locator("#cutStage").bounding_box()
        cv = await c.pg.locator("#cutCanvas").bounding_box()
        x0, y0 = cv["x"] + cv["width"] * 0.2, cv["y"] + cv["width"] * 1.414 * 0.145
        x1, y1 = cv["x"] + cv["width"] * 0.8, cv["y"] + cv["width"] * 1.414 * 0.46
        await c.moveto(x0, y0); await c.pg.mouse.down(); await c.pg.mouse.move(x1, y1, steps=30); await c.pg.mouse.up(); await c.wait(0.8)
        await c.click("#cutGo", wait=2000)

# ---------------------------------------------------------------- AI, photos
PASTE = """Part I: Quick check [6]
1. What is the capital of France? [1] {mcq}
a) Berlin
b) Madrid
c) Paris {correct}
d) Rome
2. Explain why we have seasons on Earth. [3] {lines: 4}
Model answer: The Earth is tilted, so each half gets more direct sunlight for part of the year.
3. Work out $\\frac{3}{4}$ of 24. [2] {lines: 2}
Model answer: 18"""

@clip
async def ai_prompts(b):
    async with Clip(b, "ai_prompts") as c:
        await blank(c); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.5); await c.go()
        await c.click("#qPrompts > summary", wait=900)
        await c.click("#qPrompts [data-p=gen]", wait=1500)
        await c.click("#promptCopy", wait=1600)

@clip
async def ai_paste(b):
    async with Clip(b, "ai_paste") as c:
        await blank(c); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.5); await c.go()
        await c.click("#tilePaste", wait=900)
        await c.click("#pasteArea"); await c.pg.fill("#pasteArea", PASTE); await c.pg.dispatch_event("#pasteArea", "input"); await c.say("Paste what the AI wrote", 1500); await c.wait(1.8)
        await c.click("#pasteGo", wait=2600)

@clip
async def photos(b):
    async with Clip(b, "photos") as c:
        await blank(c); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.5); await c.go()
        await c.click("#tilePhoto", wait=900)
        if await c.pg.locator("#photoAskModal.open").count():
            async with c.pg.expect_file_chooser() as fc: await c.click("[data-pm=image]", wait=300)
        else:
            async with c.pg.expect_file_chooser() as fc: await c.wait(0.1)
        await (await fc.value).set_files([TRI, CHART]); await c.wait(2.5)

# ---------------------------------------------------------------- the look of the paper
@clip
async def look(b):
    async with Clip(b, "look") as c:
        await open_bee(c, "simple"); await c.go()
        await c.click('[data-tab="look"]', wait=800)
        for k in ["style", "palette"]:
            loc = c.pg.locator(f'#detPanel [data-k="{k}"]').first
            if await loc.count() and await loc.evaluate("e => e.tagName") == "SELECT":
                opts = await loc.evaluate("e => [...e.options].map(o => o.value)")
                await c.move(f'#detPanel [data-k="{k}"]')
                for v in opts[1:3]: await loc.select_option(v); await c.wait(1.6)
        await c.wait(0.5)

@clip
async def printing(b):
    async with Clip(b, "printing") as c:
        await open_bee(c, "simple"); await c.go()
        await c.click('[data-tab="print"]', wait=1200)
        loc = c.pg.locator('#detPanel [data-k="answerMode"]').first
        if await loc.evaluate("e => e.tagName") == "SELECT":
            await c.move('#detPanel [data-k="answerMode"]'); await loc.select_option("sheet"); await c.say("Answers on a separate sheet", 1600); await c.wait(2.2)
        else:
            await c.click('#detPanel [data-k="answerMode"]', wait=2000)

@clip
async def rubric(b):
    async with Clip(b, "rubric") as c:
        await open_bee(c, "simple"); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.5); await c.go()
        await c.click("#rbPanel label.switch", wait=2500)

@clip
async def accommodations(b):
    async with Clip(b, "accommodations") as c:
        await open_bee(c, "simple"); await c.go()
        await c.click("#dlMenuBtn", wait=700); await c.click("[data-dl=dys]", wait=1500)
        await c.click("#dysCream", wait=800); await c.wait(1)

@clip
async def versions(b):
    async with Clip(b, "versions") as c:
        await open_bee(c, "simple"); await c.go()
        await c.click("#dlMenuBtn", wait=700); await c.click("[data-dl=versions]", wait=2500)

# ---------------------------------------------------------------- saving
@clip
async def save_chip(b):
    async with Clip(b, "save_chip") as c:
        await c.pg.add_init_script(FAKE_SAVE); await open_bee(c, "simple"); await c.go()
        await c.move("#saveChip"); await c.wait(0.8); await c.click("#saveChip", wait=800)
        await c.pg.fill("#svName", ""); await c.click("#svName"); await c.type("Science quiz - Grade 6", delay=50)
        await c.click("#svGo", wait=1600); await c.move("#saveChip"); await c.wait(1)

@clip
async def undo(b):
    async with Clip(b, "undo") as c:
        await open_bee(c, "simple"); await c.pg.evaluate("document.querySelector('#detPanel [data-fold]').click()"); await c.wait(0.8); await c.go()
        await c.click(".card >> nth=1 >> [data-act=del]", wait=1500)
        await c.click("#btnUndo", wait=1800)

@clip
async def history(b):
    async with Clip(b, "history") as c:
        await open_bee(c, "simple"); await c.pg.evaluate("snapHist && snapHist(true)") if False else None
        await c.go()
        await c.click("#btnHistory", wait=2500)

@clip
async def file_menu(b):
    async with Clip(b, "file_menu", crop=(760, 0, 520, 420)) as c:
        await open_bee(c, "simple"); await c.go()
        await c.click("#fileMenu > summary", wait=2000)

# ---------------------------------------------------------------- exams on computers
TESTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tests")
sys.path.insert(0, TESTS)
STU = "/tmp/g/stu"; os.makedirs(STU, exist_ok=True)
SC, TC = "ABCD-2345", "135790"
STU_SETUP = "() => { $('#stuRead').checked = true; $('#stuRead').dispatchEvent(new Event('change', {bubbles:true})); const d = $('#stuDraw'); if (d) { d.checked = true; d.dispatchEvent(new Event('change', {bubbles:true})); } $('#stuCalc').value = 'graphing'; }"
READ_SETUP = "() => { const r = document.querySelector('input[name=stuMode][value=read]'); r.checked = true; r.dispatchEvent(new Event('change', {bubbles:true})); }"

async def student_files(b):
    """the student files and the school key the clips use (made once)"""
    f, rf, kf = f"{STU}/exam.html", f"{STU}/read.html", f"{STU}/school.beekey"
    if all(os.path.exists(x) for x in (f, rf, kf)): return f, rf, kf
    from tstudent import make_student_file, export_student
    ctx, pg, errs, d = await make_student_file(b, code=SC, tcode=TC, extra="0", setup=STU_SETUP)
    await d.save_as(f)
    for k in getattr(pg, "__keys", None) or []: await k.save_as(kf)
    if not os.path.exists(kf):
        async with pg.expect_download() as dk: await pg.evaluate("openKeyModal()"); await pg.wait_for_timeout(300); await pg.click("#keyBackup")
        await (await dk.value).save_as(kf)
    await pg.evaluate("document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); openStudentDialog()"); await pg.wait_for_timeout(400)
    await pg.evaluate(READ_SETUP); await pg.fill("#stuCode", "READ-2345"); await pg.fill("#stuTCode", TC)
    d2, _ = await export_student(pg); await d2.save_as(rf)
    await ctx.close(); return f, rf, kf

NO_FS = """(() => { let fs = null;
  Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get(){ return fs; } });
  Element.prototype.requestFullscreen = async function(){ fs = this; };
  Document.prototype.exitFullscreen = async function(){ fs = null; };
})();"""   # the recording stays the window's size (a real full screen would shrink it)

async def student_in(c, f, code=SC, name="Léa Martin"):
    await c.pg.add_init_script(NO_FS)
    await c.pg.goto("file://" + f); await c.pg.wait_for_timeout(1300)
    if name and await c.pg.is_visible("#stName"): await c.pg.fill("#stName", name)
    await c.pg.fill("#stCode", code); await c.pg.click("#stGo"); await c.pg.wait_for_timeout(2600)
    await c.pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.classList.add('hidden'))"); await c.pg.mouse.move(640, 400)

@clip
async def stu_dialog(b):
    async with Clip(b, "stu_dialog") as c:
        await open_bee(c, "full"); await c.go()
        await c.click("#dlMenuBtn", wait=700); await c.click("[data-dl=student]", wait=1500)
        await c.click("#stuRead", wait=700)
        await c.move("#stuCalc"); await c.pg.select_option("#stuCalc", "graphing"); await c.say("🧮 Calculator: BEEcalc Graphing", 1500); await c.wait(1.6)
        await c.move("#stuCode"); await c.say("Start code: give it to the students", 1700); await c.wait(1.8)
        await c.move("#stuTCode"); await c.say("Teacher code: keep it to yourself", 1700); await c.wait(1.8)
        await c.move("#stuGo"); await c.wait(1)

@clip
async def stu_start(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_start") as c:
        await c.pg.add_init_script(NO_FS); await c.pg.goto("file://" + f); await c.pg.wait_for_timeout(1300); await c.go()
        await c.click("#stName"); await c.type("Léa Martin", delay=70)
        await c.click("#stCode"); await c.type(SC, delay=90)
        await c.click("#stGo", wait=3000)
        await c.click("textarea >> nth=0"); await c.type("27", delay=150, wait=1200)

@clip
async def stu_answers(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_answers") as c:
        await student_in(c, f)
        await c.pg.evaluate("document.querySelectorAll('.q')[3].scrollIntoView({block:'start'}); scrollBy(0,-80)"); await c.wait(0.6); await c.go()
        q = ".q >> nth=3 >> "
        await c.click(q + "[data-add=math]", wait=700); await c.type("x^2+2x", delay=110, wait=900)
        await c.click(q + "[data-flag]", wait=1200)
        await c.click(".nav [data-q] >> nth=3", wait=1500) if await c.pg.locator(".nav [data-q]").count() else None

@clip
async def stu_draw(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_draw") as c:
        await student_in(c, f)
        await c.pg.evaluate("document.querySelectorAll('.q')[1].scrollIntoView({block:'start'}); scrollBy(0,-80)"); await c.wait(0.6); await c.go()
        await c.click(".q >> nth=1 >> [data-add=draw]", wait=1000)
        if await c.pg.locator(".pad [data-paper=grid]").count(): await c.click(".pad [data-paper=grid]", wait=700)
        bb = await c.pg.locator(".pad canvas").first.bounding_box()
        x, y, w, h = bb["x"], bb["y"], bb["width"], bb["height"]
        await c.moveto(x + w * .15, y + h * .75); await c.pg.mouse.down()
        for k in range(1, 31): await c.pg.mouse.move(x + w * (.15 + .022 * k), y + h * (.75 - .55 * (1 - ((k - 15) / 15) ** 2)), steps=2)
        await c.pg.mouse.up(); await c.wait(0.4)
        await c.click(".pad [data-tool=line]", wait=300); await c.click(".pad [data-col] >> nth=2", wait=300)
        await c.moveto(x + w * .1, y + h * .78); await c.pg.mouse.down(); await c.pg.mouse.move(x + w * .9, y + h * .78, steps=25); await c.pg.mouse.up(); await c.wait(0.6)
        await c.click(".pad [data-tool=text]", wait=300); await c.click(".pad [data-col] >> nth=0", wait=200)
        await c.moveto(x + w * .55, y + h * .3); await c.pg.mouse.down(); await c.pg.mouse.up(); await c.wait(0.4)
        await c.type("path of", delay=90); await c.pg.keyboard.press("Enter"); await c.type("the ball", delay=80, wait=500)
        await c.moveto(x + w * .9, y + h * .9); await c.pg.mouse.down(); await c.pg.mouse.up(); await c.wait(0.6)
        await c.click(".pad [data-done]", wait=1500)

@clip
async def stu_tools(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_tools") as c:
        await student_in(c, f); await c.go()
        await c.click("#bView", wait=1000)
        await c.click("[data-pref=size] [data-v='20']", wait=900); await c.click("[data-pref=colour] [data-v=cream]", wait=900)
        await c.click("[data-pref=font] [data-v=easy]", wait=1200)
        await c.pg.keyboard.press("Escape"); await c.pg.evaluate("document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'))"); await c.wait(0.5)
        await c.click("#bRuler", wait=600); await c.moveto(600, 420, steps=20); await c.moveto(620, 520, steps=25); await c.wait(0.6)
        await c.click("#bRuler", wait=500)

@clip
async def stu_highlight(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_highlight") as c:
        await student_in(c, f); await c.pg.evaluate("document.querySelectorAll('.q')[0].scrollIntoView({block:'center'})"); await c.wait(0.5); await c.go()
        await c.click("#bHigh", wait=600)
        t = c.pg.locator(".q").nth(6).locator(".rich").first
        await t.scroll_into_view_if_needed(); bb = await t.bounding_box()
        await c.moveto(bb["x"] + 4, bb["y"] + 10); await c.pg.mouse.down(); await c.pg.mouse.move(bb["x"] + min(260, bb["width"] - 10), bb["y"] + 10, steps=25); await c.pg.mouse.up(); await c.wait(1.5)

@clip
async def stu_lock(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_lock") as c:
        await student_in(c, f); await c.go()
        await c.say("The student leaves the test window…", 1600); await c.wait(1.2)
        await c.pg.evaluate("left('test')"); await c.wait(2)
        await c.click("#lkCode"); await c.type(TC, delay=110)
        await c.click("#lkGo", wait=1800)

@clip
async def stu_teacher(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_teacher") as c:
        await student_in(c, f); await c.go()
        await c.click("#bTeacher", wait=800); await c.click("#tCode"); await c.type(TC, delay=100)
        await c.click("#tOk", wait=1200)
        await c.click("#tMenu [data-add='10']", wait=1400)
        await c.move("#tCalc"); await c.wait(0.6); await c.move("#tEnd"); await c.wait(1)

@clip
async def stu_end(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "stu_end") as c:
        await student_in(c, f, name="Tom Durand")
        await c.pg.locator("textarea").first.fill("27"); await c.pg.locator("textarea").first.dispatch_event("input"); await c.wait(0.5); await c.go()
        await c.click("#bEnd", wait=1500)
        async with c.pg.expect_download(timeout=60000) as dl: await c.click("#endGo", wait=2500)
        await (await dl.value).save_as(f"{STU}/tom.bee-answers")

@clip
async def answers_open(b):
    f, rf, kf = await student_files(b)
    if not os.path.exists(f"{STU}/tom.bee-answers"): await stu_end(b)
    async with Clip(b, "answers_open") as c:
        await open_bee(c, "full")
        await c.pg.evaluate("openKeyModal()"); await c.pg.wait_for_timeout(400)
        async with c.pg.expect_file_chooser() as fc: await c.pg.click("#keyImport")
        await (await fc.value).set_files(kf); await c.pg.wait_for_selector("#pwModal.open"); await c.pg.fill("#pw1", "Ruche-2026!"); await c.pg.click("#pwGo"); await c.wait(1.5)
        await c.pg.evaluate("document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'))"); await c.wait(0.5); await c.go()
        await c.click("#dlMenuBtn", wait=700)
        async with c.pg.expect_file_chooser() as fc: await c.click("[data-dl=answers]", wait=600)
        await (await fc.value).set_files(f"{STU}/tom.bee-answers"); await c.wait(3)
        await c.move("[data-anspdf] >> nth=0"); await c.wait(1.2)

# ---------------------------------------------------------------- read aloud
FAKE_TTS = """(() => { const f = { speaking: false, paused: false, q: [], speak(u){ this.q.push(u); this.speaking = true; }, cancel(){ this.q = []; this.speaking = false; },
  pause(){ this.paused = true; }, resume(){ this.paused = false; }, getVoices(){ return []; }, addEventListener(){} };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: f }); })();"""

@clip
async def read_computer(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "read_computer") as c:
        await c.pg.add_init_script(FAKE_TTS); await student_in(c, f); await c.go()
        await c.click("#bReadAll", wait=2200)
        await c.click("#ttsNext", wait=1600)
        await c.click("#ttsStop", wait=600)
        await c.click("[data-say] >> nth=5", wait=1800)

@clip
async def read_version(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "read_version") as c:
        await c.pg.add_init_script(FAKE_TTS); await student_in(c, rf, code="READ-2345", name=None); await c.go()
        await c.click("#bReadAll", wait=2400)
        await c.move("#ttsRate"); await c.wait(1.5)

@clip
async def record_voice(b):
    async with Clip(b.__mic, "record_voice") as c:
        await open_bee(c, "simple"); await c.go()
        await c.click("#dlMenuBtn", wait=600); await c.click("[data-dl=student]", wait=1200)
        await c.click("#stuRecBtn", wait=1300)
        await c.click("#recList .rec-item >> nth=1 >> [data-rec]", wait=2600)
        await c.click("#recList .rec-item >> nth=1 >> [data-rec]", wait=1400)
        await c.click("#recList .rec-item >> nth=1 >> [data-play]", wait=1500)

# ---------------------------------------------------------------- calculator
async def calc_open(c, kind=None):
    f, rf, kf = await student_files(c.b)
    await student_in(c, f)
    if kind:
        await c.pg.click("#bTeacher"); await c.pg.fill("#tCode", TC); await c.pg.click("#tOk"); await c.pg.wait_for_timeout(300)
        await c.pg.select_option("#tCalc", kind); await c.pg.wait_for_timeout(300); await c.pg.click("#tMenu [data-close]"); await c.pg.wait_for_timeout(300)
        await c.pg.evaluate("document.querySelectorAll('.toast').forEach(t => t.classList.add('hidden'))")

@clip
async def calc_choose(b):
    async with Clip(b, "calc_choose", crop=(200, 60, 880, 680)) as c:
        await open_bee(c, "full"); await c.pg.click("#dlMenuBtn"); await c.pg.click("[data-dl=student]"); await c.wait(1)
        await c.pg.evaluate("document.querySelector('#stuCalcRow').scrollIntoView({block:'center'})"); await c.wait(0.4); await c.go()
        await c.move("#stuCalc")
        for v, l in [("basic", "BEEcalc Basic"), ("scientific", "BEEcalc Scientific"), ("graphing", "BEEcalc Graphing"), ("desmos", "Desmos Graphing (needs internet)")]:
            await c.pg.select_option("#stuCalc", v); await c.say(l, 1200); await c.wait(1.3)

@clip
async def calc_scientific(b):
    async with Clip(b, "calc_scientific") as c:
        await calc_open(c, "scientific"); await c.go()
        await c.click("#bCalc", wait=900)
        for k in ["7", "×", "8", "−", "6", "="]: await c.click(f".bc-k[data-k='{k}']", wait=250, steps=12)
        await c.wait(0.6); await c.click(".bc-in"); await c.type("3/4 + 1/8", delay=100); await c.pg.keyboard.press("Enter"); await c.wait(1)
        await c.click(".bc-k[data-k='S⇔D']", wait=900) if await c.pg.locator(".bc-k[data-k='S⇔D']").count() else None
        await c.click(".bc-in"); await c.type("sin(30)", delay=100); await c.pg.keyboard.press("Enter"); await c.wait(1.2)

async def gtype(c, i, text):
    if i == 0: await c.click(".bg-it:nth-child(1) .bg-in")
    else: await c.click("[data-add=expr]", wait=300)
    await c.type(text, delay=80, wait=700)

@clip
async def calc_graph(b):
    async with Clip(b, "calc_graph") as c:
        await calc_open(c); await c.go()
        await c.click("#bCalc", wait=900)
        await gtype(c, 0, "y = x^2 - 4"); await gtype(c, 1, "y = 2x + 1"); await c.wait(0.5)
        cv = await c.pg.locator(".bg-plot canvas").bounding_box()
        await c.moveto(cv["x"] + cv["width"] * .62, cv["y"] + cv["height"] * .25); await c.wait(1.2)

@clip
async def calc_curves(b):
    async with Clip(b, "calc_curves") as c:
        await calc_open(c); await c.pg.click("#bCalc"); await c.wait(0.6); await c.go()
        await gtype(c, 0, "x^2 + y^2 = 25"); await gtype(c, 1, "y < 2x + 1"); await gtype(c, 2, "r = 4cos(2θ)"); await c.wait(1)

@clip
async def calc_sliders(b):
    async with Clip(b, "calc_sliders") as c:
        await calc_open(c); await c.pg.click("#bCalc"); await c.wait(0.6); await c.go()
        await gtype(c, 0, "y = m x + b"); await c.wait(0.5)
        if await c.pg.locator("[data-slider]").count():
            await c.click("[data-slider] >> nth=0", wait=600); await c.click("[data-slider] >> nth=0", wait=900) if await c.pg.locator("[data-slider]").count() else None
        r = c.pg.locator(".bg-it input[type=range]").first
        if await r.count():
            bb = await r.bounding_box(); await c.moveto(bb["x"] + bb["width"] * .5, bb["y"] + bb["height"] / 2); await c.pg.mouse.down()
            await c.pg.mouse.move(bb["x"] + bb["width"] * .9, bb["y"] + bb["height"] / 2, steps=25); await c.pg.mouse.move(bb["x"] + bb["width"] * .2, bb["y"] + bb["height"] / 2, steps=35); await c.pg.mouse.up()
        await c.wait(1)

@clip
async def calc_data(b):
    async with Clip(b, "calc_data") as c:
        await calc_open(c); await c.pg.click("#bCalc"); await c.wait(0.6); await c.go()
        await c.click("[data-add=table]", wait=700)
        tid = await c.pg.evaluate("CALC.ui.state.items.filter(i => i.type === 'table').pop().id")
        for r, (x, y) in enumerate([("-3", "-4.1"), ("-2", "-2.2"), ("-1", "0.3"), ("0", "1.9"), ("1", "3.2"), ("2", "5.1")]):
            await c.click(f".bg-it[data-id='{tid}'] input[data-r='{r}'][data-c='0']", steps=8); await c.type(x, delay=60, wait=80)
            await c.click(f".bg-it[data-id='{tid}'] input[data-r='{r}'][data-c='1']", steps=8); await c.type(y, delay=60, wait=80)
        await c.move(f".bg-it[data-id='{tid}'] select[data-act=fit]"); await c.pg.select_option(f".bg-it[data-id='{tid}'] select[data-act=fit]", "Linear"); await c.say("Fit ▾ Linear", 1400); await c.wait(1.8)
        await c.click(f".bg-it[data-id='{tid}'] [data-act=stats]", wait=1800)

@clip
async def calc_stats(b):
    async with Clip(b, "calc_stats") as c:
        await calc_open(c); await c.pg.click("#bCalc"); await c.wait(0.6); await c.go()
        await gtype(c, 0, "L = [1, 2, 2, 3, 4, 5, 7]"); await gtype(c, 1, "boxplot(L)"); await gtype(c, 2, "histogram(L, 2)"); await c.wait(1)

@clip
async def calc_teacher(b):
    f, rf, kf = await student_files(b)
    async with Clip(b, "calc_teacher") as c:
        await student_in(c, f); await c.go()
        await c.click("#bTeacher", wait=700); await c.click("#tCode"); await c.type(TC, delay=90); await c.click("#tOk", wait=900)
        await c.move("#tCalc"); await c.pg.select_option("#tCalc", "scientific"); await c.wait(1.2)
        await c.click("#tMenu [data-close]", wait=900); await c.click("#bCalc", wait=1600)

# ---------------------------------------------------------------- stills
@clip
async def editor_map(b):
    """the main screen, and where its parts are (in % of the picture) for the numbered pins on the welcome page"""
    import json
    async with Clip(b, "editor_map") as c:
        await open_bee(c, "simple")
        await c.pg.evaluate("document.querySelector('#detPanel [data-fold]').click()")
        await c.pg.mouse.move(1300, 900); await c.wait(1)
        await shot(c.pg, "editor_map")
        pos = await c.pg.evaluate("""(() => { const P = {}, at = (k, s, dx, dy) => { const e = document.querySelector(s); if (!e) return; const r = e.getBoundingClientRect(); P[k] = [Math.round((r.left + r.width * (dx ?? .5)) / innerWidth * 1000) / 10, Math.round((r.top + r.height * (dy ?? .5)) / innerHeight * 1000) / 10]; };
          at('details', '#detPanel', 0, 0); at('questions', 'section.panel:not(#detPanel):not(#rbPanel)', 0, 0); at('preview', '#pvKey', 0, 0); { const h = [...document.querySelectorAll('h2')].find(x => /Preview/.test(x.textContent)), pv = h && h.parentElement; if (pv) { const r = pv.getBoundingClientRect(); P.preview = [Math.round(r.left / innerWidth * 1000) / 10, Math.round(r.top / innerHeight * 1000) / 10]; } }; at('save', '#saveChip', .5, 1.35); at('mode', '#btnMode', .5, 1.45); at('undo', '#btnUndo', .5, 1.45); at('history', '#btnHistory', .5, 1.45); at('file', '#fileMenu > summary', .5, 1.45); at('download', '#dlMenuBtn', .5, 1.35); return P; })()""")
        json.dump(pos, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "guide", "media", "editor_map.json"), "w"))
        print(pos); await c.go(0)

async def main(names):
    async with async_playwright() as p:
        b = await p.chromium.launch()
        b.__mic = await p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        for n in names or CLIPS:
            await CLIPS[n](b)
        await b.close()

if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:]))
