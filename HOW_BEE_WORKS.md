# 🐝 How BEE works

A guide for whoever maintains BEE next: what each part does, where to find it, and how to release a change safely.
For what BEE does as a product, see [README.md](README.md).

---

## 1. The big picture

BEE is a **web page that runs entirely in the browser**. There is no server and no database, and nothing is uploaded:
exams, student names and photos stay on the teacher's computer.

```
 typed text ─┐
 pasted AI ──┼─► parser ─► S (the exam in memory) ─► editor cards (HTML)
 .txt / .md ─┤                      │
 photos (OCR)┘                      ├─► buildPDF() ─► preview (pdf.js) / download (jsPDF)
                                    └─► autosave ─► .exam.json file + browser storage
```

* **One source, in sections:** `app/src/` holds the HTML, CSS and JavaScript, split into numbered files by topic. `app/src/ORDER.txt` lists them in order; the build joins them into one page.
* **One build step:** `build/build.py` turns it into the two things people use:
  * `docs/` is the installable web app (PWA) served by GitHub Pages at https://jishnu-suresh.github.io/ExamBuilder/
  * `docs/download/Exam_Builder_offline.html` is a single file with everything inside, which works with no internet.

## 2. Folders

| Path | What it is |
|---|---|
| `app/src/` | **The application.** Edit these files, never the files in `docs/`. |
| `app/src/ORDER.txt` | The order in which the build joins the files. A new file must be listed here. |
| `build/build.py` | Builds `docs/` and the offline file, makes the icons and copies the demo files. |
| `build/fetch_vendor.sh` | Downloads the pinned libraries into `.vendor/` (run once, needs npm). |
| `build/sw.template.js` | The service worker template (offline cache and update logic). |
| `docs/` | **Generated.** The live site. Committed, because GitHub Pages serves it. |
| `docs/vendor/` | Libraries copied by the build (jsPDF, MathJax, MathLive, pdf.js, Tesseract, SortableJS, smiles-drawer, fonts). |
| `demo/` | Demo exams and AI answers, copied into `docs/demo/`. |
| `tests/` | Browser tests (Playwright) and sample inputs. `tests/run_all.py` runs them all. See `tests/README.md`. |
| `.github/workflows/tests.yml` | Runs the tests on every push, and checks that `docs/` was rebuilt from `app/src/`. |

## 3. Libraries (all run locally)

| Library | Used for |
|---|---|
| **jsPDF** | Writing the PDF. |
| **MathJax 3** (tex-svg-full) | LaTeX and `\ce{}` chemistry: TeX → SVG → PNG, which is then placed in the PDF. |
| **MathLive** | The visual equation editor. |
| **pdf.js** | Shows the PDF preview, and the 📄 *Cut from PDF* viewer. |
| **Tesseract.js 7** | Offline text reading from photos (loaded lazily). |
| **SortableJS** | Drag-and-drop in *Arrange*. |
| **smiles-drawer** | Molecule drawings from SMILES codes. |
| **DejaVu fonts** (subset, `fonts.js`) | Characters the standard PDF fonts can't print (✓, Greek, arrows…). |

## 4. The exam in memory: `S`

```js
S = {
  d: { title, subtitle, subject, className, teacher, date, duration, instructions,
       accent, style ("" | "colour"), palette, lang ("" | "fr"), paper, fontSize,
       showMarks, justify, restartNumbering, sectionNewPage, answerMode ("" | "sheet"),
       rubricOn, rubric: { title, groups: [{ heading, items: [{ name, desc, pts }] }], showTotal, showGrade, … },
       … },
  logo: { src, w, h } | { isDefault: true },
  items: [ …see below… ]
}
```

**Item types**

| `type` | Extra flags | Meaning |
|---|---|---|
| `"section"` | `newPage`, `twoCol` | A part heading ("Part A: …"). |
| `"note"` | — | A text block or reading passage. |
| `"note"` | `heading: true` | A sub-part heading ("A. Definitions (18 points)"). |
| `"note"` | `pagebreak: true` | A page break. |
| `"q"` | see below | A question. |

