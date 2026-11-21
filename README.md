# 🐝 BEE — Build • Edit • Evaluate

Make clean, formatted exam papers (PDF) from typed questions, pasted AI output, photos, maths, science and graphs.
Everything runs on the teacher's own computer — exams and student details never leave it.

**Open / install:** https://jishnu-suresh.github.io/ExamBuilder/

## Install it as an app (Windows, Mac, Ubuntu)
1. Open the link above in **Chrome** or **Edge**.
2. Click **⤓ Install app** in the top bar (or the install icon at the right of the address bar).
3. BEE now has its own window and icon (Start menu / Dock / app grid) and works **offline**.
4. Updates arrive automatically — when a new version is ready, a bar says *“A new version is ready — Update now”*.

Safari (Mac): *File → Add to Dock* also works, but Safari can't auto-save to a project file — use Chrome/Edge for that.
No internet / no install? Download the single-file version: [`docs/download/Exam_Builder_offline.html`](docs/download/Exam_Builder_offline.html) — double-click it to run.

## Try it with the demo files
- [`demo_all_features.exam.json`](docs/demo/demo_all_features.exam.json) — **every feature in one exam** (cover, rubric page, sub-questions, answer key, all answer spaces…): click **🐝 Try the demo exam** on the start screen, or open it with **📂 Open**
- [`demo.exam.json`](docs/demo/demo.exam.json) — a shorter sample exam
- [`demo_AI_answer.txt`](docs/demo/demo_AI_answer.txt) — copy its text into **🤖 Paste from AI**
- [`demo_worksheet_photo.jpg`](docs/demo/demo_worksheet_photo.jpg) — choose *Read the text (offline)*, then **📷 Add photos**

## Features
- Cover page with logo, subtitle, student box, instructions, points per part (or cover only download)
- Questions from: **Paste from AI** (ready-made prompt), photos (offline text reader), .txt/.md files, typing
- Maths/physics/chemistry/biology: LaTeX `$…$`, visual equation editor, `\ce{}` chemistry, graphs, labelled diagrams, tables
- MCQ (A–D options, one or multiple answers, 1/2/4 columns), half-width questions, parts with totals
- Sub-questions (a), (b), (c) with their own marks; answer space as lines, blank space, grid or box; start a question on a new page; line numbers for passages
- **Answer key** (teacher copy): ✓ correct MCQ options and model answers in red
- **Versions A, B, C…** at download time: shuffled questions and MCQ options, each with its own answer key
- Bold / italic / underline / colour, find & replace, undo/redo, arrange view (drag & drop)
- Compact editor: the formatting bar shows on the question you are typing in; Exam details and the rubric fold to one line; drag the preview's edge to resize it, or ⇥ hide it while typing
- **⬇ Download menu** in three groups — 📄 Paper, 🌻 Accommodations, 👩‍🏫 Teacher — with short, tidy file names (`Subject_Title_Class.pdf`)
- 🌻 Accommodations: large print (16 pt, double spacing); **easy-to-read PDF** (Atkinson Hyperlegible or OpenDyslexic font, optional cream paper); separate-answer-sheet mode (compact paper)
- **Save light** in the top bar: 🟢 saved, 🟠 saving, 🔴 not saved yet — plus a warning before closing with unsaved changes
- Auto-saves to a project file every minute (Chrome/Edge); double-click `.exam.json` files to open them in the app
- **🕰️ Version history:** earlier copies of the exam kept in the browser, one click to restore or download
- **🌱 Basic / 🐝 Full mode** (button in the top bar): Basic shows only the everyday buttons; settings made in Full mode still apply
- A 1-minute welcome tour for first-time users

## For developers
**Start with [HOW_BEE_WORKS.md](HOW_BEE_WORKS.md)** — how BEE is built, where everything lives, and how to release safely.

```
build/fetch_vendor.sh      # once: downloads pinned libraries into .vendor/ (needs Node/npm)
python3 build/build.py     # builds docs/ (the web app) and docs/download/Exam_Builder_offline.html
```
- `app/src/` — the application (HTML/CSS/JS), split into sections; `ORDER.txt` sets the order
- `app/student/` — 🧪 work in progress, not launched yet (see HOW_BEE_WORKS.md)
- `build/` — build script, service-worker template, vendor fetcher
- `docs/` — generated site served by GitHub Pages (Settings → Pages → Branch `main`, folder `/docs`)
- `tests/` — browser tests: `python3 tests/run_all.py` (also run by GitHub on every push, in Chrome; `tests/tbrowsers.py` repeats the main steps in Firefox and Safari/WebKit)

Libraries: jsPDF, MathJax, MathLive, pdf.js, Tesseract.js, SortableJS, DejaVu fonts (subset).

© 2026 Jishnu Suresh. All rights reserved — see [LICENSE](LICENSE). The app is free to use; the code may not be copied, reused or redistributed without permission.
