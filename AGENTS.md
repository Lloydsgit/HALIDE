# HALIDE — personal photo lab

Zero-dependency, fully client-side photo editor. Turns any photo into a **retro film**,
**digital-camera (Y2K digicam)**, **Y2K/2026**, **panoramic**, or **effects-lab** look,
then mounts it on a **custom pic card**.

## Run

No build step. Serve the static files:

```bash
python3 -m http.server 12000        # then open http://localhost:12000/
```

Everything renders on `<canvas>` in the browser. Photos are never uploaded; all
processing is local.

## Files

| File | Role |
|------|------|
| `index.html` | Shell: topbar, stage, control panel, hidden file input |
| `styles.css` | Darkroom theme (CSS vars, Fraunces + IBM Plex Mono + Caveat) |
| `effects.js` | Procedural effect engine — `window.HALIDE_EFFECTS` (63 effects) |
| `presets.js` | The preset library — `window.HALIDE_LIB` (536 presets, 8 collections) |
| `fonts.js` | Full Google Fonts catalogue — `window.HALIDE_FONTS` (1961 families) |
| `overlays.js` | Overlay library — `window.HALIDE_OVERLAYS` (87 overlays, 8 categories) |
| `app.js` | All logic: state, layout, render pipeline, cards, layers, UI, export |

Load order in `index.html` matters: `effects.js` → `presets.js` → `fonts.js` →
`overlays.js` → `app.js`.

## Preset library (`presets.js`)

Presets are authored from compact tuple tables and expanded at load time.

A grade tuple is `[ name, css, h, t, l, grain, vig, bloom, halo, haloTint, temp, fade, fx ]`:

- `css` — a `ctx.filter` string (saturation/contrast/sepia/grayscale/hue-rotate/…)
- `h` / `t` / `l` — highlight (screen) / midtone (overlay) / shadow (multiply) tint layers
- `grain` … `halo` — 0..1 hints; `vig` seeds the optics vignette, `bloom`/`halo` the glow
- `temp` / `fade` — warm shift and matte lift applied per-pixel
- `fx` — optional chain of `[effectName, params]` handled by `effects.js`

Collections: `film` (55), `digicam` (65), `pinterest` (73), `mood` (70),
`fx` (104), `duotone` (79), `pano` (30), `y2k` (60). Total **536**.

To add looks: append tuples to a `*_GRADES` array (or a pair table for duotones/tritones)
and call `grade(COLL, tuple)`. IDs are auto-slugged from the name.

## Effects engine (`effects.js`)

`window.HALIDE_EFFECTS` maps a name to `function(canvas, params) -> canvas`.
`window.applyEffects(canvas, chain)` runs a chain. Effects range from cheap pixel passes
(vignette, grain, dither, posterize, duotone/tritone) to full-canvas redraws
(halftone, riso, glitch, pixelsort, thermal, holographic, kaleidoscope, lensflare).

## Architecture (`app.js`)

- **Design units.** `computeLayout(ar, cardType)` returns geometry in units where the
  image long edge is 1000. `composeTo(canvas, longEdge, intensity)` then scales to real
  pixels, so the same code renders the preview and every export size.
- **Render pipeline** (`composeTo`): `drawCardFrame` → `buildFrame` (developed photo:
  `ctx.filter` → `applyToneCurve` → preset `fx` chain → highlight/midtone/shadow tints →
  texture) → `applyOptics` (bloom / halation / chromatic aberration / scanlines /
  vignette / grain / flash) → `drawDateStamp` → `drawCardOverlay`.
- **Intensity / compare.** `composeTo` takes an `intensity` (0..1); below 1 it cross-fades
  the styled frame over the untouched one. Hold-to-compare renders at 0.
- **Preset browser.** `buildGrid` renders the active collection/search/favourites into
  `#presetGrid`; thumbnails are drawn lazily via an `IntersectionObserver`.
- **Layers.** `state.layers` is an ordered list of text and overlay objects drawn on top
  of the finished card. Each layer stores position as a fraction of the frame (`x`,`y`)
  so it scales to every export size. `drawLayers` runs after `drawCardOverlay`.
  - Text layers use the full `HALIDE_FONTS` catalogue; `FONTS.load()` injects a
    `<link>` for the exact weight/italic axis and resolves once the face is ready.
  - Overlay layers reference an id from `HALIDE_OVERLAYS`. Most composite normally;
    entries flagged `mask:true` instead clip everything beneath them to their shape
    (`drawMaskLayer` snapshots the canvas, clears it, and re-draws with `destination-in`).
  - Drag on the stage moves the topmost layer under the pointer (`hitLayer`); arrow keys
    nudge the selected layer; Delete/Backspace removes it.
- **Cards.** `CARD_TYPES` drives the pills; each type has a `draw*` frame plus a
  `drawCardOverlay` branch when something sits above the photo.
- **Export.** `exportBlob()` re-renders at `SIZES` long edge (1024 / 2048 / 3200) and
  calls `toBlob` (PNG or JPG).

## Font library (`fonts.js`)

The full Google Fonts catalogue (families, not weights), stored as compact rows
`[ family, category, css2 query, wMin, wMax, hasItalic ]`. Nothing is fetched until a
family is picked — `HALIDE_FONTS.load(name, weight, italic)` builds a CSS2 URL for the
requested axis, injects it as a `<link>`, and resolves on `document.fonts.ready`.
Helpers: `get(name)`, `css(name, weight, italic)`, `isLoaded(name)`, `search(q)`.
Categories: Sans (723), Display (474), Serif (354), Handwriting (359), Mono (51).

## Overlay library (`overlays.js`)

`window.HALIDE_OVERLAYS` holds 87 overlays in 8 categories: Tape & Paper, Light,
Gradients, Stickers, Frames, Textures, Retro UI, Shapes. Each entry is
`{ id, name, cat, w?, h?, keep?, mask?, draw(c, w, h, o) }` where `w`/`h` set the
default aspect and `o` carries `{ seed, accent }`. `thumb(id, size)` returns a data URL
preview (drawn over a checkerboard so transparency reads).

To add an overlay, call `def(CAT, 'Name', drawFn, { w, h, keep })`. Pass `mask: true`
to make it clip the layers beneath it instead of compositing over them.

## Gotchas

- Adding a collection means adding its `grade` tables **and** it appears in `collNav`
  automatically from `HALIDE_LIB.collections`.
- Adding an effect means adding it to `HALIDE_EFFECTS`; the `TEXTURES` table in `app.js`
  picks the ones offered as one-tap texture pills.
- Presets sharing a `css` string are only distinct if their `h/t/l` tints differ — the
  tints are what separate most of the library, so never drop them.
- The preset grid thumbnails render from `state.sampleImg` (a procedurally drawn sunset,
  `makeSampleDataURL`), so the strip looks alive before any upload.
- `ctx.filter` support: modern Chrome/Firefox/Safari. The app degrades to un-filtered
  output elsewhere rather than breaking.
- Google Fonts is the one runtime network dependency: font `<link>`s load from
  `fonts.googleapis.com` only when a family is actually chosen. Everything else is local.
