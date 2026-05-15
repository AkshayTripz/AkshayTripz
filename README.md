<div align="center">

<!-- ANIMATED BACKGROUND -->
<style>
  * {
    margin: 0;
    padding: 0;
  }

  body {
    background: #000;
    color: #fff;
    font-family: 'Courier New', monospace;
    overflow-x: hidden;
  }

  @keyframes glitchEffect {
    0% { transform: translate(0); }
    20% { transform: translate(-2px, 2px); }
    40% { transform: translate(-2px, -2px); }
    60% { transform: translate(2px, 2px); }
    80% { transform: translate(2px, -2px); }
    100% { transform: translate(0); }
  }

  @keyframes neonGlow {
    0%, 100% { text-shadow: 0 0 10px #FF0080, 0 0 20px #FF0080, 0 0 30px #FF0080; }
    50% { text-shadow: 0 0 20px #00ffff, 0 0 30px #00ffff, 0 0 40px #00ffff; }
  }

  @keyframes matrixFall {
    0% { transform: translateY(-100%); opacity: 1; }
    100% { transform: translateY(100vh); opacity: 0; }
  }

  @keyframes scanlines {
    0% { transform: translateY(0); }
    100% { transform: translateY(10px); }
  }

  @keyframes binaryPulse {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }

  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }

  @keyframes floatUp {
    0% { transform: translateY(30px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }

  @keyframes slideInRight {
    0% { transform: translateX(100px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }

  @keyframes slideInLeft {
    0% { transform: translateX(-100px); opacity: 0; }
    100% { transform: translateX(0); opacity: 1; }
  }

  @keyframes rotateReveal {
    0% { transform: rotateY(90deg); opacity: 0; }
    100% { transform: rotateY(0); opacity: 1; }
  }

  @keyframes colorShift {
    0% { color: #FF0080; }
    25% { color: #00ffff; }
    50% { color: #FF00FF; }
    75% { color: #00ff00; }
    100% { color: #FF0080; }
  }

  .main-container {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #000 0%, #0a0a0a 50%, #000 100%);
  }

  .matrix-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0.03;
    z-index: -1;
    font-size: 14px;
    color: #0f0;
    overflow: hidden;
    pointer-events: none;
  }

  .scanline-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: repeating-linear-gradient(
      0deg,
      rgba(255, 0, 128, 0.03),
      rgba(255, 0, 128, 0.03) 2px,
      transparent 2px,
      transparent 4px
    );
    pointer-events: none;
    z-index: 999;
    animation: scanlines 8s linear infinite;
  }

  .main-title {
    font-size: 4rem;
    font-weight: 900;
    background: linear-gradient(135deg, #FF0080, #00ffff, #FF00FF, #00ff00);
    background-size: 200% 200%;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: colorShift 4s ease infinite, glitchEffect 0.2s infinite, neonGlow 3s ease-in-out infinite;
    margin: 40px 0;
    letter-spacing: 8px;
    text-transform: uppercase;
    filter: drop-shadow(0 0 20px rgba(255, 0, 128, 0.5));
  }

  .subtitle {
    font-size: 1.5rem;
    color: #00ffff;
    animation: floatUp 1.5s ease-out;
    text-shadow: 0 0 10px #00ffff, 0 0 20px #FF0080;
    margin: 20px 0;
    letter-spacing: 3px;
  }

  .tagline {
    font-size: 1.2rem;
    color: #FF0080;
    animation: slideInRight 1.5s ease-out;
    margin: 15px 0;
    font-weight: bold;
  }

  .divider {
    width: 80%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #FF0080, #00ffff, transparent);
    margin: 30px auto;
    animation: shimmer 3s infinite;
    box-shadow: 0 0 20px #FF0080;
  }

  .section {
    margin: 50px auto;
    max-width: 1000px;
    animation: floatUp 1.5s ease-out;
  }

  .section-title {
    font-size: 2rem;
    color: #00ffff;
    margin-bottom: 25px;
    border-bottom: 3px solid #FF0080;
    padding-bottom: 15px;
    text-shadow: 0 0 10px #00ffff;
    animation: slideInLeft 1s ease-out;
  }

  .box {
    background: rgba(255, 0, 128, 0.1);
    border: 2px solid #FF0080;
    border-radius: 10px;
    padding: 20px;
    margin: 15px 0;
    animation: floatUp 1.5s ease-out;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .box::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(45deg, transparent, rgba(0, 255, 255, 0.3), transparent);
    animation: shimmer 3s infinite;
  }

  .box:hover {
    transform: translateY(-10px) scale(1.02);
    border-color: #00ffff;
    box-shadow: 0 0 30px #FF0080, inset 0 0 30px rgba(0, 255, 255, 0.1);
  }

  .box-title {
    color: #00ffff;
    font-size: 1.3rem;
    margin-bottom: 12px;
    font-weight: bold;
    text-shadow: 0 0 8px #00ffff;
  }

  .box-content {
    color: #ccc;
    line-height: 1.8;
    font-size: 0.95rem;
  }

  .language-item {
    display: inline-block;
    background: linear-gradient(135deg, #FF0080, #FF00FF);
    color: white;
    padding: 10px 20px;
    margin: 8px 5px;
    border-radius: 25px;
    animation: binaryPulse 2s ease-in-out infinite;
    font-weight: bold;
    box-shadow: 0 0 15px rgba(255, 0, 128, 0.6);
    transition: all 0.3s ease;
    position: relative;
  }

  .language-item:hover {
    transform: scale(1.1) translateY(-5px);
    box-shadow: 0 0 25px rgba(0, 255, 255, 0.8), 0 0 15px rgba(255, 0, 128, 0.8);
    background: linear-gradient(135deg, #00ffff, #00ff00);
  }

  .tool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
    margin: 25px 0;
  }

  .tool-card {
    background: rgba(0, 255, 255, 0.05);
    border: 2px solid #00ffff;
    border-radius: 8px;
    padding: 15px;
    text-align: center;
    animation: floatUp 1.5s ease-out;
    transition: all 0.3s ease;
    position: relative;
  }

  .tool-card:hover {
    transform: translateY(-15px) rotate(2deg);
    border-color: #FF0080;
    box-shadow: 0 0 25px #FF0080, 0 0 15px #00ffff;
    background: rgba(255, 0, 128, 0.1);
  }

  .tool-name {
    color: #00ffff;
    font-weight: bold;
    margin-bottom: 8px;
    text-shadow: 0 0 5px #00ffff;
  }

  .tool-desc {
    color: #aaa;
    font-size: 0.85rem;
  }

  .binary-text {
    color: #FF0080;
    opacity: 0.5;
    font-size: 0.8rem;
    font-weight: bold;
    animation: binaryPulse 3s ease-in-out infinite;
  }

  .footer {
    margin-top: 60px;
    padding: 30px;
    text-align: center;
    border-top: 2px solid #FF0080;
    animation: floatUp 2s ease-out;
  }

  .footer-text {
    color: #00ffff;
    font-size: 1.1rem;
    margin: 10px 0;
    text-shadow: 0 0 8px #FF0080;
  }

  .social-links {
    margin: 25px 0;
  }

  .social-badge {
    display: inline-block;
    background: linear-gradient(135deg, #FF0080, #00ffff);
    color: white;
    padding: 12px 25px;
    margin: 10px;
    border-radius: 30px;
    text-decoration: none;
    font-weight: bold;
    transition: all 0.3s ease;
    animation: floatUp 1.5s ease-out;
    box-shadow: 0 0 15px rgba(255, 0, 128, 0.5);
  }

  .social-badge:hover {
    transform: scale(1.15) translateY(-5px);
    box-shadow: 0 0 30px #FF0080, 0 0 20px #00ffff;
  }

  .stats-bar {
    display: flex;
    justify-content: space-around;
    flex-wrap: wrap;
    margin: 40px 0;
    gap: 20px;
  }

  .stat-item {
    text-align: center;
    animation: floatUp 1.5s ease-out;
  }

  .stat-number {
    font-size: 2.5rem;
    color: #FF0080;
    font-weight: bold;
    text-shadow: 0 0 10px #FF0080;
    animation: neonGlow 3s ease-in-out infinite;
  }

  .stat-label {
    color: #00ffff;
    font-size: 1rem;
    margin-top: 10px;
    text-shadow: 0 0 5px #00ffff;
  }

  @media (max-width: 768px) {
    .main-title {
      font-size: 2.5rem;
    }
    .subtitle {
      font-size: 1.2rem;
    }
    .tool-grid {
      grid-template-columns: 1fr;
    }
  }
</style>

<!-- MATRIX BACKGROUND EFFECT -->
<div class="matrix-bg" id="matrixBg"></div>
<div class="scanline-overlay"></div>

<div class="main-container">

  <!-- MAIN TITLE -->
  <div style="padding: 20px;">
    <h1 class="main-title">AKSHAY TRIPZ</h1>
    <p class="subtitle">[ REVERSE ENGINEER ]</p>
    <p class="tagline">Binary Archaeologist • Deobfuscation Expert • Security Researcher</p>
  </div>

  <div class="divider"></div>

  <!-- STATS -->
  <div class="stats-bar">
    <div class="stat-item">
      <div class="stat-number">100+</div>
      <div class="stat-label">Tools Mastered</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">15+</div>
      <div class="stat-label">Languages</div>
    </div>
    <div class="stat-item">
      <div class="stat-number">5</div>
      <div class="stat-label">Architectures</div>
    </div>
  </div>

  <div class="divider"></div>

  <!-- ABOUT SECTION -->
  <div class="section">
    <h2 class="section-title">⚡ WHO I AM</h2>
    <div class="box">
      <div class="box-content">
        A dedicated Reverse Engineer specializing in <span style="color: #FF0080; font-weight: bold;">binary analysis</span>, 
        <span style="color: #FF0080; font-weight: bold;">malware research</span>, and <span style="color: #FF0080; font-weight: bold;">vulnerability discovery</span>. 
        I dissect binaries, break obfuscation, and uncover hidden vulnerabilities through advanced static and dynamic analysis techniques.
      </div>
    </div>
  </div>

  <!-- LANGUAGES SECTION -->
  <div class="section">
    <h2 class="section-title">💻 PROGRAMMING LANGUAGES</h2>
    
    <div class="box">
      <div class="box-title">Primary Languages</div>
      <div class="box-content">
        <div style="margin: 15px 0;">
          <span class="language-item">x86/x86-64 Assembly</span>
          <span class="language-item">Python</span>
          <span class="language-item">C/C++</span>
          <span class="language-item">Java</span>
          <span class="language-item">C#</span>
        </div>
      </div>
    </div>

    <div class="box">
      <div class="box-title">Secondary Languages</div>
      <div class="box-content">
        <div style="margin: 15px 0;">
          <span class="language-item">ARM Assembly</span>
          <span class="language-item">MIPS Assembly</span>
          <span class="language-item">PowerPC Assembly</span>
          <span class="language-item">JavaScript</span>
          <span class="language-item">Go</span>
          <span class="language-item">Rust</span>
          <span class="language-item">Bash/Shell</span>
          <span class="language-item">PowerShell</span>
        </div>
      </div>
    </div>

    <div class="box">
      <div class="box-title">Binary Formats & Architectures</div>
      <div class="box-content">
        <div style="margin: 15px 0;">
          <span class="language-item">PE (Windows)</span>
          <span class="language-item">ELF (Linux)</span>
          <span class="language-item">Mach-O (macOS)</span>
          <span class="language-item">DEX (Android)</span>
          <span class="language-item">WebAssembly</span>
        </div>
      </div>
    </div>
  </div>

  <!-- TOOLS SECTION -->
  <div class="section">
    <h2 class="section-title">🛠️ REVERSE ENGINEERING TOOLS</h2>

    <div class="box">
      <div class="box-title">Static Analysis & Disassembly</div>
      <div class="tool-grid">
        <div class="tool-card">
          <div class="tool-name">IDA Pro</div>
          <div class="tool-desc">Advanced disassembly & decompilation</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Ghidra</div>
          <div class="tool-desc">NSA reverse engineering framework</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Radare2</div>
          <div class="tool-desc">Portable & scriptable analysis</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Binary Ninja</div>
          <div class="tool-desc">Professional binary analysis</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Hopper</div>
          <div class="tool-desc">macOS/Linux disassembler</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Cutter</div>
          <div class="tool-desc">GUI for Radare2</div>
        </div>
      </div>
    </div>

    <div class="box">
      <div class="box-title">Dynamic Analysis & Debugging</div>
      <div class="tool-grid">
        <div class="tool-card">
          <div class="tool-name">x64dbg</div>
          <div class="tool-desc">Windows x64 debugger</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">WinDbg</div>
          <div class="tool-desc">Windows kernel debugger</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">GDB</div>
          <div class="tool-desc">GNU debugger</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Frida</div>
          <div class="tool-desc">Dynamic instrumentation</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">LLDB</div>
          <div class="tool-desc">LLVM debugger</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">DynamoRIO</div>
          <div class="tool-desc">Binary instrumentation</div>
        </div>
      </div>
    </div>

    <div class="box">
      <div class="box-title">Malware & Security Analysis</div>
      <div class="tool-grid">
        <div class="tool-card">
          <div class="tool-name">Wireshark</div>
          <div class="tool-desc">Network analysis</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Volatility</div>
          <div class="tool-desc">Memory forensics</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Yara</div>
          <div class="tool-desc">Malware detection</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">VirusTotal</div>
          <div class="tool-desc">Multi-scanner service</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Any.run</div>
          <div class="tool-desc">Interactive sandbox</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">ClamAV</div>
          <div class="tool-desc">Antivirus engine</div>
        </div>
      </div>
    </div>

    <div class="box">
      <div class="box-title">Scripting & Automation</div>
      <div class="tool-grid">
        <div class="tool-card">
          <div class="tool-name">IDAPython</div>
          <div class="tool-desc">IDA automation</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">PWNTOOLS</div>
          <div class="tool-desc">Exploit development</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Keystone</div>
          <div class="tool-desc">Assembler engine</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Unicorn</div>
          <div class="tool-desc">Emulation engine</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">Triton</div>
          <div class="tool-desc">Symbolic execution</div>
        </div>
        <div class="tool-card">
          <div class="tool-name">AFL/LibFuzzer</div>
          <div class="tool-desc">Fuzzing framework</div>
        </div>
      </div>
    </div>
  </div>

  <!-- EXPERTISE SECTION -->
  <div class="section">
    <h2 class="section-title">🔬 AREAS OF EXPERTISE</h2>

    <div class="box">
      <div class="box-title">✓ Binary Analysis & Disassembly</div>
      <div class="box-content">
        Static disassembly • Control Flow Analysis • Function Identification • 
        Data Flow Mapping • String Analysis • Import Resolution
      </div>
    </div>

    <div class="box">
      <div class="box-title">✓ Dynamic Analysis & Debugging</div>
      <div class="box-content">
        Runtime Monitoring • Breakpoint Debugging • Memory Inspection • 
        Register Analysis • Hooking & Instrumentation • API Tracing
      </div>
    </div>

    <div class="box">
      <div class="box-title">✓ Vulnerability Research</div>
      <div class="box-content">
        Buffer Overflow Detection • Use-After-Free Analysis • Integer Overflow • 
        Logic Error Discovery • Privilege Escalation • CVE Research
      </div>
    </div>

    <div class="box">
      <div class="box-title">✓ Malware Analysis</div>
      <div class="box-content">
        Behavioral Analysis • Signature Detection • Packing/Unpacking • 
        Memory Forensics • Network Analysis • IOC Extraction
      </div>
    </div>

    <div class="box">
      <div class="box-title">✓ Protection Bypass</div>
      <div class="box-content">
        Code Virtualization Reversal • Anti-Debugging Defeat • Control Flow Flattening • 
        String Decryption • Anti-VM Evasion • Tamper Detection Bypass
      </div>
    </div>

    <div class="box">
      <div class="box-title">✓ Architecture Knowledge</div>
      <div class="box-content">
        x86/x86-64 • ARM (v7/v8) • MIPS/MIPS64 • PowerPC • 
        SPARC • AVR • RISC-V • WebAssembly
      </div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p class="footer-text">⚡ Security Through Deep Understanding ⚡</p>
    
    <div class="social-links">
      <a href="https://github.com/AkshayTripz" class="social-badge">🔗 GitHub</a>
      <a href="https://linkedin.com" class="social-badge">💼 LinkedIn</a>
      <a href="https://twitter.com" class="social-badge">🐦 Twitter</a>
    </div>

    <p class="footer-text">Reverse Engineering • Binary Analysis • Security Research</p>
    <p style="color: #666; font-size: 0.9rem; margin-top: 20px;">
      Last Updated: May 15, 2026 | Active & Learning
    </p>
  </div>

</div>

<script>
  // Matrix background animation
  const matrixBg = document.getElementById('matrixBg');
  const chars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
  
  for (let i = 0; i < 50; i++) {
    const span = document.createElement('div');
    span.textContent = chars[Math.floor(Math.random() * chars.length)];
    span.style.position = 'absolute';
    span.style.left = Math.random() * 100 + '%';
    span.style.top = Math.random() * 100 + '%';
    span.style.opacity = Math.random() * 0.5;
    span.style.animation = `matrixFall ${5 + Math.random() * 10}s linear infinite`;
    span.style.animationDelay = Math.random() * 5 + 's';
    matrixBg.appendChild(span);
  }
</script>

</div>