#!/usr/bin/env node
/**
 * Warn if afriresources-standalone.html no longer matches the site source.
 *
 * The single-file build needs devDependencies, so Vercel copies the committed
 * output rather than regenerating it. This makes drift visible instead of
 * silently shipping a stale page. It warns rather than fails, so an unrelated
 * deploy is never blocked by it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const file = path.join(ROOT, 'afriresources-standalone.html');

if (!fs.existsSync(file)) {
  console.warn('! afriresources-standalone.html is missing — run: npm run build:single');
  process.exit(0);
}

let expected;
try {
  ({ sourceHash: expected } = require('./build-single.js'));
  expected = expected();
} catch {
  // sharp absent (e.g. a production install) — nothing to compare against.
  process.exit(0);
}

const found = (fs.readFileSync(file, 'utf8').match(/<!-- source-hash: ([0-9a-f]+) -->/) || [])[1];
if (found !== expected) {
  console.warn('!'.repeat(72));
  console.warn('! afriresources-standalone.html is STALE — the site source changed since');
  console.warn('! it was generated. Regenerate and commit it:  npm run build:single');
  console.warn('!'.repeat(72));
}
