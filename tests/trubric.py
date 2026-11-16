import asyncio, base64
from playwright.async_api import async_playwright
import os; APP='file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'download', 'Exam_Builder_offline.html'))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1440,'height':1300})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:200]))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(APP); await pg.wait_for_timeout(1500)
        items=[{'id':'s1','type':'section','text':'Part I','marks':''}]
        items += [{'id':f'q{i}','type':'q','text':f'Reading question {i}','marks':'3'} for i in range(5)]
        items += [{'id':'s2','type':'section','text':'Part II – Essay Writing','marks':''},{'id':'e1','type':'q','text':'Write an essay of 300–400 words about a person who inspires you.','marks':'100','lines':'25'}]
        await pg.evaluate("o=>__exam.set(o)", {'d':{'title':'Semester 1 Exam','subject':'English Language Arts','className':'Grade 3','teacher':'Ms. J. Clark'},'items':items})
        await pg.click('#stSkip')
        # turn the rubric on from the UI (defaults to the ELA essay template)
        await pg.click('.switch'); await pg.wait_for_timeout(400)
        el = await pg.query_selector('.rubric-panel'); await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path='rubric_ui.png', clip={'x':0,'y':0,'width':1440,'height':1300})
        r=await pg.evaluate("(async()=>{await prepareMath(); const d=__exam.buildPDF(); return [d.output('datauristring'), d.getNumberOfPages()]})()")
        open('rubric_essay.pdf','wb').write(base64.b64decode(r[0].split(',',1)[1])); print('pages', r[1])
        # second version: descriptions + comments box, science template
        await pg.evaluate("S.d.rubric.showDesc=true; S.d.rubric.showComments=true; renderRubric()")
        r=await pg.evaluate("(async()=>{await prepareMath(); const d=__exam.buildPDF({rubricOnly:true}); return [d.output('datauristring'), d.getNumberOfPages()]})()")
        open('rubric_essay_desc.pdf','wb').write(base64.b64decode(r[0].split(',',1)[1])); print('rubric only pages', r[1])
        await pg.select_option('#rbPreset','lab'); await pg.wait_for_timeout(300)
        await pg.evaluate("S.d.rubric.showParts=false; renderRubric()")
        r=await pg.evaluate("(async()=>{await prepareMath(); const d=__exam.buildPDF({rubricOnly:true, large:true}); return [d.output('datauristring'), d.getNumberOfPages()]})()")
        open('rubric_lab_large.pdf','wb').write(base64.b64decode(r[0].split(',',1)[1])); print('lab large pages', r[1])
        print('errors', errs); await b.close()
asyncio.run(main())
