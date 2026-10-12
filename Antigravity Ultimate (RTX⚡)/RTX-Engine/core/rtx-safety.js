/**
 * RTX-Safety Layer — Pre-Flight Command Validator & Credential Interceptor
 *
 * Team Discussion Implementation:
 * - Antigravity 2.0 (RTX⚡): Pre-flight payload scanner + real-time credential leak interception
 * - Ultron (RTX⚡):          Mathematical scoring for safety checks
 * - Antigravity IDE (RTX⚡): Coordinator — integrates safety into pipeline (not separate RL module)
 *
 * RTXCoreFramework Section 14 — Security & Compliance Layer
 *
 * TRIPWIRE SEMANTICS (OpenAI Agents SDK pattern, Oct 2026):
 * Safety is NOT a pipeline step that can be skipped — it is a pre/post
 * INTERCEPTOR wrapped around EVERY adapter call (see wrapAdapter /
 * GuardedAdapter below). A tripped guardrail HALTS the run immediately via
 * SafetyTripwireError; there is no "skip step and continue".
 */

class SafetyTripwireError extends Error {
  /**
   * @param {'pre-call'|'post-call'} phase  which interceptor tripped
   * @param {string} adapterId              the adapter whose call tripped
   * @param {string} reason                 human-readable cause
   * @param {string[]} [patterns]           matched patterns (redacted where secret-like)
   */
  constructor(phase, adapterId, reason, patterns = []) {
    super(`[RTX-Safety] 🛑 TRIPWIRE (${phase}) on [${adapterId}]: ${reason}`);
    this.name = 'SafetyTripwireError';
    this.phase = phase;
    this.adapterId = adapterId;
    this.reason = reason;
    this.patterns = patterns;
    this.trippedAt = new Date().toISOString();
  }
}

class RTXSafetyLayer {

  // ─── PATTERN REGISTRY ────────────────────────────────────────────────────────

  static DESTRUCTIVE_PATTERNS = [
    // ── Filesystem Attacks ──
    'rm -rf', 'del /s /q', 'format c:', 'rmdir /s',
    'remove-item -recurse -force /',
    // ── Permission Escalation ──
    'chmod 777', 'icacls * /grant everyone:f',
    // ── Network / Reverse Shell Exploits ──
    'nc -e', 'bash -i', '/dev/tcp/', 'ncat --exec',
    'curl | bash', 'wget -o- | sh',
    // ── DB Nukes ──
    'drop table', 'drop database', 'truncate table',
    // ── Git Force Destruction ──
    'git push --force origin main', 'git push -f origin master',
    // ── Windows PowerShell Bypass (Antigravity 2.0 contribution) ──
    '-executionpolicy bypass', '-ep bypass', '-exc byp',
    '-noprofile', '-nop',
    '-encodedcommand', '-enc ',
    'powershell -w hidden', 'powershell -windowstyle hidden',
    // ── Registry Manipulation ──
    'reg add', 'reg delete', 'reg save',
    'set-itemproperty', 'remove-itemproperty', 'new-itemproperty',
    'hklm:', 'hkcu:', 'hkcr:', 'registry::',
    // ── WMI / CIM Attacks ──
    'wmic process call create', 'get-wmiobject', 'get-ciminstance',
    'invoke-cimmethod', 'invoke-wmimethod',
    // ── Environment Variable Injection ──
    '$env:appdata', '$env:temp', '$env:comspec',
    '[environment]::', '[system.io.path]::',
    // ── Silent Network Downloads ──
    'invoke-webrequest', 'invoke-restmethod',
    'net.webclient', '.downloadfile(', '.downloadstring(',
    'start-bitstransfer',
    // ── System Kill Commands ──
    'stop-process -force', 'kill -9', 'taskkill /f',
    'shutdown /s /t 0', 'shutdown /r /t 0',
  ];

  static CREDENTIAL_PATTERNS = [
    // AWS
    /AKIA[0-9A-Z]{16}/,
    /aws_secret_access_key\s*=\s*[A-Za-z0-9+/]{40}/i,
    // GitHub PAT
    /ghp_[A-Za-z0-9]{36}/,
    /github_token\s*=\s*[A-Za-z0-9_]+/i,
    // SSH Private Key
    /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/,
    // Generic secrets
    /secret[_-]?key\s*[:=]\s*[A-Za-z0-9+/]{20,}/i,
    /api[_-]?key\s*[:=]\s*[A-Za-z0-9+/]{20,}/i,
    /password\s*[:=]\s*[^\s]{8,}/i,
  ];

  // ─── ROLE: <role_verifier> — Destructive Command Scanner ─────────────────────

