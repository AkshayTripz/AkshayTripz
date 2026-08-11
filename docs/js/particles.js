// ============================================================
// EAGLE V2 — particles.js
// Three systems:
//   1. InstancedMesh field — depth particles, single draw call
//   2. Binary/hex sprite layer — drifting chars
//   3. RE mode hex streams — canvas-based columns
// ============================================================

import * as THREE from 'three';
import { Perf }   from './performance.js';

export class ParticleSystem {
  constructor(scene, Q) {
    this.scene = scene;
    this.Q     = Q;
    this._disposables = [];
    this._sprites     = [];
    this._streamEls   = [];

    if (Q.fieldParticles > 0) this._buildField();
    if (Q.hexSprites     > 0) this._buildHexSprites();
  }

  // ── 1. INSTANCED FIELD PARTICLES ─────────────────────────
  _buildField() {
    const N    = this.Q.fieldParticles;
    const geo  = new THREE.SphereGeometry(0.04, 4, 4);
    const mat  = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.6 });
    this._field = new THREE.InstancedMesh(geo, mat, N);
    this._field.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this._disposables.push(geo, mat);

    // Per-instance data
    this._fPos   = new Float32Array(N * 3);
    this._fSpeed = new Float32Array(N);
    this._fCol   = new Float32Array(N * 3);
    const dummy  = new THREE.Object3D();
    const colors = [
      new THREE.Color(0x00e5ff),
      new THREE.Color(0x0af5c8),
      new THREE.Color(0x4488ff),
      new THREE.Color(0x0e7490),
    ];

    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      this._fPos[i3]   = (Math.random() - 0.5) * 90;
      this._fPos[i3+1] = (Math.random() - 0.5) * 55;
      this._fPos[i3+2] = (Math.random() - 0.5) * 50 - 8;
      this._fSpeed[i]  = 0.15 + Math.random() * 0.55;

      const c = colors[i % colors.length];
      const b = 0.2 + Math.random() * 0.6;
      this._fCol[i3]   = c.r * b;
      this._fCol[i3+1] = c.g * b;
      this._fCol[i3+2] = c.b * b;

      dummy.position.set(this._fPos[i3], this._fPos[i3+1], this._fPos[i3+2]);
      dummy.updateMatrix();
      this._field.setMatrixAt(i, dummy.matrix);
      this._field.setColorAt(i, c.multiplyScalar(b));
    }
    this._field.instanceMatrix.needsUpdate = true;
    if (this._field.instanceColor) this._field.instanceColor.needsUpdate = true;

    this.scene.add(this._field);
    this._dummy = dummy;
  }

  // ── 2. HEX/BINARY SPRITE LAYER ───────────────────────────
  _buildHexSprites() {
    const chars  = '0 1 A B C D E F 4D 5A 90 00 E8 FF 25 C3 48 89 CC 0F'.split(' ');
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx    = canvas.getContext('2d');

    // Build a texture pool
    const pool = chars.map(ch => {
      ctx.clearRect(0, 0, 32, 32);
      ctx.fillStyle = '#00e5ff';
      ctx.font      = `500 ${ch.length > 1 ? 13 : 16}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 16, 16);
      const tex = new THREE.CanvasTexture(canvas);
      this._disposables.push(tex);
      return tex;
    });

    for (let i = 0; i < this.Q.hexSprites; i++) {
      const mat = new THREE.SpriteMaterial({
        map:         pool[i % pool.length],
        transparent: true,
        opacity:     0.04 + Math.random() * 0.12,
        depthWrite:  false,
      });
      const sprite = new THREE.Sprite(mat);
      const x = (Math.random() - 0.5) * 80;
      const y = (Math.random() - 0.5) * 50;
      const z = -10 - Math.random() * 25;
      sprite.position.set(x, y, z);
      const s = 0.35 + Math.random() * 0.55;
      sprite.scale.set(s, s, 1);

      this.scene.add(sprite);
      this._sprites.push({
        sprite, mat,
        dx:    (Math.random() - 0.5) * 0.006,
        dy:    (Math.random() - 0.5) * 0.010,
        pFreq: 0.25 + Math.random() * 0.65,
        pOff:  Math.random() * Math.PI * 2,
        base:  mat.opacity,
      });
      this._disposables.push(mat);
    }
  }

  // ── 3. RE MODE STREAMS (DOM canvas columns) ───────────────
  buildREStreams() {
    const N     = this.Q.streamColumns;
    const chars = '0123456789ABCDEFabcdef';
    if (N === 0) return;

    const overlay = document.getElementById('re-overlay');
    if (!overlay) return;

    // Clear any existing
    this._streamEls.forEach(el => el.remove());
    this._streamEls = [];

    for (let i = 0; i < N; i++) {
      const el = document.createElement('div');
      el.className = 're-stream';
      const col  = Math.random() * 100;
      const dur  = 6 + Math.random() * 8;
      const delay = Math.random() * dur;
      el.style.left = col + 'vw';
      el.style.animationDuration  = dur + 's';
      el.style.animationDelay     = `-${delay}s`;
      el.style.fontSize = (0.45 + Math.random() * 0.2) + 'rem';

      // Fill with random hex chars
      let str = '';
      const len = 20 + Math.floor(Math.random() * 30);
      for (let j = 0; j < len; j++) str += chars[Math.floor(Math.random() * chars.length)] + ' ';
      el.textContent = str;

      overlay.appendChild(el);
      this._streamEls.push(el);
    }
  }

  removeREStreams() {
    this._streamEls.forEach(el => el.remove());
    this._streamEls = [];
  }

  // ── TICK ──────────────────────────────────────────────────
  tick(elapsed, delta, scrollY = 0) {
    const t = elapsed;

    // Field particles — upward drift, wrap
    if (this._field && this._fPos) {
      const N = this.Q.fieldParticles;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3;
        this._fPos[i3+1] += this._fSpeed[i] * 0.008;
        if (this._fPos[i3+1] > 28) this._fPos[i3+1] = -28;

        this._dummy.position.set(this._fPos[i3], this._fPos[i3+1], this._fPos[i3+2]);
        this._dummy.updateMatrix();
        this._field.setMatrixAt(i, this._dummy.matrix);
      }
      this._field.instanceMatrix.needsUpdate = true;
      // Subtle scroll parallax
      this._field.position.y = -scrollY * 0.0015;
    }

    // Hex sprites — drift + pulse opacity
    this._sprites.forEach(s => {
      s.sprite.position.x += s.dx;
      s.sprite.position.y += s.dy;
      if (Math.abs(s.sprite.position.x) > 42) s.dx *= -1;
      if (Math.abs(s.sprite.position.y) > 26) s.dy *= -1;
      s.mat.opacity = s.base * (0.35 + 0.65 * Math.abs(Math.sin(t * s.pFreq + s.pOff)));
    });
  }

  dispose() {
    this._disposables.forEach(d => d.dispose?.());
    this._sprites.forEach(s => this.scene.remove(s.sprite));
    if (this._field) this.scene.remove(this._field);
    this._streamEls.forEach(el => el.remove());
  }
}
