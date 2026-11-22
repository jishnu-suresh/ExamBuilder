import asyncio, base64, json, re
from playwright.async_api import async_playwright
MOCK = """
window.__files = {}; window.__writes = 0;
function mkHandle(name){ return { name, kind:'file',
  async queryPermission(){return 'granted'}, async requestPermission(){return 'granted'},
  async createWritable(){ let buf=''; return { async write(d){buf=d}, async close(){ window.__files[name]=buf; window.__writes++; } } },
  async getFile(){ return new File([window.__files[name]||''], name); } }; }
window.showSaveFilePicker = async (o) => mkHandle(o.suggestedName || 'x.exam.json');
window.showOpenFilePicker = async () => [mkHandle(window.__openName)];
"""
R = []
def ok(name, cond, extra=""):
    R.append((name, bool(cond), extra)); print(("PASS " if cond else "FAIL ") + name, extra)
async def pdf(pg, name, large=False):
    d = await pg.evaluate(f"(async()=>{{await prepareMath(); const doc=__exam.buildPDF({{large:{str(large).lower()}}}); return [doc.output('datauristring'), doc.getNumberOfPages()]}})()")
    open(name,'wb').write(base64.b64decode(d[0].split(',',1)[1])); return d[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(**__import__('_bee').chrome())
        ctx = await b.new_context(viewport={'width':1440,'height':1000})
        await ctx.add_init_script(MOCK)
        pg = await ctx.new_page()
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('console',lambda m: m.type=='error' and errs.append(m.text[:160]))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept('Part IV: Extra')))
        await pg.clock.install()
        await pg.goto('file://' + __import__('os').path.abspath(__import__('os').path.join(__import__('os').path.dirname(__file__), '..', 'docs', 'download', 'Exam_Builder_offline.html')) + ''); await pg.clock.run_for(1500)
        # A: start modal + new project file
        for _ in range(100):   # start-up reads browser storage in real time, which the fake clock doesn't speed up
            if await pg.is_visible('#startModal'): break
            await asyncio.sleep(.1)
        ok("A1 start screen shown on launch", await pg.is_visible('#startModal'))
        await pg.screenshot(path='dry_start.png')
        await pg.click('#stNew'); await pg.clock.run_for(300)
        for _ in range(50):   # ＋ New first keeps a 🕰️ copy in IndexedDB (real time, not the fake clock)
            if await pg.is_visible('#saveModal'): break
            await asyncio.sleep(.1)
        ok("A1b name dialog shown first", await pg.is_visible('#saveModal'))
        await pg.fill('#svName', 'Dry run exam'); await pg.click('#svGo'); await pg.clock.run_for(500)
        ok("A2 new project file created & written", await pg.evaluate("__writes")>=1, await pg.evaluate("Object.keys(__files)"))
        ok("A3 chip shows saved", 'Saved in' in await pg.text_content('#saveChip'), await pg.text_content('#saveChip'))
        await pg.fill('[data-k=subject]','Science Dry Run'); await pg.clock.run_for(1000)
        ok("A4 chip shows pending after edit", 'within a minute' in await pg.text_content('#saveChip'))
        w0 = await pg.evaluate("__writes"); await pg.clock.run_for(61000)
        f = json.loads(await pg.evaluate("Object.values(__files)[0]"))
        ok("A5 autosave after 1 minute overwrote same file", await pg.evaluate("__writes")==w0+1 and f['d']['subject']=='Science Dry Run' and len(await pg.evaluate("Object.keys(__files)"))==1)
        # B: paste from AI
        await pg.click('#tilePaste'); await pg.fill('#pasteArea', open(__import__('_bee').fx('ai_paste.txt')).read()); await pg.dispatch_event('#pasteArea','input'); await pg.clock.run_for(200)
        ok("B1 paste count preview", 'Found 11 questions in 3 parts' in await pg.text_content('#pasteCount'), await pg.text_content('#pasteCount'))
        await pg.click('#pasteGo'); await pg.clock.run_for(1500)
        for _ in range(50):   # the paste first keeps a 🕰️ copy in IndexedDB (real time, not the fake clock)
            if not await pg.evaluate("$('#pasteModal').classList.contains('open')"): break
            await asyncio.sleep(.1)
        await pg.clock.run_for(500)
        S = await pg.evaluate("__exam.S().items")
        qs=[x for x in S if x['type']=='q']
        ok("B2 11 questions, 3 parts", len(qs)==11 and sum(x['type']=='section' for x in S)==3)
        ok("B3 half width parsed for Q1-5", all(q.get('width')=='half' for q in qs[:5]))
        ok("B4 MCQ options extracted", qs[5].get('options')==['Mitochondrion','Chloroplast','Ribosome','Nucleus'] and qs[5]['mcq']=='single' and qs[5]['optCols']=='2', qs[5].get('options'))
        ok("B5 multi MCQ", qs[6]['mcq']=='multi' and len(qs[6]['options'])==4)
        ok("B6 marks parsed", [q['marks'] for q in qs]==['1']*5+['1','2','1','2','3','4'], [q['marks'] for q in qs])
        ok("B7 option with math kept", '\\ce{2H2' in qs[7]['options'][1])
        # C: MCQ editor
        await pg.click('#bottomBar [data-add=mcq]'); await pg.clock.run_for(400)
        nid = await pg.evaluate("__exam.S().items.at(-1).id")
        card = f'.card[data-id="{nid}"]'
        await pg.fill(card+' textarea[data-f=text]','Which is a mammal?')
        await pg.fill(card+' input[data-opt="0"]','Shark'); await pg.fill(card+' input[data-opt="1"]','Whale')
        await pg.press(card+' input[data-opt="1"]','Enter'); await pg.clock.run_for(100)
        await pg.keyboard.type('Trout')
        await pg.fill(card+' input[data-opt="4"]',''); await pg.focus(card+' input[data-opt="4"]'); await pg.keyboard.press('Backspace'); await pg.clock.run_for(100)
        opts = await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{nid}').options")
        ok("C1 options: fill, Enter inserts, Backspace removes", opts==['Shark','Whale','Trout','',], opts)
        await pg.click(card+' [data-act=optadd]'); await pg.clock.run_for(100)
        ok("C2 + Add option", len(await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{nid}').options"))==5)
        await pg.select_option(card+' select[data-f=mcq]','multi'); await pg.clock.run_for(100)
        ok("C3 switch to multiple answers", await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{nid}').mcq")=='multi')
        await pg.screenshot(path='dry_mcqcard.png', clip={'x':20,'y':0,'width':740,'height':1000})
        # D: written -> MCQ conversion and back
        await pg.click('#bottomBar [data-add=q]'); await pg.clock.run_for(300)
        did = await pg.evaluate("__exam.S().items.at(-1).id"); dc=f'.card[data-id="{did}"]'
        await pg.fill(dc+' textarea[data-f=text]','Pick the odd one out.\na) cat\nb) dog\nc) car'); await pg.clock.run_for(100)
        await pg.select_option(dc+' select[data-f=mcq]','single'); await pg.clock.run_for(100)
        it = await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{did}')")
        ok("D1 written→MCQ moves a)–c) into options", it['options']==['cat','dog','car'] and it['text']=='Pick the odd one out.', it)
        await pg.select_option(dc+' select[data-f=mcq]',''); await pg.clock.run_for(100)
        it = await pg.evaluate(f"__exam.S().items.find(x=>x.id=='{did}')")
        ok("D2 MCQ→written restores text", 'options' not in it and it['text'].endswith('C. car'), it['text'])
        # E: part 2-column toggle
        sec3 = await pg.evaluate("__exam.S().items.filter(x=>x.type=='section')[2].id")
        await pg.click(f'.card[data-id="{sec3}"] [data-act=sec2col]'); await pg.clock.run_for(100)
        ok("E1 '2 columns for this part' sets all its questions half", await pg.evaluate(f"__secQs('{sec3}').every(q=>q.width=='half')"))
        await pg.click(f'.card[data-id="{sec3}"] [data-act=sec2col]'); await pg.clock.run_for(100)
        ok("E2 toggle back", await pg.evaluate(f"__secQs('{sec3}').every(q=>!q.width)"))
        # F: preview jumps to edited question's page
        await pg.evaluate("document.querySelector('[data-k=fontSize]').value='14'; document.querySelector('[data-k=fontSize]').dispatchEvent(new Event('change'))")
        await pg.clock.run_for(3000)
        q11 = qs[10]['id']
        await pg.fill(f'.card[data-id="{q11}"] textarea[data-f=text]', 'Evaluate (edited): \n$$\\int_0^2 (3x^2+1)\\,dx$$'); await pg.clock.run_for(3000)
        pages = await pg.evaluate(f"(async()=>{{await prepareMath(); return __exam.buildPDF().__pageOf['{q11}']}})()")
        vis = await pg.evaluate(f"(()=>{{const b=document.querySelector('#pv'); const c=b.querySelectorAll('canvas')[{pages}-1]; return c && c.offsetTop - 12 <= b.scrollTop + 5 && c.offsetTop + c.offsetHeight > b.scrollTop}})()")
        ok("F1 preview scrolls to the edited question's page", vis and pages>1, f"page {pages}")
        # G: PDFs
        n1 = await pdf(pg,'dry_normal.pdf'); n2 = await pdf(pg,'dry_large.pdf',True)
        ok("G1 normal & large-print PDFs build", n1>=3 and n2>n1, f"{n1} vs {n2} pages")
        # H: reload → start shows continue; state kept in browser
        await pg.reload(); await pg.clock.run_for(2000)
        vis_local = await pg.is_visible('#stContinueLocal')
        ok("H1 after reload: 'Continue where you left off'", vis_local)
        await pg.click('#stContinueLocal')
        n_after = await pg.evaluate("__exam.S().items.filter(x=>x.type=='q').length"); ok("H2 work restored after reload", n_after==13, n_after)
        # I: open old-format project with edge cases
        await pg.evaluate("window.__openName='edge.exam.json'; __files['edge.exam.json']=" + json.dumps(open(__import__('_bee').fx('edge.exam.json')).read()))
        await pg.click('#fileMenu summary'); await pg.click('#btnOpen')
        for _ in range(40):   # wait for the file to be read (instead of a fixed delay)
            await pg.clock.run_for(500)
            if await pg.evaluate("__exam.S().d.subject")=='Edge cases': break
        ok("I1 open older project file", await pg.evaluate("__exam.S().d.subject")=='Edge cases', [await pg.evaluate("__exam.S().d.subject"), await pg.text_content('#toast'), await pg.evaluate("[...document.querySelectorAll('.modal.open')].map(m=>m.id)")])
        n3 = await pdf(pg,'dry_edge.pdf')
        ok("I2 edge PDF (Letter, no logo, 8 parts, unicode, very long question)", n3>=5, f"{n3} pages")
        await pg.evaluate("__exam.S().items.push({id:'z1',type:'q',text:'x',marks:'1',width:'half'}); 0")
        n4 = await pdf(pg,'dry_edge2.pdf')
        ok("I3 a lone half-width question doesn't break layout", n4>=n3)
        # J: empty exam
        await pg.evaluate("__exam.set({d:{}, items:[]})"); n5 = await pdf(pg,'dry_empty.pdf')
        ok("J1 empty exam → cover only", n5==1)
        ok("Z no JS errors", not errs, errs[:5])
        await b.close()
    print(f"\n{sum(r[1] for r in R)}/{len(R)} checks passed")
asyncio.run(main())