  /**
   * Scans a step/command object for destructive shell payloads.
   * Returns { isSafe, reason, riskScore }
   */
  static checkCommand(actionDetails) {
    const commandStr = JSON.stringify(actionDetails).toLowerCase();
    let riskScore = 0;
    const flagged = [];

    for (const pattern of RTXSafetyLayer.DESTRUCTIVE_PATTERNS) {
      if (commandStr.includes(pattern.toLowerCase())) {
        riskScore += 100;
        flagged.push(pattern);
      }
    }

    if (flagged.length > 0) {
      console.warn(`[🛡️ RTX-Safety] ⛔ BLOCKED: Destructive pattern(s) detected → [${flagged.join(', ')}]`);
      console.warn(`[🛡️ RTX-Safety] Risk Score: ${riskScore}/100`);
      return {
        isSafe: false,
        riskScore,
        reason: `Destructive pattern matched: ${flagged.join(', ')}`,
      };
    }

    return { isSafe: true, riskScore: 0, reason: 'Clean — no destructive patterns found.' };
  }

  // ─── ROLE: <role_verifier> — Credential Leak Interceptor ─────────────────────

  /**
   * Antigravity 2.0 contribution: Real-time credential leak detection.
   * Scans CLI arguments, prompt strings, or file contents before they are
   * passed to external adapters (ClaudeAdapter, GhAdapter, etc.)
   */
  static checkForCredentialLeaks(payload) {
    const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const leaks = [];

    for (const regex of RTXSafetyLayer.CREDENTIAL_PATTERNS) {
      const match = payloadStr.match(regex);
      if (match) {
        leaks.push(match[0].substring(0, 8) + '***REDACTED***');
      }
    }

    if (leaks.length > 0) {
      console.error(`[🛡️ RTX-Safety] 🚨 CREDENTIAL LEAK DETECTED! Blocking transmission.`);
      console.error(`[🛡️ RTX-Safety] Leaked pattern(s): ${leaks.join(', ')}`);
      return {
        hasLeak: true,
        leaks,
        safePayload: RTXSafetyLayer.redactCredentials(payloadStr),
      };
    }

    return { hasLeak: false, leaks: [], safePayload: payloadStr };
  }

  // ─── Credential Redaction (all patterns, not just 2/8) ─────────────────────

  /**
   * Redacts every known credential pattern in a string. The old implementation
   * only redacted two key shapes — detected-but-unredacted secrets are a leak.
   */
  static redactCredentials(text) {
    let out = String(text);
    for (const regex of RTXSafetyLayer.CREDENTIAL_PATTERNS) {
      // Rebuild as global; replace the whole match — never echo secret material.
      const flags = regex.flags.includes('g') ? regex.flags : regex.flags + 'g';
      const global = new RegExp(regex.source, flags);
      out = out.replace(global, '[REDACTED]');
    }
    return out;
  }

  // ─── High-confidence credential shapes (for OUTPUT tripwire) ────────────────
  // postCallCheck HALTS the run, so it only trips on key-shaped material —
  // never on prose *about* passwords (which would be a false-positive halt).
  // preCallCheck (outbound) stays broad: secrets must never LEAVE.
  static STRICT_CREDENTIAL_PATTERNS = [
    /AKIA[0-9A-Z]{16}/,
    /aws_secret_access_key\s*=\s*[A-Za-z0-9+/]{40}/i,
    /ghp_[A-Za-z0-9]{36}/,
    /gho_[A-Za-z0-9]{36}/,
    /github_token\s*=\s*[A-Za-z0-9_]+/i,
    /-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----/,
  ];

  static _hasStrictCredentialLeak(text) {
    const leaks = [];
    for (const regex of RTXSafetyLayer.STRICT_CREDENTIAL_PATTERNS) {
      const match = text.match(regex);
      if (match) leaks.push(match[0].substring(0, 8) + '***REDACTED***');
    }
    return leaks;
  }

  // ─── TRIPWIRE INTERCEPTORS — wrap EVERY adapter call ───────────────────────
  // OpenAI Agents SDK pattern: input guardrail + output guardrail as
  // interceptors, not pipeline stages. Trip = immediate halt (throw), never
  // a soft skip. The conductor wraps all adapters via wrapAdapter().

  /**
   * Input guardrail — runs BEFORE the adapter executes.
   * Trips (throws SafetyTripwireError) on:
   *   - destructive command patterns in the input (RCE / wiper / exfil)
   *   - credential-shaped material about to leave toward an external CLI
   * @throws {SafetyTripwireError} on trip — caller must halt, not continue.
   */
  static preCallCheck(adapterId, input) {
    const cmdCheck = RTXSafetyLayer.checkCommand(input);
    if (!cmdCheck.isSafe) {
      throw new SafetyTripwireError('pre-call', adapterId,
        `destructive pattern blocked before execution: ${cmdCheck.reason}`,
        [cmdCheck.reason]);
    }
    const leakCheck = RTXSafetyLayer.checkForCredentialLeaks(input);
    if (leakCheck.hasLeak) {
      throw new SafetyTripwireError('pre-call', adapterId,
        `credential-shaped material blocked from leaving toward external CLI: ${leakCheck.leaks.join(', ')}`,
        leakCheck.leaks);
    }
    return { ok: true, adapterId };
  }

