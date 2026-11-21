"""Firefox and Safari (WebKit) check: the main things a teacher and a student do, in one browser.
    BEE_BROWSER=firefox python3 tests/tbrowsers.py      (or webkit / chromium)
Starts its own web server on 127.0.0.1:8766."""
import asyncio, os, sys, functools, http.server, threading
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import OUT, ROOT
from playwright.async_api import async_playwright
import tstudent as T

NAME = os.environ.get("BEE_BROWSER", "firefox")
os.makedirs(OUT, exist_ok=True)
P = lambda n: os.path.join(OUT, NAME + "_" + n)
res = []
def ok(name, cond, info=""):
    res.append(bool(cond)); print(("PASS " if cond else "FAIL ") + f"[{NAME}] " + name + ("" if cond else f"   → {info}"), flush=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8766), functools.partial(Quiet, directory=os.path.join(ROOT, "docs")))
threading.Thread(target=srv.serve_forever, daemon=True).start()
WEB = "http://127.0.0.1:8766/"

async def main():
    async with async_playwright() as p:
        b = await getattr(p, NAME).launch()
        # ---------- teacher: BEE opens, the demo paper becomes a PDF
        ctx, pg, errs, d = await T.make_student_file(b, url=WEB)
        n = await pg.evaluate("(() => { const doc = buildPDF({}); return doc.getNumberOfPages(); })()")
        ok("BEE builds the demo paper as a PDF", n >= 4, n)
        async with pg.expect_download(timeout=60000) as dl: await pg.evaluate("document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open')); download()")
        await (await dl.value).save_as(P("paper.pdf"))
        ok("⬇ Download PDF gives a PDF", open(P("paper.pdf"), "rb").read(4) == b"%PDF")
        await d.save_as(P("exam.html"))
        ok("the computer-version file is made", os.path.getsize(P("exam.html")) > 1_000_000)
        # ---------- student: opens the file, starts, answers, ends
        sc, sp, serrs = await T.student(b, P("exam.html"))
        await sp.fill("#stName", "Léa Martin"); await sp.fill("#stClass", "10B")
        await sp.fill("#stCode", "ABCD-2345"); await sp.click("#stGo"); await sp.wait_for_timeout(3000)
        ok("the start code opens the paper", await sp.is_visible("#scrExam"))
        qs = await sp.evaluate("PAPER.items.filter(i => i.k === 'q').map(q => q.id)")
        await sp.fill(f"[data-area='{qs[0]}|main'] textarea", "27")
        pq = await sp.evaluate("PAPER.items.find(i => i.k === 'q' && /Pisum/.test(i.plain)).id")
        await sp.fill(f"#q-{pq} .cell-in >> nth=0", "TT")
        await sp.click("#bEnd"); await sp.wait_for_timeout(300)
        async with sp.expect_download(timeout=60000) as dl: await sp.click("#endGo")
        await (await dl.value).save_as(P("lea.bee-answers"))
        ok("ending the test gives the sealed answers file", os.path.getsize(P("lea.bee-answers")) > 1000)
        # ---------- teacher: opens the answers → PDF
        async with pg.expect_file_chooser() as fc: await pg.evaluate("pickAnswers()")
        await (await fc.value).set_files(P("lea.bee-answers")); await pg.wait_for_selector("[data-anspdf]")
        async with pg.expect_download(timeout=120000) as dl: await pg.click("[data-anspdf]")
        await (await dl.value).save_as(P("lea.pdf"))
        ok("BEE opens the answers as a PDF", open(P("lea.pdf"), "rb").read(4) == b"%PDF")
        ok("no page errors", not errs and not serrs, (errs + serrs)[:3])
        await b.close()
    srv.shutdown()
    print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)

asyncio.run(main())
