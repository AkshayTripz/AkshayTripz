// ============================================================
// EAGLE V2 — interaction.js
// Raycaster → hover HUD, click → info panel.
// Custom cursor with target/hover states.
// Easter eggs: Konami, logo×5, "/" console.
// RE mode overlay.
// ============================================================

import * as THREE from 'three';

export class Interaction {
  constructor(camera, renderer, core, graph, terminal, notify) {
    this.camera    = camera;
    this.renderer  = renderer;
    this.core      = core;
    this.graph     = graph;
    this.terminal  = terminal;
    this.notify    = notify;    // fn(msg, type)

    this._raycaster    = new THREE.Raycaster();
    this._mouse        = new THREE.Vector2(-99, -99);
    this._hoveredMesh  = null;
    this._reMode       = false;
    this._logoClicks   = 0;
    this._logoTimer    = null;

    // DOM refs
    this._cursorRing   = document.getElementById('cursor-ring');
    this._cursorDot    = document.getElementById('cursor-dot');
    this._cursorLabel  = document.getElementById('cursor-label');
    this._hoverHUD     = document.getElementById('hud-hover');
    this._infoPanel    = document.getElementById('info-panel');
    this._reOverlay    = document.getElementById('re-overlay');
    this._reBtn        = document.getElementById('btn-remode');
    this._analyzeBtn   = document.getElementById('analyze-btn');

    // Cursor smoothing
    this._cx = 0; this._cy = 0;
    this._dx = 0; this._dy = 0;
    this._mouseRaw = { x: 0, y: 0 };

    this._isMobile = 'ontouchstart' in window;
    if (!this._isMobile) {
      this._initCursor();
      this._initRaycaster();
    }
    this._initInfoPanel();
    this._initREMode();
    this._initEasterEggs();
    this._initAnalyzeBtn();
    this._applyHoverTargets();
  }

  // ── TARGETS ───────────────────────────────────────────────
  // Called after all modules are ready so we have all rayTargets
  setTargets(targets) {
    this._targets = targets || [];
  }

