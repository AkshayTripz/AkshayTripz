// ============================================================
// EAGLE — interactions.js
// Custom cursor, card tilt, magnetic buttons, binary explorer
// ============================================================

export class Interactions {
  constructor() {
    this.mouse    = { x: 0, y: 0 };
    this.cursorEl = document.getElementById('cursor-outer');
    this.dotEl    = document.getElementById('cursor-inner');
    this.curX     = 0;
    this.curY     = 0;
    this.dotX     = 0;
    this.dotY     = 0;
    this._raf     = null;
    this.isMobile = 'ontouchstart' in window;

    if (this.isMobile) {
      document.body.classList.add('touch-device');
      return;
    }

    this._initCursor();
    this._initCardTilt();
    this._initMagneticButtons();
    this._initBinaryExplorer();
    this._initProjectPreviews();
  }

  // ── CUSTOM CURSOR ─────────────────────────────────────────
  _initCursor() {
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    const hoverEls = document.querySelectorAll('a, button, .expertise-card, .tool-card, .project-card, .contact-link');
    hoverEls.forEach(el => {
      el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
      el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
    });

    this._animateCursor();
  }

  _animateCursor() {
    // Outer ring lags behind — gives trailing feel
    this.curX += (this.mouse.x - this.curX) * 0.1;
    this.curY += (this.mouse.y - this.curY) * 0.1;

    // Inner dot is snappy
    this.dotX += (this.mouse.x - this.dotX) * 0.6;
    this.dotY += (this.mouse.y - this.dotY) * 0.6;

    if (this.cursorEl) {
      this.cursorEl.style.left = this.curX + 'px';
      this.cursorEl.style.top  = this.curY + 'px';
    }
    if (this.dotEl) {
      this.dotEl.style.left = this.dotX + 'px';
      this.dotEl.style.top  = this.dotY + 'px';
    }

    requestAnimationFrame(() => this._animateCursor());
  }

  // ── CARD 3D TILT ──────────────────────────────────────────
  _initCardTilt() {
    const cards = document.querySelectorAll('.expertise-card, .project-card');

    cards.forEach(card => {
      card.addEventListener('mousemove', e => {
        const rect   = card.getBoundingClientRect();
        const cx     = rect.left + rect.width  / 2;
        const cy     = rect.top  + rect.height / 2;
        const dx     = (e.clientX - cx) / (rect.width  / 2);
        const dy     = (e.clientY - cy) / (rect.height / 2);
        const rotX   = -dy * 6;
        const rotY   =  dx * 6;

        card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(4px)`;

        // Highlight follows mouse
        const px = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
        const py = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
        card.style.background = `radial-gradient(circle at ${px}% ${py}%, rgba(10,228,200,0.04) 0%, rgba(13,17,23,0.7) 70%)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform  = '';
        card.style.background = '';
        card.style.transition = 'transform 0.5s cubic-bezier(0.16,1,0.3,1), background 0.5s';
      });

      card.addEventListener('mouseenter', () => {
        card.style.transition = 'none';
      });
    });
  }

