import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/global.css', 'utf8');

// --- Scope-aware token extraction --------------------------------------
//
// Tasks 4, 5 and 6 append more CSS to this same file, after the dark-scheme
// media block. A naive "slice the file at the media-query string" parser
// would misread any later rule containing a literal `--name: #hex` as a
// dark-theme token. Instead we extract tokens only from the two `:root {
// ... }` declaration blocks that actually define the palette: the bare
// top-level one (light) and the one nested inside
// `@media (prefers-color-scheme: dark)` (dark). Everything else in the
// file — later rules, other selectors, other media queries — is ignored
// regardless of what custom properties it happens to declare.

// Find the matching closing brace for the '{' at openIdx, honouring
// nested braces.
function matchBrace(text, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error(`unbalanced braces starting at index ${openIdx}`);
}

// Locate the dark-scheme media block first, so we know which :root block
// (if any) sits inside it.
const darkMediaIdx = css.indexOf('@media (prefers-color-scheme: dark)');
if (darkMediaIdx === -1) {
  console.error('check-contrast FAILED: no dark-scheme block found');
  process.exit(1);
}
const darkMediaOpenBrace = css.indexOf('{', darkMediaIdx);
if (darkMediaOpenBrace === -1) {
  console.error('check-contrast FAILED: malformed dark-scheme media block');
  process.exit(1);
}
const darkMediaCloseBrace = matchBrace(css, darkMediaOpenBrace);

