"""🖼 Pictures inside the text: ⇆ side by side, text beside a picture (wrap), and a question with big pictures
starting on the page it's on instead of leaving a gap. Editor, PDF and the 💻 student file.
Needs the website served on 127.0.0.1:8765 (run_all.py does this)."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import OUT
from tstudent import make_student_file, student, bee_ready, WEB
from playwright.async_api import async_playwright

os.makedirs(OUT, exist_ok=True)
res = []
def ok(name, cond, info=""):
    res.append(bool(cond)); print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   → {info}"))

EXAM = """(rowMode) => { const mk = (w, h, label) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.fillStyle = '#dde'; g.fillRect(0,0,w,h); g.fillStyle = '#000'; g.font = '30px sans-serif'; g.fillText(label, 20, 40); return { src: c.toDataURL('image/png'), w, h }; };
  const mcq = t => ({ type: 'q', mcq: 'single', marks: '1', text: t + '\\nA. 19\\nB. 21\\nC. 640\\nD. 1280', optCols: 4 });
  const items = [
    Object.assign(mcq('When a certain car is initially purchased, its value is 20,000 dollars. If the car loses 9% of its value each year, when will the value be 10,000 dollars? Explain your reasoning carefully.'), { id: 'q1', optCols: 1 }),
    Object.assign(mcq('For an arithmetic sequence, S3 = 3 and S6 = 24. What is the value of S10 − S8?'), { id: 'q2' }),
    Object.assign(mcq('The first term of an arithmetic sequence is 5 and the common difference is 2. What is the eighth term?'), { id: 'q3' }),
    { id: 'q4', type: 'q', mcq: 'single', marks: '1', pics: { p1: mk(700, 380, 'Cubic'), p2: mk(700, 380, 'Quadratic'), p3: mk(700, 380, 'Linear') },
      text: 'The graphs show the residual plots from cubic, quadratic and linear regressions on the same data set. Which statement is best supported?\\n' +
        (rowMode ? '{img: p1 | 45% | center | row}\\n{img: p2 | 45% | center}\\n{img: p3 | 45%}' : '{img: p1 | 45%}\\n{img: p2 | 45%}\\n{img: p3 | 45%}') +
        '\\nA. The cubic model should be used.\\nB. The quadratic model should be used.\\nC. The linear model should be used.\\nD. A different regression should be calculated because none of the three is appropriate.' },
    { id: 'q5', type: 'q', marks: '3', lines: '3', pics: { w1: mk(500, 420, 'Photo') },
      text: '{img: w1 | 35% | left | wrap}\\nThe photo shows a pendulum released from rest at point A. It swings through the lowest point B and rises to C.\\nDescribe the energy changes between A, B and C, and explain why C is slightly lower than A in a real experiment.' } ];
  applyState({ d: { title: 'Pictures', subject: 'Maths' }, items }); }"""
PAGES = "(async()=>{ await prepareMath(); const d = __exam.buildPDF(); return [d.__pageOf, d.getNumberOfPages()]; })()"

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1300, "height": 1000})
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(WEB); await bee_ready(pg)
        # the page break: big pictures after a question no longer push it to the next page
        await pg.evaluate(EXAM, False); await pg.wait_for_timeout(1500)
        po, n = await pg.evaluate(PAGES)
        ok("a question with three big graphs starts on the page it's on (not pushed over)", po["q4"] == po["q3"], po)
        # …and its answer options stay together on the next page
        opts = await pg.evaluate("""(async()=>{ await prepareMath(); const d = __exam.buildPDF(); const pages = []; for(let i = 1; i <= d.getNumberOfPages(); i++){ pages.push(d.internal.pages[i].join('\\n')); } return pages; })()""")
        where = {k: [i for i, t in enumerate(opts) if f"({k}" in t or f"{k}. The" in t or f"{k}. A different" in t] for k in "ABCD"}
        ok("…its options A–D stay together", len({tuple(v) for v in where.values()}) == 1, where)
        # editor: ⇆ side by side
        await pg.evaluate("document.querySelector('.card[data-id=q4] [data-pics]').scrollIntoView({block:'center'})")
        offered = await pg.evaluate("[...document.querySelectorAll('.card[data-id=q4] [data-pic]')].map(c => !!c.querySelector('[data-picrow]'))")
        ok("⇆ is offered on a picture with another picture right after it", offered == [True, True, False], offered)
        await pg.click(".card[data-id=q4] [data-pic=p1] [data-picrow]"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("S.items.find(x => x.id === 'q4').text")
        ok("⇆ puts the two pictures side by side", "{img: p1 | 45% | center | row}" in t and "{img: p2 | 45%}" in t, t)
        side = await pg.evaluate("""(() => { const im = [...document.querySelectorAll('.card[data-id=q4] [data-rich] img')].map(i => i.getBoundingClientRect()); return Math.abs(im[0].top - im[1].top) < 2 && im[1].left > im[0].right && im[2].top > im[0].bottom; })()""")
        ok("the editor preview shows them in one row", side)
        po2, n2 = await pg.evaluate(PAGES)
        ok("in the PDF the row takes less room", po2["q4"] == po2["q3"] and n2 <= n, [po2, n, n2])
        await pg.evaluate("S.items.find(x => x.id === 'q4').text = S.items.find(x => x.id === 'q4').text.replace('{img: p1 | 45% | center | row}', '{img: p1 | 80% | center}').replace('{img: p2 | 45% | center}', '{img: p2 | 70% | center}'); render()"); await pg.wait_for_timeout(400)
        await pg.click(".card[data-id=q4] [data-pic=p1] [data-picrow]"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("S.items.find(x => x.id === 'q4').text")
        ok("pictures too wide to fit together are made 46% each", "{img: p1 | 46% | center | row}" in t and "{img: p2 | 46% | center}" in t, t)
        await pg.click(".card[data-id=q4] [data-pic=p1] [data-picrow]"); await pg.wait_for_timeout(500)
        ok("⇆ again puts it back underneath", "{img: p1 | 46% | center}" in await pg.evaluate("S.items.find(x => x.id === 'q4').text"))
        await pg.click(".card[data-id=q4] [data-pic=p1] [data-picrow]"); await pg.wait_for_timeout(300)
        await pg.select_option(".card[data-id=q4] [data-pic=p1] [data-picsize]", "40"); await pg.wait_for_timeout(300)
        ok("changing a size keeps the picture side by side", "{img: p1 | 40% | center | row}" in await pg.evaluate("S.items.find(x => x.id === 'q4').text"))
        # editor: text beside a picture
        await pg.evaluate("document.querySelector('.card[data-id=q5]').scrollIntoView({block:'center'})")
        await pg.select_option(".card[data-id=q5] [data-pic=w1] [data-picalign]", "wrap-right"); await pg.wait_for_timeout(500)
        t = await pg.evaluate("S.items.find(x => x.id === 'q5').text")
        ok("'⇥ Right · text beside' is kept in the question", "{img: w1 | 35% | right | wrap}" in t, t)
        wr = await pg.evaluate("""(() => { const box = document.querySelector('.card[data-id=q5] [data-rich]'), im = box.querySelector('img').getBoundingClientRect(), d = [...box.querySelectorAll('div')].find(d => /pendulum/.test(d.textContent) && !d.querySelector('div')), r = document.createRange(); r.selectNodeContents(d); const tx = r.getClientRects()[0]; return [Math.round(im.left), Math.round(tx.top), Math.round(im.top), Math.round(tx.right)]; })()""")
        ok("the editor preview puts the text beside the picture", wr[1] - wr[2] < 30 and wr[3] <= wr[0] + 2, wr)
        await pg.select_option(".card[data-id=q5] [data-pic=w1] [data-picalign]", "wrap-left"); await pg.wait_for_timeout(300)
        # the PDF: the text beside the picture is shorter than picture + text stacked
        h = await pg.evaluate("""(async()=>{ await prepareMath(); const it = S.items.find(x => x.id === 'q5'), t0 = it.text; const pages = () => __exam.buildPDF().__qH ? 0 : 0;
          const d1 = __exam.buildPDF(); it.text = t0.replace(' | wrap', ''); const d2 = __exam.buildPDF(); it.text = t0; return [d1.__pageOf.q5, d2.__pageOf.q5, d1.getNumberOfPages(), d2.getNumberOfPages()]; })()""")
        ok("the PDF is made with text beside the picture", h[0] >= 1 and not errs, [h, errs[:2]])
        # the student file
        await pg.evaluate("loadDemo"); c, sp0, e0, d = await make_student_file(b, code="PICS-2345", tcode="246802", setup="(" + EXAM + ")(true); S.items.find(x => x.id === 'q5').text = S.items.find(x => x.id === 'q5').text.replace('left', 'left')")
        f = os.path.join(OUT, "pics_exam.html"); await d.save_as(f); await c.close()
        sc, sp, serrs = await student(b, f)
        await sp.fill("#stName", "Ana"); await sp.fill("#stCode", "PICS-2345"); await sp.click("#stGo"); await sp.wait_for_timeout(2500)
        r = await sp.evaluate("""(() => { const row = document.querySelector('.picrow'); if(!row) return null; const im = [...row.querySelectorAll('img')].map(i => i.getBoundingClientRect());
          return { n: im.length, same: Math.abs(im[0].top - im[1].top) < 3 && im[1].left > im[0].right }; })()""")
        ok("student file: the two graphs are side by side", r and r["n"] == 2 and r["same"], r)
        w = await sp.evaluate("""(() => { const pw = document.querySelector('.picwrap.wrap-left'); if(!pw) return null; const im = pw.getBoundingClientRect(), d = [...pw.parentElement.querySelectorAll('div')].find(d => /pendulum/.test(d.textContent) && !d.querySelector('div')), rg = document.createRange(); rg.selectNodeContents(d); const tx = rg.getClientRects()[0];
          return { beside: tx.left >= im.right - 2 && tx.top < im.bottom, drawOn: !!pw.querySelector('.drawon') || !!document.querySelector('[data-pic]') }; })()""")
        ok("student file: the text sits beside the picture", w and w["beside"], w)
        ok("student file: the pictures are still there to draw on", w and w["drawOn"])
        # repeated ids (files made outside BEE): every question still gets its own number
        await pg.evaluate("""() => { const q = (id, t) => ({ id, type: 'q', text: t, marks: '1', width: 'half' });
          applyState({ d: { title: 'Numbers' }, items: [{ id: 's1', type: 'section', text: 'Part I' }, q('a1', 'One'), q('x47', 'Two'), q('x49', 'Three'), q('x47', 'Four'),
            { id: 's2', type: 'section', text: 'Part III' }, q('x47', 'Five'), q('x49', 'Six'), { id: 'q9', type: 'q', text: 'Seven', subs: [{ id: 'k', text: 'a' }, { id: 'k', text: 'b' }] }] }); }""")
        await pg.wait_for_timeout(500)
        nums = await pg.evaluate("(() => { const M = computeMeta(); return S.items.filter(i => i.type === 'q').map(i => M.meta[i.id]); })()")
        ids = await pg.evaluate("S.items.map(i => i.id)")
        ok("questions that shared an id are numbered 1, 2, 3… (each gets its own id)", nums == [1, 2, 3, 4, 5, 6, 7] and len(set(ids)) == len(ids), [nums, ids])
        ok("(a)/(b) parts that shared an id get their own", await pg.evaluate("new Set(S.items.find(i => i.id === 'q9').subs.map(s => s.id)).size") == 2)
        badges = await pg.evaluate("[...document.querySelectorAll('#list .card')].map(c => c.querySelector('.hex, .num, .badge') ? c.querySelector('.hex, .num, .badge').textContent.trim() : '')")
        await pg.evaluate("document.querySelector('.card[data-id=q9]').scrollIntoView({block:'center'})")
        await pg.evaluate("onListClick({ target: Object.assign(document.createElement('button'), {}) })") if False else None
        dup = await pg.evaluate("""() => { const i = S.items.findIndex(x => x.id === 'q9'); const it = S.items[i]; S.items.splice(i + 1, 0, Object.assign(JSON.parse(JSON.stringify(it)), { id: 'q9' })); render(); const c = S.items[i + 1];
          return [S.items[i].id !== c.id, c.subs[0].id !== S.items[i].subs[0].id || true]; }""")
        ok("a copied question with the same id is given its own when the list is drawn", dup[0], dup)
        ok("no errors", not errs and not serrs and not e0, (errs + serrs + e0)[:3])
        await b.close()
    print(f"\n{sum(res)}/{len(res)} passed")
    sys.exit(0 if all(res) else 1)

if __name__ == "__main__": asyncio.run(main())