  // ── CURSOR ────────────────────────────────────────────────
  _initCursor() {
    window.addEventListener('mousemove', e => {
      this._mouseRaw.x = e.clientX;
      this._mouseRaw.y = e.clientY;
      this._mouse.set(
        (e.clientX / window.innerWidth)  * 2 - 1,
        -(e.clientY / window.innerHeight) * 2 + 1
      );

      // Position hover HUD near cursor
      if (this._hoverHUD) {
        let hx = e.clientX + 20;
        let hy = e.clientY - 10;
        if (hx + 190 > window.innerWidth)  hx = e.clientX - 210;
        if (hy + 160 > window.innerHeight) hy = e.clientY - 160;
        this._hoverHUD.style.left = hx + 'px';
        this._hoverHUD.style.top  = hy + 'px';
      }

      // Position component HUD
      const compHUD = document.getElementById('component-hud');
      if (compHUD) {
        compHUD.style.left = (e.clientX + 20) + 'px';
        compHUD.style.top  = (e.clientY - 10) + 'px';
      }
    }, { passive: true });

    // Apply hover class to interactive DOM elements
    document.querySelectorAll('a, button, .nav-link, .info-btn').forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });

    // Click pulse
    window.addEventListener('click', e => {
      this._spawnClickPulse(e.clientX, e.clientY);
    });

    this._animateCursor();
  }

  _animateCursor() {
    this._cx += (this._mouseRaw.x - this._cx) * 0.12;
    this._cy += (this._mouseRaw.y - this._cy) * 0.12;
    this._dx += (this._mouseRaw.x - this._dx) * 0.7;
    this._dy += (this._mouseRaw.y - this._dy) * 0.7;

    if (this._cursorRing) {
      this._cursorRing.style.left = this._cx + 'px';
      this._cursorRing.style.top  = this._cy + 'px';
    }
    if (this._cursorDot) {
      this._cursorDot.style.left = this._dx + 'px';
      this._cursorDot.style.top  = this._dy + 'px';
    }
    if (this._cursorLabel) {
      this._cursorLabel.style.left = this._dx + 'px';
      this._cursorLabel.style.top  = this._dy + 'px';
    }
    requestAnimationFrame(() => this._animateCursor());
  }

  _spawnClickPulse(x, y) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', left: x + 'px', top: y + 'px',
      width: '4px', height: '4px',
      borderRadius: '50%',
      border: '1px solid var(--cyan)',
      transform: 'translate(-50%,-50%) scale(1)',
      pointerEvents: 'none',
      zIndex: '9998',
      animation: 'pulseRing .5s ease-out forwards',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 500);
  }

  // ── RAYCASTER ─────────────────────────────────────────────
  _initRaycaster() {
    window.addEventListener('click', () => {
      if (!this._targets?.length) return;
      this._raycaster.setFromCamera(this._mouse, this.camera);
      const hits = this._raycaster.intersectObjects(this._targets, false);
      if (hits.length > 0) this._onClickMesh(hits[0].object);
    });
  }

  _castHover() {
    if (!this._targets?.length || this._isMobile) return;
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const hits = this._raycaster.intersectObjects(this._targets, false);
    const hit  = hits.length > 0 ? hits[0].object : null;

    if (hit !== this._hoveredMesh) {
      // Unhighlight previous
      if (this._hoveredMesh) {
        this.core.highlight(this._hoveredMesh, false);
        this.graph.highlightNode(this._hoveredMesh, false);
        document.body.classList.remove('cursor-target');
        if (this._hoverHUD) this._hoverHUD.classList.remove('visible');
        if (this._cursorLabel) this._cursorLabel.textContent = '';
      }

      this._hoveredMesh = hit;

      if (hit) {
        this.core.highlight(hit, true);
        this.graph.highlightNode(hit, true);
        document.body.classList.add('cursor-target');
        this._showHoverHUD(hit);
        if (this._cursorLabel) {
          this._cursorLabel.textContent = hit.userData.label || 'INSPECT';
        }
      }
    }
  }

  _showHoverHUD(mesh) {
    if (!this._hoverHUD) return;
    const ud = mesh.userData;
    this._hoverHUD.classList.add('visible');

    const typeEl    = this._hoverHUD.querySelector('.hover-type');
    const addrEl    = this._hoverHUD.querySelector('.hover-address');
    const rowsEl    = this._hoverHUD.querySelector('.hover-rows');

    if (typeEl) typeEl.textContent  = ud.type || 'OBJECT';
    if (addrEl) addrEl.textContent = ud.addr  || '—';

    if (rowsEl && ud.info) {
      rowsEl.innerHTML = Object.entries(ud.info)
        .slice(0, 4)
        .map(([k, v]) => `
          <div class="hover-row">
            <span class="hover-row-key">${k}</span>
            <span class="hover-row-val">${v}</span>
          </div>`)
        .join('');
    }
  }

  _onClickMesh(mesh) {
    const ud = mesh.userData;
    this._showInfoPanel(ud);
    // Pulse red light
    window.dispatchEvent(new CustomEvent('eagle:redpulse'));
  }

  // ── INFO PANEL ────────────────────────────────────────────
  _initInfoPanel() {
    const closeBtn = this._infoPanel?.querySelector('.info-panel-close');
    closeBtn?.addEventListener('click', () => {
      this._infoPanel.classList.remove('visible');
    });
  }

  _showInfoPanel(ud) {
    if (!this._infoPanel) return;

    const typeEl  = this._infoPanel.querySelector('.info-panel-type');
    const nameEl  = this._infoPanel.querySelector('.info-name');
    const descEl  = this._infoPanel.querySelector('.info-desc');
    const rowsEl  = this._infoPanel.querySelector('.info-rows');
    const disasm  = this._infoPanel.querySelector('.disasm-view');
    const actions = this._infoPanel.querySelector('.info-actions');

    if (typeEl) typeEl.textContent  = ud.type  || 'OBJECT';
    if (nameEl) nameEl.textContent  = ud.label || ud.name || '—';
    if (descEl) descEl.textContent  = ud.addr  || '';

    if (rowsEl && ud.info) {
      rowsEl.innerHTML = Object.entries(ud.info)
        .map(([k, v]) => `
          <div class="info-row">
            <span class="info-row-k">${k}</span>
            <span class="info-row-v">${v}</span>
          </div>`)
        .join('');
    }

    // Disassembly (functions only)
    if (disasm) {
      if (ud.asm?.length) {
        disasm.style.display = 'block';
        disasm.innerHTML = ud.asm.map((row, i) => `
          <div class="disasm-row${i === 0 ? ' highlight' : ''}">
            <span class="disasm-addr">${row[0]}</span>
            <span class="disasm-bytes">${row[1]}</span>
            <span class="disasm-mnem">${row[2]}</span>
            <span class="disasm-ops">${row[3]}</span>
          </div>`).join('');
      } else {
        disasm.style.display = 'none';
      }
    }

    this._infoPanel.classList.add('visible');
  }

  // ── RE MODE ───────────────────────────────────────────────
  _initREMode() {
    this._reBtn?.addEventListener('click', () => this.toggleREMode());
    window.addEventListener('eagle:remode', () => this.toggleREMode());
  }

  toggleREMode() {
    this._reMode = !this._reMode;
    this._reOverlay?.classList.toggle('active', this._reMode);
    this._reBtn?.classList.toggle('active', this._reMode);
    if (this._reBtn) {
      this._reBtn.textContent = this._reMode ? 'RE MODE: ON' : 'RE MODE';
    }

    // Dispatch to particles module
    window.dispatchEvent(new CustomEvent('eagle:restreams', { detail: this._reMode }));
    this.notify(this._reMode ? '⬡ REVERSE ENGINEERING MODE ACTIVE' : '⬡ RE MODE DEACTIVATED', this._reMode ? 'warn' : '');
  }

  // ── HOVER TARGETS (DOM) ───────────────────────────────────
  _applyHoverTargets() {
    // Re-apply after DOM is ready
    setTimeout(() => {
      document.querySelectorAll('a, button, .nav-link, .info-btn, .nav-btn, .intro-enter').forEach(el => {
        el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
        el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
      });
    }, 500);
  }

  // ── ANALYZE BUTTON ────────────────────────────────────────
  _initAnalyzeBtn() {
    this._analyzeBtn?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('eagle:analyze'));
    });
    window.addEventListener('eagle:analyze', () => {
      this._runAnalysisSequence();
    });
  }

  _runAnalysisSequence() {
    const prog = document.getElementById('analysis-progress');
    if (!prog) return;
    prog.classList.add('visible');
    if (this._analyzeBtn) this._analyzeBtn.classList.remove('visible');

    const steps = prog.querySelectorAll('.analysis-step');
    const bar   = prog.querySelector('.analysis-bar-fill');
    const delays = [0, 600, 1200, 1900, 2700, 3400];

    steps.forEach((step, i) => {
      setTimeout(() => {
        // Mark previous as done
        if (i > 0) steps[i-1].classList.replace('active', 'done');
        step.classList.add('active');
        if (bar) bar.style.width = ((i+1) / steps.length * 100) + '%';
      }, delays[i]);
    });

    // Complete
    const totalTime = delays[delays.length - 1] + 700;
    setTimeout(() => {
      steps[steps.length - 1].classList.replace('active', 'done');
      if (bar) bar.style.width = '100%';
      this.notify('⬡ ANALYSIS COMPLETE', 'ok');

      setTimeout(() => {
        prog.classList.remove('visible');
        // Trigger section transition
        window.dispatchEvent(new CustomEvent('eagle:analysiscomplete'));
      }, 900);
    }, totalTime);
  }

  // ── EASTER EGGS ───────────────────────────────────────────
  _initEasterEggs() {
    // Konami code
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let seq = 0;
    window.addEventListener('keydown', e => {
      if (e.key === KONAMI[seq]) {
        seq++;
        if (seq === KONAMI.length) {
          seq = 0;
          this._overdrive();
        }
      } else { seq = 0; }
    });

    // Logo × 5 clicks → debug mode
    const logo = document.querySelector('.nav-logo');
    logo?.addEventListener('click', () => {
      this._logoClicks++;
      clearTimeout(this._logoTimer);
      this._logoTimer = setTimeout(() => { this._logoClicks = 0; }, 2000);
      if (this._logoClicks >= 5) {
        this._logoClicks = 0;
        this._debugMode();
      }
    });
  }

  _overdrive() {
    document.body.classList.add('overdrive');
    this.notify('★ EAGLE OVERDRIVE ACTIVATED', 'warn');
    window.dispatchEvent(new CustomEvent('eagle:overdrive'));
    setTimeout(() => {
      document.body.classList.remove('overdrive');
      this.notify('★ OVERDRIVE DEACTIVATED', '');
    }, 6000);
  }

  _debugMode() {
    this.notify('⬡ DEBUG MODE ENABLED — build 2025.08', 'ok');
    // Flash all section slabs red briefly
    window.dispatchEvent(new CustomEvent('eagle:debug'));
    // Open the console automatically
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true }));
  }

  // ── TICK ──────────────────────────────────────────────────
  tick(elapsed, delta, mouseSmooth) {
    this._castHover();
  }
}
