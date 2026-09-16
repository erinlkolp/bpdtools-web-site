# bpdtools.cloud — website design

**Date:** 2026-09-15
**Repo:** `git@github.com:erinlkolp/bpdtools-web-site.git` (public, empty at time of writing)
**Domain:** `bpdtools.cloud` (apex)

## What this is

A single-page informational site for bpdtools, the private offline Android app
for logging emotions. Its one job is to explain what the app is, what it does,
and what it does with your data. It is not a download page and not a
documentation site.

## What this is not, and why

**It does not call bpdtools open source.** Both
`erinlkolp/bpdtools-android-app` and `erinlkolp/bpdtools-android-api` are
private and neither carries a LICENSE file. Until that changes the site links
to no source and makes no licensing claim. This is the reason the supplied
logo's baked-in tagline is cropped off rather than reproduced.

**It offers no download.** The app is not publicly distributed: there is no
Play Store listing, and the release keystore exists only on one machine. The
hero states this plainly in one line instead of showing a button that leads
nowhere.

**It carries no crisis resources or helpline banner.** The app gives no
advice, no diagnosis and no suggestions; a crisis banner is advice. Including
one would have the site say what the app deliberately refuses to say. The
"not treatment" framing is kept sharp instead.

**It has no contact details.** Deferred by the owner. The footer carries the
copyright line and nothing else.

## Build

Astro 7 (7.3.2 at time of writing), static output, zero client JavaScript.
Node 24.14.1 / npm 11.11.0 are present locally. Image processing uses Pillow
10.2.0 via Python, already installed; ImageMagick is not available on this
machine.

Astro over hand-written HTML because the three phone mockups are one
structure with three sets of content — a component with props keeps them in
sync, and swapping a mockup for a real screenshot later becomes a prop change
in one place rather than an edit in three. Astro emits no JS by default, so
the deployed artifact is still HTML and CSS.

Accepted costs: a lockfile and `node_modules`, annual-ish major version
upgrades, and a build that can fail where a static file cannot.

### Layout

```
astro.config.mjs            site: 'https://bpdtools.cloud'
package.json
public/
  CNAME                     bpdtools.cloud
  logo.png                  cropped + keyed, see "Logo"
  logo-original.png         the supplied file, unmodified
  favicon.png              32/180px, cropped from the mark alone
  og-card.png              1200x630 link-preview card
src/
  layouts/Base.astro        html shell, meta, OG tags, skip link
  pages/index.astro         the page, composed of sections
  components/
    PhoneMockup.astro       frame + slot + text equivalent
    ScreenLog.astro
    ScreenHistory.astro
    ScreenTrends.astro
  styles/global.css         palette tokens, type scale, layout
.github/workflows/deploy.yml
README.md
```

## Page content

Four sections plus hero and footer, in this order.

### Hero

Logo, then the app's own opening line: *a private, offline Android app for
logging emotions as they happen — what you felt, how strongly, what prompted
it, and what you did about it.* Immediately below, the line the app leads
with: **it is a logging tool, not treatment.**

One status line, quiet and factual: the app is not publicly distributed yet.
No button.

### What it does

Log, History and Trends, each paired with a phone mockup.

- **Log** — pick an emotion, set intensity 0–10, optionally note what
  triggered it, tag coping skills used, adjust the timestamp when logging
  after the fact. Saving resets the form in place so several entries in a row
  are fast.
- **History** — reverse-chronological, grouped by day. Tap to edit. Delete
  has a visible Undo button rather than a swipe, because a swipe is
  invisible to TalkBack.
- **Trends** — daily mean intensity, most frequent emotions, and average
  intensity per emotion, over 7 days / 30 days / all time. Every chart has a
  plain-text equivalent beside it, not just a picture.

Vocabulary shown in mockups is the app's real vocabulary: its 14 emotions, its
13 DBT-derived coping skills, intensity pinned 0–10.

### Privacy

The longest section and the main reason the site exists. It reproduces the
*honest* version from the app README — including the parts that are not
flattering, because that candour is the app's actual differentiator:

- Sync is off until you turn it on. With it off, entries live only on the
  device in an app-private SQLite database.
- The app can reach the network. Earlier versions declared no INTERNET
  permission, so the OS itself would refuse a socket. That guarantee is gone;
  what replaces it is weaker — one compiled-in destination, cleartext
  disabled, and a switch that is off by default. Policy enforced by the app's
  code, where it used to be enforced by Android regardless of the app's code.
