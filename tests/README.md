# Tests

Browser tests that open the built BEE in Chrome (Playwright) and check it really works.
They also run automatically on GitHub after every push (`.github/workflows/tests.yml`).

```bash
pip install playwright && python -m playwright install chromium   # once
python3 build/build.py                                             # build first
python3 tests/run_all.py                                           # everything, ~3 minutes
```

`run_all.py` starts a small local server for the installable-app test, runs each file below, and ends with **ALL PASSED** or the list of failures.
The PDFs the tests make go into `tests/out/` (not committed).

| File | What it checks |
|---|---|
| `dry.py` | Start screen, auto-save to a file, AI paste, MCQ editor, parts, preview, large print, edge cases. |
| `t11.py` | Formatting toggles, undo/redo, separate answer sheet. |
| `tfeat.py` | Sub-questions, answer spaces, answer key, versions A/B/C, find & replace. |
| `tpwa.py` | The installable app: offline cache, update, photo reader. |
| `trubric.py`, `twrap.py`, `tcover.py` | Rubric page, text wrapping beside pictures, cover page fitting. |
| `tstudent.py` | 💻 The computer version: making the file, the questions locked by the start code, answering (MCQ, accents, maths keyboard, drawing), the lock and teacher code, adding time, no paste, carrying on after a crash and from a USB backup, End the test, the sealed answers, the PDF with automatic MCQ marks, a class ZIP, the teacher key on another computer, the offline BEE, small screens. |
| `suite.py` | One check per later feature or bug fix: phones, sticky preview, AI paste with details and rubric, strikethrough, PDF guard, ✂ cut from PDF, AI drawings, passages after MCQs, sub-question and MCQ page breaks, page-break items, click-to-jump, Insert menu, Save as, prompts, French and colourful styles, molecules. |

`_bee.py` holds the shared bits: where the app is and which browser to use (set `BEE_CHROME` to choose one).
`fixtures/` and the files next to the tests are made-up samples, not real student or teacher material.

**When you fix a bug, add a check to `suite.py`** so it can never come back unnoticed.
