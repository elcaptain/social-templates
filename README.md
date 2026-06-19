# Social Template Exporter

A zero-install, browser-based tool to edit the Home Assistant **Community Meetup** social
graphic and download a rendered PNG. Rebuilt from the Figma design
([file `61SfzG7xiYlR5YUheV82F9`](https://www.figma.com/design/61SfzG7xiYlR5YUheV82F9/Social-Media-Templates?node-id=1211-3576)).

## Use it

**Just open `index.html` in a browser** (double-click it). No server, no install, no internet.

Pick the **project logo** and **event date**, and edit **City** and **Organizer** in the left
panel — the green pill reflows and grows on one line as the copy changes, exactly like the
Figma auto-layout. Click **Download PNG** to save a 2160×2160 image
(`community-meetup_<city>.png`).

It works straight from `file://` because every asset (gradient, icon illustration, logos) and
the Figtree font are inlined as base64 data URIs — the page makes **no network requests**, so
nothing is blocked and the export canvas is never tainted.

## Project layout

```
index.html              Open this. The whole app.
js/
  assets.js             Generated — base64 data URIs for assets + Figtree fonts (do not edit).
  vendor/html-to-image.js  Vendored PNG rasterizer.
  templates.js          Template config (sizes, layers, editable fields).
  app.js                Generic renderer + editor + exporter.
assets-src/             Original assets kept for rebuilds (not loaded at runtime).
scripts/
  fetch-assets.sh       Pull assets from Figma + Figtree woff2.
  build-assets.mjs      Inline assets-src/* into js/assets.js.
```

## Rebuild assets (only when the Figma design changes)

Requires a Figma personal access token.

```bash
FIGMA_TOKEN=figd_xxx ./scripts/fetch-assets.sh   # or: ./scripts/fetch-assets.sh figd_xxx
node scripts/build-assets.mjs
```

`fetch-assets.sh` exports the illustration and both logos as SVG, the gradient as PNG
(cropped to the visible frame window), and downloads the Figtree 400/700 woff2.
`build-assets.mjs` then base64-inlines all of it into `js/assets.js`.

## Add another template

The renderer is config-driven — adding a template is a data change, not a code change. Add a
new entry to the `TEMPLATES` array in [`js/templates.js`](js/templates.js) describing its
size and layers (`image`, `text`, `row` for auto-layout rows; mark editable text with
`editable: true`, a `field` key, and a `default`). Add any new assets via the scripts above.
(The UI currently renders `TEMPLATES[0]`; wire up a template picker when a second one lands.)
