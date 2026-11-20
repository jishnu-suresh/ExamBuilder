import asyncio, base64
from playwright.async_api import async_playwright
import os; APP='file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'download', 'Exam_Builder_offline.html'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**__import__('_bee').chrome()); pg=await b.new_page(viewport={'width':1440,'height':1000})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:150]))
        await pg.goto(APP); await pg.wait_for_timeout(1500)
        await pg.evaluate("__exam.set({d:{subject:'Biology'}, items:[]})"); await pg.click('#stSkip')
        await pg.set_input_files('#fileIn',[__import__('_bee').fx('photo.jpg'),__import__('_bee').fx('photo.jpg'),__import__('_bee').fx('photo.jpg')]); await pg.wait_for_timeout(1500)
        long = "Look at the diagram of the flower. " + "Describe the function of each labelled part and explain how the structure of the flower is adapted for pollination by insects. " * 4
        await pg.evaluate("""(t)=>{ const q=__exam.S().items.filter(x=>x.type=='q');
          q[0].text=t; q[0].marks='6'; q[0].lines='3';
          q[1].text='Name the part shown and give one function. Keep your answer short.'; q[1].marks='2';
          q[2].text='Which colour is the flower in the photo?'; q[2].mcq='single'; q[2].options=['Red','Blue','Yellow','White']; q[2].marks='1'; }""", long)
        await pg.evaluate("render()")
        # turn on wrap via the UI: Q1 left, Q2 right, Q3 left
        cards = await pg.query_selector_all('.card')
        await pg.click('.card:nth-child(1) [data-act=align][data-v=left]'); await pg.wait_for_timeout(150)
        await pg.click('.card:nth-child(1) [data-f=imgWrap]'); await pg.wait_for_timeout(150)
        await pg.click('.card:nth-child(2) [data-act=align][data-v=right]'); await pg.wait_for_timeout(150)
        await pg.click('.card:nth-child(2) [data-f=imgWrap]'); await pg.wait_for_timeout(150)
        await pg.click('.card:nth-child(3) [data-f=imgWrap]'); await pg.wait_for_timeout(300)
        st = await pg.evaluate("__exam.S().items.map(x=>[x.imgAlign||'left', !!x.imgWrap, x.imgSize])")
        print('state:', st)
        el = await pg.query_selector('.card:nth-child(2)'); await el.scroll_into_view_if_needed(); await pg.screenshot(path='wrap_ui.png')
        r=await pg.evaluate("(async()=>{await prepareMath(); return __exam.buildPDF().output('datauristring')})()")
        open('wrap.pdf','wb').write(base64.b64decode(r.split(',',1)[1]))
        print('errors', errs); await b.close()
asyncio.run(main())
