// ============================================================
// EAGLE V2 — core.js
// The EAGLE CORE: a sealed executable that progressively
// dissects into PE sections → memory → imports → CFG.
//
// States: SEALED → HEADERS → SECTIONS → MEMORY → IMPORTS → CFG
// Each state transition is a GSAP-driven 3D animation.
// ============================================================

import * as THREE from 'three';
import { Perf } from './performance.js';

// Section data — each becomes a physical 3D slab
const PE_SECTIONS = [
  { name: '.text',  addr: '0x1000', size: '0x4800', color: 0x00e5ff, perm: 'R-X', desc: 'Executable code',          w: 2.4, h: 0.5, d: 1.6, offsetY:  2.2 },
  { name: '.data',  addr: '0x5800', size: '0x0A00', color: 0x0af5c8, perm: 'RW-', desc: 'Initialized data',         w: 2.4, h: 0.3, d: 1.6, offsetY:  1.2 },
  { name: '.rdata', addr: '0x6800', size: '0x0C00', color: 0x4488ff, perm: 'R--', desc: 'Read-only data / imports', w: 2.4, h: 0.35, d: 1.6, offsetY: 0.1 },
  { name: '.bss',   addr: '0x7500', size: '0x0300', color: 0x8866ff, perm: 'RW-', desc: 'Uninitialized data',       w: 2.4, h: 0.2, d: 1.6, offsetY: -0.8 },
  { name: '.rsrc',  addr: '0x7800', size: '0x0200', color: 0xff8844, perm: 'R--', desc: 'Resources',                w: 2.4, h: 0.2, d: 1.6, offsetY: -1.5 },
];

const IMPORT_DLLS = [
  { name: 'KERNEL32.dll', fns: ['CreateFileW','VirtualAlloc','GetProcAddress','CreateProcessW'] },
  { name: 'ntdll.dll',    fns: ['NtQuerySystemInformation','LdrLoadDll','RtlAllocateHeap'] },
  { name: 'USER32.dll',   fns: ['MessageBoxW','CreateWindowExW','GetMessageW'] },
  { name: 'ADVAPI32.dll', fns: ['RegOpenKeyExW','CryptAcquireContextW'] },
];

export class EagleCore {
  constructor(scene, Q) {
    this.scene    = scene;
    this.Q        = Q;
    this.group    = new THREE.Group();
    this.scene.add(this.group);

    this.state    = 'SEALED';
    this._time    = 0;
    this._sectionMeshes  = [];
    this._importNodes    = [];
    this._orbitals       = [];
    this._connLines      = [];
    this._disposables    = [];

    // Raycasting targets — filled as meshes are created
    this.rayTargets = [];

    this._buildSealed();
    this._buildOrbitalRings();
    this._buildSectionSlabs();   // hidden initially
    this._buildImportGraph();    // hidden initially
  }

