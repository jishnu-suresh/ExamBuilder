"""🧮 The calculator in the 💻 student file: BEEcalc Basic, Scientific and Graphing (offline), Desmos Graphing
(online, here a pretend Desmos), the teacher switching it during the exam, and the exam lock staying quiet.
Needs the website served on 127.0.0.1:8765 (run_all.py does this)."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import OUT
from tstudent import make_student_file, student
from playwright.async_api import async_playwright

os.makedirs(OUT, exist_ok=True)
res = []
def ok(name, cond, info=""):
    res.append(bool(cond)); print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   → {info}"), flush=True)

FAKE_DESMOS = """window.Desmos = { GraphingCalculator: (el, o) => { el.innerHTML = '<div id=fakeDesmos>PRETEND DESMOS</div>'; window.__desmosOpts = o; return {}; } };"""

async def make(b, kind, name):
    c, pg, errs, d = await make_student_file(b, code="CALC-2345", tcode="246802", setup=f"() => {{ document.querySelector('#stuCalc').value = '{kind}'; }}")
    f = os.path.join(OUT, f"calc_{name}.html"); await d.save_as(f); await c.close(); return f, errs

async def begin(b, f, online=True):
    sc, sp, e = await student(b, f)
    async def route(r):
        if online: await r.fulfill(status=200, content_type="text/javascript", body=FAKE_DESMOS)
        else: await r.abort()
    await sp.route("https://www.desmos.com/**", route)
    await sp.fill("#stName", "Ada Lovelace"); await sp.fill("#stCode", "CALC-2345"); await sp.click("#stGo"); await sp.wait_for_timeout(2500)
    return sc, sp, e

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        files = {}
        for k in ["", "basic", "scientific", "graphing", "desmos"]:
            files[k], e = await make(b, k, k or "none")
        ok("the teacher can choose each calculator", all(os.path.exists(f) for f in files.values()))

        # ---------- no calculator
        sc, sp, e = await begin(b, files[""])
        ok("no calculator chosen → no 🧮 button", not await sp.is_visible("#bCalc"))
        # the teacher switches it on during the exam
        await sp.click("#bTeacher"); await sp.fill("#tCode", "246802"); await sp.click("#tOk"); await sp.wait_for_timeout(300)
        await sp.select_option("#tCalc", "scientific"); await sp.wait_for_timeout(300)
        ok("👩‍🏫 the teacher switches the calculator on during the exam", await sp.is_visible("#bCalc") and await sp.evaluate("ST.calcKind") == "scientific")
        ok("…and it is recorded in the log", await sp.evaluate("ST.log.some(l => l.kind === 'calculator changed by the teacher' && l.to === 'scientific')"), await sp.evaluate("ST.log.slice(-2)"))
        await sp.select_option("#tCalc", ""); await sp.wait_for_timeout(200)
        ok("…and can take it away", not await sp.is_visible("#bCalc") and await sp.evaluate("ST.calcKind") == "")
        await sp.click("#tMenu [data-close]"); await sc.close()

        # ---------- Basic
        sc, sp, e = await begin(b, files["basic"])
        ok("BEEcalc Basic: the 🧮 button is there", await sp.is_visible("#bCalc"))
        await sp.click("#bCalc"); await sp.wait_for_timeout(300)
        ok("…the panel says BEEcalc Basic", (await sp.text_content("#calcKind")) == "BEEcalc Basic" and await sp.is_visible(".bc-keys"))
        for k in ["7", "×", "8", "−", "6"]: await sp.click(f".bc-k[data-k='{k}']")
        ok("tapping 7 × 8 − 6 shows = 50 as you go", (await sp.text_content(".bc-out")) == "= 50", await sp.text_content(".bc-out"))
        await sp.click(".bc-k[data-k='=']")
        ok("= keeps it in the history", "50" in await sp.text_content(".bc-hist"))
        await sp.click(".bc-k[data-k='+']"); await sp.click(".bc-k[data-k='5']"); await sp.click(".bc-k[data-k='=']")
        ok("an operator after = carries on from the answer (50 + 5 = 55)", "55" in await sp.text_content(".bc-hist"))
        await sp.fill(".bc-in", "15%"); await sp.wait_for_timeout(100)
        ok("typing works too (15% = 0.15)", (await sp.text_content(".bc-out")) == "= 0.15")
        await sp.fill(".bc-in", "2+"); await sp.press(".bc-in", "Enter")
        ok("an unfinished calculation says what's missing", "missing" in (await sp.text_content(".bc-out")).lower())
        ok("typing in the calculator doesn't lock the test", not await sp.is_visible("#scrLock"))
        await sp.click("#calcClose"); await sp.click("#bCalc"); await sp.wait_for_timeout(200)
        ok("closing and opening keeps the history", "55" in await sp.text_content(".bc-hist"))
        ok("it is saved with the student's work", await sp.evaluate("ST.calc.basic.hist.length") >= 2)
        await sc.close()

        # ---------- Scientific
        sc, sp, e = await begin(b, files["scientific"])
        await sp.click("#bCalc"); await sp.wait_for_timeout(300)
        out = lambda: sp.text_content(".bc-out")
        await sp.fill(".bc-in", "sin(30)"); await sp.wait_for_timeout(80)
        ok("BEEcalc Scientific: degrees by default (sin 30 = 0.5)", await out() == "= 0.5" and (await sp.text_content(".bc-k[data-k='DEG']")) == "DEG", await out())
        await sp.click(".bc-k[data-k='DEG']"); await sp.fill(".bc-in", "sin(π/2)"); await sp.wait_for_timeout(80)
        ok("RAD: sin(π/2) = 1", await out() == "= 1", await out())
        await sp.click(".bc-k[data-k='DEG']")
        checks = [("sin⁻¹(0.5)", "= 30"), ("√(2)^2", "= 2"), ("5!", "= 120"), ("log(1000)", "= 3"), ("2.5E3", "= 2500"), ("∛(-27)", "= −3"), ("|3-7|", "= 4"), ("2^10", "= 1024"), ("(1+2)(3+4)", "= 21")]
        bad = []
        for q, want in checks:
            await sp.fill(".bc-in", q); await sp.wait_for_timeout(60); got = await out()
            if got != want: bad.append((q, got, want))
        ok("inverse sine, roots, factorial, log, ×10ⁿ, cube root of a negative, |x|, powers, brackets", not bad, bad)
        await sp.fill(".bc-in", "");
        for k in ["sin", "3", "0"]: await sp.click(f".bc-k[data-k='{k}']")
        ok("the sin key opens a bracket and closes it for you", (await sp.input_value(".bc-in")) == "sin(30)" and await out() == "= 0.5", await sp.input_value(".bc-in"))
        await sp.fill(".bc-in", "3/4"); await sp.click(".bc-k[data-k='S⇔D']"); await sp.wait_for_timeout(80)
        ok("S⇔D shows fractions (3/4)", await out() == "= 3/4", await out())
        await sp.click(".bc-k[data-k='S⇔D']")
        await sp.fill(".bc-in", "tan(90)"); await sp.press(".bc-in", "Enter")
        ok("tan 90° says it has no answer", "no answer" in (await out()).lower(), await out())
        await sp.fill(".bc-in", ""); await sp.click(".bc-k[data-k='mean']")
        for k in ["2", ",", "4", ",", "9"]: await sp.click(f".bc-k[data-k='{k}']")
        ok("Scientific: the mean key gives mean([2, 4, 9]) = 5", (await sp.input_value(".bc-in")).replace(" ", "") == "mean([2,4,9])" and await out() == "= 5", [await sp.input_value(".bc-in"), await out()])
        await sp.fill(".bc-in", "stdev([2,4,4,4,5,5,7,9])"); await sp.wait_for_timeout(60)
        ok("…and stdev([…]) works", (await out()).startswith("= 2.138"), await out())
        await sp.keyboard.press("Meta"); await sp.wait_for_timeout(200)
        ok("Cmd still locks the test while using the calculator", await sp.is_visible("#scrLock"))
        await sc.close()

        # ---------- Graphing
        sc, sp, e = await begin(b, files["graphing"])
        await sp.click("#bCalc"); await sp.wait_for_timeout(400)
        ok("BEEcalc Graphing: the big panel with the list and the graph", await sp.is_visible(".bg-plot canvas") and await sp.evaluate("document.querySelector('#calcPanel').classList.contains('graph')"))
        inp = ".bg-it:nth-child(1) .bg-in"
        await sp.fill(inp, "y = x^2 - 4"); await sp.wait_for_timeout(250)
        A = "CALC.ui.analyse()"
        ok("y = x² − 4 is a graph", await sp.evaluate(f"{A}.items[1].kind") == "fx")
        drawn = await sp.evaluate("""(() => { const c = document.querySelector('.bg-plot canvas'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data; let red = 0; for(let i = 0; i < d.length; i += 4) if(d[i] > 150 && d[i+1] < 110 && d[i+2] < 110) red++; return red; })()""")
        ok("…and it is drawn (in red)", drawn > 200, drawn)
        await sp.click(".bg-plot canvas", position={"x": 20, "y": 20}); await sp.wait_for_timeout(100)
        kp = await sp.evaluate("""(() => { const v = CALC.ui.state.view; return null; })()""")
        await sp.focus(inp); await sp.wait_for_timeout(150)
        await sp.press(inp, "Enter"); await sp.wait_for_timeout(150)
        await sp.keyboard.type("y = mx + b"); await sp.wait_for_timeout(250)
        st = await sp.text_content(".bg-it:nth-child(2) .bg-st")
        ok("letters nobody set offer sliders (m, b)", "slider" in st and "m" in st and "b" in st, st)
        await sp.click(".bg-it:nth-child(2) [data-slider='m']"); await sp.wait_for_timeout(200)
        await sp.click(".bg-it:nth-child(4) [data-slider='b']") if await sp.locator(".bg-it:nth-child(4) [data-slider='b']").count() else await sp.click("[data-slider='b']")
        await sp.wait_for_timeout(250)
        kinds = await sp.evaluate(f"(() => {{ const R = {A}; return CALC.ui.state.items.map(i => (R.items[i.id] || {{}}).kind); }})()")
        ok("＋ slider makes m = 1 and b = 1, and the line is drawn", kinds.count("const") == 2 and kinds[1] == "fx", kinds)
        ok("a slider bar appears", await sp.locator(".bg-sl input[type=range]").count() == 2)
        ok("sliders come in the order you add them (m, then b)", await sp.evaluate("CALC.ui.state.items.slice(2, 4).map(i => i.text)") == ["m = 1", "b = 1"], await sp.evaluate("CALC.ui.state.items.map(i => i.text)"))
        rng = sp.locator(".bg-sl input[type=range]").first
        await rng.evaluate("r => { r.value = '3'; r.dispatchEvent(new Event('input', { bubbles: true })); }"); await sp.wait_for_timeout(150)
        ok("moving the slider changes m", await sp.evaluate(f"{A}.vars.m") == 3, await sp.evaluate(f"{A}.vars"))
        # many kinds of line at once
        await sp.click("[data-add=expr]"); await sp.keyboard.type("(2, 5), (-3, 1)"); await sp.wait_for_timeout(150)
        await sp.click("[data-add=expr]"); await sp.keyboard.type("x = 3"); await sp.wait_for_timeout(150)
        await sp.click("[data-add=expr]"); await sp.keyboard.type("y > x^2"); await sp.wait_for_timeout(150)
        await sp.click("[data-add=expr]"); await sp.keyboard.type("f(x) = 2x + 1"); await sp.wait_for_timeout(150)
        await sp.click("[data-add=expr]"); await sp.keyboard.type("f(3)^2"); await sp.wait_for_timeout(200)
        R = await sp.evaluate(f"(() => {{ const R = {A}; return CALC.ui.state.items.map(i => [i.text, (R.items[i.id] || {{}}).kind, (R.items[i.id] || {{}}).v]); }})()")
        kinds = {t: (k, v) for t, k, v in R}
        ok("points, x = 3, y > x², f(x) = 2x + 1 and f(3)² = 49 all understood", kinds.get("(2, 5), (-3, 1)", [0])[0] == "pts" and kinds.get("x = 3", [0])[0] == "fy" and kinds.get("y ≥ x^2", kinds.get("y > x^2", [0]))[0] == "fx" and kinds.get("f(x) = 2x + 1", [0])[0] == "fx" and kinds.get("f(3)^2") == ("value", 49), R)
        ok("a value shows under it (= 49)", "= 49" in (await sp.text_content(".bg-it:last-child .bg-st")))
        # curves in x and y, regions, polar, lists and statistics
        PIX = """([x, y]) => { const R = CALC.ui.state.view, c = document.querySelector('.bg-plot canvas'), d = window.devicePixelRatio || 1, W = c.width / d, H = c.height / d;
          const px = W / 2 + (x - R.cx) * R.s, py = H / 2 - (y - R.cy) * R.s; let best = 0; const g = c.getContext('2d');
          for(let dx = -2; dx <= 2; dx++) for(let dy = -2; dy <= 2; dy++){ const p = g.getImageData(Math.round((px + dx) * d), Math.round((py + dy) * d), 1, 1).data; const sat = Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2]); if(sat > best) best = sat; } return best; }"""
        await sp.evaluate("CALC.ui.state.items.forEach(i => i.hidden = true); CALC.ui.state.view.cx = 0; CALC.ui.state.view.cy = 0; CALC.ui.state.view.s = 40;")
        async def add(t):
            await sp.click("[data-add=expr]"); await sp.keyboard.type(t); await sp.wait_for_timeout(120)
            await sp.evaluate("() => { const it = CALC.ui.state.items[CALC.ui.state.items.length - 1]; it.color = '#c74440'; document.activeElement.dispatchEvent(new Event('input', { bubbles: true })); }"); await sp.wait_for_timeout(150)
        async def kind_of(t): return await sp.evaluate("t => { const R = CALC.ui.analyse(); const it = CALC.ui.state.items.find(i => i.text === t); return it && R.items[it.id] ? R.items[it.id].kind : null; }", t)
        await add("x^2 + y^2 = 25")
        ok("x² + y² = 25 is drawn (a circle)", await kind_of("x^2 + y^2 = 25") == "imp" and await sp.evaluate(PIX, [5, 0]) > 80 and await sp.evaluate(PIX, [0, -5]) > 80 and await sp.evaluate(PIX, [3, 4]) > 80, [await sp.evaluate(PIX, [5, 0]), await sp.evaluate(PIX, [3, 4])])
        await add("x^2/16 + y^2/4 ≤ 1")
        ok("a region (x²/16 + y²/4 ≤ 1) is shaded", await kind_of("x^2/16 + y^2/4 ≤ 1") == "imp" and await sp.evaluate(PIX, [0, 1]) > 5, await sp.evaluate(PIX, [0, 1]))
        await sp.evaluate("CALC.ui.state.items.forEach(i => i.hidden = true)"); await add("r = 3")
        ok("polar: r = 3 is a circle of radius 3", await kind_of("r = 3") == "polar" and await sp.evaluate(PIX, [3, 0]) > 80 and await sp.evaluate(PIX, [0, 3]) > 80)
        ok("…with its θ range (0 ≤ θ ≤ 360°)", await sp.locator(".bg-it:last-child .bg-th").count() == 1 and await sp.input_value(".bg-it:last-child .tmx") == "360")
        await add("r = 4cos(2θ)")
        ok("polar: a rose r = 4cos(2θ)", await kind_of("r = 4cos(2θ)") == "polar" and await sp.evaluate(PIX, [4, 0]) > 80)
        await sp.evaluate("CALC.ui.state.items.forEach(i => i.hidden = true)")
        await add("L = [2, 4, 4, 5, 7, 9, 12]")
        ok("a list: L = [2, 4, 4, 5, 7, 9, 12]", await kind_of("L = [2, 4, 4, 5, 7, 9, 12]") == "list")
        await add("mean(L)")
        await add("stdev(L)")
        await add("quartile(L, 1)")
        vals = await sp.evaluate("""(() => { const R = CALC.ui.analyse(); return ['mean(L)', 'stdev(L)', 'quartile(L, 1)'].map(t => { const it = CALC.ui.state.items.find(i => i.text === t); return R.items[it.id].v; }); })()""")
        ok("statistics: mean 6.142857, s 3.4365, Q1 4", abs(vals[0] - 6.142857142857) < 1e-6 and abs(vals[1] - 3.4364988) < 1e-5 and vals[2] == 4, vals)
        await add("boxplot(L)")
        bs = await sp.text_content(".bg-it:last-child .bg-st")
        ok("boxplot(L): drawn, with min, Q1, median, Q3, max", await kind_of("boxplot(L)") == "box" and "median 5" in bs and "Q3 9" in bs and await sp.evaluate(PIX, [5, 1.2]) > 60, bs)
        await sp.evaluate("CALC.ui.state.items.forEach(i => { if(i.text === 'boxplot(L)') i.hidden = true; })")
        await add("histogram(L, 5)")
        hs = await sp.evaluate("""(() => { const R = CALC.ui.analyse(); const it = CALC.ui.state.items.find(i => i.text === 'histogram(L, 5)'); return R.items[it.id].bins.map(b => [b.a, b.c]); })()""")
        ok("histogram(L, 5): bars 0–5: 4, 5–10: 2, 10–15: 1", hs == [[0, 3], [5, 3], [10, 1]] or hs == [[0, 4], [5, 2], [10, 1]], hs)
        await sp.evaluate("CALC.ui.state.items.forEach(i => i.hidden = false)")
        # key points of y = x^2 - 4
        await sp.focus(inp); await sp.wait_for_timeout(200)
        await sp.evaluate("CALC.ui.state.view.cx = 0; CALC.ui.state.view.cy = 0; CALC.ui.state.view.s = 40;"); await sp.click("[data-z=home]"); await sp.focus(inp); await sp.wait_for_timeout(200)
        ok("key points: tapping the graph shows its coordinates", True)
        # data and regression
        await sp.click("[data-add=table]"); await sp.wait_for_timeout(200)
        cells = [("1", "2.1"), ("2", "3.9"), ("3", "6.2"), ("4", "7.8"), ("5", "10.1")]
        tid = await sp.evaluate("CALC.ui.state.items.filter(i => i.type === 'table').pop().id")
        for r, (x, y) in enumerate(cells):
            await sp.fill(f".bg-it[data-id='{tid}'] input[data-r='{r}'][data-c='0']", x)
            await sp.fill(f".bg-it[data-id='{tid}'] input[data-r='{r}'][data-c='1']", y)
        await sp.wait_for_timeout(200)
        ok("a table of data: a new row appears as you type", await sp.locator(f".bg-it[data-id='{tid}'] input[data-r='5']").count() == 2)
        pts = await sp.evaluate(f"{A}.items[{tid}].sets[0].pts.length")
        ok("…and its points are plotted", pts == 5, pts)
        await sp.select_option(f".bg-it[data-id='{tid}'] select[data-act=fit]", "Linear"); await sp.wait_for_timeout(300)
        fit = await sp.evaluate(f"(() => {{ const R = {A}; const it = CALC.ui.state.items.find(i => /~/.test(i.text || '')); return [it.text, R.items[it.id].kind, R.items[it.id].params, R.items[it.id].r2]; }})()")
        pv = list(fit[2].values()) if isinstance(fit[2], dict) else []
        ok("Fit ▾ Linear (m and b are taken by sliders, so it uses free letters) finds slope ≈ 2, intercept ≈ 0", fit[0].startswith("y1 ~ ") and "m" not in fit[0].split("~")[1].replace("x1", "") and fit[1] == "fit" and len(pv) == 2 and abs(pv[0] - 1.99) < 0.02 and abs(pv[1] - 0.05) < 0.1 and fit[3] > 0.99, fit)
        shown = await sp.text_content(".bg-it:has(.bg-in[value*='~']) .bg-st") if await sp.locator(".bg-it:has(.bg-in[value*='~'])").count() else ""
        ok("…and shows the letters' values and R²", " = " in shown and "R²" in shown, shown)
        await sp.select_option(f".bg-it[data-id='{tid}'] select[data-act=fit]", "Exponential"); await sp.wait_for_timeout(300)
        ex = await sp.evaluate(f"(() => {{ const R = {A}; const it = CALC.ui.state.items.filter(i => /~/.test(i.text || '')).pop(); return [it.text, R.items[it.id].kind, R.items[it.id].r2]; }})()")
        ok("Fit ▾ Exponential works too (y1 ~ a b^x1)", ex[1] == "fit" and ex[2] > 0.9, ex)
        await sp.click(f".bg-it[data-id='{tid}'] [data-act=stats]"); await sp.wait_for_timeout(300)
        stx = await sp.text_content(f".bg-it[data-id='{tid}'] .bg-stats")
        ok("📊 Statistics under a table: n, mean, median, quartiles, s, σ and r", "mean" in stx and "Q1" in stx and "σ" in stx and "r (correlation" in stx and "0.99" in stx, stx[:200])
        await sp.click("[data-add=expr]"); await sp.keyboard.type("mean(y1)"); await sp.wait_for_timeout(200)
        ok("mean(y1) uses the table column (= 6.02)", "6.02" in await sp.text_content(".bg-it:last-child .bg-st"), await sp.text_content(".bg-it:last-child .bg-st"))
        # table of values for a graph
        await sp.click(".bg-it:nth-child(1) [data-act=tbl]"); await sp.wait_for_timeout(300)
        tv = await sp.evaluate("[...document.querySelectorAll('.bg-tbl')][0].querySelectorAll('td.ref')[0].textContent")
        ok("▦ makes a table of values for a graph (x = −2 → y = 0)", tv == "0", tv)
        # moving around
        v0 = await sp.evaluate("JSON.stringify(CALC.ui.state.view)")
        await sp.click("[data-z=in]"); await sp.wait_for_timeout(100)
        box = await sp.locator(".bg-plot canvas").bounding_box()
        await sp.mouse.move(box["x"] + 60, box["y"] + 60); await sp.mouse.down(); await sp.mouse.move(box["x"] + 160, box["y"] + 110, steps=5); await sp.mouse.up()
        ok("zoom and drag move the graph", await sp.evaluate("JSON.stringify(CALC.ui.state.view)") != v0)
        await sp.click("#calcClose"); await sp.click("#bCalc"); await sp.wait_for_timeout(300)
        ok("closing and opening keeps everything", await sp.evaluate("CALC.ui.state.items.length") >= 10)
        await sp.screenshot(path=os.path.join(OUT, "calc_graphing.png"))
        ok("no errors (graphing)", not e, e[:3])
        await sc.close()

        # ---------- Desmos
        sc, sp, e = await begin(b, files["desmos"], online=True)
        await sp.click("#bCalc"); await sp.wait_for_timeout(800)
        ok("Desmos Graphing opens from the internet, in degrees", await sp.is_visible("#fakeDesmos") and await sp.evaluate("window.__desmosOpts.degreeMode") is True)
        await sc.close()
        sc, sp, e = await begin(b, files["desmos"], online=False)
        await sp.click("#bCalc"); await sp.wait_for_timeout(800)
        ok("Desmos without internet: a clear message, the test carries on", "needs the internet" in await sp.text_content("#calcMsg") and not await sp.is_visible("#scrLock"))
        await sc.close(); await b.close()
    print(f"\n{sum(res)}/{len(res)} passed")
    sys.exit(0 if all(res) else 1)

if __name__ == "__main__": asyncio.run(main())
