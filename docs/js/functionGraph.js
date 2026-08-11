// ============================================================
// EAGLE V2 — functionGraph.js
// 3D Control-Flow Graph: nodes = functions, edges = call graph.
// Click a node → disassembly panel opens in info-panel.
// ============================================================

import * as THREE from 'three';

const FUNCTIONS = [
  {
    name: 'main()',         addr: '0x00401000', size: '0x2A0', calls: [1, 2],
    asm: [
      ['00401000','55',          'PUSH',  'RBP'],
      ['00401001','48 89 E5',    'MOV',   'RBP, RSP'],
      ['00401004','48 83 EC 40', 'SUB',   'RSP, 40h'],
      ['00401008','E8 13 00 00', 'CALL',  '0x00401020'],   // Initialize
      ['0040100D','85 C0',       'TEST',  'EAX, EAX'],
      ['0040100F','74 1A',       'JZ',    '0x0040102B'],
      ['00401011','E8 4A 00 00', 'CALL',  '0x00401060'],   // LoadModule
      ['00401016','90',          'NOP',   ''],
    ],
  },
  {
    name: 'Initialize()',  addr: '0x00401020', size: '0x80',  calls: [],
    asm: [
      ['00401020','48 89 5C 24', 'MOV',   '[RSP+8], RBX'],
      ['00401025','57',          'PUSH',  'RDI'],
      ['00401026','48 83 EC 30', 'SUB',   'RSP, 30h'],
      ['0040102A','33 C0',       'XOR',   'EAX, EAX'],
      ['0040102C','FF 15 A2 30', 'CALL',  'QWORD PTR [VirtualAlloc]'],
      ['00401032','48 85 C0',    'TEST',  'RAX, RAX'],
      ['00401035','74 08',       'JZ',    '0x0040103F'],
      ['00401037','C3',          'RET',   ''],
    ],
  },
  {
    name: 'LoadModule()',  addr: '0x00401060', size: '0x140', calls: [3, 4],
    asm: [
      ['00401060','4C 8B DC',    'MOV',   'R11, RSP'],
      ['00401063','49 89 5B 08', 'MOV',   '[R11+8], RBX'],
      ['00401067','49 89 6B 10', 'MOV',   '[R11+10h], RBP'],
      ['0040106B','FF 15 8F 30', 'CALL',  'QWORD PTR [LoadLibraryW]'],
      ['00401071','48 85 C0',    'TEST',  'RAX, RAX'],
      ['00401074','0F 84 B2 00', 'JZ',    '0x0040112A'],
      ['0040107A','E8 A1 00 00', 'CALL',  '0x00401120'],   // Decrypt
    ],
  },
  {
    name: 'Decrypt()',     addr: '0x00401120', size: '0x200', calls: [5],
    asm: [
      ['00401120','48 83 EC 28', 'SUB',   'RSP, 28h'],
      ['00401124','48 8B 01',    'MOV',   'RAX, [RCX]'],
      ['00401127','33 D2',       'XOR',   'EDX, EDX'],
      ['00401129','F7 76 08',    'DIV',   'DWORD PTR [RSI+8]'],
      ['0040112C','48 FF C1',    'INC',   'RCX'],
      ['0040112F','48 3B CB',    'CMP',   'RCX, RBX'],
      ['00401132','72 F3',       'JB',    '0x00401127'],
      ['00401134','E8 C7 00 00', 'CALL',  '0x00401200'],   // Execute
    ],
  },
  {
    name: 'Execute()',     addr: '0x00401200', size: '0x180', calls: [],
    asm: [
      ['00401200','48 89 5C 24', 'MOV',   '[RSP+8], RBX'],
      ['00401205','48 89 74 24', 'MOV',   '[RSP+10h], RSI'],
      ['0040120A','57',          'PUSH',  'RDI'],
      ['0040120B','48 83 EC 20', 'SUB',   'RSP, 20h'],
      ['0040120F','FF 15 3B 31', 'CALL',  'QWORD PTR [CreateProcessW]'],
      ['00401215','85 C0',       'TEST',  'EAX, EAX'],
      ['00401217','74 18',       'JZ',    '0x00401231'],
      ['00401219','C3',          'RET',   ''],
    ],
  },
  {
    name: 'CleanUp()',     addr: '0x00401380', size: '0x60',  calls: [],
    asm: [
      ['00401380','48 83 EC 28', 'SUB',   'RSP, 28h'],
      ['00401384','FF 15 B6 31', 'CALL',  'QWORD PTR [VirtualFree]'],
      ['0040138A','33 C0',       'XOR',   'EAX, EAX'],
      ['0040138C','48 83 C4 28', 'ADD',   'RSP, 28h'],
      ['00401390','C3',          'RET',   ''],
    ],
  },
];

