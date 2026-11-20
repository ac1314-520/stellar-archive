---
name: collectible-gallery
description: Use when designing, reviewing, or improving a collectible/gallery interface such as the Stellar Archive collection grid, series catalogue, framed plate cards, viewer, mobile filters, auto-scroll, or slideshow. Produces a calm black-and-gold museum presentation with clear metadata, high-resolution artwork, smooth recording-friendly motion, and a readable owner watermark.
---

# 藏品陈列 / Collectible Gallery

Apply this skill to a collection-heavy page that must feel like a quiet private
museum: black and warm gold, generous negative space, consistent archival
frames, clear hierarchy, and motion that is calm enough to record.

## 1. Read the room before changing it

1. Identify the actual content model: item, IP, series, character, independent
   code, owner, story, image, acquisition date.
2. Never invent or overwrite a real collectible's name, series, code, owner, or
   story. The image and the source filename are the authority.
3. Check the current layout at **1440×900** and **390×844** before editing.
4. Preserve existing data contracts (`id`, `no`, `code`, `seriesKey`,
   `series`, `collection`, `thumb`, `card`, `src`, `story`, `owner`).
5. If a page owns a personal image, keep the owner watermark in the **opening
   description**, not baked over the photograph.

## 2. Visual system

- Canvas: near-black `#050404` to `#0a0807`; warm champagne gold
  `#cda96d`, bright gold `#f2ddb0`, parchment `#f2e9dc`.
- Typography: a high-contrast serif for display and Chinese titles; a small
  tracked sans for labels. Use only two families.
- Borders: hairlines (0.5–1 px) at low alpha; never heavy outlines.
- Frames: one coherent archival mat + one hairline inner rule + small corner
  marks. Do not mix five competing frame styles.
- Surfaces: flat black / translucent black with a very soft warm glow. Avoid
  glassmorphism, neon, gradients with more than two stops, and colored cards.
- Images: 4:5 plates; keep the object large enough to read. Avoid double mats
  that shrink a figure below about 55% of the card width.
- Motion: 180–500 ms for UI; slow fades for artwork changes. Respect
  `prefers-reduced-motion`.

## 3. Layout rules

### Desktop

- Two-column composition: editorial header/sidebar + collection surface.
- Four cards per row is the maximum for this collection; five makes a series
  index dense and six destroys the object.
- Keep the filter rail to one primary series selector, one version block, and
  favourites. Long series names belong in a dropdown or a two-line label, not
  in a clipped button.
- Give the first row enough space for its captions. Do not let a fixed toolbar
  cover artwork.

### Mobile

- Two collection columns; 10–12 px horizontal gap, 18–20 px vertical gap.
- The header should be compact enough that the first row of art is visible
  within roughly one scroll.
- Put filters behind a clearly labelled **筛选** control. The default view
  should be art first, controls second.
- Hide per-card favourite stars unless active; use the viewer for favouriting
  on touch devices.
- Keep captions to series + title. Truncate series with an ellipsis, never the
  title.
- Reserve bottom space for a fixed recording/scroll control; do not let it
  permanently cover a card.

## 4. Interaction

- **Auto-scroll**: a fixed toggle near the top labelled “自动滚动”, with a
  pause state, a visible progress line, and about 3 seconds per card row.
  Preload covers, use transform-based progress, stop at the end and report it.
  Any real wheel/touch/pointer input pauses it.
- **Auto-slideshow**: viewer-level next-item rotation, about 7 seconds per
  item, with pause/resume, AUTO indicator, and manual arrows resetting the
  timer. Use it for recording; do not make the gallery itself jump items.
- **Home rounds**: show eight curated items per round; when those finish,
  advance to the next eight, never loop the same eight forever. Show the
  round index (e.g. `ROUND 02 / 11`).
- **Filters**: a series dropdown grouped by IP; changing it applies
  immediately and updates the visible count.
- **Viewer**: click/tap a plate to open; keep story, independent code, series,
  owner watermark, and favourite action visible.
- **Delete**: manually imported photos need a per-photo delete affordance and
  must still offer a separate clear-all. Confirm before deleting and keep all
  other imported photos.

## 5. Image and performance quality

- Serve WebP at 1200×1500 (viewer), 600×750 (cards), 300×375 (thumbs).
- Keep a stable cache-busting version on every image path.
- Lazy-load below-the-fold cards; preload only the first 6 home images.
- Never require WebGL for a collection grid.
- Preserve the independent code mapping when new photos are added; do not
  renumber existing items.

## 6. Acceptance checklist

- [ ] 1440 and 390 screenshots reviewed.
- [ ] All collection images load; no 404s; no demo art.
- [ ] Filter select applies and count updates.
- [ ] Auto-scroll starts, pauses, stops at the end, and stays available while
      scrolled.
- [ ] Auto-slideshow advances, pauses, resumes, and stops on close.
- [ ] Home advances to a genuinely different batch after eight items.
- [ ] Every item opens; story, code, owner watermark, and image are correct.
- [ ] Single-photo delete removes only that photo; clear-all still exists.
- [ ] Keyboard focus is visible; primary text has adequate contrast.
- [ ] Reduced motion does not trap the user in an endless animation.
