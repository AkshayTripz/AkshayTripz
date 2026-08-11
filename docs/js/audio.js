// ============================================================
// EAGLE V2 — audio.js
// Optional Web Audio: ambient drone + UI tones.
// Default: muted. User must opt in.
// ============================================================

export class AudioEngine {
  constructor() {
    this._ctx      = null;
    this._muted    = true;
    this._drone    = null;
    this._droneGain = null;
    this._ready    = false;

    this._bindToggle();
  }

  _bindToggle() {
    const btn = document.getElementById('btn-sound');
    btn?.addEventListener('click', () => {
      if (this._muted) {
        this._unmute();
      } else {
        this._mute();
      }
    });
  }

  _ensureContext() {
    if (this._ctx) return;
    this._ctx   = new (window.AudioContext || window.webkitAudioContext)();
    this._ready = true;
    this._buildAmbient();
  }

  // ── AMBIENT DRONE ─────────────────────────────────────────
  // Two detuned oscillators + low-pass filter → barely audible hum
  _buildAmbient() {
    if (!this._ctx) return;
    const ctx = this._ctx;

    this._droneGain = ctx.createGain();
    this._droneGain.gain.setValueAtTime(0, ctx.currentTime);
    this._droneGain.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type            = 'lowpass';
    filter.frequency.value = 280;
    filter.Q.value         = 0.8;
    filter.connect(this._droneGain);

    const osc1 = ctx.createOscillator();
    osc1.type            = 'sawtooth';
    osc1.frequency.value = 55;   // low A
    osc1.connect(filter);
    osc1.start();

    const osc2 = ctx.createOscillator();
    osc2.type            = 'sine';
    osc2.frequency.value = 82.4; // low E — 5th above
    osc2.connect(filter);
    osc2.start();

    // Slow tremolo
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.0015;
    lfo.connect(lfoGain);
    lfoGain.connect(this._droneGain.gain);
    lfo.start();

    this._drone = [osc1, osc2, lfo];
  }

  // ── UI CLICK TONE ─────────────────────────────────────────
  playClick() {
    if (this._muted || !this._ready) return;
    const ctx = this._ctx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  }

  // ── NOTIFICATION TONE ─────────────────────────────────────
  playNotify(type = '') {
    if (this._muted || !this._ready) return;
    const ctx  = this._ctx;
    const freq  = type === 'warn' ? 330 : type === 'ok' ? 660 : 440;
    const osc   = ctx.createOscillator();
    const gain  = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = 'triangle';
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  // ── OVERDRIVE BURST ───────────────────────────────────────
  playOverdrive() {
    if (this._muted || !this._ready) return;
    const ctx = this._ctx;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    const dist = ctx.createWaveShaper();

    // Simple distortion curve
    const samples = 256;
    const curve   = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x));
    }
    dist.curve = curve;

    osc.connect(dist);
    dist.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 110;
    osc.type = 'sawtooth';
    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
  }

  // ── MUTE / UNMUTE ─────────────────────────────────────────
  _unmute() {
    this._ensureContext();
    this._muted = false;
    if (this._droneGain) {
      this._droneGain.gain.linearRampToValueAtTime(0.06, this._ctx.currentTime + 1.5);
    }
    const btn = document.getElementById('btn-sound');
    if (btn) btn.textContent = 'SOUND ON';
  }

  _mute() {
    this._muted = true;
    if (this._droneGain && this._ctx) {
      this._droneGain.gain.linearRampToValueAtTime(0, this._ctx.currentTime + 0.5);
    }
    const btn = document.getElementById('btn-sound');
    if (btn) btn.textContent = 'SOUND OFF';
  }

  dispose() {
    this._drone?.forEach(o => { try { o.stop(); } catch {} });
    this._ctx?.close();
  }

  tick() {}
}
