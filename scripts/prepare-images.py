"""One-time preparation of the bpdtools logo assets.

The supplied PNG is fully opaque with a white background and a baked-in
tagline that the site deliberately does not reproduce. This crops the
tagline off at the blank band found at y=489..495, keys the white to
transparent with a feathered edge so the mark does not fringe on dark
backgrounds, and derives a favicon and an OG card.

Run:  python3 scripts/prepare-images.py
"""
from PIL import Image

SRC = "public/logo-original.png"
CROP_H = 492          # blank band at y=489..495 separates wordmark from tagline
LIGHT_BG = (251, 247, 244)   # --background, for the OG card

def key_white(img, lo=228, hi=250):
    """Make near-white transparent, feathering between lo and hi.

    Fully transparent at or above hi, fully opaque at or below lo, linear
    in between. Feathering matters: a hard threshold leaves a white fringe
    on anti-aliased glyph edges, which is glaring in dark mode.
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

    logo = key_white(src.crop((0, 0, w, CROP_H)))
    logo.save("public/logo.png", optimize=True)
    print(f"public/logo.png {logo.size}")

    # Favicon: the mark alone. The wordmark is illegible at 32px, and the
    # mark occupies roughly the middle 40% of the width above the wordmark.
    mark = logo.crop((int(w * 0.30), 0, int(w * 0.70), 334))
    side = max(mark.size)
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2), mark)
    square.resize((180, 180), Image.LANCZOS).save("public/favicon.png", optimize=True)
    print("public/favicon.png (180x180)")

    # OG card: the logo centred on the light background token.
    card = Image.new("RGBA", (1200, 630), LIGHT_BG + (255,))
    scaled = logo.copy()
    scaled.thumbnail((900, 460), Image.LANCZOS)
    card.paste(scaled, ((1200 - scaled.width) // 2, (630 - scaled.height) // 2), scaled)
    card.convert("RGB").save("public/og-card.png", optimize=True)
    print("public/og-card.png (1200x630)")

if __name__ == "__main__":
    main()
