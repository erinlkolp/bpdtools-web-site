# bpdtools.cloud Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a single-page informational site at `bpdtools.cloud` explaining what the bpdtools Android app is, what it does, and what it does with your data.

**Architecture:** An Astro static site emitting zero client JavaScript, built and published to GitHub Pages by a two-job GitHub Actions workflow. The page is composed of section partials plus one reusable `PhoneMockup` component rendered three times. Correctness is enforced by two Node scripts — a WCAG contrast checker over the CSS tokens and a build-output checker over `dist/` — both runnable as npm scripts and both run in CI.

**Tech Stack:** Astro 7.3.2, Node 24.14.1, npm 11.11.0, plain CSS with custom properties, Python 3 + Pillow 10.2.0 for one-time image preparation. No CSS framework, no webfonts, no client-side JS, no test framework beyond the two purpose-built checker scripts.

**Spec:** `docs/superpowers/specs/2026-09-15-bpdtools-web-site-design.md`

## Global Constraints

These apply to every task. Copied verbatim from the spec.

- **The site never calls bpdtools open source.** Both app repos are private with no LICENSE. No source links, no licence claim, no "open source" string anywhere in the output.
- **No download or install button.** The app is not publicly distributed. The hero states this in one line instead.
- **No crisis-resources banner, helpline, or hotline number.** The app gives no advice; a crisis banner is advice.
- **No contact details.** The footer carries the copyright line and nothing else.
- **The phrase "not treatment" framing stays sharp:** no advice, no diagnosis, no suggestions.
- **Zero client JavaScript.** `dist/index.html` must contain no `<script>` tag.
- **Contrast floors, from the app's `ColorContrastTest`:** body text 4.5:1, large text and non-text graphics 3:1.
- **Secondary (`#A6674F` light / `#D9A088` dark) is an accent colour only** — rules, icons, large headings. Never body copy. Held to the 3:1 floor.
- **Palette values are copied verbatim** from `bpdtools-android-app/app/src/main/java/com/bpdtools/app/ui/theme/Color.kt`. Do not invent or adjust a colour.
- **Phone mockups are decorative:** `aria-hidden="true"`, with the same information in adjacent prose. The page must be fully comprehensible with mockups suppressed.
- **System font stack only.** No webfont, no third-party request.
- **Mobile-first.** Must be correct at 400px wide.
- `api.bpdtools.cloud` is untouched. Nothing in this plan changes the API.

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | deps + `build`, `dev`, `check:contrast`, `check:build`, `verify` scripts |
| `astro.config.mjs` | `site: 'https://bpdtools.cloud'`, static output |
| `public/CNAME` | the custom domain, so Pages keeps it across deploys |
| `public/logo.png` | cropped + keyed wordmark |
| `public/logo-original.png` | the supplied file, untouched |
| `public/favicon.png` | the mark alone |
| `public/og-card.png` | 1200x630 link preview |
| `src/styles/global.css` | palette tokens, type scale, layout primitives |
| `src/layouts/Base.astro` | html shell, meta, OG tags, skip link |
| `src/components/PhoneMockup.astro` | phone frame + slot + text equivalent |
| `src/components/ScreenLog.astro` | Log screen mockup content |
| `src/components/ScreenHistory.astro` | History screen mockup content |
| `src/components/ScreenTrends.astro` | Trends screen mockup content |
| `src/pages/index.astro` | the page: hero, what it does, privacy, what it isn't, footer |
| `scripts/prepare-images.py` | one-time crop/key/derive from the original PNG |
| `scripts/check-contrast.mjs` | parses tokens from global.css, asserts WCAG floors |
| `scripts/check-build.mjs` | asserts facts about `dist/` output |
| `.github/workflows/deploy.yml` | build job + deploy job |
| `README.md` | DNS state, deploy, how to swap in real screenshots |

---

### Task 1: Astro scaffold that builds

**Files:**
- Create: `package.json`, `astro.config.mjs`, `src/pages/index.astro`, `public/CNAME`
- Test: `scripts/check-build.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces: a working `npm run build` emitting `dist/`; `npm run check:build` runs `scripts/check-build.mjs`.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-build.mjs`. It asserts facts about the built output and exits non-zero with a readable report on any failure.

```js
import { readFileSync, existsSync } from 'node:fs';

const failures = [];
const check = (label, cond) => { if (!cond) failures.push(label); };

const DIST = 'dist';
const indexPath = `${DIST}/index.html`;

check('dist/index.html exists', existsSync(indexPath));
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf8');
  check('no <script> tag (zero client JS)', !/<script[\s>]/i.test(html));
  check('has a lang attribute', /<html[^>]+lang=/i.test(html));
  check('has a title', /<title>[^<]+<\/title>/i.test(html));
  check('has a meta description', /name="description"/i.test(html));
  check('does not claim open source', !/open[\s-]?source/i.test(html));
  check('no crisis hotline number', !/\b988\b|suicide|crisis line/i.test(html));
}

check('dist/CNAME exists', existsSync(`${DIST}/CNAME`));
if (existsSync(`${DIST}/CNAME`)) {
  check('CNAME is bpdtools.cloud',
    readFileSync(`${DIST}/CNAME`, 'utf8').trim() === 'bpdtools.cloud');
}

if (failures.length) {
  console.error('check-build FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('check-build passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check-build.mjs`
