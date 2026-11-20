# Agent notes

## Collection UI

Before changing the collection, catalogue, home exhibit, viewer, or mobile
gallery layout, read `.agents/skills/collectible-gallery/SKILL.md`. It contains
the visual system, mobile layout rules, recording controls, and acceptance
checklist for this archive.

## Useful facts

- Static GitHub Pages site; no build step for the page itself.
- Real collection is rebuilt with `python scripts/build_real_archive.py`.
- Keep existing independent numbers stable via `scripts/collection-numbering.json`.
- Owner watermark lives in the viewer introduction, never on the photograph.
- `node server.mjs` serves the site at `http://127.0.0.1:4173`.
