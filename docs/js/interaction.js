// ============================================================
// EAGLE V3 — interaction.js
// Raycaster, cursor (desktop + touch), hover/click HUD,
// info panel, easter eggs: Konami, logo×5, "/" console.
// ============================================================

import * as THREE from 'three';

export class Interaction {
  constructor(engine, core, network, hud) {
    this.E       = engine;
    this.core    = core;
    this.network = network;
    this.hud     = hud;
    this._ray    = new THREE.Raycaster();
    this._targets = [];
    this._hovered = null;
    this._selected = null;

    // Cursor DOM
    this._cRing  = document.getElementById('cursor-ring');
    this._cDot   = document.getElementById('cursor-dot');
    this._cLabel = document.getElementById('cursor-label');
    this._cx = 0; this._cy = 0;
    this._dx = 0; this._dy = 0;
    this._rawX = 0; this._rawY = 0;

    this._isMobile = 'ontouchstart' in window;

    if (!this._isMobile) this._initCursor();
    this._initInfoPanel();
    this._initHoverHUD();
    this._initTouch();
    this._initEasterEggs();
    this._initREMode();
    this._applyDOMHover();
  }

  setTargets(t) { this._targets = t || []; }

  // ── CURSOR ────────────────────────────────────────────────
  _initCursor() {
    window.addEventListener('mousemove', e => {
      this._rawX = e.clientX; this._rawY = e.clientY;
      this._positionHoverHUD(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('click', e => this._clickPulse(e.clientX, e.clientY));
    this._animCursor();
  }

  _animCursor() {
    this._cx += (this._rawX - this._cx) * 0.1;
    this._cy += (this._rawY - this._cy) * 0.1;
    this._dx += (this._rawX - this._dx) * 0.65;
    this._dy += (this._rawY - this._dy) * 0.65;

    if (this._cRing) { this._cRing.style.left=this._cx+'px'; this._cRing.style.top=this._cy+'px'; }
    if (this._cDot)  { this._cDot.style.left=this._dx+'px';  this._cDot.style.top=this._dy+'px'; }
    if (this._cLabel){ this._cLabel.style.left=this._dx+'px'; this._cLabel.style.top=this._dy+'px'; }

    requestAnimationFrame(() => this._animCursor());
  }

  _clickPulse(x, y) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position:'fixed', left:x+'px', top:y+'px',
      width:'4px', height:'4px', borderRadius:'50%',
      border:'1px solid #ff1744', pointerEvents:'none',
      zIndex:'9998', transform:'translate(-50%,-50%)',
      animation:'pulseOut .6s ease-out forwards',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 650);
  }

  // ── HOVER HUD ─────────────────────────────────────────────
  _initHoverHUD() {
    this._hoverHUD = document.getElementById('hud-hover');
  }

  _positionHoverHUD(x, y) {
    if (!this._hoverHUD) return;
    let hx = x + 22, hy = y - 10;
    if (hx + 195 > window.innerWidth)  hx = x - 215;
    if (hy + 160 > window.innerHeight) hy = y - 160;
    this._hoverHUD.style.left = hx + 'px';
    this._hoverHUD.style.top  = hy + 'px';
  }

  _showHoverHUD(mesh) {
    if (!this._hoverHUD) return;
    const ud = mesh.userData;
    this._hoverHUD.querySelector('.hover-type').textContent    = ud.type  || 'OBJECT';
    this._hoverHUD.querySelector('.hover-address').textContent = ud.addr  || '—';
    const rows = this._hoverHUD.querySelector('.hover-rows');
    if (rows && ud.info) {
      rows.innerHTML = Object.entries(ud.info).slice(0,4)
        .map(([k,v])=>`<div class="hover-row"><span class="hover-k">${k}</span><span class="hover-v">${v}</span></div>`)
        .join('');
    }
    this._hoverHUD.classList.add('visible');
  }

  _hideHoverHUD() { this._hoverHUD?.classList.remove('visible'); }

  // ── INFO PANEL ────────────────────────────────────────────
  _initInfoPanel() {
    const panel    = document.getElementById('info-panel');
    const closeBtn = panel?.querySelector('.info-panel-close');
    closeBtn?.addEventListener('click', () => panel.classList.remove('visible'));
  }

  _showInfoPanel(ud) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    panel.querySelector('.info-panel-type').textContent = ud.type  || 'OBJECT';
    panel.querySelector('.info-name').textContent       = ud.label || '—';
    panel.querySelector('.info-desc').textContent       = ud.addr  || '';

    const rows = panel.querySelector('.info-rows');
    if (rows && ud.info) {
      rows.innerHTML = Object.entries(ud.info)
        .map(([k,v])=>`<div class="info-row"><span class="info-row-k">${k}</span><span class="info-row-v">${v}</span></div>`)
        .join('');
    }

    const disasm = panel.querySelector('.disasm-view');
    if (disasm) {
      if (ud.asm?.length) {
        disasm.style.display='block';
        disasm.innerHTML = ud.asm.map((r,i)=>
          `<div class="disasm-row${i===0?' hl':''}">
            <span class="da">${r[0]}</span>
            <span class="db">${r[1]}</span>
            <span class="dm">${r[2]}</span>
            <span class="do">${r[3]}</span>
          </div>`).join('');
      } else disasm.style.display='none';
    }

    panel.classList.add('visible');
  }

