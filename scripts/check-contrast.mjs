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