  // ── MAGNETIC BUTTONS ──────────────────────────────────────
  _initMagneticButtons() {
    const btns = document.querySelectorAll('.btn');

    btns.forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const rect  = btn.getBoundingClientRect();
        const cx    = rect.left + rect.width  / 2;
        const cy    = rect.top  + rect.height / 2;
        const dx    = (e.clientX - cx) * 0.25;
        const dy    = (e.clientY - cy) * 0.25;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });

      btn.addEventListener('mouseleave', () => {
        btn.style.transform  = '';
        btn.style.transition = 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s, border-color 0.3s';
      });

      btn.addEventListener('mouseenter', () => {
        btn.style.transition = 'transform 0.1s, box-shadow 0.3s, border-color 0.3s';
      });
    });
  }

  // ── BINARY EXPLORER (interactive 3D section) ───────────────
  _initBinaryExplorer() {
    const canvas = document.getElementById('explorer-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W   = canvas.offsetWidth;
    const H   = canvas.offsetHeight;
    canvas.width  = W;
    canvas.height = H;

    // PE section model
    const sections = [
      { name: '.text',  size: '0x4800', addr: '0x1000', color: '#0ae4c8', description: 'Executable code',          expanded: false },
      { name: '.data',  size: '0x0A00', addr: '0x5800', color: '#22d3ee', description: 'Initialized data',         expanded: false },
      { name: '.rdata', size: '0x0C00', addr: '0x6800', color: '#0891b2', description: 'Read-only data / imports',  expanded: false },
      { name: '.rsrc',  size: '0x0200', addr: '0x7A00', color: '#2dd4bf', description: 'Resources',                 expanded: false },
    ];

    let hoveredSection = null;
    let animT = 0;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#080a0f';
      ctx.fillRect(0, 0, W, H);

      // Grid
      ctx.strokeStyle = 'rgba(14,42,48,0.6)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 24) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 24) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      animT += 0.02;

      // Central PE file shape
      const cx    = W / 2;
      const cy    = H / 2;
      const baseW = 80;
      const totalH = sections.length * 52 + (sections.length - 1) * 8;
      let startY = cy - totalH / 2;

      sections.forEach((sec, idx) => {
        const isHover = hoveredSection === idx;
        const x       = cx - baseW / 2 + (isHover ? -6 : 0);
        const y       = startY;
        const w       = baseW + (isHover ? 20 : 0);
        const h       = 48;

        // Glow
        if (isHover) {
          ctx.shadowColor = sec.color;
          ctx.shadowBlur  = 18;
        } else {
          ctx.shadowBlur = 0;
        }

        // Block fill
        ctx.fillStyle = isHover
          ? sec.color + '28'
          : 'rgba(13,23,27,0.9)';
        ctx.strokeStyle = sec.color + (isHover ? 'cc' : '55');
        ctx.lineWidth   = isHover ? 1.5 : 1;
        _roundRect(ctx, x, y, w, h, 4);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Section name
        ctx.fillStyle = isHover ? sec.color : sec.color + '99';
        ctx.font      = `${isHover ? 600 : 400} 11px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(sec.name, cx, y + 20);

        // Addr
        ctx.fillStyle = 'rgba(148,163,184,0.5)';
        ctx.font      = '9px "JetBrains Mono", monospace';
        ctx.fillText(sec.addr, cx, y + 35);

        // Connector lines to right panel
        if (isHover) {
          ctx.strokeStyle = sec.color + '40';
          ctx.lineWidth   = 1;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(cx + w / 2, y + h / 2);
          ctx.lineTo(W - 10, y + h / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        startY += h + 8;
      });

      // Floating hex bytes orbiting the structure
      const hexChars = ['4D', '5A', '90', '00', 'E8', 'FF', '25', 'C3', '48', '89'];
      hexChars.forEach((hx, i) => {
        const angle = animT * 0.4 + (i / hexChars.length) * Math.PI * 2;
        const r     = 110 + Math.sin(animT * 0.3 + i) * 8;
        const hxX   = cx + Math.cos(angle) * r;
        const hxY   = cy + Math.sin(angle) * r * 0.5;
        const alpha = 0.15 + Math.sin(animT + i * 0.8) * 0.1;

        ctx.fillStyle = `rgba(10,228,200,${alpha.toFixed(2)})`;
        ctx.font      = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(hx, hxX, hxY);
      });

      // Scan line
      const scanY = cy + Math.sin(animT * 0.6) * (totalH / 2 + 10);
      ctx.strokeStyle = 'rgba(10,228,200,0.15)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(cx - 80, scanY);
      ctx.lineTo(cx + 80, scanY);
      ctx.stroke();

      requestAnimationFrame(draw);
    };

    draw();

    // Mouse interaction — expand section panels
    canvas.addEventListener('mousemove', e => {
      const rect  = canvas.getBoundingClientRect();
      const mx    = e.clientX - rect.left;
      const my    = e.clientY - rect.top;
      const cx    = W / 2;
      const cy    = H / 2;
      const totalH = sections.length * 52 + (sections.length - 1) * 8;
      let startY  = cy - totalH / 2;
      let found   = null;

      sections.forEach((_, idx) => {
        const y = startY;
        if (mx >= cx - 50 && mx <= cx + 50 && my >= y && my <= y + 48) found = idx;
        startY += 56;
      });

      hoveredSection = found;
      canvas.style.cursor = found !== null ? 'pointer' : 'default';
    });

    canvas.addEventListener('click', e => {
      const rect  = canvas.getBoundingClientRect();
      const mx    = e.clientX - rect.left;
      const my    = e.clientY - rect.top;
      const cx    = W / 2;
      const cy    = H / 2;
      const totalH = sections.length * 52 + (sections.length - 1) * 8;
      let startY  = cy - totalH / 2;

      sections.forEach((sec, idx) => {
        const y = startY;
        if (mx >= cx - 50 && mx <= cx + 50 && my >= y && my <= y + 48) {
          // Toggle panel in sidebar
          const panelEls = document.querySelectorAll('.explorer-section');
          panelEls.forEach((p, pi) => {
            p.classList.toggle('active', pi === idx);
          });
        }
        startY += 56;
      });
    });

    canvas.addEventListener('mouseleave', () => { hoveredSection = null; });
  }

  // ── PROJECT PREVIEW CANVASES ──────────────────────────────
  _initProjectPreviews() {
    const previews = document.querySelectorAll('.project-preview-canvas');
    previews.forEach((canvas, i) => {
      const ctx = canvas.getContext('2d');
      canvas.width  = canvas.offsetWidth  || 400;
      canvas.height = canvas.offsetHeight || 140;

      const drawers = [
        this._drawPixelGridPreview.bind(this),
        this._drawPulsePreview.bind(this),
        this._drawStageFlowPreview.bind(this),
        this._drawChaserPreview.bind(this),
        this._drawPixelPerfectPreview.bind(this),
      ];

      const draw = drawers[i % drawers.length];
      if (draw) {
        let t = 0;
        const loop = () => {
          draw(ctx, canvas.width, canvas.height, t);
          t += 0.025;
          requestAnimationFrame(loop);
        };
        loop();
      }
    });
  }

  _drawPixelGridPreview(ctx, W, H, t) {
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, W, H);
    const cols = Math.ceil(W / 14);
    const rows = Math.ceil(H / 14);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wave = Math.sin(t + r * 0.4 + c * 0.3) * 0.5 + 0.5;
        if (wave > 0.65) {
          ctx.fillStyle = `rgba(10,228,200,${(wave - 0.65) * 2.8})`;
          ctx.fillRect(c * 14 + 1, r * 14 + 1, 12, 12);
        }
      }
    }
  }

  _drawPulsePreview(ctx, W, H, t) {
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    for (let i = 0; i < 4; i++) {
      const r = (t * 30 + i * 25) % (Math.max(W, H) * 0.7);
      const a = Math.max(0, 1 - r / (Math.max(W, H) * 0.7));
      ctx.strokeStyle = `rgba(10,228,200,${a * 0.6})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    // ECG line
    ctx.strokeStyle = 'rgba(10,228,200,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const phase = (x / W + t * 0.4) * Math.PI * 6;
      const y = cy + Math.sin(phase) * 18 * Math.exp(-((x / W - 0.5) ** 2) * 4);
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  _drawStageFlowPreview(ctx, W, H, t) {
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, W, H);
    const stages = 5;
    const sw = W / stages;
    for (let i = 0; i < stages; i++) {
      const active = Math.floor(t * 2) % stages === i;
      const x = i * sw;
      ctx.fillStyle = active ? 'rgba(10,228,200,0.12)' : 'rgba(14,116,144,0.05)';
      ctx.fillRect(x + 2, 10, sw - 4, H - 20);
      ctx.strokeStyle = active ? 'rgba(10,228,200,0.5)' : 'rgba(14,116,144,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 2, 10, sw - 4, H - 20);
      // Arrow
      if (i < stages - 1) {
        ctx.fillStyle = 'rgba(10,228,200,0.3)';
        const ax = x + sw - 4, ay = H / 2;
        ctx.beginPath();
        ctx.moveTo(ax, ay - 4); ctx.lineTo(ax + 6, ay); ctx.lineTo(ax, ay + 4);
        ctx.fill();
      }
      ctx.fillStyle = active ? 'rgba(10,228,200,0.9)' : 'rgba(148,163,184,0.3)';
      ctx.font = '8px "JetBrains Mono"';
      ctx.textAlign = 'center';
      ctx.fillText(`S${i + 1}`, x + sw / 2, H / 2 + 3);
    }
  }

  _drawChaserPreview(ctx, W, H, t) {
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, W, H);
    // Hex dump feel
    const lines = 5;
    for (let l = 0; l < lines; l++) {
      const y = 20 + l * 22;
      const highlight = Math.floor(t * 1.5) % lines === l;
      if (highlight) {
        ctx.fillStyle = 'rgba(10,228,200,0.06)';
        ctx.fillRect(0, y - 10, W, 18);
      }
      ctx.fillStyle = 'rgba(8,145,178,0.5)';
      ctx.font = '9px "JetBrains Mono"';
      ctx.textAlign = 'left';
      ctx.fillText(`${(0x004010A0 + l * 16).toString(16).toUpperCase()}:`, 12, y);
      for (let b = 0; b < 8; b++) {
        const val = (Math.sin(t + l * 3 + b * 0.7) * 127 + 128) | 0;
        ctx.fillStyle = highlight ? 'rgba(10,228,200,0.9)' : 'rgba(148,163,184,0.45)';
        ctx.fillText(val.toString(16).toUpperCase().padStart(2, '0'), 80 + b * 22, y);
      }
    }
  }

  _drawPixelPerfectPreview(ctx, W, H, t) {
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, W, H);
    // Crosshair + overlay comparison
    const cx = W / 2 + Math.sin(t * 0.5) * 20;
    const cy = H / 2 + Math.cos(t * 0.4) * 10;
    ctx.strokeStyle = 'rgba(10,228,200,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.setLineDash([]);
    // Measurement annotations
    ctx.strokeStyle = 'rgba(10,228,200,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - 30, cy - 20, 60, 40);
    ctx.fillStyle = 'rgba(10,228,200,0.7)';
    ctx.font = '8px "JetBrains Mono"';
    ctx.textAlign = 'center';
    ctx.fillText(`${(60 + Math.sin(t) * 2).toFixed(1)}px`, cx, cy - 25);
  }
}

// Utility: rounded rect path
function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
