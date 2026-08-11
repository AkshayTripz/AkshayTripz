// ============================================================
// EAGLE — main.js
// Orchestrator: initialises all modules, runs the RAF loop
// ============================================================

import { Scene }          from './scene.js';
import { Particles }      from './particles.js';
import { Interactions }   from './interactions.js';
import { ScrollController } from './scroll.js';

class App {
  constructor() {
    this._prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._isMobile = window.innerWidth < 768;
    this._running  = false;
    this._raf      = null;

    this._initWebGL();
    this._initModules();
    this._initMobileMenu();
    this._initTerminal();
    this._initExplorerTabs();
    this._start();
  }

  // ── WEBGL INIT ────────────────────────────────────────────
  _initWebGL() {
    const canvas = document.getElementById('three-canvas');
    if (!canvas) return;

    // Feature detection
    try {
      const ctx = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!ctx) throw new Error('no webgl');
    } catch {
      // WebGL unavailable — hide canvas, page still works
      canvas.style.display = 'none';
      return;
    }

    this._scene     = new Scene(canvas);
    this._particles = new Particles(this._scene.scene, this._isMobile);
  }

  // ── MODULES ───────────────────────────────────────────────
  _initModules() {
    this._scroll       = new ScrollController();
    this._interactions = new Interactions();
  }

  // ── MOBILE NAV ────────────────────────────────────────────
  _initMobileMenu() {
    const btn  = document.querySelector('.nav-menu-btn');
    const menu = document.querySelector('.nav-links');
    if (!btn || !menu) return;

    btn.addEventListener('click', () => {
      btn.classList.toggle('open');
      menu.classList.toggle('open');
    });
  }

  // ── TERMINAL TYPEWRITER ───────────────────────────────────
  _initTerminal() {
    const lines = document.querySelectorAll('.terminal-line[data-type]');
    if (!lines.length) return;

    lines.forEach((line, i) => {
      const text    = line.dataset.type || '';
      const el      = line.querySelector('.terminal-cmd');
      if (!el) return;
      el.textContent = '';
      let j = 0;

      const obs = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) {
          setTimeout(() => {
            const type = () => {
              if (j < text.length) {
                el.textContent += text[j++];
                setTimeout(type, 28 + Math.random() * 30);
              }
            };
            type();
          }, i * 200);
          obs.disconnect();
        }
      }, { threshold: 0.5 });

      obs.observe(line);
    });
  }

  // ── BINARY EXPLORER TABS ──────────────────────────────────
  _initExplorerTabs() {
    const sections = document.querySelectorAll('.explorer-section');
    sections.forEach(sec => {
      const hdr = sec.querySelector('.explorer-section-header');
      hdr && hdr.addEventListener('click', () => {
        sections.forEach(s => s.classList.remove('active'));
        sec.classList.toggle('active');
      });
    });

    // Open first tab by default after short delay
    setTimeout(() => {
      sections[0] && sections[0].classList.add('active');
    }, 800);
  }

  // ── RAF LOOP ──────────────────────────────────────────────
  _start() {
    if (this._prefersReducedMotion) return;
    this._running = true;
    this._loop();
  }

  _loop() {
    if (!this._running) return;

    const scrollY    = this._scroll  ? this._scroll.getScrollY()  : 0;
    const scrollProg = this._scroll  ? this._scroll.getProgress() : 0;

    if (this._scene)     this._scene.tick(scrollProg);
    if (this._particles) this._particles.tick(scrollY);

    this._raf = requestAnimationFrame(() => this._loop());
  }

  dispose() {
    this._running = false;
    cancelAnimationFrame(this._raf);
    this._scene     && this._scene.dispose();
    this._particles && this._particles.dispose();
  }
}

// ── BOOT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.__eagle = new App();
});
