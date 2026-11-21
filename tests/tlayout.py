"""Compact layout: folding sections, the formatting bar only on the card being edited, the colour button,
hiding and resizing the preview. Needs the website on 127.0.0.1:8765 (run_all.py does this)."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import chrome
from playwright.async_api import async_playwright

res = []
def ok(name, cond, info=""):
    res.append(bool(cond)); print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   → {info}"), flush=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**chrome()); ctx = await b.new_context(viewport={"width": 1440, "height": 900}); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://127.0.0.1:8765/"); await pg.wait_for_timeout(1500)
        async with ctx.expect_page() as np: await pg.click("#stGuide")
        gp = await np.value; await gp.wait_for_load_state()
        ok("📖 Teacher guide on the start screen opens the guide in a new window", "guide.html" in gp.url and "Your first exam in 5 steps" in await gp.text_content("main"), gp.url)
        await gp.close()
        ok("a new exam: Exam details open", not await pg.evaluate("$('#detPanel').classList.contains('folded')"))
        await pg.evaluate("$('#startModal').classList.remove('open'); loadDemo()"); await pg.wait_for_timeout(3000); await pg.evaluate("tourAt >= 0 && endTour()")
        st = await pg.evaluate("({ det: $('#detPanel').classList.contains('folded'), rb: $('#rbPanel').classList.contains('folded'), sum: $('#detSum').textContent, title: !!$('#detPanel [data-k=title]').offsetParent })")
        ok("an opened exam: Exam details and the rubric fold to one line", st["det"] and st["rb"] and "End-of-Term Examination" in st["sum"] and not st["title"], st)
        await pg.click("#detPanel .fold-btn"); await pg.wait_for_timeout(200)
        ok("▾ Open shows the fields again", await pg.is_visible("#detPanel [data-k=title]"))
        await pg.click("#detPanel .fold-btn")
        ok("…and the choice is remembered", await pg.evaluate("JSON.parse(localStorage.getItem('bee.fold')).detPanel === true"))
        await pg.click("#detPanel h2 .fold-sum"); await pg.wait_for_timeout(200)
        ok("clicking a folded section opens it", await pg.is_visible("#detPanel [data-k=title]"))
        # formatting bar only on the card being edited
        n0 = await pg.evaluate("[...document.querySelectorAll('#list .fmtbar')].filter(x => x.offsetParent).length")
        await pg.click("#list .card:not(.section) textarea[data-f=text] >> nth=2")
        n1 = await pg.evaluate("[...document.querySelectorAll('#list .fmtbar')].filter(x => x.offsetParent).length")
        ok("formatting bar: hidden until a card is being edited, then only on that card", n0 == 0 and n1 == 1, [n0, n1])
        card = "#list .card.editing"
        await pg.click(f"{card} [data-swtoggle]"); vis = await pg.is_visible(f"{card} .swpop [data-fmt=color] >> nth=1")
        await pg.click(f"{card} .swpop [data-fmt=color] >> nth=1"); await pg.wait_for_timeout(300)
        st = await pg.evaluate("(() => { const id = $('#list .card.editing').dataset.id; return { c: (S.items.find(i => i.id === id).fmt || {}).c || null, open: !!document.querySelector('.swdd.open') }; })()")
        ok("the colour button opens the colours; picking one colours the question and closes them", vis and st["c"] and not st["open"], [vis, st])
        await pg.click("#bottomBar [data-add=q]"); await pg.wait_for_timeout(300)
        ok("still only one formatting bar after the list is redrawn", await pg.evaluate("[...document.querySelectorAll('#list .fmtbar')].filter(x => x.offsetParent).length") == 1)
        # compact rows
        h = await pg.evaluate("(() => { const rows = [...document.querySelectorAll('#list .card:not(.editing) .qctl')].map(r => [...r.children].filter(c => c.tagName === 'LABEL').map(c => { const r = c.getBoundingClientRect(); return r.top + r.height / 2; })); return rows.filter(t => Math.max(...t) - Math.min(...t) < 10).length / rows.length; })()")
        ok("question settings fit on one line for most questions (1440 wide)", h > .7, h)
        ok("new names: ＋ (a) on cards, ＋ Sub-heading in the bar", await pg.locator("#list [data-act=subadd]").count() > 3 and "Sub-heading" in await pg.text_content("#bottomBar"))
        # preview: one-line header, resize, hide
        ok("preview header on one line", await pg.evaluate("$('.preview .bar').getBoundingClientRect().height") < 60)
        box = await pg.locator("#pvResize").bounding_box(); w0 = await pg.evaluate("$('.preview').getBoundingClientRect().width")
        await pg.mouse.move(box["x"] + 3, box["y"] + 200); await pg.mouse.down(); await pg.mouse.move(box["x"] - 150, box["y"] + 200, steps=5); await pg.mouse.up(); await pg.wait_for_timeout(300)
        w1 = await pg.evaluate("$('.preview').getBoundingClientRect().width")
        ok("dragging the preview's edge makes it wider, and it is remembered", w1 > w0 + 100 and await pg.evaluate("+localStorage.getItem('bee.pvw')") > 0, [w0, w1])
        await pg.dblclick("#pvResize"); await pg.wait_for_timeout(200)
        ok("double-click: back to the normal width", abs(await pg.evaluate("$('.preview').getBoundingClientRect().width") - w0) < 3)
        await pg.click("#pvHide"); await pg.wait_for_timeout(200)
        st = await pg.evaluate("({ pv: !!$('.preview').offsetParent, show: getComputedStyle($('#pvShow')).display !== 'none' })")
        ok("⇥ hides the preview; ◧ Preview brings it back", st == {"pv": False, "show": True}, st)
        await pg.click("#pvShow"); await pg.wait_for_timeout(300)
        ok("…the preview is back", await pg.is_visible(".preview"))
        # BEE open twice: both copies say so; closing one clears it
        ok("one copy of BEE: no warning", await pg.is_hidden("#tabsBanner"))
        p2 = await ctx.new_page(); await p2.goto("http://127.0.0.1:8765/"); await p2.wait_for_timeout(1500)
        both = [await pg.is_visible("#tabsBanner"), await p2.is_visible("#tabsBanner")]
        ok("BEE open in two tabs: both show the warning to save and close one", both == [True, True], both)
        await p2.close(); await pg.wait_for_timeout(500)
        ok("closing the other tab clears the warning", await pg.is_hidden("#tabsBanner"))
        # 🌱 Basic mode: only the everyday buttons; Full mode brings everything back; remembered
        await pg.click("#btnMode"); await pg.wait_for_timeout(200)
        st = await pg.evaluate("""({ basic: document.body.classList.contains('basic'), rubric: !!$('#rbPanel').offsetParent, look: !!$('#setTabs [data-tab=look]').offsetParent,
          sub: !!$('#bottomBar [data-add=sub]').offsetParent, q: !!$('#bottomBar [data-add=q]').offsetParent, more: [...document.querySelectorAll('#list [data-ins]')].filter(b => /More/.test(b.textContent) && b.offsetParent).length,
          ins: [...document.querySelectorAll('#list [data-ins]')].filter(b => /Insert/.test(b.textContent) && b.offsetParent).length, saved: localStorage.getItem('bee.basic') })""")
        ok("🌱 Basic: no rubric, Look tab, sub-headings or ⋯ More; questions, ＋ Insert stay; remembered", st == {"basic": True, "rubric": False, "look": False, "sub": False, "q": True, "more": 0, "ins": st["ins"], "saved": "1"} and st["ins"] > 0, st)
        await pg.click("#dlMenuBtn"); await pg.wait_for_timeout(200)
        dl = await pg.evaluate("[...document.querySelectorAll('#dlMenu [data-dl]')].filter(b => b.offsetParent).map(b => b.dataset.dl)")
        ok("🌱 Basic download menu: full exam, large print, easy-read, answer key", dl == ["full", "large", "dys", "key"], dl)
        await pg.click("#dlMenuBtn")
        rb = await pg.evaluate("(() => { const d = buildPDF({}); return d.getNumberOfPages(); })()")
        await pg.click("#btnMode"); await pg.wait_for_timeout(200)
        rb2 = await pg.evaluate("(() => { const d = buildPDF({}); return d.getNumberOfPages(); })()")
        ok("🐝 Full mode brings everything back; the PDF is the same in both modes", await pg.is_visible("#rbPanel") and rb == rb2, [rb, rb2])
        fb = await pg.evaluate("(() => { const a = document.querySelector('.wm .fb-link'), r = a.getBoundingClientRect(); return { href: a.href, text: a.textContent, target: a.target, hit: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === a }; })()")
        ok("💬 after © Jishnu opens the feedback form in a new tab", fb == {"href": "https://forms.cloud.microsoft/r/KXXUcfCRvs", "text": "💬", "target": "_blank", "hit": True}, fb)
        await pg.screenshot(path="layout.png")
        # 🧹 shared computers: remove my exams from this browser (the school key stays)
        await pg.evaluate("IDB.set('teacherKeys', [{kid: 'k1'}])"); await pg.wait_for_timeout(1500)
        before = await pg.evaluate("IDB.get('state').then(s => !!(s && s.items && s.items.length))")
        await pg.evaluate("openHistory()"); await pg.wait_for_timeout(300)
        await pg.click("#histModal [data-wipe]"); await pg.wait_for_timeout(200)
        ok("🧹 asks first, on top of everything", await pg.is_visible("#wipeModal #wipeGo"))
        await pg.click("#wipeGo"); await pg.wait_for_timeout(2500)
        st = await pg.evaluate("Promise.all([IDB.get('state'), IDB.get('versions'), IDB.get('handle'), IDB.get('teacherKeys')]).then(([s, v, h, k]) => ({ state: !!s, versions: !!(v && v.length), handle: !!h, key: !!(k && k.length), cont: !$('#stContinueLocal').classList.contains('hidden') }))")
        ok("🧹 removes the exam, its versions and the file link; the school key stays; no 'Continue' after", before and st == {"state": False, "versions": False, "handle": False, "key": True, "cont": False}, [before, st])
        await pg.click("#stWipe"); await pg.wait_for_timeout(200)
        ok("🧹 is on the start screen too", await pg.is_visible("#wipeModal #wipeGo"))
        ok("no page errors", not errs, errs[:3])
        await b.close()
    print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)

asyncio.run(main())
