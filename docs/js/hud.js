// ============================================================
// EAGLE V3 — hud.js
// Live metrics with realistic drift, periodic system events,
// floating 3D data labels, scanning beam overlay.
// ============================================================

import * as THREE from 'three';

const METRICS = [
  { key:'FUNCTIONS',    val:1482, drift:1,    max:1600, fmt: v => v.toLocaleString() },
  { key:'INSTRUCTIONS', val:184294, drift:8,  max:200000, fmt: v => v.toLocaleString() },
  { key:'IMPORTS',      val:237,  drift:0,    max:237, fmt: v => v.toString() },
  { key:'XREFS',        val:8421, drift:3,    max:9000, fmt: v => v.toLocaleString() },
  { key:'MODULES',      val:34,   drift:0,    max:34,  fmt: v => v.toString() },
  { key:'THREADS',      val:18,   drift:1,    max:24,  fmt: v => v.toString() },
  { key:'MEMORY',       val:64.7, drift:0.3,  max:96,  fmt: v => v.toFixed(1)+' MB' },
  { key:'ANOMALIES',    val:3,    drift:0,    max:5,   fmt: v => v.toString() },
  { key:'NODES',        val:2481, drift:5,    max:3000, fmt: v => v.toLocaleString() },
  { key:'CPU',          val:47,   drift:8,    max:100, fmt: v => v.toFixed(0)+'%', isBar:true },
];

const EVENTS = [
  { msg:'[+] FUNCTION DISCOVERED',        cls:'ok'  },
  { msg:'[*] MEMORY REGION SCANNED',      cls:''    },
  { msg:'[+] IMPORT RESOLVED',            cls:'ok'  },
  { msg:'[*] CROSS-REFERENCE FOUND',      cls:''    },
  { msg:'[!] ANOMALOUS CALL DETECTED',    cls:'err' },
  { msg:'[+] CONTROL FLOW UPDATED',       cls:'ok'  },
  { msg:'[*] MODULE ANALYZED',            cls:''    },
  { msg:'[+] SIGNATURE MATCH',            cls:'ok'  },
  { msg:'[!] PACKED SECTION DETECTED',    cls:'err' },
  { msg:'[+] ENTROPY ANALYSIS COMPLETE',  cls:'ok'  },
  { msg:'[*] XREF TABLE REBUILT',         cls:''    },
  { msg:'[!] ANTI-DEBUG PATTERN @0x402A10', cls:'err' },
];

const SYSTEM_MOMENTS = [
  { msg:'MEMORY SCAN COMPLETE',  type:'blue',  dur:3000 },
  { msg:'THREAT DETECTED',       type:'red',   dur:4000 },
  { msg:'DEEP ANALYSIS RUNNING', type:'green', dur:3500 },
];

// Floating 3D data labels
const FLOAT_LABELS = [
  { text:'0x00401240', color:0xff1744, pos:[-8,  3, -8] },
  { text:'MOV RAX,RBX', color:0x00ff88, pos:[ 7, -2, -6] },
  { text:'KERNEL32.DLL', color:0x147eff, pos:[-6, -4, -5] },
  { text:'VirtualAlloc', color:0x00ff88, pos:[ 9,  4, -9] },
  { text:'0x7FF81230',  color:0xff1744, pos:[-9,  1,-10] },
  { text:'CALL SUB_401240', color:0xff9100, pos:[ 5, -5, -7] },
  { text:'TEST EAX,EAX', color:0x00ff88, pos:[-4,  5, -8] },
  { text:'ntdll.dll',   color:0x147eff, pos:[ 8,  2,-11] },
  { text:'0x000000FF',  color:0xff1744, pos:[-7, -3,-12] },
  { text:'JNZ 00401520', color:0xff9100, pos:[ 4,  6,-10] },
  { text:'CreateFileW', color:0x00ff88, pos:[-3, -6, -9] },
  { text:'GetProcAddress', color:0x147eff, pos:[ 6, -1,-13] },
];

export class HUD {
  constructor(engine) {
    this.E     = engine;
    this.scene = engine.scene;
    this._d    = [];
    this._metrics   = JSON.parse(JSON.stringify(METRICS)); // deep copy
    this._metricEls = {};
    this._barEls    = {};
    this._floatLabels = [];
    this._nextEvent = 5;
    this._nextMoment = 25;
    this._momentActive = false;

    this._buildMetricsPanel();
    this._buildFloatLabels();
    this._buildScanOverlay();

    engine.register('hud', (t,dt) => this._tick(t,dt));
  }

  // ── METRICS PANEL ─────────────────────────────────────────
  _buildMetricsPanel() {
    const panel = document.getElementById('hud-metrics');
    if (!panel) return;

    this._metrics.forEach(m => {
      const row = document.createElement('div');
      row.className = 'metric-row';

      const key = document.createElement('span');
      key.className = 'metric-key';
      key.textContent = m.key;

      const val = document.createElement('span');
      val.className = 'metric-val';
      val.id = `metric-${m.key}`;
      val.textContent = m.fmt(m.val);

      row.appendChild(key);
      row.appendChild(val);
      panel.appendChild(row);
      this._metricEls[m.key] = val;

      if (m.isBar) {
        const barWrap = document.createElement('div');
        barWrap.className = 'metric-bar';
        const fill = document.createElement('div');
        fill.className = 'metric-bar-fill';
        fill.id = `bar-${m.key}`;
        fill.style.width = m.val + '%';
        barWrap.appendChild(fill);
        panel.appendChild(barWrap);
        this._barEls[m.key] = fill;
      }
    });
  }

