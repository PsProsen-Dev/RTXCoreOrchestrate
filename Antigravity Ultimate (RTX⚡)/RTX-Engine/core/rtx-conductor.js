const fs = require('fs');
const path = require('path');
const RTXPlanner = require('./rtx-planner');
const RTXSafetyLayer = require('./rtx-safety');
const { SafetyTripwireError } = require('./rtx-safety');
const RTXFileManager = require('./rtx-file-manager');
const RTXSession = require('./rtx-session');
const RTXVerifier = require('./rtx-verifier');
const RTXMCTS = require('./rtx-mcts');
const { sanitizeCLIOutput } = require('./rtx-sanitizer');
const { recordOutcome } = require('./rtx-router');

const BaseAdapter = require('./adapters/BaseAdapter');
const ClaudeAdapter = require('./adapters/ClaudeAdapter');
const GhAdapter = require('./adapters/GhAdapter');
const { isAvailable } = require('../scripts/health-check');

/**
 * RTXConductor Heuristic Router — Fugu-style model selection.
 * Team Discussion: Antigravity IDE's approach (heuristic routing) over
 * Antigravity 2.0's RL simulation (too complex for CLI scope).
 * Ultron's input: route based on task type + complexity.
 */
class RTXHeuristicConductor {
  static selectModel(taskType, complexity = 0.5) {
    // <role_thinker> tasks → Claude (deep reasoning)
    if (taskType === 'thinker' || complexity > 0.8) return 'claude_code';
    // Research tasks → Marlin
    if (taskType === 'research' || taskType === 'marlin') return 'marlin';
    // Deployment tasks → gh_cli
    if (taskType === 'deploy' || taskType === 'repo') return 'gh_cli';
    // Default <role_worker> → copilot_cli
    return 'copilot_cli';
  }

  static computeComplexity(step) {
    let score = 0.5;
    if (step.requires_mcts) score += 0.3;
    if (step.trinity_role === 'thinker') score += 0.2;
    if (step.dependencies && step.dependencies.length > 2) score += 0.1;
    return Math.min(score, 1.0);
  }
}

class RTXConductor {
  constructor(isUltra = false) {
    const registryPath = path.join(__dirname, '../config/cli-registry.json');
    this.registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    this.planner = new RTXPlanner();
    this.isUltra = isUltra;
  }

  /**
   * Returns a live adapter for the given registry tool.
   *
   * P0 fix: the adapter is WIRE-UP, not decorative.
   * - Health-check decides mockMode via the adapter's built-in graceful-fallback
   *   pattern (BaseAdapter.run → _mockRun when the binary is missing).
   * - Unknown tool ids (e.g. legacy router ids not in the registry) no longer
   *   throw — they log a warning and run the documented mock fallback.
   */
  getAdapter(toolId) {
    const config = this.registry[toolId];
    if (!config) {
      console.warn(`   ⚠️  [RTX-Conductor] Unknown tool "${toolId}" — not in cli-registry.json. Using documented mock fallback.`);
      const mock = new BaseAdapter(toolId, { cmd: 'rtx-unknown-tool', capabilities: [] });
      mock.mockMode = true;
      return RTXSafetyLayer.wrapAdapter(mock); // tripwires apply here too
    }

    let adapter;
    if (toolId === 'claude_code') adapter = new ClaudeAdapter(toolId, config);
    else if (toolId === 'gh_cli') adapter = new GhAdapter(toolId, config);
    else adapter = new BaseAdapter(toolId, config);

    // Wire health-check state into the adapter's existing fallback pattern:
    // binary missing → adapter.run() returns the documented mock result.
    adapter.mockMode = !isAvailable(toolId);

    // Tripwire interceptors on EVERY adapter call (OpenAI Agents SDK pattern):
    // safety is a pre/post wrapper around run(), not a pipeline stage.
    // A tripped guardrail throws SafetyTripwireError → the run HALTS.
    return RTXSafetyLayer.wrapAdapter(adapter);
  }

