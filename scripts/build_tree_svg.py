"""Generate the STELLAR ARCHIVE Christmas tree as a lightweight SVG.

The tree is intentionally a couture illustration, not a wireframe: nine
needle-fringed evergreen tiers, brushed gold rims, glass baubles and a warm
star. It is served as one cached SVG and layered in front of the photograph
orbit.
"""

from __future__ import annotations

import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "tree-noel.svg"
CX = 320
BASE_Y = 742
TOP_Y = 168
TIERS = 9
SEED = 271828


def lerp(a, b, t):
    return a + (b - a) * t


def tier_path(i, rng):
    t = i / (TIERS - 1)
    width = lerp(320, 48, math.pow(t, 0.82))
    y_top = lerp(536, 207, t)
    y_bottom = lerp(704, 300, t)
    height = y_bottom - y_top
    skew = rng.uniform(-8, 8)
    left_w = width * (0.93 + rng.uniform(-0.035, 0.035))
    right_w = width * (0.93 + rng.uniform(-0.035, 0.035))

    # Outer sweeping top edge, from the centre crown to the right tip.
    p = []
    p.append(f"M{CX:.1f},{y_top:.1f}")
    p.append(
        f"C{CX + right_w * .35:.1f},{y_top + height * .02:.1f} "
        f"{CX + right_w * .78:.1f},{y_top + height * .22:.1f} "
        f"{CX + right_w:.1f},{y_top + height * .48:.1f}"
    )
    p.append(
        f"C{CX + right_w * .98:.1f},{y_top + height * .56:.1f} "
        f"{CX + right_w * .96:.1f},{y_top + height * .61:.1f} "
        f"{CX + right_w * .90:.1f},{y_top + height * .64:.1f}"
    )

    # Fringed lower edge: pointed fir needles alternating with soft notches.
    count = 16
    for k in range(count + 1):
        f = 1 - 2 * k / count  # +1 right to -1 left
        w = right_w if f >= 0 else left_w
        x = CX + f * w
        outer = y_top + height * (0.55 + 0.13 * (1 - abs(f)))
        wave = math.sin((k + i) * 1.75) * 4.2
        if k % 2 == 0:
            y = outer + 16 + wave
            p.append(f"L{x:.1f},{y:.1f}")
        else:
            y = outer - 2 + wave * .45
            p.append(f"Q{x + (6 if f >= 0 else -6):.1f},{y - 5:.1f} {x:.1f},{y:.1f}")

    # Left edge back up to the crown.
    p.append(
        f"C{CX - left_w * .96:.1f},{y_top + height * .61:.1f} "
        f"{CX - left_w * .98:.1f},{y_top + height * .56:.1f} "
        f"{CX - left_w:.1f},{y_top + height * .48:.1f}"
    )
    p.append(
        f"C{CX - left_w * .78:.1f},{y_top + height * .22:.1f} "
        f"{CX - left_w * .35:.1f},{y_top + height * .02:.1f} "
        f"{CX:.1f},{y_top:.1f}Z"
    )
    return {
        "path": " ".join(p),
        "i": i,
        "t": t,
        "width": width,
        "left_w": left_w,
        "right_w": right_w,
        "y_top": y_top,
        "y_bottom": y_bottom,
        "height": height,
        "skew": skew,
        "count": count,
    }


def layer_rim(i, tier, rng):
    """A fine brushed-gold line hugging the upper contour of each tier."""
    w = tier["right_w"]
    y = tier["y_top"]
    h = tier["height"]
    return (
        f"M{CX - tier['left_w'] * .94:.1f},{y + h * .48:.1f} "
        f"C{CX - tier['left_w'] * .53:.1f},{y + h * .22:.1f} "
        f"{CX - 20:.1f},{y - h * .015:.1f} {CX:.1f},{y:.1f} "
        f"C{CX + 20:.1f},{y + h * .015:.1f} "
        f"{CX + w * .53:.1f},{y + h * .22:.1f} "
        f"{CX + w * .94:.1f},{y + h * .48:.1f}"
    )


def layer_veins(tier):
    """Subtle branch veins inside a tier, clipped with its own shape."""
    lines = []
    count = 9
    for k in range(count):
        f = -1 + 2 * (k + 0.5) / count
        w = tier["right_w"] if f >= 0 else tier["left_w"]
        tx = CX + f * w * 0.94
        ty = tier["y_top"] + tier["height"] * (0.66 - 0.12 * (1 - abs(f)))
        cx1 = CX + f * w * 0.18
        cy1 = tier["y_top"] + tier["height"] * 0.10
        cx2 = CX + f * w * 0.62
        cy2 = tier["y_top"] + tier["height"] * 0.53
        lines.append(
            f'M{CX},{tier["y_top"] + 3:.1f} C{cx1:.1f},{cy1:.1f} {cx2:.1f},{cy2:.1f} {tx:.1f},{ty:.1f}'
        )
    return " ".join(lines)


