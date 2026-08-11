// ============================================================
// EAGLE — scroll.js
// Scroll-driven reveals, nav active state, section tracking
// ============================================================

export class ScrollController {
  constructor() {
    this.scrollY    = 0;
    this.progress   = 0; // 0–1 full page
    this._sections  = [];
    this._navLinks  = [];
    this._reveals   = [];
    this._ticking   = false;

    this._initObserver();
    this._initNav();
    this._initSmoothLinks();
  }

  // ── INTERSECTION OBSERVER — reveal elements ───────────────
  _initObserver() {
    this._reveals = document.querySelectorAll('.reveal');

    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Don't unobserve so re-entry stays visible
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    this._reveals.forEach(el => obs.observe(el));
    this._observer = obs;
  }

  // ── NAV SECTION TRACKING ──────────────────────────────────
  _initNav() {
    const nav = document.getElementById('nav');
    this._navLinks = Array.from(document.querySelectorAll('.nav-link[data-section]'));
    this._sections  = this._navLinks
      .map(link => document.getElementById(link.dataset.section))
      .filter(Boolean);

    window.addEventListener('scroll', () => this._onScroll(nav), { passive: true });
    this._onScroll(nav);
  }

  _onScroll(nav) {
    if (!this._ticking) {
      requestAnimationFrame(() => {
        this._tick(nav);
        this._ticking = false;
      });
      this._ticking = true;
    }
  }

  _tick(nav) {
    this.scrollY   = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    this.progress  = maxScroll > 0 ? this.scrollY / maxScroll : 0;

    // Nav scrolled state
    if (nav) {
      nav.classList.toggle('scrolled', this.scrollY > 60);
    }

    // Active nav link
    const vh = window.innerHeight;
    let activeIdx = 0;

    this._sections.forEach((section, i) => {
      if (!section) return;
      const rect = section.getBoundingClientRect();
      if (rect.top <= vh * 0.4) activeIdx = i;
    });

    this._navLinks.forEach((link, i) => {
      link.classList.toggle('active', i === activeIdx);
    });
  }

  // ── SMOOTH ANCHOR SCROLLING ───────────────────────────────
  _initSmoothLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', e => {
        const id  = link.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (!target) return;
        e.preventDefault();

        // Close mobile menu if open
        const menu = document.querySelector('.nav-links');
        const btn  = document.querySelector('.nav-menu-btn');
        if (menu && menu.classList.contains('open')) {
          menu.classList.remove('open');
          btn && btn.classList.remove('open');
        }

        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  // ── GETTERS for main.js ───────────────────────────────────
  getScrollY()    { return this.scrollY; }
  getProgress()   { return this.progress; }
}
