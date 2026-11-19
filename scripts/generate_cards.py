"""Create the 500 × 625 hero-card renditions from the full plate artwork.

The orbit shows a photograph at roughly 190 CSS px (up to 2× DPR), so a
500 px source stays sharp without paying for the 720 × 900 viewer asset
twenty-five times on first paint.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "assets" / "photos" / "full"
TARGET = ROOT / "assets" / "photos" / "card"
TARGET.mkdir(parents=True, exist_ok=True)

count = 0
for source in sorted(SOURCE.glob("*.webp")):
    if source.stem in {"cover"}:
        continue
    with Image.open(source) as image:
        rendered = image.convert("RGB").resize((500, 625), Image.Resampling.LANCZOS)
        rendered.save(TARGET / f"{source.stem}.webp", "WEBP", quality=82, method=6)
    count += 1

print(f"wrote {count} card plates to {TARGET}")
