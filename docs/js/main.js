// ============================================================
// EAGLE V2 — main.js
// Boot sequence, module wiring, HUD stats, global event bus.
// ============================================================

import { Perf }           from './performance.js';
import { SceneManager }   from './scene.js';
import { EagleCore }      from './core.js';
import { ParticleSystem } from './particles.js';
import { FunctionGraph }  from './functionGraph.js';
import { Terminal }       from './terminal.js';
import { Interaction }    from './interaction.js';
import { ScrollController } from './scroll.js';
import { AudioEngine }    from './audio.js';

// GSAP loaded via CDN — available on window
const gsap = window.gsap;

// ─────────────────────────────────────────────────────────────
class EagleApp {
  constructor() {
    this.Q = Perf.Q;
    this._booted = false;

    if (!this.Q.webglOk) {
      this._showFallback();
      return;
    }

    this._runIntro();
  }

  // ── INTRO SEQUENCE ─────────────────────────────────────────
  _runIntro() {
    const intro     = document.getElementById('intro');
    const lines     = intro?.querySelectorAll('.intro-line');
    const logo      = intro?.querySelector('.intro-logo');
    const sub       = intro?.querySelector('.intro-sub');
    const enterBtn  = intro?.querySelector('.intro-enter');
    const skipBtn   = document.querySelector('.intro-skip');

    // Skip for returning visitors
    const hasVisited = sessionStorage.getItem('eagle_visited');
    skipBtn?.addEventListener('click', () => this._enterSystem());

    if (hasVisited) {
      // Fast skip
      gsap.set([logo, sub, enterBtn], { opacity: 1 });
      if (lines) gsap.set(lines, { opacity: 1 });
    } else {
      // Stagger terminal boot lines
      if (lines) {
        gsap.to(lines, {
          opacity: 1, duration: 0,
          stagger: { each: 0.18, ease: 'none' },
          delay: 0.4,
        });
      }
      // Logo + sub fade in
      gsap.to(logo, { opacity: 1, duration: 0.8, delay: lines ? lines.length * 0.18 + 0.6 : 1.2 });
      gsap.to(sub,  { opacity: 1, duration: 0.6, delay: lines ? lines.length * 0.18 + 1.0 : 1.6 });
      gsap.to(enterBtn, { opacity: 1, duration: 0.5, delay: lines ? lines.length * 0.18 + 1.5 : 2.0 });
    }

    enterBtn?.addEventListener('click', () => {
      sessionStorage.setItem('eagle_visited', '1');
      this._enterSystem();
    });
  }

  // ── ENTER SYSTEM ───────────────────────────────────────────
  _enterSystem() {
    const intro = document.getElementById('intro');

    gsap.to(intro, {
      opacity: 0, duration: 0.9, ease: 'power2.inOut',
      onComplete: () => {
        intro.style.display = 'none';
        this._boot();
      }
    });
  }

  // ── BOOT ALL MODULES ───────────────────────────────────────
  _boot() {
    if (this._booted) return;
    this._booted = true;

    const canvas = document.getElementById('three-canvas');

    // ── Scene ──
    this.SM = new SceneManager(canvas);

    // ── EAGLE Core ──
    this.core = new EagleCore(this.SM.scene, this.Q);
    this.SM.register(this.core);

    // ── Particles ──
    this.particles = new ParticleSystem(this.SM.scene, this.Q);
    this.SM.register(this.particles);

    // ── Function Graph ──
    this.graph = new FunctionGraph(this.SM.scene, this.Q);
    this.SM.register(this.graph);

    // ── Terminal ──
    this.terminal = new Terminal();

    // ── Audio ──
    this.audio = new AudioEngine();

    // ── Interaction ──
    this.interaction = new Interaction(
      this.SM.camera,
      this.SM.renderer,
      this.core,
      this.graph,
      this.terminal,
      (msg, type) => {
        this.terminal.notify(msg, type);
        this.audio.playNotify(type);
      }
    );
    // Merge all raycasting targets
    this.interaction.setTargets([
      ...this.core.rayTargets,
      ...this.graph.rayTargets,
    ]);
    this.SM.register(this.interaction);

    // ── Scroll ──
    this.scroll = new ScrollController(
      this.SM, this.core, this.graph, this.terminal, gsap
    );
    this.SM.register(this.scroll);

    // ── UI visibility ──
    this._showUI();

    // ── HUD stats ──
    this._startHUDStats();

    // ── System events ──
    this.terminal.startSystemEvents();

    // ── Global event bus ──
    this._wireEvents();

    // ── Start RAF ──
    this.SM.start();
  }

