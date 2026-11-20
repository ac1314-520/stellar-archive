/* ═══════════════════════════════════════════════════════════════════════
   STELLAR ARCHIVE · the little winter tree
   A slow 3D turntable: the tree and its photographs turn together.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const THREE = window.THREE;
  if (!THREE) return;

  const TAU = Math.PI * 2;
  const IS_MOBILE = window.matchMedia("(max-width: 760px)").matches;

  function smoothstep(edge0, edge1, value) {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  function seeded(seed) {
    let state = seed >>> 0;
    return function random() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvasTexture(size, paint) {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    paint(ctx, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    return texture;
  }

  function softDotTexture() {
    return canvasTexture(64, (ctx, size) => {
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      gradient.addColorStop(0, "rgba(255,255,255,1)");
      gradient.addColorStop(0.24, "rgba(255,255,255,.92)");
      gradient.addColorStop(0.55, "rgba(255,255,255,.36)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, size, size);
    });
  }

  function needleTexture() {
    return canvasTexture(32, (ctx, size) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, size);
      gradient.addColorStop(0, "rgba(255,255,255,0)");
      gradient.addColorStop(0.28, "rgba(255,255,255,.8)");
      gradient.addColorStop(0.68, "rgba(255,255,255,.54)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(size * 0.5, size * 0.52, size * 0.13, size * 0.38, 0, 0, TAU);
      ctx.fill();
    });
  }

  function starShape() {
    const shape = new THREE.Shape();
    const points = 5;
    for (let i = 0; i < points * 2; i += 1) {
      const angle = -Math.PI / 2 + (i / (points * 2)) * TAU;
      const radius = i % 2 === 0 ? 0.48 : 0.195;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.closePath();
    return shape;
  }

  class StellarTreeScene {
    constructor(canvas, options = {}) {
      if (!canvas) throw new Error("Tree canvas is missing");
      if (!window.WebGLRenderingContext) throw new Error("WebGL is not available");

      this.canvas = canvas;
      this.onPhotoClick = options.onPhotoClick || null;
      this.onPhotoHover = options.onPhotoHover || null;
      this.onZoom = options.onZoom || null;
      this.random = seeded(20261224);
      this.mobile = IS_MOBILE;
      this.paused = false;
      this.active = false;
      this.pointers = new Map();
      this.tap = null;
      this.pinching = false;
      this.pinchStart = null;
      this.zoom = 1;
      this.minZoom = 0.78;
      this.maxZoom = 1.42;
      this.zoomOriginY = 3.55;
      this.spread = 0;
      this.spreadTarget = 0;
      this.treeRotation = 0;
      this.treeSpeed = 0.105;
      this.particleMaterials = [];
      this.scatterObjects = [];
      this.aura = null;
      this.starSprite = null;
      this.sOffset = 0;
      this.photoSpeed = 0.012;
      this.lastTime = performance.now();
      this.raf = 0;
      this.items = [];
      this.cards = [];
      this.cardToken = 0;
      this.hoverItem = null;
      this.lastHoverAt = 0;
      this.dpr = 1;
      this.raycaster = new THREE.Raycaster();
      this.pointer = new THREE.Vector2();

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(33, 1, 0.1, 60);
      // A little closer than the ring version: the tree is the protagonist and
      // the photograph ribbon needs room to hug its branches.
      this.camera.position.set(0, 4.2, 13.55);
      this.camera.lookAt(new THREE.Vector3(0, 3.5, 0));

      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
      this.renderer.setClearAlpha(0);
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.02;
      this.renderer.shadowMap.enabled = !this.mobile;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      this.root = new THREE.Group();
      this.root.rotation.y = 0;
      this.root.scale.setScalar(this.zoom);
      this.scene.add(this.root);

      // The tree body (particles, apples, gifts, star) turns slowly; the
      // photographs stay in a readable S in front of it.
      this.treeRoot = new THREE.Group();
      this.treeRoot.name = "the-particle-tree";
      this.root.add(this.treeRoot);

      this.cardGroup = new THREE.Group();
      this.cardGroup.name = "the-photographs";
      this.root.add(this.cardGroup);

      this.glowTexture = softDotTexture();
      this.needleTexture = needleTexture();
      this.lightMaterial = null;
      this.lightUniforms = null;
      this.snowPositions = null;
      this.snowPoints = null;
      this.starGlow = null;
      this.starGroup = null;

      this.buildLights();
      this.buildTree();
      this.buildPhotoRibbonSettings();
      this.buildSnow();
      this.bindPointer();
      this.resize();
      this.renderFrame(performance.now(), true);
      this.tick = this.tick.bind(this);
      this.raf = requestAnimationFrame(this.tick);
    }

    /* ───────────────────────────── setup ───────────────────────────── */

    buildLights() {
      const scene = this.scene;
      scene.add(new THREE.HemisphereLight(0x8eaba1, 0x0c0809, 0.36));

      const key = new THREE.DirectionalLight(0xffd0a0, 1.55);
      key.position.set(4.6, 8.5, 7);
      key.castShadow = !this.mobile;
      if (key.castShadow) {
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = -5;
        key.shadow.camera.right = 5;
        key.shadow.camera.top = 8;
        key.shadow.camera.bottom = -1;
        key.shadow.bias = -0.0006;
      }
      scene.add(key);

      const rim = new THREE.DirectionalLight(0x7ec7b0, 0.8);
      rim.position.set(-5.5, 5.6, -4.5);
      scene.add(rim);

      const fill = new THREE.PointLight(0xffb067, 0.42, 18, 2);
      fill.position.set(0.4, 3.2, 5.6);
      scene.add(fill);

      const baseLight = new THREE.PointLight(0xe79252, 0.34, 9, 2);
      baseLight.position.set(-1.5, 0.55, 3.2);
      scene.add(baseLight);
    }

    buildGroundGlow() {
      const texture = canvasTexture(256, (ctx, size) => {
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, "rgba(236,196,132,.5)");
        gradient.addColorStop(0.32, "rgba(159,83,54,.22)");
        gradient.addColorStop(1, "rgba(30,8,10,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      });
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 9),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.012;
      mesh.renderOrder = -3;
      this.scene.add(mesh);

      const shadowTexture = canvasTexture(256, (ctx, size) => {
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, "rgba(0,0,0,.62)");
        gradient.addColorStop(0.56, "rgba(0,0,0,.28)");
        gradient.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      });
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(6.2, 4.2),
        new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }),
      );
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.018;
      shadow.renderOrder = -2;
      this.scene.add(shadow);

      const snowTexture = canvasTexture(256, (ctx, size) => {
        const gradient = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
        gradient.addColorStop(0, "rgba(224,229,218,.32)");
        gradient.addColorStop(0.36, "rgba(180,190,176,.16)");
        gradient.addColorStop(1, "rgba(120,130,120,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      });
      const snowPool = new THREE.Mesh(
        new THREE.PlaneGeometry(5.6, 4.1),
        new THREE.MeshBasicMaterial({ map: snowTexture, transparent: true, depthWrite: false, toneMapped: false }),
      );
      snowPool.rotation.x = -Math.PI / 2;
      snowPool.position.y = 0.022;
      snowPool.renderOrder = -1;
      this.scene.add(snowPool);
    }

    buildTree() {
      this.buildGroundGlow();
      this.buildTreeAura();
      this.buildParticleTree();
      this.buildApples();
      this.buildGiftObjects();
      this.buildParticleStar();
    }

    buildTreeAura() {
      const texture = canvasTexture(256, (ctx, size) => {
        const gradient = ctx.createRadialGradient(size / 2, size * 0.58, 2, size / 2, size * 0.58, size / 2);
        gradient.addColorStop(0, "rgba(109,181,127,.25)");
        gradient.addColorStop(0.45, "rgba(54,118,82,.13)");
        gradient.addColorStop(1, "rgba(10,30,20,0)");
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);
      });
      const aura = new THREE.Sprite(new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.65,
      }));
      aura.scale.set(7.4, 8.4, 1);
      aura.position.y = 3.4;
      this.root.add(aura);
      this.aura = aura;
    }

    makeParticleMaterial(alpha, sizeFactor = 1) {
      const uniforms = {
        uTime: { value: 0 },
        uSpread: { value: 0 },
        uSpreadX: { value: 1 },
        uMap: { value: this.glowTexture },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          uniform float uSpread;
          uniform float uSpreadX;
          attribute vec3 aColor;
          attribute vec3 aScatter;
          attribute float aSize;
          attribute float aPhase;
          varying vec3 vColor;
          varying float vPhase;
          void main() {
            vec3 p = position + aScatter * vec3(uSpreadX, 1.0, 1.0) * uSpread;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_PointSize = aSize * ${sizeFactor.toFixed(3)} * (430.0 / max(1.0, -mv.z));
            gl_Position = projectionMatrix * mv;
            vColor = aColor;
            vPhase = aPhase;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform sampler2D uMap;
          varying vec3 vColor;
          varying float vPhase;
          void main() {
            vec4 tex = texture2D(uMap, gl_PointCoord);
            float twinkle = 0.74 + 0.26 * sin(uTime * 1.8 + vPhase);
            gl_FragColor = vec4(vColor, tex.a * twinkle * ${alpha.toFixed(3)});
          }
        `,
      });
      this.particleMaterials.push(material);
      return material;
    }

    makeParticleGeometry(entries) {
      const count = entries.length;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const phases = new Float32Array(count);
      const scatter = new Float32Array(count * 3);
      entries.forEach((entry, index) => {
        positions[index * 3] = entry.x;
        positions[index * 3 + 1] = entry.y;
        positions[index * 3 + 2] = entry.z;
        colors[index * 3] = entry.color.r;
        colors[index * 3 + 1] = entry.color.g;
        colors[index * 3 + 2] = entry.color.b;
        sizes[index] = entry.size;
        phases[index] = entry.phase;
        scatter[index * 3] = entry.scatter.x;
        scatter[index * 3 + 1] = entry.scatter.y;
        scatter[index * 3 + 2] = entry.scatter.z;
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
      geometry.setAttribute("aScatter", new THREE.BufferAttribute(scatter, 3));
      return geometry;
    }

    scatterTarget(wide = false) {
      const random = this.random;
      return new THREE.Vector3(
        (random() - 0.5) * (wide ? 11 : 8.5),
        random() * 8.4 - 0.4,
        (random() - 0.5) * (wide ? 7 : 5.5),
      );
    }

    buildParticleTree() {
      const random = this.random;
      const mobile = this.mobile;
      const bottom = 0.38;
      const top = 6.78;
      const branchCount = mobile ? 380 : 680;
      const perBranch = mobile ? 25 : 33;
      const fillCount = mobile ? 5500 : 11000;
      const entries = [];

      const add = (x, y, z, color, size, scatter) => {
        entries.push({
          x, y, z, color, size,
          phase: random() * TAU,
          scatter: scatter || this.scatterTarget(),
        });
      };

      const green = (t, brightness = 0) => {
        const color = new THREE.Color();
        color.setHSL(
          0.335 + random() * 0.055,
          0.48 + random() * 0.28,
          0.16 + brightness + random() * 0.17 - t * 0.015,
        );
        return color;
      };

      for (let branch = 0; branch < branchCount; branch += 1) {
        const tier = Math.floor(random() * 34);
        const t = tier / 33;
        const y = bottom + (1 - t) * 0.15 + (1 - t) * 6.2 + (random() - 0.5) * 0.12;
        const radius = this.treeRadiusAt(y);
        const angle = branch * 2.399 + random() * 0.28 + t * 0.4;
        const length = radius * (0.42 + random() * 0.62);
        const droop = 0.06 + random() * 0.24;
        const branchBrightness = random() * 0.12;
        for (let j = 0; j < perBranch; j += 1) {
          const u = j / (perBranch - 1);
          const r = length * Math.pow(u, 0.92);
          const jitter = (random() - 0.5) * 0.12;
          const x = Math.cos(angle) * r + Math.cos(angle + 1.5) * jitter;
          const z = Math.sin(angle) * r + Math.sin(angle + 1.5) * jitter;
          const yy = y - droop * u * u + (random() - 0.5) * 0.06;
          const gold = random() < 0.045;
          const color = gold
            ? new THREE.Color().setHSL(0.105 + random() * 0.035, 0.65, 0.4 + random() * 0.18)
            : green(t, branchBrightness + u * 0.06);
          const size = (gold ? 0.2 : 0.11) + random() * 0.13;
          add(x, yy, z, color, size);
        }
      }

      for (let i = 0; i < fillCount; i += 1) {
        const t = Math.pow(random(), 0.82);
        const y = bottom + t * 6.42;
        const radius = this.treeRadiusAt(y);
        const angle = random() * TAU;
        const r = radius * (0.24 + random() * 0.74);
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const gold = random() < 0.025;
        const color = gold
          ? new THREE.Color().setHSL(0.11, 0.6, 0.42)
          : green(1 - t, random() * 0.05);
        add(x, y, z, color, 0.075 + random() * 0.13);
      }

      const foliage = new THREE.Points(
        this.makeParticleGeometry(entries),
        this.makeParticleMaterial(0.42),
      );
      foliage.frustumCulled = false;
      this.treeRoot.add(foliage);

      // A golden thread wound through the cone, also made of particles.
      const spiralEntries = [];
      const spiralCount = mobile ? 1500 : 2800;
      for (let i = 0; i < spiralCount; i += 1) {
        const t = i / spiralCount;
        const y = 0.55 + t * 5.95;
        const angle = t * TAU * 6.1 + (i % 2) * Math.PI;
        const radius = this.treeRadiusAt(y) * (0.95 + random() * 0.06);
        spiralEntries.push({
          x: Math.cos(angle) * radius,
          y: y + (random() - 0.5) * 0.025,
          z: Math.sin(angle) * radius,
          color: new THREE.Color().setHSL(0.105 + random() * 0.025, 0.66, 0.45 + random() * 0.18),
          size: 0.075 + random() * 0.09,
          phase: random() * TAU,
          scatter: this.scatterTarget(),
        });
      }
      const spiral = new THREE.Points(
        this.makeParticleGeometry(spiralEntries),
        this.makeParticleMaterial(0.82),
      );
      spiral.frustumCulled = false;
      this.treeRoot.add(spiral);

      // Brighter little bulbs on the surface.
      const lightEntries = [];
      const lightCount = mobile ? 240 : 420;
      for (let i = 0; i < lightCount; i += 1) {
        const t = random();
        const y = 0.55 + t * 5.95;
        const angle = random() * TAU;
        const radius = this.treeRadiusAt(y) * (0.86 + random() * 0.14);
        const color = random() < 0.8
          ? new THREE.Color().setHSL(0.12, 0.78, 0.62)
          : new THREE.Color().setHSL(0.13, 0.42, 0.82);
        lightEntries.push({
          x: Math.cos(angle) * radius,
          y,
          z: Math.sin(angle) * radius,
          color,
          size: 0.22 + random() * 0.28,
          phase: random() * TAU,
          scatter: this.scatterTarget(),
        });
      }
      const lights = new THREE.Points(
        this.makeParticleGeometry(lightEntries),
        this.makeParticleMaterial(0.82, 1.04),
      );
      lights.frustumCulled = false;
      this.treeRoot.add(lights);
    }

    addScatterObject(object, base, target, baseRotation, targetRotation) {
      object.position.copy(base);
      if (baseRotation) object.rotation.copy(baseRotation);
      this.treeRoot.add(object);
      this.scatterObjects.push({
        object,
        base: base.clone(),
        target: target.clone(),
        baseRotation: baseRotation ? baseRotation.clone() : new THREE.Euler(),
        targetRotation: targetRotation ? targetRotation.clone() : new THREE.Euler(),
      });
    }

    buildApples() {
      const random = this.random;
      const count = this.mobile ? 22 : 34;
      const appleGeometry = new THREE.SphereGeometry(0.115, 14, 10);
      const appleMaterials = [0xbc2130, 0xd33a37, 0xa8162a].map((color) => new THREE.MeshStandardMaterial({
        color,
        roughness: 0.36,
        metalness: 0.08,
        emissive: new THREE.Color(color).multiplyScalar(0.08),
      }));
      const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x4b2914, roughness: 0.9 });
      const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x2f6d3b, roughness: 0.7 });

      for (let i = 0; i < count; i += 1) {
        const y = 1.0 + random() * 5.45;
        const angle = random() * TAU;
        const radius = this.treeRadiusAt(y) * (0.9 + random() * 0.08);
        const group = new THREE.Group();
        const apple = new THREE.Mesh(appleGeometry, appleMaterials[i % appleMaterials.length]);
        apple.scale.set(1, 0.9 + random() * 0.12, 1);
        group.add(apple);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.014, 0.09, 5), stemMaterial);
        stem.position.y = 0.12;
        group.add(stem);
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 5), leafMaterial);
        leaf.scale.set(1.5, 0.28, 0.65);
        leaf.position.set(0.04, 0.14, 0.02);
        leaf.rotation.z = -0.35;
        group.add(leaf);
        const base = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        group.rotation.set(random() * 0.4, random() * TAU, (random() - 0.5) * 0.35);
        group.scale.setScalar(0.8 + random() * 0.55);
        this.addScatterObject(
          group,
          base,
          new THREE.Vector3((random() - 0.5) * 8.5, random() * 7.5, (random() - 0.5) * 4.5),
          group.rotation,
          new THREE.Euler(random() * TAU, random() * TAU, random() * TAU),
        );
      }
    }

    buildGiftObjects() {
      const random = this.random;
      const count = this.mobile ? 9 : 15;
      const boxColors = [0x6c2130, 0x173e32, 0xc7b28a, 0x3c2828, 0x7c3a30];
      const ribbonMaterial = new THREE.MeshStandardMaterial({
        color: 0xd1a65d,
        metalness: 0.45,
        roughness: 0.3,
        emissive: 0x3a2408,
        emissiveIntensity: 0.35,
      });

      for (let i = 0; i < count; i += 1) {
        const size = 0.18 + random() * 0.28;
        const y = i < 5
          ? 0.32 + random() * 0.35
          : 0.9 + random() * 4.7;
        const angle = random() * TAU;
        const radius = i < 5
          ? 1.5 + random() * 1.1
          : this.treeRadiusAt(y) * (0.8 + random() * 0.22);
        const group = new THREE.Group();
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(size, size * 0.82, size),
          new THREE.MeshStandardMaterial({
            color: boxColors[i % boxColors.length],
            roughness: 0.6,
            metalness: 0.08,
          }),
        );
        group.add(box);
        const vertical = new THREE.Mesh(new THREE.BoxGeometry(size * 0.13, size * 0.84, size * 1.03), ribbonMaterial);
        group.add(vertical);
        const horizontal = new THREE.Mesh(new THREE.BoxGeometry(size * 1.03, size * 0.13, size * 0.84), ribbonMaterial);
        horizontal.position.y = size * 0.12;
        group.add(horizontal);
        const base = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        group.rotation.set(random() * 0.5, random() * TAU, random() * 0.3);
        group.scale.setScalar(0.8 + random() * 0.55);
        this.addScatterObject(
          group,
          base,
          new THREE.Vector3((random() - 0.5) * 9.5, random() * 7.8, (random() - 0.5) * 5),
          group.rotation,
          new THREE.Euler(random() * TAU, random() * TAU, random() * TAU),
        );
      }
    }

    makeStarTexture() {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      const glow = ctx.createRadialGradient(128, 128, 0, 128, 128, 124);
      glow.addColorStop(0, "rgba(255,230,171,.9)");
      glow.addColorStop(0.22, "rgba(255,201,108,.4)");
      glow.addColorStop(1, "rgba(255,170,50,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, 256, 256);
      ctx.translate(128, 128);
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const angle = -Math.PI / 2 + (i / 10) * TAU;
        const radius = i % 2 === 0 ? 78 : 28;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = "#f5d38a";
      ctx.shadowColor = "#ffb64d";
      ctx.shadowBlur = 22;
      ctx.fill();
      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      return texture;
    }

    buildParticleStar() {
      const star = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.makeStarTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.9,
      }));
      star.scale.set(1.45, 1.45, 1);
      star.position.y = 7.02;
      this.treeRoot.add(star);
      this.starSprite = star;

      const random = this.random;
      const entries = [];
      for (let i = 0; i < 90; i += 1) {
        const angle = random() * TAU;
        const radius = random() * 0.65;
        entries.push({
          x: Math.cos(angle) * radius,
          y: 7.02 + (random() - 0.5) * 0.8,
          z: Math.sin(angle) * radius,
          color: new THREE.Color().setHSL(0.12, 0.8, 0.72),
          size: 0.1 + random() * 0.16,
          phase: random() * TAU,
          scatter: this.scatterTarget(true),
        });
      }
      const halo = new THREE.Points(
        this.makeParticleGeometry(entries),
        this.makeParticleMaterial(0.8),
      );
      halo.frustumCulled = false;
      this.treeRoot.add(halo);
      const light = new THREE.PointLight(0xffbc64, 1.1, 6, 2);
      light.position.set(0, 7.02, 0.5);
      this.treeRoot.add(light);
      this.starLight = light;
    }

    buildTiers() {
      const group = new THREE.Group();
      const count = 24;
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.94,
        metalness: 0.01,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(0x010a06),
        emissiveIntensity: 0.25,
      });

      const inner = new THREE.Mesh(
        new THREE.ConeGeometry(2.18, 6.1, 36, 1, true),
        new THREE.MeshStandardMaterial({
          color: 0x04110b,
          roughness: 1,
          side: THREE.DoubleSide,
          emissive: 0x010704,
          emissiveIntensity: 0.3,
        }),
      );
      inner.position.y = 3.22;
      group.add(inner);

      for (let i = 0; i < count; i += 1) {
        const t = i / (count - 1);
        const y = 0.38 + t * 5.93;
        const radius = 2.38 * Math.pow(1 - t, 1.02) + 0.14;
        const height = 0.33 + (1 - t) * 0.05;
        const phase = this.random() * TAU;
        const geometry = this.makeTierGeometry(radius, radius * 0.55, height, 72, phase, t);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = y;
        mesh.rotation.y = phase * 0.35;
        mesh.castShadow = !this.mobile;
        mesh.receiveShadow = true;
        group.add(mesh);
      }
      this.root.add(group);
      this.tierGroup = group;
    }

    makeTierGeometry(bottomRadius, topRadius, height, segments, phase, t) {
      const positions = [];
      const colors = [];
      const indices = [];
      const bottomColor = new THREE.Color().setHSL(0.36, 0.55, 0.018 + t * 0.014);
      const topColor = new THREE.Color().setHSL(0.38, 0.48, 0.06 + t * 0.035);
      const fringeColor = new THREE.Color().setHSL(0.36, 0.52, 0.028 + t * 0.02);

      for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * TAU;
        const wave = 1 + Math.sin(angle * 5 + phase) * 0.032 + Math.sin(angle * 11 + phase * 1.7) * 0.016;
        const lowerY = -0.035 + Math.sin(angle * 7 + phase) * 0.055;
        const lowerR = bottomRadius * wave;
        positions.push(Math.cos(angle) * lowerR, lowerY, Math.sin(angle) * lowerR);
        colors.push(bottomColor.r, bottomColor.g, bottomColor.b);
        const upperR = topRadius * (1 + Math.sin(angle * 4 + phase * 0.8) * 0.035);
        positions.push(Math.cos(angle) * upperR, height + Math.sin(angle * 6 + phase) * 0.012, Math.sin(angle) * upperR);
        colors.push(topColor.r, topColor.g, topColor.b);
      }

      for (let i = 0; i < segments; i += 1) {
        const a = i * 2;
        const b = a + 1;
        const c = a + 2;
        const d = a + 3;
        indices.push(a, c, b, b, c, d);
      }

      // A second, hand-cut skirt of triangular branch tips. It breaks the
      // perfect cone and makes the silhouette read as pine rather than a hat.
      const fringeStart = positions.length / 3;
      for (let i = 0; i < segments; i += 1) {
        const angle = (i / segments) * TAU;
        const next = angle + TAU / segments;
        const wave = 1 + Math.sin(angle * 5 + phase) * 0.04;
        const drop = 0.055 + (i % 3) * 0.022;
        const r0 = bottomRadius * wave * 0.985;
        const r1 = bottomRadius * (1 + 0.045 + (i % 5) * 0.007);
        const mid = (angle + next) * 0.5;
        const base = fringeStart + i * 3;
        positions.push(
          Math.cos(angle) * r0, -0.04, Math.sin(angle) * r0,
          Math.cos(next) * r0, -0.04, Math.sin(next) * r0,
          Math.cos(mid) * r1, -drop, Math.sin(mid) * r1,
        );
        for (let k = 0; k < 3; k += 1) colors.push(fringeColor.r, fringeColor.g, fringeColor.b);
        indices.push(base, base + 1, base + 2);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      return geometry;
    }

    buildNeedles() {
      const count = this.mobile ? 5200 : 8800;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const random = this.random;
      for (let i = 0; i < count; i += 1) {
        const tier = Math.floor(random() * 24);
        const t = tier / 23;
        const tierY = 0.38 + t * 5.93;
        const tierRadius = 2.38 * Math.pow(1 - t, 1.02) + 0.14;
        const local = Math.pow(random(), 0.72);
        const angle = random() * TAU;
        const radius = tierRadius * (0.82 + random() * 0.23) * (1 - local * 0.28);
        const y = tierY + local * (0.33 + (1 - t) * 0.05) + (random() - 0.5) * 0.045;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        const lightness = 0.045 + random() * 0.115 + (1 - t) * 0.01;
        const color = new THREE.Color().setHSL(0.35 + random() * 0.03, 0.4 + random() * 0.16, lightness);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      const material = new THREE.PointsMaterial({
        map: this.needleTexture,
        size: this.mobile ? 0.068 : 0.058,
        vertexColors: true,
        transparent: true,
        opacity: 0.62,
        alphaTest: 0.04,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geometry, material);
      points.frustumCulled = false;
      this.root.add(points);
      this.needles = points;

      const frostCount = this.mobile ? 420 : 720;
      const frostPositions = new Float32Array(frostCount * 3);
      for (let i = 0; i < frostCount; i += 1) {
        const t = Math.pow(this.random(), 0.85);
        const y = 0.6 + t * 5.7;
        const radius = 2.3 * Math.pow(1 - t, 1.02) + 0.12;
        const angle = this.random() * TAU;
        frostPositions[i * 3] = Math.cos(angle) * radius * (0.98 + this.random() * 0.08);
        frostPositions[i * 3 + 1] = y;
        frostPositions[i * 3 + 2] = Math.sin(angle) * radius * (0.98 + this.random() * 0.08);
      }
      const frostGeometry = new THREE.BufferGeometry();
      frostGeometry.setAttribute("position", new THREE.BufferAttribute(frostPositions, 3));
      const frost = new THREE.Points(frostGeometry, new THREE.PointsMaterial({
        map: this.glowTexture,
        color: 0xf1f0dd,
        size: this.mobile ? 0.035 : 0.03,
        transparent: true,
        opacity: 0.46,
        alphaTest: 0.02,
        depthWrite: false,
        sizeAttenuation: true,
      }));
      frost.frustumCulled = false;
      this.root.add(frost);
    }

    buildGarland() {
      const gold = new THREE.MeshStandardMaterial({
        color: 0xd7a557,
        emissive: 0x6d3f12,
        emissiveIntensity: 0.5,
        metalness: 0.55,
        roughness: 0.3,
      });
      const strands = 2;
      for (let strand = 0; strand < strands; strand += 1) {
        const points = [];
        const turns = 6.4;
        for (let i = 0; i <= 190; i += 1) {
          const t = i / 190;
          const y = 0.55 + t * 5.8;
          const radius = 2.16 * Math.pow(1 - t, 1.02) + 0.24;
          const angle = t * TAU * turns + strand * Math.PI;
          points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius));
        }
        const curve = new THREE.CatmullRomCurve3(points);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 220, 0.015, 5, false), gold);
        tube.castShadow = false;
        this.root.add(tube);
      }

      const beadPositions = [];
      const beadColors = [];
      for (let i = 0; i < 150; i += 1) {
        const t = i / 150;
        const y = 0.62 + t * 5.72;
        const radius = 2.16 * Math.pow(1 - t, 1.02) + 0.23;
        const angle = t * TAU * 6.4 + (i % 2) * Math.PI;
        beadPositions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        beadColors.push(0.95, 0.67, 0.31);
      }
      const beadGeometry = new THREE.BufferGeometry();
      beadGeometry.setAttribute("position", new THREE.Float32BufferAttribute(beadPositions, 3));
      beadGeometry.setAttribute("color", new THREE.Float32BufferAttribute(beadColors, 3));
      const beads = new THREE.Points(beadGeometry, new THREE.PointsMaterial({
        map: this.glowTexture,
        color: 0xf2c178,
        size: 0.115,
        transparent: true,
        opacity: 0.9,
        alphaTest: 0.02,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }));
      this.root.add(beads);
    }

    buildOrnaments() {
      const colors = [0xa91f33, 0xe2b968, 0xd9d0ba, 0x2f7350, 0x7a2d53, 0xb76133];
      const geometry = new THREE.SphereGeometry(1, 16, 12);
      const materials = colors.map((color) => new THREE.MeshStandardMaterial({
        color,
        metalness: 0.56,
        roughness: 0.2,
        emissive: new THREE.Color(color).multiplyScalar(0.11),
        emissiveIntensity: 0.7,
      }));

      const random = this.random;
      for (let i = 0; i < 42; i += 1) {
        const t = 0.06 + random() * 0.86;
        const y = 0.45 + t * 5.88;
        const radius = 2.3 * Math.pow(1 - t, 1.02) + 0.15;
        const angle = random() * TAU;
        const size = 0.09 + random() * 0.09;
        const material = materials[i % materials.length];
        const ornament = new THREE.Mesh(geometry, material);
        ornament.position.set(
          Math.cos(angle) * radius,
          y + (random() - 0.5) * 0.12,
          Math.sin(angle) * radius,
        );
        ornament.scale.set(size * 1.2, size, size * 1.2);
        ornament.castShadow = false;
        this.root.add(ornament);
      }

      const starGeo = new THREE.OctahedronGeometry(0.11, 0);
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xe5bd76,
        emissive: 0x8d5a19,
        emissiveIntensity: 0.8,
        metalness: 0.7,
        roughness: 0.25,
      });
      for (let i = 0; i < 9; i += 1) {
        const t = 0.24 + random() * 0.63;
        const y = 0.45 + t * 5.88;
        const radius = 2.3 * Math.pow(1 - t, 1.02) + 0.17;
        const angle = random() * TAU;
        const star = new THREE.Mesh(starGeo, starMat);
        star.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        star.scale.setScalar(0.8 + random() * 0.65);
        this.root.add(star);
      }
    }

    buildLightsOnTree() {
      const count = this.mobile ? 160 : 230;
      const positions = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      const sizes = new Float32Array(count);
      const phases = new Float32Array(count);
      const palette = [
        [1, 0.79, 0.43],
        [1, 0.92, 0.68],
        [0.92, 0.54, 0.24],
        [0.74, 0.91, 0.65],
      ];
      const random = this.random;
      for (let i = 0; i < count; i += 1) {
        const t = random();
        const y = 0.45 + t * 5.95;
        const radius = 2.31 * Math.pow(1 - t, 1.02) + 0.12;
        const angle = random() * TAU;
        positions[i * 3] = Math.cos(angle) * radius * (1.01 + random() * 0.055);
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = Math.sin(angle) * radius * (1.01 + random() * 0.055);
        const color = palette[i % palette.length];
        colors[i * 3] = color[0];
        colors[i * 3 + 1] = color[1];
        colors[i * 3 + 2] = color[2];
        sizes[i] = 0.2 + random() * 0.18;
        phases[i] = random() * TAU;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
      geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
      geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

      const uniforms = {
        uTime: { value: 0 },
        uMap: { value: this.glowTexture },
      };
      const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexShader: `
          attribute vec3 aColor;
          attribute float aSize;
          attribute float aPhase;
          varying vec3 vColor;
          varying float vPhase;
          void main() {
            vColor = aColor;
            vPhase = aPhase;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = aSize * (440.0 / max(1.0, -mv.z));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform sampler2D uMap;
          varying vec3 vColor;
          varying float vPhase;
          void main() {
            vec4 tex = texture2D(uMap, gl_PointCoord);
            float twinkle = 0.58 + 0.42 * sin(uTime * 1.65 + vPhase);
            gl_FragColor = vec4(vColor, tex.a * twinkle * 0.92);
          }
        `,
      });
      const lights = new THREE.Points(geometry, material);
      lights.frustumCulled = false;
      this.root.add(lights);
      this.lightMaterial = material;
      this.lightUniforms = uniforms;
    }

    buildStar() {
      const geometry = new THREE.ExtrudeGeometry(starShape(), {
        depth: 0.065,
        bevelEnabled: true,
        bevelSegments: 2,
        steps: 1,
        bevelSize: 0.012,
        bevelThickness: 0.012,
      });
      geometry.center();
      const material = new THREE.MeshStandardMaterial({
        color: 0xd9ad63,
        emissive: 0x7d4714,
        emissiveIntensity: 0.55,
        metalness: 0.68,
        roughness: 0.24,
        side: THREE.DoubleSide,
      });
      const group = new THREE.Group();
      const front = new THREE.Mesh(geometry, material);
      front.scale.setScalar(0.56);
      group.add(front);
      const cross = new THREE.Mesh(geometry, material);
      cross.scale.setScalar(0.56);
      cross.rotation.y = Math.PI / 2;
      group.add(cross);
      group.position.y = 6.84;
      this.root.add(group);
      this.starGroup = group;

      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xffb95f,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        opacity: 0.36,
      }));
      glow.scale.setScalar(1.55);
      glow.position.y = 6.84;
      this.root.add(glow);
      this.starGlow = glow;

      const light = new THREE.PointLight(0xffb867, 0.9, 6.5, 2);
      light.position.set(0, 6.86, 0.5);
      this.root.add(light);
      this.starLight = light;
    }

    buildGifts() {
      const ribbon = new THREE.MeshStandardMaterial({
        color: 0xc19a58,
        metalness: 0.38,
        roughness: 0.32,
        emissive: 0x3d260b,
        emissiveIntensity: 0.4,
      });
      const boxes = [
        { x: -2.05, z: 0.75, size: 0.65, color: 0x6b2331, angle: -0.2 },
        { x: 1.75, z: 1.25, size: 0.52, color: 0x193e31, angle: 0.32 },
        { x: -1.8, z: -0.35, size: 0.38, color: 0x3b2b2a, angle: 0.8 },
      ];
      boxes.forEach((box) => {
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(box.size, box.size * 0.82, box.size),
          new THREE.MeshStandardMaterial({ color: box.color, roughness: 0.62, metalness: 0.1 }),
        );
        mesh.castShadow = !this.mobile;
        mesh.receiveShadow = true;
        group.add(mesh);
        const v = new THREE.Mesh(new THREE.BoxGeometry(box.size * 0.14, box.size * 0.84, box.size * 1.02), ribbon);
        v.position.y = 0.01;
        group.add(v);
        const h = new THREE.Mesh(new THREE.BoxGeometry(box.size * 1.02, box.size * 0.14, box.size * 0.84), ribbon);
        h.position.y = box.size * 0.16;
        group.add(h);
        group.position.set(box.x, box.size * 0.37 + 0.05, box.z);
        group.rotation.y = box.angle;
        this.root.add(group);
      });
    }

    buildSnow() {
      const count = this.mobile ? 120 : 200;
      const positions = new Float32Array(count * 3);
      const speeds = new Float32Array(count);
      for (let i = 0; i < count; i += 1) {
        const radius = 1.2 + this.random() * 4.4;
        const angle = this.random() * TAU;
        positions[i * 3] = Math.cos(angle) * radius;
        positions[i * 3 + 1] = this.random() * 8.2;
        positions[i * 3 + 2] = Math.sin(angle) * radius;
        speeds[i] = 0.08 + this.random() * 0.17;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      this.snowPositions = positions;
      this.snowSpeeds = speeds;
      this.snowPoints = new THREE.Points(geometry, new THREE.PointsMaterial({
        map: this.glowTexture,
        color: 0xfff1d8,
        size: 0.045,
        transparent: true,
        opacity: 0.56,
        alphaTest: 0.02,
        depthWrite: false,
        sizeAttenuation: true,
      }));
      this.scene.add(this.snowPoints);
    }

    buildPhotoRibbonSettings() {
      this.cardW = 0.82;
      this.cardH = 1.025;
      this.cardGeometry = new THREE.PlaneGeometry(this.cardW, this.cardH);
      this.cardMeshes = [];
    }

    /* ─────────────────────────── photographs ─────────────────────────── */

    loadCover(url) {
      return new Promise((resolve) => {
        if (!url) { resolve(null); return; }
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.decoding = "async";
        const finish = () => resolve(image);
        image.onload = finish;
        image.onerror = () => resolve(null);
        image.src = url;
        window.setTimeout(finish, 9000);
      });
    }

    async makeCardTexture(item) {
      const image = await this.loadCover(item.image);
      const canvas = document.createElement("canvas");
      canvas.width = 360;
      canvas.height = 450;
      const ctx = canvas.getContext("2d");
      const background = ctx.createLinearGradient(0, 0, 0, 450);
      background.addColorStop(0, "#161111");
      background.addColorStop(1, "#0a090a");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, 360, 450);

      // inner photograph area, kept at the source 4:5 ratio
      const ix = 20;
      const iy = 18;
      const iw = 320;
      const ih = 400;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect?.(ix, iy, iw, ih, 2);
      if (!ctx.roundRect) ctx.rect(ix, iy, iw, ih);
      ctx.clip();
      if (image && image.naturalWidth) {
        const scale = Math.max(iw / image.naturalWidth, ih / image.naturalHeight);
        const sw = image.naturalWidth * scale;
        const sh = image.naturalHeight * scale;
        ctx.drawImage(image, ix + (iw - sw) / 2, iy + (ih - sh) / 2, sw, sh);
      } else {
        const placeholder = ctx.createLinearGradient(ix, iy, ix + iw, iy + ih);
        placeholder.addColorStop(0, "#211a18");
        placeholder.addColorStop(1, "#3b2424");
        ctx.fillStyle = placeholder;
        ctx.fillRect(ix, iy, iw, ih);
        ctx.fillStyle = "rgba(238,207,157,.6)";
        ctx.font = '28px "Songti SC", "SimSun", serif';
        ctx.textAlign = "center";
        ctx.fillText("STELLAR", ix + iw / 2, iy + ih / 2);
      }
      const vignette = ctx.createLinearGradient(0, iy + ih * 0.64, 0, iy + ih);
      vignette.addColorStop(0, "rgba(8,7,8,0)");
      vignette.addColorStop(1, "rgba(8,7,8,.66)");
      ctx.fillStyle = vignette;
      ctx.fillRect(ix, iy + ih * 0.62, iw, ih * 0.38);
      ctx.restore();

      ctx.strokeStyle = "rgba(226,195,146,.55)";
      ctx.lineWidth = 1.2;
      ctx.strokeRect(12.5, 12.5, 335, 425);

      ctx.fillStyle = "rgba(236,209,167,.92)";
      ctx.font = '600 16px "Manrope", "PingFang SC", sans-serif';
      ctx.textAlign = "left";
      ctx.fillText(item.no || "NO. 001", ix, 438);
      ctx.fillStyle = "rgba(237,217,188,.66)";
      ctx.font = '12px "Manrope", "PingFang SC", sans-serif';
      ctx.textAlign = "right";
      ctx.fillText((item.series || "").slice(0, 18), 340, 438);

      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      texture.needsUpdate = true;
      return texture;
    }

    async setItems(items) {
      const token = ++this.cardToken;
      const previousGroup = this.cardGroup;
      const list = (items || []).slice(0, 12);
      this.items = list;
      const entries = await Promise.all(list.map(async (item, index) => {
        const texture = await this.makeCardTexture(item);
        return { item, texture, index };
      }));
      if (token !== this.cardToken) {
        entries.forEach(({ texture }) => texture.dispose());
        return;
      }

      const group = new THREE.Group();
      group.name = "winter-photo-ribbon";
      const nextCards = [];
      const count = entries.length;
      entries.forEach((entry, index) => {
        const material = new THREE.MeshBasicMaterial({
          map: entry.texture,
          transparent: true,
          side: THREE.DoubleSide,
          toneMapped: false,
          depthWrite: false,
          opacity: 0,
        });
        const mesh = new THREE.Mesh(this.cardGeometry, material);
        mesh.userData = {
          item: entry.item,
          texture: entry.texture,
          baseT: count ? index / count : 0,
          opacity: 0,
          scatterU: (this.random() - 0.5) * 1.7,
          scatterV: 0.12 + this.random() * 0.76,
          scatterZ: 0.9 + this.random() * 2.2,
          scatterTilt: (this.random() - 0.5) * 0.38,
        };
        group.add(mesh);
        nextCards.push(mesh);
      });

      this.root.add(group);
      if (previousGroup && previousGroup.children.length) {
        this.root.remove(previousGroup);
        previousGroup.traverse((child) => {
          if (!child.isMesh) return;
          child.userData.texture?.dispose?.();
          child.material?.dispose?.();
        });
      }
      this.cardGroup = group;
      this.cardMeshes = nextCards;
      this.items = entries.map((entry) => entry.item);
      this.canvas.classList.add("is-ready");
      this.updatePhotoRibbon(0, 0);
      this.scene.updateMatrixWorld(true);
      this.renderFrame(performance.now(), true);
    }

    treeRadiusAt(y) {
      const treeBottom = 0.38;
      const total = 5.93;
      const t = Math.max(0, Math.min(1, (y - treeBottom) / total));
      return 2.38 * Math.pow(1 - t, 1.02) + 0.14;
    }

    updatePhotoRibbon(now, dt) {
      if (!this.cardMeshes.length) return;
      if (!this.paused) {
        // The photographs travel along the S for about 83 seconds, then
        // re-enter at the crown. Their size never changes.
        this.sOffset = (this.sOffset + dt * this.photoSpeed) % 1;
      }
      const top = 6.08;
      const bottom = 0.72;
      const span = top - bottom;
      this.cardMeshes.forEach((card, index) => {
        const t = (card.userData.baseT + this.sOffset) % 1;
        const y = top - t * span;
        const radius = this.treeRadiusAt(y) + 0.22;
        // A shallow S that stays on the visible face of the cone. The
        // photographs swing left and right while following the branch
        // radius; all of them remain readable, none disappears backstage.
        const angle = Math.sin(t * Math.PI * 3.0 + 0.2) * 1.18;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;
        const scatterZ = card.userData.scatterZ;
        const halfHeight = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (this.camera.position.z - scatterZ);
        const halfWidth = halfHeight * this.camera.aspect;
        const scatterX = card.userData.scatterU * halfWidth * 0.92;
        const scatterY = 3.5 + (card.userData.scatterV - 0.5) * halfHeight * 1.7;
        card.position.set(
          x + (scatterX - x) * this.spread,
          y + (scatterY - y) * this.spread,
          z + (scatterZ - z) * this.spread,
        );
        card.rotation.set(0, 0, card.userData.scatterTilt * this.spread);
        const edge = Math.min(1, Math.min(t, 1 - t) / 0.055);
        const baseOpacity = edge * (0.94 + 0.06 * (1 - t));
        const opacity = baseOpacity + (1 - baseOpacity) * this.spread;
        card.material.opacity = opacity;
        card.visible = opacity > 0.015;
        card.userData.opacity = opacity;
        card.renderOrder = 20 + index;
      });
    }

    setZoom(value, notify = true) {
      const next = Math.max(this.minZoom, Math.min(this.maxZoom, value));
      if (Math.abs(next - this.zoom) < 0.0005) return;
      this.zoom = next;
      // Below 100% the tree simply shrinks. Above 100% only a small part of
      // the gesture becomes scale; the rest becomes the dissolve into stars.
      const scale = next <= 1
        ? 0.9 + (next - 0.8) * 0.5
        : 1 + (next - 1) * 0.28;
      this.root.scale.setScalar(scale);
      this.root.position.y = -this.zoomOriginY * (scale - 1);
      this.spreadTarget = smoothstep(1.03, 1.36, next);
      if (notify) this.onZoom?.(next);
      this.renderFrame(performance.now(), true);
    }

    applySpread() {
      const spread = this.spread;
      const spreadX = Math.min(1, Math.max(0.25, this.camera.aspect / 1.35));
      this.particleMaterials.forEach((material) => {
        material.uniforms.uSpread.value = spread;
        material.uniforms.uSpreadX.value = spreadX;
      });
      this.scatterObjects.forEach((entry) => {
        entry.object.position.set(
          entry.base.x + (entry.target.x - entry.base.x) * spread * spreadX,
          entry.base.y + (entry.target.y - entry.base.y) * spread,
          entry.base.z + (entry.target.z - entry.base.z) * spread,
        );
        entry.object.rotation.set(
          entry.baseRotation.x + (entry.targetRotation.x - entry.baseRotation.x) * spread,
          entry.baseRotation.y + (entry.targetRotation.y - entry.baseRotation.y) * spread,
          entry.baseRotation.z + (entry.targetRotation.z - entry.baseRotation.z) * spread,
        );
      });
      if (this.aura) this.aura.material.opacity = 0.65 * (1 - spread * 0.88);
      if (this.starSprite) this.starSprite.material.opacity = 0.9 * (1 - spread * 0.24);
    }

    zoomBy(delta) {
      this.setZoom(this.zoom + delta);
    }

    /* ───────────────────────── interaction / loop ───────────────────────── */

    bindPointer() {
      const canvas = this.canvas;

      const distanceBetweenPointers = () => {
        const points = Array.from(this.pointers.values());
        if (points.length < 2) return 0;
        return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      };

      canvas.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.preventDefault();
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture?.(event.pointerId);

        if (this.pointers.size === 1) {
          this.tap = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
          this.pinching = false;
          this.pinchStart = null;
        } else if (this.pointers.size === 2) {
          this.pinching = true;
          this.tap = null;
          this.pinchStart = { distance: Math.max(1, distanceBetweenPointers()), zoom: this.zoom };
        }
      });

      canvas.addEventListener("pointermove", (event) => {
        if (!this.pointers.has(event.pointerId)) {
          if (event.pointerType !== "touch") this.handleHover(event);
          return;
        }
        this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (this.pointers.size >= 2) {
          event.preventDefault();
          this.tap = null;
          const distance = distanceBetweenPointers();
          if (this.pinchStart && distance > 0) {
            this.setZoom(this.pinchStart.zoom * (distance / this.pinchStart.distance));
          }
          return;
        }

        if (this.tap && this.tap.id === event.pointerId) {
          const moved = Math.hypot(event.clientX - this.tap.x, event.clientY - this.tap.y);
          if (moved > 6) this.tap.moved = true;
        }
        if (event.pointerType !== "touch") this.handleHover(event);
      });

      const end = (event) => {
        const wasTap = Boolean(
          this.tap
          && this.tap.id === event.pointerId
          && !this.tap.moved
          && this.pointers.size === 1
          && !this.pinching,
        );
        this.pointers.delete(event.pointerId);
        canvas.releasePointerCapture?.(event.pointerId);
        if (this.pointers.size < 2) this.pinchStart = null;
        if (this.pointers.size === 0) {
          this.pinching = false;
          this.tap = null;
        }
        if (wasTap) this.handleClick(event);
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
      canvas.addEventListener("pointerleave", (event) => {
        if (this.pointers.size === 0 && event.buttons === 0) this.handleHover(event);
      });

      canvas.addEventListener("wheel", (event) => {
        event.preventDefault();
        const factor = Math.exp(-event.deltaY * 0.00135);
        this.setZoom(this.zoom * factor);
      }, { passive: false });
    }

    raycast(event) {
      if (!this.cardMeshes.length) return null;
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.scene.updateMatrixWorld(true);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const position = new THREE.Vector3();
      const clickable = this.cardMeshes.filter((mesh) => {
        if (mesh.material.opacity <= 0.16) return false;
        mesh.getWorldPosition(position);
        // Only the visible, front-facing half of the ribbon is clickable.
        return position.z > 0.04;
      });
      const hits = this.raycaster.intersectObjects(clickable, false);
      return hits[0]?.object || null;
    }

    handleClick(event) {
      const mesh = this.raycast(event);
      if (!mesh || !this.onPhotoClick) return;
      const rect = this.canvas.getBoundingClientRect();
      this.onPhotoClick(mesh.userData.item, {
        x: event.clientX,
        y: event.clientY,
        width: Math.max(80, rect.width * 0.18),
      });
    }

    handleHover(event) {
      const now = performance.now();
      if (now - this.lastHoverAt < 60) return;
      this.lastHoverAt = now;
      const mesh = this.raycast(event);
      const item = mesh?.userData?.item || null;
      this.canvas.style.cursor = item ? "pointer" : "zoom-in";
      if (item !== this.hoverItem) {
        this.hoverItem = item;
        this.onPhotoHover?.(item, event.clientX, event.clientY);
      } else if (item) {
        this.onPhotoHover?.(item, event.clientX, event.clientY);
      }
    }

    setActive(active) {
      this.active = Boolean(active);
      if (this.active) {
        this.lastTime = performance.now();
        this.renderFrame(performance.now(), true);
      }
    }

    setPaused(paused) {
      this.paused = Boolean(paused);
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      this.dpr = Math.min(window.devicePixelRatio || 1, this.mobile ? 1.6 : 2);
      this.renderer.setPixelRatio(this.dpr);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderFrame(performance.now(), true);
    }

    tick(now) {
      this.raf = requestAnimationFrame(this.tick);
      if (!this.active || document.hidden) return;
      this.renderFrame(now, false);
    }

    renderFrame(now, force = false) {
      const dt = Math.min(0.05, Math.max(0, (now - this.lastTime) / 1000));
      this.lastTime = now;
      this.spread += (this.spreadTarget - this.spread) * Math.min(1, dt * 6);
      if (Math.abs(this.spreadTarget - this.spread) < 0.0004) this.spread = this.spreadTarget;
      if (!this.paused) {
        this.treeRotation += dt * this.treeSpeed * (1 - this.spread * 0.55);
      }
      this.treeRoot.rotation.y = this.treeRotation;
      this.applySpread();
      this.updatePhotoRibbon(now, dt);
      this.root.updateMatrixWorld(true);

      this.particleMaterials.forEach((material) => {
        material.uniforms.uTime.value = now * 0.001;
      });
      if (this.starSprite) {
        const pulse = 0.9 + Math.sin(now * 0.0016) * 0.08;
        this.starSprite.material.opacity = pulse * (1 - this.spread * 0.24);
        this.starSprite.scale.setScalar(1.42 + Math.sin(now * 0.0016) * 0.06);
      }
      if (this.starLight) this.starLight.intensity = 1.1 + Math.sin(now * 0.0021) * 0.16;
      if (this.snowPositions && this.snowPoints) {
        for (let i = 0; i < this.snowSpeeds.length; i += 1) {
          this.snowPositions[i * 3 + 1] -= this.snowSpeeds[i] * dt;
          this.snowPositions[i * 3] += Math.sin(now * 0.00035 + i) * dt * 0.012;
          if (this.snowPositions[i * 3 + 1] < 0.16) {
            this.snowPositions[i * 3 + 1] = 7.8;
          }
        }
        this.snowPoints.geometry.attributes.position.needsUpdate = true;
      }

      this.renderer.render(this.scene, this.camera);
    }

    dispose() {
      cancelAnimationFrame(this.raf);
      this.renderer.dispose();
      this.scene.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((m) => m.dispose?.());
        else object.material?.dispose?.();
      });
    }
  }

  window.StellarTreeScene = StellarTreeScene;
})();
