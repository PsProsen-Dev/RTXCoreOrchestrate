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

  // ─── ROLE: <role_verifier> — Normalized [0,1] scoring (AB-MCTS contract) ──────

  /**
   * Deterministic rubric score normalized to [0,1] — TreeQuest's hard
   * requirement for MCTS node scores. Runs with NO API key.
   * Credential leak in the candidate = hard 0 (never reward exfiltration).
   */
  static scoreNormalized(output, step = {}) {
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    const credCheck = RTXSafetyLayer.checkForCredentialLeaks(text);
    if (credCheck.hasLeak) return 0;
    const { total } = RTXVerifier._scoreOutput(text, step);
    const s = total / 100;
    return Math.max(0, Math.min(1, Number.isFinite(s) ? s : 0));
  }

  /**
   * Reasoning-candidate scorer → [0,1]. Deterministic, no API key.
   * The /100 artifact rubric (scoreNormalized) is too coarse for short
   * reasoning texts — everything ties at 1.0 and UCB1 cannot discriminate.
   * This scorer measures REAL text properties instead: structural markers,
   * distinct analytical moves (decomposition, constraints, comparison, risk,
   * evidence, recommendation), specificity (numbers, length), and lexical
   * diversity. It is the default scoreFn for RTXMCTS.runSearch.
   */
  static scoreReasoning(text) {
    const t = typeof text === 'string' ? text : JSON.stringify(text);
    if (!t || t.trim().length === 0) return 0;
    if (/SIMULATED_FAIL|ERROR\(code=/.test(t)) return 0.05; // failed generation
    if (RTXSafetyLayer.checkForCredentialLeaks(t).hasLeak) return 0; // never reward leaks

    let s = 0.25; // base: non-empty, safe text
    // Structure — organized reasoning, not a blob.
    if (/(^|\n)\s*(#{1,6}\s|[-*•]\s|\(?\d+[.)]\s|```)/m.test(t)) s += 0.15;
    // Substance moves — each distinct analytical move is real content.
    const moves = [
      /\?/,                                     // asks sub-questions
      /constraint|requirement|\bmust\b|hard limit/i,
      /trade-?off|compar|versus|alternative/i,
      /risk|\bfail\b|mitigat/i,
      /eviden|source|verif|assum/i,
      /recommend|conclusion|decision/i,
    ];
    const hitMoves = moves.filter(re => re.test(t)).length;
    s += Math.min(0.3, hitMoves * 0.06);
    // Specificity.
    if (/\b\d+(\.\d+)?\b/.test(t)) s += 0.05;
    if (t.length > 300) s += 0.08;
    if (t.length > 600) s += 0.07;
    // Lexical diversity — copy-paste padding scores lower.
    const toks = t.toLowerCase().match(/[a-z]{3,}/g) || [];
    if (toks.length > 20 && (new Set(toks).size / toks.length) > 0.55) s += 0.05;
    // Penalties.
    if (/TODO|FIXME|placeholder/i.test(t)) s -= 0.25;
    if (/\[MOCK\]/.test(t)) s -= 0.15;

    return Math.max(0, Math.min(1, s));
  }

  /**
   * Optional LLM-as-judge hook. If RTX_JUDGE_CMD names an executable, it is
   * spawned argv-safe (no shell) as `<cmd> <criterion> <candidate>` and its
   * stdout is parsed for a 0–100 number. Any failure (missing binary,
   * timeout, unparsable output) returns null — the caller MUST gracefully
   * degrade to scoreNormalized. Never throws for judge absence.
   *
   * @returns {Promise<number|null>} judge score in [0,1], or null if unavailable
   */
  static async llmJudge(output, criterion = 'overall quality') {
    const cmd = (process.env.RTX_JUDGE_CMD || '').trim();
    if (!cmd) return null;
    const { spawn } = require('child_process');
    const text = typeof output === 'string' ? output : JSON.stringify(output);
    return new Promise((resolve) => {
      const done = (v) => resolve(v);
      let proc;
      try {
        // argv-safe: criterion + candidate are argv elements, shell:false.
        proc = spawn(cmd, [String(criterion), text.substring(0, 4000)], {
          shell: false,
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 20000,
        });
      } catch { return done(null); }
      let out = '';
      proc.stdout.on('data', (d) => { out += d.toString('utf8'); });
      proc.on('error', () => done(null));
      proc.on('close', (code) => {
        if (code !== 0) return done(null);
        const m = out.match(/(\d+(?:\.\d+)?)/);
        if (!m) return done(null);
        const n = parseFloat(m[1]);
        if (!Number.isFinite(n)) return done(null);
        // Accept 0–1 or 0–100 scales.
        const normalized = n <= 1 ? n : n / 100;
        done(Math.max(0, Math.min(1, normalized)));
      });
      setTimeout(() => { try { proc.kill('SIGTERM'); } catch { /* noop */ } done(null); }, 21000).unref?.();
    });
  }

  /**
   * Blended judge: deterministic rubric always; LLM judge blended in when
   * (and only when) RTX_JUDGE_CMD yields a usable score. Honest about which
   * signal was used via the returned `basis` field.
   */
  static async judgeCandidate(output, step = {}, criterion) {
    const rubric = RTXVerifier.scoreNormalized(output, step);
    const llm = await RTXVerifier.llmJudge(output, criterion || (step.action || 'overall quality'));
    if (llm === null) return { score: rubric, basis: 'rubric' };
    return { score: Math.max(0, Math.min(1, (rubric + llm) / 2)), basis: 'rubric+llm' };
  }

  // ─── INTERNAL: Scoring Engine ─────────────────────────────────────────────────

  /**
   * Mathematical scoring model — Ultron's unique contribution.
   * Returns { total, syntaxScore, complexityScore, safetyScore, issues }
   *
   * Honesty fix (Oct 2026): the old "+25 for the words premium/advanced" bonus
   * made branch comparison a rigged demo (the fluff branch always won).
   * Complexity is now scored on REAL substance signals — structure, length,
   * and absence of failure/placeholder markers — never on magic keywords.
   *
   * Second honesty fix: bases are EARNED, not granted. The old 50/25/25 bases
   * let any non-empty safe text hit the 100 ceiling, so fluff tied substance
   * and ranking was meaningless. Now: syntax starts at 30, complexity at 10 —
   * code signals, structure and depth earn the rest. The <40 verify() gate
   * stays lenient (prose still passes); RANKING now discriminates.
   */
  static _scoreOutput(output, step = {}) {
    let syntaxScore = 30;    // Base syntax score — earn the rest
    let complexityScore = 10; // Base complexity score — earn the rest
    let safetyScore = 25;    // Base safety score
    const issues = [];
    const text = typeof output === 'string' ? output : '';

    // ── Syntax Validity Checks ──
    if (!text || text.trim().length === 0) {
      // Empty output is worthless — no partial credit on other axes.
      return { total: 0, syntaxScore: 0, complexityScore: 0, safetyScore: 0, issues: ['Empty output'] };
    }
    // Failure markers — including the conductor's own ERROR(code=N) format.
    // (A CLI usage-dump after a non-zero exit must NEVER outscore real output.)
    // Hard failures (our unambiguous markers) get zero substance credit —
    // a dump is not a candidate.
    let hasHardFailure = false;
    if (text.includes('SIMULATED_FAIL') || /(^|\n)ERROR\(code=\d+\)/.test(text)) {
      hasHardFailure = true;
      syntaxScore -= 30;
      issues.push('Contains failure markers');
    } else if (text.includes('ERROR:')) {
      syntaxScore -= 30;
      issues.push('Contains failure markers');
    }
    if (text.includes('try') && text.includes('catch')) {
      syntaxScore += 15; // Has error handling
    }
    if (text.includes('async') || text.includes('await')) {
      syntaxScore += 10; // Uses async patterns
    }

    // ── Complexity / Substance Checks (real signals, no keyword bingo) ──
    const lines = text.split('\n').filter(l => l.trim().length > 0);
    const hasStructure = /(^|\n)\s*(#{1,6}\s|[-*]\s|\d+\.\s|```)/m.test(text);
    if (hasStructure) complexityScore += 10;                    // organized, not a blob
    if (lines.length > 10) complexityScore += 8;               // substantial output
    if (text.length > 500) complexityScore += 7;               // real depth
    if (text.includes('[MOCK]')) {
      complexityScore -= 10;                                   // documented fallback < real output
      issues.push('Mock fallback output (CLI unavailable) — scored below real output');
    }
    if (text.includes('TODO') || text.includes('FIXME') || text.includes('placeholder')) {
      complexityScore -= 20;
      issues.push('Contains lazy placeholders (RTX anti-truncation rule violated)');
    }

    // ── Safety / Security Checks ──
    const safetyCheck = RTXSafetyLayer.checkCommand(text);
    if (!safetyCheck.isSafe) {
      safetyScore = 0;
      issues.push(`Destructive pattern in output: ${safetyCheck.reason}`);
    }

    // Clamp scores
    syntaxScore     = Math.max(0, Math.min(50, syntaxScore));
    complexityScore = Math.max(0, Math.min(25, hasHardFailure ? 0 : complexityScore));
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
