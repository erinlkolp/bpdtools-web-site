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
