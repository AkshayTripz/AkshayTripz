// ============================================================
// EAGLE V3 — terminal.js
// Always-live terminal: typed output, blinking cursor, pause/
// resume, command console ("/"), system event feed.
// ============================================================

export class Terminal {
  constructor(hud) {
    this.hud      = hud;
    this._out     = document.getElementById('terminal-output');
    this._console = document.getElementById('cmd-console');
    this._input   = document.getElementById('cmd-input');
    this._cmdOut  = document.querySelector('.cmd-output');
    this._open    = false;
    this._paused  = false;
    this._history = [];
    this._histIdx = -1;
    this._lines   = this._buildLines();
    this._lineIdx = 0;
    this._charQ   = [];   // characters to type out
    this._charTimer = null;

    this._bindMinimize();
    this._bindConsole();
    this._bindKeys();
    this._schedule(1000);
  }

  show() { document.getElementById('terminal-panel')?.classList.add('visible'); }
  hide() { document.getElementById('terminal-panel')?.classList.remove('visible'); }

  // ── LINE LIBRARY ──────────────────────────────────────────
  _buildLines() {
    return [
      { cls:'prompt', text:'./eagle_analyzer --deep target.exe' },
      { cls:'', text:'' },
      { cls:'ok',   text:'[+] Loading executable image...' },
      { cls:'ok',   text:'[+] Architecture detected: x86-64' },
      { cls:'ok',   text:'[+] File type: PE32+' },
      { cls:'ok',   text:'[+] Sections detected: 5' },
      { cls:'ok',   text:'[+] Entry point: 0x00401A30' },
      { cls:'',     text:'[*] Parsing PE headers...' },
      { cls:'ok',   text:'[+] DOS stub verified' },
      { cls:'ok',   text:'[+] NT signature: 0x00004550' },
      { cls:'ok',   text:'[+] Machine type: AMD64' },
      { cls:'',     text:'[*] Resolving imports...' },
      { cls:'ok',   text:'[+] KERNEL32.dll  →  4 functions' },
      { cls:'ok',   text:'[+] ntdll.dll     →  3 functions' },
      { cls:'ok',   text:'[+] USER32.dll    →  3 functions' },
      { cls:'ok',   text:'[+] ADVAPI32.dll  →  2 functions' },
      { cls:'',     text:'[*] Building control-flow graph...' },
      { cls:'ok',   text:'[+] 1,482 functions identified' },
      { cls:'ok',   text:'[+] 8,421 cross-references mapped' },
      { cls:'warn', text:'[!] Anti-debug pattern at 0x00402A10' },
      { cls:'warn', text:'[!] Obfuscated string at 0x00406B40' },
      { cls:'err',  text:'[!] Packed section detected: .data entropy 7.94' },
      { cls:'',     text:'[*] Entropy analysis...' },
      { cls:'ok',   text:'[+] .text  entropy: 5.82 — normal' },
      { cls:'warn', text:'[!] .data  entropy: 7.94 — suspicious' },
      { cls:'ok',   text:'[+] .rdata entropy: 4.33 — normal' },
      { cls:'',     text:'[*] Scanning for known signatures...' },
      { cls:'ok',   text:'[+] No known malware signatures' },
      { cls:'ok',   text:'[+] Anti-analysis techniques: 3 found' },
      { cls:'',     text:'' },
      { cls:'prompt', text:'strings target.exe | grep -i "license"' },
      { cls:'ok',   text:'"LICENSE_VALID"' },
      { cls:'ok',   text:'"check_license_key"' },
      { cls:'err',  text:'"INVALID_LICENSE — terminating process"' },
      { cls:'',     text:'' },
      { cls:'prompt', text:'objdump -d target.exe | grep -A5 "401120"' },
      { cls:'',     text:'  401120:  48 83 ec 28  sub    rsp,0x28' },
      { cls:'',     text:'  401124:  48 8b 01     mov    rax,[rcx]' },
      { cls:'',     text:'  401127:  33 d2        xor    edx,edx' },
      { cls:'',     text:'  401129:  f7 76 08     div    DWORD PTR [rsi+8]' },
      { cls:'comment', text:'  ; XOR decrypt loop — key at rcx' },
      { cls:'',     text:'' },
      { cls:'prompt', text:'eagle_analyzer --cfg --output graph.json' },
      { cls:'ok',   text:'[+] CFG exported: 1,482 nodes, 8,421 edges' },
      { cls:'ok',   text:'[+] Analysis complete. Report saved.' },
    ];
  }

