#!/usr/bin/env node
/**
 * Compile the site into one self-contained HTML file.
 *
 * Every image becomes a data: URI, and the separate privacy/terms pages are
 * folded in as :target-revealed sections so the footer links still resolve.
 * The result has no same-origin dependencies at all: it can be opened from
 * file://, emailed, or dropped on any host without a build step.
 *
 * The one remaining network reference is the Google Fonts stylesheet. It is
 * left external on purpose — the font files cannot be redistributed inline,
 * and the page degrades to the system sans if it is unavailable.
 */
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'Afri-Resources', 'site');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
               '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const read = f => fs.readFileSync(path.join(SITE, f), 'utf8');

/** Replace every img/… reference (src="…" and url('…')) with a data: URI. */
function inlineImages(html) {
  const seen = new Map();
  let bytes = 0;
  const toDataUri = rel => {
    if (seen.has(rel)) return seen.get(rel);
    const abs = path.join(SITE, rel);
    if (!fs.existsSync(abs)) throw new Error(`missing asset: ${rel}`);
    const ext = path.extname(rel).toLowerCase();
    const mime = MIME[ext];
    if (!mime) throw new Error(`unknown asset type: ${rel}`);
    const uri = `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
    bytes += fs.statSync(abs).size;
    seen.set(rel, uri);
    return uri;
  };

  html = html.replace(/(src|href)="(img\/[^"]+)"/g, (_, attr, rel) => `${attr}="${toDataUri(rel)}"`);
  html = html.replace(/url\((['"]?)(img\/[^)'"]+)\1\)/g, (_, q, rel) => `url(${toDataUri(rel)})`);

  const leftover = html.match(/["'(]img\//);
  if (leftover) throw new Error('an img/ reference survived inlining');
  return { html, count: seen.size, bytes };
}

/** Pull the <section>…</section> body out of a standalone legal page. */
function legalSection(file, id, title) {
  const src = read(file);
  const start = src.indexOf('<section');
  const end = src.lastIndexOf('</section>') + '</section>'.length;
  if (start < 0 || end < start) throw new Error(`could not extract a section from ${file}`);
  let sec = src.slice(start, end);
  // Standalone pages linked "back to site"; in the single file that is a no-op anchor.
  sec = sec.replace(/href="index\.html"/g, 'href="#home"');
  return `\n<!-- ${title.toUpperCase()} (revealed via #${id}) -->\n` +
         sec.replace('<section ', `<section class="legal" id="${id}" aria-label="${title}" `);
}

function build() {
  let html = read('index.html');

  // Legal pages become in-page targets rather than separate documents.
  html = html.replace('href="privacy.html"', 'href="#privacy"')
             .replace('href="terms.html"', 'href="#terms"');

  const legalCss = [
    '/* single-file build: legal pages fold in, shown only when linked */',
    '.legal { display:none; }',
    '.legal:target { display:block; }',
  ].join('\n');
  html = html.replace('</style>', legalCss + '\n</style>');

  // og:image can be neither inlined (crawlers reject data: URIs) nor left
  // relative (the standalone file may be hosted anywhere). Drop it and fall
  // back to a text-only card rather than advertising a broken image.
  html = html.replace(/\n?[ \t]*<meta property="og:image"[^>]*>/g, '')
             .replace('<meta name="twitter:card" content="summary_large_image">',
                      '<meta name="twitter:card" content="summary">');

  const legal = legalSection('privacy.html', 'privacy', 'Privacy Policy') +
                legalSection('terms.html', 'terms', 'Terms of Use');
  html = html.replace('<!-- FOOTER -->', legal + '\n\n<!-- FOOTER -->');

  const { html: out, count, bytes } = inlineImages(html);

  const banner = '<!-- Self-contained build. Regenerate with: npm run build:single -->\n';
  const final = out.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + banner.trim());

  const targets = [
    path.join(__dirname, '..', 'dist', 'afriresources.html'),
    path.join(__dirname, '..', 'afriresources-standalone.html'),
  ];
  for (const t of targets) {
    fs.mkdirSync(path.dirname(t), { recursive: true });
    fs.writeFileSync(t, final);
  }

  const kb = n => (n / 1024).toFixed(0) + ' KB';
  console.log(`inlined ${count} images (${kb(bytes)} raw)`);
  console.log(`single file: ${kb(Buffer.byteLength(final))}`);
  for (const t of targets) console.log('  wrote ' + path.relative(path.join(__dirname, '..'), t));
}

build();
