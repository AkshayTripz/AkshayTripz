// ============================================================
// EAGLE — particles.js
// Background particle field: depth particles + binary text sprites
// ============================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class Particles {
  constructor(scene, isMobile) {
    this.scene    = scene;
    this.isMobile = isMobile;
    this.clock    = new THREE.Clock();
    this._disposables = [];

    this._buildFieldParticles();
    this._buildBinarySprites();
    this._buildGridLines();
  }

  // ── DEPTH FIELD PARTICLES ─────────────────────────────────
  _buildFieldParticles() {
    const count = this.isMobile ? 600 : 2200;
    const geo   = new THREE.BufferGeometry();

    const positions = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);
    const colors    = new Float32Array(count * 3);
    const speeds    = new Float32Array(count);

    // Cyan/teal color range
    const palette = [
      new THREE.Color(0x0ae4c8),
      new THREE.Color(0x22d3ee),
      new THREE.Color(0x0891b2),
      new THREE.Color(0x0e7490),
      new THREE.Color(0x2dd4bf),
    ];

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      // Spread in a wide volume
      positions[i3]     = (Math.random() - 0.5) * 80;
      positions[i3 + 1] = (Math.random() - 0.5) * 50;
      positions[i3 + 2] = (Math.random() - 0.5) * 40 - 5;

      sizes[i]  = 0.5 + Math.random() * 2.5;
      speeds[i] = 0.2 + Math.random() * 0.8;

      const c = palette[Math.floor(Math.random() * palette.length)];
      const brightness = 0.2 + Math.random() * 0.6;
      colors[i3]     = c.r * brightness;
      colors[i3 + 1] = c.g * brightness;
      colors[i3 + 2] = c.b * brightness;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

    // Store for animation
    this._particlePositions = positions;
    this._particleSpeeds    = speeds;
    this._particleCount     = count;

    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uTime;

        void main() {
          vColor = color;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          // Depth-based fade
          float depth = clamp((-mvPos.z - 5.0) / 35.0, 0.0, 1.0);
          vAlpha = 1.0 - depth * 0.85;
          gl_PointSize  = aSize * (300.0 / -mvPos.z);
          gl_Position   = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
    });

    this._particleMesh = new THREE.Points(geo, mat);
    this.scene.add(this._particleMesh);
    this._disposables.push(geo, mat);
  }

  // ── BINARY TEXT SPRITES ───────────────────────────────────
  _buildBinarySprites() {
    if (this.isMobile) return;

    const chars   = '01ABCDEFabcdef4E7F89';
    const spriteCount = 60;
    this._binarySprites = [];

    const canvas  = document.createElement('canvas');
    canvas.width  = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    const makeTexture = char => {
      ctx.clearRect(0, 0, 32, 32);
      ctx.fillStyle = 'rgba(10, 228, 200, 0.85)';
      ctx.font = '18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, 16, 16);
      const tex = new THREE.CanvasTexture(canvas);
      tex.needsUpdate = true;
      this._disposables.push(tex);
      return tex;
    };

    // Pre-build a small texture pool
    const texPool = Array.from({ length: 12 }, () =>
      makeTexture(chars[Math.floor(Math.random() * chars.length)])
    );

    for (let i = 0; i < spriteCount; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texPool[i % texPool.length],
        transparent: true,
        opacity: 0.06 + Math.random() * 0.14,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);

      const x = (Math.random() - 0.5) * 70;
      const y = (Math.random() - 0.5) * 45;
      const z = -5 - Math.random() * 20;
      sprite.position.set(x, y, z);

      const scale = 0.4 + Math.random() * 0.5;
      sprite.scale.set(scale, scale, 1);

      this.scene.add(sprite);
      this._binarySprites.push({
        sprite,
        mat,
        driftX: (Math.random() - 0.5) * 0.008,
        driftY: (Math.random() - 0.5) * 0.012,
        pulseFreq: 0.3 + Math.random() * 0.7,
        pulseOffset: Math.random() * Math.PI * 2,
        baseOpacity: 0.06 + Math.random() * 0.14,
      });
      this._disposables.push(mat);
    }
  }

  // ── BACKGROUND GRID ───────────────────────────────────────
  _buildGridLines() {
    if (this.isMobile) return;

    const mat = new THREE.LineBasicMaterial({
      color: 0x0e2a30,
      transparent: true,
      opacity: 0.3,
    });

    const size  = 80;
    const divs  = 20;
    const step  = size / divs;
    const half  = size / 2;
    const pts   = [];

    for (let i = 0; i <= divs; i++) {
      const x = -half + i * step;
      pts.push(x, -half, -18,  x, half, -18);
      pts.push(-half, x, -18,  half, x, -18);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));

    const grid = new THREE.LineSegments(geo, mat);
    this.scene.add(grid);
    this._grid = grid;
    this._disposables.push(geo, mat);
  }

  // ── TICK ──────────────────────────────────────────────────
  tick(scrollY = 0) {
    const t = this.clock.getElapsedTime();

    // Animate particle field — slow upward drift
    if (this._particleMesh) {
      const pos = this._particlePositions;
      const spd = this._particleSpeeds;
      const n   = this._particleCount;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        pos[i3 + 1] += spd[i] * 0.01;
        // Wrap top → bottom
        if (pos[i3 + 1] > 25) pos[i3 + 1] = -25;
      }
      this._particleMesh.geometry.attributes.position.needsUpdate = true;
      this._particleMesh.material.uniforms.uTime.value = t;

      // Subtle parallax shift with scroll
      this._particleMesh.position.y = -scrollY * 0.002;
    }

    // Binary sprites drift + pulse
    if (this._binarySprites) {
      this._binarySprites.forEach(s => {
        s.sprite.position.x += s.driftX;
        s.sprite.position.y += s.driftY;

        // Wrap bounds
        if (Math.abs(s.sprite.position.x) > 36) s.driftX *= -1;
        if (Math.abs(s.sprite.position.y) > 23) s.driftY *= -1;

        s.mat.opacity = s.baseOpacity * (0.4 + 0.6 * Math.abs(Math.sin(t * s.pulseFreq + s.pulseOffset)));
      });
    }

    // Grid parallax
    if (this._grid) {
      this._grid.position.y = -scrollY * 0.0008;
    }
  }

  dispose() {
    this._disposables.forEach(d => d.dispose());
    if (this._binarySprites) {
      this._binarySprites.forEach(s => this.scene.remove(s.sprite));
    }
  }
}