  // ── SCHEDULE NEXT LINE ────────────────────────────────────
  _schedule(delay) {
    if (this._charTimer) return;
    this._charTimer = setTimeout(() => {
      this._charTimer = null;
      if (!this._paused) this._nextLine();
    }, delay);
  }

  _nextLine() {
    const line = this._lines[this._lineIdx % this._lines.length];
    this._lineIdx++;

    if (line.cls === 'prompt') {
      this._typeText(line);
    } else {
      this._appendLine(line.cls, line.text);
      const isGap  = line.text === '';
      const delay  = isGap ? 60 : 180 + Math.random()*280;
      this._schedule(delay);
    }

    // Pause between full cycles
    if (this._lineIdx % this._lines.length === 0) {
      this._paused = true;
      setTimeout(() => { this._paused = false; this._schedule(3000); }, 3500);
    }
  }

  _typeText(line) {
    const el = document.createElement('div');
    el.className = 'term-line prompt';
    this._output(el);

    let i = 0;
    const type = () => {
      if (i < line.text.length) {
        el.textContent = line.text.slice(0, ++i);
        setTimeout(type, 28 + Math.random()*22);
      } else {
        const delay = 400 + Math.random()*300;
        this._schedule(delay);
      }
    };
    setTimeout(type, 120);
  }

  _appendLine(cls, text) {
    const el = document.createElement('div');
    if (cls) el.className = 'term-line ' + cls;
    el.textContent = text;
    this._output(el);
  }

  _output(el) {
    if (!this._out) return;
    while (this._out.children.length > 90) this._out.removeChild(this._out.firstChild);
    const cursor = this._out.querySelector('.term-cursor');
    if (cursor) this._out.insertBefore(el, cursor);
    else this._out.appendChild(el);
    this._out.scrollTop = this._out.scrollHeight;
  }

  // ── MINIMIZE ─────────────────────────────────────────────
  _bindMinimize() {
    const btn  = document.querySelector('.term-minimize');
    const body = document.querySelector('.terminal-body');
    btn?.addEventListener('click', () => {
      const min = body?.style.display === 'none';
      if (body) body.style.display = min ? '' : 'none';
      if (btn)  btn.textContent    = min ? '[−]' : '[+]';
    });
  }

