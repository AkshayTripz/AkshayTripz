// ============================================================
// EAGLE V3 — particles.js
// All particles in ONE Points mesh per layer (GPU instancing).
// Layers: field · data · hexRain · network · click burst.
// Mouse repulsion, delta-time motion, click shockwave.
// ============================================================

import * as THREE from 'three';

// Colour palette (R,G,B float)
const COL = {
  red:   [1.00, 0.09, 0.27],
  blue:  [0.08, 0.53, 1.00],
  green: [0.00, 1.00, 0.53],
  cyan:  [0.00, 0.90, 1.00],
  dim:   [0.05, 0.10, 0.18],
};

function rnd(a, b) { return a + Math.random() * (b - a); }

export class Particles {
  constructor(engine) {
    this.E    = engine;
    this.Q    = engine.Q;
    this.scene = engine.scene;
    this._d   = [];   // disposables

    this._field     = this._buildField();
    this._data      = this._buildData();
    this._rain      = this._buildHexRain();
    this._bursts    = [];   // click explosions
    this._burstPool = [];

    engine.register('particles', (t, dt, E) => this._tick(t, dt, E));
    engine.canvas.addEventListener('click', e => this._onCLick(e));
    engine.canvas.addEventListener('touchend', e => {
      if (e.changedTouches[0]) this._onCLick(e.changedTouches[0]);
    }, { passive: true });
  }