def main():
    rng = random.Random(SEED)
    tiers = [tier_path(i, rng) for i in range(TIERS)]

    parts = []
    parts.append(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 860" role="img" aria-label="星屿圣诞树">\n'
    )
    parts.append(
        """<defs>
  <linearGradient id="tierGold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#315f49"/>
    <stop offset=".34" stop-color="#1d4635"/>
    <stop offset=".72" stop-color="#102b21"/>
    <stop offset="1" stop-color="#081a13"/>
  </linearGradient>
  <linearGradient id="tierDeep" x1="0" y1="0" x2=".9" y2="1">
    <stop offset="0" stop-color="#224b39"/>
    <stop offset=".42" stop-color="#153527"/>
    <stop offset="1" stop-color="#07160f"/>
  </linearGradient>
  <linearGradient id="tierLight" x1=".1" y1="0" x2=".8" y2="1">
    <stop offset="0" stop-color="#3b7155"/>
    <stop offset=".35" stop-color="#214c39"/>
    <stop offset="1" stop-color="#0b2118"/>
  </linearGradient>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fff0d2"/>
    <stop offset=".26" stop-color="#e4c08e"/>
    <stop offset=".64" stop-color="#b88757"/>
    <stop offset="1" stop-color="#f1d1a4"/>
  </linearGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#f6dfb9" stop-opacity=".05"/>
    <stop offset=".28" stop-color="#f3d4a6" stop-opacity=".48"/>
    <stop offset=".72" stop-color="#efd0a1" stop-opacity=".26"/>
    <stop offset="1" stop-color="#d9b184" stop-opacity=".03"/>
  </linearGradient>
  <radialGradient id="halo" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#f7d6aa" stop-opacity=".3"/>
    <stop offset=".35" stop-color="#c99378" stop-opacity=".12"/>
    <stop offset="1" stop-color="#c99378" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="star" cx=".36" cy=".28" r=".8">
    <stop offset="0" stop-color="#fffaf0"/>
    <stop offset=".34" stop-color="#f8dfb8"/>
    <stop offset=".76" stop-color="#d9ae75"/>
    <stop offset="1" stop-color="#9f6e45"/>
  </radialGradient>
  <radialGradient id="baubleGold" cx=".32" cy=".25" r=".82">
    <stop offset="0" stop-color="#fff8e9"/>
    <stop offset=".3" stop-color="#e3be8e"/>
    <stop offset=".74" stop-color="#a57b50"/>
    <stop offset="1" stop-color="#5b3c27"/>
  </radialGradient>
  <radialGradient id="baubleRose" cx=".32" cy=".25" r=".82">
    <stop offset="0" stop-color="#fbe7e4"/>
    <stop offset=".3" stop-color="#d9a6a3"/>
    <stop offset=".74" stop-color="#965d63"/>
    <stop offset="1" stop-color="#502e3a"/>
  </radialGradient>
  <radialGradient id="baubleGreen" cx=".32" cy=".25" r=".82">
    <stop offset="0" stop-color="#f3fff5"/>
    <stop offset=".3" stop-color="#b9d8c1"/>
    <stop offset=".72" stop-color="#6b9c7d"/>
    <stop offset="1" stop-color="#315643"/>
  </radialGradient>
  <radialGradient id="light" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#fff9e8"/>
    <stop offset=".25" stop-color="#fbe2b8"/>
    <stop offset=".58" stop-color="#f3bf83" stop-opacity=".62"/>
    <stop offset="1" stop-color="#e7a66e" stop-opacity="0"/>
  </radialGradient>
  <filter id="treeShadow" x="-35%" y="-20%" width="170%" height="160%">
    <feDropShadow dx="0" dy="19" stdDeviation="16" flood-color="#010906" flood-opacity=".62"/>
  </filter>
  <filter id="starGlow" x="-140%" y="-140%" width="380%" height="380%">
    <feGaussianBlur stdDeviation="10" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="tinyGlow" x="-150%" y="-150%" width="400%" height="400%">
    <feGaussianBlur stdDeviation="5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>
"""
    )
    # background halo / stage light
    parts.append(f'<ellipse cx="{CX}" cy="340" rx="286" ry="300" fill="url(#halo)" opacity=".7"/>')
    parts.append(f'<ellipse cx="{CX}" cy="737" rx="212" ry="37" fill="url(#light)" opacity=".46"/>')
    parts.append(
        f'<ellipse cx="{CX}" cy="748" rx="161" ry="24" fill="#040e09" opacity=".9"/>'
    )
    parts.append(
        f'<ellipse cx="{CX}" cy="740" rx="142" ry="21" fill="#10261b"/>'
    )
    parts.append(
        f'<ellipse cx="{CX}" cy="735" rx="139" ry="19" fill="none" stroke="url(#gold)" stroke-opacity=".65" stroke-width="1.2"/>'
    )
    parts.append(
        f'<ellipse cx="{CX}" cy="728" rx="75" ry="9" fill="url(#light)" opacity=".52"/>'
    )

    parts.append('<g filter="url(#treeShadow)">')
    for tier in tiers:
        i = tier["i"]
        fill = ["url(#tierDeep)", "url(#tierGold)", "url(#tierLight)"][i % 3]
        cid = f"tierClip{i}"
        # A soft under-shadow slightly below the tier.
        parts.append(
            f'<path d="{tier["path"]}" fill="#020b07" opacity=".3" transform="translate(0 8)"/>'
        )
        parts.append(f'<clipPath id="{cid}"><path d="{tier["path"]}"/></clipPath>')
        parts.append(f'<path d="{tier["path"]}" fill="{fill}"/>')
        # Veins clipped to this tier.
        parts.append(
            f'<path d="{layer_veins(tier)}" fill="none" stroke="#d9b98b" stroke-opacity=".12" stroke-width="1" clip-path="url(#{cid})"/>'
        )
        # A cool top sheen to mimic translucent glass.
        parts.append(
            f'<path d="{tier["path"]}" fill="url(#rim)" opacity=".24" clip-path="url(#{cid})"/>'
        )
        parts.append(
            f'<path d="{layer_rim(i, tier, rng)}" fill="none" stroke="url(#rim)" stroke-width="1.25" stroke-linecap="round"/>'
        )
        # Tip needles catch a little more light.
        for k in range(0, tier["count"] + 1, 2):
            f = 1 - 2 * k / tier["count"]
            w = tier["right_w"] if f >= 0 else tier["left_w"]
            x = CX + f * w
            y = tier["y_top"] + tier["height"] * (0.66 + 0.02 * (1 - abs(f))) + math.sin((k + i) * 1.75) * 4.2
            parts.append(
                f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{1.2 if k % 4 == 0 else .75:.1f}" fill="#e8f1df" opacity="{.48 if k % 4 == 0 else .25}"/>'
            )

    parts.append("</g>")

    # Hanging glass baubles.
    baubles = [
        (202, 566, 17, "baubleGold"),
        (137, 623, 12, "baubleRose"),
        (456, 573, 14, "baubleGold"),
        (489, 630, 9, "baubleGreen"),
        (322, 496, 11, "baubleRose"),
        (383, 466, 8, "baubleGreen"),
        (249, 422, 7, "baubleGold"),
        (441, 394, 6, "baubleRose"),
    ]
    for x, y, r, grad in baubles:
        parts.append(
            f'<g class="bauble"><line x1="{x}" y1="{y - r * 2.7:.1f}" x2="{x}" y2="{y - r:.1f}" stroke="#e3c08e" stroke-opacity=".38"/><circle cx="{x}" cy="{y}" r="{r}" fill="url(#{grad})"/><ellipse cx="{x - r * .34:.1f}" cy="{y - r * .38:.1f}" rx="{r * .22:.1f}" ry="{r * .15:.1f}" fill="#fff9eb" opacity=".72"/></g>'
        )

    # Fairy-light constellation along the tiers.
    light_points = []
    light_rng = random.Random(SEED + 1)
    for tier in tiers:
        for k in range(8):
            f = light_rng.uniform(-0.9, 0.9)
            w = tier["right_w"] if f >= 0 else tier["left_w"]
            x = CX + f * w
            y = tier["y_top"] + tier["height"] * light_rng.uniform(0.28, 0.62)
            r = light_rng.uniform(1.2, 2.8)
            light_points.append((x, y, r))
    for x, y, r in light_points:
        parts.append(
            f'<circle class="light" cx="{x:.1f}" cy="{y:.1f}" r="{r * 3.4:.1f}" fill="url(#light)" opacity=".22"/>'
            f'<circle class="light" cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="#ffe8c3" opacity=".9"/>'
        )

    # Star topper, positioned above the top tier.
    star_y = 128
    parts.append(
        f'<g><circle cx="{CX}" cy="{star_y}" r="104" fill="url(#light)" opacity=".52"/>'
        f'<g class="star-rays" fill="#f6d8ad" opacity=".48">'
        f'<path d="M320 44 L327 104 L320 114 L313 104Z"/>'
        f'<path d="M320 212 L327 152 L320 142 L313 152Z"/>'
        f'<path d="M236 128 L296 135 L306 128 L296 121Z"/>'
        f'<path d="M404 128 L344 135 L334 128 L344 121Z"/>'
        f'<path d="M268 76 L306 114 L317 128 L303 122Z" opacity=".36"/>'
        f'<path d="M372 180 L334 142 L323 128 L337 134Z" opacity=".36"/>'
        f'<path d="M372 76 L334 114 L323 128 L337 122Z" opacity=".36"/>'
        f'<path d="M268 180 L306 142 L317 128 L303 134Z" opacity=".36"/>'
        f"</g>"
        f'<g class="star" filter="url(#starGlow)"><path fill="url(#star)" stroke="#fff2d5" stroke-opacity=".65" stroke-width="1.3" d="M320 78 L331 108 L362 113 L338 135 L345 166 L320 149 L295 166 L302 135 L278 113 L309 108Z"/></g>'
        f'<circle cx="320" cy="{star_y}" r="4.6" fill="#fff9ec" opacity=".95"/></g>'
    )

    parts.append("</svg>\n")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("".join(parts), encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