  // ── COMMAND CONSOLE ───────────────────────────────────────
  _bindConsole() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._open) this.closeConsole();
    });

    this._input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const cmd = this._input.value.trim();
        if (cmd) {
          this._history.unshift(cmd);
          this._histIdx = -1;
          this._exec(cmd);
          this._input.value = '';
        }
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        this._histIdx = Math.min(this._histIdx+1, this._history.length-1);
        if (this._history[this._histIdx]) this._input.value = this._history[this._histIdx];
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this._histIdx = Math.max(this._histIdx-1, -1);
        this._input.value = this._histIdx >= 0 ? this._history[this._histIdx]||'' : '';
      }
    });
  }

  _bindKeys() {
    window.addEventListener('keydown', e => {
      if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        this._open ? this.closeConsole() : this.openConsole();
      }
    });
  }

  openConsole() {
    this._open = true;
    this._console?.classList.add('open');
    setTimeout(() => this._input?.focus(), 60);
    this._print('<span class="cmd-accent">EAGLE CONSOLE v3 — type "help" for commands</span>');
  }

  closeConsole() {
    this._open = false;
    this._console?.classList.remove('open');
    this._input?.blur();
  }

  _exec(raw) {
    const [cmd, ...args] = raw.trim().toLowerCase().split(/\s+/);
    this._print(`<span class="cmd-accent">❯ ${raw}</span>`);

    const CMDS = {
      help: () => [
        '<span class="cmd-accent">Commands:</span>',
        '  <b>about</b>    — system identity',
        '  <b>skills</b>   — capability matrix',
        '  <b>projects</b> — project archive',
        '  <b>tools</b>    — toolchain',
        '  <b>analyze</b>  — run binary analysis',
        '  <b>matrix</b>   — toggle RE mode',
        '  <b>overdrive</b>— EAGLE OVERDRIVE',
        '  <b>whoami</b>   — identity',
        '  <b>clear</b>    — clear output',
        '  <b>version</b>  — system version',
        '  Press <b>/</b> or <b>Esc</b> to close',
      ].join('<br>'),

      about: () => [
        '<span class="cmd-accent">IDENTITY: EAGLE</span>',
        'Role    : Software Reverse Engineer',
        'Focus   : Binary Analysis · Windows Internals · Malware Research',
        'Arch    : x86-64 primary, ARM awareness',
        'Method  : Static + Dynamic · Dead-listing + Live debugging',
      ].join('<br>'),

      skills: () => [
        '<span class="cmd-accent">CAPABILITY MATRIX:</span>',
        '  <span style="color:#ff1744">[████████████]</span> Reverse Engineering     <b>100%</b>',
        '  <span style="color:#ff1744">[███████████░]</span> Binary Analysis          <b>95%</b>',
        '  <span style="color:#147eff">[██████████░░]</span> Windows Internals        <b>90%</b>',
        '  <span style="color:#147eff">[██████████░░]</span> Malware Analysis         <b>88%</b>',
        '  <span style="color:#00ff88">[█████████░░░]</span> Protocol Analysis        <b>82%</b>',
        '  <span style="color:#00ff88">[████████░░░░]</span> Kernel Debugging         <b>78%</b>',
        '  <span style="color:#ff1744">[████████████]</span> x86-64 Assembly         <b>98%</b>',
      ].join('<br>'),

      projects: () => [
        '<span class="cmd-accent">PROJECT ARCHIVE:</span>',
        '  <span style="color:#00ff88">●</span> <b>Advance Pixel Grid Mapper</b> — C++ · Win32 · GDI+',
        '  <span style="color:#00ff88">●</span> <b>Pulse</b>               — C · ETW · WMI',
        '  <span style="color:#ff9100">●</span> <b>StageFlow</b>           — Python · Graphviz',
        '  <span style="color:#00e5ff">●</span> <b>Chaser</b>              — C++ · PE Analysis',
        '  <span style="color:#00ff88">●</span> <b>PixelPerfectPro</b>     — C++ · Direct2D · COM',
      ].join('<br>'),

      tools: () => [
        '<span class="cmd-accent">TOOLCHAIN:</span>',
        '  Disasm : IDA Pro · Ghidra · Binary Ninja',
        '  Debug  : x64dbg · WinDbg · WinDbg Preview',
        '  Net    : Wireshark · Frida · mitmproxy',
        '  Lang   : C · C++ · Python · x86-64 ASM',
        '  IDE    : Visual Studio',
      ].join('<br>'),

      analyze: () => {
        setTimeout(() => window.dispatchEvent(new CustomEvent('eagle:analyze')), 300);
        this.closeConsole();
        return '<span class="cmd-ok">[+] Launching analysis sequence...</span>';
      },

      matrix: () => {
        window.dispatchEvent(new CustomEvent('eagle:remode'));
        return '<span class="cmd-ok">[+] RE mode toggled.</span>';
      },

      overdrive: () => {
        window.dispatchEvent(new CustomEvent('eagle:overdrive'));
        return '<span style="color:#ff1744">[!] OVERDRIVE ACTIVATED</span>';
      },

      whoami: () => '<span class="cmd-accent">eagle</span>@workstation — SOFTWARE REVERSE ENGINEER',

      version: () => 'EAGLE SYSTEM v3.0.0 · Three.js r160 · GSAP 3<br>Build: 2025 · github.com/S90x123',

      clear: () => { if (this._cmdOut) this._cmdOut.innerHTML = ''; return null; },
      exit:  () => { this.closeConsole(); return null; },
    };

    const fn = CMDS[cmd];
    if (fn) { const r = fn(); if (r) this._print(r); }
    else this._print(`<span class="cmd-err">Unknown command: ${cmd}. Type "help".</span>`);
  }

  _print(html) {
    if (!this._cmdOut) return;
    const el = document.createElement('div');
    el.innerHTML = html;
    this._cmdOut.appendChild(el);
    this._cmdOut.scrollTop = this._cmdOut.scrollHeight;
  }

  tick() { /* RAF not needed — self-scheduling via setTimeout */ }
}
