"""🎙️ The teacher's own voice: record in BEE (a pretend microphone) → the recordings go inside the student file →
the student hears them (and the computer voice reads anything not recorded, or anything a laptop can't play).
Needs the website served on 127.0.0.1:8765 (run_all.py does this)."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import OUT, chrome
from tstudent import export_student, bee_ready, student, WEB
from playwright.async_api import async_playwright

os.makedirs(OUT, exist_ok=True)
P = lambda n: os.path.join(OUT, "voice_" + n)
res = []
def ok(name, cond, info=""):
    res.append(bool(cond)); print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   → {info}"))

EXAM = """() => applyState({ d: { title: "Forces quiz", subject: "Physics", instructions: "Answer all the questions." }, items: [
  { id: "sec1", type: "section", text: "Part I: Forces" },
  { id: "n1", type: "note", text: "Read this passage carefully before you answer the next questions about forces and motion." },
  { id: "q1", type: "q", text: "State Newton's second law: $F = ma$.", marks: "2", lines: "3" },
  { id: "q2", type: "q", mcq: "single", text: "Which gas do plants give off?", options: ["Oxygen", "Hydrogen", "Carbon dioxide", "Nitrogen"], marks: "1" },
  { id: "q3", type: "q", text: "A car moves at a steady speed.", subs: [{ id: "s1", text: "Define speed.", marks: "1" }, { id: "s2", text: "Give its unit.", marks: "1" }] }
] })"""
# a computer voice that keeps talking until it is stopped, plus one voice to choose
FAKE_TTS = """() => { const f = { speaking: false, paused: false, q: [], speak(u){ this.q.push(u); this.speaking = true; }, cancel(){ this.q = []; this.speaking = false; this.paused = false; },
  pause(){ this.paused = true; }, resume(){ this.paused = false; }, getVoices(){ return [{ voiceURI: "v1", name: "Test Voice", lang: "en-GB", localService: true }]; }, addEventListener(){} };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, value: f }); }"""

async def record(pg, key, ms=1600):
    sel = f'#recList .rec-item[data-key="{key}"] [data-rec]'
    await pg.click(sel); await pg.wait_for_timeout(ms); await pg.click(sel); await pg.wait_for_timeout(600)

async def main():
    async with async_playwright() as p:
        mic = chrome(); mic["args"] = (mic.get("args") or []) + ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
        b = await p.chromium.launch(**mic)
        ctx = await b.new_context(accept_downloads=True, viewport={"width": 1300, "height": 900}); pg = await ctx.new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(WEB + "?keyadmin=hive"); await bee_ready(pg)
        await pg.evaluate(EXAM); await pg.wait_for_timeout(500)
        await pg.evaluate("openStudentDialog()"); await pg.wait_for_timeout(300)
        vis = await pg.is_visible("#stuRecRow")
        await pg.uncheck("#stuRead"); hid = not await pg.is_visible("#stuRecRow"); await pg.check("#stuRead")
        ok("🎙️ Record… shows only when questions can be read aloud", vis and hid and await pg.is_visible("#stuRecRow"))
        await pg.click("#stuRecBtn"); await pg.wait_for_selector("#recModal.open")
        keys = await pg.evaluate("[...document.querySelectorAll('#recList .rec-item')].map(e => e.dataset.key)")
        ok("everything that is read aloud is listed, in order", keys == ["ins", "sec1", "n1", "q1", "q2", "q3", "s:q3:s1", "s:q3:s2"], keys)
        mcq = await pg.text_content('#recList .rec-item[data-key="q2"] .rec-t')
        ok("multiple choice: the options are shown to read", "A: Oxygen" in mcq and "D: Nitrogen" in mcq, mcq)

        for k in ["ins", "sec1", "q1", "q2", "s:q3:s1"]: await record(pg, k)
        A = await pg.evaluate("Object.fromEntries(Object.entries(AUD()).map(([k, r]) => [k, [r.src.slice(0, 11), r.dur, r.src.length]]))")
        ok("recordings are kept (sound, with their length)", all(k in A and A[k][0] == "data:audio/" and A[k][1] >= 1 and A[k][2] > 2000 for k in ["ins", "sec1", "q1", "q2", "s:q3:s1"]), A)
        print("NOTE recorded as:", await pg.evaluate("AUD().ins.src.slice(0, 30)"))
        st = await pg.text_content('#recList .rec-item[data-key="q2"] .rec-st')
        ok("a recorded question says ✅ Recorded", st.startswith("✅ Recorded"), st)
        sel = '#recList .rec-item[data-key="n1"] [data-rec]'
        await pg.click(sel); await pg.wait_for_timeout(150); await pg.click(sel); await pg.wait_for_timeout(500)
        ok("a click by mistake (too short) keeps nothing", await pg.evaluate("!AUD().n1") and "too short" in (await pg.text_content("#toast")))
        await pg.click('#recList .rec-item[data-key="s:q3:s2"] [data-rec]'); await pg.wait_for_timeout(1300)
        ok("while recording: 🔴 Recording… and a ■ Stop button with the time", "Recording" in await pg.text_content('#recList .rec-item[data-key="s:q3:s2"] .rec-st') and (await pg.text_content('#recList .rec-item[data-key="s:q3:s2"] [data-rec]')).startswith("■ Stop"))
        await pg.click("#recModal [data-close]"); await pg.wait_for_timeout(900)
        ok("closing the window stops the recording and keeps it", await pg.evaluate("!!AUD()['s:q3:s2'] && !REC.mr"))
        await pg.click("#stuRecBtn"); await pg.wait_for_selector("#recModal.open")
        await pg.click('#recList .rec-item[data-key="ins"] [data-play]'); await pg.wait_for_timeout(400)
        ok("▶ Play plays the recording", await pg.evaluate("!!recPlayer && !recPlayer.paused && recPlayer.currentTime > 0"))

        # a question changed after it was recorded
        await pg.evaluate("S.items.find(x => x.id === 'q1').text += ' Give an example.'; changed(); renderRec()")
        st = await pg.text_content('#recList .rec-item[data-key="q1"] .rec-st')
        ok("text changed after recording → ⚠ marked", "text changed" in st and await pg.is_visible('#recList .rec-item[data-key="q1"] [data-keep]'), st)
        await pg.click('#recList .rec-item[data-key="q1"] [data-keep]')
        ok("✓ Still right keeps it", (await pg.text_content('#recList .rec-item[data-key="q1"] .rec-st')).startswith("✅"))
        await pg.evaluate("S.items.find(x => x.id === 'q1').text = 'Something else entirely.'; changed(); renderRec()")
        # delete needs two clicks
        d = '#recList .rec-item[data-key="sec1"] [data-del]'
        await pg.click(d); one = await pg.evaluate("!!AUD().sec1"); await pg.click(d); await pg.wait_for_timeout(200)
        ok("🗑 deletes only on the second click", one and await pg.evaluate("!AUD().sec1"))
        await record(pg, "sec1")
        await pg.click("#recModal [data-close]"); await pg.wait_for_timeout(300)
        info = await pg.text_content("#stuRecInfo")
        ok("the window says how many are recorded and which changed", "recorded in your voice" in info and "1 changed" in info, info)

        # saving, undo, history
        hist = await pg.evaluate("H.stack.every(s => !('audio' in s)) && JSON.stringify(H.stack).indexOf('data:audio') < 0")
        await pg.evaluate("S.d.title = 'Forces quiz 2'; changed()"); await pg.wait_for_timeout(1200); await pg.evaluate("undo()"); await pg.wait_for_timeout(300)
        ok("undo never copies or loses the recordings", hist and await pg.evaluate("Object.keys(AUD()).length") == 6)
        snap = await pg.evaluate("(() => { const s = JSON.parse(JSON.stringify(snapshot())); return [Object.keys(s.audio || {}).length, mergeState(s).audio.q2.src === AUD().q2.src]; })()")
        ok("recordings are saved with the exam (.exam.json) and come back when it is opened", snap == [6, True], snap)
        await pg.wait_for_timeout(700)
        idb = await pg.evaluate("IDB.get('state').then(s => Object.keys(s.audio || {}).length)")
        ok("…and kept in this browser too", idb == 6, idb)
        fresh = await pg.evaluate("Object.keys(mergeState({ items: [] }).audio).length")
        ok("a new exam starts with no recordings", fresh == 0)

        # versions: shuffled options must not use a recording that reads them in the old order
        ver = await pg.evaluate("""(() => { for(const v of ['A','B','C','D']){ const its = versionItems(S.items, v, true, true), au = voiceFor(its);
            const q = its.find(x => x.id === 'q2'); const same = JSON.stringify(q.options) === JSON.stringify(S.items.find(x => x.id === 'q2').options);
            if(!same) return [v, 'q2' in au, 'ins' in au, 's:q3:s1' in au]; } return null; })()""")
        ok("versions A–D: a multiple-choice question with shuffled options uses the computer voice; the rest keep yours", ver and ver[1] is False and ver[2] and ver[3], ver)

        # make the student file
        await pg.fill("#stuCode", "VOIC-2345"); await pg.fill("#stuTCode", "246802")
        dl, _ = await export_student(pg); await dl.save_as(P("exam.html"))
        html = open(P("exam.html"), encoding="utf-8").read()
        piece = await pg.evaluate("AUD().q2.src.slice(200, 260)")
        ok("the recordings are locked inside the student file", piece not in html and len(html) > 100_000)
        ok("no errors in BEE", not errs, errs[:3])
        await ctx.close()

        # the student
        sc, sp, serrs = await student(b, P("exam.html"))
        await sp.evaluate(FAKE_TTS)
        await sp.fill("#stName", "Ada"); await sp.fill("#stCode", "VOIC-2345"); await sp.click("#stGo"); await sp.wait_for_timeout(2500)
        u = await sp.evaluate("UNITS.map(u => [u.label, !!u.audio])")
        has = {l: a for l, a in u}
        ok("the student file has your voice for what you recorded (not for the changed question or the unrecorded text)",
           has.get("Instructions") and has.get("Question 2") and has.get("Question 3 (a)") and has.get("Question 3 (b)") and has.get("Question 1") is False and not any(a for l, a in u if l == "Text" or l.startswith("Read this")), u)
        await sp.evaluate("fillVoices()")
        ok("🎙️ Your teacher's voice is chosen first", await sp.evaluate("$('#ttsVoice').value") == "__teacher" and await sp.evaluate("$('#ttsVoice').options.length") == 2)
        i2 = await sp.evaluate("UNITS.findIndex(u => u.label === 'Question 2')")
        await sp.click(f'[data-say="{i2}"]'); await sp.wait_for_timeout(700)
        ok("🔊 plays your recording", await sp.evaluate("TTS.rec && !VO.paused && VO.currentTime > 0 && speechSynthesis.q.length === 0"))
        await sp.click("#ttsPlay"); p1 = await sp.evaluate("VO.paused"); await sp.click("#ttsPlay"); await sp.wait_for_timeout(200)
        ok("⏸ pauses and ▶ carries on", p1 and await sp.evaluate("!VO.paused"))
        await sp.evaluate("$('#ttsRate').value = '1.5'; $('#ttsRate').dispatchEvent(new Event('input')); $('#ttsRate').dispatchEvent(new Event('change'))")
        ok("the speed applies to your recording", await sp.evaluate("VO.playbackRate") == 1.5 and await sp.evaluate("!VO.paused"))
        await sp.wait_for_timeout(2500)
        ok("at the end of the recording it stops (▶ to hear it again)", await sp.evaluate("VO.ended || VO.paused") and await sp.text_content("#ttsPlay") == "▶")
        # keep reading: recording → recording → the computer voice for the text not recorded
        await sp.evaluate("$('#ttsRate').value = '2'; $('#ttsRate').dispatchEvent(new Event('input')); $('#ttsGo').checked = true")
        await sp.evaluate("readUnit(UNITS.findIndex(u => u.label === 'Instructions'))")
        seen = []
        for _ in range(40):
            s = await sp.evaluate("[TTS.i, TTS.rec, UNITS[TTS.i] && UNITS[TTS.i].label, speechSynthesis.q.length]")
            if not seen or seen[-1][:2] != s[:2]: seen.append(s)
            if not s[1] and s[3] > 0: seen[-1] = s; break
            await sp.wait_for_timeout(250)
        ok("✔ keep reading: your recordings one after another, then the computer voice for the rest", len(seen) >= 3 and seen[0][1] and seen[1][1] and not seen[-1][1] and seen[-1][3] > 0, seen)
        await sp.evaluate("stopReading()")
        ok("■ stops your recording", await sp.evaluate("VO.paused && TTS.i === -1"))
        # a laptop that can't play the recording: the computer voice reads it instead
        await sp.evaluate("UNITS[UNITS.findIndex(u => u.label === 'Question 3 (a)')].audio = 'data:audio/webm;base64,AAAAAAAA'")
        await sp.evaluate("readUnit(UNITS.findIndex(u => u.label === 'Question 3 (a)'))"); await sp.wait_for_timeout(1200)
        ok("a recording this laptop can't play → the computer voice reads it", await sp.evaluate("!TTS.rec && speechSynthesis.q.length > 0 && UNITS[TTS.i].audioBad === true"))
        await sp.evaluate("stopReading()")
        # the student prefers the computer voice
        await sp.evaluate("$('#ttsVoice').value = 'v1'; $('#ttsVoice').dispatchEvent(new Event('change'))"); await sp.click(f'[data-say="{i2}"]'); await sp.wait_for_timeout(300)
        ok("choosing a computer voice reads with it instead", await sp.evaluate("!TTS.rec && VO.paused && speechSynthesis.q.length > 0"))
        await sp.select_option("#ttsVoice", "__teacher"); await sp.wait_for_timeout(500)
        ok("…and back to your voice", await sp.evaluate("TTS.rec && !VO.paused"))
        await sp.evaluate("left('test')"); await sp.wait_for_timeout(300)
        ok("leaving the test locks it and stops the recording", await sp.is_visible("#scrLock") and await sp.evaluate("VO.paused"))
        ok("no errors in the student file", not serrs, serrs[:3])
        await sc.close()

        # (Firefox and Safari: tbrowsers.py records and plays in those browsers)
        await b.close()
    print(f"\n{sum(res)}/{len(res)} passed")
    sys.exit(0 if all(res) else 1)

if __name__ == "__main__": asyncio.run(main())
