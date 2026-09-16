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
