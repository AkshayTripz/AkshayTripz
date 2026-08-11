// ============================================================
// EAGLE V2 — scene.js
// Renderer, camera rig, lights, global RAF loop.
// All modules register a tick() here — one loop runs everything.
// ============================================================

import * as THREE from 'three';
import { Perf } from './performance.js';

export class SceneManager {
  constructor(canvas) {
    this.canvas   = canvas;
    this.Q        = Perf.Q;
    this.width    = window.innerWidth;
    this.height   = window.innerHeight;
    this.mouse    = new THREE.Vector2();
    this.mouseSmooth = new THREE.Vector2();
    this.clock    = new THREE.Clock();
    this._tickers = [];         // registered modules
    this._running = false;
    this._disposables = [];

    if (this.Q.webglOk) {
      this._initRenderer();
      this._initScene();
      this._initCamera();
      this._initLights();
      this._bindEvents();
    }
  }

  // ── RENDERER ─────────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas:    this.canvas,
      antialias: this.Q.antialias,
      alpha:     false,
      powerPreference: 'high-performance',
      stencil:   false,
    });
    this.renderer.setPixelRatio(this.Q.dpr);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x03040a, 1);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = false;
  }

  // ── SCENE ────────────────────────────────────────────────
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x03040a, this.Q.fogDensity);
    this.scene.background = new THREE.Color(0x03040a);
  }

  // ── CAMERA RIG ───────────────────────────────────────────
  // Rig: parent (scroll position) → pivot (mouse parallax) → camera
  _initCamera() {
    this.cameraRig   = new THREE.Group();
    this.cameraPivot = new THREE.Group();
    this.camera      = new THREE.PerspectiveCamera(58, this.width / this.height, 0.1, 400);

    this.camera.position.set(0, 0, 22);
    this.cameraPivot.add(this.camera);
    this.cameraRig.add(this.cameraPivot);
    this.scene.add(this.cameraRig);

    // Target positions for smooth lerp
    this._rigTarget    = new THREE.Vector3(0, 0, 0);
    this._pivotTarget  = new THREE.Euler(0, 0, 0);
    this._camZTarget   = 22;
    this._camLookAt    = new THREE.Vector3(0, 0, 0);
    this._lookAtTarget = new THREE.Vector3(0, 0, 0);
  }

  // ── LIGHTS ───────────────────────────────────────────────
  _initLights() {
    // Near-black ambient — almost nothing
    const ambient = new THREE.AmbientLight(0x05060f, 1.2);
    this.scene.add(ambient);

    // Primary cyan key from front
    this.keyLight = new THREE.PointLight(0x00e5ff, 5, 50);
    this.keyLight.position.set(0, 4, 16);
    this.scene.add(this.keyLight);

    // Teal fill from left
    const fillL = new THREE.PointLight(0x0af5c8, 2.5, 35);
    fillL.position.set(-12, 2, 8);
    this.scene.add(fillL);

    // Deep blue back rim
    const rimL = new THREE.PointLight(0x4488ff, 2, 30);
    rimL.position.set(10, -5, -8);
    this.scene.add(rimL);

    // Subtle red accent (for dramatic pop on certain states)
    this.redLight = new THREE.PointLight(0xff3355, 0, 20);
    this.redLight.position.set(0, -8, 6);
    this.scene.add(this.redLight);
  }

  // ── EVENTS ───────────────────────────────────────────────
  _bindEvents() {
    window.addEventListener('mousemove', e => {
      this.mouse.set(
        (e.clientX / this.width)  * 2 - 1,
        -(e.clientY / this.height) * 2 + 1
      );
    }, { passive: true });

    window.addEventListener('resize', () => this._onResize(), { passive: true });
  }

  _onResize() {
    this.width  = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  // ── MODULE REGISTRATION ───────────────────────────────────
  register(module) {
    if (typeof module.tick === 'function') {
      this._tickers.push(module);
    }
  }

  // ── CAMERA CHOREOGRAPHY API ───────────────────────────────
  // Other modules call these to move the camera
  moveCameraTo(pos, lookAt, duration = 1.2) {
    // pos: {x,y,z} for cameraRig, camZ for camera local z
    if (pos.rig)   this._rigTarget.set(pos.rig.x, pos.rig.y, pos.rig.z);
    if (pos.camZ !== undefined) this._camZTarget = pos.camZ;
    if (lookAt) this._lookAtTarget.set(lookAt.x, lookAt.y, lookAt.z);
  }

  setRedLight(intensity) {
    if (this.redLight) this.redLight.intensity = intensity;
  }

  // ── RAF LOOP ─────────────────────────────────────────────
  start() {
    if (!this.Q.webglOk || this._running) return;
    this._running = true;
    this._loop();
  }

  _loop() {
    if (!this._running) return;
    requestAnimationFrame(() => this._loop());

    const delta = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    Perf.tick();

    // ── Mouse smooth ──
    this.mouseSmooth.x += (this.mouse.x - this.mouseSmooth.x) * 0.05;
    this.mouseSmooth.y += (this.mouse.y - this.mouseSmooth.y) * 0.05;

    // ── Camera parallax (pivot) ──
    this.cameraPivot.rotation.y += (this.mouseSmooth.x * 0.18 - this.cameraPivot.rotation.y) * 0.04;
    this.cameraPivot.rotation.x += (-this.mouseSmooth.y * 0.12 - this.cameraPivot.rotation.x) * 0.04;

    // ── Camera rig scroll-driven position ──
    this.cameraRig.position.x += (this._rigTarget.x - this.cameraRig.position.x) * 0.05;
    this.cameraRig.position.y += (this._rigTarget.y - this.cameraRig.position.y) * 0.05;
    this.cameraRig.position.z += (this._rigTarget.z - this.cameraRig.position.z) * 0.05;

    // ── Camera Z (approach/retreat) ──
    this.camera.position.z += (this._camZTarget - this.camera.position.z) * 0.04;

    // ── Key light pulse ──
    if (this.keyLight) {
      this.keyLight.intensity = 5 + Math.sin(elapsed * 0.7) * 0.6;
    }

    // ── Tick all modules ──
    for (let i = 0; i < this._tickers.length; i++) {
      this._tickers[i].tick(elapsed, delta, this.mouseSmooth);
    }

    // ── Render ──
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  stop() { this._running = false; }

  dispose() {
    this.stop();
    this._disposables.forEach(d => d.dispose?.());
    this.renderer?.dispose();
  }
}