Expected: FAIL, listing `dist/index.html exists` and `dist/CNAME exists`.

- [ ] **Step 3: Scaffold Astro**

Run the scaffolder non-interactively, then remove what it adds that we do not want:

```bash
npm create astro@latest . -- --template minimal --no-install --no-git --skip-houston --yes
npm install
```

If the scaffolder refuses because the directory is non-empty, create the files by hand instead — `package.json`, `astro.config.mjs`, `src/pages/index.astro` — matching the versions below.

Set `package.json` scripts to exactly:

```json
{
  "name": "bpdtools-web-site",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check:build": "node scripts/check-build.mjs",
    "check:contrast": "node scripts/check-contrast.mjs",
    "verify": "npm run check:contrast && npm run build && npm run check:build"
  }
}
```

`astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://bpdtools.cloud',
  output: 'static',
  build: { format: 'file' },
});
```

Delete any `public/favicon.svg` the template created — the real favicon arrives in Task 3 and a stale one would mask its absence.

- [ ] **Step 4: Add the CNAME**

```bash
printf 'bpdtools.cloud\n' > public/CNAME
```

- [ ] **Step 5: Give index.astro a minimal real body**

`src/pages/index.astro` — placeholder content, replaced in Task 5, but it must satisfy the build checker now:

```astro
---
const title = 'bpdtools — a private app for logging emotions';
const description =
  'A private, offline Android app for logging emotions as they happen. A logging tool, not treatment.';
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
  </head>
  <body>
    <h1>bpdtools</h1>
    <p>{description}</p>
  </body>
</html>
```

- [ ] **Step 6: Run the build and the checker**

Run: `npm run build && npm run check:build`
Expected: build succeeds; `check-build passed`.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json astro.config.mjs src/pages/index.astro public/CNAME scripts/check-build.mjs
git commit -m "build: scaffold the Astro site with an output checker

The checker asserts the constraints that are easy to violate silently:
no client JavaScript, no open-source claim, no crisis hotline, and a
CNAME that survives the deploy."
```

---

### Task 2: Palette tokens, contrast-checked

**Files:**
- Create: `src/styles/global.css`
- Test: `scripts/check-contrast.mjs`

**Interfaces:**
- Consumes: nothing from Task 1 beyond the npm scripts.
- Produces: CSS custom properties consumed by every later task — `--background`, `--surface`, `--surface-variant`, `--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`, `--secondary`, `--on-surface`, `--on-surface-variant`, `--outline`, `--error`. Also `--measure`, `--gutter`, `--radius`.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-contrast.mjs`. It parses hex tokens out of `global.css` for both themes and asserts the floors. Secondary is asserted at the graphical floor only, per the spec.

```js
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/global.css', 'utf8');

// Light tokens come from the bare :root block; dark from the
// prefers-color-scheme block. Split on the media query to keep them apart.
const darkIdx = css.indexOf('@media (prefers-color-scheme: dark)');
if (darkIdx === -1) {
  console.error('check-contrast FAILED: no dark-scheme block found');
  process.exit(1);
}
const parse = (text) => {
  const out = {};
  for (const m of text.matchAll(/--([a-z-]+):\s*#([0-9a-fA-F]{6})\b/g)) {
    out[m[1]] = m[2].toUpperCase();
  }
  return out;
};
const light = parse(css.slice(0, darkIdx));
const dark = { ...light, ...parse(css.slice(darkIdx)) };

const lum = (hex) => {
  const c = [0, 2, 4]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const BODY = 4.5;
const GRAPHICAL = 3.0;

// [foreground, background, floor]
const PAIRS = [
  ['on-surface', 'background', BODY],
  ['on-surface', 'surface', BODY],
  ['on-surface', 'surface-variant', BODY],
  ['on-surface-variant', 'background', BODY],
  ['on-surface-variant', 'surface', BODY],
  ['on-primary', 'primary', BODY],
  ['on-primary-container', 'primary-container', BODY],
  ['primary', 'background', BODY],
  ['primary', 'surface', BODY],
  // Accent role only — see the spec. Body copy never uses secondary.
  ['secondary', 'background', GRAPHICAL],
  ['secondary', 'surface', GRAPHICAL],
  ['outline', 'background', GRAPHICAL],
  ['outline', 'surface', GRAPHICAL],
];

const failures = [];
for (const [name, tokens] of [['light', light], ['dark', dark]]) {
  for (const [fg, bg, floor] of PAIRS) {
    if (!tokens[fg] || !tokens[bg]) {
      failures.push(`${name}: missing token ${!tokens[fg] ? fg : bg}`);
      continue;
    }
    const r = ratio(tokens[fg], tokens[bg]);
    const line = `${name}: ${fg} on ${bg} = ${r.toFixed(2)} (floor ${floor})`;
    if (r < floor) failures.push(line);
    else console.log(`  ok  ${line}`);
  }
}

if (failures.length) {
  console.error('check-contrast FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  console.error('A failing ratio means the colour is wrong, or its role is');
  console.error('wrong. It never means the threshold is wrong.');
  process.exit(1);
}
console.log('check-contrast passed');
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check-contrast.mjs`
Expected: FAIL — throws on the missing `src/styles/global.css`.

- [ ] **Step 3: Write global.css**

