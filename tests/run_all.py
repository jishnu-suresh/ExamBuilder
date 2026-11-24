"""Runs every BEE browser test. Exit code 1 if anything fails.
    python3 build/build.py && python3 tests/run_all.py
"""
import os, subprocess, sys, time, http.server, threading, functools, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
OUT = os.path.join(HERE, "out"); os.makedirs(OUT, exist_ok=True)
TESTS = ["dry.py", "t11.py", "tfeat.py", "tpwa.py", "trubric.py", "twrap.py", "tcover.py", "tsplit.py", "tlayout.py", "suite.py", "tstudent.py", "tvoice.py", "tkeys.py", "tpics.py"]

# tpwa.py tests the installable app, so serve docs/ on localhost:8765
class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=os.path.join(ROOT, "docs"))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8765), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

failed = []
for t in TESTS:
    t0 = time.time()
    p = subprocess.run([sys.executable, os.path.join(HERE, t)], cwd=OUT, capture_output=True, text=True, timeout=900)
    out = p.stdout + p.stderr
    bad = p.returncode != 0 or re.search(r"^FAIL|Traceback \(most recent call last\)", out, re.M)
    summary = ([l for l in out.splitlines() if re.search(r"\d+/\d+ (checks )?passed", l)] or ["done"])[-1].strip()
    print(f"{'✗' if bad else '✓'} {t:12s} {summary}  ({time.time() - t0:.0f}s)", flush=True)
    if bad:
        failed.append(t)
        print("\n".join("    " + l for l in out.splitlines() if l.startswith("FAIL") or "Error" in l or "Exception" in l)[:3000])
srv.shutdown()
print("\nALL PASSED" if not failed else "\nFAILED: " + ", ".join(failed))
sys.exit(1 if failed else 0)
