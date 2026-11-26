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
        b = await getattr(p, NAME).launch(**({"firefox_user_prefs": {"media.navigator.streams.fake": True, "media.navigator.permission.disabled": True}} if NAME == "firefox"
                                             else {"args": ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]} if NAME == "chromium" else {}))
        # 🎙️ the first question in the teacher's voice: recorded here with a pretend microphone (Firefox, Chromium),
        # or a sample recorded in Chrome (WebKit has no pretend microphone)
        sample = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "voice_sample.txt")).read().strip()
        rec = """async () => { const u = recUnits(S.items).find(x => S.items.some(it => it.id === x.key && it.type === 'q'));
          window.__rec = { key: u.key, mic: false };
          if(%s){ try{ await startRec(u.key); await new Promise(r => setTimeout(r, 1800)); await stopRec(); }catch(e){ window.__rec.err = String(e); } window.__rec.mic = !!AUD()[u.key]; }
          if(!AUD()[u.key]) AUD()[u.key] = { src: "%s", sig: u.sig, dur: 1.3 }; }""" % ("true" if NAME != "webkit" else "false", sample)
        # ---------- teacher: BEE opens, the demo paper becomes a PDF
        ctx, pg, errs, d = await T.make_student_file(b, url=WEB, setup=rec)
        if NAME != "webkit":
            r = await pg.evaluate("[window.__rec, AUD()[window.__rec.key] && AUD()[window.__rec.key].src.slice(0, 22)]")
            print(f"NOTE [{NAME}] recorded as", r[1], flush=True)
            ok("🎙️ recording your voice works", r[0]["mic"] and r[1].startswith("data:audio/"), r)
        await pg.wait_for_timeout(600)
        ok("making the computer version: the window shows 'Student file ready' with the codes", await pg.is_visible("#stuDone h3") and (await pg.text_content("#stuShowCode")).strip() == "ABCD-2345")
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
        # 🎙️ the teacher's recording: it plays, or (if this browser can't play it) the computer voice reads instead
        await sp.evaluate(T.FAKE_TTS)
        ri = await sp.evaluate("UNITS.findIndex(u => u.audio)")
        if ri >= 0:
            await sp.evaluate("fillVoices()"); await sp.click(f'[data-say="{ri}"]'); await sp.wait_for_timeout(1500)
            v = await sp.evaluate(f"({{ rec: TTS.rec, t: VO.currentTime, ended: VO.ended, bad: !!UNITS[{ri}].audioBad, tts: speechSynthesis.q.length, playBtn: $('#ttsPlay').textContent }})")
            played = v["rec"] and (v["t"] > 0 or v["ended"]); fell = v["bad"] and v["tts"] > 0
            print(f"NOTE [{NAME}] the teacher's recording " + ("plays" if played else "can't play here: the computer voice reads it" if fell else "?"), v, flush=True)
            if NAME == "webkit": ok("🎙️ the teacher's recording plays, or the computer voice reads it instead", played or fell, v)
            else: ok("🎙️ the teacher's recording, made in this browser, plays here (and only once)", played and not v["bad"] and v["tts"] == 0, v)
            await sp.wait_for_timeout(1500)
            v2 = await sp.evaluate(f"({{ bad: !!UNITS[{ri}].audioBad, tts: speechSynthesis.q.length, i: TTS.i }})")
            ok("🎙️ after the recording ends, the computer voice does not read it again", not v2["tts"] or v["bad"], v2)
            await sp.evaluate("stopReading()")
        else: ok("🎙️ the student file has the teacher's recording", False, "no unit with audio")
        # 🧮 the teacher switches on BEEcalc Graphing during the exam; a graph is drawn; a sum is worked out
        await sp.click("#bTeacher"); await sp.fill("#tCode", "135790"); await sp.click("#tOk"); await sp.wait_for_timeout(300)
        if await sp.is_visible("#tCalc"):
            await sp.select_option("#tCalc", "graphing"); await sp.click("#tMenu [data-close]"); await sp.wait_for_timeout(200)
            await sp.click("#bCalc"); await sp.wait_for_timeout(500)
            await sp.fill(".bg-it:nth-child(1) .bg-in", "y = x^2 - 4"); await sp.wait_for_timeout(400)
            red = await sp.evaluate("""(() => { const c = document.querySelector('.bg-plot canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for(let i = 0; i < d.length; i += 4) if(d[i] > 150 && d[i+1] < 110 && d[i+2] < 110) n++; return n; })()""")
            ok("🧮 the teacher switches on BEEcalc Graphing; a graph is drawn", red > 200, red)
            ok("🧮 BEEcalc works out sums (sin 30° + 2³ = 8.5)", await sp.evaluate("BCalc.evaluate('sin(30)+2^3', { deg: true })") == 8.5)
            await sp.click("#calcClose")
        else: ok("🧮 the teacher's calculator switch is there", False, "no #tCalc")
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
        # ---------- 📂 the link for iPads: …/student/ in this browser, choose the file, take the test (an iPad-sized, touch screen)
        ic = await b.new_context(viewport={"width": 820, "height": 1180}, has_touch=True, accept_downloads=True); ip = await ic.new_page()
        ierrs = []; ip.on("pageerror", lambda e: ierrs.append(str(e)))
        await ip.goto(WEB + "student/"); await ip.wait_for_selector("#pkBtn", timeout=20000)
        ok("📂 the student link shows 'Choose the exam file'", await ip.is_visible("#pkBtn"))
        async with ip.expect_file_chooser() as fc: await ip.click("#pkBtn")
        await (await fc.value).set_files(P("exam.html")); await ip.wait_for_selector("#stGo:visible", timeout=20000)
        await ip.fill("#stName", "Sam iPad"); await ip.fill("#stCode", "ABCD-2345"); await ip.click("#stGo")
        try: await ip.wait_for_selector("#paper textarea", timeout=20000)
        except Exception: print(f"NOTE [{NAME}] the link test didn't start:", await ip.text_content("#stErr"), flush=True)
        await ip.locator("#paper textarea").first.fill("27"); await ip.locator("#paper textarea").first.dispatch_event("input"); await ip.wait_for_timeout(4500)
        ok("…the test opens from the link, and answers save on the device", await ip.evaluate("document.querySelectorAll('#paper .q').length") > 3 and "Saved" in await ip.text_content("#bSaved") and "NOT" not in await ip.text_content("#bSaved"), await ip.text_content("#bSaved"))
        ok("…with no page errors", not ierrs, ierrs[:3]); await ic.close()
        ok("no page errors", not errs and not serrs, (errs + serrs)[:3])
        await b.close()
    srv.shutdown()
    print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)

asyncio.run(main())