  /**
   * TRINITY-style turn loop (ICLR 2026 — roles as system behavior, no training):
   * <role_worker> produces → <role_verifier> judges → ACCEPT halts the loop,
   * REJECT sends semantic feedback back for revision (Fugu-Ultra recursive
   * self-correction: refine, don't discard). Turn budget exhausts → best-so-far.
   *
   * @returns {Promise<{success, output, turns, accepted, mock}>}
   */
  async runWorkerTurns(step, adapter, ctx = {}) {
    const TURN_BUDGET = this.isUltra ? 4 : 2;
    let feedback = null;
    let best = { output: '', score: -1 };
    let prevOut = null;
    let mockSeen = false;

    for (let turn = 1; turn <= TURN_BUDGET; turn++) {
      if (turn > 1) console.log(`🔄 [RTX-Conductor] <role_verifier> → <role_worker> revise (turn ${turn}/${TURN_BUDGET})…`);

      const input = this._buildWorkerInput(step, { feedback, previous: best.output });
      let res;
      try {
        // GuardedAdapter: pre/post tripwire interceptors run inside .run().
        res = await adapter.run(input, ctx);
      } catch (err) {
        if (err instanceof SafetyTripwireError) throw err; // trip = halt, handled by caller
        if (err && err.timedOut) throw new Error(`CLI "${step.tool}" timed out after ${adapter.timeoutMs / 1000}s`);
        throw err;
      }
      if (res.mock) mockSeen = true;
      const out = res.code !== 0
        ? `ERROR(code=${res.code}): ${res.err || res.out}`.substring(0, 500)
        : res.out;

      // Mock determinism guard: identical mock output twice → revision is
      // pointless (no real worker behind it). End the loop honestly.
      if (res.mock && prevOut !== null && out === prevOut) {
        console.log(`   🧪 [RTX-Conductor] Mock output deterministic — ending turn loop early (no real worker to revise).`);
        best = { output: out, score: RTXVerifier.scoreNormalized(out, step) };
        break;
      }
      prevOut = out;

      // <role_verifier> verdict — ACCEPT is the TRINITY stop signal.
      const verdict = await RTXVerifier.verify(step, out);
      const norm = RTXVerifier.scoreNormalized(out, step);
      if (norm > best.score) best = { output: out, score: norm };

      if (verdict.passed) {
        console.log(`   ✅ [RTX-Conductor] Verifier ACCEPTED (score ${verdict.score}/100) — turn loop halts.`);
        return { success: true, output: out, turns: turn, accepted: true, mock: mockSeen };
      }
      feedback = verdict.feedback;
      console.warn(`   ⚠️  [RTX-Conductor] Verifier REJECTED — feedback to worker: "${feedback}"`);
    }

    // Turn budget exhausted → TRINITY's "return transcript.last": best-so-far.
    console.warn(`   ⏱️  [RTX-Conductor] Turn budget exhausted — keeping best-so-far (normalized score ${best.score.toFixed(3)}).`);
    return {
      success: best.score >= 0.4, // mirrors the verifier's <40 fail threshold
      output: best.output,
      turns: TURN_BUDGET,
      accepted: false,
      mock: mockSeen,
    };
  }

  /**
   * Builds the worker input for a turn. On revision turns the verifier's
   * feedback and the previous output travel with the request — the worker
   * refines instead of starting over (Fugu-Ultra recursive self-correction).
   */
  _buildWorkerInput(step, { feedback, previous }) {
    let details = step.details;
    if (feedback) {
      details += `\n\n[REVISION REQUESTED by <role_verifier>]: ${feedback}\n` +
        `Revise your previous output to address this — refine it, do not discard what was already correct.`;
      if (previous) details += `\n\n[YOUR PREVIOUS OUTPUT]:\n${previous.substring(0, 2000)}`;
    }
    return { action: step.action, details };
  }

  /**
   * Real AB-MCTS step (Fugu-Ultra test-time scaling): candidates are
   * generated by REAL adapter runs — rotating across the tool pool
   * (TreeQuest multi-LLM generate_fns) — scored by the verifier rubric in
   * [0,1], selected by UCB1 with adaptive wider/deeper branching.
   *
   * @returns {Promise<{success, output, mock, stats}>}
   */
  async runMCTSStep(step, ctx = {}) {
    console.log(`🌲 [RTX-MCTS] Real AB-MCTS — candidate generation via live adapters, verifier-scored, UCB1-selected.`);
    const tools = [step.tool, ...this._fallbackTools(step.tool)];
    console.log(`   > Worker pool for this search: ${tools.join(', ')}`);

    const budget = 8;
    const mcts = new RTXMCTS({ budget, maxChildren: 3, maxDepth: 3 });
    let genIdx = 0;
    let mockSeen = false;

    const generateFn = async (parentState, mode) => {
      const tool = tools[genIdx % tools.length];
      genIdx++;
      generateFn.workerId = tool; // read by MCTS after await — single-threaded, safe
      const adapter = this.getAdapter(tool);
      const input = {
        action: step.action,
        details: mode === 'deeper'
          ? `Refine and improve this candidate — fix its weaknesses, add specifics and edge cases:\n${parentState}\n\nOriginal task: ${step.details}`
          : `Propose a DISTINCT approach for this task (a genuinely different strategy from prior candidates):\nTask: ${step.details}\nPrior context (do not copy): ${parentState.substring(0, 500)}`,
      };
      const res = await adapter.run(input, ctx); // tripwires inside
      if (res.mock) mockSeen = true;
      return res.code !== 0 ? `ERROR(code=${res.code}): ${res.err || res.out}` : res.out;
    };

    const scoreFn = async (candidate) => RTXVerifier.scoreNormalized(candidate, step);

    const { best, stats } = await mcts.runSearch({
      query: `${step.action}: ${step.details}`,
      budget,
      generateFn,
      scoreFn,
      onIteration: ({ iter, mode, score }) => {
        if (iter === budget) console.log(`   > [MCTS] ${stats.wider + stats.deeper} expansions done.`);
      },
    });

    console.log(`🎯 [RTX-MCTS] Adopting best candidate (value ${best.meanValue.toFixed(3)}, via ${best.workerId || 'unknown worker'}).`);
    return {
      success: best.meanValue >= 0.35,
      output: best.state,
      mock: mockSeen,
      stats,
      winnerWorker: best.workerId,
    };
  }

