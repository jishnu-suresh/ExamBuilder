# Tests
Browser tests (Playwright + Chrome). Run from this folder after `python3 build/build.py`:

    pip install playwright && playwright install chromium
    python3 dry.py      # 28 checks: start screen, auto-save, AI paste, MCQ editor, parts, preview, large print, edge cases
    python3 t11.py      # 19 checks: formatting toggles, undo/redo, separate answer sheet
    python3 tfeat.py    # 24 checks: sub-questions, answer spaces, answer key, versions, find & replace
    (cd ../docs && python3 -m http.server 8765) & python3 tpwa.py   # 12 checks: installable app, offline, OCR
