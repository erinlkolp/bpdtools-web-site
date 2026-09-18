"""Turn raw device captures into the site's phone-mockup images.

Source: art/screens/{log,history,trends}-{light,dark}.png, straight off the
device via scripts/capture-screens.sh at 1080x2424.

Two things happen here.

CROPPING THE SYSTEM BARS is a privacy measure, not a cosmetic one. The
capture script puts SystemUI into demo mode to blank the status bar, and
on this device's Android that silently DID NOT take -- the raw captures
still carry the notification icons of whatever apps happened to be
running (measured: a chat app, a doorbell app, YouTube). Demo mode failed
open, so the crop is what actually removes the leak, and assert_no_system_bars()
below fails the build if a future capture slips one back in. Do not
"simplify" this by trusting demo mode.

The bands are pure black (0,0,0) and sit at identical rows in both colour
schemes, measured at x=5 (a column with no icons in it): content runs
y=173..2328, with the status bar above and the gesture bar below. Fixed
constants rather than edge detection, because in dark mode the app's own
background (#201c1a) is only just lighter than the bar and a threshold
that separates them is a threshold that will drift.

DOWNSCALING: the .phone frame is 16rem = 256 CSS px at its largest, so
512px wide is 2x for HiDPI and no more. WebP rather than PNG -- there are
six of these, and check-build.mjs enforces a 200KB ceiling per PNG that
six full-size UI screenshots would blow through several times over.

Run:  python3 scripts/prepare-screenshots.py
"""
import os
from PIL import Image

SRC_DIR = "art/screens"
OUT_DIR = "public/screens"

# Measured at x=5 on both log-light.png and log-dark.png; identical in each.
CONTENT_TOP = 173      # first row below the status bar
CONTENT_BOTTOM = 2329  # first row of the gesture bar

DISPLAY_W = 512        # 2x the .phone frame's 256px CSS ceiling
QUALITY = 82

NAMES = [
    f"{screen}-{theme}"
    for screen in ("log", "history", "trends")
    for theme in ("light", "dark")
]


def prepare(name):
    src = Image.open(f"{SRC_DIR}/{name}.png").convert("RGB")
    w, h = src.size
    if (w, h) != (1080, 2424):
        raise SystemExit(
            f"{name}.png is {w}x{h}, expected 1080x2424. The crop constants "
            f"are measured for that geometry -- re-measure before capturing "
            f"on a different device."
        )

    content = src.crop((0, CONTENT_TOP, w, CONTENT_BOTTOM))
    assert_no_system_bars(content, name)

    display_h = round(content.height * DISPLAY_W / content.width)
    out = content.resize((DISPLAY_W, display_h), Image.LANCZOS)
    path = f"{OUT_DIR}/{name}.webp"
    out.save(path, "WEBP", quality=QUALITY, method=6)
    print(f"  {path} {out.size} {os.path.getsize(path)}B")
    return out.size


# --- System-bar regression guard ----------------------------------------
#
# The defect this catches shipped once already, in the raw captures: demo
# mode reported success and left the notification icons in place. A crop
# that is off by a few rows, or a capture from a device with different bar
# heights, would put them back -- and they are only obvious if you look at
# the image, which nobody does on a rebuild.
#
# A system bar is pure black edge to edge. App content is not: even the
# dark scheme's darkest surface is (32,28,26) and the light scheme's is
# near-white. So "is this edge row overwhelmingly pure black?" separates
# them with enormous margin in both schemes, and needs no per-theme
# threshold.
BLACK_MAX = 12          # a pixel this dark in every channel counts as bar-black
BLACK_ROW_PCT = 0.90    # a row this black, edge to edge, is a system bar


def assert_no_system_bars(img, name):
    """Fail if the first or last row of the crop still looks like a system bar."""
    w, h = img.size
    px = img.load()
    for label, y in (("top", 0), ("bottom", h - 1)):
        black = sum(1 for x in range(w) if max(px[x, y]) <= BLACK_MAX)
        pct = black / w
        if pct >= BLACK_ROW_PCT:
            raise AssertionError(
                f"system-bar check FAILED for {name}: the {label} row of the "
                f"cropped image is {pct:.0%} pure black, which is a status or "
                f"gesture bar, not app content. Those bars carry notification "
                f"icons that must not ship. Re-measure CONTENT_TOP/"
                f"CONTENT_BOTTOM against the new captures."
            )


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    sizes = set()
    for name in NAMES:
        sizes.add(prepare(name))
    if len(sizes) != 1:
        raise SystemExit(
            f"captures did not all crop to the same size ({sizes}); the "
            f"<picture> light/dark pair shares one width/height attribute, so "
            f"they must match."
        )
    print(f"all six at {sizes.pop()}")


if __name__ == "__main__":
    main()