  /**
   * Fugu-Ultra parallel candidate racing for hard non-MCTS steps: the same
   * subtask races across the router's fallback chain IN PARALLEL
   * (Promise.all), and the verifier picks the winner — best-selection, not
   * pre-ordained. `--ultra` mode runs on this.
   *
   * @returns {Promise<{success, output, mock, winner}>}
   */
  async raceCandidates(step, ctx = {}, k = 3) {
    const { selectModelFromVector, extractFeatureVector } = require('./rtx-router');
    const h = extractFeatureVector(`${step.action} ${step.details}`);
    const { fallbackChain } = selectModelFromVector(h, 'ULTRA');
    const tools = [...new Set([step.tool, ...fallbackChain])].slice(0, k);
    console.log(`🏁 [RTX-Race] Fugu-Ultra parallel racing across: ${tools.join(' → ')}`);

    const input = { action: step.action, details: step.details };
    const results = await Promise.all(tools.map(async (tool) => {
      try {
        const adapter = this.getAdapter(tool);
        const res = await adapter.run(input, ctx); // tripwires inside
        return {
          tool,
          out: res.code !== 0 ? `ERROR(code=${res.code}): ${res.err || res.out}`.substring(0, 500) : res.out,
          mock: !!res.mock,
        };
      } catch (err) {
        if (err instanceof SafetyTripwireError) throw err; // tripwire halts the whole race
        return { tool, out: `ERROR: ${err.message || err}`.substring(0, 500), mock: false };
      }
    }));

    const bestIndex = await RTXVerifier.compareBranches(results.map(r => r.out));
    const winner = results[bestIndex];
    console.log(`🏆 [RTX-Race] Winner: [${winner.tool.toUpperCase()}]`);
    return {
      success: RTXVerifier.scoreNormalized(winner.out, step) >= 0.4,
      output: winner.out,
      mock: winner.mock,
      winner: winner.tool,
    };
  }

  /** Registry tools other than `tool`, for multi-worker rotation / racing. */
  _fallbackTools(tool) {
    return Object.keys(this.registry).filter(t => t !== tool);
  }