Values copied verbatim from `Color.kt`. Do not adjust any hex.

```css
/* Palette copied verbatim from the bpdtools Android app:
   app/src/main/java/com/bpdtools/app/ui/theme/Color.kt
   The app's ColorContrastTest proves these pairings. Do not recombine
   them without running npm run check:contrast. */
:root {
  --background: #FBF7F4;
  --surface: #FFFFFF;
  --surface-variant: #EFE7E1;
  --primary: #3D6B6B;
  --on-primary: #FFFFFF;
  --primary-container: #CFE3E0;
  --on-primary-container: #1C3533;
  --secondary: #A6674F;
  --on-surface: #2A2422;
  --on-surface-variant: #5A504B;
  --outline: #8A7D76;
  --error: #B3261E;

  --measure: 34rem;
  --gutter: clamp(1rem, 5vw, 2rem);
  --radius: 0.75rem;

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #191614;
    --surface: #201C1A;
    --surface-variant: #332D29;
    --primary: #8FC0BB;
    --on-primary: #10322F;
    --primary-container: #2C4B49;
    --on-primary-container: #CFE3E0;
    --secondary: #D9A088;
    --on-surface: #EDE5E0;
    --on-surface-variant: #C4B8B1;
    --outline: #8C7F78;
    --error: #F2B8B5;

    color-scheme: dark;
  }
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--background);
  color: var(--on-surface);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-size: 1.0625rem;
  line-height: 1.65;
  -webkit-text-size-adjust: 100%;
}

h1, h2, h3 { line-height: 1.2; text-wrap: balance; }
p { text-wrap: pretty; }

a { color: var(--primary); }

:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
  border-radius: 2px;
}

.skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  background: var(--surface);
  color: var(--on-surface);
  padding: 0.75rem 1rem;
  z-index: 10;
}
.skip-link:focus { left: 0; }

.wrap {
  max-width: var(--measure);
  margin-inline: auto;
  padding-inline: var(--gutter);
}

@media (prefers-reduced-motion: no-preference) {
  html { scroll-behavior: smooth; }
}
```

- [ ] **Step 4: Run the contrast check**

Run: `npm run check:contrast`
Expected: PASS. Every pair prints `ok`, including `light: secondary on background = 4.22 (floor 3)`.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css scripts/check-contrast.mjs package.json
git commit -m "style: add the app's palette as tokens, with a contrast gate

Colours are copied verbatim from the Android app's Color.kt so the site
and the app are literally the same palette. The checker encodes the two
floors from the app's own ColorContrastTest, and holds secondary to the
graphical floor because it is an accent here, never body copy."
```

---

### Task 3: Prepare the logo assets

**Files:**
- Create: `scripts/prepare-images.py`, `public/logo.png`, `public/logo-original.png`, `public/favicon.png`, `public/og-card.png`
- Delete: `bpdtools_logo_fullsize.png` from the repo root (moved into `public/logo-original.png`)

**Interfaces:**
- Consumes: nothing.
- Produces: four PNGs under `public/`, referenced by Task 4's layout as `/logo.png`, `/favicon.png`, `/og-card.png`.

**Background:** the supplied file is 1024x559, RGBA but fully opaque — every pixel has alpha 255 and the corners are white. It carries a baked-in tagline reading "Open Source Tools for BPD Management", which contradicts the site's constraints. A row-ink analysis found an all-white band at y=489..495 separating the wordmark's descenders from that tagline, so cropping to the top 492 rows severs no glyph.

- [ ] **Step 1: Write the preparation script**

Create `scripts/prepare-images.py`. It is idempotent and always reads from the pristine original.

```python
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
```

- [ ] **Step 2: Move the original into place and run it**

```bash
mkdir -p public
git mv bpdtools_logo_fullsize.png public/logo-original.png 2>/dev/null || mv bpdtools_logo_fullsize.png public/logo-original.png
python3 scripts/prepare-images.py
```

Expected: three lines of output reporting `public/logo.png (1024, 492)`, the favicon, and the OG card.

- [ ] **Step 3: Verify the crop severed no glyph and the key left no fringe**

```bash
python3 - <<'PY'
from PIL import Image
logo = Image.open("public/logo.png").convert("RGBA")
w, h = logo.size
assert (w, h) == (1024, 492), f"unexpected size {(w, h)}"

# The bottom row of the crop must be empty — proof no glyph was cut.
px = logo.load()
bottom_ink = sum(1 for x in range(w) if px[x, h - 1][3] > 8)
assert bottom_ink == 0, f"{bottom_ink} inked pixels on the cut line"

# Corners must be fully transparent.
for c in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    assert px[c][3] == 0, f"corner {c} not transparent: {px[c]}"

# Composite over the dark background and confirm no near-white halo
# appears anywhere that was background in the original.
dark = Image.new("RGBA", (w, h), (25, 22, 20, 255))
comp = Image.alpha_composite(dark, logo).convert("RGB")
cp = comp.load()
halo = sum(1 for y in range(0, h, 3) for x in range(0, w, 3)
           if min(cp[x, y]) > 235)
