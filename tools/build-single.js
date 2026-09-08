#!/usr/bin/env node
/**
 * Compile the site into one self-contained HTML file.
 *
 * Every image is transcoded to WebP and embedded as a data: URI, and the
 * separate privacy/terms pages are folded in as :target-revealed sections so
 * the footer links still resolve. The result has no same-origin dependencies:
 * it can be opened from file://, emailed, or dropped on any host.
 *
 * WebP roughly halves the payload against the source JPEGs at a quality that
 * is indistinguishable at 1:1 — the photography is dark and low-saturation,
 * and the page renders it through grayscale/contrast filters anyway. That
 * matters here because base64 of already-compressed image data barely gzips,
 * so the file size is very close to the bytes a phone actually downloads.
 *
 * CSS background references get their own, much smaller variant. Every
 * background on this site is a backdrop sitting behind a near-opaque gradient
 * at reduced opacity or brightness, so it carries far less visible detail than
 * the same photograph shown in an <img>. coal.jpg is used both ways, and
 * treating the two uses identically embedded it twice at full weight.
 *
 * The one remaining network reference is the Google Fonts stylesheet. It is
 * left external on purpose — the font files cannot be redistributed inline,
 * and the page degrades to the system sans if it is unavailable.
 *
 * Requires devDependencies (sharp). Vercel does not run this: `npm run build`
 * copies the committed output instead, so the deploy stays dependency-free.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, 'Afri-Resources', 'site');
const WEBP_QUALITY = 78;
// Backdrops: rendered behind a gradient at 0.32 opacity or 0.5 brightness.
const BACKDROP_QUALITY = 54;
const BACKDROP_MAX_WIDTH = 480;

const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');
const kb = n => (n / 1024).toFixed(0) + ' KB';

/** Hash of every input the output depends on, so drift is detectable. */
function sourceHash() {
  const h = crypto.createHash('sha256');
  for (const f of ['index.html', 'privacy.html', 'terms.html'])
    h.update(fs.readFileSync(path.join(SITE, f)));
  for (const f of fs.readdirSync(path.join(SITE, 'img')).sort())
    h.update(f).update(fs.readFileSync(path.join(SITE, 'img', f)));
  h.update('q' + WEBP_QUALITY + '/b' + BACKDROP_QUALITY + 'x' + BACKDROP_MAX_WIDTH);
  return h.digest('hex').slice(0, 16);
}

/** Replace every img/… reference (src/href="…" and url('…')) with a WebP data: URI. */
async function encode(rel, backdrop) {
  const abs = path.join(SITE, rel);
  if (!fs.existsSync(abs)) throw new Error(`missing asset: ${rel}`);
  // Alpha must survive for the logo and favicon; sharp keeps it in WebP.
  let pipe = sharp(abs);
  if (backdrop) pipe = pipe.resize({ width: BACKDROP_MAX_WIDTH, withoutEnlargement: true });
  const buf = await pipe.webp({
    quality: backdrop ? BACKDROP_QUALITY : WEBP_QUALITY, effort: 6,
  }).toBuffer();
  return buf;
}

async function inlineImages(html) {
  const inImg = new Set();   // <img src> / <link href>  — full quality
  const inCss = new Set();   // url(...) backdrops       — reduced
  for (const m of html.matchAll(/(?:src|href)="(img\/[^"]+)"/g)) inImg.add(m[1]);
  for (const m of html.matchAll(/url\((['"]?)(img\/[^)'"]+)\1\)/g)) inCss.add(m[2]);

  const stats = [];
  const imgUris = new Map(), cssUris = new Map();
  for (const rel of inImg) {
    const buf = await encode(rel, false);
    imgUris.set(rel, `data:image/webp;base64,${buf.toString('base64')}`);
    stats.push({ rel, kind: 'img', src: fs.statSync(path.join(SITE, rel)).size, out: buf.length });
  }
  for (const rel of inCss) {
    const buf = await encode(rel, true);
    cssUris.set(rel, `data:image/webp;base64,${buf.toString('base64')}`);
    stats.push({ rel, kind: 'bg', src: fs.statSync(path.join(SITE, rel)).size, out: buf.length });
  }

  html = html.replace(/(src|href)="(img\/[^"]+)"/g, (_, a, rel) => `${a}="${imgUris.get(rel)}"`);
  html = html.replace(/url\((['"]?)(img\/[^)'"]+)\1\)/g, (_, q, rel) => `url(${cssUris.get(rel)})`);

  if (/["'(]img\//.test(html)) throw new Error('an img/ reference survived inlining');
  return { html, stats };
}

/** Pull the <section>…</section> body out of a standalone legal page. */
function legalSection(file, id, title) {
  const src = read(file);
  const start = src.indexOf('<section');
  const end = src.lastIndexOf('</section>') + '</section>'.length;
  if (start < 0 || end < start) throw new Error(`could not extract a section from ${file}`);
  const sec = src.slice(start, end).replace(/href="index\.html"/g, 'href="#home"');
  return `\n<!-- ${title.toUpperCase()} (revealed via #${id}) -->\n` +
         sec.replace('<section ', `<section class="legal" id="${id}" aria-label="${title}" `);
}

async function build() {
  let html = read('index.html');

  html = html.replace('href="privacy.html"', 'href="#privacy"')
             .replace('href="terms.html"', 'href="#terms"');

  html = html.replace('</style>', [
    '/* single-file build: legal pages fold in, shown only when linked */',
    '.legal { display:none; }',
    '.legal:target { display:block; }',
    '</style>',
  ].join('\n'));

  // og:image can be neither inlined (crawlers reject data: URIs) nor left
  // relative (the standalone file may be hosted anywhere). Drop it and fall
  // back to a text-only card rather than advertising a broken image.
  html = html.replace(/\n?[ \t]*<meta property="og:image"[^>]*>/g, '')
             .replace('<meta name="twitter:card" content="summary_large_image">',
                      '<meta name="twitter:card" content="summary">');

  html = html.replace('<!-- FOOTER -->',
    legalSection('privacy.html', 'privacy', 'Privacy Policy') +
    legalSection('terms.html', 'terms', 'Terms of Use') + '\n\n<!-- FOOTER -->');

  const { html: out, stats } = await inlineImages(html);

  const hash = sourceHash();
  const final = out.replace('<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- Self-contained build. Regenerate with: npm run build:single -->' +
    `\n<!-- source-hash: ${hash} -->`);

  for (const t of [path.join(ROOT, 'dist', 'afriresources.html'),
                   path.join(ROOT, 'afriresources-standalone.html')]) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, final);
    console.log('  wrote ' + path.relative(ROOT, t));
  }

  for (const st of stats)
    console.log(`  ${st.rel.replace('img/', '').padEnd(16)} ${st.kind.padEnd(4)} ` +
                `${kb(st.src).padStart(7)} -> ${kb(st.out).padStart(7)}`);
  const out_ = stats.reduce((a, s2) => a + s2.out, 0);
  console.log(`${stats.length} embeds, ${kb(out_)} of image data`);
  console.log(`single file: ${kb(Buffer.byteLength(final))}`);
}

if (require.main === module) build().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { sourceHash };
