"""Page breaks: a long question near the bottom of a page carries on over the page instead of leaving a big gap."""
import asyncio, sys
from playwright.async_api import async_playwright
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__))); from _bee import chrome
JS = r"""(fill) => {
  const opt = (s) => s;
  const long = "A pilot flies an airplane in a vertical circular loop at a constant speed. Applying Newton's second law, which claim correctly compares the normal force exerted by the seat on the pilot at the bottom of the loop to the pilot's weight?\nA. The normal force is greater than the pilot's weight because the net force must point downward toward the center of the circular loop.\nB. The normal force is exactly equal to the pilot's weight because the airplane is traveling at a constant speed throughout the loop.\nC. The normal force is greater than the pilot's weight because the net force must point upward toward the center of the loop.\nD. The normal force is less than the pilot's weight because the pilot feels lighter at the bottom of the loop.";
  S.d.cover = false;
  S.items = [];
  for(let i = 0; i < fill; i++) S.items.push({ id: nid(), type: "q", text: "Filler question number " + i + " with a few words to make it a line.", marks: "", lines: "0", img: null });
  S.items.push({ id: nid(), type: "q", text: long, marks: "", lines: "0", img: null });
  const doc = buildPDF({}), n = doc.getNumberOfPages(), L = S.items[S.items.length - 1].id, prev = S.items[S.items.length - 2].id;
  const R = doc.__regions.filter(r => r.id === L), pages = [...new Set(R.map(r => r.p))];
  const lastPrev = doc.__regions.filter(r => r.id === prev).pop();
  const where = { pages, prevEnd: [lastPrev.p, Math.round(lastPrev.y1)], firstY: Math.round(R[0].y0), lines: R.map(r => r.p + "@" + Math.round(r.y0)).join(" ") };
  return { n, where };
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**chrome()); pg = await b.new_page()
        await pg.goto("http://127.0.0.1:8765/"); await pg.wait_for_timeout(1500)
        await pg.evaluate("$('#startModal').classList.remove('open')")
        r = {f: (await pg.evaluate(JS, f))["where"] for f in (14, 16, 18)}
        res = [r[14]["pages"] == [2], r[16]["pages"] == [2, 3], r[18]["pages"] == [3] and r[18]["firstY"] < 40]
        names = ["a question that fits stays whole", "a gap at the bottom: the question starts there and carries on over the page", "too little room for the question text and an option: it moves whole"]
        for n, c in zip(names, res): print(("PASS " if c else "FAIL ") + n + ("" if c else f"   → {r}"))
        print(f"{sum(res)}/{len(res)} passed"); await b.close(); sys.exit(0 if all(res) else 1)
asyncio.run(main())