  // ── FIELD PARTICLES ──────────────────────────────────────
  // Large background cloud — slow drift + mouse repulsion
  _buildField() {
    const N = this.Q.fieldParticles;
    if (!N) return null;

    const pos   = new Float32Array(N * 3);
    const col   = new Float32Array(N * 3);
    const vel   = new Float32Array(N * 3);  // stored in userData
    const sizes = new Float32Array(N);

    const palette = [COL.red, COL.blue, COL.green, COL.cyan, COL.dim, COL.dim, COL.dim];

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      pos[i3]   = rnd(-70, 70);
      pos[i3+1] = rnd(-45, 45);
      pos[i3+2] = rnd(-50, 10);

      vel[i3]   = rnd(-0.3, 0.3);
      vel[i3+1] = rnd(0.05, 0.5);   // upward bias
      vel[i3+2] = rnd(-0.1, 0.1);

      const c = palette[Math.floor(Math.random() * palette.length)];
      const b = rnd(0.15, 0.6);
      col[i3]   = c[0] * b;
      col[i3+1] = c[1] * b;
      col[i3+2] = c[2] * b;
      sizes[i]  = rnd(0.8, 3.5);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos,   3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col,   3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime:   { value: 0 },
        uMouse:  { value: new THREE.Vector3() },
      },
      vertexShader: `
        attribute float size;
        attribute vec3  color;
        varying   vec3  vColor;
        varying   float vAlpha;
        uniform   float uTime;
        uniform   vec3  uMouse;

        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float depth = clamp((-mv.z - 5.0) / 45.0, 0.0, 1.0);
          vAlpha = (1.0 - depth * 0.9) * (0.5 + 0.5 * sin(uTime * 0.8 + position.x));
          gl_PointSize = size * (350.0 / -mv.z);
          gl_Position  = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3  vColor;
        varying float vAlpha;
        void main() {
          vec2  uv = gl_PointCoord - 0.5;
          float d  = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.08, d) * vAlpha;
          gl_FragColor = vec4(vColor, a);
        }`,
      transparent: true, depthWrite: false, vertexColors: true,
    });

    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);
    this._d.push(geo, mat);

    return {
      mesh, geo, mat,
      pos, vel,
      N,
    };
  }

  // ── DATA STREAM PARTICLES ────────────────────────────────
  // Move along random curved paths — RED/BLUE/GREEN
  _buildData() {
    const N = this.Q.dataParticles;
    if (!N) return null;

    const pos   = new Float32Array(N * 3);
    const col   = new Float32Array(N * 3);
    const phase = new Float32Array(N);
    const speed = new Float32Array(N);
    const cols  = [COL.red, COL.blue, COL.green];

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      pos[i3]   = rnd(-40, 40);
      pos[i3+1] = rnd(-25, 25);
      pos[i3+2] = rnd(-30, 5);
      phase[i]  = Math.random() * Math.PI * 2;
      speed[i]  = rnd(1.5, 5.0);
      const c   = cols[i % 3];
      const b   = rnd(0.4, 0.9);
      col[i3]   = c[0] * b;
      col[i3+1] = c[1] * b;
      col[i3+2] = c[2] * b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: 2.5, vertexColors: true, transparent: true,
      opacity: 0.75, depthWrite: false, sizeAttenuation: true,
    });

    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);
    this._d.push(geo, mat);

    return { mesh, geo, pos, phase, speed, N };
  }

  // ── HEX RAIN ─────────────────────────────────────────────
  // Vertical columns of hex characters as sprites
  _buildHexRain() {
    const N = this.Q.hexRain;
    if (!N) return null;

    const HEX   = '0123456789ABCDEF';
    const drops = [];

    // Build char texture pool — each on its own canvas so they're independent
    const texPool = [];
    const COLORS  = ['#ff1744','#147eff','#00ff88'];
    for (let i = 0; i < 16; i++) {
      const c2  = document.createElement('canvas');
      c2.width  = 32; c2.height = 32;
      const cx2 = c2.getContext('2d');
      cx2.fillStyle = COLORS[i % 3];
      cx2.font = '600 20px "JetBrains Mono", monospace';
      cx2.textAlign = 'center';
      cx2.textBaseline = 'middle';
      cx2.fillText(HEX[i], 16, 16);
      const tex = new THREE.CanvasTexture(c2);
      texPool.push(tex);
      this._d.push(tex);
    }

    for (let i = 0; i < N; i++) {
      const mat = new THREE.SpriteMaterial({
        map: texPool[Math.floor(Math.random() * texPool.length)],
        transparent: true,
        opacity: rnd(0.05, 0.25),
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(rnd(-60, 60), rnd(-30, 30), rnd(-40, 0));
      const s = rnd(0.3, 0.7);
      sprite.scale.set(s, s, 1);

      this.scene.add(sprite);
      drops.push({
        sprite, mat,
        vy:   -rnd(0.5, 3.5),
        dx:   rnd(-0.1, 0.1),
        pFreq: rnd(0.3, 1.2),
        pOff:  Math.random() * Math.PI * 2,
        base:  mat.opacity,
        tex:   texPool,
        swapT: 0,
        swapInterval: rnd(0.4, 2.0),
      });
      this._d.push(mat);
    }

    return { drops };
  }

  // ── CLICK BURST ──────────────────────────────────────────
  _onCLick(e) {
    const x = (e.clientX / window.innerWidth)  * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;

    // Unproject to world space at z=0
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(x, y), this.E.camera);
    const t    = new THREE.Vector3();
    const dir  = ray.ray.direction.clone().normalize();
    const dist = -ray.ray.origin.z / dir.z;
    t.copy(ray.ray.origin).addScaledVector(dir, dist);

    this._spawnBurst(t);
  }

  _spawnBurst(origin) {
    const COUNT = Math.min(200, 50 + this.Q.tier * 50);
    const pos   = new Float32Array(COUNT * 3);
    const vel   = [];

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      pos[i3]   = origin.x;
      pos[i3+1] = origin.y;
      pos[i3+2] = origin.z;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const spd   = rnd(2, 12);
      vel.push(
        Math.sin(phi) * Math.cos(theta) * spd,
        Math.sin(phi) * Math.sin(theta) * spd,
        Math.cos(phi) * spd * 0.3,
      );
    }

    const geo  = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const c   = [COL.red, COL.blue, COL.green][Math.floor(Math.random() * 3)];
    const mat = new THREE.PointsMaterial({
      color: new THREE.Color(c[0], c[1], c[2]),
      size: 2, transparent: true, opacity: 0.9, depthWrite: false,
    });
    const mesh = new THREE.Points(geo, mat);
    this.scene.add(mesh);

    this._bursts.push({ mesh, geo, mat, pos, vel, life: 1.0, COUNT });
  }

  // ── TICK ─────────────────────────────────────────────────
  _tick(t, dt, E) {
    const mx = E.pointerN.x * 20;
    const my = E.pointerN.y * 14;

    // Field particles
    if (this._field) {
      const { pos, vel, N, mat } = this._field;
      mat.uniforms.uTime.value = t;
      mat.uniforms.uMouse.value.set(mx, my, 0);

      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        // Mouse repulsion
        const dx = pos[i3]   - mx;
        const dy = pos[i3+1] - my;
        const d2 = dx*dx + dy*dy;
        if (d2 < 80) {
          const inv = (80 - d2) / 80 * dt * 4;
          vel[i3]   += dx * inv;
          vel[i3+1] += dy * inv;
        }
        // Damping
        vel[i3]   *= 1 - dt * 0.8;
        vel[i3+1] *= 1 - dt * 0.8;
        vel[i3+2] *= 1 - dt * 0.5;

        pos[i3]   += vel[i3]   * dt;
        pos[i3+1] += vel[i3+1] * dt;
        pos[i3+2] += vel[i3+2] * dt;

        // Wrap
        if (pos[i3+1] > 47)  pos[i3+1] = -47;
        if (pos[i3]   >  72) pos[i3]   = -72;
        if (pos[i3]   < -72) pos[i3]   =  72;
      }
      this._field.geo.attributes.position.needsUpdate = true;
    }

    // Data stream particles — orbit around scene
    if (this._data) {
      const { pos, phase, speed, N } = this._data;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        phase[i] += speed[i] * dt * 0.3;
        const r = 10 + (i % 12) * 3;
        pos[i3]   = Math.cos(phase[i]) * r;
        pos[i3+1] = Math.sin(phase[i] * 0.7) * r * 0.5;
        pos[i3+2] = Math.sin(phase[i] * 0.3) * 8 - 5;
      }
      this._data.geo.attributes.position.needsUpdate = true;
    }

    // Hex rain — fall + swap chars + pulse opacity
    if (this._rain) {
      this._rain.drops.forEach(d => {
        d.sprite.position.y += d.vy * dt;
        d.sprite.position.x += d.dx * dt;
        d.swapT += dt;

        if (d.sprite.position.y < -32) {
          d.sprite.position.y = 32;
          d.sprite.position.x = rnd(-60, 60);
        }

        if (d.swapT > d.swapInterval) {
          d.swapT = 0;
          const newTex = d.tex[Math.floor(Math.random() * d.tex.length)];
          if (newTex !== d.mat.map) {
            d.mat.map = newTex;
            d.mat.needsUpdate = true;
          }
        }

        d.mat.opacity = d.base * (0.3 + 0.7 * Math.abs(Math.sin(t * d.pFreq + d.pOff)));
      });
    }

    // Burst particles — shrink life, apply velocity with drag
    for (let b = this._bursts.length - 1; b >= 0; b--) {
      const burst = this._bursts[b];
      burst.life -= dt * 1.2;
      burst.mat.opacity = Math.max(0, burst.life * 0.9);

      for (let i = 0; i < burst.COUNT; i++) {
        const i3 = i * 3;
        burst.vel[i3]   *= 1 - dt * 2.5;
        burst.vel[i3+1] *= 1 - dt * 2.5;
        burst.vel[i3+2] *= 1 - dt * 2.5;
        burst.pos[i3]   += burst.vel[i3]   * dt;
        burst.pos[i3+1] += burst.vel[i3+1] * dt;
        burst.pos[i3+2] += burst.vel[i3+2] * dt;
      }
      burst.geo.attributes.position.needsUpdate = true;

      if (burst.life <= 0) {
        this.scene.remove(burst.mesh);
        burst.geo.dispose();
        burst.mat.dispose();
        this._bursts.splice(b, 1);
      }
    }
  }

  dispose() {
    this._d.forEach(d => d.dispose?.());
    this._rain?.drops.forEach(d => this.scene.remove(d.sprite));
    if (this._field) this.scene.remove(this._field.mesh);
    if (this._data)  this.scene.remove(this._data.mesh);
  }
}
