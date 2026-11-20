"""Shared bits for BEE's browser tests."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OFFLINE = os.path.join(ROOT, "docs", "download", "Exam_Builder_offline.html")
APP = "file://" + OFFLINE
FIX = os.path.join(HERE, "fixtures")
OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)

def chrome():
    """Use the installed Chrome when there is one (or BEE_CHROME), otherwise Playwright's own Chromium."""
    path = os.environ.get("BEE_CHROME") or ("/usr/bin/google-chrome" if os.path.exists("/usr/bin/google-chrome") else None)
    return {"executable_path": path} if path else {}

def fx(name):
    """A sample file that lives next to the tests."""
    return os.path.join(HERE, name)
