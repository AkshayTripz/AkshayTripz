// ============================================================
// EAGLE V3 — scroll.js
// Maps scrollY → camera position → core state machine.
// Delta-time independent. Never stops anything.
// ============================================================

export class ScrollController {
  constructor(engine, core, network, gsap) {
    this.E       = engine;
    this.core    = core;
    this.network = network;
    this.gsap    = gsap;

    this._scrollY   = 0;
    this._progress  = 0;
    this._lastIdx   = -1;
    this._ticking   = false;

    // Camera stops along the scroll journey
    this.STOPS = [
      { id:'hero',     label:'EAGLE CORE',    frac:0.00, cam:{ rigPos:{x:0,y:0,z:0}, camZ:22 }, state:'SEALED',   showAnalyze:true  },
      { id:'headers',  label:'PE HEADERS',    frac:0.13, cam:{ rigPos:{x:0,y:0,z:-2}, camZ:18 }, state:'HEADERS',  showAnalyze:false },
      { id:'sections', label:'SECTION TABLE', frac:0.26, cam:{ rigPos:{x:0,y:0,z:-4}, camZ:14 }, state:'SECTIONS', showAnalyze:false },
      { id:'memory',   label:'MEMORY MAP',    frac:0.40, cam:{ rigPos:{x:0,y:1,z:-5}, camZ:12 }, state:'MEMORY',   showAnalyze:false },
      { id:'imports',  label:'IMPORT TABLE',  frac:0.54, cam:{ rigPos:{x:0,y:0,z:-7}, camZ:16 }, state:'IMPORTS',  showAnalyze:false },
      { id:'cfg',      label:'CTRL FLOW',     frac:0.68, cam:{ rigPos:{x:0,y:0,z:-9}, camZ:18 }, state:'CFG',      showAnalyze:false },
      { id:'contact',  label:'EXFILTRATE',    frac:0.84, cam:{ rigPos:{x:0,y:-3,z:-6}, camZ:26 }, state:'SEALED',  showAnalyze:false },
    ];

    this._depthFill  = document.getElementById('depth-fill');
    this._analyzeBtn = document.getElementById('analyze-btn');
    this._progDots   = Array.from(document.querySelectorAll('.prog-dot'));
    this._navLinks   = Array.from(document.querySelectorAll('.nav-link[data-section]'));
    this._scrollInd  = document.getElementById('scroll-indicator');

    this._bind();
    this._onScroll(); // prime
  }

  _bind() {
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
      if (!this._ticking) {
        requestAnimationFrame(() => { this._onScroll(nav); this._ticking=false; });
        this._ticking = true;
      }
    }, { passive:true });

    // Smooth anchor scrolls
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id  = a.getAttribute('href').slice(1);
        const idx = this.STOPS.findIndex(s => s.id === id);
        if (idx < 0) return;
        e.preventDefault();
        document.querySelector('.nav-links')?.classList.remove('open');
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: this.STOPS[idx].frac * max, behavior:'smooth' });
      });
    });
  }

  _onScroll(nav) {
    this._scrollY  = window.scrollY;
    const max      = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    this._progress = Math.min(this._scrollY / max, 1);

    nav?.classList.toggle('scrolled', this._scrollY > 60);

    // Depth fill bar
    if (this._depthFill) this._depthFill.style.height = (this._progress*100) + '%';

    // Find current stop
    let idx = 0;
    for (let i=0; i<this.STOPS.length; i++) {
      if (this._progress >= this.STOPS[i].frac) idx = i;
    }
    const stop = this.STOPS[idx];

    // Camera
    this.E.setCameraTarget(stop.cam);

    // Section dots + nav
    this._progDots.forEach((d,i) => d.classList.toggle('active', i===idx));
    this._navLinks.forEach(l => l.classList.toggle('active', l.dataset.section===stop.id));

    // Section overlay
    document.querySelectorAll('.section-overlay').forEach(o => o.classList.remove('active'));
    document.getElementById(`overlay-${stop.id}`)?.classList.add('active');

    // Analyze button
    this._analyzeBtn?.classList.toggle('visible', !!stop.showAnalyze);

    // Scroll indicator hides after first scroll
    if (this._scrollY > 80 && this._scrollInd) this._scrollInd.classList.remove('visible');

    // State machine — only on change
    if (idx !== this._lastIdx) {
      this._lastIdx = idx;
      this._onStopChange(stop, idx);
    }
  }

  _onStopChange(stop, idx) {
    // Core state
    if (stop.state !== 'CFG') {
      this.core.transitionTo(stop.state);
    }

    // Network graph — show at CFG stop
    if (stop.state === 'CFG') {
      this.network.show(this.gsap);
    } else if (this.network.group.visible) {
      this.network.hide(this.gsap);
    }

    // Light color emphasis per section
    const lightMap = {
      'HEADERS':  { red:5, blue:2, green:1 },
      'SECTIONS': { red:4, blue:3, green:2 },
      'MEMORY':   { red:2, blue:6, green:2 },
      'IMPORTS':  { red:2, blue:4, green:4 },
      'CFG':      { red:3, blue:2, green:5 },
      'SEALED':   { red:3.5, blue:2.8, green:2.0 },
    };
    const lm = lightMap[stop.state] || lightMap['SEALED'];
    Object.entries(lm).forEach(([name, val]) => this.E.setLight(name, val));
  }

  tick() { /* scroll events drive this, no per-frame work */ }
}
