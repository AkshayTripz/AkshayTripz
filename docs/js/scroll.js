// ============================================================
// EAGLE V2 — scroll.js
// Maps window.scrollY → camera positions → core state machine.
// One continuous journey through the dissection.
// ============================================================

export class ScrollController {
  constructor(sceneManager, core, graph, terminal, gsap) {
    this.SM       = sceneManager;
    this.core     = core;
    this.graph    = graph;
    this.terminal = terminal;
    this.gsap     = gsap;

    this._scrollY    = 0;
    this._progress   = 0;
    this._ticking    = false;
    this._lastSection = -1;

    // Sections: each has a scroll range and camera choreography
    this.SECTIONS = [
      {
        id:    'hero',
        label: 'EAGLE CORE',
        start: 0,    end: 0.12,
        cam:   { rig: {x:0, y:0, z:0}, camZ: 22 },
        state: 'SEALED',
        showAnalyze: true,
      },
      {
        id:    'headers',
        label: 'PE HEADERS',
        start: 0.12,  end: 0.24,
        cam:   { rig: {x:0, y:0, z:-2}, camZ: 18 },
        state: 'HEADERS',
        showAnalyze: false,
      },
      {
        id:    'sections',
        label: 'SECTION TABLE',
        start: 0.24,  end: 0.38,
        cam:   { rig: {x:0, y:0, z:-4}, camZ: 14 },
        state: 'SECTIONS',
        showAnalyze: false,
      },
      {
        id:    'memory',
        label: 'MEMORY MAP',
        start: 0.38,  end: 0.52,
        cam:   { rig: {x:0, y:1, z:-6}, camZ: 12 },
        state: 'MEMORY',
        showAnalyze: false,
      },
      {
        id:    'imports',
        label: 'IMPORT TABLE',
        start: 0.52,  end: 0.66,
        cam:   { rig: {x:0, y:0, z:-8}, camZ: 16 },
        state: 'IMPORTS',
        showAnalyze: false,
      },
      {
        id:    'cfg',
        label: 'CONTROL FLOW GRAPH',
        start: 0.66,  end: 0.80,
        cam:   { rig: {x:0, y:0, z:-10}, camZ: 18 },
        state: 'CFG',
        showAnalyze: false,
      },
      {
        id:    'contact',
        label: 'EXFILTRATE',
        start: 0.80,  end: 1.0,
        cam:   { rig: {x:0, y:-3, z:-6}, camZ: 28 },
        state: 'SEALED',
        showAnalyze: false,
      },
    ];

    this._navLinks = Array.from(document.querySelectorAll('.nav-link[data-section]'));
    this._progDots = Array.from(document.querySelectorAll('.prog-dot'));
    this._depthFill = document.getElementById('depth-fill');
    this._analyzeBtn = document.getElementById('analyze-btn');
    this._scrollInd = document.getElementById('scroll-indicator');

    this._initListeners();
    this._updateNav();
  }

  _initListeners() {
    const nav = document.getElementById('nav');

    window.addEventListener('scroll', () => {
      if (!this._ticking) {
        requestAnimationFrame(() => {
          this._onScroll(nav);
          this._ticking = false;
        });
        this._ticking = true;
      }
    }, { passive: true });

    // Smooth anchor links
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const id = a.getAttribute('href').slice(1);
        const el = document.getElementById(id);
        if (!el) return;
        e.preventDefault();

        // Close mobile nav
        const navLinks = document.querySelector('.nav-links');
        navLinks?.classList.remove('open');

        // Scroll to the virtual position
        const sectionIdx = this.SECTIONS.findIndex(s => s.id === id);
        if (sectionIdx >= 0) {
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const target    = this.SECTIONS[sectionIdx].start * maxScroll;
          window.scrollTo({ top: target, behavior: 'smooth' });
        } else {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
  }

  _onScroll(nav) {
    this._scrollY  = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    this._progress  = maxScroll > 0 ? Math.min(this._scrollY / maxScroll, 1) : 0;

    // Nav scrolled state
    nav?.classList.toggle('scrolled', this._scrollY > 80);

    // Depth fill bar
    if (this._depthFill) {
      this._depthFill.style.height = (this._progress * 100) + '%';
    }

    // Determine current section
    const p = this._progress;
    let currentIdx = 0;
    for (let i = 0; i < this.SECTIONS.length; i++) {
      if (p >= this.SECTIONS[i].start) currentIdx = i;
    }

    const section = this.SECTIONS[currentIdx];

    // Camera choreography
    this.SM.moveCameraTo(section.cam);

    // Progress dots
    this._progDots.forEach((dot, i) => dot.classList.toggle('active', i === currentIdx));

    // Nav active
    this._updateNav(section.id);

    // State machine — only trigger on change
    if (currentIdx !== this._lastSection) {
      this._onSectionChange(section, currentIdx);
      this._lastSection = currentIdx;
    }

    // Scroll indicator — hide after first scroll
    if (this._scrollY > 50 && this._scrollInd) {
      this._scrollInd.classList.remove('visible');
    }
  }

  _onSectionChange(section, idx) {
    // CORE state machine
    if (section.state !== 'CFG') {
      if (this.graph?.group?.visible && section.state === 'SEALED') {
        this.graph.hide(this.gsap);
      }
      this.core.transitionTo(section.state, this.gsap);
    }

    // CFG: show the function graph instead of PE sections
    if (section.state === 'CFG') {
      this.graph.show(this.gsap);
    } else {
      if (this.graph?.group?.visible && section.state !== 'CFG') {
        this.graph.hide(this.gsap);
      }
    }

    // Analyze button visibility
    if (this._analyzeBtn) {
      this._analyzeBtn.classList.toggle('visible', !!section.showAnalyze);
    }

    // Red light on dangerous sections
    const redIntensity = section.state === 'MEMORY' ? 1.5
      : section.state === 'IMPORTS' ? 0.8 : 0;
    this.SM.setRedLight(redIntensity);

    // Section label overlay
    this._updateSectionOverlay(section);
  }

  _updateSectionOverlay(section) {
    const overlays = document.querySelectorAll('.section-overlay');
    overlays.forEach(o => o.classList.remove('active'));
    const target = document.getElementById(`overlay-${section.id}`);
    target?.classList.add('active');
  }

  _updateNav(activeId) {
    this._navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.section === activeId);
    });
  }

  getScrollY()   { return this._scrollY; }
  getProgress()  { return this._progress; }

  tick(elapsed) { /* scroll events drive updates, no per-frame work */ }
}
