"""⌨️ During the test students only type: Cmd / the Windows key / Ctrl + any key lock the test at once;
Shift and Option/AltGr (capitals, symbols, accents) never do; copy, cut, paste and drop are off everywhere.
Needs the website served on 127.0.0.1:8765 (run_all.py does this)."""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _bee import OUT
from tstudent import make_student_file, student, FAKE_TTS
from playwright.async_api import async_playwright

os.makedirs(OUT, exist_ok=True)
res = []
def ok(name, cond, info=""):
    res.append(bool(cond)); print(("PASS " if cond else "FAIL ") + name + ("" if cond else f"   → {info}"))

UNLOCK = "async () => { $('#lkCode').value = '246802'; await $('#lkGo').onclick(); }"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        c, pg, errs, d = await make_student_file(b, code="KEYS-2345", tcode="246802")
        f = os.path.join(OUT, "keys_exam.html"); await d.save_as(f); await c.close()
        sc, sp, serrs = await student(b, f)
        await sp.fill("#stName", "Leo"); await sp.fill("#stCode", "KEYS-2345"); await sp.click("#stGo"); await sp.wait_for_timeout(2500)
        ta = sp.locator("#paper textarea").first; await ta.click()
        await sp.keyboard.type("Hello World? (a+b)=2"); await sp.keyboard.press("Shift+A")
        await sp.keyboard.down("Alt"); await sp.keyboard.press("e"); await sp.keyboard.up("Alt")          # Option+E (accents on a Mac)
        await sp.keyboard.down("Control"); await sp.keyboard.down("Alt"); await sp.keyboard.press("2"); await sp.keyboard.up("Alt"); await sp.keyboard.up("Control")   # AltGr+2 on Windows
        await sp.wait_for_timeout(300)
        ok("typing with Shift, Option and AltGr never locks", not await sp.is_visible("#scrLock") and (await ta.input_value()).startswith("Hello World? (a+b)=2A"), await ta.input_value())
        cases = [("Meta", "pressed Cmd" if sys.platform == "darwin" else "pressed the Windows key"), ("Meta+Space", None), ("Control+c", "pressed Ctrl + C"), ("Control+v", "pressed Ctrl + V"),
                 ("Control+z", "pressed Ctrl + Z"), ("Control+t", "pressed Ctrl + T"), ("Meta+Tab", None)]
        for keys, how in cases:
            await ta.click(); await sp.keyboard.press(keys); await sp.wait_for_timeout(250)
            locked = await sp.is_visible("#scrLock")
            last = await sp.evaluate("(ST.log.filter(l => l.kind === 'left').pop() || {}).how || ''")
            ok(f"{keys} → the test locks, with the alarm, recorded", locked and await sp.evaluate("beeps") > 0 and (how is None or last == how), [locked, last])
            await sp.evaluate(UNLOCK); await sp.wait_for_timeout(400)
            if await sp.is_visible("#scrLock"): ok(f"teacher code reopens it after {keys}", False); break
        ok("the teacher code reopens the test each time", not await sp.is_visible("#scrLock"))
        # pasting, even into an answer, and copying out
        await ta.click()
        r = await sp.evaluate("""() => { const t = document.querySelector('#paper textarea'); const before = t.value;
          const dt = new DataTransfer(); dt.setData('text/plain', 'COPIED FROM THE WEB');
          const pe = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }); t.dispatchEvent(pe);
          const ce = new ClipboardEvent('copy', { bubbles: true, cancelable: true }); t.dispatchEvent(ce);
          const de = new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }); t.dispatchEvent(de);
          return [pe.defaultPrevented, ce.defaultPrevented, de.defaultPrevented, t.value === before]; }""")
        ok("paste, copy and drop are switched off, even inside an answer", r == [True, True, True, True], r)
        ok("the answer kept what was typed", (await ta.input_value()).startswith("Hello World"))
        # the lock screen itself: the teacher can type the code; extra presses don't pile up locks
        await sp.keyboard.press("Meta"); await sp.wait_for_timeout(200); n = await sp.evaluate("ST.log.filter(l => l.kind === 'left').length")
        await sp.keyboard.press("Control+v"); await sp.wait_for_timeout(200)
        ok("while locked, more presses add nothing", await sp.evaluate("ST.log.filter(l => l.kind === 'left').length") == n)
        await sp.click("#lkCode"); await sp.keyboard.type("246802"); await sp.click("#lkGo"); await sp.wait_for_timeout(500)
        ok("the teacher types the code on the lock screen and it opens", not await sp.is_visible("#scrLock"))
        ok("no errors", not serrs and not errs, (serrs + errs)[:3])
        await b.close()
    print(f"\n{sum(res)}/{len(res)} passed")
    sys.exit(0 if all(res) else 1)

if __name__ == "__main__": asyncio.run(main())
