# HALIDE — personal photo lab

A zero-dependency, fully client-side photo editor. Drop in any photo and turn it into a
**retro film**, **digital camera (Y2K digicam)**, **Y2K/2026**, **panoramic**, or
**effects-lab** look — then mount it on a **custom pic card**, add **text** in any of
1,961 Google Fonts, and stack **overlays** (tape, light leaks, stickers, frames, textures,
retro UI, gradients, masks).

Nothing is uploaded. Every pixel is processed locally in the browser on `<canvas>`.

## Run

No build step. Serve the static files and open the page:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

## Features

- **3+ camera modes** — Film (retro), Digicam, Y2K, Pano (digital panorama), and FX.
- **536 looks** across 8 collections: film, digicam, pinterest, mood, fx, duotone,
  pano, y2k.
- **Optics engine** — vignette, grain, bloom, halation, chromatic aberration, scanlines,
  temperature, fade, flash, date stamp, LCD scanlines.
- **Text tool** — add, drag, rotate, and style text. Outline, shadow, glow, tracking,
  line height, blend modes, backing plate, alignment. Pick from the **full Google Fonts
  catalogue (1,961 families)**; faces load on demand.
- **Overlays** — 87 ready-made overlays in 8 categories. Drag them anywhere, scale,
  rotate, flip, and blend. Mask-type overlays clip the card to a shape.
- **8 card frames** — polaroid, print, film, digicam, pano, filmstrip, museum, none.
- **Aspect / fit / export** — auto or fixed ratios, fill or fit, PNG/JPG at up to 3200px
  on the long edge. Copy straight to the clipboard.

## Files

| File | Role |
|------|------|
| `index.html` | Shell: topbar, stage, control panel, font modal, hidden file input |
| `styles.css` | Darkroom theme (CSS vars, Fraunces + IBM Plex Mono + Caveat) |
| `effects.js` | Procedural effect engine — `window.HALIDE_EFFECTS` (63 effects) |
| `presets.js` | The preset library — `window.HALIDE_LIB` (536 presets, 8 collections) |
| `fonts.js` | Full Google Fonts catalogue — `window.HALIDE_FONTS` (1,961 families) |
| `overlays.js` | Overlay library — `window.HALIDE_OVERLAYS` (87 overlays, 8 categories) |
| `app.js` | All logic: state, layout, render pipeline, cards, layers, UI, export |

Load order matters: `effects.js` → `presets.js` → `fonts.js` → `overlays.js` → `app.js`.

See `AGENTS.md` for architecture notes and how to extend the libraries.

## Notes

- Google Fonts is the only runtime network dependency, and font `<link>`s are only
  requested when a family is actually chosen.
- `ctx.filter` needs a modern Chrome/Firefox/Safari; elsewhere the app degrades to
  un-filtered output rather than breaking.
