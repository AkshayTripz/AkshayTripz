// ============================================================
// EAGLE V2 — terminal.js
// Floating terminal: simulated analyzer output + typed lines.
// "/" key opens command console with functional commands.
// ============================================================

export class Terminal {
  constructor() {
    this._panel    = document.getElementById('terminal-panel');
    this._output   = document.getElementById('terminal-output');
    this._console  = document.getElementById('cmd-console');
    this._cmdInput = document.getElementById('cmd-input');
    this._cmdOut   = document.querySelector('.cmd-output');
    this._minimized = false;
    this._consoleOpen = false;
    this._queue    = [];
    this._typing   = false;
    this._interval = null;
    this._history  = [];
    this._histIdx  = -1;

    this._bindTerminal();
    this._bindConsole();
    this._bindKeys();
    this._startFeed();
  }

  // ── SHOW / HIDE ───────────────────────────────────────────
  show() {
    this._panel?.classList.add('visible');
  }

  hide() {
    this._panel?.classList.remove('visible');
  }

  // ── TERMINAL MINIMIZE ─────────────────────────────────────
  _bindTerminal() {
    const minBtn = this._panel?.querySelector('.term-minimize');
    minBtn?.addEventListener('click', () => {
      this._minimized = !this._minimized;
      const body = this._panel.querySelector('.terminal-body');
      if (body) body.style.display = this._minimized ? 'none' : 'block';
      minBtn.textContent = this._minimized ? '[+]' : '[−]';
    });
  }