// Layout positions for nodes (hand-tuned for readability)
const NODE_POS = [
  [ 0,    4, 0],   // main
  [-3,    1, 0],   // Initialize
  [ 3,    1, 0],   // LoadModule
  [ 1.5, -2, 0],   // Decrypt
  [ 1.5, -5, 0],   // Execute
  [-2,   -5, 0],   // CleanUp
];

export class FunctionGraph {
  constructor(scene, Q) {
    this.scene = scene;
    this.Q     = Q;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);

    this.rayTargets   = [];
    this._nodes       = [];
    this._edges       = [];
    this._disposables = [];
    this._rotating    = false;
    this._rotY        = 0;

    this._buildGraph();
  }

  _buildGraph() {
    const nodeMat = new THREE.MeshPhongMaterial({
      color: 0x0af5c8, emissive: new THREE.Color(0x0af5c8).multiplyScalar(0.3),
      transparent: true, opacity: 0.85, shininess: 60,
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.3 });
    this._disposables.push(nodeMat, edgeMat);

    FUNCTIONS.forEach((fn, i) => {
      const [x, y, z] = NODE_POS[i];

      // Node sphere
      const geo  = new THREE.SphereGeometry(0.28, 12, 12);
      const mesh = new THREE.Mesh(geo, nodeMat.clone());
      mesh.position.set(x, y, z);
      mesh.userData = {
        type:    'FUNCTION',
        label:   fn.name,
        addr:    fn.addr,
        fnIndex: i,
        info: { Name: fn.name, Address: fn.addr, Size: fn.size, Calls: fn.calls.length },
        asm:     fn.asm,
        basePos: new THREE.Vector3(x, y, z),
      };
      this.group.add(mesh);
      this._nodes.push(mesh);
      this.rayTargets.push(mesh);
      this._disposables.push(geo, mesh.material);

      // Floating label (billboard via sprite)
      this._buildNodeLabel(fn.name, x, y + 0.55, z);
    });

    // Edges
    FUNCTIONS.forEach((fn, i) => {
      fn.calls.forEach(targetIdx => {
        const src = new THREE.Vector3(...NODE_POS[i]);
        const dst = new THREE.Vector3(...NODE_POS[targetIdx]);

        // Slightly curved edge via QuadraticBezierCurve3
        const mid = src.clone().lerp(dst, 0.5).add(new THREE.Vector3(0.4, 0, 0.3));
        const curve = new THREE.QuadraticBezierCurve3(src, mid, dst);
        const pts   = curve.getPoints(24);
        const geo   = new THREE.BufferGeometry().setFromPoints(pts);
        const line  = new THREE.Line(geo, edgeMat.clone());
        this.group.add(line);
        this._edges.push(line);
        this._disposables.push(geo, line.material);
      });
    });
  }

  _buildNodeLabel(text, x, y, z) {
    const canvas = document.createElement('canvas');
    canvas.width  = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
    ctx.font      = '500 18px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7, depthWrite: false });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(x, y, z);
    sprite.scale.set(1.6, 0.4, 1);
    this.group.add(sprite);
    this._disposables.push(tex, mat);
  }

  // ── Show / hide ───────────────────────────────────────────
  show(gsap) {
    this.group.visible = true;
    this.group.scale.set(0, 0, 0);
    gsap.to(this.group.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.4)' });
    this._nodes.forEach((n, i) => {
      gsap.from(n.position, { y: n.userData.basePos.y - 3, duration: 0.7, delay: i * 0.07, ease: 'power3.out' });
    });
  }

  hide(gsap) {
    gsap.to(this.group.scale, { x: 0, y: 0, z: 0, duration: 0.5, onComplete: () => { this.group.visible = false; } });
  }

  // ── Highlight a node ─────────────────────────────────────
  highlightNode(mesh, on) {
    if (!mesh || !mesh.material) return;
    if (on) {
      mesh.material.emissive.setHex(0x00e5ff);
      mesh.material.emissiveIntensity = 0.7;
      mesh.scale.setScalar(1.3);
    } else {
      mesh.material.emissive.setHex(0x0af5c8);
      mesh.material.emissiveIntensity = 0.3;
      mesh.scale.setScalar(1.0);
    }
  }

  // ── Tick ──────────────────────────────────────────────────
  tick(elapsed) {
    if (!this.group.visible) return;
    this.group.rotation.y += 0.002;

    // Nodes pulse
    this._nodes.forEach((n, i) => {
      n.scale.setScalar(1 + Math.sin(elapsed * 0.8 + i * 0.8) * 0.04);
    });

    // Edge opacity breathe
    this._edges.forEach((e, i) => {
      e.material.opacity = 0.2 + Math.sin(elapsed * 0.5 + i) * 0.1;
    });
  }

  dispose() {
    this._disposables.forEach(d => d.dispose?.());
    this.scene.remove(this.group);
  }
}
