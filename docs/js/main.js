// ============================================================
// EAGLE V3 — main.js
// Boot: intro → modules → RAF.
// Event bus wires all inter-module communication.
// ============================================================

import { Perf }         from './performance.js';
import { Engine }       from './engine.js';
import { Particles }    from './particles.js';
import { Core }         from './core.js';
import { Network }      from './network.js';
import { HUD }          from './hud.js';
import { Terminal }     from './terminal.js';
import { Interaction }  from './interaction.js';
import { ScrollController } from './scroll.js';

const gsap = window.gsap;

class EagleApp {
  constructor() {
    this.Q = Perf.Q;
    this._booted = false;

    if (!this.Q.webglOk) { this._fallback(); return; }

    this._initIntro();
  }

  // ── INTRO ────────────────────────────────────────────────
  _initIntro() {
    const intro    = document.getElementById('intro');
    const lines    = intro?.querySelectorAll('.intro-line');
    const logo     = intro?.querySelector('.intro-logo');
    const sub      = intro?.querySelector('.intro-sub');
    const enterBtn = intro?.querySelector('.intro-enter');
    const skipBtn  = document.querySelector('.intro-skip');

    const skip = () => {
      sessionStorage.setItem('eagle_v3','1');
      gsap.to(intro, { opacity:0, duration:0.8, ease:'power2.inOut',
        onComplete:() => { intro.style.display='none'; this._boot(); }
      });
    };

    skipBtn?.addEventListener('click', skip);
    enterBtn?.addEventListener('click', skip);

    if (sessionStorage.getItem('eagle_v3')) {
      gsap.set([logo, sub, enterBtn], { opacity:1 });
      lines && gsap.set(lines, { opacity:1 });
    } else {
      const n = lines?.length || 0;
      if (lines) gsap.to(lines, { opacity:1, duration:0, stagger:{ each:0.16, ease:'none' }, delay:0.3 });
      gsap.to(logo,     { opacity:1, duration:0.7, delay: n*0.16 + 0.5 });
      gsap.to(sub,      { opacity:1, duration:0.5, delay: n*0.16 + 0.9 });
      gsap.to(enterBtn, { opacity:1, duration:0.5, delay: n*0.16 + 1.3 });
    }
  }

  // ── BOOT ─────────────────────────────────────────────────
  _boot() {
    if (this._booted) return;
    this._booted = true;

    try { this._bootModules(); }
    catch(e) { console.error('[EAGLE] Boot error:', e); this._fallback(); }
  }

  _bootModules() {
    const canvas = document.getElementById('three-canvas');

    // 1. Engine (renderer + RAF loop)
    this.engine = new Engine(canvas);

    // 2. Core 3D object
    this.core = new Core(this.engine, gsap);

    // 3. Particles (massive GPU field)
    this.particles = new Particles(this.engine);

    // 4. Network graph
    this.network = new Network(this.engine);

    // 5. HUD (metrics, events, scan overlay, float labels)
    this.hud = new HUD(this.engine);

    // 6. Terminal
    this.terminal = new Terminal(this.hud);

    // 7. Interaction (raycaster, cursor, touch, easter eggs)
    this.interaction = new Interaction(this.engine, this.core, this.network, this.hud);
    this.interaction.setTargets([
      ...this.core.rayTargets,
      ...this.network.rayTargets,
    ]);
    this.engine.register('interaction', (t,dt,E) => this.interaction.tick(t,dt,E));

    // 8. Scroll controller
    this.scroll = new ScrollController(this.engine, this.core, this.network, gsap);

    // 9. UI
    this._showUI();
    this._wireEvents();

    // 10. Watchdogs — restart subsystems if they freeze
    Perf.watchdog('core',        () => this.engine.register('core',        (t,dt)=>this.core.tick?.(t,dt)));
    Perf.watchdog('particles',   () => this.engine.register('particles',   (t,dt)=>this.particles?.tick?.(t,dt)));
    Perf.watchdog('hud',         () => this.engine.register('hud',         (t,dt)=>this.hud?.tick?.(t,dt)));
    Perf.watchdog('interaction', () => this.engine.register('interaction', (t,dt,E)=>this.interaction?.tick?.(t,dt,E)));

    // 11. Start RAF
    this.engine.start();
  }  // end _bootModules

