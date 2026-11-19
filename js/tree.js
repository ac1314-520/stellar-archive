/* ═══════════════════════════════════════════════════════════════════════
   STELLAR ARCHIVE · the tree
   200 photographs, six quiet orbits, one winter star.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const SERIES = window.STELLAR_SERIES;
  const TAU = Math.PI * 2;
  const RING_DEFS = [
    { y: -3.72, r: 6.48, weight: 50 },
    { y: -2.42, r: 6.02, weight: 44 },
    { y: -1.08, r: 5.44, weight: 37 },
    { y: 0.28, r: 4.72, weight: 30 },
    { y: 1.62, r: 3.96, weight: 23 },
    { y: 2.92, r: 3.25, weight: 16 },
  ];
  const RING_TOTAL = RING_DEFS.reduce((sum, ring) => sum + ring.weight, 0);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);

  function hashString(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seeded(seed) {
    let state = seed >>> 0;
    return function () {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 4294967296;
    };
  }

  function allocateRings(total) {
    const counts = RING_DEFS.map((ring) => Math.floor((ring.weight / RING_TOTAL) * total));
    let remainder = total - counts.reduce((a, b) => a + b, 0);
    for (let i = 0; remainder > 0; i = (i + 1) % counts.length) {
      counts[i] += 1;
      remainder -= 1;
    }
    return counts;
  }

  class StellarTree {
    constructor(canvas, callbacks) {
      this.canvas = canvas;
      this.callbacks = callbacks || {};
      this.active = false;
      this.ready = false;
      this.paused = false;
      this.focusSeries = null;
      this.items = [];
      this.entries = [];
      this.textures = [];
      this.interactive = [];
      this.hovered = null;
      this.dragging = false;
      this.pointer = new THREE.Vector2(-10, -10);
      this.pointerNorm = { x: 0, y: 0 };
      this.pointerRaw = { x: 0, y: 0 };
      this.orbitOffset = 0;
      this.swayPhase = 0;
      this.time = 0;
      this.lastFrame = 0;
      this.introStart = 0;
      this.introDone = false;
      this.zoomDelta = 0;
      this.dragY = 0;
      this.baseZ = 17;
      this.baseCameraY = 1.1;
      this.cameraTargetZ = 17;
      this.isMobile = false;
      this.isCompact = false;
      this._frame = 0;
      this._pointerDown = null;
      this._lastPointerMove = 0;
      this._qualityChecked = false;
      this._frameSamples = [];
      this._destroyed = false;
      this._raf = 0;
      this._lastWidth = 0;
      this._lastHeight = 0;
      this._bound = {};
      this._raycaster = new THREE.Raycaster();
      this._clock = { start: 0 };

      this._initRenderer();
      this._initScene();
      this._bindEvents();
      this._loop = this._loop.bind(this);
      this._raf = requestAnimationFrame(this._loop);
    }

    /* ────────────────────────────── setup ───────────────────────────── */

    _initRenderer() {
      if (!window.THREE) throw new Error("Three.js is unavailable");
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
        stencil: false,
      });
      this.pixelRatioCap = window.matchMedia("(pointer: coarse)").matches ? 1.55 : 1.85;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.pixelRatioCap));
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.autoClear = true;
      this.renderer.toneMapping = THREE.NoToneMapping;
      if ("outputColorSpace" in this.renderer && THREE.SRGBColorSpace) {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if ("outputEncoding" in this.renderer && THREE.sRGBEncoding) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }
    }

    _initScene() {
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x0c0609, 0.016);
      this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 90);
      this.camera.position.set(0, 1.3, 20);
      this.camera.lookAt(0, 0.2, 0);

      this.world = new THREE.Group();
      this.world.position.set(0, 0, 0);
      this.scene.add(this.world);

      this.photoRoot = new THREE.Group();
      this.world.add(this.photoRoot);

      this._dotTexture = this._makeDotTexture();
      this._glowTexture = this._makeGlowTexture();
      this._burstTexture = this._makeBurstTexture();
      this._floorTexture = this._makeFloorTexture();

      this._hoverGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this._glowTexture,
          color: 0xffcdb0,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      this._hoverGlow.scale.set(2.15, 2.65, 1);
      this._hoverGlow.visible = false;
      this.world.add(this._hoverGlow);

      this._resize();
    }

    _makeDotTexture() {
      const size = 64;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.16, "rgba(255,246,224,0.98)");
      gradient.addColorStop(0.42, "rgba(255,216,178,0.35)");
      gradient.addColorStop(1, "rgba(255,202,164,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    _makeGlowTexture() {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,246,224,0.92)");
      gradient.addColorStop(0.12, "rgba(255,218,180,0.46)");
      gradient.addColorStop(0.34, "rgba(242,143,139,0.17)");
      gradient.addColorStop(0.65, "rgba(168,57,73,0.035)");
      gradient.addColorStop(1, "rgba(80,20,35,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    _makeBurstTexture() {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      ctx.globalCompositeOperation = "lighter";

      const core = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.25);
      core.addColorStop(0, "rgba(255,252,244,1)");
      core.addColorStop(0.12, "rgba(255,235,207,0.95)");
      core.addColorStop(0.36, "rgba(255,185,166,0.35)");
      core.addColorStop(1, "rgba(255,140,150,0)");
      ctx.fillStyle = core;
      ctx.fillRect(0, 0, size, size);

      ctx.translate(size / 2, size / 2);
      const longRays = [
        { angle: 0, length: 0.48, width: 3.4 },
        { angle: Math.PI / 2, length: 0.48, width: 2.3 },
        { angle: Math.PI / 4, length: 0.28, width: 1.6 },
        { angle: -Math.PI / 4, length: 0.28, width: 1.6 },
      ];
      for (const ray of longRays) {
        ctx.save();
        ctx.rotate(ray.angle);
        const grad = ctx.createLinearGradient(0, 0, size * ray.length, 0);
        grad.addColorStop(0, "rgba(255,244,222,0.9)");
        grad.addColorStop(0.15, "rgba(255,213,182,0.42)");
        grad.addColorStop(0.55, "rgba(246,132,140,0.09)");
        grad.addColorStop(1, "rgba(246,132,140,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -ray.width);
        ctx.lineTo(size * ray.length, 0);
        ctx.lineTo(0, ray.width);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Fine star rays / pinpricks around the light.
      const rand = seeded(20261225);
      for (let i = 0; i < 64; i += 1) {
        const angle = rand() * TAU;
        const distance = size * (0.06 + rand() * 0.3);
        const radius = 0.4 + rand() * 1.6;
        ctx.save();
        ctx.rotate(angle);
        const grad = ctx.createLinearGradient(size * 0.03, 0, distance + radius * 3, 0);
        grad.addColorStop(0, `rgba(255,236,208,${0.14 + rand() * 0.24})`);
        grad.addColorStop(1, "rgba(255,190,170,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(size * 0.03, -radius * 0.5, distance, radius);
        ctx.restore();
      }

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    _makeFloorTexture() {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,205,172,0.16)");
      gradient.addColorStop(0.36, "rgba(182,92,90,0.075)");
      gradient.addColorStop(0.7, "rgba(96,31,43,0.015)");
      gradient.addColorStop(1, "rgba(30,7,13,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    /* ─────────────────────────── texture loading ─────────────────────── */

    async load(items) {
      this.ready = false;
      this.items = (items || []).slice(0, 200);
      this.callbacks.onLoadStart?.(this.items.length);
      this.callbacks.onProgress?.(0, this.items.length, "正在挂上第一件藏品");

      const loader = new THREE.TextureLoader();
      const total = this.items.length;
      const textures = new Array(total).fill(null);
      let next = 0;
      let loaded = 0;
      let failed = 0;

      const loadOne = (url) =>
        new Promise((resolve) => {
          let done = false;
          const finish = (value) => {
            if (done) return;
            done = true;
            resolve(value);
          };
          try {
            loader.load(
              url,
              (texture) => {
                texture.minFilter = THREE.LinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = false;
                if ("colorSpace" in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
                else if ("encoding" in texture && THREE.sRGBEncoding) texture.encoding = THREE.sRGBEncoding;
                if (this.renderer.capabilities && texture.anisotropy !== undefined) {
                  texture.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy?.() || 1);
                }
                finish(this._softenThumbnail(texture));
              },
              undefined,
              () => finish(null)
            );
          } catch {
            finish(null);
          }
          window.setTimeout(() => finish(null), 14000);
        });

      const worker = async () => {
        while (next < total) {
          const index = next;
          next += 1;
          const item = this.items[index];
          const texture = await loadOne(item.thumb || item.src);
          if (!texture) {
            failed += 1;
          } else {
            textures[index] = texture;
          }
          loaded += 1;
          this.callbacks.onProgress?.(loaded, total, loaded >= total ? "星树已经点亮" : `正在挂上第 ${loaded + 1} 件藏品`);
        }
      };

      await Promise.all(Array.from({ length: Math.min(10, Math.max(1, total)) }, worker));

      if (this._destroyed) return;
      if (failed === total || total === 0) {
        this.callbacks.onError?.("No photographs could be loaded.");
        return;
      }

      this._clearContent();
      this.textures = textures.filter(Boolean);
      this.introStart = 0;
      this._introCameraDone = false;
      this._lastFrame = 0;
      this._buildPhotos(textures);

      // The first WebGL frame uploads a large number of thumbnails. Do that
      // while the preloader is still up, so the reveal is not interrupted by
      // a multi-second texture-upload hitch.
      this.callbacks.onProgress?.(total, total, "正在点亮最后一点星火");
      await new Promise((resolve) => window.setTimeout(resolve, 40));
      try {
        this.camera.position.set(0, this.baseCameraY, this.baseZ);
        this.camera.lookAt(0, 0.45, 0);
        for (const texture of this.textures) {
          this.renderer.initTexture?.(texture);
        }
        this.renderer.render(this.scene, this.camera);
      } catch (error) {
        console.warn("Warm-up render skipped:", error);
      }

      this.ready = true;
      this.callbacks.onProgress?.(total, total, "星树已经点亮");
      this.callbacks.onReady?.(this.renderedItems?.length || 0);
    }

    _softenThumbnail(texture) {
      const image = texture.image;
      if (!image || !image.width) return texture;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const w = canvas.width;
        const h = canvas.height;
        // Fade the print edges into the darkness. At orbit scale this turns
        // a wall of hard rectangles into a cloud of softly lit photographs.
        const edgeX = ctx.createLinearGradient(0, 0, w, 0);
        edgeX.addColorStop(0, "rgba(5,2,4,0.98)");
        edgeX.addColorStop(0.23, "rgba(5,2,4,0)");
        edgeX.addColorStop(0.77, "rgba(5,2,4,0)");
        edgeX.addColorStop(1, "rgba(5,2,4,0.98)");
        ctx.fillStyle = edgeX;
        ctx.fillRect(0, 0, w, h);
        const edgeY = ctx.createLinearGradient(0, 0, 0, h);
        edgeY.addColorStop(0, "rgba(5,2,4,0.98)");
        edgeY.addColorStop(0.24, "rgba(5,2,4,0)");
        edgeY.addColorStop(0.78, "rgba(5,2,4,0)");
        edgeY.addColorStop(1, "rgba(5,2,4,0.98)");
        ctx.fillStyle = edgeY;
        ctx.fillRect(0, 0, w, h);
        const cornerFade = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.38, w / 2, h / 2, Math.max(w, h) * 0.68);
        cornerFade.addColorStop(0, "rgba(5,2,4,0)");
        cornerFade.addColorStop(0.64, "rgba(5,2,4,0.12)");
        cornerFade.addColorStop(1, "rgba(5,2,4,0.88)");
        ctx.fillStyle = cornerFade;
        ctx.fillRect(0, 0, w, h);
        const softened = new THREE.CanvasTexture(canvas);
        softened.minFilter = THREE.LinearFilter;
        softened.magFilter = THREE.LinearFilter;
        softened.generateMipmaps = false;
        if ("colorSpace" in softened && THREE.SRGBColorSpace) softened.colorSpace = THREE.SRGBColorSpace;
        else if ("encoding" in softened && THREE.sRGBEncoding) softened.encoding = THREE.sRGBEncoding;
        softened.anisotropy = texture.anisotropy;
        texture.dispose();
        return softened;
      } catch {
        return texture;
      }
    }

    /* ───────────────────────────── tree build ────────────────────────── */

    _buildPhotos(textures) {
      this._buildTree();
      this._buildSnow();

      this.entries = [];
      this.interactive = [];

      const items = [];
      const imageTextures = [];
      this.items.forEach((item, index) => {
        if (textures[index]) {
          items.push(item);
          imageTextures.push(textures[index]);
        }
      });
      this.renderedItems = items;

      const counts = allocateRings(items.length);
      let cursor = 0;
      const cardGeo = new THREE.PlaneGeometry(1, 1.25);
      this._sharedCardGeo = cardGeo;
      this._hoverGlow.visible = false;

      // A single gold frame follows the hovered print. This keeps the orbit
      // light — 200 frames at once turned the tree into a lattice — while
      // giving the photograph under the cursor a small, precious edge.
      this._hoverFrame = new THREE.Mesh(
        new THREE.PlaneGeometry(1.048, 1.305),
        new THREE.MeshBasicMaterial({ color: 0xd9b887 })
      );
      this._hoverFrame.visible = false;
      this._hoverFrame.renderOrder = 1;
      this.world.add(this._hoverFrame);

      for (let ringIndex = 0; ringIndex < RING_DEFS.length; ringIndex += 1) {
        const ring = RING_DEFS[ringIndex];
        const count = counts[ringIndex];
        for (let i = 0; i < count; i += 1) {
          const itemSeed = hashString(items[cursor]?.id || `plate-${cursor}`);
          const rand = seeded(itemSeed + ringIndex * 9973);
          const nextItem = items[cursor];
          const texture = imageTextures[cursor];
          cursor += 1;
          if (!nextItem || !texture) continue;

          const group = new THREE.Group();
          const mat = new THREE.MeshBasicMaterial({ map: texture, color: 0xece4dd });
          const image = new THREE.Mesh(cardGeo, mat);
          image.position.z = 0;
          group.add(image);
          this.photoRoot.add(group);

          const phase = ringIndex * 0.72 + rand() * 0.5;
          const scale = 0.56 + rand() * 0.17;
          // Leave the front of the tree open. The photographs gather as a
          // deep crescent behind and beside it, then drift back and forth on
          // their own orbits instead of building a wall in front of the star.
          const arcGap = 1.42;
          const arcStart = Math.PI / 2 + arcGap / 2 + ringIndex * 0.035;
          const arcSpan = TAU - arcGap;
          const base = {
            item: nextItem,
            group,
            image,
            material: mat,
            ringIndex,
            baseAngle: arcStart + ((i + (rand() - 0.5) * 0.55) / Math.max(1, count)) * arcSpan,
            radius: ring.r + (rand() - 0.5) * 0.54,
            y: ring.y + (rand() - 0.5) * 0.30,
            scale,
            targetScale: scale,
            phase: rand() * TAU,
            bobAmp: 0.055 + rand() * 0.08,
            bobSpeed: 0.38 + rand() * 0.39,
            tilt: (rand() - 0.5) * 0.075,
            tone: 1,
            hovered: false,
            introOffset: 0.12 + ringIndex * 0.035 + rand() * 0.18,
            speed: 0.96 + ringIndex * 0.015,
          };
          image.userData.photoEntry = base;
          this.entries.push(base);
          this.interactive.push(image);
        }
      }

      this.hovered = null;
      this._applyFocus();
    }

    _clearContent() {
      if (!this.world) return;
      const geometries = new Set();
      const materials = new Set();
      const textures = new Set();
      const permanentTextures = new Set([
        this._dotTexture,
        this._glowTexture,
        this._burstTexture,
        this._floorTexture,
      ]);

      this.world.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) {
          const list = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of list) {
            materials.add(material);
            if (material.map) textures.add(material.map);
          }
        }
      });
      for (const texture of this.textures) {
        if (texture) textures.add(texture);
      }
      for (const texture of textures) {
        if (permanentTextures.has(texture)) continue;
        try { texture.dispose(); } catch {}
      }
      for (const geometry of geometries) {
        try { geometry.dispose(); } catch {}
      }
      for (const material of materials) {
        try { material.dispose(); } catch {}
      }

      while (this.world.children.length) {
        const child = this.world.children[this.world.children.length - 1];
        this.world.remove(child);
      }
      while (this.photoRoot.children.length) {
        this.photoRoot.remove(this.photoRoot.children[this.photoRoot.children.length - 1]);
      }
      this.world.add(this.photoRoot);
      if (this._snow) {
        this.scene.remove(this._snow.points);
        this._snow.points.geometry.dispose();
        this._snow.points.material.dispose();
        this._snow = null;
      }
      this.entries = [];
      this.interactive = [];
      this.textures = [];
      this._hoverGlow = null;
      this._starGlow = null;
      this._starBurst = null;
      this._starHalo = null;
      this._starMesh = null;
      this._bulbs = null;
      this._smallPoints = null;
      this._floorMesh = null;
      this._bokeh = null;
      this._hoverFrame = null;
      this._haze = null;

      // Recreate persistent atmosphere objects.
      this._hoverGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this._glowTexture,
          color: 0xffcdb0,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      this._hoverGlow.scale.set(2.15, 2.65, 1);
      this._hoverGlow.visible = false;
      this.world.add(this._hoverGlow);
    }

    _buildTree() {
      const tree = new THREE.Group();
      tree.position.set(0, 0, 0);
      this.treeGroup = tree;
      this.world.add(tree);

      const baseY = -4.15;
      const topY = 4.05;
      this.treeBaseY = baseY;
      this.treeTopY = topY;

      const palette = {
        warm: new THREE.Color(0xf8d1a7),
        rose: new THREE.Color(0xff9bae),
        pale: new THREE.Color(0xffe2c0),
        roseDeep: new THREE.Color(0xd57188),
      };

      const smallPositions = [];
      const smallColors = [];
      const bulbPositions = [];
      const bulbColors = [];
      const hazePositions = [];
      const hazeColors = [];
      const branchMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd0a6,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });
      const branchMaterialSoft = new THREE.MeshBasicMaterial({
        color: 0xe98696,
        transparent: true,
        opacity: 0.26,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      });

      const tiers = 8;
      for (let tier = 0; tier < tiers; tier += 1) {
        const t = tier / (tiers - 1);
        const y = baseY + t * (topY - baseY);
        const radius = 0.14 + 4.58 * Math.pow(1 - t, 0.92);
        const branchPhase = tier * 1.37;

        for (let layer = 0; layer < 2; layer += 1) {
          const points = [];
          const segments = 170;
          const baseR = radius * (layer === 0 ? 1 : 0.76);
          for (let seg = 0; seg < segments; seg += 1) {
            const angle = (seg / segments) * TAU;
            const wave =
              1 +
              0.048 * Math.sin(angle * 5 + branchPhase + layer * 0.9) +
              0.018 * Math.sin(angle * 11 - branchPhase * 0.6);
            points.push(
              new THREE.Vector3(
                Math.cos(angle) * baseR * wave,
                y + 0.12 * Math.sin(angle * 3 + branchPhase) + layer * 0.035,
                Math.sin(angle) * baseR * wave
              )
            );
          }
          const curve = new THREE.CatmullRomCurve3(points, true, "centripetal", 0.2);
          const geometry = new THREE.TubeGeometry(curve, 190, layer === 0 ? 0.0135 : 0.0055, 3, true);
          const mesh = new THREE.Mesh(geometry, layer === 0 ? branchMaterial : branchMaterialSoft);
          mesh.renderOrder = 6;
          tree.add(mesh);

          const lightCount = layer === 0 ? 82 : 42;
          for (let light = 0; light < lightCount; light += 1) {
            const angle = (light / lightCount) * TAU + branchPhase + layer * 0.4;
            const wave = 1 + 0.048 * Math.sin(angle * 5 + branchPhase + layer * 0.9);
            const px = Math.cos(angle) * baseR * wave;
            const pz = Math.sin(angle) * baseR * wave;
            const py = y + 0.12 * Math.sin(angle * 3 + branchPhase) + layer * 0.035;
            if (light % 8 === 0) {
              bulbPositions.push(px, py, pz);
              const color = palette[light % 5 === 0 ? "rose" : "pale"];
              bulbColors.push(color.r, color.g, color.b);
            } else {
              smallPositions.push(px, py, pz);
              const color = palette[light % 3 === 0 ? "rose" : "warm"];
              smallColors.push(color.r, color.g, color.b);
            }
          }
        }

        // The main hanger: a gently waving loop at the outer edge.
        if (tier > 0 && tier < tiers - 1) {
          const ringPoints = [];
          for (let seg = 0; seg < 120; seg += 1) {
            const angle = (seg / 120) * TAU;
            const rr = radius * 1.08 * (1 + 0.017 * Math.sin(angle * 7 + branchPhase));
            ringPoints.push(
              new THREE.Vector3(
                Math.cos(angle) * rr,
                y - 0.012 + 0.02 * Math.sin(angle * 4 + branchPhase),
                Math.sin(angle) * rr
              )
            );
          }
          const curve = new THREE.CatmullRomCurve3(ringPoints, true, "centripetal", 0.2);
          const geometry = new THREE.TubeGeometry(curve, 140, 0.0045, 3, true);
          const mesh = new THREE.Mesh(geometry, branchMaterialSoft);
          tree.add(mesh);
        }
      }

      // A little internal haze gives the tree a volume even when a hundred
      // photographs pass in front of its branch lights.
      const hazeRand = seeded(1776);
      for (let i = 0; i < 760; i += 1) {
        const t = Math.pow(hazeRand(), 0.68);
        const y = baseY + (1 - t) * (topY - baseY);
        const radius = 4.68 * Math.pow(t, 0.96) * Math.sqrt(hazeRand()) * 0.86 + 0.08;
        const angle = hazeRand() * TAU;
        hazePositions.push(Math.cos(angle) * radius, y + (hazeRand() - 0.5) * 0.22, Math.sin(angle) * radius);
        const color = palette[hazeRand() > 0.72 ? "rose" : hazeRand() > 0.45 ? "pale" : "warm"];
        hazeColors.push(color.r, color.g, color.b);
      }
      const hazeGeo = new THREE.BufferGeometry();
      hazeGeo.setAttribute("position", new THREE.Float32BufferAttribute(hazePositions, 3));
      hazeGeo.setAttribute("color", new THREE.Float32BufferAttribute(hazeColors, 3));
      const haze = new THREE.Points(
        hazeGeo,
        new THREE.PointsMaterial({
          size: 0.075,
          map: this._dotTexture,
          vertexColors: true,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        })
      );
      haze.renderOrder = 6;
      tree.add(haze);
      this._haze = haze;

      // Two translucent spirals running through the tree.
      for (let spiral = 0; spiral < 2; spiral += 1) {
        const points = [];
        const segments = 380;
        for (let seg = 0; seg <= segments; seg += 1) {
          const t = seg / segments;
          const angle = t * TAU * 4.8 + spiral * Math.PI;
          const radius = 4.55 * Math.pow(1 - t, 0.92) + 0.12;
          points.push(
            new THREE.Vector3(
              Math.cos(angle) * radius * 1.01,
              baseY + t * (topY - baseY) + 0.09 * Math.sin(angle * 2),
              Math.sin(angle) * radius * 1.01
            )
          );
        }
        const curve = new THREE.CatmullRomCurve3(points, false, "centripetal", 0.2);
        const geometry = new THREE.TubeGeometry(curve, 480, spiral === 0 ? 0.0075 : 0.0045, 3, false);
        const material = new THREE.MeshBasicMaterial({
          color: spiral === 0 ? 0xf6c69e : 0xff9aad,
          transparent: true,
          opacity: spiral === 0 ? 0.24 : 0.16,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.renderOrder = 6;
        tree.add(mesh);
      }

      // soft, low floating cluster around the star
      for (let i = 0; i < 180; i += 1) {
        const angle = Math.random() * TAU;
        const radius = 0.56 + Math.random() * 1.3;
        const y = topY + 0.35 + (Math.random() - 0.5) * 1.1;
        const color = palette[Math.random() > 0.4 ? "warm" : "rose"];
        smallPositions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        smallColors.push(color.r, color.g, color.b);
      }

      const smallGeo = new THREE.BufferGeometry();
      smallGeo.setAttribute("position", new THREE.Float32BufferAttribute(smallPositions, 3));
      smallGeo.setAttribute("color", new THREE.Float32BufferAttribute(smallColors, 3));
      const smallPoints = new THREE.Points(
        smallGeo,
        new THREE.PointsMaterial({
          size: 0.062,
          map: this._dotTexture,
          vertexColors: true,
          transparent: true,
          opacity: 0.94,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        })
      );
      smallPoints.renderOrder = 7;
      tree.add(smallPoints);
      this._smallPoints = smallPoints;

      const bulbGeo = new THREE.BufferGeometry();
      bulbGeo.setAttribute("position", new THREE.Float32BufferAttribute(bulbPositions, 3));
      bulbGeo.setAttribute("color", new THREE.Float32BufferAttribute(bulbColors, 3));
      const bulbs = new THREE.Points(
        bulbGeo,
        new THREE.PointsMaterial({
          size: 0.18,
          map: this._dotTexture,
          vertexColors: true,
          transparent: true,
          opacity: 0.96,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        })
      );
      bulbs.renderOrder = 7;
      tree.add(bulbs);
      this._bulbs = bulbs;

      // Floor rings & light pool.
      for (let i = 0; i < 3; i += 1) {
        const points = [];
        const radius = 5.26 + i * 0.42;
        for (let seg = 0; seg < 100; seg += 1) {
          const a = (seg / 100) * TAU;
          points.push(new THREE.Vector3(Math.cos(a) * radius, baseY - 0.12, Math.sin(a) * radius));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        const mat = new THREE.LineBasicMaterial({
          color: i === 0 ? 0xe9b591 : 0x8e5862,
          transparent: true,
          opacity: 0.12 - i * 0.025,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const line = new THREE.LineLoop(geo, mat);
        tree.add(line);
      }

      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 16),
        new THREE.MeshBasicMaterial({
          map: this._floorTexture,
          transparent: true,
          opacity: 0.6,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = baseY - 0.10;
      tree.add(floor);
      this._floorMesh = floor;

      // Faint orbital guides help the eye read six deliberate rings rather
      // than one accidental heap of photographs.
      for (const ring of RING_DEFS) {
        const points = [];
        for (let segment = 0; segment < 150; segment += 1) {
          const a = (segment / 150) * TAU;
          points.push(new THREE.Vector3(Math.cos(a) * ring.r, ring.y, Math.sin(a) * ring.r));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
          color: 0xd9a785,
          transparent: true,
          opacity: 0.055,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
        });
        const guide = new THREE.LineLoop(geometry, material);
        guide.renderOrder = 5;
        tree.add(guide);
      }

      // Star shape at the crown.
      const starShape = new THREE.Shape();
      const starPoints = 8;
      for (let i = 0; i < starPoints * 2; i += 1) {
        const angle = -Math.PI / 2 + (i * Math.PI) / starPoints;
        const radius = i % 2 === 0 ? 0.48 : 0.145;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) starShape.moveTo(x, y);
        else starShape.lineTo(x, y);
      }
      starShape.closePath();
      const starGeo = new THREE.ShapeGeometry(starShape);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffe3b6 });
      const starMesh = new THREE.Mesh(starGeo, starMat);
      starMesh.position.set(0, topY + 0.48, 0);
      tree.add(starMesh);
      this._starMesh = starMesh;

      const starGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this._glowTexture,
          color: 0xffcbb0,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      starGlow.position.set(0, topY + 0.48, 0);
      starGlow.scale.set(3.1, 3.1, 1);
      tree.add(starGlow);
      this._starGlow = starGlow;

      const starBurst = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this._burstTexture,
          color: 0xffe5c3,
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      starBurst.position.set(0, topY + 0.48, -0.2);
      starBurst.scale.set(9.5, 9.5, 1);
      tree.add(starBurst);
      this._starBurst = starBurst;

      const starHalo = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this._glowTexture,
          color: 0xd77f92,
          transparent: true,
          opacity: 0.14,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      starHalo.position.set(0, topY + 0.4, -0.4);
      starHalo.scale.set(14, 14, 1);
      tree.add(starHalo);
      this._starHalo = starHalo;

      // A few cinematic, out-of-focus light blooms behind the tree.
      const bokeh = new THREE.Group();
      const bokehMatA = new THREE.SpriteMaterial({
        map: this._glowTexture,
        color: 0xe59a8f,
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const bokehMatB = new THREE.SpriteMaterial({
        map: this._glowTexture,
        color: 0xffcda7,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const rand = seeded(70707);
      for (let i = 0; i < 11; i += 1) {
        const sprite = new THREE.Sprite(i % 3 === 0 ? bokehMatA : bokehMatB);
        const angle = rand() * TAU;
        const radius = 5.5 + rand() * 5;
        sprite.position.set(Math.cos(angle) * radius, -1.5 + rand() * 7, -4 - rand() * 4);
        const scale = 2.5 + rand() * 5;
        sprite.scale.set(scale, scale, 1);
        bokeh.add(sprite);
      }
      this.world.add(bokeh);
      this._bokeh = bokeh;
    }

    _buildSnow() {
      const count = window.matchMedia("(pointer: coarse)").matches ? 310 : 520;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const speeds = new Float32Array(count);
      const drift = new Float32Array(count);
      const rand = seeded(43120);
      const warm = new THREE.Color(0xffe0c2);
      const rose = new THREE.Color(0xffc4cb);
      for (let i = 0; i < count; i += 1) {
        positions[i * 3] = (rand() - 0.5) * 24;
        positions[i * 3 + 1] = -5 + rand() * 13;
        positions[i * 3 + 2] = -10 + rand() * 18;
        const color = rand() > 0.75 ? rose : warm;
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
        speeds[i] = 0.08 + rand() * 0.22;
        drift[i] = (rand() - 0.5) * 0.09;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.055,
        map: this._dotTexture,
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const snow = new THREE.Points(geo, mat);
      this.scene.add(snow);
      this._snow = { points: snow, positions, speeds, drift, count };
    }

    /* ───────────────────────────── interaction ───────────────────────── */

    _bindEvents() {
      this._bound.pointerDown = (event) => this._onPointerDown(event);
      this._bound.pointerMove = (event) => this._onPointerMove(event);
      this._bound.pointerUp = (event) => this._onPointerUp(event);
      this._bound.pointerCancel = (event) => this._endDrag(event, false);
      this._bound.pointerLeave = () => this._clearHover();
      this._bound.wheel = (event) => this._onWheel(event);
      this._bound.resize = () => this._resize();
      this._bound.visibility = () => {
        if (document.hidden) this._lastFrame = 0;
      };
      this._bound.context = (event) => event.preventDefault();

      this.canvas.addEventListener("pointerdown", this._bound.pointerDown);
      this.canvas.addEventListener("pointermove", this._bound.pointerMove);
      this.canvas.addEventListener("pointerup", this._bound.pointerUp);
      this.canvas.addEventListener("pointercancel", this._bound.pointerCancel);
      this.canvas.addEventListener("pointerleave", this._bound.pointerLeave);
      this.canvas.addEventListener("wheel", this._bound.wheel, { passive: false });
      this.canvas.addEventListener("contextmenu", this._bound.context);
      window.addEventListener("resize", this._bound.resize);
      document.addEventListener("visibilitychange", this._bound.visibility);
    }

    _onPointerDown(event) {
      if (!this.active) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      this.dragging = true;
      this._pointerDown = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
        orbitOffset: this.orbitOffset,
        cameraY: this.dragY,
        moved: false,
      };
      this._clearHover();
      this.canvas.classList.add("is-dragging");
      try { this.canvas.setPointerCapture(event.pointerId); } catch {}
    }

    _onPointerMove(event) {
      if (!this.active) return;
      this.pointerRaw.x = event.clientX;
      this.pointerRaw.y = event.clientY;
      const rect = this.canvas.getBoundingClientRect();
      this.pointerNorm.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerNorm.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);

      if (this.dragging && this._pointerDown) {
        const deltaX = event.clientX - this._pointerDown.x;
        const deltaY = event.clientY - this._pointerDown.y;
        if (Math.abs(deltaX) + Math.abs(deltaY) > 5) this._pointerDown.moved = true;
        this.orbitOffset = clamp(this._pointerDown.orbitOffset + deltaX * 0.0045, -1.05, 1.05);
        this.dragY = clamp(this._pointerDown.cameraY - deltaY * 0.003, -1.25, 1.65);
        return;
      }

      if (event.pointerType === "touch") return;
      this._pick(event.clientX, event.clientY);
    }

    _onPointerUp(event) {
      if (!this.dragging) return;
      const wasClick = this._pointerDown && !this._pointerDown.moved && performance.now() - this._pointerDown.time < 900;
      const x = event.clientX;
      const y = event.clientY;
      this._endDrag(event, false);
      if (wasClick) {
        let entry = this._pick(x, y, true);
        // On a phone the prints are small and gestural; allow a forgiving
        // nearest-print tap rather than demanding a pixel-perfect plane hit.
        if (!entry && (event.pointerType === "touch" || event.pointerType === "pen")) {
          entry = this._pickNearest(x, y, 38);
        }
        if (entry) {
          this.callbacks.onSelect?.(entry.item, { x, y });
        }
      }
    }

    _pickNearest(clientX, clientY, maxDistance = 34) {
      if (!this.camera || !this.entries.length) return null;
      const rect = this.canvas.getBoundingClientRect();
      this.camera.updateMatrixWorld();
      this.scene.updateMatrixWorld();
      let best = null;
      let bestScore = maxDistance * maxDistance;
      for (const entry of this.entries) {
        const point = entry.group.position.clone().project(this.camera);
        if (point.z < -1 || point.z > 1) continue;
        const x = (point.x * 0.5 + 0.5) * rect.width;
        const y = (-point.y * 0.5 + 0.5) * rect.height;
        const dx = x - clientX;
        const dy = y - clientY;
        const distance = dx * dx + dy * dy;
        if (distance < bestScore) {
          bestScore = distance;
          best = entry;
        }
      }
      return best;
    }

    _endDrag(event, cancelled) {
      if (!this.dragging) return;
      this.dragging = false;
      this._pointerDown = null;
      this.canvas.classList.remove("is-dragging");
      try { this.canvas.releasePointerCapture?.(event.pointerId); } catch {}
      if (cancelled) this._clearHover();
    }

    _pick(clientX, clientY, force) {
      if (!this.active || !this.camera || !this.interactive.length) return null;
      const rect = this.canvas.getBoundingClientRect();
      const normalized = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1)
      );
      this.camera.updateMatrixWorld();
      this.scene.updateMatrixWorld();
      this._raycaster.setFromCamera(normalized, this.camera);
      const hits = this._raycaster.intersectObjects(this.interactive, false);
      if (!hits.length) {
        if (this.hovered) this._setHover(null);
        return null;
      }
      const entry = hits[0].object.userData.photoEntry;
      if (!entry) return null;
      if (!force && this.hovered !== entry) this._setHover(entry);
      if (!force) {
        this.callbacks.onHover?.(entry.item, this.pointerRaw.x, this.pointerRaw.y);
      }
      return entry;
    }

    _setHover(entry) {
      if (this.hovered === entry) return;
      if (this.hovered) this.hovered.hovered = false;
      this.hovered = entry;
      if (entry) {
        entry.hovered = true;
        this.canvas.classList.add("is-hovering");
        this._hoverGlow.visible = true;
        this._hoverGlow.material.opacity = 0.34;
        this.callbacks.onHover?.(entry.item, this.pointerRaw.x, this.pointerRaw.y);
      } else {
        this.canvas.classList.remove("is-hovering");
        this._hoverGlow.visible = false;
        if (this._hoverFrame) this._hoverFrame.visible = false;
        this.callbacks.onHover?.(null);
      }
    }

    _clearHover() {
      if (this.hovered) this._setHover(null);
      this.canvas.classList.remove("is-hovering");
    }

    _onWheel(event) {
      if (!this.active) return;
      event.preventDefault();
      if (this.dragging) return;
      this.zoomDelta = clamp(this.zoomDelta + event.deltaY * 0.011, -6.5, 8.5);
    }

    zoomIn() {
      this.zoomDelta = clamp(this.zoomDelta - 1.45, -6.5, 8.5);
    }

    zoomOut() {
      this.zoomDelta = clamp(this.zoomDelta + 1.45, -6.5, 8.5);
    }

    resetView() {
      this.zoomDelta = 0;
      this.orbitOffset = 0;
      this.dragY = 0;
      this.swayPhase = 0;
      this._clearHover();
      this.callbacks.onReset?.();
    }

    setFocus(seriesKey) {
      this.focusSeries = seriesKey || null;
      this._applyFocus();
    }

    _applyFocus() {
      this.entries.forEach((entry) => {
        const match = !this.focusSeries || entry.item.seriesKey === this.focusSeries;
        entry.targetScale = entry.scale * (match ? 1 : 0.89);
      });
    }

    setPaused(paused) {
      this.paused = Boolean(paused);
    }

    setActive(active) {
      if (!this.ready) {
        this.active = Boolean(active);
        return;
      }
      this.active = Boolean(active);
      if (active) {
        this._lastFrame = performance.now();
        if (!this.introStart) {
          this.introStart = performance.now();
        }
        this.canvas.classList.remove("is-hovering");
        this._clearHover();
      } else {
        this._clearHover();
        this._lastFrame = 0;
      }
    }

    resize() {
      this._resize();
    }

    _resize() {
      if (!this.renderer) return;
      const width = this.canvas.clientWidth || window.innerWidth;
      const height = this.canvas.clientHeight || window.innerHeight;
      if (width === this._lastWidth && height === this._lastHeight) return;
      this._lastWidth = width;
      this._lastHeight = height;

      this.isMobile = width < 760 || (height > width * 1.08 && width < 1100);
      this.isCompact = width < 1120;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.isMobile ? this.pixelRatioCap * 0.92 : this.pixelRatioCap));
      this.renderer.setSize(width, height, false);

      this.camera.aspect = width / Math.max(1, height);
      this.camera.fov = this.isMobile ? 52 : 45;
      this.camera.updateProjectionMatrix();

      this.baseZ = this.isMobile ? 20.2 : this.isCompact ? 19.0 : 16.8;
      this.baseCameraY = this.isMobile ? 1.4 : 1.12;

      if (this.world) {
        this.world.position.x = width >= 1180 ? 1.35 : width >= 760 ? 2.0 : 0;
        this.world.position.y = this.isMobile ? -3.05 : 0;
        this.world.scale.setScalar(this.isMobile ? 0.85 : 1);
      }
      this.cameraTargetZ = this.baseZ + this.zoomDelta;
      if (!this.ready) this.camera.position.z = this.baseZ + 6;
    }

    /* ─────────────────────────────── loop ───────────────────────────── */

    _loop(now) {
      if (this._destroyed) return;
      this._raf = requestAnimationFrame(this._loop);
      if (!this.active || !this.ready) {
        if (this.active && !this.ready && this.camera) {
          // Fine to keep the stage quiet until the plates are ready.
        }
        return;
      }

      if (!this._lastFrame) this._lastFrame = now;
      const dt = Math.min(0.05, (now - this._lastFrame) / 1000);
      this._lastFrame = now;
      this.time += dt;
      if (!this.paused) {
        this.swayPhase += dt * 0.2;
      }

      const intro = this.introStart
        ? clamp((now - this.introStart) / 3000, 0, 1)
        : 1;
      this.introDone = intro >= 1;
      const introEase = easeOutQuint(intro);

      // Camera breathing / pointer parallax.
      const parallaxX = this.pointerNorm.x * (this.isMobile ? 0.18 : 0.55);
      const parallaxY = this.pointerNorm.y * (this.isMobile ? 0.08 : 0.25);
      const targetCamX = parallaxX;
      const targetCamY = this.baseCameraY + this.dragY + parallaxY;
      this.camera.position.x += (targetCamX - this.camera.position.x) * 0.035;
      this.camera.position.y += (targetCamY - this.camera.position.y) * 0.045;
      this.cameraTargetZ = this.baseZ + this.zoomDelta;
      this.camera.position.z += (this.cameraTargetZ - this.camera.position.z) * 0.055;
      if (!this._introCameraDone) {
        const startZ = this.baseZ + 5.5;
        this.camera.position.z = lerp(startZ, this.baseZ + this.zoomDelta, easeOutCubic(intro));
        this.camera.position.y = lerp(this.baseCameraY + 1.15, targetCamY, easeOutCubic(intro));
        if (intro >= 1) this._introCameraDone = true;
      }
      this.camera.lookAt(0, this.isMobile ? 0.25 : 0.45, 0);

      const orbitBase = Math.sin(this.swayPhase) * 0.30 + this.orbitOffset;
      for (const entry of this.entries) {
        const angle = entry.baseAngle + orbitBase * entry.speed;
        const radius = entry.radius * lerp(0.62, 1, introEase);
        const bob = Math.sin(this.time * entry.bobSpeed + entry.phase) * entry.bobAmp;
        const y = entry.y + bob;
        entry.group.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        entry.group.quaternion.copy(this.camera.quaternion);
        entry.group.rotateZ(entry.tilt + Math.sin(this.time * 0.27 + entry.phase) * 0.014);

        const matching = !this.focusSeries || entry.item.seriesKey === this.focusSeries;
        const wantTone = entry.hovered ? 1.14 : matching ? 1 : 0.28;
        const wantScale = entry.scale * (entry.hovered ? 1.62 : matching ? 1 : 0.9) * lerp(0.28, 1, introEase);
        entry.tone = lerp(entry.tone, wantTone, 0.12);
        entry.currentScale = lerp(entry.currentScale || entry.scale * 0.3, wantScale, 0.12);
        entry.group.scale.setScalar(entry.currentScale);
        const tone = entry.tone;
        entry.material.color.setRGB(tone, tone * 0.985, tone * 0.955);

        if (entry.hovered) {
          const dir = this.camera.position.clone().sub(entry.group.position).normalize();
          this._hoverGlow.position.copy(entry.group.position).addScaledVector(dir, -0.19);
          this._hoverGlow.material.opacity = 0.27 + Math.sin(this.time * 2.2) * 0.03;
          if (this._hoverFrame) {
            this._hoverFrame.visible = true;
            this._hoverFrame.position.copy(entry.group.position).addScaledVector(dir, -0.018);
            this._hoverFrame.quaternion.copy(entry.group.quaternion);
            this._hoverFrame.scale.setScalar(entry.currentScale);
          }
        }
      }

      // Star and garland shimmer.
      if (this._starGlow) {
        const pulse = 0.5 + Math.sin(this.time * 1.55) * 0.06 + Math.sin(this.time * 0.61) * 0.035;
        this._starGlow.material.opacity = 0.5 + pulse * 0.36;
        this._starGlow.scale.setScalar(3.0 + pulse * 0.55);
      }
      if (this._starBurst) {
        this._starBurst.material.rotation = this.time * 0.008;
        this._starBurst.material.opacity = 0.68 + Math.sin(this.time * 1.1) * 0.055;
      }
      if (this._starMesh) {
        this._starMesh.rotation.z = Math.sin(this.time * 0.22) * 0.11;
      }
      if (this._bulbs) {
        this._bulbs.material.opacity = 0.82 + Math.sin(this.time * 1.2) * 0.06;
      }
      if (this._bokeh) {
        this._bokeh.rotation.y = Math.sin(this.time * 0.018) * 0.04;
      }

      // Snowfall.
      if (this._snow) {
        const positions = this._snow.positions;
        for (let i = 0; i < this._snow.count; i += 1) {
          positions[i * 3 + 1] -= this._snow.speeds[i] * dt;
          positions[i * 3] += Math.sin(this.time * 0.13 + i) * 0.0008;
          if (positions[i * 3 + 1] < -5) {
            positions[i * 3 + 1] = 8;
            positions[i * 3] = (Math.random() - 0.5) * 24;
          }
        }
        this._snow.points.geometry.attributes.position.needsUpdate = true;
      }

      this.renderer.render(this.scene, this.camera);

      // A single gentle degradation pass on slower machines.
      if (!this._qualityChecked && this.time > 2.8) {
        this._frameSamples.push(now);
        if (this._frameSamples.length > 90) this._frameSamples.shift();
        if (this._frameSamples.length === 90) {
          const elapsed = (this._frameSamples[this._frameSamples.length - 1] - this._frameSamples[0]) / 1000;
          const fps = 89 / Math.max(0.001, elapsed);
          if (fps < 43) {
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1));
            this._snow.points.visible = false;
          }
          this._qualityChecked = true;
        }
      }
    }

    destroy() {
      this._destroyed = true;
      cancelAnimationFrame(this._raf);
      this.canvas.removeEventListener("pointerdown", this._bound.pointerDown);
      this.canvas.removeEventListener("pointermove", this._bound.pointerMove);
      this.canvas.removeEventListener("pointerup", this._bound.pointerUp);
      this.canvas.removeEventListener("pointercancel", this._bound.pointerCancel);
      this.canvas.removeEventListener("pointerleave", this._bound.pointerLeave);
      this.canvas.removeEventListener("wheel", this._bound.wheel);
      this.canvas.removeEventListener("contextmenu", this._bound.context);
      window.removeEventListener("resize", this._bound.resize);
      document.removeEventListener("visibilitychange", this._bound.visibility);
      try {
        this._clearContent();
        this.renderer.dispose();
      } catch {}
    }
  }

  window.StellarTree = StellarTree;
})();
