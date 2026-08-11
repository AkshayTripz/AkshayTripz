// ============================================================
// EAGLE — scene.js
// Core Three.js environment: hero object, lighting, orbital rings
// ============================================================

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.width  = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr    = Math.min(window.devicePixelRatio, 2);
    this.mouse  = new THREE.Vector2();
    this.target = new THREE.Vector2();
    this.clock  = new THREE.Clock();
    this.isMobile = window.innerWidth < 768;

    this._objects = [];
    this._disposables = [];

    this._initRenderer();
    this._initCamera();
    this._initScene();
    this._initLights();
    this._buildHeroObject();
    this._buildOrbitalRings();
    this._buildFloatingGeometry();
    this._bindEvents();
  }

  // ── RENDERER ──────────────────────────────────────────────
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !this.isMobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  // ── CAMERA ────────────────────────────────────────────────
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 500);
    this.camera.position.set(0, 0, 18);
    this.cameraBasePos = new THREE.Vector3(0, 0, 18);
  }

  // ── SCENE ─────────────────────────────────────────────────
  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050507, 0.022);
  }

  // ── LIGHTS ────────────────────────────────────────────────
  _initLights() {
    const ambient = new THREE.AmbientLight(0x0a0a14, 1.0);
    this.scene.add(ambient);

    // Primary cyan key light
    const keyLight = new THREE.PointLight(0x0ae4c8, 4, 40);
    keyLight.position.set(0, 0, 10);
    this.scene.add(keyLight);
    this._keyLight = keyLight;

    // Rim from behind
    const rimLight = new THREE.PointLight(0x0891b2, 2, 30);
    rimLight.position.set(-8, 4, -5);
    this.scene.add(rimLight);

    // Subtle purple fill
    const fillLight = new THREE.PointLight(0x1a0a3a, 1.5, 25);
    fillLight.position.set(8, -4, 5);
    this.scene.add(fillLight);
  }

  // ── HERO OBJECT ───────────────────────────────────────────
  // A layered binary-core: icosahedron wireframe + inner solid + detail rings
  _buildHeroObject() {
    this.heroGroup = new THREE.Group();

    const accentColor = 0x0ae4c8;
    const dimColor    = 0x0e7490;
    const darkColor   = 0x041a1f;

    // -- Inner solid core --
    const coreGeo = new THREE.IcosahedronGeometry(1.8, 1);
    const coreMat = new THREE.MeshPhongMaterial({
      color: darkColor,
      emissive: new THREE.Color(0x041a1f),
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.7,
      shininess: 120,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.heroGroup.add(coreMesh);
    this._disposables.push(coreGeo, coreMat);

    // -- Mid wireframe --
    const midGeo = new THREE.IcosahedronGeometry(2.4, 1);
    const midMat = new THREE.MeshBasicMaterial({
      color: dimColor,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const midMesh = new THREE.Mesh(midGeo, midMat);
    this.heroGroup.add(midMesh);
    this._midMesh = midMesh;
    this._disposables.push(midGeo, midMat);

    // -- Outer wireframe --
    const outerGeo = new THREE.IcosahedronGeometry(3.2, 2);
    const outerMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      wireframe: true,
      transparent: true,
      opacity: 0.12,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    this.heroGroup.add(outerMesh);
    this._outerMesh = outerMesh;
    this._disposables.push(outerGeo, outerMat);

    // -- Floating hex planes (circuit-board feel) --
    const planeGeo = new THREE.PlaneGeometry(0.6, 0.6);
    const planeMat = new THREE.MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.18,
      side: THREE.DoubleSide,
    });

    const hexPositions = [
      [3.5, 1.2, 0.8], [-3.2, 0.8, -0.5], [1.8, 3.0, 1.0],
      [-1.5, -2.8, 0.6], [2.8, -2.0, -0.8], [-2.5, 1.8, 1.2],
    ];

    hexPositions.forEach(([x, y, z]) => {
      const p = new THREE.Mesh(planeGeo, planeMat);
      p.position.set(x, y, z);
      p.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.heroGroup.add(p);
      this._objects.push({ mesh: p, rotSpeed: (Math.random() - 0.5) * 0.01 });
    });
    this._disposables.push(planeGeo, planeMat);

    // -- Scan line sweep (thin torus, animated) --
    const scanGeo = new THREE.TorusGeometry(3.4, 0.008, 4, 80);
    const scanMat = new THREE.MeshBasicMaterial({ color: accentColor, transparent: true, opacity: 0.5 });
    this._scanRing = new THREE.Mesh(scanGeo, scanMat);
    this._scanRing.rotation.x = Math.PI / 2;
    this.heroGroup.add(this._scanRing);
    this._disposables.push(scanGeo, scanMat);

    this.heroGroup.position.set(0, 0, 0);
    this.scene.add(this.heroGroup);
  }

  // ── ORBITAL RINGS ─────────────────────────────────────────
  _buildOrbitalRings() {
    this.ringsGroup = new THREE.Group();

    const specs = [
      { r: 5.5,  tube: 0.006, color: 0x0891b2, opacity: 0.4, tilt: [0.4, 0, 0],        speed: 0.003  },
      { r: 7.0,  tube: 0.005, color: 0x0ae4c8, opacity: 0.25, tilt: [Math.PI/2, 0.3, 0], speed: -0.002 },
      { r: 9.0,  tube: 0.004, color: 0x0e7490, opacity: 0.15, tilt: [0.8, 0.5, 0],       speed: 0.0015 },
    ];

    this._rings = [];
    specs.forEach(s => {
      const geo = new THREE.TorusGeometry(s.r, s.tube, 6, 120);
      const mat = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.opacity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(...s.tilt);
      this.ringsGroup.add(mesh);
      this._rings.push({ mesh, speed: s.speed });
      this._disposables.push(geo, mat);
    });

    // Dot markers on the largest ring
    const dotGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x0ae4c8 });
    const dotCount = 8;
    for (let i = 0; i < dotCount; i++) {
      const angle = (i / dotCount) * Math.PI * 2;
      const dot   = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(Math.cos(angle) * 9.0, Math.sin(angle) * 9.0, 0);
      dot.userData.baseAngle = angle;
      this.ringsGroup.add(dot);
      this._objects.push({ mesh: dot, type: 'orbitDot', radius: 9.0 });
    }
    this._disposables.push(dotGeo, dotMat);

    this.scene.add(this.ringsGroup);
  }

  // ── SMALL FLOATING GEOMETRY ───────────────────────────────
  _buildFloatingGeometry() {
    if (this.isMobile) return;

    this.floatGroup = new THREE.Group();

    const mat = new THREE.MeshBasicMaterial({
      color: 0x0ae4c8,
      wireframe: true,
      transparent: true,
      opacity: 0.2,
    });

    const geoFns = [
      () => new THREE.OctahedronGeometry(0.25),
      () => new THREE.TetrahedronGeometry(0.2),
      () => new THREE.BoxGeometry(0.3, 0.3, 0.3),
    ];

    const count = 18;
    this._floaters = [];
    for (let i = 0; i < count; i++) {
      const geo = geoFns[i % 3]();
      const mesh = new THREE.Mesh(geo, mat);
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      const r     = 10 + Math.random() * 7;
      mesh.position.set(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.6,
        r * Math.cos(phi),
      );
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.floatGroup.add(mesh);
      this._floaters.push({
        mesh,
        rotX: (Math.random() - 0.5) * 0.008,
        rotY: (Math.random() - 0.5) * 0.008,
        floatAmp: 0.3 + Math.random() * 0.5,
        floatFreq: 0.4 + Math.random() * 0.6,
        floatOffset: Math.random() * Math.PI * 2,
        baseY: mesh.position.y,
      });
      this._disposables.push(geo);
    }
    this._disposables.push(mat);

    this.scene.add(this.floatGroup);
  }

  // ── EVENTS ────────────────────────────────────────────────
  _bindEvents() {
    window.addEventListener('mousemove', e => {
      this.mouse.set(
        (e.clientX / this.width)  * 2 - 1,
        -(e.clientY / this.height) * 2 + 1,
      );
    });

    window.addEventListener('resize', () => this._onResize());
  }

  _onResize() {
    this.width   = window.innerWidth;
    this.height  = window.innerHeight;
    this.isMobile = this.width < 768;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  // ── TICK ──────────────────────────────────────────────────
  tick(scrollProgress = 0) {
    const t = this.clock.getElapsedTime();

    // Smooth mouse target
    this.target.x += (this.mouse.x - this.target.x) * 0.04;
    this.target.y += (this.mouse.y - this.target.y) * 0.04;

    // Hero group rotation
    this.heroGroup.rotation.y += 0.003;
    this.heroGroup.rotation.x = this.target.y * 0.18;
    this.heroGroup.rotation.z = this.target.x * 0.08;

    // Counter-rotate mid/outer meshes for layered feel
    if (this._midMesh)  this._midMesh.rotation.y  -= 0.005;
    if (this._outerMesh) this._outerMesh.rotation.x += 0.002;

    // Scan ring sweep
    if (this._scanRing) {
      this._scanRing.rotation.z = t * 0.4;
      this._scanRing.material.opacity = 0.3 + Math.sin(t * 1.2) * 0.2;
    }

    // Orbital rings
    this._rings.forEach(({ mesh, speed }) => {
      mesh.rotation.z += speed;
    });

    // Orbit dots
    this._objects.forEach(obj => {
      if (obj.type === 'orbitDot') {
        const a = obj.mesh.userData.baseAngle + t * 0.25;
        obj.mesh.position.set(Math.cos(a) * obj.radius, Math.sin(a) * obj.radius, 0);
      } else if (obj.rotSpeed !== undefined) {
        obj.mesh.rotation.y += obj.rotSpeed;
        obj.mesh.rotation.x += obj.rotSpeed * 0.5;
      }
    });

    // Floaters
    if (this._floaters) {
      this._floaters.forEach(f => {
        f.mesh.rotation.x += f.rotX;
        f.mesh.rotation.y += f.rotY;
        f.mesh.position.y = f.baseY + Math.sin(t * f.floatFreq + f.floatOffset) * f.floatAmp;
      });
    }

    // Key light pulse
    if (this._keyLight) {
      this._keyLight.intensity = 4.0 + Math.sin(t * 0.8) * 0.8;
    }

    // Camera parallax + scroll drift
    this.camera.position.x += (this.target.x * 1.5 - this.camera.position.x) * 0.03;
    this.camera.position.y += (this.target.y * 1.0 - this.camera.position.y) * 0.03;
    this.camera.position.z  = this.cameraBasePos.z + scrollProgress * 8;
    this.camera.lookAt(0, 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  // ── DISPOSE ───────────────────────────────────────────────
  dispose() {
    this._disposables.forEach(d => d.dispose());
    this.renderer.dispose();
  }
}
