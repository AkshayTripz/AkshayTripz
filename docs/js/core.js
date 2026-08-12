// ============================================================
// EAGLE V3 — core.js
// EAGLE CORE: the central 3D executable object.
// Never stops animating. State machine: SEALED→HEADERS→
// SECTIONS→MEMORY→IMPORTS→CFG.
// Scanning beam sweeps continuously.
// ============================================================

import * as THREE from 'three';

const PE_SECTIONS = [
  { name:'.text',  color:0xff1744, perm:'R-X', desc:'Executable code',     offsetY: 2.4,  w:2.8 },
  { name:'.data',  color:0x147eff, perm:'RW-', desc:'Initialized data',    offsetY: 1.1,  w:2.4 },
  { name:'.rdata', color:0x00ff88, perm:'R--', desc:'Read-only / imports', offsetY: 0.0,  w:2.6 },
  { name:'.bss',   color:0xff9100, perm:'RW-', desc:'Uninitialized data',  offsetY:-1.1,  w:2.0 },
  { name:'.rsrc',  color:0xaa44ff, perm:'R--', desc:'Resources',           offsetY:-2.0,  w:1.8 },
];

export class Core {
  constructor(engine, gsap) {
    this.E    = engine;
    this.gsap = gsap;
    this.scene = engine.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.state = 'SEALED';
    this._d    = [];
    this.rayTargets = [];

    this._buildSealed();
    this._buildSectionSlabs();
    this._buildScanBeam();

    engine.register('core', (t, dt) => this._tick(t, dt));
  }

  // ── SEALED — icosahedral shell ────────────────────────────
  _buildSealed() {
    this._sg = new THREE.Group();

    const mkMat = (color, wire, op) => {
      const m = new THREE.MeshPhongMaterial({
        color, wireframe: wire, transparent: true, opacity: op,
        emissive: new THREE.Color(color).multiplyScalar(0.2), shininess: 80,
      });
      this._d.push(m);
      return m;
    };

    // Core
    const cg = new THREE.IcosahedronGeometry(1.8, 2);
    this._coreMesh = new THREE.Mesh(cg, mkMat(0xff1744, false, 0.6));
    this._coreMesh.userData = {
      type:'CORE', label:'EAGLE CORE', addr:'0x00400000',
      info:{ Arch:'x86-64', Type:'PE32+', EP:'0x00401A30', Sections:'5', Imports:'14' }
    };
    this._sg.add(this._coreMesh);
    this.rayTargets.push(this._coreMesh);
    this._d.push(cg);

    // Mid wireframe (counter-rotate)
    const mg = new THREE.IcosahedronGeometry(2.5, 2);
    this._midMesh = new THREE.Mesh(mg, mkMat(0x147eff, true, 0.25));
    this._sg.add(this._midMesh);
    this._d.push(mg);

    // Outer shell
    const og = new THREE.IcosahedronGeometry(3.3, 1);
    this._outerMesh = new THREE.Mesh(og, mkMat(0x00ff88, true, 0.10));
    this._sg.add(this._outerMesh);
    this._d.push(og);

    // Orbital rings — RED / BLUE / GREEN
    this._rings = [];
    [
      { r:4.8, c:0xff1744, op:0.4, tilt:[0.5,0,0],   spd: 0.005 },
      { r:6.5, c:0x147eff, op:0.28, tilt:[1.6,0.4,0], spd:-0.003 },
      { r:8.5, c:0x00ff88, op:0.15, tilt:[0.9,0.6,0.3], spd: 0.002 },
    ].forEach(s => {
      const g = new THREE.TorusGeometry(s.r, 0.007, 6, this.E.Q.orbitSegs);
      const m = new THREE.MeshBasicMaterial({ color:s.c, transparent:true, opacity:s.op });
      const mesh = new THREE.Mesh(g, m);
      mesh.rotation.set(...s.tilt);
      this._sg.add(mesh);
      this._rings.push({ mesh, spd: s.spd });
      this._d.push(g, m);
    });

    // Orbit dot nodes
    const dg  = new THREE.SphereGeometry(0.08, 6, 6);
    const dm  = new THREE.MeshBasicMaterial({ color:0xff1744 });
    this._d.push(dg, dm);
    this._orbitDots = [];
    for (let i = 0; i < 8; i++) {
      const dot = new THREE.Mesh(dg, dm);
      dot.userData.angle = (i/8)*Math.PI*2;
      dot.userData.r     = 8.5;
      this._sg.add(dot);
      this._orbitDots.push(dot);
    }

    // Connecting lines between ring dots
    this._buildNodeLines(this._sg);

    this.group.add(this._sg);
  }

  _buildNodeLines(parent) {
    const lm = new THREE.LineBasicMaterial({ color:0xff1744, transparent:true, opacity:0.2 });
    this._d.push(lm);
    this._dataLines = [];
    for (let i = 0; i < 6; i++) {
      const pts = [
        new THREE.Vector3(rnd(-4,4), rnd(-4,4), rnd(-2,2)),
        new THREE.Vector3(rnd(-4,4), rnd(-4,4), rnd(-2,2)),
      ];
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      const l = new THREE.Line(g, lm);
      parent.add(l);
      this._dataLines.push({ line: l, pts, t: Math.random()*Math.PI*2 });
      this._d.push(g);
    }
  }

