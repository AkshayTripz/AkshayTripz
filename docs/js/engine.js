// ============================================================
// EAGLE V3 — engine.js
// The single RAF loop. Every subsystem registers here.
// If a subsystem throws, it is disabled for that frame only.
// Tab visibility handled. Clock never drifts.
// ============================================================

import * as THREE from 'three';
import { Perf }   from './performance.js';

export class Engine {
  constructor(canvas) {
    this.canvas   = canvas;
    this.Q        = Perf.Q;
    this.clock    = new THREE.Clock();
    this.elapsed  = 0;
    this._running = false;
    this._systems = [];   // { name, fn, disabled, errorCount }
    this._lastWatchdog = 0;

    // Mouse / touch state (shared across subsystems)
    this.pointer  = new THREE.Vector2(0, 0);
    this.pointerN = new THREE.Vector2(0, 0); // normalised -1..1
    this.pointerDelta = new THREE.Vector2(0, 0);
    this._prevPointer = new THREE.Vector2(0, 0);

    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._bindPointer();
    this._bindVisibility();
    this._bindResize();
  }

  // ── Renderer ─────────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:    this.canvas,
      antialias: this.Q.antialias,
      alpha:     false,
      powerPreference: 'high-performance',
      stencil:   false,
    });
    this.renderer.setPixelRatio(this.Q.dpr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x020308, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
  }

  // ── Scene ────────────────────────────────────────────────
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x020308, this.Q.fogDensity);
  }

  // ── Camera rig: group(scroll) → pivot(mouse) → cam ───────
  _initCamera() {
    this.camRig   = new THREE.Group();
    this.camPivot = new THREE.Group();
    this.camera   = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.z = 22;
    this.camPivot.add(this.camera);
    this.camRig.add(this.camPivot);
    this.scene.add(this.camRig);

    // Lerp targets
    this._rigT   = new THREE.Vector3();
    this._camZT  = 22;
    this._lookT  = new THREE.Vector3();
  }

  // ── Lights ───────────────────────────────────────────────
  _initLights() {
    this.scene.add(new THREE.AmbientLight(0x03050a, 1.5));

    // Red key — critical/code
    this.redLight = new THREE.PointLight(0xff1744, 3.5, 45);
    this.redLight.position.set(0, 4, 14);
    this.scene.add(this.redLight);

    // Blue fill — memory/system
    this.blueLight = new THREE.PointLight(0x147eff, 2.8, 40);
    this.blueLight.position.set(-14, 2, 6);
    this.scene.add(this.blueLight);

    // Green rim — verified/analysis
    this.greenLight = new THREE.PointLight(0x00ff88, 2.0, 35);
    this.greenLight.position.set(10, -5, -6);
    this.scene.add(this.greenLight);

    // Cyan accent
    this.cyanLight = new THREE.PointLight(0x00e5ff, 1.5, 30);
    this.cyanLight.position.set(0, 8, 8);
    this.scene.add(this.cyanLight);
  }

  // ── Pointer (mouse + touch) ───────────────────────────────
  _bindPointer() {
    const update = (x, y) => {
      this.pointer.set(x, y);
      this.pointerN.set(
        (x / window.innerWidth)  * 2 - 1,
        -(y / window.innerHeight) * 2 + 1
      );
    };
    window.addEventListener('mousemove', e => update(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', e => {
      if (e.touches[0]) update(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
  }

  // ── Tab visibility — pause clock on hide ─────────────────
  _bindVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.clock.stop();
      } else {
        this.clock.start();
        // Re-prime the clock so delta doesn't spike
        this.clock.getDelta();
      }
    });
  }

  // ── Resize ───────────────────────────────────────────────
  _bindResize() {
    let _rt;
    window.addEventListener('resize', () => {
      clearTimeout(_rt);
      _rt = setTimeout(() => {
        const w = window.innerWidth, h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }, 120);
    }, { passive: true });
  }

  // ── Camera API (called by scroll / interaction) ──────────
  setCameraTarget({ rigPos, camZ, look } = {}) {
    if (rigPos) this._rigT.set(rigPos.x, rigPos.y, rigPos.z);
    if (camZ  !== undefined) this._camZT = camZ;
    if (look  ) this._lookT.set(look.x, look.y, look.z);
  }

  setLight(name, intensity) {
    const l = this[name + 'Light'];
    if (l) l.intensity = intensity;
  }

  // ── Subsystem registry ───────────────────────────────────
  register(name, fn) {
    this._systems.push({ name, fn, disabled: false, errorCount: 0 });
  }

  disable(name) {
    const s = this._systems.find(s => s.name === name);
    if (s) s.disabled = true;
  }

  // ── RAF loop ─────────────────────────────────────────────
  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this.clock.getDelta(); // prime
    this._raf();
  }

  _raf() {
    if (!this._running) return;
    requestAnimationFrame(t => this._raf(t));

    const delta   = Math.min(this.clock.getDelta(), 0.05); // cap at 50ms
    this.elapsed += delta;
    const t       = this.elapsed;

    Perf.tickFrame();

    // Pointer delta
    this.pointerDelta.subVectors(this.pointerN, this._prevPointer);
    this._prevPointer.copy(this.pointerN);

    // Camera lerp
    const s = 1 - Math.pow(0.02, delta);
    this.camRig.position.lerp(this._rigT, s * 0.6);
    this.camera.position.z += (this._camZT - this.camera.position.z) * s * 0.5;
    this.camPivot.rotation.y += (this.pointerN.x * 0.15 - this.camPivot.rotation.y) * s * 0.4;
    this.camPivot.rotation.x += (-this.pointerN.y * 0.10 - this.camPivot.rotation.x) * s * 0.4;

    // Light pulse
    const tp = t;
    if (this.redLight)   this.redLight.intensity   = 3.5 + Math.sin(tp * 0.9) * 0.5;
    if (this.blueLight)  this.blueLight.intensity  = 2.8 + Math.sin(tp * 0.6 + 1) * 0.4;
    if (this.greenLight) this.greenLight.intensity = 2.0 + Math.sin(tp * 0.4 + 2) * 0.3;

    // Run subsystems — isolated
    for (let i = 0; i < this._systems.length; i++) {
      const sys = this._systems[i];
      if (sys.disabled) continue;
      try {
        sys.fn(t, delta, this);
        sys.errorCount = 0;
        Perf.heartbeat(sys.name);
      } catch (e) {
        sys.errorCount++;
        if (sys.errorCount > 5) {
          sys.disabled = true;
          console.error(`[EAGLE] Subsystem '${sys.name}' disabled after repeated errors:`, e);
        }
      }
    }

    // Watchdog check every 2s
    if (t - this._lastWatchdog > 2) {
      this._lastWatchdog = t;
      Perf.checkWatchdogs();
    }

    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e) {
      console.error('[EAGLE] Render error:', e);
    }
  }

  stop() { this._running = false; }

  dispose() {
    this.stop();
    try { this.renderer.dispose(); } catch(e) {}
    try { this.scene.clear(); } catch(e) {}
  }
}