  // ── SHOW UI ELEMENTS ───────────────────────────────────────
  _showUI() {
    const nav = document.getElementById('nav');
    nav?.classList.add('visible');

    document.getElementById('hud-stats')?.classList.add('visible');
    document.getElementById('section-progress')?.classList.add('visible');
    document.getElementById('depth-bar');    // always visible
    document.getElementById('scroll-indicator')?.classList.add('visible');

    // Show terminal after short delay
    setTimeout(() => {
      this.terminal.show();
    }, 1200);

    // Show analyze button (section 0)
    setTimeout(() => {
      document.getElementById('analyze-btn')?.classList.add('visible');
    }, 800);
  }

  // ── HUD STATS ──────────────────────────────────────────────
  _startHUDStats() {
    const stats = {
      CPU:       { el: null, bar: null, val: 47, drift: 8 },
      MEM:       { el: null, bar: null, val: 62, drift: 5 },
      THREADS:   { el: null, bar: null, val: 18, drift: 0 },
      MODULES:   { el: null, bar: null, val: 34, drift: 0 },
      FUNCTIONS: { el: null, bar: null, val: 1482, drift: 0 },
      IMPORTS:   { el: null, bar: null, val: 237, drift: 0 },
    };

    const container = document.getElementById('hud-stats');
    if (!container) return;

    // Build rows
    Object.entries(stats).forEach(([key, s]) => {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.innerHTML = `
        <span class="stat-key">${key}</span>
        <span class="stat-val" id="stat-${key}">${s.val}${s.drift ? '%' : ''}</span>`;
      container.appendChild(row);

      if (s.drift) {
        const barWrap = document.createElement('div');
        barWrap.className = 'stat-bar';
        const fill = document.createElement('div');
        fill.className  = 'stat-bar-fill';
        fill.style.width = s.val + '%';
        fill.id = `bar-${key}`;
        barWrap.appendChild(fill);
        container.appendChild(barWrap);
        s.bar = fill;
      }
      s.el = document.getElementById(`stat-${key}`);
    });

    // Animate
    setInterval(() => {
      Object.entries(stats).forEach(([key, s]) => {
        if (!s.drift) return;
        s.val = Math.max(15, Math.min(95, s.val + (Math.random() - 0.5) * s.drift));
        if (s.el)  s.el.textContent = s.val.toFixed(0) + '%';
        if (s.bar) s.bar.style.width = s.val + '%';
      });
    }, 1600);
  }

  // ── EVENT BUS ──────────────────────────────────────────────
  _wireEvents() {
    // Red light pulse on click
    window.addEventListener('eagle:redpulse', () => {
      this.audio.playClick();
      this.SM.setRedLight(3);
      setTimeout(() => this.SM.setRedLight(0), 600);
    });

    // Overdrive
    window.addEventListener('eagle:overdrive', () => {
      this.audio.playOverdrive();
      // Temporarily boost particle opacity
      if (this.particles._field) {
        const mat = this.particles._field.material;
        const orig = mat.opacity;
        mat.opacity = 1.0;
        setTimeout(() => { mat.opacity = orig; }, 5000);
      }
    });

    // RE mode streams
    window.addEventListener('eagle:restreams', e => {
      if (e.detail) {
        this.particles.buildREStreams();
      } else {
        this.particles.removeREStreams();
      }
    });

    // Analysis complete → jump to sections state
    window.addEventListener('eagle:analysiscomplete', () => {
      this.core.transitionTo('SECTIONS', gsap);
      // Scroll down programmatically
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: maxScroll * 0.26, behavior: 'smooth' });
    });

    // Mobile nav hamburger
    const hamburger = document.getElementById('nav-hamburger');
    hamburger?.addEventListener('click', () => {
      const links = document.querySelector('.nav-links');
      links?.classList.toggle('open');
    });

    // Debug easter egg
    window.addEventListener('eagle:debug', () => {
      this.SM.setRedLight(8);
      setTimeout(() => this.SM.setRedLight(0), 800);
    });
  }

  // ── NO-WEBGL FALLBACK ──────────────────────────────────────
  _showFallback() {
    document.getElementById('three-canvas')?.remove();
    const fb = document.createElement('div');
    Object.assign(fb.style, {
      position: 'fixed', inset: '0',
      background: 'radial-gradient(ellipse at 50% 30%, #041a1f 0%, #03040a 60%)',
      zIndex: '0',
    });
    document.body.prepend(fb);

    // Still run DOM-only intro
    document.getElementById('intro')?.querySelector('.intro-enter')
      ?.addEventListener('click', () => {
        document.getElementById('intro').style.display = 'none';
        document.getElementById('nav')?.classList.add('visible');
      });
  }
}

// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.__eagle = new EagleApp();
});