- Sync brought in more permissions than INTERNET alone: WorkManager adds
  ACCESS_NETWORK_STATE, WAKE_LOCK, RECEIVE_BOOT_COMPLETED and
  FOREGROUND_SERVICE, and Android may add ACCESS_LOCAL_NETWORK at install.
  Android Settings shows seven, not one.
- If you turn sync on, the first upload is your entire history — nothing has
  ever been marked synced. The app names the exact entry count first.
- Entries on the server are readable. Stored in plain SQLite so they can be
  queried; TLS in transit and encrypted disks, but **not** end-to-end
  encrypted. Anyone with administrator access to that machine can read the
  trigger notes. A deliberate trade for queryability.
- Turning sync off does not delete what was already sent. There is no delete
  endpoint.
- No account, no login, no telemetry, no analytics.
- Android cloud backup is disabled: `allowBackup="false"` plus explicit
  data-extraction rules.
- Device-to-device transfer is deliberately left on — it never touches a
  server and is the phone-upgrade path. The sync token does not come across;
  it is wrapped by an Android Keystore key, and those do not transfer.

If this section and the in-app About screen ever disagree, that is a bug. The
site says so.

### What it isn't

Short and blunt: no advice, no diagnosis, no suggestions, no treatment. It
records what you tell it and helps you look back at it later. The coping-skill
vocabulary is drawn from Dialectical Behaviour Therapy; naming a skill is not
recommending it.

### Footer

Copyright only.

## Logo

The supplied `bpdtools_logo_fullsize.png` is 1024×559, RGBA but **fully
opaque** — every sampled pixel has alpha 255 and the corners are white. Used
as-is it renders as a white rectangle against the site's warm background and
glares in dark mode.

It also carries a baked-in tagline, *"Open Source Tools for BPD Management"*,
which contradicts two decisions above: the site makes no open-source claim,
and "management" reads as a treatment claim. Text baked into a raster is also
invisible to screen readers and search engines.

Treatment: crop to the top 492 rows and key the white to transparent. Row
analysis found a clean 7-row all-white band at y=489–495 separating the
wordmark's descenders from the tagline, so the crop severs no glyph. The
original is kept at `public/logo-original.png`, unmodified.

Two derived assets come from the same cropped file: `favicon.png` (the
brain/face mark alone, without the wordmark, which is illegible at 32px) and
`og-card.png`, a 1200x630 link-preview card placing the cropped logo on the
light background token. Both are raster because the source art is raster —
there is no vector original, so no SVG favicon is claimed.

Keying is a threshold on near-white with the alpha feathered at glyph edges,
so the mark does not acquire a white fringe on dark backgrounds. Verified by
compositing the result over both `#FBF7F4` and `#191614` and inspecting the
edges.

## Styling

Palette tokens lifted verbatim from the app's
`app/src/main/java/com/bpdtools/app/ui/theme/Color.kt`, as CSS custom
properties, so the site and the app are literally the same colours:

| Token | Light | Dark |
|---|---|---|
| background | `#FBF7F4` | `#191614` |
| surface | `#FFFFFF` | `#201C1A` |
| surface variant | `#EFE7E1` | `#332D29` |
| primary | `#3D6B6B` | `#8FC0BB` |
| on primary | `#FFFFFF` | `#10322F` |
| primary container | `#CFE3E0` | `#2C4B49` |
| on primary container | `#1C3533` | `#CFE3E0` |
| secondary | `#A6674F` | `#D9A088` |
| on surface | `#2A2422` | `#EDE5E0` |
| on surface variant | `#5A504B` | `#C4B8B1` |
| outline | `#8A7D76` | `#8C7F78` |

Dark mode via `prefers-color-scheme`, no toggle.

Existing foreground/background *pairings* from the app are reused rather than
recombined, because `ColorContrastTest` already proves those ratios. Any pair
the app does not already use is checked numerically against WCAG AA before it
ships. The site adopts the app's own two floors verbatim: **4.5:1 for body
text, 3:1 for large text and non-text graphics** — the `bodyTextFloor` and
`graphicalFloor` constants in `ColorContrastTest`.

**Secondary is an accent colour, never body copy.** Terracotta `#A6674F`
measures 4.22:1 on the light background and 4.49:1 on light surface — below
the body floor, comfortably above the graphical one. Dark-mode
`#D9A088` is unconstrained at 8.00:1. This matches the app, whose contrast
test holds `Secondary` to no body-text assertion. The site therefore uses
secondary only for rules, icons, and large headings, and the contrast check
enforces that by testing it against the 3:1 floor alone. A failing ratio
means the colour is wrong, or the role is wrong — never that the threshold is
wrong.

