import asyncio, time, base64
from playwright.async_api import async_playwright
R=[]
def ok(n,c,x=""): R.append(c); print(("PASS " if c else "FAIL ")+n, x)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**__import__('_bee').chrome())
        ctx=await b.new_context(viewport={'width':1440,'height':1000})
        pg=await ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:160]))
        t=time.time(); await pg.goto('http://localhost:8765/', wait_until='load'); ok("page loads", True, "%.2fs"%(time.time()-t))
        ok("PWA mode on", await pg.evaluate("!!window.__PWA__"))
        man = await pg.evaluate("fetch('manifest.webmanifest').then(r=>r.json())")
        ok("manifest valid", man['short_name']=='BEE' and len(man['icons'])==3 and man['display']=='standalone')
        await pg.wait_for_function("navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(()=>true)", timeout=30000)
        await pg.evaluate("navigator.serviceWorker.ready")
        await pg.wait_for_timeout(4000)  # background caching of lazy files
        keys = await pg.evaluate("caches.keys()")
        ok("caches created (core + lazy)", any(k.startswith('eb-core') for k in keys) and any(k.startswith('eb-lazy') for k in keys), keys)
        lazy_n = await pg.evaluate("(async()=>{const c=await caches.open((await caches.keys()).find(k=>k.startsWith('eb-lazy'))); return (await c.keys()).length})()")
        ok("photo reader pre-cached for offline", lazy_n>=5, lazy_n)
        await pg.click('#stSkip')
        await pg.click('#tilePaste'); await pg.fill('#pasteArea', open(__import__('_bee').fx('ai_paste.txt')).read() + "\n12. Ελληνικά and кириллица text test. [1]"); await pg.click('#pasteGo')
        await pg.wait_for_function("document.querySelectorAll('#pv canvas').length>=2", timeout=20000)
        ok("pdf.js preview renders pages", await pg.evaluate("document.querySelectorAll('#pv canvas').length")>=2)
        ok("unicode fonts lazy-loaded", await pg.evaluate("!!window.__FONTS__ && FONT_R.length>1000"))
        # edit a late question → preview scrolls to its page, no full reload
        await pg.evaluate("document.querySelector('#pv').scrollTop=0")
        lastq = await pg.evaluate("__exam.S().items.filter(x=>x.type=='q').at(-2).id")
        await pg.fill(f'.card[data-id="{lastq}"] textarea[data-f=text]', 'Evaluate (edited) $$\\int_0^2 (3x^2+1)\\,dx$$'); await pg.wait_for_timeout(2500)
        ok("preview scrolled to edited page", await pg.evaluate("document.querySelector('#pv').scrollTop")>200, await pg.evaluate("document.querySelector('#pv').scrollTop"))
        await pg.screenshot(path='pwa_ui.png')
        # OCR via lazy path
        await pg.evaluate("$('#qMore').open = true"); await pg.click('#photoMode button[data-m=offline]')
        await pg.set_input_files('#fileIn',[__import__('_bee').fx('page_photo.jpg')])
        await pg.wait_for_function("document.querySelector('#ocrText').value.length>20 || /⚠/.test(document.querySelector('#ocrMsg').textContent)", timeout=120000)
        txt = await pg.input_value('#ocrText'); ok("offline photo reader works (lazy-loaded)", 'passive voice' in txt, txt[:60].replace('\n',' | '))
        await pg.click('#ocrCancel')
        # offline reload
        await ctx.set_offline(True)
        await pg.reload(wait_until='load'); await pg.wait_for_timeout(2500)
        ok("app opens with no internet", await pg.evaluate("typeof buildPDF==='function' && !!window.jspdf && !!window.MathJax && !!window.pdfjsLib"))
        await pg.click('#stContinueLocal') if await pg.is_visible('#stContinueLocal') else await pg.click('#stSkip')
        n = await pg.evaluate("(async()=>{await prepareMath(); return __exam.buildPDF().getNumberOfPages()})()")
        ok("PDF builds offline, work restored", n>=3 and await pg.evaluate("__exam.S().items.length")>10, n)
        ok("no JS errors", not [e for e in errs if 'favicon' not in e], errs[:5])
        print(f"{sum(R)}/{len(R)} passed"); await b.close()
asyncio.run(main())