**Question fields:** `text`, `marks`, `lines` (answer-space size), `space` (`lines` / `blank` / `grid` / `box` / `numberline` / `axes`),
`range` (for number lines and grids), `mcq` (`"single"` / `"multi"`), `options[]`, `correct[]`, `optCols`, `width` (`"half"`),
`subs[]` (sub-questions with their own `text` / `marks` / `lines` / `space` / `answer`), `answer` (model answer), `img` (picture beside the text),
`pics{ id: {src, w, h, graph?, svg?} }` (pictures placed *inside* the text with `{img: id | 60% | center}`),
`graph`, `fmt` (whole-question styles: `b i u x c align size`), `nonum`, `hideMarks`, `newPage`, `lineNums`.

A saved project (`.exam.json`) is just `{ app, version, savedAt, d, logo, items }`. See `snapshot()`.

## 5. Text format (what teachers and the AI type)

Questions are plain text with small tags. The same format is used when typing, pasting AI answers and opening `.txt` / `.md` files.

| Tag | Meaning |
|---|---|
| `1. Question … [3]` | A numbered question worth 3 marks. |
| `{lines: 5}` `{grid: 8}` `{box: 6}` `{numberline: -5..5}` `{axes: -6..6}` | Answer spaces. |
| `{mcq}` / `{mcq: multi}` + `a) …` lines, `{cols: 2}` | Multiple choice. `{correct}` marks the right option (answer key). |
| `(a) … [2]` | A sub-question. |
| `Model answer: …` | Teacher-copy answer. |
| `{half}` `{nonum}` `{nomarks}` | Two per row, no number, hide marks. |
| `Part A: … [20]`, `Sub-part: A. …`, `{newpage}` | Structure. |
| `$…$`, `$$…$$`, `\ce{…}` | Maths and chemistry. |
| `**b**` `*i*` `++u++` `~~s~~` `{color:#hex}…{/color}` | Text styles (`scanInline` / `parseInline`). |
| `{center}` `{right}` `{left}` `{justify}` `{big}` `{bigger}` `{huge}` `{small}` | Line alignment and size (at the start of a line). |
| `{img: id \| 60% \| center}` | A picture placed inside the text. |
| `{mol: CCO \| caption}` | A molecule. |
| `{svg} … {/svg}` | A drawing made by the AI (turned into a picture on paste). |
| `[diagram: page 2 — …]` | A missing picture: a red box with 📄 *Cut from PDF*. |
| `Title:` `Subject:` … `Instructions:` `Rubric:` + table | Exam details and rubric (at the top of pasted text). |

## 6. Main code paths in `app/src/`

| File | What's in it |
|---|---|
| `00_head.html`, `10_styles.css`, `20_markup.html` | Page head, all styles, all HTML (panels, dialogs, the tour) |
| `30_state_and_saving.js` | `S`, browser storage, project files, autosave, 🕘 version history |
| `31_text_parsing.js` | Turning pasted text into items |
| `32_adding_content.js` | Adding questions, photos and pictures (incl. picture compression) |
| `40_editor_cards.js` | The question cards |
| `41_rich_text_and_pictures.js` | Pictures inside text, ✂ Cut from PDF |
| `50_pdf.js` | `buildPDF()` and the preview |
| `60_photo_reader.js` | Offline text reading (Tesseract) |
| `61_equations_and_graphs.js` | Equation editor, graphs, molecules |
| `62_ai_prompts.js` | The ready-made AI prompts |
| `63_formatting_and_rubric.js` | Format bar, ＋ Insert and ⋯ More menus, rubric page |
| `64_versions_find_arrange_label.js` | Versions A/B/C, find & replace, arrange view, labelled diagrams |
| `70_events_and_start.js` | Buttons, settings tabs, start screen, demo exam, welcome tour, PWA, start-up |
| `99_end.html` | Closing tags |


**Importing text:** `handleFiles()` / the *Paste* box →
`takeDrawings()` (SVG → pictures) → `extractExtras()` (details, rubric) → `parseText()` → `finishBlock()` (marks, tags, options, sub-questions).
Rule worth knowing: a multiple-choice question ends after its last option, so a following passage becomes its own text block.

**Editor:** `render()` draws one card per item. Typing goes through `onListInput()`, buttons through `onListClick()`.
`updateRich()` refreshes a card's preview. The format bar is handled by `fmtBar()`, `onFmt()` and `toggleFmtRange()`.
Every change calls `changed()`, which updates totals and undo history and schedules the preview and autosave.