System font stack; no webfont, so no third-party request and nothing to block
render.

Mobile-first. This is a phone app's site and will mostly be read on a phone.

## Accessibility

The app takes this seriously and the site matches it.

- Semantic landmarks, correct heading order, skip-to-content link.
- Phone mockups are decorative: `aria-hidden="true"`, with the same
  information carried in adjacent prose. This mirrors the app's rule that
  every chart has a plain-text equivalent. The page must be fully
  comprehensible with the mockups suppressed.
- Visible `:focus-visible` styling on every interactive element.
- No animation except under a `prefers-reduced-motion: no-preference` guard.
- Logo `alt` text conveys the wordmark, not the cropped tagline.

## Deployment

Pages source is **GitHub Actions**, not branch-deploy, because the site is
built. Nothing is committed from `dist/`; the artifact is produced in CI.

`.github/workflows/deploy.yml`, triggered on push to `main` plus
`workflow_dispatch`:

- Two jobs, `build` then `deploy`, so a failing build never replaces a
  working site.
- `build`: `actions/checkout`, then `withastro/action` (which handles Node
  setup, dependency install with the lockfile, `astro build`, and uploading
  the Pages artifact).
- `deploy`: `actions/deploy-pages`, with `environment: github-pages`.
- Top-level `permissions:` of `contents: read`, `pages: write`,
  `id-token: write` — Pages deployment uses OIDC and fails without the last
  two. This is the most common way this workflow breaks.
- `concurrency:` group `pages` with `cancel-in-progress: false`, so two
  pushes in quick succession queue rather than racing to publish.

All actions pinned to major version tags.

Repository setting: Settings → Pages → Source must be set to **GitHub
Actions**. This is a one-time manual step and the workflow cannot do it
itself.

`public/CNAME` contains `bpdtools.cloud` so the custom domain survives every
deploy — without it, Pages drops the custom domain on publish.

### DNS

Applied by hand in Route53, not Terraform. The zone already exists and the
API's Terraform only reads it via `data "aws_route53_zone"` while creating
the `api` record, so apex records added by hand do not collide with that
state.

**Status as of 2026-09-15: the apex A records are live.** All four resolve and
match GitHub's published set:

- A on `bpdtools.cloud` → `185.199.108.153`, `185.199.109.153`,
  `185.199.110.153`, `185.199.111.153` — **done, verified by `dig`**

Still open, neither blocking launch:

- AAAA on `bpdtools.cloud` → `2606:50c0:8000::153`, `2606:50c0:8001::153`,
  `2606:50c0:8002::153`, `2606:50c0:8003::153` — **not set.** Without these
  the site is unreachable from IPv6-only clients.
- `www.bpdtools.cloud` CNAME → `erinlkolp.github.io` — **not set.** Only
  affects visitors who type the `www.` prefix.

Addresses must be re-checked against GitHub's current published set before
being applied; GitHub has changed them before. The four above were checked on
2026-09-15.

Order matters for what remains: with the records resolving, set the custom
domain in Pages, then enable Enforce HTTPS only once the certificate has been
issued. Enabling it too early fails and needs a manual retry.

`api.bpdtools.cloud` still resolves to `35.81.34.11` and is untouched.
Nothing here changes the API.

## Verification

There is no test runner for a static page, so verification is explicit:

1. `npm run build` succeeds and the output contains no `<script>` tags.
2. Every text/background pair computed numerically against WCAG AA; failures
   are colour bugs, not threshold bugs.
3. Rendered at 400px and at desktop width, in both light and dark.
4. Heading order checked, and the page read once with mockups suppressed to
   confirm no information is only in a picture.
5. Logo composited over both background colours with edges inspected for
   white fringing.
6. Every privacy claim on the page checked line by line against the app
   README and the in-app About screen. A disagreement is a bug in one of
   them, and the site says so.

## Future work, explicitly out of scope

- A download or install path, once the app is distributable.
- Source links, a licence, and open-source framing, if the repos go public.
- Real screenshots replacing the mockups. `PhoneMockup` takes a slot so this
  is a per-screen swap, documented in the README.
- A standalone privacy-policy page, if a store listing ever requires one.
