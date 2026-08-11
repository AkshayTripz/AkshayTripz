// ============================================================
// EAGLE V2 — performance.js
// Capability detection → quality tier → adaptive constants
// Called first. Everything else reads from this.
// ============================================================

export const Perf = (() => {

  // ── WEBGL PROBE ──────────────────────────────────────────
  function _probeWebGL() {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { ok: false, score: 0 };

      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = dbg
        ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL).toLowerCase()
        : '';

      // Penalise known software renderers
      const isSoftware = /swiftshader|llvmpipe|software|microsoft basic/.test(renderer);
      const score = isSoftware ? 1 : 3;
      return { ok: true, score, renderer };
    } catch { return { ok: false, score: 0 }; }
  }

  // ── DEVICE TIER ──────────────────────────────────────────
  const isMobile  = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
                 || window.innerWidth < 768;
  const isTablet  = !isMobile && window.innerWidth < 1100;
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const gl       = _probeWebGL();
  const dpr      = Math.min(window.devicePixelRatio || 1, isMobile ? 1.2 : 1.6);

  // TIER: 0 = no WebGL fallback, 1 = low, 2 = mid, 3 = high
  let tier = 3;
  if (!gl.ok)     tier = 0;
  else if (isMobile) tier = 1;
  else if (isTablet || gl.score < 2) tier = 2;

  // ── QUALITY CONSTANTS ────────────────────────────────────
  const Q = {
    tier,
    dpr,
    isMobile,
    isTablet,
    isReducedMotion,
    webglOk: gl.ok,

    // Particle counts
    fieldParticles:  [0, 300,  900,  2800][tier],
    hexSprites:      [0,  20,   60,   140][tier],
    streamColumns:   [0,   0,    6,    16][tier],

    // Geometry detail
    coreDetail:      [0,   1,    2,     3][tier], // subdivision level
    orbitSegments:   [0,  32,   64,   120][tier],

    // Instanced mesh counts
    floaterCount:    [0,   8,   20,    45][tier],
    nodeCount:       [0,   8,   14,    22][tier],

    // RAF throttle target (ms per frame)
    frameTarget:     isMobile ? 33 : 16,

    // Antialiasing
    antialias:       tier === 3 && !isMobile,

    // Post: fog density
    fogDensity:      [0, 0.028, 0.022, 0.016][tier],
  };

  // ── FPS MONITOR ──────────────────────────────────────────
  let _frames = 0, _lastCheck = performance.now(), _fps = 60;
  let _downgraded = false;

  function tick() {
    _frames++;
    const now = performance.now();
    if (now - _lastCheck > 2000) {
      _fps = (_frames / (now - _lastCheck)) * 1000;
      _frames = 0;
      _lastCheck = now;

      // Auto-downgrade if consistently below 25fps
      if (_fps < 25 && !_downgraded && tier > 1) {
        _downgrade();
      }
    }
  }

  function _downgrade() {
    _downgraded = true;
    Q.fieldParticles = Math.floor(Q.fieldParticles * 0.5);
    Q.hexSprites     = Math.floor(Q.hexSprites * 0.5);
    Q.streamColumns  = 0;
    console.info('[EAGLE] Performance downgrade applied — FPS was', _fps.toFixed(1));
  }

  function getFPS() { return _fps; }

  return { Q, tick, getFPS };
})();
