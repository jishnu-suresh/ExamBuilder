import asyncio, base64, json
from playwright.async_api import async_playwright
import os
APP='file://' + os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'download', 'Exam_Builder_offline.html'))
R=[]
def ok(n,c,x=""): R.append(bool(c)); print(("PASS " if c else "FAIL ")+n, x if not c else "")
TXT = r"""Part I: Science
1. Look at the circuit diagram below.
(a) Name component X. [1] {lines: 1}
Model answer: A resistor
(b) Calculate the current when $V = 6\,\mathrm{V}$ and $R = 3\,\Omega$. Show your working. [3] {lines: 3}
Model answer: $I = \frac{V}{R} = \frac{6}{3} = 2\,\mathrm{A}$
2. Which gas do plants absorb? [1] {mcq}
a) Oxygen
b) Carbon dioxide {correct}
c) Nitrogen
d) All of the above
3. Explain how plants make their food. [4] {lines: 4}
Model answer: By photosynthesis: light energy is used to turn carbon dioxide and water into glucose and oxygen.
4. Select all the noble gases. [2] {mcq: multi} {cols: 4}
a) Neon {correct}
b) Oxygen
c) Argon {correct}
d) None of the above
Read the passage below.
Part II: Maths
5. Sketch the graph of $y = x^2$. [3] {lines: 6}
6. Solve $2x + 5 = 17$. [2] {lines: 3}
7. Factorise $x^2 - 9$. [2] {lines: 2}
8. Simplify $\frac{6}{8}$. [1] {lines: 1}
"""
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome'); pg=await b.new_page(viewport={'width':1440,'height':1100})
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:200]))
        await pg.goto(APP); await pg.wait_for_timeout(1500)
        await pg.evaluate("__exam.set({d:{subject:'Science & Maths'}, items:[]})"); await pg.click('#stSkip')
        # ---- 1 parsing
        await pg.click('#tilePaste'); await pg.fill('#pasteArea', TXT); await pg.dispatch_event('#pasteArea','input')
        ok("1a paste count incl. sub-question marks", 'Found 8 questions in 2 parts · 19 marks' in await pg.text_content('#pasteCount'), await pg.text_content('#pasteCount'))
        await pg.click('#pasteGo'); await pg.wait_for_timeout(1200)
        Q = await pg.evaluate("__exam.S().items.filter(x=>x.type=='q')")
        q1=Q[0]
        ok("1b sub-questions parsed", len(q1.get('subs',[]))==2 and q1['subs'][0]['marks']=='1' and q1['subs'][1]['marks']=='3' and q1['subs'][1]['lines']=='3', q1)
        ok("1c sub model answers parsed", q1['subs'][0]['answer']=='A resistor' and 'frac{V}{R}' in q1['subs'][1]['answer'])
        ok("1d stem text kept clean", q1['text']=='Look at the circuit diagram below.', repr(q1['text']))
        ok("1e MCQ correct parsed", Q[1].get('correct')==[1] and Q[1]['options'][1]=='Carbon dioxide', Q[1])
        ok("1f multi correct parsed", Q[3].get('correct')==[0,2], Q[3].get('correct'))
        ok("1g question model answer parsed", Q[2].get('answer','').startswith('By photosynthesis') and Q[2]['text']=='Explain how plants make their food.', Q[2])
        ok("1h marks: Q1 = 4 (sum of parts)", await pg.evaluate("qMarks(__exam.S().items.filter(x=>x.type=='q')[0])")==4)
        # ---- 2 card UI: sub-questions, answer spaces, correct ✓, new page, line numbers
        q6 = Q[5]['id']; c6=f'.card[data-id="{q6}"]'
        await pg.select_option(c6+' select[data-f=space]','grid'); await pg.wait_for_timeout(150)
        await pg.fill(c6+' input[data-f=lines]','5'); await pg.wait_for_timeout(150)
        q5 = Q[4]['id']; c5=f'.card[data-id="{q5}"]'
        await pg.select_option(c5+' select[data-f=space]','box'); await pg.wait_for_timeout(150)
        q7 = Q[6]['id']; c7=f'.card[data-id="{q7}"]'
        await pg.select_option(c7+' select[data-f=space]','blank'); await pg.wait_for_timeout(150)
        await pg.click(c7+' [data-act=subadd]'); await pg.wait_for_timeout(200)
        await pg.keyboard.type('Hence solve $x^2 - 9 = 0$.')
        sid = await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{q7}').subs[0].id")
        await pg.fill(f'{c7} input[data-sub="{sid}"][data-sf=marks]','2'); await pg.wait_for_timeout(200)
        dis = await pg.evaluate(f"(()=>{{const i=document.querySelector('{c7} input[title^=\"The sum\"]'); return i && i.disabled ? i.value : null}})()")
        ok("2a adding a sub-question with marks → question marks become the sum (no redraw while typing)", dis=='2', dis)
        await pg.click(f'{c7} [data-act=subans][data-sid="{sid}"]'); await pg.wait_for_timeout(200)
        await pg.keyboard.type('$x = 3$ or $x = -3$')
        await pg.click(f'{c7} [data-act=showans]'); await pg.wait_for_timeout(200)
        await pg.keyboard.type('$(x-3)(x+3)$')
        it7 = await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{q7}')")
        ok("2b model answers typed (question + part)", it7.get('answer')=='$(x-3)(x+3)$' and it7['subs'][0]['answer']=='$x = 3$ or $x = -3$', it7)
        q2 = Q[1]['id']; c2=f'.card[data-id="{q2}"]'
        await pg.click(f'{c2} [data-act=correct][data-oi="2"]'); await pg.wait_for_timeout(150)
        ok("2c ✓ on a single-answer MCQ replaces the old correct one", await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{q2}').correct")==[2])
        await pg.click(f'{c2} [data-act=correct][data-oi="1"]'); await pg.wait_for_timeout(150)
        await pg.click(f'{c5} [data-act=newpage]'); await pg.click(f'{c5} [data-act=linenums]'); await pg.wait_for_timeout(150)
        ok("2d new page + line numbers toggles", await pg.evaluate(f"(()=>{{const i=__exam.S().items.find(x=>x.id=='{q5}'); return !!i.newPage && !!i.lineNums}})()"))
        # equation into the sub-question box
        await pg.focus(f'{c7} textarea[data-sub="{sid}"][data-sf=text]'); await pg.keyboard.press('End')
        await pg.evaluate(f"document.querySelector('{c7} textarea[data-sub=\"{sid}\"][data-sf=text]').blur()")
        await pg.click(f'{c7} [data-ins]'); await pg.click(f'{c7} .ins-it[data-act=eq]'); await pg.wait_for_timeout(400)
        await pg.click('#eqTabs button[data-m=latex]'); await pg.fill('#eqTex','\\sqrt{9}'); await pg.click('#eqInsert'); await pg.wait_for_timeout(300)
        st = await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{q7}').subs[0].text")
        ok("2e equation editor inserts into the sub-question it was used in", st.endswith('$\\sqrt{9}$'), st)
        await pg.screenshot(path='feat_card.png', clip={'x':0,'y':0,'width':760,'height':1100})
        # a long passage with line numbers
        await pg.evaluate("""(()=>{const S=__exam.S(); const k=S.items.findIndex(x=>x.type=='section' && /Maths/.test(x.text)); S.items.splice(k+1,0,{id:'pass1',type:'note',text:'',img:null}); const i=k+1; S.items[i].text='Read the passage below. ' + 'The river winds slowly through the quiet valley, carrying leaves and stories from the mountains to the sea. '.repeat(9); S.items[i].lineNums=true; render();})()""")
        # ---- 3 PDFs
        async def pdf(opt, name):
            r=await pg.evaluate(f"(async()=>{{await prepareMath(); const d=__exam.buildPDF({opt}); return [d.output('datauristring'), d.getNumberOfPages()]}})()")
            open(name,'wb').write(base64.b64decode(r[0].split(',',1)[1])); return r[1]
        n1 = await pdf('{}','feat_exam.pdf'); n2 = await pdf('{key:true}','feat_key.pdf')
        ok("3a exam & answer key build", n1>=3 and n2>=3, f"{n1} / {n2}")
        # ---- 4 versions
        v = await pg.evaluate("""(()=>{const out={}; for(const L of ['A','B','C']){ const its=versionItems(__exam.S().items,L,true,true); out[L]={order: its.filter(x=>x.type=='q').map(x=>x.text.slice(0,12)), mcq: its.filter(x=>x.mcq).sort((a,b)=>a.text<b.text?-1:1).map(x=>[x.options, x.correct.map(i=>x.options[i])]), kinds: its.map(x=>x.type)}; } return out;})()""")
        ok("4a versions differ in question order", v['A']['order']!=v['B']['order'] or v['B']['order']!=v['C']['order'], v['A']['order'])
        ok("4b correct answers follow their options", all(vv['mcq'][1][1]==['Carbon dioxide'] for vv in v.values()) and all(sorted(vv['mcq'][0][1])==['Argon','Neon'] for vv in v.values()))
        ok("4c 'All/None of the above' stay last", all(vv['mcq'][1][0][-1]=='All of the above' and vv['mcq'][0][0][-1]=='None of the above' for vv in v.values()))
        ok("4d parts/passages stay in place", all(vv['kinds']==v['A']['kinds'] for vv in v.values()))
        same = await pg.evaluate("JSON.stringify(versionItems(__exam.S().items,'B',true,true).map(x=>x.id))==JSON.stringify(versionItems(__exam.S().items,'B',true,true).map(x=>x.id))")
        ok("4e Version B is always the same Version B", same)
        S0 = await pg.evaluate("JSON.stringify(__exam.S().items.map(x=>x.id))")
        nv = await pg.evaluate("(async()=>{await prepareMath(); const saved=S.items; S.items=versionItems(saved,'B',true,true); try{ const d=buildPDF({version:'B', key:true}); return [d.getNumberOfPages(), d.output('datauristring')] } finally { S.items=saved; }})()")
        open('feat_versionB_key.pdf','wb').write(base64.b64decode(nv[1].split(',',1)[1]))
        ok("4f exam unchanged after building a version", await pg.evaluate("JSON.stringify(__exam.S().items.map(x=>x.id))")==S0)
        # ---- 5 find & replace + undo
        await pg.wait_for_timeout(800)
        await pg.keyboard.press('Control+h'); await pg.wait_for_timeout(200)
        await pg.fill('#frFind','plants'); await pg.wait_for_timeout(150)
        info = await pg.text_content('#frInfo')
        await pg.fill('#frRep','green plants'); await pg.click('#frGo'); await pg.wait_for_timeout(300)
        t2 = await pg.evaluate("__exam.S().items.filter(x=>x.type=='q')[1].text")
        ok("5a find & replace (incl. model answers)", 'match' in info and t2=='Which gas do green plants absorb?', f"{info} | {t2}")
        await pg.click('#frModal [data-close]'); await pg.wait_for_timeout(800)
        await pg.click('#btnUndo'); await pg.wait_for_timeout(300)
        ok("5b undo reverts the replace", await pg.evaluate("__exam.S().items.filter(x=>x.type=='q')[1].text")=='Which gas do plants absorb?')
        # ---- 6 save/open keeps the new fields
        snap = json.loads(await pg.evaluate("JSON.stringify(snapshot())"))
        q = [x for x in snap['items'] if x['type']=='q']
        ok("6a project file keeps subs / answers / correct / space", q[0].get('subs') and q[1].get('correct') and q[5].get('space')=='grid' and q[2].get('answer'))
        ok("Z no JS errors", not errs, errs[:4])
        print(f"{sum(R)}/{len(R)} passed"); await b.close()
asyncio.run(main())
