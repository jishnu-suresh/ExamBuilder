"""🎬 Records the short looping clips of the illustrated teacher guide (app/guide/media/*.mp4 + a .jpg poster).
Each clip is the real BEE, driven by Playwright, with a visible pointer and click ripples.
Run:  python3 build/guide_clips.py [name …]      (needs docs/ served on 127.0.0.1:8765; ffmpeg)
"""
import asyncio, os, shutil, subprocess, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA = os.path.join(ROOT, "app", "guide", "media")
WEB = "http://127.0.0.1:8765/"
W, H = 1280, 800

# a pointer you can see in the recording, a ripple on each click, and a label for keys pressed
CURSOR = r"""
(() => {
  const add = () => {
    if (document.getElementById("__cur") || !document.body) return;
    const st = document.createElement("style");
    st.textContent = `#__cur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483647;pointer-events:none;transform:translate(-3px,-2px);transition:none}
      .__rip{position:fixed;z-index:2147483646;pointer-events:none;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;
        background:rgba(232,168,40,.45);border:2px solid rgba(181,137,46,.9);animation:__rip .55s ease-out forwards}
      @keyframes __rip{to{transform:scale(3.4);opacity:0}}
      #__key{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;pointer-events:none;background:rgba(36,33,28,.86);color:#fff;
        font:600 17px system-ui,sans-serif;padding:7px 14px;border-radius:9px;opacity:0;transition:opacity .2s}
      #__key.on{opacity:1}`;
    document.head.appendChild(st);
    const c = document.createElement("div"); c.id = "__cur";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M3 2 L3 21 L8.2 16.4 L11.6 24 L15 22.5 L11.7 15.2 L18.5 15 Z" fill="#fff" stroke="#24211C" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(c);
    const k = document.createElement("div"); k.id = "__key"; document.body.appendChild(k);
    const pos = JSON.parse(sessionStorage.getItem("__curpos") || "[640,400]"); c.style.left = pos[0] + "px"; c.style.top = pos[1] + "px";
    addEventListener("mousemove", e => { c.style.left = e.clientX + "px"; c.style.top = e.clientY + "px"; sessionStorage.setItem("__curpos", JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener("mousedown", e => { const r = document.createElement("div"); r.className = "__rip"; r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px"; document.body.appendChild(r); setTimeout(() => r.remove(), 650); }, true);
    window.__showKey = (t, ms) => { k.textContent = t; k.classList.add("on"); clearTimeout(k.__t); k.__t = setTimeout(() => k.classList.remove("on"), ms || 1100); };
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
  const watch = () => new MutationObserver(add).observe(document.documentElement, { childList: true });
  if (document.documentElement) watch(); else document.addEventListener("DOMContentLoaded", watch);
})();
"""


class Clip:
    """One recording. `await c.go()` marks where the clip starts; everything before it is set-up and is cut off."""
    def __init__(self, browser, name, crop=None, viewport=(W, H), url=None, touch=False):
        self.b, self.name, self.crop, self.vp, self.url, self.touch = browser, name, crop, viewport, url, touch
        self.t0 = None

    async def __aenter__(self):
        self.tmp = tempfile.mkdtemp()
        self.ctx = await self.b.new_context(viewport={"width": self.vp[0], "height": self.vp[1]}, record_video_dir=self.tmp,
                                            record_video_size={"width": self.vp[0], "height": self.vp[1]}, accept_downloads=True, has_touch=self.touch)
        await self.ctx.add_init_script(CURSOR)
        self.pg = await self.ctx.new_page(); self.born = time.monotonic()
        self.errs = []; self.pg.on("pageerror", lambda e: self.errs.append(str(e)))
        return self

    async def go(self, hold=0.5):
        await self.pg.wait_for_timeout(int(hold * 1000)); self.t0 = time.monotonic() - self.born - 0.25

    # ---- human-like actions
    async def center(self, sel):
        loc = self.pg.locator(sel).first
        await loc.scroll_into_view_if_needed()
        bb = await loc.bounding_box()
        return bb["x"] + bb["width"] / 2, bb["y"] + bb["height"] / 2

    async def move(self, sel, steps=22, dx=0, dy=0):
        x, y = await self.center(sel); await self.pg.mouse.move(x + dx, y + dy, steps=steps); await self.pg.wait_for_timeout(180)
        return x + dx, y + dy

    async def moveto(self, x, y, steps=22):
        await self.pg.mouse.move(x, y, steps=steps); await self.pg.wait_for_timeout(150)

    async def click(self, sel, wait=650, steps=22, dx=0, dy=0):
        x, y = await self.move(sel, steps, dx, dy)
        await self.pg.mouse.down(); await self.pg.wait_for_timeout(70); await self.pg.mouse.up()
        await self.pg.wait_for_timeout(wait)

    async def type(self, text, delay=55, wait=400):
        await self.pg.keyboard.type(text, delay=delay); await self.pg.wait_for_timeout(wait)

    async def key(self, k, label=None, wait=500):
        if label: await self.pg.evaluate(f"window.__showKey && __showKey({label!r})")
        await self.pg.keyboard.press(k); await self.pg.wait_for_timeout(wait)

    async def say(self, text, ms=1600):
        """a short caption bubble at the bottom of the clip"""
        await self.pg.evaluate(f"window.__showKey && __showKey({text!r}, {ms})")

    async def wait(self, s): await self.pg.wait_for_timeout(int(s * 1000))

    async def __aexit__(self, *a):
        await self.pg.wait_for_timeout(1300)                 # the loop rests on the result
        end = time.monotonic() - self.born
        vid = await self.pg.video.path()
        await self.ctx.close()
        t0 = max(0, self.t0 if self.t0 is not None else 0)
        os.makedirs(MEDIA, exist_ok=True)
        out = os.path.join(MEDIA, self.name + ".mp4"); poster = os.path.join(MEDIA, self.name + ".jpg")
        vf = []
        if self.crop: x, y, w, h = self.crop; vf.append(f"crop={w}:{h}:{x}:{y}")
        vf.append("scale='min(1280,iw)':-2:flags=lanczos")
        vf.append("fps=25")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", f"{t0:.2f}", "-t", f"{end - t0:.2f}", "-i", vid, "-vf", ",".join(vf),
                        "-c:v", "libx264", "-preset", "veryfast", "-crf", "27", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out], check=True)
        # poster: the last frame (the result), shown before the clip plays and when printing
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-sseof", "-0.3", "-i", out, "-frames:v", "1", "-q:v", "7", poster], check=True)
        shutil.rmtree(self.tmp, ignore_errors=True)
        print(f"🎬 {self.name}: {end - t0:.1f}s, {os.path.getsize(out) // 1024} KB" + (f"  ⚠ page errors: {self.errs[:2]}" if self.errs else ""), flush=True)


async def shot(pg, name, clip=None, full=False):
    """a still picture for the guide"""
    os.makedirs(MEDIA, exist_ok=True)
    p = os.path.join(MEDIA, name + ".png")
    await pg.screenshot(path=p, clip=clip, full_page=full)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", p, "-q:v", "5", os.path.join(MEDIA, name + ".jpg")], check=True); os.remove(p)
    print("📸", name, flush=True)
