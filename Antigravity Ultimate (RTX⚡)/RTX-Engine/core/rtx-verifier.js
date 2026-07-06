/**
 * RTX-Verifier — Quality Auditor & Branch Scoring Engine
 * 
 * Team Discussion Implementation:
 * - Ultron (RTX⚡):          Mathematical scoring — syntax validity, complexity, credential checks
 * - Antigravity IDE (RTX⚡): TRINITY <role_verifier> tag integration
 * - Antigravity 2.0 (RTX⚡): BranchNode comparative scoring matrices
 * 
 * RTXCoreFramework Section 6 — Precision & Code Review Protocol
 * TRINITY Role: <role_verifier> — Quality Auditor
 */

const RTXSafetyLayer = require('./rtx-safety');

class RTXVerifier {

  // ─── ROLE: <role_verifier> — Single Output Audit ─────────────────────────────

  /**
   * Verifies the output of a single pipeline step.
   * Implements Ultron's suggestion: mathematical scoring instead of simple string flags.
   * Returns { passed, score, feedback }
   */
  static async verify(step, output) {
    console.log(`\n🔍 [RTX-Verifier] <role_verifier> Auditing step [${step.tool}] → action: [${step.action}]`);

    const score = RTXVerifier._scoreOutput(output, step);
    console.log(`   📊 Quality Score: ${score.total}/100`);

    // Credential leak check (Antigravity 2.0 integration)
    const credCheck = RTXSafetyLayer.checkForCredentialLeaks(output);
    if (credCheck.hasLeak) {
      console.error(`   🚨 Credential leak detected in output! Auto-failing step.`);
      return {
        passed: false,
        score: 0,
        feedback: `CREDENTIAL LEAK in output — blocked by RTX-Safety. Patterns: ${credCheck.leaks.join(', ')}`,
      };
    }

    if (score.total < 40) {
      console.log(`   ❌ Verification FAILED — Score below threshold (${score.total}/100)`);
      return {
        passed: false,
        score: score.total,
        feedback: score.issues.join(' | ') || 'Output quality below acceptable threshold.',
      };
    }

    console.log(`   ✅ Verification PASSED`);
    return {
      passed: true,
      score: score.total,
      feedback: 'All quality requirements met.',
    };
  }

  // ─── ROLE: <role_verifier> — Multi-Branch Scoring (Ultron's Mathematical Model) ─

  /**
   * Evaluates multiple candidate outputs (AB-MCTS branches) using mathematical scoring.
   * Ultron's contribution: syntax validity + complexity + safety checks.
   * Returns best branch index.
   */
  static async compareBranches(branches) {
    console.log(`\n⚖️  [RTX-Verifier] <role_verifier> Comparing ${branches.length} parallel branches (Fugu-Ultra AB-MCTS)...`);

    let bestIndex = 0;
    let highestScore = -1;
    const scores = [];

    for (let i = 0; i < branches.length; i++) {
      const branchOut = branches[i];
      const scored = RTXVerifier._scoreOutput(branchOut, {});

      // Credential leak penalty (Antigravity 2.0)
      const credCheck = RTXSafetyLayer.checkForCredentialLeaks(branchOut);
      const leakPenalty = credCheck.hasLeak ? -100 : 0;

      const finalScore = scored.total + leakPenalty;
      scores.push(finalScore);

      console.log(`   > Branch ${i + 1} | Syntax: ${scored.syntaxScore} | Complexity: ${scored.complexityScore} | Safety: ${scored.safetyScore} | Leak Penalty: ${leakPenalty} | TOTAL: ${finalScore}`);

      if (finalScore > highestScore) {
        highestScore = finalScore;
        bestIndex = i;
      }
    }

    console.log(`   🏆 Branch ${bestIndex + 1} selected (Score: ${highestScore})`);
    return bestIndex;
  }

  // ─── INTERNAL: Scoring Engine ─────────────────────────────────────────────────

  /**
   * Mathematical scoring model — Ultron's unique contribution.
   * Returns { total, syntaxScore, complexityScore, safetyScore, issues }
   */
  static _scoreOutput(output, step = {}) {
    let syntaxScore = 50;    // Base syntax score
    let complexityScore = 25; // Base complexity score
    let safetyScore = 25;    // Base safety score
    const issues = [];

    // ── Syntax Validity Checks ──
    if (!output || output.trim().length === 0) {
      syntaxScore = 0;
      issues.push('Empty output');
    }
    if (output.includes('SIMULATED_FAIL') || output.includes('ERROR:')) {
      syntaxScore -= 30;
      issues.push('Contains failure markers');
    }
    if (output.includes('try') && output.includes('catch')) {
      syntaxScore += 15; // Has error handling
    }
    if (output.includes('async') || output.includes('await')) {
      syntaxScore += 10; // Uses async patterns
    }

    // ── Complexity / Quality Checks ──
    if (output.toLowerCase().includes('premium') || output.toLowerCase().includes('advanced')) {
      complexityScore += 25;
    }
    if (output.split('\n').length > 10) {
      complexityScore += 15; // Substantial output
    }
    if (output.includes('TODO') || output.includes('FIXME') || output.includes('placeholder')) {
      complexityScore -= 20;
      issues.push('Contains lazy placeholders (RTX anti-truncation rule violated)');
    }

    // ── Safety / Security Checks ──
    const safetyCheck = RTXSafetyLayer.checkCommand(output);
    if (!safetyCheck.isSafe) {
      safetyScore = 0;
      issues.push(`Destructive pattern in output: ${safetyCheck.reason}`);
    }

    // Clamp scores
    syntaxScore     = Math.max(0, Math.min(50, syntaxScore));
    complexityScore = Math.max(0, Math.min(25, complexityScore));
    safetyScore     = Math.max(0, Math.min(25, safetyScore));

    return {
      total: syntaxScore + complexityScore + safetyScore,
      syntaxScore,
      complexityScore,
      safetyScore,
      issues,
    };
  }
}

module.exports = RTXVerifier;
