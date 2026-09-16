import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const failures = [];
const check = (label, cond) => { if (!cond) failures.push(label); };

const DIST = 'dist';
const indexPath = `${DIST}/index.html`;

// Reads a PNG's intrinsic width/height straight from its IHDR chunk: bytes
// 0-7 are the PNG signature, 8-11 the IHDR chunk length, 12-15 the chunk
// type ("IHDR"), then width and height as big-endian uint32s at offsets
// 16 and 20. No image library needed.
function pngDimensions(path) {
  const buf = readFileSync(path);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function walkFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(p));
    else out.push(p);
  }
  return out;
}

check('dist/index.html exists', existsSync(indexPath));
if (existsSync(indexPath)) {
  const html = readFileSync(indexPath, 'utf8');
  check('no <script> tag (zero client JS)', !/<script[\s>]/i.test(html));
  check('has a lang attribute', /<html[^>]+lang=/i.test(html));
  check('has a title', /<title>[^<]+<\/title>/i.test(html));
  check('has a meta description', /name="description"/i.test(html));
  check('does not claim open source', !/open[\s-]?source/i.test(html));
  check('no crisis hotline number', !/\b988\b|suicide|crisis line/i.test(html));
  check('single h1', (html.match(/<h1[\s>]/gi) || []).length === 1);
  check('not-treatment framing is in the visible copy',
    /class="hero-claim"[^>]*>[^<]*not treatment/i.test(html));
  check('discloses server-side readability',
    /not end-to-end/i.test(html) && /entries on the server are readable/i.test(html));
  check('states it is not distributed yet', /not .{0,30}available|not .{0,30}distributed/i.test(html));
  check('no contact email', !/mailto:/i.test(html));
  const phoneCount = (html.match(/class="phone"/g) || []).length;
  check('mockup frames are hidden from assistive tech',
    phoneCount > 0 &&
    phoneCount === (html.match(/aria-hidden="true"/g) || []).length);
  check('three mockups present', (html.match(/class="mockup"/g) || []).length === 3);

  // Positive assertions -- these guard the four plan-originated defects
  // that had no automated check (a fifth, the pale-on-dark logo defect, is
  // guarded separately in scripts/prepare-images.py). A regression here
  // would otherwise ship green.
  check('exactly 11 privacy-item elements',
    (html.match(/class="privacy-item"/g) || []).length === 11);

  check('canonical href is exactly https://bpdtools.cloud/',
    /<link[^>]*rel="canonical"[^>]*href="https:\/\/bpdtools\.cloud\/"[^>]*\/?>/i.test(html));

  check('og:url content is exactly https://bpdtools.cloud/',
    /<meta[^>]*property="og:url"[^>]*content="https:\/\/bpdtools\.cloud\/"[^>]*\/?>/i.test(html));

  const heroImgMatch = html.match(/<img[^>]*class="hero-logo"[^>]*>/i);
  check('hero <img> tag exists', !!heroImgMatch);
  if (heroImgMatch) {
    const tag = heroImgMatch[0];
    const w = tag.match(/\bwidth="(\d+)"/);
    const h = tag.match(/\bheight="(\d+)"/);
    check('hero <img> has width and height attributes', !!w && !!h);
    if (w && h && existsSync('public/logo.png')) {
      const { width, height } = pngDimensions('public/logo.png');
      check(
        `hero <img> width/height (${w[1]}x${h[1]}) match public/logo.png intrinsic size (${width}x${height})`,
        Number(w[1]) === width && Number(h[1]) === height,
      );
    }
  }
}

check('dist/CNAME exists', existsSync(`${DIST}/CNAME`));
if (existsSync(`${DIST}/CNAME`)) {
  check('CNAME is bpdtools.cloud',
    readFileSync(`${DIST}/CNAME`, 'utf8').trim() === 'bpdtools.cloud');
}

// F1 guard: public/ is copied into dist/ verbatim by Astro, so nothing
// under public/ is safe just because check-build greps index.html. This
// caught a shipped 368KB uncropped logo original carrying the forbidden
// "Open Source Tools for BPD Management" tagline -- 55% of the entire
// payload, referenced by nothing. It must never come back.
if (existsSync(DIST)) {
  const distFiles = walkFiles(DIST);

  const originalNamed = distFiles.filter((f) => /original/i.test(f));
  check(
    `no file under dist/ has a name containing "original"${originalNamed.length ? ` (found: ${originalNamed.join(', ')})` : ''}`,
    originalNamed.length === 0,
  );

  const MAX_PNG_BYTES = 200 * 1024; // largest legitimate asset is og-card.png at ~132KB
  const bigPngs = distFiles.filter(
    (f) => f.toLowerCase().endsWith('.png') && statSync(f).size > MAX_PNG_BYTES,
  );
  check(
    `no PNG under dist/ exceeds 200KB${bigPngs.length ? ` (found: ${bigPngs.map((f) => `${f} (${statSync(f).size}B)`).join(', ')})` : ''}`,
    bigPngs.length === 0,
  );
}

if (failures.length) {
  console.error('check-build FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('check-build passed');
