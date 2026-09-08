# Afri-Resources Website

Static marketing site for Afri-Resources. No framework, no runtime dependencies —
plain HTML with inline CSS/JS.

## Structure

```
Afri-Resources/
  site/            <- the deployable website
    index.html     <- the live page
    privacy.html   <- placeholder, needs legal review
    terms.html     <- placeholder, needs legal review
    live.html      <- earlier alternate version of the page
    img/           <- photography and logo
  assets/          <- higher-resolution source images
  uploads/         <- design working files (not deployed)
  *.dc.html        <- design-canvas working files (not deployed)
tools/
  build-single.js     <- compiles the site into afriresources-standalone.html
  check-standalone.js <- warns if that file has drifted from the source
```

Only `Afri-Resources/site/` is published. Everything else is working material.

## Local preview

```bash
npm run dev        # serves Afri-Resources/site on a local port
```

## Single-file build

`afriresources-standalone.html` is the whole site compiled into one file: every
image inlined as a `data:` URI, and the privacy and terms pages folded in as
sections that appear when linked. It has no same-origin dependencies, so it can
be opened straight from disk, emailed, or dropped on any host — no build step,
no directory structure, no DNS setup.

```bash
npm run build:single    # regenerate after any change to Afri-Resources/site/
```

It is ~563 KB. Images are transcoded to WebP, and CSS backgrounds get a
separate, much smaller variant — every background on the site sits behind a
near-opaque gradient at reduced opacity or brightness, so it carries far less
visible detail than the same photograph shown in an `<img>`. This matters
because base64 of compressed image data barely gzips, so the file size is close
to the bytes a phone actually downloads.

Regenerating needs devDependencies (`sharp`), so **the Vercel build does not run
it** — `npm run build` copies the committed file instead, keeping the deploy
dependency-free. `npm run build` does check whether the committed file still
matches the site source and prints a loud warning if it has gone stale.

The only network reference left in it is the Google Fonts stylesheet, which
cannot be inlined for licensing reasons. Without a connection the page falls
back to the system sans and everything else still works.

## Deploying to Vercel

The repo is configured for zero-config Vercel deploys via `vercel.json`:

- `buildCommand` copies `Afri-Resources/site/` into `dist/` plus the standalone file
- `outputDirectory` is `dist/`
- `cleanUrls` is on, so `/index.html` serves at `/`

Import the repo in Vercel and keep **Root Directory** at the repository root —
`vercel.json` handles the rest. To verify the exact output Vercel will publish:

```bash
npm run build && ls -R dist
```
