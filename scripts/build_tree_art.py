"""Render a painterly evergreen for the STELLAR ARCHIVE salon.

Rather than stacking flat vector tiers, this paints the tree from thousands of
fine needle strokes: a dark conical core, irregular boughs, a warm left rim,
fairy lights and glass baubles. The result is one static WebP with alpha so it
stays smooth in front of the photograph orbit.

    python scripts/build_tree_art.py
"""

from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "tree-noel.webp"
PREVIEW = ROOT / ".tree-preview.png"

SS = 2
FW, FH = 1200, 1700
W, H = FW * SS, FH * SS
CX = W // 2
TOP = 230 * SS
BASE = 1540 * SS
R_BASE = 392 * SS
Y_STAR = 164 * SS

RNG = random.Random(20261224)


def c(color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = color.lstrip("#")
    return (int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16), alpha)


def radius_at(v):
    if isinstance(v, np.ndarray):
        vv = np.clip(v, 0.0, 1.0)
    else:
        vv = max(0.0, min(1.0, float(v)))
    return R_BASE * (0.035 + 0.965 * (vv ** 0.82))


def make_core() -> Image.Image:
    """A soft, dark forest core with a left rim and slight tier modulation."""
    yy, xx = np.mgrid[0:H, 0:W]
    v = (yy - TOP) / (BASE - TOP)
    vc = np.clip(v, 0, 1)
    r = radius_at(vc)
    noise = (
        0.035 * np.sin(v * 58.0 + 0.8)
        + 0.025 * np.sin(v * 131.0 + 2.4)
        + 0.018 * np.sin(v * 293.0 + 0.2)
    )
    edge = r * (0.93 + noise)
    inside = (v >= 0) & (v <= 1) & (np.abs(xx - CX) < edge)
    # soften the silhouette a little
    alpha = inside.astype(np.float32)
    from PIL import Image as PImage
    alpha_img = PImage.fromarray((alpha * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(3.2 * SS))
    alpha_arr = np.asarray(alpha_img).astype(np.float32) / 255.0

    # Base vertical gradient: deep blue-green at the top, forest at the bottom.
    top_col = np.array([5, 15, 10], dtype=np.float32)
    mid_col = np.array([9, 30, 19], dtype=np.float32)
    low_col = np.array([10, 34, 21], dtype=np.float32)
    t = np.clip((yy - TOP) / (BASE - TOP), 0, 1)
    grad = (
        top_col[None, None, :] * (1 - t[:, :, None])
        + mid_col[None, None, :] * (0.6 * t[:, :, None])
        + low_col[None, None, :] * (0.4 * t[:, :, None])
    )

    # The left side catches a little cool moonlight; the right falls into shadow.
    x_norm = np.clip((xx - (CX - r)) / np.maximum(2 * r, 1), 0, 1)
    left_light = np.clip(1.0 - x_norm * 1.65, 0, 1) * 0.16
    right_shadow = np.clip(x_norm * 1.2 - 0.35, 0, 1) * 0.28
    grad = grad * (1.0 + left_light[:, :, None]) * (1.0 - right_shadow[:, :, None])

    rgba = np.zeros((H, W, 4), dtype=np.uint8)
    rgba[:, :, :3] = np.clip(grad, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.clip(alpha_arr * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def branch_points(x0: float, y0: float, x1: float, y1: float, n: int = 14):
    """Quadratic droop curve from the trunk out to a branch tip."""
    cx = x0 + (x1 - x0) * 0.42
    cy = y0 + (y1 - y0) * 0.10
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1
        y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1
        pts.append((x, y))
    return pts


def draw_needles(draw, x, y, direction, count, length, palette, rng, width_max=2):
    for _ in range(count):
        a = direction + rng.uniform(-1.18, 1.18)
        if rng.random() < 0.22:
            a += math.radians(rng.uniform(8, 32))
        ln = length * rng.uniform(0.35, 1.0)
        x2 = x + math.cos(a) * ln
        y2 = y + math.sin(a) * ln
        col = palette[rng.randrange(len(palette))]
        w = rng.choice((1, 1, 2, 2, width_max))
        draw.line((x, y, x2, y2), fill=col, width=w)


def draw_branch(draw, x0, y0, x1, y1, palette, rng, back=True):
    pts = branch_points(x0, y0, x1, y1, 16)
    # stem
    stem_col = palette[0] if back else palette[min(1, len(palette) - 1)]
    draw.line(pts, fill=stem_col, width=2 if back else 3)
    # primary clusters
    for i in range(1, len(pts) - 1):
        if i % 1 == 0:
            x, y = pts[i]
            prevx, prevy = pts[i - 1]
            direction = math.atan2(y - prevy, x - prevx)
            # side sweeps and downward needles
            count = 7 if back else 10
            length = (10 if back else 15) * SS * (0.8 + 0.4 * math.sin(i * 1.7))
            draw_needles(draw, x, y, direction, count, length, palette, rng)
            draw_needles(draw, x, y, direction + 1.25, count // 2, length * 0.85, palette, rng)
            draw_needles(draw, x, y, direction - 1.25, count // 2, length * 0.8, palette, rng)
    # tip tuft
    xt, yt = pts[-1]
    direction = math.atan2(y1 - pts[-2][1], x1 - pts[-2][0])
    draw_needles(draw, xt, yt, direction, 18 if not back else 10, 22 * SS, palette, rng, 3)


def add_branches(base: Image.Image) -> None:
    rng = random.Random(7781)
    back_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mid_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    front_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    db, dm, df = ImageDraw.Draw(back_layer), ImageDraw.Draw(mid_layer), ImageDraw.Draw(front_layer)

    back_palette = [
        c("#040e09", 235), c("#07140d", 230), c("#0a1c12", 230),
        c("#0d2417", 220), c("#112d1c", 210),
    ]
    mid_palette = [
        c("#081a10", 240), c("#0c2416", 235), c("#11301d", 230),
        c("#183c27", 220), c("#215132", 205), c("#2a5d3a", 190),
    ]
    light_palette = [
        c("#224b31", 190), c("#326742", 175), c("#4d8052", 145),
        c("#71946a", 115), c("#a3a477", 80),
    ]

    # A veil of needles across the whole core keeps it from reading as a flat
    # dark cone and breaks up the horizontal rhythm of the boughs.
    surface = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ds = ImageDraw.Draw(surface)
    surface_rng = random.Random(3391)
    for _ in range(760):
        v = surface_rng.uniform(0.035, 0.97)
        width = radius_at(v)
        x = CX + surface_rng.uniform(-0.92, 0.92) * width
        y = TOP + v * (BASE - TOP)
        angle = surface_rng.uniform(0, math.tau)
        draw_needles(
            ds, x, y, angle,
            surface_rng.randrange(4, 11),
            (12 + 17 * v) * SS,
            back_palette + mid_palette,
            surface_rng,
            2,
        )
    base.alpha_composite(surface.filter(ImageFilter.GaussianBlur(0.5 * SS)))

    # A smaller back fan creates the feathered dark silhouette.
    for tier in range(16):
        v = 0.055 + tier / 16 * 0.92
        y = TOP + (BASE - TOP) * v + rng.uniform(-11, 11) * SS
        width = radius_at(v)
        for side in (-1, 1):
            for j in range(2):
                start_x = CX + side * rng.uniform(0.01, 0.18) * width
                length = width * rng.uniform(0.58, 0.97)
                droop = (14 + 42 * v) * SS * rng.uniform(0.65, 1.15)
                x1 = CX + side * length
                y1 = y + droop
                draw_branch(db, start_x, y, x1, y1, back_palette, rng, back=True)

    # The main boughs, layered by height so lower branches overlap the upper ones.
    for tier in range(19):
        v = 0.035 + tier / 19 * 0.95
        y = TOP + (BASE - TOP) * v + rng.uniform(-14, 14) * SS
        width = radius_at(v)
        for side in (-1, 1):
            for j in range(3):
                start_x = CX + side * rng.uniform(0.01, 0.26) * width
                length = width * rng.uniform(0.5, 1.04)
                droop = (18 + 52 * v) * SS * rng.uniform(0.6, 1.2)
                x1 = CX + side * length
                y1 = y + droop
                draw_branch(dm, start_x, y, x1, y1, mid_palette, rng, back=False)
                # a few champagne-lit needle tips on the left edge and front boughs
                if tier > 2 and rng.random() < 0.52:
                    draw_needles(
                        df, x1, y1,
                        math.atan2(droop, side * length),
                        10, 22 * SS, light_palette, rng, 2,
                    )
                if side < 0 and rng.random() < 0.3:
                    draw_needles(
                        df, x1 - 4 * SS, y1 - 6 * SS,
                        math.radians(rng.uniform(155, 215)),
                        6, 16 * SS, light_palette, rng, 2,
                    )

    base.alpha_composite(back_layer.filter(ImageFilter.GaussianBlur(1.2 * SS)))
    base.alpha_composite(mid_layer)
    base.alpha_composite(front_layer)


def draw_hidden_trunk(base: Image.Image) -> None:
    """No visible plank; the lower boughs close over the trunk."""
    return


def bauble(base: Image.Image, x: float, y: float, radius: float, colors, string_top: float) -> None:
    d = ImageDraw.Draw(base)
    # wire
    d.line((x, string_top, x, y - radius * 1.2), fill=c("#d8b782", 110), width=2)
    # soft halo
    halo = Image.new("RGBA", (int(radius * 5), int(radius * 5)), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse((0, 0, halo.width, halo.height), fill=(220, 166, 105, 22))
    halo = halo.filter(ImageFilter.GaussianBlur(radius * 0.8))
    base.alpha_composite(halo, (int(x - halo.width / 2), int(y - halo.height / 2)))
    # body in three passes for a glassy gradient
    d.ellipse((x - radius, y - radius, x + radius, y + radius), fill=colors[0])
    d.ellipse((x - radius * 0.82, y - radius * 0.88, x + radius * 0.55, y + radius * 0.55), fill=colors[1])
    d.ellipse((x - radius * 0.62, y - radius * 0.7, x + radius * 0.12, y + radius * 0.05), fill=colors[2])
    d.ellipse((x - radius * 0.52, y - radius * 0.68, x - radius * 0.18, y - radius * 0.35), fill=(255, 247, 226, 115))
    # rim shadow
    d.arc((x - radius, y - radius, x + radius, y + radius), 12, 170, fill=c("#0a1710", 130), width=max(1, int(radius * 0.12)))
    # cap
    d.rectangle((x - radius * 0.2, y - radius * 1.28, x + radius * 0.2, y - radius * 0.95), fill=c("#c09a63", 220))
    d.ellipse((x - radius * 0.23, y - radius * 1.35, x + radius * 0.23, y - radius * 1.17), fill=c("#e6c795", 220))


def draw_ornaments(base: Image.Image) -> None:
    rng = random.Random(1009)
    spots = [
        (0.21, 0.37, 19), (0.78, 0.31, 13), (0.16, 0.54, 24),
        (0.58, 0.48, 17), (0.86, 0.57, 12), (0.34, 0.62, 15),
        (0.68, 0.68, 26), (0.13, 0.77, 18), (0.44, 0.78, 20),
        (0.84, 0.82, 15), (0.73, 0.88, 12), (0.27, 0.9, 13),
    ]
    for xf, yf, rr in spots:
        v = (yf - 0.0)
        width = radius_at((yf * (BASE - TOP) + TOP - TOP) / (BASE - TOP))
        x = CX + (xf - 0.5) * 2 * width * 0.8
        y = TOP + yf * (BASE - TOP)
        # choose palette by slot
        choice = rng.randrange(3)
        if choice == 0:
            cols = (c("#7a4b24"), c("#d1a269"), c("#f4dcb2"))
        elif choice == 1:
            cols = (c("#481521"), c("#8d3042"), c("#e7a0a0"))
        else:
            cols = (c("#15362b"), c("#4b7961"), c("#d9d5ab"))
        bauble(base, x, y, rr * SS, cols, y - 48 * SS)


def draw_lights(base: Image.Image) -> None:
    rng = random.Random(2211)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    points = []
    for _ in range(54):
        v = rng.uniform(0.075, 0.94)
        width = radius_at(v)
        # keep lights within the branches, with a bias to the left/center
        x = CX + rng.uniform(-0.78, 0.78) * width
        y = TOP + v * (BASE - TOP) + rng.uniform(-16, 22) * SS
        rad = rng.uniform(1.4, 4.6) * SS
        points.append((x, y, rad, rng.uniform(0.4, 1.0)))
        gd.ellipse((x - rad * 5, y - rad * 5, x + rad * 5, y + rad * 5), fill=(255, 213, 141, 26))
        gd.ellipse((x - rad * 2.5, y - rad * 2.5, x + rad * 2.5, y + rad * 2.5), fill=(255, 225, 167, 65))
    glow = glow.filter(ImageFilter.GaussianBlur(5 * SS))
    base.alpha_composite(glow)
    d = ImageDraw.Draw(base)
    for x, y, rad, b in points:
        d.ellipse((x - rad * 1.8, y - rad * 1.8, x + rad * 1.8, y + rad * 1.8), fill=(255, 211, 139, int(60 * b)))
        d.ellipse((x - rad, y - rad, x + rad, y + rad), fill=(255, 244, 216, int(245 * b)))
        d.ellipse((x - rad * 0.38, y - rad * 0.38, x + rad * 0.38, y + rad * 0.38), fill=(255, 255, 249, 255))


def draw_star(base: Image.Image) -> None:
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, a in ((120, 12), (82, 20), (48, 36)):
        gd.ellipse((CX - r * SS, Y_STAR - r * SS, CX + r * SS, Y_STAR + r * SS), fill=(255, 207, 138, a))
    glow = glow.filter(ImageFilter.GaussianBlur(20 * SS))
    base.alpha_composite(glow)
    d = ImageDraw.Draw(base)
    outer = 60 * SS
    inner = 20 * SS
    pts = []
    for i in range(16):
        angle = -math.pi / 2 + i * math.pi / 8
        rr = outer if i % 2 == 0 else inner
        pts.append((CX + math.cos(angle) * rr, Y_STAR + math.sin(angle) * rr))
    d.polygon(pts, fill=(247, 218, 167, 255))
    inner_pts = []
    for i in range(16):
        angle = -math.pi / 2 + i * math.pi / 8
        rr = outer * 0.54 if i % 2 == 0 else inner * 0.7
        inner_pts.append((CX + math.cos(angle) * rr, Y_STAR + math.sin(angle) * rr))
    d.polygon(inner_pts, fill=(255, 249, 231, 230))
    # a few long, fine rays
    for angle in (-math.pi / 2, -math.pi / 4, 0, math.pi / 4, math.pi / 2, 3 * math.pi / 4):
        x2 = CX + math.cos(angle) * outer * 1.5
        y2 = Y_STAR + math.sin(angle) * outer * 1.5
        d.line((CX, Y_STAR, x2, y2), fill=(255, 226, 172, 90), width=2)
    d.ellipse((CX - 5 * SS, Y_STAR - 5 * SS, CX + 5 * SS, Y_STAR + 5 * SS), fill=(255, 255, 249, 255))


def main() -> None:
    core = make_core()
    draw_hidden_trunk(core)
    add_branches(core)
    draw_ornaments(core)
    draw_lights(core)
    draw_star(core)
    # tiny frost sparkles on the outer branches
    rng = random.Random(4242)
    d = ImageDraw.Draw(core)
    for _ in range(210):
        v = rng.uniform(0.1, 0.98)
        width = radius_at(v)
        x = CX + rng.uniform(-1.0, 1.0) * width * 0.94
        y = TOP + v * (BASE - TOP) + rng.uniform(-20, 15) * SS
        rad = rng.choice((1, 1, 1.5, 2)) * SS
        d.ellipse((x - rad, y - rad, x + rad, y + rad), fill=(235, 227, 193, rng.randrange(35, 100)))

    # trim to a balanced vertical composition while preserving transparency
    bbox = core.getbbox()
    if bbox:
        pad = 26 * SS
        core = core.crop((max(0, bbox[0] - pad), max(0, bbox[1] - pad), min(W, bbox[2] + pad), min(H, bbox[3] + pad)))
    core = core.resize((FW, FH), Image.Resampling.LANCZOS)
    core.save(OUT, "WEBP", quality=92, method=6, alpha_quality=100)
    bg = Image.new("RGB", (FW, FH), (8, 4, 5))
    bg.paste(core, (0, 0), core)
    bg.save(PREVIEW, "PNG")
    print(f"wrote {OUT} ({OUT.stat().st_size:,} bytes), preview {PREVIEW}")


if __name__ == "__main__":
    main()
