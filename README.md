# Afri-Resources Website

Static marketing site for Afri-Resources. No framework, no runtime dependencies —
plain HTML with inline CSS/JS.

## Structure

```
Afri-Resources/
  site/            <- the deployable website
    index.html     <- the live page
    live.html      <- earlier alternate version of the page
    img/           <- photography and logo
  assets/          <- higher-resolution source images
  uploads/         <- design working files (not deployed)
  *.dc.html        <- design-canvas working files (not deployed)
```

Only `Afri-Resources/site/` is published. Everything else is working material.

## Local preview

```bash
npm run dev        # serves Afri-Resources/site on a local port
```

## Deploying to Vercel

The repo is configured for zero-config Vercel deploys via `vercel.json`:

- `buildCommand` copies `Afri-Resources/site/` into `dist/`
- `outputDirectory` is `dist/`
- `cleanUrls` is on, so `/index.html` serves at `/`

Import the repo in Vercel and keep **Root Directory** at the repository root —
`vercel.json` handles the rest. To verify the exact output Vercel will publish:

```bash
npm run build && ls -R dist
```