  // ── SECTION SLABS ────────────────────────────────────────
  _buildSectionSlabs() {
    this._sectionsGroup = new THREE.Group();
    this._sectionsGroup.visible = false;
    this._sectionMeshes = [];

    PE_SECTIONS.forEach((sec, i) => {
      const geo = new THREE.BoxGeometry(sec.w, 0.45, 1.8);
      const mat = new THREE.MeshPhongMaterial({
        color: sec.color, emissive: new THREE.Color(sec.color).multiplyScalar(0.25),
        transparent: true, opacity: 0.8, shininess: 60,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0, 0);
      mesh.userData = {
        type:'SECTION', label:sec.name, addr:`0x${(0x1000+i*0x1800).toString(16).toUpperCase()}`,
        info:{ Name:sec.name, Perm:sec.perm, Desc:sec.desc },
        targetY: sec.offsetY, color: sec.color,
      };

      const eg = new THREE.EdgesGeometry(geo);
      const em = new THREE.LineBasicMaterial({ color:sec.color, transparent:true, opacity:0.7 });
      mesh.add(new THREE.LineSegments(eg, em));
      this._d.push(geo, mat, eg, em);

      this._sectionsGroup.add(mesh);
      this._sectionMeshes.push(mesh);
      this.rayTargets.push(mesh);
    });

    this.group.add(this._sectionsGroup);
  }

  // ── CONTINUOUS SCAN BEAM ──────────────────────────────────
  _buildScanBeam() {
    const geo = new THREE.TorusGeometry(4.5, 0.009, 4, 100);
    const mat = new THREE.MeshBasicMaterial({ color:0x00ff88, transparent:true, opacity:0.5 });
    this._scanRing = new THREE.Mesh(geo, mat);
    this._scanRing.rotation.x = Math.PI/2;
    this._sg.add(this._scanRing);
    this._d.push(geo, mat);
  }

  // ── STATE TRANSITIONS ─────────────────────────────────────
  transitionTo(state) {
    if (this.state === state) return;
    this.state = state;
    const g = this.gsap;

    switch (state) {
      case 'HEADERS':
        g.to(this._coreMesh.material, { opacity:0.35, duration:0.7 });
        g.to(this._sg.scale, { x:1.2, y:1.2, z:1.2, duration:1.0, ease:'power2.out' });
        break;

      case 'SECTIONS':
        g.to(this._sg.scale, { x:0.001, y:0.001, z:0.001, duration:0.6, ease:'power2.in',
          onComplete:() => { this._sg.visible=false; }
        });
        this._sectionsGroup.visible = true;
        this._sectionMeshes.forEach((m,i) => {
          m.position.set(0,0,0);
          m.scale.set(0,0,0);
          g.to(m.position, { y:m.userData.targetY, duration:1.0, delay:i*0.1, ease:'power3.out' });
          g.to(m.scale,    { x:1,y:1,z:1, duration:0.6, delay:i*0.1, ease:'back.out(1.4)' });
        });
        break;

      case 'MEMORY':
        this._sectionMeshes.forEach((m,i) => {
          g.to(m.position, { x:rnd(-1.5,1.5), y:m.userData.targetY*1.7, z:rnd(-1,1),
            duration:1.2, delay:i*0.08, ease:'power2.out' });
          g.to(m.scale,    { x:1.15, z:1.4, duration:1.0, delay:i*0.08 });
        });
        break;

      case 'IMPORTS':
        this._sectionMeshes.forEach((m,i) => g.to(m.material, { opacity:0.18, duration:0.5, delay:i*0.05 }));
        break;

      case 'SEALED':
        this._sg.visible = true;
        g.to(this._sg.scale, { x:1,y:1,z:1, duration:0.8, ease:'power2.out' });
        g.to(this._coreMesh.material, { opacity:0.6, duration:0.6 });
        this._sectionsGroup.visible = false;
        this._sectionMeshes.forEach(m => { m.position.set(0,0,0); m.scale.set(1,1,1); });
        break;
    }
  }

  highlight(mesh, on) {
    if (!mesh?.material) return;
    if (on) {
      mesh._pe = mesh.material.emissiveIntensity;
      mesh.material.emissiveIntensity = 0.7;
    } else {
      mesh.material.emissiveIntensity = mesh._pe ?? 0.2;
    }
  }

  // ── TICK — never stops ─────────────────────────────────────
  _tick(t, dt) {
    // Sealed group rotates continuously
    if (this._sg.visible) {
      this._sg.rotation.y    += 0.004 * dt * 60;
      this._midMesh.rotation.y  -= 0.006 * dt * 60;
      this._outerMesh.rotation.x += 0.003 * dt * 60;
    }

    // Rings always spin
    this._rings.forEach(r => { r.mesh.rotation.z += r.spd * dt * 60; });

    // Orbit dots
    this._orbitDots.forEach(dot => {
      dot.userData.angle += 0.006 * dt * 60;
      const a = dot.userData.angle;
      dot.position.set(Math.cos(a)*8.5, Math.sin(a)*8.5*0.25, 0);
    });

    // Scan ring sweeps Z and pulses
    if (this._scanRing) {
      this._scanRing.rotation.z = t * 0.6;
      this._scanRing.material.opacity = 0.3 + Math.sin(t*1.4)*0.2;
    }

    // Data connection lines animate
    if (this._dataLines) {
      this._dataLines.forEach(dl => {
        dl.t += dt * 0.5;
        const p = dl.line.geometry.attributes.position;
        p.array[0] = Math.cos(dl.t) * 3;
        p.array[1] = Math.sin(dl.t*1.3) * 3;
        p.array[3] = Math.cos(dl.t+Math.PI) * 3;
        p.array[4] = Math.sin(dl.t*0.8+1) * 3;
        p.needsUpdate = true;
      });
    }

    // Sections breathe
    if (this._sectionsGroup.visible) {
      this._sectionMeshes.forEach((m,i) => {
        m.scale.y = 1 + Math.sin(t*0.9+i*0.6)*0.06;
      });
    }
  }

  dispose() {
    this._d.forEach(d => d.dispose?.());
    this.scene.remove(this.group);
  }
}

function rnd(a,b) { return a+Math.random()*(b-a); }
