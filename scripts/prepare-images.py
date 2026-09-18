"""One-time preparation of the bpdtools logo assets.

The supplied PNG is fully opaque with a white background and a baked-in
tagline that the site deliberately does not reproduce. This crops the
tagline off at the blank band found at y=489..495, keys the white to
transparent with a feathered edge so the mark does not fringe on dark
backgrounds, and derives a favicon and an OG card.

Keying window: fix round 1 tightened key_white's lo/hi from 228/250 to
190/210. At 228/250 the canvas white was removed but the artwork's own
pale rounded-rectangle panel behind the head (its true min-channel sits
~205..225, overlapping that window's low end) survived as an opaque
near-white shape -- invisible on the light page background but a loud
blotch on the dark-mode token (measured: 18.92% of the logo's opaque
pixels compose to a near-white min-channel >200 over dark, i.e. the
panel, not edge anti-aliasing). The real content (heart, brain, cloud,
wordmark) sits at min-channel ~55..190, comfortably below 190, so tight-
ening the window to 190/210 drops the panel to ~0% measured residual
(full-pixel scan, not sampled) on both logo.png and favicon.png, with no
visible loss to the artwork itself. See task-3-report.md ("Fix round 1")
for the verification script that gates this and the threshold it derives
from these measured numbers.

The on-page hero only ever renders the logo at up to 320 CSS px (see
`width: min(20rem, 80%)` in the hero rule), so public/logo.png is saved
at DISPLAY_W (~700px, i.e. ~2x that ceiling for HiDPI) rather than the
source's native 1024px -- full pixel-for-pixel keying still happens at
native resolution first, only the final saved logo.png is downsized, to
avoid baking resize error into the alpha feathering. Palette quantization
was evaluated for logo.png and og-card.png to shrink them further, but
produces visible banding in the heart's gradient at 256 colors on this
artwork, so it was rejected in favour of a plain (but resized) RGBA save.

Run:  python3 scripts/prepare-images.py
"""
from PIL import Image

SRC = "art/logo-original.png"
CROP_H = 492          # blank band at y=489..495 separates wordmark from tagline
LIGHT_BG = (251, 247, 244)   # --background, for the OG card
DISPLAY_W = 680        # ~2x the hero's 320px CSS ceiling; keeps logo.png well under 120KB

def key_white(img, lo=190, hi=210):
    """Make near-white transparent, feathering between lo and hi.

    Fully transparent at or above hi, fully opaque at or below lo, linear
    in between. Feathering matters: a hard threshold leaves a white fringe
    on anti-aliased glyph edges, which is glaring in dark mode.

    lo/hi were tightened from 228/250 (see module docstring): that wider
    window left the artwork's own pale panel behind the head opaque and
    near-white. 190/210 keys the panel out while staying well clear of
    the real artwork's darkest min-channel values (~55..190).
    """
    img = img.convert("RGBA")
    px = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            m = min(r, g, b)
            if m >= hi:
                px[x, y] = (r, g, b, 0)
            elif m > lo:
                frac = (m - lo) / (hi - lo)
                px[x, y] = (r, g, b, int(a * (1.0 - frac)))
    return img

