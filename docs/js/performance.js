// ============================================================
// EAGLE V3 — performance.js
// Quality tier detection, FPS watchdog, adaptive scaling.
// ============================================================

export const Perf = (() => {

  // ── WebGL probe ──────────────────────────────────────────
  function _probeWebGL() {
    try {
      const c  = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) return { ok: false, score: 0 };
      const ext      = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL).toLowerCase() : '';
      const isSW     = /swiftshader|llvmpipe|software|microsoft basic/.test(renderer);
      return { ok: true, score: isSW ? 1 : 3, renderer };
    } catch { return { ok: false, score: 0 }; }
  }

  const isMobile  = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 768;
  const isTablet  = !isMobile && window.innerWidth < 1200;
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gl        = _probeWebGL();
  const dpr       = Math.min(window.devicePixelRatio || 1, isMobile ? 1.2 : 1.5);

  // Tier: 0=no-WebGL, 1=low, 2=mid, 3=high, 4=ultra
  let tier = 4;
  if (!gl.ok)        tier = 0;
  else if (isMobile) tier = 1;
  else if (isTablet || gl.score < 2) tier = 2;
  else if (isReduced) tier = 2;

  const Q = {
    tier, dpr, isMobile, isTablet, isReduced, webglOk: gl.ok,
    // Particle counts per layer
    fieldParticles:   [0,  1500,  4000,  10000, 18000][tier],
    dataParticles:    [0,   200,   600,   2000,  4000][tier],
    hexRain:          [0,    20,    60,    150,   280][tier],
    networkPackets:   [0,    10,    30,     80,   150][tier],
    // Geometry
    orbitSegs:        [0,    32,    64,    100,   140][tier],
    memBlocks:        [0,    60,   200,    600,  1200][tier],
    networkNodes:     [0,     8,    14,     22,    32][tier],
    antialias:        tier >= 3 && !isMobile,
    fogDensity:       [0, 0.030, 0.024, 0.018, 0.014][tier],
    frameTarget:      isMobile ? 33 : 16,
  };

  // ── FPS monitor + watchdog ───────────────────────────────
  let _frames = 0, _lastT = performance.now(), _fps = 60;
  let _downgradeCount = 0;
  const _watchdogs = new Map();   // name → { lastTick, restarter }

  function tickFrame() {
    _frames++;
    const now = performance.now();
    if (now - _lastT > 2000) {
      _fps = (_frames * 1000) / (now - _lastT);
      _frames = 0; _lastT = now;
      if (_fps < 22 && _downgradeCount < 3) _downgrade();
    }
  }

  function _downgrade() {
    _downgradeCount++;
    Q.fieldParticles = Math.floor(Q.fieldParticles * 0.55);
    Q.dataParticles  = Math.floor(Q.dataParticles  * 0.55);
    Q.hexRain        = Math.floor(Q.hexRain        * 0.6);
    console.info(`[EAGLE] Perf downgrade #${_downgradeCount} — FPS ${_fps.toFixed(1)}`);
  }

  // Register a subsystem to watchdog. restarter is called if no tick in 3s.
  function watchdog(name, restarter) {
    _watchdogs.set(name, { lastTick: performance.now(), restarter });
  }

  function heartbeat(name) {
    const w = _watchdogs.get(name);
    if (w) w.lastTick = performance.now();
  }

  // Call every ~2s from main loop
  function checkWatchdogs() {
    const now = performance.now();
    _watchdogs.forEach((w, name) => {
      if (now - w.lastTick > 3000) {
        console.warn(`[EAGLE] Watchdog: restarting ${name}`);
        try { w.restarter(); } catch (e) { console.error(e); }
        w.lastTick = now;
      }
    });
  }

  return { Q, tickFrame, getFPS: () => _fps, watchdog, heartbeat, checkWatchdogs, isReduced };
})();