  // ── SEALED STATE — complex icosahedral shell ──────────────
  _buildSealed() {
    this._sealedGroup = new THREE.Group();

    const mat = (color, opacity, wire) => {
      const m = new THREE.MeshPhongMaterial({
        color, wireframe: wire,
        transparent: true, opacity,
        emissive: new THREE.Color(color).multiplyScalar(0.15),
        shininess: 80,
      });
      this._disposables.push(m);
      return m;
    };

    // Core solid
    const coreGeo  = new THREE.IcosahedronGeometry(1.6, 2);
    const coreMesh = new THREE.Mesh(coreGeo, mat(0x00e5ff, 0.55, false));
    coreMesh.userData = { type: 'CORE', label: 'EAGLE CORE', addr: '0x00400000', info: { Architecture: 'x86-64', Type: 'PE32+', Sections: '5', Imports: '14 functions', EP: '0x00401A30' } };
    this._sealedGroup.add(coreMesh);
    this._disposables.push(coreGeo);
    this.rayTargets.push(coreMesh);
    this._coreMesh = coreMesh;

    // Mid wireframe (counter-rotates)
    const midGeo  = new THREE.IcosahedronGeometry(2.1, 2);
    const midMesh = new THREE.Mesh(midGeo, mat(0x0af5c8, 0.22, true));
    this._sealedGroup.add(midMesh);
    this._disposables.push(midGeo);
    this._midMesh = midMesh;

    // Outer shell
    const outerGeo  = new THREE.IcosahedronGeometry(2.8, 1);
    const outerMesh = new THREE.Mesh(outerGeo, mat(0x4488ff, 0.08, true));
    this._sealedGroup.add(outerMesh);
    this._disposables.push(outerGeo);
    this._outerMesh = outerMesh;

    // Scan ring
    const scanGeo = new THREE.TorusGeometry(3.1, 0.007, 4, 100);
    const scanMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.5 });
    this._scanRing = new THREE.Mesh(scanGeo, scanMat);
    this._scanRing.rotation.x = Math.PI / 2;
    this._sealedGroup.add(this._scanRing);
    this._disposables.push(scanGeo, scanMat);

    // PE header floating label geometry (small planes with circuit-board look)
    this._buildCircuitPlanes(this._sealedGroup, 8);

    this.group.add(this._sealedGroup);
  }

  _buildCircuitPlanes(parent, count) {
    const geo = new THREE.PlaneGeometry(0.5, 0.3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff, transparent: true, opacity: 0.15, side: THREE.DoubleSide
    });
    this._disposables.push(geo, mat);
    this._circuitPlanes = [];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat);
      const a = (i / count) * Math.PI * 2;
      const r = 3.4 + Math.random() * 0.8;
      m.position.set(Math.cos(a)*r, (Math.random()-0.5)*2, Math.sin(a)*r);
      m.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
      m.userData = { baseA: a, r, speed: (Math.random()-0.5)*0.008 };
      parent.add(m);
      this._circuitPlanes.push(m);
    }
  }

  // ── ORBITAL RINGS ─────────────────────────────────────────
  _buildOrbitalRings() {
    this._ringsGroup = new THREE.Group();
    const specs = [
      { r: 4.5, tube: 0.005, color: 0x00e5ff, opacity: 0.35, tilt: [0.4, 0, 0],           speed:  0.004 },
      { r: 6.0, tube: 0.004, color: 0x0af5c8, opacity: 0.2,  tilt: [Math.PI/2, 0.3, 0],   speed: -0.003 },
      { r: 8.0, tube: 0.003, color: 0x4488ff, opacity: 0.12, tilt: [0.9, 0.4, 0.2],        speed:  0.002 },
    ];
    this._rings = [];
    specs.forEach(s => {
      const geo  = new THREE.TorusGeometry(s.r, s.tube, 6, this.Q.orbitSegments);
      const mat  = new THREE.MeshBasicMaterial({ color: s.color, transparent: true, opacity: s.opacity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(...s.tilt);
      this._ringsGroup.add(mesh);
      this._rings.push({ mesh, speed: s.speed });
      this._disposables.push(geo, mat);
    });

    // Orbital dot nodes (small spheres on the outermost ring)
    const dotGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    this._disposables.push(dotGeo, dotMat);
    this._orbitDots = [];
    for (let i = 0; i < 6; i++) {
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.userData.baseAngle = (i / 6) * Math.PI * 2;
      this._ringsGroup.add(dot);
      this._orbitDots.push(dot);
    }

    this.group.add(this._ringsGroup);
  }

  // ── SECTION SLABS — PE sections as 3D boxes ───────────────
  _buildSectionSlabs() {
    this._sectionsGroup = new THREE.Group();
    this._sectionsGroup.visible = false;

    PE_SECTIONS.forEach((sec, i) => {
      const geo = new THREE.BoxGeometry(sec.w, sec.h, sec.d);
      const mat = new THREE.MeshPhongMaterial({
        color:       sec.color,
        emissive:    new THREE.Color(sec.color).multiplyScalar(0.2),
        transparent: true,
        opacity:     0.75,
        shininess:   60,
      });
      const mesh = new THREE.Mesh(geo, mat);

      // Sealed position = packed together (same Y)
      mesh.position.set(0, 0, 0);
      mesh.userData = {
        type:       'SECTION',
        label:      sec.name,
        addr:       sec.addr,
        info: {
          Name:  sec.name,
          Addr:  sec.addr,
          Size:  sec.size,
          Perms: sec.perm,
          Desc:  sec.desc,
        },
        sealedPos:  new THREE.Vector3(0, 0, 0),
        explodedPos: new THREE.Vector3(0, sec.offsetY, 0),
        idx: i,
        color: sec.color,
      };

      // Wireframe outline
      const edgeGeo = new THREE.EdgesGeometry(geo);
      const edgeMat = new THREE.LineBasicMaterial({ color: sec.color, transparent: true, opacity: 0.6 });
      const edges   = new THREE.LineSegments(edgeGeo, edgeMat);
      mesh.add(edges);
      this._disposables.push(geo, mat, edgeGeo, edgeMat);

      this._sectionsGroup.add(mesh);
      this._sectionMeshes.push(mesh);
      this.rayTargets.push(mesh);
    });

    this.group.add(this._sectionsGroup);
  }

  // ── IMPORT GRAPH — floating dependency nodes ───────────────
  _buildImportGraph() {
    this._importsGroup = new THREE.Group();
    this._importsGroup.visible = false;

    const nodeGeo  = new THREE.SphereGeometry(0.18, 10, 10);
    const lineMat  = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.3 });
    this._disposables.push(nodeGeo, lineMat);

    // Center hub (the binary itself)
    const hubGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const hubMat = new THREE.MeshPhongMaterial({ color: 0x00e5ff, emissive: new THREE.Color(0x00e5ff).multiplyScalar(0.3), transparent: true, opacity: 0.8 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.set(0, 0, 0);
    hub.userData = { type: 'HUB', label: 'target.exe', addr: '0x00400000', info: { Type: 'PE32+', Size: '0x7800', Imports: IMPORT_DLLS.length + ' DLLs' } };
    this._importsGroup.add(hub);
    this._importNodes.push(hub);
    this.rayTargets.push(hub);
    this._disposables.push(hubGeo, hubMat);

    // DLL nodes arranged in a ring
    IMPORT_DLLS.forEach((dll, i) => {
      const angle = (i / IMPORT_DLLS.length) * Math.PI * 2;
      const r     = 4.5;
      const x     = Math.cos(angle) * r;
      const y     = Math.sin(angle) * r * 0.4;

      const mat  = new THREE.MeshPhongMaterial({
        color: 0x0af5c8,
        emissive: new THREE.Color(0x0af5c8).multiplyScalar(0.25),
        transparent: true, opacity: 0.85,
      });
      const node = new THREE.Mesh(nodeGeo, mat);
      node.position.set(x, y, 0);
      node.userData = {
        type: 'IMPORT',
        label: dll.name,
        addr: '— external —',
        info: { DLL: dll.name, Functions: dll.fns.length, FnList: dll.fns.join(', ') },
        angle, r,
      };
      this._importsGroup.add(node);
      this._importNodes.push(node);
      this.rayTargets.push(node);
      this._disposables.push(mat);

      // Line from hub to node
      const pts = [new THREE.Vector3(0,0,0), new THREE.Vector3(x, y, 0)];
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
      const line    = new THREE.Line(lineGeo, lineMat);
      this._importsGroup.add(line);
      this._connLines.push(line);
      this._disposables.push(lineGeo);

      // Function sub-nodes
      dll.fns.forEach((fn, fi) => {
        const subAngle = angle + (fi - dll.fns.length/2) * 0.2;
        const subR = r + 2.0;
        const sx = Math.cos(subAngle) * subR;
        const sy = Math.sin(subAngle) * subR * 0.4;
        const subGeo = new THREE.SphereGeometry(0.08, 6, 6);
        const subMat = new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 });
        const sub    = new THREE.Mesh(subGeo, subMat);
        sub.position.set(sx, sy, 0);
        sub.userData = { type: 'FUNCTION', label: fn, addr: `0x${(0x401000 + fi*0x80).toString(16).toUpperCase()}`, info: { Function: fn, DLL: dll.name } };
        this._importsGroup.add(sub);
        this.rayTargets.push(sub);
        this._disposables.push(subGeo, subMat);

        const subPts = [new THREE.Vector3(x,y,0), new THREE.Vector3(sx,sy,0)];
        const subLineGeo = new THREE.BufferGeometry().setFromPoints(subPts);
        const subLine    = new THREE.Line(subLineGeo, lineMat);
        this._importsGroup.add(subLine);
        this._disposables.push(subLineGeo);
      });
    });

    this.group.add(this._importsGroup);
  }

  // ── STATE TRANSITIONS ─────────────────────────────────────
  // Called by scroll.js at the right scroll depth

  transitionTo(newState, gsap) {
    if (this.state === newState) return;
    const prev = this.state;
    this.state = newState;

    switch (newState) {

      case 'HEADERS':
        // Core starts glitching and cracking apart
        this._sealedGroup.visible = true;
        gsap.to(this._coreMesh.material, { opacity: 0.3, duration: 0.8 });
        gsap.to(this._outerMesh.material, { opacity: 0.25, duration: 0.8 });
        // Scale the whole sealed group slightly
        gsap.to(this._sealedGroup.scale, { x: 1.15, y: 1.15, z: 1.15, duration: 1.2, ease: 'power2.out' });
        break;

      case 'SECTIONS':
        // Sealed shell fades, section slabs burst out
        gsap.to(this._sealedGroup.scale, { x: 0.0, y: 0.0, z: 0.0, duration: 0.7, ease: 'power2.in', onComplete: () => {
          this._sealedGroup.visible = false;
        }});
        this._sectionsGroup.visible = true;
        this._sectionMeshes.forEach((mesh, i) => {
          // Start at center, burst to exploded positions
          mesh.position.set(0, 0, 0);
          gsap.to(mesh.position, {
            y: mesh.userData.explodedPos.y,
            duration: 1.0,
            delay: i * 0.1,
            ease: 'power3.out',
          });
          gsap.from(mesh.scale, { x: 0, y: 0, z: 0, duration: 0.6, delay: i * 0.1, ease: 'back.out(1.5)' });
        });
        break;

      case 'MEMORY':
        // Sections spread further and get tinted
        this._sectionMeshes.forEach((mesh, i) => {
          gsap.to(mesh.position, {
            x: (Math.random()-0.5)*3,
            y: mesh.userData.explodedPos.y * 1.6,
            z: (Math.random()-0.5)*2,
            duration: 1.2, delay: i*0.08, ease: 'power2.out'
          });
          gsap.to(mesh.scale, { x: 1.1, z: 1.3, duration: 1.0, delay: i*0.08 });
        });
        break;

      case 'IMPORTS':
        // Sections collapse, import graph emerges
        this._sectionMeshes.forEach((mesh, i) => {
          gsap.to(mesh.material, { opacity: 0.15, duration: 0.5, delay: i*0.05 });
        });
        this._importsGroup.visible = true;
        this._importNodes.forEach((node, i) => {
          node.scale.set(0,0,0);
          gsap.to(node.scale, { x:1, y:1, z:1, duration: 0.6, delay: 0.2 + i*0.08, ease: 'back.out(2)' });
        });
        break;

      case 'SEALED':
      default:
        // Reset everything
        gsap.to(this._sealedGroup.scale, { x:1, y:1, z:1, duration: 0.8, ease: 'power2.out' });
        gsap.to(this._coreMesh.material, { opacity: 0.55, duration: 0.6 });
        this._sealedGroup.visible = true;
        this._sectionsGroup.visible = false;
        this._importsGroup.visible = false;
        this._sectionMeshes.forEach(m => m.position.set(0,0,0));
        break;
    }
  }

  // ── HIGHLIGHT for raycaster ───────────────────────────────
  highlight(mesh, on) {
    if (!mesh) return;
    if (on) {
      mesh._prevEmissive = mesh.material.emissive?.getHex?.() ?? 0;
      mesh.material.emissive?.setHex(0x00e5ff);
      mesh.material.emissiveIntensity = 0.4;
    } else {
      mesh.material.emissive?.setHex(mesh._prevEmissive ?? 0);
      mesh.material.emissiveIntensity = 0.15;
    }
  }

  // ── TICK ──────────────────────────────────────────────────
  tick(elapsed) {
    const t = elapsed;

    // Sealed state animations
    if (this._sealedGroup.visible) {
      this._sealedGroup.rotation.y += 0.004;
      if (this._midMesh)   this._midMesh.rotation.y  -= 0.006;
      if (this._outerMesh) this._outerMesh.rotation.x += 0.003;

      if (this._scanRing) {
        this._scanRing.rotation.z = t * 0.5;
        this._scanRing.material.opacity = 0.3 + Math.sin(t*1.1)*0.2;
      }

      this._circuitPlanes?.forEach(p => {
        p.userData.baseA += p.userData.speed;
        p.position.x = Math.cos(p.userData.baseA) * p.userData.r;
        p.position.z = Math.sin(p.userData.baseA) * p.userData.r;
        p.rotation.y += 0.005;
      });
    }

    // Orbital rings always spin
    this._rings.forEach(({ mesh, speed }) => {
      mesh.rotation.z += speed;
    });

    // Orbit dots on outermost ring
    this._orbitDots?.forEach(dot => {
      dot.userData.baseAngle += 0.005;
      const a = dot.userData.baseAngle;
      dot.position.set(Math.cos(a)*8.0, Math.sin(a)*8.0*0.25, 0);
    });

    // Import graph — nodes gently bob + rotate
    if (this._importsGroup.visible) {
      this._importNodes.forEach((node, i) => {
        if (node.userData.angle !== undefined) {
          node.position.y = Math.sin(t*0.5 + i) * 0.15 + node.userData.r * Math.sin(node.userData.angle) * 0.4;
        }
      });
    }

    // Section slabs — subtle breathing when spread
    if (this._sectionsGroup.visible && this.state === 'SECTIONS') {
      this._sectionMeshes.forEach((m, i) => {
        m.scale.y = 1 + Math.sin(t*0.8 + i*0.5)*0.04;
      });
    }
  }

  dispose() {
    this._disposables.forEach(d => d.dispose?.());
    this.scene.remove(this.group);
  }
}