  // ── TOUCH ────────────────────────────────────────────────
  _initTouch() {
    if (!this._isMobile) return;
    let _tapT = 0, _tapPos = null;

    this.E.canvas.addEventListener('touchstart', e => {
      _tapPos = { x:e.touches[0].clientX, y:e.touches[0].clientY };
    }, { passive:true });

    this.E.canvas.addEventListener('touchend', e => {
      if (!e.changedTouches[0]) return;
      const now = Date.now();
      const t   = e.changedTouches[0];
      const isDouble = now - _tapT < 350;
      _tapT = now;

      this._touchRipple(t.clientX, t.clientY);

      const nx = (t.clientX/window.innerWidth)*2-1;
      const ny = -(t.clientY/window.innerHeight)*2+1;
      this._ray.setFromCamera(new THREE.Vector2(nx,ny), this.E.camera);
      const hits = this._ray.intersectObjects(this._targets, false);
      if (hits.length > 0) {
        const mesh = hits[0].object;
        if (isDouble) this._showInfoPanel(mesh.userData);
        else          this._onHit(mesh);
      } else {
        // tap on empty space — ripple only, already done above
      }
    }, { passive:true });
  }

  _touchRipple(x, y) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position:'fixed', left:x+'px', top:y+'px',
      width:'10px', height:'10px', borderRadius:'50%',
      border:'1.5px solid #00ff88', pointerEvents:'none',
      zIndex:'9998', transform:'translate(-50%,-50%)',
      animation:'pulseOut .7s ease-out forwards',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 750);
  }

  // ── RE MODE ──────────────────────────────────────────────
  _initREMode() {
    document.getElementById('btn-remode')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('eagle:remode'));
    });
    window.addEventListener('eagle:remode', () => this._toggleRE());
    this._reActive = false;
  }

  _toggleRE() {
    this._reActive = !this._reActive;
    document.getElementById('re-overlay')?.classList.toggle('active', this._reActive);
    document.getElementById('btn-remode')?.classList.toggle('active', this._reActive);
    this.hud.notify(this._reActive ? '⬡ REVERSE ENGINEERING MODE ACTIVE' : '⬡ RE MODE DEACTIVATED',
                    this._reActive ? 'err' : '');
  }

  // ── EASTER EGGS ──────────────────────────────────────────
  _initEasterEggs() {
    // Konami
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let kSeq = 0;
    window.addEventListener('keydown', e => {
      if (e.key === KONAMI[kSeq]) { kSeq++; if (kSeq===KONAMI.length) { kSeq=0; this._overdrive(); } }
      else kSeq = 0;
    });

    // Logo × 5
    let logoClicks = 0, logoTimer;
    document.querySelector('.nav-logo')?.addEventListener('click', () => {
      logoClicks++;
      clearTimeout(logoTimer);
      logoTimer = setTimeout(() => { logoClicks=0; }, 2000);
      if (logoClicks >= 5) { logoClicks=0; this._debugMode(); }
    });

    window.addEventListener('eagle:overdrive', () => this._overdrive());
  }

  _overdrive() {
    document.body.classList.add('overdrive');
    this.hud.notify('★ EAGLE OVERDRIVE ACTIVATED', 'err');
    setTimeout(() => {
      document.body.classList.remove('overdrive');
      this.hud.notify('★ OVERDRIVE COMPLETE', '');
    }, 6000);
    window.dispatchEvent(new CustomEvent('eagle:redpulse'));
  }

  _debugMode() {
    this.hud.notify('⬡ DEBUG MODE ENABLED — build 2025.08', 'ok');
    window.dispatchEvent(new CustomEvent('eagle:redpulse'));
    // Open console
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key:'/', bubbles:true })), 200);
  }

  // ── DOM HOVER (nav, buttons) ──────────────────────────────
  _applyDOMHover() {
    setTimeout(() => {
      document.querySelectorAll('a, button, .nav-link, .info-btn, .nav-btn, .intro-enter').forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
      });
    }, 600);
  }

  // ── ON 3D OBJECT HIT ──────────────────────────────────────
  _onHit(mesh) {
    this._selected = mesh;
    this._showInfoPanel(mesh.userData);
    this.core.highlight(mesh, true);
    if (this.network.rayTargets.includes(mesh)) this.network.highlightNode(mesh, true);
    window.dispatchEvent(new CustomEvent('eagle:redpulse'));
  }

  // ── TICK (raycasting each frame) ─────────────────────────
  tick(t, dt, E) {
    if (this._isMobile) return;

    this._ray.setFromCamera(E.pointerN, E.camera);
    const hits = this._ray.intersectObjects(this._targets, false);
    const hit  = hits.length > 0 ? hits[0].object : null;

    if (hit !== this._hovered) {
      if (this._hovered) {
        this.core.highlight(this._hovered, false);
        if (this.network.rayTargets.includes(this._hovered)) this.network.highlightNode(this._hovered, false);
        document.body.classList.remove('cursor-target');
        this._hideHoverHUD();
        if (this._cLabel) this._cLabel.textContent = '';
      }
      this._hovered = hit;
      if (hit) {
        this.core.highlight(hit, true);
        // only call network highlight if this mesh belongs to the network
        if (this.network.rayTargets.includes(hit)) this.network.highlightNode(hit, true);
        document.body.classList.add('cursor-target');
        this._showHoverHUD(hit);
        if (this._cLabel) this._cLabel.textContent = hit.userData.label || 'INSPECT';
      }
    }
  }
}
