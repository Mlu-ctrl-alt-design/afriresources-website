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
tools/
  build-single.js  <- compiles the site into afriresources-standalone.html
  *.dc.html        <- design-canvas working files (not deployed)
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
npm run build:single    # regenerate it (also runs as part of npm run build)
```

Regenerate it after any change to `Afri-Resources/site/`, or the two will drift.

The only network reference left in it is the Google Fonts stylesheet, which
cannot be inlined for licensing reasons. Without a connection the page falls
back to the system sans and everything else still works.

## Deploying to Vercel

The repo is configured for zero-config Vercel deploys via `vercel.json`:

- `buildCommand` copies `Afri-Resources/site/` into `dist/` and builds the single file
- `outputDirectory` is `dist/`
- `cleanUrls` is on, so `/index.html` serves at `/`

Import the repo in Vercel and keep **Root Directory** at the repository root —
`vercel.json` handles the rest. To verify the exact output Vercel will publish:

```bash
npm run build && ls -R dist
```