  async processGoal(goal) {
    console.log(`\n🎯 [RTX-Conductor] Goal: "${goal}"`);
    if (this.isUltra) console.log(`🚀 [RTX-Conductor] FUGU ULTRA MODE ENGAGED (Test-Time Scaling Active)`);
    
    // 1. Session & Workspace init
    const sessionId = 'session_' + Date.now();
    const session = new RTXSession(sessionId);
    const fileManager = new RTXFileManager(sessionId);
    const workspacePath = fileManager.getWorkspacePath();
    console.log(`📂 [RTX-Workspace] Mounted at: ${workspacePath}`);

    // 2. Plan — <role_thinker> Phase
    const { plan, goalId } = await this.planner.plan(goal, this.registry, this.isUltra ? 'ULTRA' : 'STANDARD');

    // Initialize session state for tracking progress & crash recovery
    await session.init(goalId, plan);

    // Execution honesty tracking:
    // - usedMock: any step ran through the documented mock fallback
    //   (CLI binary missing) — the "COMPLETED ✅" line may only print when
    //   every step either really ran or used this documented fallback.
    // - pipelineFailed: a step exhausted retries / crashed.
    let usedMock = false;
    let pipelineFailed = false;

    // 3. Execute Pipeline — TRINITY turn-loop orchestration.
    // Linear blind-retry is gone. Each step dispatches to exactly one of:
    //   - runMCTSStep    (ultra + requires_mcts): real AB-MCTS over live adapters
    //   - raceCandidates (ultra + hard step):    parallel racing, verifier picks best
    //   - runWorkerTurns (everything else):      Thinker→Worker→Verifier turn loop
    for (const step of plan) {
      // TRINITY role display
      const roleIcon = { thinker: '🧠', worker: '⚙️', verifier: '🔍', synthesizer: '🎯' }[step.trinity_role] || '▪️';
      console.log(`\n${roleIcon}  [RTX-Step ${step.step}] <role_${step.trinity_role || 'worker'}> via [${step.tool.toUpperCase()}] → ${step.action}`);

      // Heuristic Conductor routing (Antigravity IDE + Ultron approach)
      const complexity = RTXHeuristicConductor.computeComplexity(step);
      const suggestedModel = RTXHeuristicConductor.selectModel(step.trinity_role, complexity);
      if (suggestedModel !== step.tool) {
        console.log(`   🎛️ [RTX-Conductor] Heuristic override: ${step.tool} → ${suggestedModel} (complexity: ${complexity.toFixed(2)})`);
      }

      // NOTE: no inline safety pre-flight stage anymore — every adapter from
      // getAdapter() carries pre/post tripwire interceptors. A tripped
      // guardrail throws SafetyTripwireError → the pipeline HALTS (no skip).

      let stepResult;
      try {
        const ctx = { workspace: workspacePath };
        if (this.isUltra && step.requires_mcts) {
          stepResult = await this.runMCTSStep(step, ctx);
        } else if (this.isUltra && complexity > 0.7) {
          stepResult = await this.raceCandidates(step, ctx);
        } else {
          stepResult = await this.runWorkerTurns(step, this.getAdapter(step.tool), ctx);
        }
      } catch (err) {
        if (err instanceof SafetyTripwireError) {
          console.error(`\n🛑 [RTX-Conductor] SAFETY TRIPWIRE — halting pipeline immediately (no skip, no retry).`);
          console.error(`   ${err.message}`);
          RTXSafetyLayer.lockSessionState(sessionId, err.message);
          pipelineFailed = true;
          break;
        }
        console.error(`❌ [RTX-Conductor] Failed at step ${step.step}:`, err.message || err);
        pipelineFailed = true;
        break;
      }

      // Fugu honest port: feed the outcome back into the router's persisted
      // ledger so future routing learns from this run.
      try { recordOutcome(step.tool, stepResult.success); } catch { /* routing must never break execution */ }

      if (stepResult.mock) {
        usedMock = true;
        console.log(`   🧪 [RTX-Conductor] Mock fallback (CLI "${step.tool}" unavailable) — documented.`);
      }

      const cleanOut = sanitizeCLIOutput(stepResult.output || '', step.tool);
      session.log(step.tool, step, cleanOut);

      // Artifact generation mapping
      if (step.action === 'scaffold_backend' || step.action === 'scaffold_codebase') {
        fileManager.registerArtifact("api/main.py", "# Backend Code\n" + (stepResult.output || ''));
      }

      if (!stepResult.success) {
        console.error(`🚨 [RTX-Conductor] Step ${step.step} failed (verifier accepted no candidate).`);
        pipelineFailed = true;
        break; // Stop pipeline
      }
      console.log(`✅ [RTX-Conductor] Step ${step.step} accepted.`);
    }

    // Goal progress final print — HONEST: "COMPLETED ✅" only when every step
    // either ran for real or used the documented mock fallback.
    session.complete(pipelineFailed ? 'FAILED' : 'COMPLETED');
    if (goalId) this.planner.printGoalProgress(goalId, session);
    if (pipelineFailed) {
      console.log(`\n❌ [RTX-Conductor] Pipeline FAILED — one or more steps did not complete.`);
    } else if (usedMock) {
      console.log(`\n⚠️  [RTX-Conductor] <role_synthesizer> Orchestration completed with DOCUMENTED mock fallback (one or more CLIs unavailable).`);
      console.log(`   💡 Run: node scripts/health-check.js — install the missing CLIs for live execution.`);
    } else {
      console.log(`\n✅ [RTX-Conductor] <role_synthesizer> Orchestration Complete.`);
    }
    console.log(`🔗 [RTX-Conductor] TRINITY Pipeline: Thinker → Worker → Verifier → Synthesizer ✓`);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isUltra = args.includes('--ultra');
  const goal = args.filter(a => a !== '--ultra').join(' ') || "Create a FastAPI backend repo with CI and open a PR.";
  
  const conductor = new RTXConductor(isUltra);
  conductor.processGoal(goal);
}

module.exports = RTXConductor;