print("near-white pixels over dark bg (sampled):", halo)
assert halo < 40, "white fringing on the keyed edges"
print("logo checks passed")
PY
```

Expected: `logo checks passed`.

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-images.py public/logo.png public/logo-original.png public/favicon.png public/og-card.png
git rm --cached bpdtools_logo_fullsize.png 2>/dev/null || true
git commit -m "assets: crop the logo's tagline off and key out its background

The supplied file is fully opaque, so it would render as a white block
on the warm background and glare in dark mode. It also bakes in an
'Open Source Tools for BPD Management' tagline that the site cannot
reproduce: the repos are private, and 'management' is a treatment claim.

Cropping at the blank band leaves the mark and wordmark intact and moves
the tagline into HTML, where it is also readable by screen readers. The
original is kept untouched alongside."
```

---

### Task 4: Base layout

**Files:**
- Create: `src/layouts/Base.astro`
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `src/styles/global.css` (Task 2), `/favicon.png` and `/og-card.png` (Task 3).
- Produces: `Base.astro`, taking props `title: string` and `description: string`, rendering the html shell, a skip link, `<slot />` inside `<main id="main">`, and the footer. Later tasks render page content as children of `Base`.

- [ ] **Step 1: Write Base.astro**

```astro
---
interface Props {
  title: string;
  description: string;
}
const { title, description } = Astro.props;
const canonical = new URL(Astro.url.pathname, Astro.site).href;
import '../styles/global.css';
const year = new Date().getFullYear();
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />
    <link rel="icon" href="/favicon.png" type="image/png" />
    <link rel="apple-touch-icon" href="/favicon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />
    <meta property="og:image" content={new URL('/og-card.png', Astro.site).href} />
    <meta name="twitter:card" content="summary_large_image" />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <main id="main">
      <slot />
    </main>
    <footer class="site-footer">
      <div class="wrap">
        <p>&copy; {year} bpdtools</p>
      </div>
    </footer>
  </body>
</html>
```

- [ ] **Step 2: Add the footer style to global.css**

Append to `src/styles/global.css`:

```css
.site-footer {
  margin-top: 4rem;
  padding-block: 2rem;
  border-top: 1px solid var(--outline);
  color: var(--on-surface-variant);
  font-size: 0.9375rem;
}
```

- [ ] **Step 3: Point index.astro at the layout**

Replace `src/pages/index.astro` entirely:

```astro
---
import Base from '../layouts/Base.astro';
const title = 'bpdtools — a private app for logging emotions';
const description =
  'A private, offline Android app for logging emotions as they happen. A logging tool, not treatment.';
---
<Base title={title} description={description}>
  <h1>bpdtools</h1>
  <p>{description}</p>
</Base>
```

- [ ] **Step 4: Verify**

Run: `npm run verify`
Expected: contrast passes, build succeeds, `check-build passed`.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Base.astro src/pages/index.astro src/styles/global.css
git commit -m "feat: add the base layout with metadata and a skip link"
```

---

### Task 5: PhoneMockup and the three screens

**Files:**
- Create: `src/components/PhoneMockup.astro`, `src/components/ScreenLog.astro`, `src/components/ScreenHistory.astro`, `src/components/ScreenTrends.astro`
- Modify: `src/styles/global.css`

**Interfaces:**
- Consumes: palette tokens from Task 2.
- Produces: `PhoneMockup.astro` taking one prop `label: string` and rendering `<figure class="mockup">` containing an `aria-hidden="true"` phone frame wrapping `<slot />`, plus a visually-hidden `<figcaption>` carrying `label`. Task 6 renders it three times.

**Note on the swap to real screenshots:** because the frame is a slot, replacing a mockup later means passing an `<img>` as the child instead of the screen component. Nothing else changes. Task 8 documents this.

- [ ] **Step 1: Write PhoneMockup.astro**

```astro
---
interface Props {
  /** Text equivalent, for anyone who cannot see the frame. */
  label: string;
}
const { label } = Astro.props;
---
<figure class="mockup">
  <div class="phone" aria-hidden="true">
    <div class="phone-screen">
      <slot />
    </div>
  </div>
  <figcaption class="visually-hidden">{label}</figcaption>
</figure>
```

- [ ] **Step 2: Add the mockup styles**

Append to `src/styles/global.css`:

```css
.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.mockup { margin: 0; display: flex; justify-content: center; }

.phone {
  width: min(16rem, 72vw);
  aspect-ratio: 9 / 19.5;
  border: 2px solid var(--outline);
  border-radius: 1.75rem;
  background: var(--surface);
  padding: 0.5rem;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12);
}

