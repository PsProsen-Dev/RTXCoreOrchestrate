/**
 * RTX-BaseAdapter — Real child_process.spawn() with Windows PowerShell Support
 *
 * Team Discussion Final Decision:
 * - Antigravity 2.0 (RTX⚡): Full spawn() implementation, Windows shell flag,
 *                             UTF-8 encoding, 30s timeout, non-interactive flags
 * - Antigravity IDE (RTX⚡): CLI health check in separate health-check.js (SRP)
 * - Ultron (RTX⚡):          Syntax validity check on output before returning
 *
 * RTXCoreFramework Section 8.4 — Execution & Coordination
 * TRINITY Role: <role_worker> — this is where actual execution happens
 */

const { spawn } = require('child_process');

const TIMEOUT_MS = 30000; // 30 seconds — Antigravity 2.0's requirement

class BaseAdapter {
  constructor(id, config) {
    this.id   = id;
    this.cmd  = config.cmd;
    this.capabilities = config.capabilities;
    this.timeoutMs    = config.timeoutMs || TIMEOUT_MS;
    this.mockMode     = config.mockMode || false; // Set by health-check.js fallback
  }

  // ─── ROLE: <role_worker> — Core Execution Method ──────────────────────────

  async run(input, ctx = {}) {
    // If health-check detected CLI missing → graceful mock fallback
    if (this.mockMode) {
      return this._mockRun(input);
    }

    const args = this.buildArgs(input);
    const workspace = ctx.workspace || process.cwd();

    console.log(`   ⚙️  [${this.id.toUpperCase()}] <role_worker> Spawning: ${this.cmd} ${args.join(' ')}`);

    return new Promise((resolve, reject) => {
      const isWindows = process.platform === 'win32';

      // Antigravity 2.0: Windows PowerShell shell option for binary resolution
      const spawnOptions = {
        cwd: ctx.workspace || process.cwd(),
        env: {
          ...process.env,
          // Force UTF-8 to prevent Windows OEM encoding corruption
          PYTHONIOENCODING: 'utf-8',
          LANG: 'en_US.UTF-8',
          // Ensure non-interactive mode — no stdin blocking
          CI: 'true',
        },
        // Windows: use powershell shell for .cmd/.exe resolution
        // Linux/Mac: no shell needed (direct binary)
        shell: isWindows ? 'powershell.exe' : false,
        // Never open stdin — prevents process from hanging waiting for input
        stdio: ['ignore', 'pipe', 'pipe'],
      };

      const proc = spawn(this.cmd, args, spawnOptions);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (chunk) => { stdout += chunk.toString('utf8'); });
      proc.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });

      // Antigravity 2.0: 30s timeout — kill hung processes
      const timeoutHandle = setTimeout(() => {
        proc.kill('SIGTERM');
        console.error(`   ⏱️  [${this.id.toUpperCase()}] TIMEOUT after ${this.timeoutMs / 1000}s — process killed`);
        reject({
          code: -2,
          out: stdout.trim(),
          err: `TIMEOUT: Process exceeded ${this.timeoutMs / 1000}s limit.`,
          timedOut: true,
        });
      }, this.timeoutMs);

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        const out = stdout.trim();
        const err = stderr.trim();

        if (code !== 0) {
          console.warn(`   ⚠️  [${this.id.toUpperCase()}] Exited with code ${code}`);
          if (err) console.warn(`   stderr: ${err.substring(0, 200)}`);
        }

        resolve({ code, out, err });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutHandle);
        // Antigravity IDE: ENOENT = binary not found → suggest health-check
        if (error.code === 'ENOENT') {
          console.error(`   ❌ [${this.id.toUpperCase()}] Binary not found: "${this.cmd}"`);
          console.error(`   💡 Run: node scripts/health-check.js to diagnose CLI availability`);
        }
        reject({ code: -1, out: stdout.trim(), err: error.message });
      });
    });
  }

  // ─── ROLE: <role_synthesizer> — Mock Fallback ─────────────────────────────

  /**
   * Graceful mock fallback when CLI binary is unavailable.
   * Activated by health-check.js detecting missing binary.
   */
  _mockRun(input) {
    const mockOutput = `[MOCK] ${this.id} executed: ${input.action || input.details || 'task'}`;
    console.log(`   🧪 [${this.id.toUpperCase()}] Running in MOCK MODE (CLI binary unavailable)`);
    console.log(`   📤 Mock output: ${mockOutput}`);
    return Promise.resolve({ code: 0, out: mockOutput, err: '', mock: true });
  }

  // ─── Override in subclasses ────────────────────────────────────────────────

  buildArgs(input) {
    return [input.action || ''];
  }
}

module.exports = BaseAdapter;
