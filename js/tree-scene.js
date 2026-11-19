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
      this.random = seeded(20261224);
      this.mobile = IS_MOBILE;
      this.paused = false;
      this.active = false;
      this.dragging = false;
      this.pointerId = null;
      this.startX = 0;
      this.startY = 0;
      this.lastPointerX = 0;
      this.moved = false;
      this.autoResumeAt = 0;
      this.rotation = -0.34;
      this.targetRotation = -0.34;
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
      this.camera.position.set(0, 4.15, 16.1);
      this.camera.lookAt(new THREE.Vector3(0, 3.45, 0));

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
      this.root.rotation.y = this.rotation;
      this.scene.add(this.root);

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
      this.buildPhotoRingSettings();
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

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.25, 6.9, 16),
        new THREE.MeshStandardMaterial({ color: 0x2a1712, roughness: 0.92 }),
      );
      trunk.position.y = 3.15;
      trunk.castShadow = true;
      this.root.add(trunk);

      this.buildTiers();
      this.buildNeedles();
      this.buildGarland();
      this.buildOrnaments();
      this.buildStar();
      this.buildLightsOnTree();
      this.buildGifts();
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

    buildPhotoRingSettings() {
      this.cardW = 1.06;
      this.cardH = 1.34;
      this.cardGeometry = new THREE.BoxGeometry(this.cardW, this.cardH, 0.035);
      this.cardEdgeMaterial = new THREE.MeshBasicMaterial({ color: 0xd7b27b, toneMapped: false });
      this.cardBackMaterial = new THREE.MeshBasicMaterial({ color: 0x1a1112, toneMapped: false });
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
      group.name = "winter-photo-ring";
      const nextCards = [];
      const count = entries.length;
      const perRing = Math.ceil(count / 2);
      entries.forEach((entry, index) => {
        const ring = index % 2;
        const ringIndex = Math.floor(index / 2);
        const ringCount = ring === 0 ? perRing : count - perRing;
        if (!ringCount) return;
        const angle = (ringIndex / ringCount) * TAU + (ring === 0 ? 0.15 : 0.72) + ring * 0.1;
        const radius = ring === 0 ? 2.58 : 2.72;
        const y = ring === 0 ? 2.02 : 4.18;
        const front = new THREE.MeshBasicMaterial({ map: entry.texture, toneMapped: false });
        const mesh = new THREE.Mesh(this.cardGeometry, [
          this.cardEdgeMaterial,
          this.cardEdgeMaterial,
          this.cardEdgeMaterial,
          this.cardEdgeMaterial,
          front,
          this.cardBackMaterial,
        ]);
        mesh.position.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
        mesh.rotation.y = -this.rotation;
        mesh.userData = { item: entry.item, frontMaterial: front, texture: entry.texture };
        group.add(mesh);
        nextCards.push(mesh);
      });

      this.root.add(group);
      if (previousGroup && previousGroup.children.length) {
        this.root.remove(previousGroup);
        previousGroup.traverse((child) => {
          if (!child.isMesh) return;
          child.userData.frontMaterial?.map?.dispose?.();
          child.userData.frontMaterial?.dispose?.();
        });
      }
      this.cardGroup = group;
      this.cardMeshes = nextCards;
      this.items = entries.map((entry) => entry.item);
      this.canvas.classList.add("is-ready");
      this.scene.updateMatrixWorld(true);
      this.renderFrame(performance.now(), true);
    }

    /* ───────────────────────── interaction / loop ───────────────────────── */

    bindPointer() {
      const canvas = this.canvas;
      canvas.addEventListener("pointerdown", (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        this.dragging = true;
        this.moved = false;
        this.pointerId = event.pointerId;
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.lastPointerX = event.clientX;
        this.autoResumeAt = performance.now() + 2600;
        canvas.setPointerCapture?.(event.pointerId);
        canvas.classList.add("is-dragging");
      });

      canvas.addEventListener("pointermove", (event) => {
        if (!this.dragging || event.pointerId !== this.pointerId) {
          if (event.pointerType !== "touch") this.handleHover(event);
          return;
        }
        const dx = event.clientX - this.lastPointerX;
        this.lastPointerX = event.clientX;
        if (Math.abs(event.clientX - this.startX) + Math.abs(event.clientY - this.startY) > 5) this.moved = true;
        if (!this.moved) return;
        event.preventDefault();
        this.targetRotation += dx * 0.0062;
        this.autoResumeAt = performance.now() + 2600;
        canvas.classList.add("is-dragging");
      });

      const end = (event) => {
        if (!this.dragging) return;
        const wasMoved = this.moved;
        this.dragging = false;
        this.pointerId = null;
        canvas.classList.remove("is-dragging");
        canvas.releasePointerCapture?.(event.pointerId);
        if (!wasMoved) this.handleClick(event);
        this.autoResumeAt = performance.now() + 2600;
      };
      canvas.addEventListener("pointerup", end);
      canvas.addEventListener("pointercancel", end);
      canvas.addEventListener("pointerleave", (event) => {
        if (this.dragging && event.buttons === 0) end(event);
      });
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
        mesh.getWorldPosition(position);
        // Do not open a photograph that is currently hidden behind the tree.
        return position.z > 0.12;
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
      this.canvas.style.cursor = this.dragging ? "grabbing" : item ? "pointer" : "grab";
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
      if (!this.paused && !this.dragging && now > this.autoResumeAt) {
        // Slow turntable, close to the birthday-cake scene's lazy spin.
        this.targetRotation += dt * 0.135;
      }
      this.rotation += (this.targetRotation - this.rotation) * Math.min(1, dt * 5.2);
      this.root.rotation.y = this.rotation;
      // A barely-there cake-stand sway; the tree and photographs share it.
      this.root.rotation.z = Math.sin(now * 0.00032) * 0.004;
      this.cardMeshes.forEach((mesh) => {
        // Photographs travel with the tree, but stay readable while they
        // pass in front of it. Their size is fixed.
        mesh.rotation.y = -this.rotation;
      });
      this.root.updateMatrixWorld(true);

      if (this.lightUniforms) this.lightUniforms.uTime.value = now * 0.001;
      if (this.starGlow) {
        const pulse = 0.22 + Math.sin(now * 0.0016) * 0.055;
        this.starGlow.material.opacity = pulse;
        this.starGlow.scale.setScalar(1.55 + Math.sin(now * 0.0016) * 0.08);
      }
      if (this.starLight) this.starLight.intensity = 1.25 + Math.sin(now * 0.0021) * 0.18;
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