**PDF:** `buildPDF(opt)`. Options: `key`, `version`, `large`, `final`, `coverOnly`, `rubricOnly`, `noCover`.
* `cover()` draws the cover page. It tries several sizes until everything fits on one page.
* The rubric page comes next.
* `qBlock(it, X, W)` lays out one item into **parts**, each with a height and a `draw(y)` function.
  * Parts have a group number `g` (question text, then (a), (b)… or option C, D…), so a long question can continue on the next page.
* Text layout uses `layoutRich()` (paragraphs, maths, tables, pictures, molecules) and `layoutPara()` (word wrapping, justification, styles).
* The main loop places parts on pages and keeps headings, and short lead-ins such as "Refer to the picture below.", with what follows. It records `regions`, which the preview uses so a click on it jumps to the right card.
* Before building, `prepareMath()` turns every formula and molecule into PNGs (cached).

**Preview:** `preview()` → `buildPDF()` → `showPreview()` (pdf.js canvases). `pvLocate()` and `jumpToItem()` handle clicks.

**Saving:**
* Chrome and Edge save to a real file through the File System Access API (`saveAs()`, `writeProject()`, `setHandle()`), with an autosave every minute.
* Safari and Firefox download the file instead (`downloadProject()`).
* The last state is also kept in browser storage (`saveLocal()` / `loadLocal()`).
* **🕘 Version history:** `keepVersion(reason)` stores a copy in IndexedDB (`versions` list plus `v:<id>`), at most 30 copies or 60 MB, skipping exact duplicates. It runs every 5 minutes while the exam changes, and before anything that replaces it (opening a file, new exam, paste, clear all, replace all, restore, demo).
* **Pictures are kept small:** `fitCanvas()` limits the size (photos 1600 px, PDF cuts 2000 px) and `encodeBest()` keeps PNG unless JPEG is far smaller.

**Start screen, demo and tour:** `openStart()`; `loadDemo()` opens `demo/demo_all_features.exam.json` (fetched by the website; built into the offline file through the `/*__DEMO__*/` placeholder) and never writes it into the teacher's project file. `startTour()` shows 4 steps (`TOUR`); it runs once, the first time the start screen closes (`localStorage` key `bee.toured`), and is skipped in automated browsers so tests aren't interrupted.

**AI prompts:** `USER_AI_PROMPT` (generic). `IXL_AI_PROMPT` is built from it plus `IXL_RULES`, so changing the generic prompt updates both.

**Offline / PWA:** `build/sw.template.js` caches the app (`CORE`) and the photo reader and fonts (`LAZY`).
A new version shows the "Fresh honey in the hive!" bar. The page only reloads after the teacher clicks *Update*.

## 7. Building, testing and releasing

```bash
build/fetch_vendor.sh            # once
python3 build/build.py           # after every change in app/src/
```

Run the tests before every push (see `tests/README.md`). They open the built app in Chrome with Playwright:

```bash
pip install playwright && python -m playwright install chromium   # once
python3 tests/run_all.py         # builds nothing; tests the docs/ you just built. Ends with "ALL PASSED"
```

GitHub runs the same tests on every push (`.github/workflows/tests.yml`), and fails if `docs/` doesn't match a fresh build of `app/src/`.

Releasing is a push to `main`. GitHub Pages republishes `docs/` within a few minutes, and installed apps then offer the update.
Commit both `app/src/` **and** the rebuilt `docs/`.

## 8. Lessons learned (please keep these in mind)

* **Edit `app/src/`, then rebuild.** Changes made directly in `docs/` are overwritten by the next build.
* **Page layout:** `html, body` use `overflow-x: clip`, not `hidden`. `hidden` breaks the sticky preview on desktop.
* **Top-level code runs before `$` exists** in some sections. Use `document.getElementById` in code that runs while the page loads.
* **Inside `buildPDF`, the translator is `PT()`**, because `T` is already used as a variable in `qBlock`.
* **jsPDF widths need kerning:** measure with `getStringUnitWidth(t, { kerning: {} })`, or long text drifts.
* **Emoji can't be printed** with PDF fonts, so `buildPDF` strips them.
* **Pictures for the PDF must be PNG or JPEG.** SVG (drawings, molecules, maths) is rasterised first, with a transparent background so no box shows.
* **Modals stack by DOM order.** Dialogs that open from other dialogs (save, PDF pop-up) get a higher `z-index`.
* **Never trust pasted text:** PDFs and Word files are stopped (`fileKind()`), binary "text" is refused, and SVG from the AI is cleaned (`cleanSvg()`) and drawn only as an image.