  /**
   * Output guardrail — runs AFTER the adapter returns, BEFORE the output
   * is logged, persisted, or fed to the next step.
   * Trips (throws SafetyTripwireError) on destructive patterns or
   * HIGH-CONFIDENCE credential material in worker output. Prose *about*
   * passwords does not trip (see STRICT_CREDENTIAL_PATTERNS).
   * @throws {SafetyTripwireError} on trip — caller must halt, not continue.
   */
  static postCallCheck(adapterId, output) {
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    const cmdCheck = RTXSafetyLayer.checkCommand(text);
    if (!cmdCheck.isSafe) {
      throw new SafetyTripwireError('post-call', adapterId,
        `destructive pattern in worker output — quarantined: ${cmdCheck.reason}`,
        [cmdCheck.reason]);
    }
    const strictLeaks = RTXSafetyLayer._hasStrictCredentialLeak(text);
    if (strictLeaks.length > 0) {
      throw new SafetyTripwireError('post-call', adapterId,
        `credential leak in worker output — quarantined: ${strictLeaks.join(', ')}`,
        strictLeaks);
    }
    return { ok: true, adapterId };
  }

  /**
   * Wraps an adapter instance so EVERY .run() call is guarded by the
   * pre/post tripwire interceptors (Microsoft Agent Framework
   * "middleware-as-safety" pattern — safety lives around the call, not in
   * the pipeline). Returns a GuardedAdapter; the inner adapter is untouched.
   */
  static wrapAdapter(adapter) {
    return new GuardedAdapter(adapter);
  }

  // ─── ROLE: <role_verifier> — Session State Lock ───────────────────────────────

  /**
   * Antigravity 2.0 contribution: State locking when subprocess fails.
   * Prevents session cache corruption during parallel branch failures.
   */
  static lockSessionState(sessionId, reason) {
    console.warn(`[🛡️ RTX-Safety] 🔒 Locking session [${sessionId}] — Reason: ${reason}`);
    return {
      locked: true,
      sessionId,
      lockedAt: new Date().toISOString(),
      reason,
    };
  }

  // ─── ROLE: <role_synthesizer> — Safety Report ─────────────────────────────────

  /**
   * Generates a human-readable safety audit summary for a pipeline run.
   */
  static generateAuditReport(checks) {
    const passed = checks.filter(c => c.isSafe !== false && c.hasLeak !== true).length;
    const failed = checks.length - passed;

    console.log(`\n🛡️  [RTX-Safety Audit Report]`);
    console.log(`   Total Checks : ${checks.length}`);
    console.log(`   ✅ Passed    : ${passed}`);
    console.log(`   ❌ Blocked   : ${failed}`);

    return { total: checks.length, passed, failed };
  }
}

/**
 * GuardedAdapter — composition wrapper (not inheritance): every .run() call
 * passes through RTXSafetyLayer.preCallCheck → inner.run →
 * RTXSafetyLayer.postCallCheck. A tripped guardrail throws
 * SafetyTripwireError and the run HALTS — the output never reaches logs,
 * sessions, or the next pipeline step.
 */
class GuardedAdapter {
  constructor(adapter) {
    if (!adapter || typeof adapter.run !== 'function') {
      throw new Error('[RTX-Safety] wrapAdapter requires an adapter with a .run() method.');
    }
    this.inner = adapter;
    this.id = `${adapter.id}:guarded`;
    this.wrappedId = adapter.id;
  }

  // Forward the knobs callers legitimately touch.
  get mockMode() { return this.inner.mockMode; }
  set mockMode(v) { this.inner.mockMode = v; }
  get timeoutMs() { return this.inner.timeoutMs; }
  get cmd() { return this.inner.cmd; }
  get capabilities() { return this.inner.capabilities; }

  async run(input, ctx = {}) {
    RTXSafetyLayer.preCallCheck(this.wrappedId, input);
    const result = await this.inner.run(input, ctx);
    const outText = (result && typeof result === 'object' && 'out' in result) ? result.out : result;
    RTXSafetyLayer.postCallCheck(this.wrappedId, outText);
    return result;
  }
}

module.exports = RTXSafetyLayer;
module.exports.SafetyTripwireError = SafetyTripwireError;
module.exports.GuardedAdapter = GuardedAdapter;