// Find every `:root { ... }` block in the file and bucket each one as
// "light" (outside the dark media block) or "dark" (inside it).
const rootBlockRe = /:root\s*\{/g;
let match;
const lightBlocks = [];
const darkBlocks = [];
while ((match = rootBlockRe.exec(css)) !== null) {
  const openBrace = css.indexOf('{', match.index);
  const closeBrace = matchBrace(css, openBrace);
  const body = css.slice(openBrace + 1, closeBrace);
  if (match.index > darkMediaOpenBrace && match.index < darkMediaCloseBrace) {
    darkBlocks.push(body);
  } else {
    lightBlocks.push(body);
  }
}

if (lightBlocks.length === 0) {
  console.error('check-contrast FAILED: no top-level :root block found');
  process.exit(1);
}
if (darkBlocks.length === 0) {
  console.error(
    'check-contrast FAILED: no :root block found inside the dark-scheme media query',
  );
  process.exit(1);
}

const parse = (text) => {
  const out = {};
  for (const m of text.matchAll(/--([a-z-]+):\s*#([0-9a-fA-F]{6})\b/g)) {
    out[m[1]] = m[2].toUpperCase();
  }
  return out;
};

const light = parse(lightBlocks.join('\n'));
const dark = { ...light, ...parse(darkBlocks.join('\n')) };

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
  ['secondary', 'background', BODY],
  ['secondary', 'surface', BODY],
  ['outline', 'background', GRAPHICAL],
  ['outline', 'surface', GRAPHICAL],
  ['outline', 'surface-variant', GRAPHICAL],
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

// --- Coverage check: PAIRS is a fixed hand-written list, so a pairing the
// CSS actually uses but nobody added to PAIRS passes silently. This does
// not derive thresholds from the CSS (that would fail two pairings that
// are legitimately exempt -- see EXEMPT below); it only derives coverage:
// every foreground/background token pairing the stylesheet establishes
// must appear in PAIRS (held to a floor) or EXEMPT (a written reason).
//
// EXEMPT: pairings a human has judged legitimately outside WCAG's contrast
// requirement. Never add here just to silence a failure -- each entry
// needs a real, written reason.
const EXEMPT = [
  {
    fg: 'surface-variant', bg: 'surface',
    reason:
      "Decorative divider only (the .privacy-item border), " +
      "redundant with the grid gap between cards. WCAG 1.4.11 does not " +
      "require contrast for a boundary that is not needed to understand " +
      "content.",
  },
  {
    fg: 'primary-container', bg: 'background',
    reason:
      "Pill fill behind .hero-claim (\"It is a logging tool, not " +
      "treatment\"), against the page background. The fill is a decorative " +
      "container, not a control and not a graphic needed to understand the " +
      "sentence -- the words are legible without it, and their own ratio " +
      "(on-primary-container on primary-container) IS held to the body " +
      "floor in PAIRS. Recorded from manual review, not from the scan " +
      "below: it exists only because .hero-claim (fills with " +
      "primary-container) sits inside .hero / .closing (which fill with " +
      "background) in the markup -- two separate rules, invisible to a " +
      "lexical scan of global.css alone. NOTE: until the phone mockups " +
      "became real screenshots this entry was justified by .scr-chip " +
      "instead, which no longer exists; the pairing outlived its original " +
      "cause.",
  },
  {
    fg: 'divider', bg: 'surface',
    reason:
      "Hairline boundary only (card borders, the header rule, the footer " +
      "rule, section band edges). It exists to separate surfaces visually, " +
      "never to carry information, and nothing is unreadable without it. " +
      "WCAG 1.4.11 applies to components and graphics required to " +
      "understand content; this is neither. Structural borders that DO " +
      "need to be perceivable use --outline, which is held to the 3:1 " +
      "graphical floor in PAIRS.",
  },
  {
    fg: 'divider', bg: 'background',
    reason:
      "Same hairline token as above, against the page background rather " +
      "than a card surface (the hero's bottom rule and the band edges).",
  },
  {
    fg: 'divider', bg: 'surface-variant',
    reason:
      "Same hairline token, against the banded privacy section's own " +
      "background.",
  },
];

// Lexical scan, deliberately simple: for every flat (non-nested) CSS rule
// in global.css, look for a "foreground-role" property (color, or a
// border/border-color declaration) and a "background-role" property
// (background or background-color) declared TOGETHER in that same rule,
// each holding a var(--token). That pair is a pairing the CSS "uses".
//
// What this catches: every pairing in this codebase that is expressed
// within a single rule -- which is every pairing PAIRS currently lists
// except the two accent-role ones added by hand, plus both EXEMPT entries'
// underlying CSS relationship for the .privacy-item/.scr-card border (the
// scanner finds surface-variant-on-surface on its own).
//
// What this CANNOT catch, honestly: a pairing established only by CSS
// inheritance from an ancestor selector (e.g. .hero-claim sets color but
// no background, inheriting --background from body -- secondary-on-
// background is real and in PAIRS, but this scanner never re-derives it),
// or one established only by DOM nesting across two unrelated rules (the
// .scr-chip-inside-.phone-screen case above). Both kinds are real gaps in
// what this script can verify on its own; PAIRS and EXEMPT are the record
// of what a human already checked for those.
const flatCss = css.slice(0, darkMediaIdx) + css.slice(darkMediaCloseBrace + 1);
const usedPairings = new Map(); // "fg|bg" -> selector that uses it
for (const m of flatCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim();
  const body = m[2];
  const fgTokens = new Set();
  const bgTokens = new Set();
  for (const bm of body.matchAll(/\bbackground(?:-color)?\s*:\s*[^;]*var\(--([a-z-]+)\)/g)) {
    bgTokens.add(bm[1]);
  }
  for (const cm of body.matchAll(/(?<!-)\bcolor\s*:\s*var\(--([a-z-]+)\)/g)) {
    fgTokens.add(cm[1]);
  }
  for (const bm of body.matchAll(/\bborder(?:-(?:left|right|top|bottom))?(?:-color)?\s*:\s*[^;]*var\(--([a-z-]+)\)/g)) {
    fgTokens.add(bm[1]);
  }
  for (const fg of fgTokens) {
    for (const bg of bgTokens) {
      if (fg === bg) continue;
      const key = `${fg}|${bg}`;
      if (!usedPairings.has(key)) usedPairings.set(key, selector);
    }
  }
}

const known = new Set(PAIRS.map(([fg, bg]) => `${fg}|${bg}`));
for (const e of EXEMPT) known.add(`${e.fg}|${e.bg}`);

for (const [key, selector] of usedPairings) {
  if (!known.has(key)) {
    const [fg, bg] = key.split('|');
    failures.push(
      `coverage: "${fg}" on "${bg}" is used in CSS (selector \`${selector}\`) ` +
      `but is in neither PAIRS nor EXEMPT in scripts/check-contrast.mjs -- ` +
      `add it to PAIRS with a contrast floor, or to EXEMPT with a written reason.`
    );
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