.phone-screen {
  height: 100%;
  overflow: hidden;
  border-radius: 1.35rem;
  background: var(--background);
  padding: 0.75rem;
  font-size: 0.6875rem;
  line-height: 1.45;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.scr-title { font-weight: 600; font-size: 0.8125rem; }
.scr-muted { color: var(--on-surface-variant); }
.scr-chips { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.scr-chip {
  border: 1px solid var(--outline);
  border-radius: 999px;
  padding: 0.125rem 0.5rem;
}
.scr-chip[data-on] {
  background: var(--primary-container);
  border-color: var(--primary-container);
  color: var(--on-primary-container);
}
.scr-slider { height: 0.25rem; border-radius: 999px; background: var(--surface-variant); }
.scr-slider > span { display: block; height: 100%; width: 70%; border-radius: 999px; background: var(--primary); }
.scr-card {
  background: var(--surface);
  border: 1px solid var(--surface-variant);
  border-radius: 0.5rem;
  padding: 0.4rem 0.5rem;
}
.scr-btn {
  margin-top: auto;
  background: var(--primary);
  color: var(--on-primary);
  border-radius: 0.5rem;
  padding: 0.4rem;
  text-align: center;
  font-weight: 600;
}
.scr-bars { display: flex; align-items: flex-end; gap: 0.25rem; height: 3.5rem; }
.scr-bars > span { flex: 1; background: var(--primary); border-radius: 2px 2px 0 0; }
```

- [ ] **Step 3: Write ScreenLog.astro**

Content uses the app's real vocabulary: its emotions, its 0–10 intensity, its DBT coping skills.

```astro
<p class="scr-title">How are you feeling?</p>
<div class="scr-chips">
  <span class="scr-chip">Anxious</span>
  <span class="scr-chip" data-on>Angry</span>
  <span class="scr-chip">Ashamed</span>
  <span class="scr-chip">Sad</span>
  <span class="scr-chip">Numb</span>
</div>
<p class="scr-muted">Intensity — 7 of 10</p>
<div class="scr-slider"><span></span></div>
<p class="scr-muted">What happened?</p>
<div class="scr-card scr-muted">Left on read again.</div>
<p class="scr-muted">Skills used</p>
<div class="scr-chips">
  <span class="scr-chip" data-on>Paced breathing</span>
  <span class="scr-chip">Opposite action</span>
</div>
<div class="scr-btn">Save entry</div>
```

- [ ] **Step 4: Write ScreenHistory.astro**

```astro
<p class="scr-title">History</p>
<p class="scr-muted">Today</p>
<div class="scr-card">
  <strong>Angry · 7</strong><br />
  <span class="scr-muted">2:14 pm · Paced breathing</span>
</div>
<div class="scr-card">
  <strong>Anxious · 5</strong><br />
  <span class="scr-muted">9:02 am · Self-soothe</span>
</div>
<p class="scr-muted">Yesterday</p>
<div class="scr-card">
  <strong>Content · 3</strong><br />
  <span class="scr-muted">8:40 pm</span>
</div>
<div class="scr-card">
  <strong>Sad · 6</strong><br />
  <span class="scr-muted">11:15 am · Opposite action</span>
</div>
```

- [ ] **Step 5: Write ScreenTrends.astro**

```astro
<p class="scr-title">Trends</p>
<div class="scr-chips">
  <span class="scr-chip" data-on>7 days</span>
  <span class="scr-chip">30 days</span>
  <span class="scr-chip">All</span>
</div>
<p class="scr-muted">Mean intensity per day</p>
<div class="scr-bars">
  <span style="height: 40%"></span>
  <span style="height: 62%"></span>
  <span style="height: 35%"></span>
  <span style="height: 78%"></span>
  <span style="height: 55%"></span>
  <span style="height: 48%"></span>
  <span style="height: 70%"></span>
</div>
<p class="scr-muted">Scale fixed 0–10</p>
<div class="scr-card scr-muted">Most frequent — Anxious, Angry, Sad</div>
```

- [ ] **Step 6: Verify the build still passes**

Run: `npm run verify`
Expected: all three checks pass. (The components are not rendered yet; this confirms they compile once imported in Task 6.)

- [ ] **Step 7: Commit**

```bash
git add src/components src/styles/global.css
git commit -m "feat: add the phone mockup component and three screen fills

The frame takes a slot, so swapping a mockup for a real screenshot later
is a one-line change per screen. Frames are aria-hidden with the same
information carried in prose, the way the app's charts each have a
plain-text equivalent."
```

---

### Task 6: The page content

**Files:**
- Modify: `src/pages/index.astro`, `src/styles/global.css`
- Test: extend `scripts/check-build.mjs`

**Interfaces:**
- Consumes: `Base.astro` (Task 4), `PhoneMockup.astro` and the three screen components (Task 5).
- Produces: the finished page. No later task depends on its internals.

**Copy source:** every privacy claim below is drawn from `bpdtools-android-app/README.md` and must match the in-app About screen. If they disagree, that is a bug — and the page says so.

- [ ] **Step 1: Extend the build checker first**

Add these checks to `scripts/check-build.mjs`, inside the `if (existsSync(indexPath))` block:

```js
  check('single h1', (html.match(/<h1[\s>]/gi) || []).length === 1);
  check('has the not-treatment framing', /not treatment/i.test(html));
  check('discloses server-side readability',
    /not end-to-end|readable/i.test(html));
  check('states it is not distributed yet', /not .{0,30}available|not .{0,30}distributed/i.test(html));
  check('no contact email', !/mailto:/i.test(html));
  check('mockup frames are hidden from assistive tech',
    (html.match(/class="phone"/g) || []).length ===
    (html.match(/aria-hidden="true"/g) || []).length);
  check('three mockups present', (html.match(/class="mockup"/g) || []).length === 3);
```

- [ ] **Step 2: Run it to verify the new checks fail**

Run: `npm run build && npm run check:build`
Expected: FAIL listing `single h1` passing but `has the not-treatment framing`, `three mockups present` and others failing.

- [ ] **Step 3: Write index.astro**

```astro
---
import Base from '../layouts/Base.astro';
import PhoneMockup from '../components/PhoneMockup.astro';
import ScreenLog from '../components/ScreenLog.astro';
import ScreenHistory from '../components/ScreenHistory.astro';
import ScreenTrends from '../components/ScreenTrends.astro';

const title = 'bpdtools — a private app for logging emotions';
const description =
  'A private, offline Android app for logging emotions as they happen. A logging tool, not treatment.';

const privacy = [
  {
    h: 'Sync is off until you turn it on',
    p: `With it off, entries live only on your device, in an app-private
        database no other app can read.`,
  },
  {
    h: 'The app can reach the network',
    p: `Earlier versions declared no internet permission at all, so Android
        itself would refuse to open a socket even if a bug tried. That
        guarantee is gone. What replaces it is weaker: one compiled-in
        destination, cleartext traffic disabled, and a switch that is off
        until you turn it on. That is policy enforced by this app's code,
        where before it was enforced by Android regardless of this app's
        code. It is worth knowing which of those you have.`,
  },
  {
    h: 'Sync brought in more than one permission',
    p: `Alongside internet access, the background scheduler adds network-state,
        wake-lock, boot-completed and foreground-service permissions, and
        Android may add local-network access at install. Android Settings
        lists seven, not one — worth knowing before you go looking. None of
        them read anything on the device, and with sync off nothing is
        scheduled for them to do.`,
  },
  {
    h: 'The first sync uploads everything',
    p: `Nothing has ever been marked as synced, so the first successful upload
        is your entire history, including entries written long before sync
        existed. The app tells you this, and the exact entry count, before it
        happens.`,
  },
  {
    h: 'Entries on the server are readable',
    p: `They are stored in plain SQLite so they can be queried. Transport is
        encrypted and the disks are encrypted, but this is not end-to-end
        encryption: anyone with administrator access to that machine can read
        what you wrote. That was a deliberate trade for queryability.`,
  },
  {
    h: 'Turning sync off does not delete what was already sent',
    p: `There is no delete endpoint, so the app cannot make one. Removing data
        from the server is done on the server.`,
  },
  {
    h: 'No account, no login, no telemetry, no analytics',
    p: `Nothing about your usage is collected or reported. The one credential
        is a token you paste in yourself.`,
  },
  {
    h: "Android's cloud backup is disabled",
    p: `An explicit rules file excludes the database, the preferences, and
        every other file domain. The only upload is the one you switch on, to
        one address you can name.`,
  },
  {
    h: 'Device-to-device transfer is deliberately left on',
    p: `It copies your entries straight from an old phone to a new one without
        touching a server. Your sync token does not come across — it is
        wrapped with a key held in the Android Keystore, and those keys do not
        transfer. You paste it again on the new phone.`,
  },
];
---
<Base title={title} description={description}>
  <header class="hero">
    <div class="wrap">
      <img
        class="hero-logo"
        src="/logo.png"
        width="1024"
        height="492"
        alt="bpdtools"
        fetchpriority="high"
      />
      <h1 class="hero-lede">
        A private, offline Android app for logging emotions as they happen —
        what you felt, how strongly, what prompted it, and what you did about
        it.
      </h1>
      <p class="hero-claim">It is a logging tool, not treatment.</p>
      <p class="hero-status">
        bpdtools is not publicly distributed yet. There is nothing to download
        from this page.
      </p>
    </div>
  </header>

  <section class="section" aria-labelledby="what">
    <div class="wrap">
      <h2 id="what">What it does</h2>
    </div>

    <div class="wrap feature">
      <div class="feature-text">
        <h3>Log</h3>
        <p>
          Pick an emotion, set an intensity from 0 to 10, add an optional note
          on what triggered it, tag any coping skills you used, and adjust the
          timestamp if you are logging after the fact. Saving resets the form
          in place, so logging several entries in a row is fast.
        </p>
      </div>
      <PhoneMockup label="The Log screen: an emotion picker, an intensity slider set to 7 of 10, a note field, coping-skill tags, and a save button.">
        <ScreenLog />
      </PhoneMockup>
    </div>

    <div class="wrap feature">
      <div class="feature-text">
        <h3>History</h3>
        <p>
          Everything you have logged, most recent first, grouped by day. Tap an
          entry to edit it. Deleting offers an Undo — a visible button rather
          than a swipe, because a swipe is invisible to a screen reader and
          would leave some people with no way to discover it.
        </p>
      </div>
      <PhoneMockup label="The History screen: entries grouped under Today and Yesterday, each showing an emotion, an intensity out of ten, a time, and any skills used.">
        <ScreenHistory />
      </PhoneMockup>
    </div>

    <div class="wrap feature">
      <div class="feature-text">
        <h3>Trends</h3>
        <p>
          Three views over the last 7 days, 30 days, or all time: mean
          intensity per day, your most frequent emotions, and average intensity
          for each one. The intensity axis is pinned to 0–10 rather than
          auto-scaled, gaps are left as gaps rather than joined up, and every
          chart has a plain-text equivalent beside it — not just a picture.
        </p>
      </div>
      <PhoneMockup label="The Trends screen: a seven-day bar chart of mean intensity on a fixed zero-to-ten scale, with a list of the most frequent emotions below it.">
        <ScreenTrends />
      </PhoneMockup>
    </div>
  </section>

  <section class="section" aria-labelledby="privacy">
    <div class="wrap">
      <h2 id="privacy">Where your entries go</h2>
      <p class="section-lede">
        This is a mental-health-adjacent app, so it comes before anything else —
        including the parts that are not flattering.
      </p>
      <dl class="privacy">
        {privacy.map((item) => (
          <div class="privacy-item">
            <dt>{item.h}</dt>
            <dd>{item.p}</dd>
          </div>
        ))}
      </dl>
      <p class="note">
        This is exactly what the app's own About screen says. If this page and
        that screen ever disagree, that is a bug.
      </p>
    </div>
  </section>

  <section class="section" aria-labelledby="isnt">
    <div class="wrap">
      <h2 id="isnt">What it isn't</h2>
      <p>
        bpdtools gives no advice, no diagnosis, and no suggestions. It does not
        interpret what you log, score it, or tell you what to do about it. It
        records what you tell it and helps you look back at it later.
      </p>
      <p>
        The coping-skill vocabulary is drawn from Dialectical Behaviour Therapy.
        Naming a skill is not recommending it.
      </p>
      <p class="hero-claim">It is a logging tool, not treatment.</p>
    </div>
  </section>
</Base>
```

- [ ] **Step 4: Add the page styles**

Append to `src/styles/global.css`:

```css
.hero { padding-block: clamp(2.5rem, 10vw, 5rem) 1rem; }
.hero-logo { display: block; width: min(20rem, 80%); height: auto; margin: 0 0 1.5rem; }
.hero-lede { font-size: clamp(1.375rem, 4.5vw, 1.875rem); font-weight: 600; margin: 0 0 1rem; }
.hero-claim {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--secondary);
  border-left: 3px solid var(--secondary);
  padding-left: 0.75rem;
  margin: 1.5rem 0;
}
.hero-status { color: var(--on-surface-variant); font-size: 0.9375rem; }

.section { padding-block: clamp(2rem, 7vw, 3.5rem); }
.section h2 { font-size: clamp(1.5rem, 5vw, 2rem); margin-bottom: 0.5rem; }
.section-lede { color: var(--on-surface-variant); margin-bottom: 2rem; }

.feature { display: grid; gap: 1.5rem; margin-block: 2.5rem; }
.feature-text h3 { font-size: 1.25rem; margin: 0 0 0.5rem; }
.feature-text p { margin: 0; }

@media (min-width: 46rem) {
  .wrap { max-width: 60rem; }
  .feature { grid-template-columns: 1fr auto; align-items: center; gap: 3rem; }
  .hero .wrap, .section > .wrap:first-child { max-width: 46rem; margin-inline: auto; }
}

.privacy { margin: 0; display: grid; gap: 1.25rem; }
.privacy-item {
  background: var(--surface);
  border: 1px solid var(--surface-variant);
  border-radius: var(--radius);
  padding: 1rem 1.125rem;
}
.privacy dt { font-weight: 600; margin-bottom: 0.25rem; }
.privacy dd { margin: 0; color: var(--on-surface-variant); }

.note {
  margin-top: 2rem;
  padding-left: 0.75rem;
  border-left: 3px solid var(--outline);
  color: var(--on-surface-variant);
  font-size: 0.9375rem;
}
```

Note the two uses of `--secondary`: a large bold heading and a border. Both are accent roles, consistent with the 3:1 floor.

- [ ] **Step 5: Verify**

Run: `npm run verify`
Expected: all three checks pass, including the seven new build assertions.

- [ ] **Step 6: Check it at 400px and in both themes**

Run: `npm run preview` and open the printed URL. Confirm at 400px wide that nothing overflows horizontally, then toggle the OS or browser dark-mode setting and confirm the page inverts cleanly and the logo has no white box around it.

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro src/styles/global.css scripts/check-build.mjs
git commit -m "feat: write the page

Carries the privacy section's unflattering half intact — server-side
readability, the permission count, and the fact that turning sync off
does not unsend anything — because that candour is the thing worth
saying. Build checks now assert the constraints that prose can drift
away from."
```

---

### Task 7: Build and publish from GitHub Actions

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `npm run verify` from Tasks 1–6.
- Produces: a green deploy on push to `main`.

- [ ] **Step 1: Write the workflow**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

# Pages deployment authenticates with OIDC. Without id-token and pages
# write, the deploy step fails with a permissions error — this is the
# most common way this workflow breaks.
permissions:
  contents: read
  pages: write
  id-token: write

# Queue pushes rather than letting two publishes race.
concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm

      - run: npm ci

      # Runs the contrast gate, the build, and the output checks.
      - run: npm run verify

      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

Two jobs rather than one so a failed build can never replace a working site.

- [ ] **Step 2: Set the Pages source**

This is manual and the workflow cannot do it itself:

**Settings → Pages → Build and deployment → Source → GitHub Actions.**

Leave the custom domain field alone for now; `public/CNAME` sets it on first deploy.

- [ ] **Step 3: Push and watch the run**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: build and publish to Pages from Actions

Split into build and deploy jobs so a failing build cannot replace a
working site, and run the contrast and output checks before anything is
uploaded."
git push -u origin main
gh run watch
```

Expected: both jobs green.

- [ ] **Step 4: Verify the deployed site**

```bash
curl -sI https://bpdtools.cloud | head -1
curl -s https://bpdtools.cloud | grep -c 'not treatment'
curl -sI https://api.bpdtools.cloud/healthz | head -1
```

Expected: `200` from the apex, at least one match for the framing line, and the API still answering — confirming nothing here disturbed it.

- [ ] **Step 5: Enable HTTPS enforcement**

Once Pages reports the certificate as issued (Settings → Pages), tick **Enforce HTTPS**. Doing this before the certificate exists fails and needs a manual retry.

---

### Task 8: README

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing code depends on.

- [ ] **Step 1: Write the README**

````markdown
# bpdtools.cloud

The website for [bpdtools](https://bpdtools.cloud), a private Android app for
logging emotions. One page, no client JavaScript.

The app's own repositories are private, so this site links to no source and
makes no open-source claim. It is an informational page, not a download page.

## Developing

```bash
npm install
npm run dev
```

## Verifying

```bash
npm run verify
```

Three gates, also run in CI before anything is published:

- `check:contrast` parses the colour tokens out of `src/styles/global.css`
  and asserts WCAG floors — 4.5:1 for body text, 3:1 for large text and
  non-text graphics. These are the same two floors the Android app's
  `ColorContrastTest` uses.
- `astro build`
- `check:build` asserts what the output must never contain: a `<script>` tag,
  an open-source claim, a crisis hotline, a `mailto:` link, or a phone mockup
  that is not hidden from assistive technology.

A failing contrast ratio means the colour is wrong, or its role is wrong. It
never means the threshold is wrong.

**Secondary is an accent colour.** Terracotta measures 4.22:1 on the light
background — fine for a large heading or a rule, not for body copy. Do not use
it for paragraphs.

## Images

`scripts/prepare-images.py` derives everything under `public/` from
`public/logo-original.png`, which is the supplied file and should stay
untouched. Re-run it with `python3 scripts/prepare-images.py` (needs Pillow).

It crops the original at y=492 to remove a baked-in tagline reading "Open
Source Tools for BPD Management" — the repos are private, so the first half is
not true, and "management" is a treatment claim the app deliberately avoids.
It then keys the white background to transparent with a feathered edge, so the
mark does not fringe white in dark mode.

## Swapping in real screenshots

The mockups are HTML placeholders. `PhoneMockup` renders a frame around a
slot, so replacing one is a per-screen change in `src/pages/index.astro`:

```astro
<PhoneMockup label="Describe what the screenshot shows, in a sentence.">
  <img src="/shot-log.png" width="1080" height="2340" alt="" />
</PhoneMockup>
```

Put the file in `public/`. Keep the `label` accurate — it is what someone
using a screen reader gets instead of the image, and the build check enforces
that the frame stays `aria-hidden`.

## Deploying

Push to `main`. `.github/workflows/deploy.yml` runs `npm run verify`, then
publishes `dist/` to Pages. Repository Settings → Pages → Source must be set
to **GitHub Actions**.

`public/CNAME` pins the custom domain; without it Pages drops the domain on
every publish.

## DNS

Hosted in the existing `bpdtools.cloud` Route53 zone. The zone is *not*
managed by Terraform — the API's Terraform reads it with a data source and
only creates the `api` record — so these were added by hand without touching
that state.

| Name | Type | Value | Status |
|---|---|---|---|
| `bpdtools.cloud` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` | applied 2026-09-15 |
| `bpdtools.cloud` | AAAA | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` | not set — site is unreachable from IPv6-only clients |
| `www.bpdtools.cloud` | CNAME | `erinlkolp.github.io` | not set — only affects visitors typing `www.` |

Re-check these against GitHub's published addresses before applying; they have
changed before.

`api.bpdtools.cloud` is unrelated to this site and must not be modified.
````

- [ ] **Step 2: Verify the claims in it are true**

```bash
npm run verify
dig +short bpdtools.cloud A
dig +short bpdtools.cloud AAAA
```

Expected: verify passes; four A records; no AAAA, matching what the table says.

- [ ] **Step 3: Commit and push**

```bash
git add README.md
git commit -m "docs: README covering verification, images, and DNS state

Records which DNS records are applied and which are not, with the
consequence of each gap, so the next person does not have to re-derive
it from dig."
git push
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: build/layout → 1; palette and contrast floors → 2; logo crop, keying and derived assets → 3; metadata, OG, skip link → 4; mockups and their text equivalents → 5; all four content sections, the four deliberate omissions, and accessibility → 6; Actions deploy, CNAME, Pages source, HTTPS ordering → 7; DNS state and screenshot-swap procedure → 8. The spec's "future work" section is explicitly out of scope and has no task, as intended.

**Placeholder scan.** No TBD, TODO, "handle edge cases", or "similar to Task N". Every code step carries the literal content to write.

**Type consistency.** `PhoneMockup` takes `label` in Tasks 5, 6 and 8. `Base` takes `title` and `description` in Tasks 4 and 6. CSS token names are identical in Tasks 2, 5 and 6 and in the checker's `PAIRS`. The npm script names in Task 1's `package.json` match every later invocation and the workflow's `npm run verify`.

**One gap found and closed:** Task 1 originally left the template's `favicon.svg` in place, which would have masked the real favicon's absence in Task 3. Step 3 now deletes it.
