import asyncio, base64, sys, json
from playwright.async_api import async_playwright
import os; APP='file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'download', 'Exam_Builder_offline.html'))
CASES = {
 'full': {'d':{'title':'Semester 1 Examination','subtitle':'Unit 4 — Cells, Genetics, Ecology & Evolution of Living Organisms','subject':'Biology and Environmental Science','year':'2025-2026','duration':'2 hours 30 minutes','teacher':'Jenifer Clark','className':'Grade 11B','date':'12 December 2025','answerMode':'sheet',
   'instructions':"Write all answers clearly, legibly and neatly using a blue or black ink pen.\nYou may use pencils for drawing if needed.\nWrite your answers on the separate answer sheet provided.\nFor multiple-choice questions, you may highlight the chosen answer directly on the exam paper.\nCalculators are not allowed in Part I but may be used in Parts II and III.\nShow all your working for full marks."},
   'parts':6},
 'simple': {'d':{'subject':'Mathematics','teacher':'J. Clark'}, 'parts':2},
}
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**__import__('_bee').chrome()); pg=await b.new_page()
        await pg.goto(APP); await pg.wait_for_timeout(1500)
        for name,c in CASES.items():
            items=[]
            for k in range(c['parts']):
                items.append({'id':f's{k}','type':'section','text':f'Part {k+1}: Section name {k+1}','marks':''})
                items.append({'id':f'q{k}','type':'q','text':'Question','marks':'10'})
            await pg.evaluate("o=>__exam.set(o)", {'d':c['d'],'items':items})
            for large in [False, True]:
                r=await pg.evaluate(f"(async()=>{{await prepareMath(); return __exam.buildPDF({{coverOnly:true, large:{str(large).lower()}}}).output('datauristring')}})()")
                open(f'cov_{name}_{int(large)}.pdf','wb').write(base64.b64decode(r.split(',',1)[1]))
        await b.close()
asyncio.run(main())
