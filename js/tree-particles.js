/* ═══════════════════════════════════════════════════════════════════════
   STELLAR TREE · a small 2D light-sculpture
   One canvas, a static foliage plate and a handful of animated lights.
   No WebGL, no large image dependency, comfortable on a phone.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const TAU = Math.PI * 2;

  function mulberry32(seed) {
    let value = seed >>> 0;
    return function random() {
      value += 0x6d2b79f5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexRgb(hex) {
    const raw = String(hex).replace("#", "");
    return [
      parseInt(raw.slice(0, 2), 16),
      parseInt(raw.slice(2, 4), 16),
      parseInt(raw.slice(4, 6), 16),
    ];
  }

  function rgba(hex, alpha) {
    const [r, g, b] = hexRgb(hex);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  class StellarParticleTree {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { alpha: true });
      this.active = true;
      this.paused = false;
      this.reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.raf = 0;
      this.time = 0;
      this.seed = 20261224;
      this.W = 0;
      this.H = 0;
      this.dpr = 1;
      this.foliage = null;
      this.lights = [];
      this.ornaments = [];
      this.motes = [];
      this.sprites = this.buildSprites();
      this.resize();
    }

    buildSprites() {
      const colors = {
        gold: "#ffd08b",
        cream: "#ffe9c9",
        warm: "#ffb765",
        jade: "#b6e3b2",
        blush: "#ffb7c8",
        emerald: "#8fd5a7",
      };
      const sprites = {};
      Object.keys(colors).forEach((name) => {
        const size = 96;
        const piece = document.createElement("canvas");
        piece.width = size;
        piece.height = size;
        const ctx = piece.getContext("2d");
        const [r, g, b] = hexRgb(colors[name]);
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, `rgba(255,252,238,0.98)`);
        gradient.addColorStop(0.12, `rgba(${r},${g},${b},0.92)`);
        gradient.addColorStop(0.38, `rgba(${r},${g},${b},0.22)`);
        gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        sprites[name] = piece;
      });
      sprites.star = (() => {
        const size = 220;
        const piece = document.createElement("canvas");
        piece.width = size;
        piece.height = size;
        const ctx = piece.getContext("2d");
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, "rgba(255,250,230,0.94)");
        gradient.addColorStop(0.16, "rgba(255,218,161,0.52)");
        gradient.addColorStop(0.46, "rgba(255,194,118,0.14)");
        gradient.addColorStop(1, "rgba(255,180,90,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
        return piece;
      })();
      return sprites;
    }

    resize() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.round(rect.width);
      if (!width) return;
      const height = Math.round((width * 1700) / 1200);
      const dpr = Math.min(window.devicePixelRatio || 1, width < 600 ? 1.7 : 2);
      if (this.W === width && this.H === height && this.dpr === dpr) {
        this.drawStatic();
        return;
      }
      this.W = width;
      this.H = height;
      this.dpr = dpr;
      this.canvas.width = Math.round(width * dpr);
      this.canvas.height = Math.round(height * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.build();
      this.drawStatic();
    }

    profile(t) {
      const top = this.W * 0.008;
      const base = this.W * 0.4;
      return top + (base - top) * Math.pow(Math.max(0, Math.min(1, t)), 0.84);
    }

    build() {
      const W = this.W;
      const H = this.H;
      if (!W || !H) return;
      const cx = W * 0.5;
      const top = H * 0.145;
      const bottom = H * 0.925;
      const treeH = bottom - top;
      const rng = mulberry32(this.seed);
      const mobile = W < 600;
      const branches = [];

      // A few soft volumes give the particles a body without a flat cone.
      const foliage = document.createElement("canvas");
      foliage.width = Math.round(W * this.dpr);
      foliage.height = Math.round(H * this.dpr);
      const f = foliage.getContext("2d");
      f.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      const halo = f.createLinearGradient(0, top, 0, bottom);
      halo.addColorStop(0, "rgba(7,24,14,0.06)");
      halo.addColorStop(0.55, "rgba(8,30,18,0.34)");
      halo.addColorStop(1, "rgba(12,48,28,0.58)");
      f.beginPath();
      f.moveTo(cx, top);
      f.quadraticCurveTo(cx + W * 0.22, top + treeH * 0.25, cx + W * 0.365, bottom);
      f.quadraticCurveTo(cx, bottom - treeH * 0.035, cx - W * 0.365, bottom);
      f.quadraticCurveTo(cx - W * 0.22, top + treeH * 0.25, cx, top);
      f.closePath();
      f.fillStyle = halo;
      f.fill();

      // Foliage volume: many tiny evergreen grains.
      const greens = ["#0b2515", "#10311c", "#173d25", "#205131", "#2b603c", "#3d754b", "#6b9c72", "#8ab184"];
      const volume = mobile ? 2900 : 5200;
      for (let i = 0; i < volume; i += 1) {
        const t = Math.pow(rng(), 0.72);
        const y = top + t * treeH;
        const rmax = this.profile(t);
        const radius = rmax * Math.sqrt(rng()) * 0.97;
        const angle = rng() * TAU;
        const x = cx + Math.cos(angle) * radius;
        const yy = y + Math.sin(angle) * radius * 0.11;
        const edge = radius / Math.max(1, rmax);
        let color = greens[1 + Math.floor(rng() * 5)];
        if (edge > 0.82 && rng() < 0.34) color = greens[5 + Math.floor(rng() * 3)];
        if (rng() < 0.03) color = "#b9c59a";
        const a = 0.06 + rng() * 0.25 + edge * 0.05;
        f.fillStyle = rgba(color, a);
        const size = 0.45 + rng() * 1.4;
        f.fillRect(x, yy, size, size);
      }

      // Curved boughs: a denser, slightly warmer green along the structure.
      const tiers = mobile ? 11 : 13;
      for (let tier = 0; tier < tiers; tier += 1) {
        const t = 0.055 + (tier / (tiers - 1)) * 0.9;
        const y = top + t * treeH;
        const r = this.profile(t);
        for (const side of [-1, 1]) {
          for (let j = 0; j < 3; j += 1) {
            const length = r * (0.58 + rng() * 0.39);
            const endX = cx + side * length;
            const endY = y + (12 + 48 * t) * (0.6 + rng() * 0.8);
            const startX = cx + side * r * 0.03;
            const c1x = startX + (endX - startX) * 0.42;
            const c1y = y + (endY - y) * 0.15;
            const pts = [];
            for (let k = 0; k <= 16; k += 1) {
              const u = k / 16;
              const px = (1 - u) ** 2 * startX + 2 * (1 - u) * u * c1x + u * u * endX;
              const py = (1 - u) ** 2 * y + 2 * (1 - u) * u * c1y + u * u * endY;
              pts.push([px, py]);
            }
            branches.push(pts);
            for (let k = 1; k < pts.length; k += 1) {
              const [px, py] = pts[k];
              for (let q = 0; q < 2; q += 1) {
                const jitter = (rng() - 0.5) * 14 * (0.4 + t);
                f.fillStyle = rgba(greens[4 + (rng() < 0.3 ? 1 : 0)], 0.08 + rng() * 0.15);
                f.fillRect(px + jitter, py + (rng() - 0.5) * 10, 0.8 + rng() * 1.3, 0.8 + rng() * 1.3);
              }
            }
          }
        }
      }

      // A fine rim of frozen light along the outside branches.
      for (let i = 0; i < (mobile ? 170 : 260); i += 1) {
        const t = rng() * 0.93 + 0.025;
        const side = rng() < 0.5 ? -1 : 1;
        const radius = this.profile(t) * (0.9 + rng() * 0.1);
        const x = cx + side * radius;
        const y = top + t * treeH + (rng() - 0.5) * 20;
        f.fillStyle = rgba(rng() < 0.6 ? "#8ba078" : "#d8c795", 0.15 + rng() * 0.25);
        const s = 0.8 + rng() * 1.4;
        f.fillRect(x, y, s, s);
      }

      this.foliage = foliage;
      this.tree = { cx, top, bottom, treeH };

      // Warm fairy lights cluster along the branches and spiral across the tree.
      const lights = [];
      const lightColors = ["gold", "cream", "warm", "jade"];
      const addLight = (x, y, strength = 1) => {
        lights.push({
          x,
          y,
          color: lightColors[Math.floor(rng() * lightColors.length)],
          size: (0.9 + rng() * 2.3) * strength,
          phase: rng() * TAU,
          speed: 0.28 + rng() * 0.8,
          base: 0.5 + rng() * 0.5,
        });
      };
      for (const pts of branches) {
        for (let k = 2; k < pts.length; k += 2) {
          if (rng() < 0.19) addLight(pts[k][0], pts[k][1], 0.9);
        }
      }
      for (let a = 0; a < 3; a += 1) {
        for (let i = 0; i < (mobile ? 32 : 45); i += 1) {
          const t = 0.06 + (i / (mobile ? 32 : 45)) * 0.86;
          const angle = t * TAU * 2.35 + (a / 3) * TAU + 0.4;
          const radius = this.profile(t) * 0.74;
          addLight(cx + Math.cos(angle) * radius, top + t * treeH + Math.sin(angle) * radius * 0.11, 1.05);
        }
      }
      this.lights = lights.slice(0, mobile ? 140 : 190);

      // A dozen glass ornaments, distributed over the front of the cone.
      const ornamentColors = [
        ["#f0c483", "#fff0cf", "#8f6638"],
        ["#9e3d51", "#e4a0a1", "#531d2b"],
        ["#94c5b0", "#e1f2df", "#416c5a"],
        ["#d6b2d9", "#f6e6ef", "#745579"],
      ];
      this.ornaments = [];
      for (let i = 0; i < (mobile ? 9 : 12); i += 1) {
        const t = 0.22 + rng() * 0.66;
        const span = this.profile(t) * 0.62;
        const x = cx + (rng() - 0.5) * 2 * span;
        const y = top + t * treeH + (rng() - 0.5) * 12;
        const radius = (2.5 + rng() * 4.4) * (W < 600 ? 0.86 : 1);
        this.ornaments.push({
          x,
          y,
          radius,
          colors: ornamentColors[Math.floor(rng() * ornamentColors.length)],
          phase: rng() * TAU,
        });
      }

      // A little drifting dust in the tree's halo.
      this.motes = [];
      for (let i = 0; i < (mobile ? 24 : 38); i += 1) {
        this.motes.push({
          x: cx + (rng() - 0.5) * W * 0.78,
          y: top + rng() * treeH,
          size: 0.4 + rng() * 1.3,
          phase: rng() * TAU,
          drift: 0.4 + rng() * 0.9,
          alpha: 0.12 + rng() * 0.4,
        });
      }
      this.star = {
        x: cx,
        y: H * 0.082,
        radius: Math.min(W * 0.067, H * 0.05),
      };
      this.rimSeed = rng();
    }

    drawStar(ctx, time) {
      const { x, y, radius } = this.star;
      const pulse = 0.88 + Math.sin(time * 0.0011) * 0.12;
      const glow = radius * 3.5 * pulse;
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(this.sprites.star, x - glow / 2, y - glow / 2, glow, glow);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.sin(time * 0.00016) * 0.035);
      const points = 16;
      const outer = radius * pulse;
      const inner = outer * 0.28;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / points;
        const r = i % 2 === 0 ? outer : inner;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, outer);
      fill.addColorStop(0, "rgba(255,253,242,1)");
      fill.addColorStop(0.48, "rgba(255,229,179,0.98)");
      fill.addColorStop(1, "rgba(213,169,101,0.9)");
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,207,0.5)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.restore();
      // Long, fine rays.
      ctx.strokeStyle = "rgba(255,220,164,0.18)";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * TAU + Math.PI / 2;
        const r1 = radius * 1.35;
        const r2 = radius * (2.8 + (i % 2) * 1.3);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    drawOrnaments(ctx, time) {
      for (const item of this.ornaments) {
        const pulse = 0.92 + Math.sin(time * 0.0012 + item.phase) * 0.08;
        const r = item.radius * pulse;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = item.colors[1];
        ctx.beginPath();
        ctx.arc(item.x, item.y, r * 2.1, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        const fill = ctx.createRadialGradient(
          item.x - r * 0.35,
          item.y - r * 0.42,
          r * 0.08,
          item.x,
          item.y,
          r,
        );
        fill.addColorStop(0, item.colors[1]);
        fill.addColorStop(0.42, item.colors[0]);
        fill.addColorStop(1, item.colors[2]);
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(item.x, item.y, r, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255,249,235,0.65)";
        ctx.beginPath();
        ctx.ellipse(item.x - r * 0.34, item.y - r * 0.42, r * 0.2, r * 0.13, -0.5, 0, TAU);
        ctx.fill();
        // small cap and wire
        ctx.strokeStyle = "rgba(215,179,119,0.42)";
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y - r - 8);
        ctx.lineTo(item.x, item.y - r);
        ctx.stroke();
        ctx.fillStyle = "rgba(232,199,145,0.9)";
        ctx.fillRect(item.x - r * 0.2, item.y - r - 2.2, r * 0.4, 2.2);
      }
    }

    drawStatic() {
      if (!this.ctx || !this.W) return;
      this.ctx.clearRect(0, 0, this.W, this.H);
      if (this.foliage) this.ctx.drawImage(this.foliage, 0, 0, this.W, this.H);
      this.drawStar(this.ctx, 0);
      this.drawOrnaments(this.ctx, 0);
      this.drawLights(this.ctx, 0);
    }

    drawLights(ctx, time) {
      ctx.globalCompositeOperation = "lighter";
      for (const light of this.lights) {
        const twinkle = light.base * (0.7 + Math.sin(time * 0.001 * light.speed + light.phase) * 0.3);
        const sprite = this.sprites[light.color];
        const glowSize = light.size * 6.8 * (0.85 + twinkle * 0.25);
        ctx.globalAlpha = 0.22 + twinkle * 0.46;
        ctx.drawImage(sprite, light.x - glowSize / 2, light.y - glowSize / 2, glowSize, glowSize);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(255,242,219,0.92)";
        ctx.beginPath();
        ctx.arc(light.x, light.y, Math.max(0.5, light.size * 0.34), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    drawMotes(ctx, time) {
      ctx.globalCompositeOperation = "lighter";
      for (const mote of this.motes) {
        const alpha = mote.alpha * (0.45 + Math.sin(time * 0.0009 + mote.phase) * 0.55);
        const y = mote.y + Math.sin(time * 0.00042 * mote.drift + mote.phase) * 4;
        ctx.fillStyle = `rgba(231,210,165,${Math.max(0, alpha)})`;
        ctx.beginPath();
        ctx.arc(mote.x, y, mote.size, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    }

    draw(now) {
      if (!this.W || !this.ctx) return;
      this.time = now;
      this.ctx.clearRect(0, 0, this.W, this.H);
      if (this.foliage) this.ctx.drawImage(this.foliage, 0, 0, this.W, this.H);
      this.drawMotes(this.ctx, now);
      this.drawLights(this.ctx, now);
      this.drawOrnaments(this.ctx, now);
      this.drawStar(this.ctx, now);
    }

    tick = (now) => {
      this.raf = 0;
      if (!this.active || this.paused || this.reduced || document.hidden) return;
      this.draw(now);
      this.raf = requestAnimationFrame(this.tick);
    };

    start() {
      if (this.raf || this.paused || !this.active || this.reduced) {
        this.drawStatic();
        return;
      }
      this.draw(performance.now());
      this.raf = requestAnimationFrame(this.tick);
    }

    stop() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
    }

    setActive(active) {
      this.active = Boolean(active);
      if (this.active) {
        this.resize();
        this.start();
      } else {
        this.stop();
        this.drawStatic();
      }
    }

    setPaused(paused) {
      this.paused = Boolean(paused);
      if (this.paused) {
        this.stop();
        this.drawStatic();
      } else if (this.active) {
        this.start();
      }
    }
  }

  window.StellarParticleTree = StellarParticleTree;
})();