  // ── FLOATING 3D TEXT LABELS ───────────────────────────────
  _buildFloatLabels() {
    FLOAT_LABELS.forEach(fl => {
      // Each label gets its own canvas so textures don't share state
      const cv  = document.createElement('canvas');
      cv.width  = 256; cv.height = 48;
      const ctx = cv.getContext('2d');
      const hex = '#' + fl.color.toString(16).padStart(6,'0');
      ctx.fillStyle = hex;
      ctx.font = '500 15px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fl.text, 128, 24);

      const tex = new THREE.CanvasTexture(cv);
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, opacity: 0.35, depthWrite: false
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(...fl.pos);
      sprite.scale.set(3.5, 0.7, 1);
      sprite.userData.baseY = fl.pos[1];
      sprite.userData.floatFreq = 0.2 + Math.random()*0.4;
      sprite.userData.floatOff  = Math.random()*Math.PI*2;
      sprite.userData.baseOp    = mat.opacity;

      this.scene.add(sprite);
      this._floatLabels.push({ sprite, mat });
      this._d.push(tex, mat);
    });
  }

  // ── SCAN OVERLAY (2D canvas over the scene) ───────────────
  _buildScanOverlay() {
    this._scanCanvas = document.getElementById('scan-canvas');
    if (!this._scanCanvas) return;
    this._scanCanvas.width  = window.innerWidth;
    this._scanCanvas.height = window.innerHeight;
    this._scanCtx = this._scanCanvas.getContext('2d');
    this._scanY   = 0;

    window.addEventListener('resize', () => {
      this._scanCanvas.width  = window.innerWidth;
      this._scanCanvas.height = window.innerHeight;
    });
  }

  // ── SYSTEM EVENTS ─────────────────────────────────────────
  _fireEvent() {
    const ev  = EVENTS[Math.floor(Math.random()*EVENTS.length)];
    const box = document.getElementById('events-box');
    if (!box) return;

    const el  = document.createElement('div');
    el.className = `sys-event ${ev.cls}`;
    el.textContent = ev.msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));

    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 500);
    }, 3500);

    // Keep max 6 visible
    while (box.children.length > 6) box.removeChild(box.firstChild);
  }

  // ── SYSTEM MOMENTS ────────────────────────────────────────
  _fireMoment(t) {
    if (this._momentActive) return;
    this._momentActive = true;
    const moment = SYSTEM_MOMENTS[Math.floor(Math.random()*SYSTEM_MOMENTS.length)];

    const overlay = document.getElementById('moment-overlay');
    const text    = document.getElementById('moment-text');
    if (!overlay || !text) { this._momentActive=false; return; }

    text.textContent = moment.msg;
    overlay.dataset.type = moment.type;
    overlay.classList.add('active');

    // Light flash based on type
    if (moment.type === 'red')   this.E.setLight('red',   12);
    if (moment.type === 'blue')  this.E.setLight('blue',  12);
    if (moment.type === 'green') this.E.setLight('green', 12);

    setTimeout(() => {
      overlay.classList.remove('active');
      this.E.setLight('red',   3.5);
      this.E.setLight('blue',  2.8);
      this.E.setLight('green', 2.0);
      this._momentActive = false;
    }, moment.dur);
  }

  notify(msg, type='') {
    const box = document.getElementById('notifications');
    if (!box) return;
    const el = document.createElement('div');
    el.className = `notif${type?' '+type:''}`;
    el.textContent = msg;
    box.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, 3500);
    while (box.children.length > 5) box.removeChild(box.firstChild);
  }

  // ── TICK ──────────────────────────────────────────────────
  _tick(t, dt) {
    // Metrics drift — realistic increments
    this._metrics.forEach(m => {
      if (!m.drift) return;
      const step = (Math.random()-0.48) * m.drift * dt * 2;
      m.val = Math.max(m.val * 0.5, Math.min(m.max, m.val + step));
      const el = this._metricEls[m.key];
      if (el) el.textContent = m.fmt(m.val);
      const bar = this._barEls[m.key];
      if (bar) bar.style.width = Math.min(100, (m.val/m.max)*100) + '%';
    });

    // Floating labels — bob + pulse
    this._floatLabels.forEach(fl => {
      fl.sprite.position.y = fl.sprite.userData.baseY
        + Math.sin(t * fl.sprite.userData.floatFreq + fl.sprite.userData.floatOff) * 0.4;
      fl.mat.opacity = fl.sprite.userData.baseOp
        * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.25 + fl.sprite.userData.floatOff)));
    });

    // Scan overlay — horizontal beam across screen
    if (this._scanCtx) {
      const ctx = this._scanCtx;
      const W   = this._scanCanvas.width;
      const H   = this._scanCanvas.height;
      this._scanY += dt * 80;
      if (this._scanY > H) this._scanY = 0;

      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, this._scanY-20, 0, this._scanY+4);
      g.addColorStop(0, 'transparent');
      g.addColorStop(0.7, 'rgba(0,255,136,0.04)');
      g.addColorStop(1, 'rgba(0,255,136,0.10)');
      ctx.fillStyle = g;
      ctx.fillRect(0, this._scanY-20, W, 24);
    }

    // Periodic system events
    this._nextEvent -= dt;
    if (this._nextEvent <= 0) {
      this._fireEvent();
      this._nextEvent = 5 + Math.random()*12;
    }

    // Rare system moments
    this._nextMoment -= dt;
    if (this._nextMoment <= 0) {
      this._fireMoment(t);
      this._nextMoment = 20 + Math.random()*25;
    }
  }

  dispose() {
    this._d.forEach(d => d.dispose?.());
    this._floatLabels.forEach(f => this.scene.remove(f.sprite));
  }
}