  // ── COMMAND CONSOLE ───────────────────────────────────────
  _bindConsole() {
    // Close on Escape or clicking outside
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._consoleOpen) this.closeConsole();
    });

    this._cmdInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const cmd = this._cmdInput.value.trim();
        if (cmd) {
          this._history.unshift(cmd);
          this._histIdx = -1;
          this._execCommand(cmd);
          this._cmdInput.value = '';
        }
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._histIdx = Math.min(this._histIdx + 1, this._history.length - 1);
        if (this._history[this._histIdx]) this._cmdInput.value = this._history[this._histIdx];
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._histIdx = Math.max(this._histIdx - 1, -1);
        this._cmdInput.value = this._histIdx >= 0 ? (this._history[this._histIdx] || '') : '';
      }
    });
  }

  _bindKeys() {
    window.addEventListener('keydown', e => {
      // "/" opens console (unless focus is on an input)
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        this.toggleConsole();
      }
    });
  }

  toggleConsole() {
    this._consoleOpen ? this.closeConsole() : this.openConsole();
  }

  openConsole() {
    this._consoleOpen = true;
    this._console?.classList.add('open');
    setTimeout(() => this._cmdInput?.focus(), 50);
    this._writeConsole('<span class="cmd-out-accent">EAGLE CONSOLE v2.0 — type "help" for commands</span>');
  }

  closeConsole() {
    this._consoleOpen = false;
    this._console?.classList.remove('open');
    this._cmdInput?.blur();
  }

  _execCommand(raw) {
    const [cmd, ...args] = raw.trim().toLowerCase().split(/\s+/);
    this._writeConsole(`<span style="color:var(--cyan)">❯ ${raw}</span>`);

    const COMMANDS = {
      help: () => [
        '<span class="cmd-out-accent">Available commands:</span>',
        '  <span class="cmd-out-accent">about</span>       — System identity',
        '  <span class="cmd-out-accent">skills</span>      — Capability matrix',
        '  <span class="cmd-out-accent">projects</span>    — Project archive',
        '  <span class="cmd-out-accent">tools</span>       — Toolchain list',
        '  <span class="cmd-out-accent">analyze</span>     — Run binary analysis',
        '  <span class="cmd-out-accent">matrix</span>      — Activate matrix mode',
        '  <span class="cmd-out-accent">whoami</span>      — Identity check',
        '  <span class="cmd-out-accent">clear</span>       — Clear output',
        '  <span class="cmd-out-accent">version</span>     — System version',
        '  Press <span class="cmd-out-accent">Escape</span> or <span class="cmd-out-accent">/</span> to close',
      ].join('<br>'),

      about: () => [
        '<span class="cmd-out-accent">IDENTITY: EAGLE</span>',
        'Role    : Software Reverse Engineer',
        'Focus   : Binary Analysis · Windows Internals · Malware Research',
        'Method  : Static + Dynamic · Black-box + White-box',
        'Output  : Clean, reproducible, documented.',
      ].join('<br>'),

      skills: () => [
        '<span class="cmd-out-accent">CAPABILITY MATRIX:</span>',
        '  [████████████] Reverse Engineering     100%',
        '  [███████████░] Binary Analysis          95%',
        '  [██████████░░] Windows Internals        90%',
        '  [██████████░░] Malware Analysis         88%',
        '  [█████████░░░] Protocol Analysis        82%',
        '  [████████░░░░] Kernel Debugging         78%',
        '  [████████████] x86-64 Assembly          98%',
      ].join('<br>'),

      projects: () => [
        '<span class="cmd-out-accent">PROJECT ARCHIVE:</span>',
        '  [ACTIVE]   Advance Pixel Grid Mapper — C++ · Win32 · GDI+',
        '  [ACTIVE]   Pulse                    — C · ETW · WMI',
        '  [WIP]      StageFlow                — Python · Graphviz',
        '  [COMPLETE] Chaser                   — C++ · PE Analysis',
        '  [ACTIVE]   PixelPerfectPro          — C++ · Direct2D · COM',
      ].join('<br>'),

      tools: () => [
        '<span class="cmd-out-accent">TOOLCHAIN:</span>',
        '  Disassemblers : IDA Pro · Ghidra · Binary Ninja',
        '  Debuggers     : x64dbg · WinDbg',
        '  Languages     : C · C++ · Python · x86-64 ASM',
        '  Network       : Wireshark · Frida · mitmproxy',
        '  IDE           : Visual Studio',
      ].join('<br>'),

      whoami: () =>
        '<span class="cmd-out-accent">eagle</span>@workstation — SOFTWARE REVERSE ENGINEER',

      version: () =>
        'EAGLE SYSTEM v2.0.0 · WebGL · Three.js r160 · GSAP 3<br>Build: 2025 · GitHub: S90x123',

      analyze: () => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('eagle:analyze'));
        }, 300);
        this.closeConsole();
        return '<span class="cmd-out-ok">[+] Launching binary analysis sequence...</span>';
      },

      matrix: () => {
        document.body.classList.toggle('overdrive');
        window.dispatchEvent(new CustomEvent('eagle:remode'));
        return '<span class="cmd-out-ok">[+] Matrix mode toggled.</span>';
      },

      clear: () => {
        if (this._cmdOut) this._cmdOut.innerHTML = '';
        return null;
      },

      exit:  () => { this.closeConsole(); return null; },
      close: () => { this.closeConsole(); return null; },
    };

    const handler = COMMANDS[cmd];
    if (handler) {
      const result = handler();
      if (result) this._writeConsole(result);
    } else {
      this._writeConsole(`<span class="cmd-out-err">Command not found: ${cmd}. Type "help".</span>`);
    }
  }

  _writeConsole(html) {
    if (!this._cmdOut) return;
    const el = document.createElement('div');
    el.innerHTML = html;
    this._cmdOut.appendChild(el);
    this._cmdOut.scrollTop = this._cmdOut.scrollHeight;
  }

  // ── TERMINAL FEED ─────────────────────────────────────────
  _startFeed() {
    const LINES = [
      { cls: 'term-line-prompt', text: './eagle_analyzer.exe target.exe' },
      { cls: '',    text: '' },
      { cls: 'term-line-ok',   text: '[+] Loading PE image...' },
      { cls: 'term-line-ok',   text: '[+] Architecture: x64' },
      { cls: 'term-line-ok',   text: '[+] Sections detected: 5' },
      { cls: 'term-line-ok',   text: '[+] Entry point: 0x00401A30' },
      { cls: '',               text: '[*] Resolving imports...' },
      { cls: 'term-line-ok',   text: '[+] KERNEL32.dll → 4 functions' },
      { cls: 'term-line-ok',   text: '[+] ntdll.dll    → 3 functions' },
      { cls: 'term-line-ok',   text: '[+] USER32.dll   → 3 functions' },
      { cls: '',               text: '[*] Building control-flow graph...' },
      { cls: 'term-line-ok',   text: '[+] Functions identified: 1,482' },
      { cls: 'term-line-ok',   text: '[+] Cross-references mapped: 8,341' },
      { cls: 'term-line-warn', text: '[!] Anti-debug pattern detected at 0x00402A10' },
      { cls: 'term-line-warn', text: '[!] Obfuscated string at 0x00406B40' },
      { cls: '',               text: '[*] Entropy analysis...' },
      { cls: 'term-line-ok',   text: '[+] .text  entropy: 5.82 — normal' },
      { cls: 'term-line-warn', text: '[!] .data  entropy: 7.94 — possibly packed' },
      { cls: 'term-line-ok',   text: '[+] Analysis complete.' },
      { cls: '', text: '' },
      { cls: 'term-line-prompt', text: 'strings target.exe | grep -i "license"' },
      { cls: 'term-line-ok',   text: '"LICENSE_VALID"' },
      { cls: 'term-line-ok',   text: '"check_license_key"' },
      { cls: 'term-line-err',  text: '"INVALID_LICENSE — terminating"' },
      { cls: '', text: '' },
      { cls: 'term-line-prompt', text: 'objdump -d target.exe | grep -A5 "401120"' },
      { cls: '',               text: '  401120:  48 83 ec 28  sub    rsp,0x28' },
      { cls: '',               text: '  401124:  48 8b 01     mov    rax,[rcx]' },
      { cls: '',               text: '  401127:  33 d2        xor    edx,edx' },
      { cls: 'term-line-comment', text: '  ; XOR decrypt loop detected' },
    ];

    // Queue all lines, then loop
    this._allLines = LINES;
    this._lineIdx  = 0;
    this._scheduleNext(1200);
  }

  _scheduleNext(delay) {
    if (!this._output) return;
    setTimeout(() => {
      const line = this._allLines[this._lineIdx % this._allLines.length];
      this._printLine(line);
      this._lineIdx++;

      // Variable delay between lines
      const nextDelay = line.text === '' ? 80
        : line.cls === 'term-line-prompt' ? 900
        : 260 + Math.random() * 400;

      // Longer pause after completing the full sequence
      const isEnd = this._lineIdx % this._allLines.length === 0;
      this._scheduleNext(isEnd ? 4000 : nextDelay);
    }, delay);
  }

  _printLine(line) {
    if (!this._output) return;
    const el = document.createElement('div');
    if (line.cls) el.className = line.cls;
    el.textContent = line.text;

    // Keep scrollback bounded
    while (this._output.children.length > 80) {
      this._output.removeChild(this._output.firstChild);
    }

    this._output.appendChild(el);
    this._output.scrollTop = this._output.scrollHeight;
  }

  // ── SYSTEM NOTIFICATIONS ──────────────────────────────────
  notify(msg, type = '') {
    const container = document.getElementById('notifications');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `notif${type ? ' ' + type : ''}`;
    el.textContent = msg;
    container.appendChild(el);

    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  // ── PERIODIC SYSTEM EVENTS ────────────────────────────────
  startSystemEvents() {
    const EVENTS = [
      { msg: '⬡ NEW MODULE DETECTED',        type: '' },
      { msg: '⬡ FUNCTION GRAPH UPDATED',     type: 'ok' },
      { msg: '⬡ MEMORY REGION MAPPED',       type: '' },
      { msg: '⬡ CROSS-REFERENCE FOUND',      type: '' },
      { msg: '⬡ ANTI-DEBUG PATTERN AT 0x402A10', type: 'warn' },
      { msg: '⬡ IMPORT TABLE RESOLVED',      type: 'ok' },
      { msg: '⬡ ENTROPY ANOMALY DETECTED',   type: 'warn' },
      { msg: '⬡ ANALYSIS COMPLETE',          type: 'ok' },
    ];

    const fire = () => {
      const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      this.notify(ev.msg, ev.type);
      setTimeout(fire, 6000 + Math.random() * 10000);
    };
    setTimeout(fire, 5000);
  }

  tick() { /* nothing per-frame needed */ }
}