  // ── UI ───────────────────────────────────────────────────
  _showUI() {
    document.getElementById('nav')?.classList.add('visible');
    document.getElementById('hud-metrics')?.parentElement?.classList.add('visible');
    document.getElementById('section-progress')?.classList.add('visible');
    document.getElementById('scroll-indicator')?.classList.add('visible');

    setTimeout(() => { this.terminal.show(); }, 1200);
    setTimeout(() => { document.getElementById('analyze-btn')?.classList.add('visible'); }, 900);
  }

  // ── EVENT BUS ────────────────────────────────────────────
  _wireEvents() {
    // Click → burst + red pulse
    window.addEventListener('eagle:redpulse', () => {
      this.engine.setLight('red', 10);
      setTimeout(() => this.engine.setLight('red', 3.5), 500);
    });

    // Analyze sequence
    window.addEventListener('eagle:analyze', () => this._runAnalysis());
    document.getElementById('analyze-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('eagle:analyze'));
    });

    // Analysis complete → jump to sections
    window.addEventListener('eagle:analysiscomplete', () => {
      this.core.transitionTo('SECTIONS');
      const max = document.documentElement.scrollHeight - window.innerHeight;
      window.scrollTo({ top: max * 0.28, behavior:'smooth' });
    });

    // Overdrive
    window.addEventListener('eagle:overdrive', () => {
      document.body.classList.add('overdrive');
      setTimeout(() => document.body.classList.remove('overdrive'), 6000);
    });

    // RE mode streams
    window.addEventListener('eagle:remode', () => {
      const overlay = document.getElementById('re-overlay');
      overlay?.classList.toggle('active');
    });

    // Nav hamburger
    document.getElementById('nav-hamburger')?.addEventListener('click', () => {
      document.querySelector('.nav-links')?.classList.toggle('open');
    });

    // Sound toggle stub
    document.getElementById('btn-sound')?.addEventListener('click', function() {
      this.textContent = this.textContent.includes('OFF') ? 'SOUND ON' : 'SOUND OFF';
    });

    // Tab visibility — clock already handles pause in engine.js
    // but we can dim the interface too
    document.addEventListener('visibilitychange', () => {
      // nothing extra needed — engine handles it
    });
  }

  // ── ANALYSIS SEQUENCE ────────────────────────────────────
  _runAnalysis() {
    const prog  = document.getElementById('analysis-progress');
    const btn   = document.getElementById('analyze-btn');
    if (!prog) return;

    prog.classList.add('visible');
    btn?.classList.remove('visible');

    const steps  = Array.from(prog.querySelectorAll('.analysis-step'));
    const bar    = prog.querySelector('.analysis-bar-fill');
    const delays = [0, 550, 1100, 1750, 2450, 3100];

    steps.forEach((step, i) => {
      setTimeout(() => {
        if (i > 0) steps[i-1].classList.replace('active','done');
        step.classList.add('active');
        if (bar) bar.style.width = ((i+1)/steps.length*100) + '%';
      }, delays[i]);
    });

    setTimeout(() => {
      steps[steps.length-1].classList.replace('active','done');
      if (bar) bar.style.width = '100%';
      this.hud.notify('⬡ ANALYSIS COMPLETE', 'ok');
      setTimeout(() => {
        prog.classList.remove('visible');
        window.dispatchEvent(new CustomEvent('eagle:analysiscomplete'));
      }, 800);
    }, delays[delays.length-1] + 600);
  }

  // ── FALLBACK (no WebGL) ──────────────────────────────────
  _fallback() {
    document.getElementById('three-canvas')?.remove();
    const bg = document.createElement('div');
    Object.assign(bg.style, {
      position:'fixed', inset:'0',
      background:'radial-gradient(ellipse at 50% 25%, #0a1a10 0%, #020308 60%)',
      zIndex:'0',
    });
    document.body.prepend(bg);
    document.getElementById('intro')?.querySelector('.intro-enter')
      ?.addEventListener('click', () => {
        document.getElementById('intro').style.display = 'none';
        document.getElementById('nav')?.classList.add('visible');
      });
  }
}

document.addEventListener('DOMContentLoaded', () => { window.__eagle = new EagleApp(); });
