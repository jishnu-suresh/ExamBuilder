import asyncio, base64
from playwright.async_api import async_playwright
R=[]
def ok(n,c,x=""): R.append(c); print(("PASS " if c else "FAIL ")+n, x)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**__import__('_bee').chrome()); pg=await b.new_page(viewport={'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:150]))
        await pg.goto('file://' + __import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'docs', 'download', 'Exam_Builder_offline.html')) + ''); await pg.wait_for_timeout(1500)
        await pg.evaluate("__exam.set({d:{subject:'Toggle test'}, items:[]})"); await pg.click('#stSkip')
        await pg.click('#addQ'); await pg.wait_for_timeout(200)
        card='.card:last-child'; ta=card+' textarea[data-f=text]'
        async def sel(word):
            await pg.evaluate(f"(()=>{{const t=document.querySelector('{ta}'); const i=t.value.indexOf('{word}'); t.focus(); t.setSelectionRange(i,i+{len(word)});}})()")
        async def colour(c):   # colours sit behind the 🎨 button
            await pg.click(card+' [data-swtoggle]'); await pg.click(card+f' [data-fmt=color][data-c="{c}"]')
        async def txt(): return await pg.evaluate("__exam.S().items.at(-1).text")
        # user's messy example: clicking blue on the selected word removes the colour (and the duplicates)
        await pg.fill(ta, "{color:#1F5FBF}{color:#1F5FBF}{color:#1F5FBF}Hello {/color}{/color}{/color} $\\frac{a}{b}\\cdot\\frac12\\left(x^2+3y^3\\right)$")
        await sel('Hello'); await colour('#1F5FBF')
        t=await txt(); ok("1a messy repeated colour cleaned/toggled off", t=="Hello  $\\frac{a}{b}\\cdot\\frac12\\left(x^2+3y^3\\right)$", t)
        await colour('#1F5FBF'); t=await txt()
        ok("1b click again → blue on (once)", t.startswith("{color:#1F5FBF}Hello{/color} "), t)
        await colour('#1F5FBF'); t=await txt()
        ok("1c click again → off", t.startswith("Hello  $"), t)
        await pg.click(card+' [data-fmt=b]'); t1=await txt(); await pg.click(card+' [data-fmt=b]'); t2=await txt()
        ok("1d bold on then off", t1.startswith("**Hello**") and t2.startswith("Hello  $"), f"{t1[:12]} | {t2[:12]}")
        await pg.click(card+' [data-fmt=b]'); await pg.click(card+' [data-fmt=i]'); await pg.click(card+' [data-fmt=u]'); await colour('#C0392B')
        t=await txt(); ok("1e bold+italic+underline+red stack once", t.startswith("{color:#C0392B}++***Hello***++{/color}"), t[:45])
        on = await pg.evaluate(f"[...document.querySelectorAll('{card} .fmtbar .on')].map(x=>x.dataset.fmt+(x.dataset.c||''))")
        ok("1f buttons light up for the selection", set(on)>={'b','i','u','color#C0392B'}, on)
        await pg.click(card+' [data-fmt=i]'); t=await txt(); ok("1g italic off keeps the rest", t.startswith("{color:#C0392B}++**Hello**++{/color}"), t[:40])
        runs = await pg.evaluate("parseInline(__exam.S().items.at(-1).text.split(' $')[0])")
        ok("1h parser reads it back", runs and runs[0]['b'] and runs[0]['u'] and not runs[0]['i'] and runs[0]['c']=='#C0392B', runs)
        # partial phrase across words
        await pg.fill(ta, "Underline these three words please"); await sel('these three words'); await pg.click(card+' [data-fmt=u]')
        t=await txt(); ok("1i multi-word underline", t=="Underline ++these three words++ please", t)
        await sel('three'); await pg.click(card+' [data-fmt=u]'); t=await txt()
        ok("1j toggle one word off inside", t=="Underline ++these++ three ++words++ please", t)
        # 2: undo / redo
        await pg.wait_for_timeout(800)
        await pg.click('#addQ'); await pg.wait_for_timeout(200)
        await pg.fill(ta, "First draft"); await pg.wait_for_timeout(800)
        await pg.fill(ta, "Second draft"); await pg.wait_for_timeout(800)
        await pg.focus(ta); await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200)
        ok("2a Ctrl+Z restores previous text", await txt()=="First draft", await txt())
        ok("2b focus stays in the box", await pg.evaluate("document.activeElement.dataset.f")=='text')
        await pg.keyboard.press('Control+Shift+z'); await pg.wait_for_timeout(200)
        ok("2c Ctrl+Shift+Z redoes", await txt()=="Second draft")
        n=await pg.evaluate("__exam.S().items.length")
        await pg.click(card+' [data-act=del]'); await pg.wait_for_timeout(800)
        await pg.click('#btnUndo'); await pg.wait_for_timeout(200)
        ok("2d undo a deleted question (button)", await pg.evaluate("__exam.S().items.length")==n, n)
        await pg.keyboard.press('Meta+z'); await pg.wait_for_timeout(200)
        ok("2e Cmd+Z works too", await pg.evaluate("__exam.S().items.length")<=n)
        await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(200)
        # 3: separate answer sheet
        await pg.evaluate("__exam.set({d:{subject:'Sheet test'}, items:[]})")
        await pg.click('#tilePaste'); await pg.fill('#pasteArea', open(__import__('_bee').fx('ai_paste.txt')).read()); await pg.click('#pasteGo'); await pg.wait_for_timeout(1200)
        async def pages(large=False):
            return await pg.evaluate(f"(async()=>{{await prepareMath(); const d=__exam.buildPDF({{large:{str(large).lower()}}}); return [d.getNumberOfPages(), d.output('datauristring')]}})()")
        p1=(await pages())[0]
        await pg.evaluate("setFold('detPanel', false)")   # Exam details fold once an exam is open
        await pg.click('#setTabs [data-tab=print]'); await pg.select_option('[data-k=answerMode]','sheet'); await pg.wait_for_timeout(300)
        dis = await pg.evaluate("[...document.querySelectorAll('.card input[placeholder=sheet]')].length")
        nonmcq = await pg.evaluate("__exam.S().items.filter(x=>x.type=='q' && !x.mcq).length")
        ok("3a answer-space boxes disabled on every written question", dis==nonmcq and dis>=5, f"{dis}/{nonmcq}")
        r=await pages(); open('sheet.pdf','wb').write(base64.b64decode(r[1].split(',',1)[1]))
        ok("3b compact paper not longer", r[0] <= p1, f"{p1} → {r[0]}")
        rl=await pages(True); open('sheet_large.pdf','wb').write(base64.b64decode(rl[1].split(',',1)[1]))
        ok("3c large print still double spaced", rl[0] > r[0], f"large {rl[0]}")
        ok("Z no JS errors", not errs, errs[:4])
        print(f"{sum(R)}/{len(R)} passed"); await b.close()
asyncio.run(main())
