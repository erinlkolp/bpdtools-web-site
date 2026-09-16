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

WCAG "large-scale text" means 24px at any weight, or 18.66px when bold
(weight ≥700). The `.hero-claim` rule is now 1.25rem (20px) at weight 700,
meeting the large-text floor of 3:1. If you change its size or weight, re-check
which contrast floor applies.

**Contrast checker scope.** `check:contrast` validates a fixed list of colour
pairs defined in `PAIRS` in `scripts/check-contrast.mjs`. Pairings the CSS uses
that are not in that list pass `npm run verify` without ever being checked.
Two colour combinations were found this way during development. When adding a new
colour combination to the site, add it to `PAIRS`.

## Images

`scripts/prepare-images.py` derives everything under `public/` from
`art/logo-original.png`, which is the supplied file and should stay
untouched. `art/` sits outside `public/` deliberately — Astro copies
`public/` verbatim into `dist/`, and the original's baked-in tagline
("Open Source Tools for BPD Management") must never be served. Re-run it
with `python3 scripts/prepare-images.py` (needs Pillow).

It crops the original (1024×559) at y=492 to remove a baked-in tagline reading
"Open Source Tools for BPD Management" — the repos are private, so the first
half is not true, and "management" is a treatment claim the app deliberately
avoids. It then keys near-white pixels to transparent with a feathered edge
(thresholds lo=190, hi=210) so the mark does not fringe white in dark mode.
The feathering uses linear interpolation between the thresholds to avoid a
hard edge on anti-aliased glyphs.

The thresholds 190/210 are specific and were tightened from the initial
228/250. The original artwork contains a pale rounded-rectangle panel behind
the head illustration—not just a white canvas. At 228/250, the canvas white
was removed but the panel remained as an opaque near-white shape, invisible on
the light page background but a glaring 18.92% of visible pixels on the dark
mode token. This panel is topologically enclosed by the head-profile stroke,
so border-seeded flood fill cannot reach it. Tightening the threshold to
190/210 keys the panel out while preserving the real artwork; the heart, brain,
cloud, and wordmark sit at min-channel 55–190, well below the 190 floor, so
they survive unharmed. The tightened thresholds measure ~0% residual pale pixels
on both logo.png and favicon.png.

The script produces three assets: `logo.png` (680×327, the hero image), which
is the keyed logo resized with premultiplied alpha to avoid reintroducing a
white fringe; `favicon.png` (180×180, the mark alone, used at 32px where the
wordmark is illegible); and `og-card.png` (1200×630, the logo centred on the
light background token for social-media preview cards).

**Note on asset regeneration.** `prepare-images.py` re-runs the pale-pixel
check itself, every time, as the last step of `main()`: it composites every
visible pixel of `public/logo.png` and `public/favicon.png` over the dark
background token (`#191614`) and raises if too many are pale. This is
deliberately not part of `npm run verify` — CI is Node-only and never
regenerates images, so adding a Python/Pillow dependency there would buy
nothing; the check belongs at the moment the risk exists, which is here.

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

To deploy the site:

1. Push to `main`. The `.github/workflows/deploy.yml` workflow runs
   `npm run verify`, builds the static output, checks it, and publishes
   `dist/` to GitHub Pages.

2. Enable GitHub Pages in the repository:
   - Go to **Settings → Pages**.
   - Set **Source** to **GitHub Actions**.
   - Click **Save**.

   The workflow cannot set this itself — it must be configured manually.

3. Configure the custom domain:
   - In **Settings → Pages**, set the **Custom domain** field to `bpdtools.cloud`.
   - Wait for the certificate to be issued. GitHub displays progress in the UI.

4. Only after the certificate is issued, enable HTTPS enforcement:
   - Check **Enforce HTTPS**.

   Enabling this too early will fail and require a manual retry. The UI will
   show an error if you try.

`public/CNAME` contains `bpdtools.cloud` and pins it; without it, Pages drops
the domain on every publish.

## DNS

Hosted in the existing `bpdtools.cloud` Route53 zone. The zone is not managed
by Terraform — the API's Terraform reads it with a data source and only
creates the `api` record — so these were added by hand without touching that
state.

| Name | Type | Value | Status |
|---|---|---|---|
| `bpdtools.cloud` | A | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` | applied 2026-09-15 |
| `bpdtools.cloud` | AAAA | — | not set — site is unreachable from IPv6-only clients |
| `www.bpdtools.cloud` | CNAME | `erinlkolp.github.io` | not set — only affects visitors typing `www.` prefix |

Re-check these against [GitHub's published addresses](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site#about-custom-domain-configuration)
before applying; they have changed before.

`api.bpdtools.cloud` is unrelated to this site and must not be modified.
