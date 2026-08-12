// ============================================================
// EAGLE V3 — network.js
// Live 3D network: nodes + edges + travelling data packets.
// Periodic scanning wave. Click node → highlight neighbours.
// ============================================================

import * as THREE from 'three';

const NODE_TYPES = [
  { type:'FUNCTION', color:0xff1744, pos:[ 0,   4,  0] },
  { type:'MEMORY',   color:0x147eff, pos:[-4,   1,  1] },
  { type:'IMPORT',   color:0x00ff88, pos:[ 4,   1, -1] },
  { type:'MODULE',   color:0xff9100, pos:[-3,  -2,  2] },
  { type:'THREAD',   color:0xaa44ff, pos:[ 3,  -2, -2] },
  { type:'PROCESS',  color:0x00e5ff, pos:[ 0,  -4,  0] },
  { type:'FUNCTION', color:0xff1744, pos:[-5,   3, -1] },
  { type:'IMPORT',   color:0x00ff88, pos:[ 5,   3,  1] },
];

const EDGES = [[0,1],[0,2],[1,3],[2,4],[3,5],[4,5],[0,5],[1,6],[2,7],[6,7],[3,6],[4,7]];

export class Network {
  constructor(engine) {
    this.E     = engine;
    this.scene = engine.scene;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);
    this._d    = [];
    this.rayTargets = [];
    this._nodes   = [];
    this._edges   = [];
    this._packets = [];
    this._scanT   = 0;

    this._buildNodes();
    this._buildEdges();
    this._buildPackets(engine.Q.networkPackets);

    engine.register('network', (t,dt) => this._tick(t,dt));
  }

  _buildNodes() {
    NODE_TYPES.forEach((n, i) => {
      const geo = new THREE.SphereGeometry(0.3, 12, 12);
      const mat = new THREE.MeshPhongMaterial({
        color: n.color,
        emissive: new THREE.Color(n.color).multiplyScalar(0.3),
        transparent: true, opacity: 0.9, shininess: 80,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...n.pos);
      mesh.userData = {
        type: n.type, label: n.type, idx: i,
        addr: `0x${(0x401000 + i*0x200).toString(16).toUpperCase()}`,
        info: { Type: n.type, Index: i, Color: '#'+n.color.toString(16).padStart(6,'0') },
        basePos: mesh.position.clone(),
      };
      this.group.add(mesh);
      this._nodes.push(mesh);
      this.rayTargets.push(mesh);
      this._d.push(geo, mat);
    });
  }

  _buildEdges() {
    const lm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.35 });
    this._d.push(lm);

    EDGES.forEach(([a, b]) => {
      const nA = this._nodes[a], nB = this._nodes[b];
      const colA = new THREE.Color(nA.material.color);
      const colB = new THREE.Color(nB.material.color);
      const geo = new THREE.BufferGeometry();
      const positions = new Float32Array([
        nA.position.x, nA.position.y, nA.position.z,
        nB.position.x, nB.position.y, nB.position.z,
      ]);
      const colors = new Float32Array([
        colA.r, colA.g, colA.b,
        colB.r, colB.g, colB.b,
      ]);
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
      const line = new THREE.Line(geo, lm.clone());
      this.group.add(line);
      this._edges.push({ line, a, b });
      this._d.push(geo, line.material);
    });
  }

  _buildPackets(count) {
    const geo = new THREE.SphereGeometry(0.08, 4, 4);
    const mats = {
      red:   new THREE.MeshBasicMaterial({ color: 0xff1744 }),
      blue:  new THREE.MeshBasicMaterial({ color: 0x147eff }),
      green: new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
    };
    this._d.push(geo, ...Object.values(mats));
    const matArr = Object.values(mats);

    for (let i = 0; i < count; i++) {
      const edge = EDGES[i % EDGES.length];
      const mesh = new THREE.Mesh(geo, matArr[i % 3]);
      this.group.add(mesh);
      this._packets.push({
        mesh,
        edge,
        t: Math.random(),
        speed: 0.3 + Math.random() * 0.7,
        dir: Math.random() > 0.5 ? 1 : -1,
      });
    }
  }

  show(gsap) {
    this.group.visible = true;
    this.group.scale.set(0,0,0);
    gsap.to(this.group.scale, { x:1,y:1,z:1, duration:0.9, ease:'back.out(1.3)' });
    this._nodes.forEach((n,i) => {
      gsap.from(n.scale, { x:0,y:0,z:0, duration:0.5, delay:i*0.06, ease:'back.out(2)' });
    });
  }

  hide(gsap) {
    gsap.to(this.group.scale, { x:0,y:0,z:0, duration:0.5, onComplete:() => { this.group.visible=false; } });
  }

  highlightNode(mesh, on) {
    if (!mesh?.material) return;
    mesh.material.emissiveIntensity = on ? 0.8 : 0.3;
    if (on) mesh.scale.setScalar(1.4); else mesh.scale.setScalar(1.0);
  }

  _tick(t, dt) {
    if (!this.group.visible) return;

    // Nodes bob and pulse
    this._nodes.forEach((n, i) => {
      n.position.y = n.userData.basePos.y + Math.sin(t*0.7 + i*1.1)*0.12;
      n.material.emissiveIntensity = 0.25 + Math.abs(Math.sin(t*1.2+i))*0.25;
    });

    // Packets travel along edges
    this._packets.forEach(p => {
      p.t += p.speed * dt * p.dir;
      if (p.t > 1) { p.t = 0; p.dir = Math.random()>0.5?1:-1; }
      if (p.t < 0) { p.t = 1; p.dir = Math.random()>0.5?1:-1; }

      const nA = this._nodes[p.edge[0]];
      const nB = this._nodes[p.edge[1]];
      p.mesh.position.lerpVectors(nA.position, nB.position, p.t);
    });

    // Edge pulse
    this._edges.forEach((e,i) => {
      e.line.material.opacity = 0.2 + Math.sin(t*0.6+i*0.4)*0.15;
    });

    // Slow group rotation
    this.group.rotation.y += 0.0015 * dt * 60;

    // Periodic scanning wave through nodes
    this._scanT += dt;
    if (this._scanT > 12) {
      this._scanT = 0;
      this._scanWave(t);
    }
  }

  _scanWave(t) {
    this._nodes.forEach((n,i) => {
      const delay = i * 0.12;
      setTimeout(() => {
        const orig = n.material.emissiveIntensity;
        n.material.emissiveIntensity = 1.0;
        n.scale.setScalar(1.5);
        setTimeout(() => {
          n.material.emissiveIntensity = orig;
          n.scale.setScalar(1.0);
        }, 400);
      }, delay * 1000);
    });
  }

  dispose() {
    this._d.forEach(d => d.dispose?.());
    this.scene.remove(this.group);
  }
}
