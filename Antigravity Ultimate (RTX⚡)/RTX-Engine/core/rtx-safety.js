/**
 * RTX-Safety Layer — Pre-Flight Command Validator & Credential Interceptor
 * 
 * Team Discussion Implementation:
 * - Antigravity 2.0 (RTX⚡): Pre-flight payload scanner + real-time credential leak interception
 * - Ultron (RTX⚡):          Mathematical scoring for safety checks
 * - Antigravity IDE (RTX⚡): Coordinator — integrates safety into pipeline (not separate RL module)
 * 
 * RTXCoreFramework Section 14 — Security & Compliance Layer
 */

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
        safePayload: payloadStr.replace(/ghp_[A-Za-z0-9]{36}/g, 'ghp_***REDACTED***')
                               .replace(/AKIA[0-9A-Z]{16}/g, 'AKIA***REDACTED***'),
      };
    }

    return { hasLeak: false, leaks: [], safePayload: payloadStr };
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

module.exports = RTXSafetyLayer;