def main():
    src = Image.open(SRC).convert("RGBA")
    w, _ = src.size

    # Keyed at native resolution -- favicon and OG card are both derived
    # from this full-size version so their crops/fractions stay accurate.
    logo = key_white(src.crop((0, 0, w, CROP_H)))

    # public/logo.png: the display copy, downsized for the hero image.
    # Premultiplied (RGBa) resize avoids reintroducing a white fringe at
    # the alpha edges, which a naive unpremultiplied resize risks.
    display_h = round(logo.height * DISPLAY_W / logo.width)
    logo_display = logo.convert("RGBa").resize((DISPLAY_W, display_h), Image.LANCZOS).convert("RGBA")
    logo_display.save("public/logo.png", optimize=True)
    print(f"public/logo.png {logo_display.size}")

    # Favicon: the mark alone. The wordmark is illegible at 32px, and the
    # mark occupies roughly the middle 40% of the width above the wordmark.
    mark = logo.crop((int(w * 0.30), 0, int(w * 0.70), 334))
    side = max(mark.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark)
    square.resize((180, 180), Image.LANCZOS).save("public/favicon.png", optimize=True)
    print("public/favicon.png (180x180)")

    # Header wordmark: the "bpdtools" lettering alone, without the mark above
    # it. The full logo is 2.08:1, so at a header-bar height of ~24px it is
    # only ~50px wide and illegible. The all-white band at y=334..357 separates
    # the illustration from the lettering, so cropping there severs no glyph.
    wordmark = logo.crop((0, 340, w, CROP_H))
    wm = wordmark.copy()
    wm.thumbnail((520, 200), Image.LANCZOS)
    wm.save("public/wordmark.png", optimize=True)
    print(f"public/wordmark.png {wm.size}")

    # OG card: the logo centred on the light background token. Kept at
    # native pre-resize resolution before the thumbnail fit -- 1200x630
    # is a fixed convention for social-preview cards, not a hero-image
    # budget, so it is not downsized further.
    card = Image.new("RGBA", (1200, 630), LIGHT_BG + (255,))
    scaled = logo.copy()
    scaled.thumbnail((900, 460), Image.LANCZOS)
    card.paste(scaled, ((1200 - scaled.width) // 2, (630 - scaled.height) // 2), scaled)
    card.convert("RGB").save("public/og-card.png", optimize=True)
    print("public/og-card.png (1200x630)")

    assert_no_pale_pixels("public/logo.png")
    assert_no_pale_pixels("public/favicon.png")

# --- Pale-on-dark regression guard --------------------------------------
#
# This is a post-generation assertion, not a one-off report script: it runs
# every time prepare-images.py runs, so a future threshold change (or a
# re-supplied source artwork) cannot silently reintroduce the round-1
# defect. Deliberately NOT wired into `npm run verify` -- CI is Node-only
# and never regenerates images, so a Python/Pillow dependency there would
# buy nothing; this is the moment the risk actually exists.
DARK_BG = (0x19, 0x16, 0x14)  # --background, dark scheme (#191614)

# Threshold rationale: the round-1 defect (lo/hi = 228/250) left the
# artwork's own pale panel opaque, measuring 18.92% (logo.png) / 20.22%
# (favicon.png) of visible pixels as pale-on-dark. The corrected thresholds
# (lo/hi = 190/210) measure ~0% -- the true anti-aliasing floor (0.0028% /
# 0.0000%, i.e. at most a handful of edge pixels). 1.0% sits two orders of
# magnitude above the measured-clean floor and almost 19x below the
# measured defect, so it has wide margin on both sides while still catching
# a real regression rather than noise from resizing/re-encoding.
PALE_THRESHOLD_PCT = 1.0

def assert_no_pale_pixels(path, threshold=PALE_THRESHOLD_PCT):
    """Composite every visible pixel of `path` over the dark-mode background
    token and fail if too many are pale -- the signature of a light
    panel/blotch showing through in dark mode (the defect F2/task-3 caught).

    What makes this discriminate, and must not be weakened:
    - composite over #191614 BEFORE thresholding (checking raw/unkeyed
      pixel values misses it entirely -- the panel is only pale relative to
      a dark backdrop, not in isolation);
    - scan every pixel, no striding/sampling (the panel is a contiguous
      region; sampling can step over or through it by luck);
    - count a pixel as "visible" at any alpha > 8, not just alpha == 255
      (the feathered keying leaves partially transparent pale pixels that
      still read as a blotch once composited);
    - flag "pale" as composited min-channel > 200 (matches the artwork's
      real content, which sits at min-channel ~55..190, comfortably below).
    """
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()
    visible = 0
    pale = 0
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a <= 8:
                continue
            visible += 1
            af = a / 255.0
            cr = r * af + DARK_BG[0] * (1 - af)
            cg = g * af + DARK_BG[1] * (1 - af)
            cb = b * af + DARK_BG[2] * (1 - af)
            if min(cr, cg, cb) > 200:
                pale += 1
    pct = (pale / visible * 100) if visible else 0.0
    if pct > threshold:
        raise AssertionError(
            f"pale-on-dark check FAILED for {path}: {pct:.2f}% of visible "
            f"pixels are pale when composited over #191614 ({pale}/{visible} "
            f"pixels, min channel > 200), exceeding the {threshold}% "
            f"threshold. This is the round-1 defect signature (measured "
            f"18.92%/20.22% then); check key_white()'s lo/hi thresholds."
        )
    print(f"  pale-on-dark {path}: {pct:.4f}% ({pale}/{visible} visible px) -- OK")

if __name__ == "__main__":
    main()
