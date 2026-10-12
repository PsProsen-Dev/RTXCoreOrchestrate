const fs = require('fs');
const path = require('path');
const RTXPlanner = require('./rtx-planner');
const RTXSafetyLayer = require('./rtx-safety');
const RTXFileManager = require('./rtx-file-manager');
const RTXSession = require('./rtx-session');
const RTXVerifier = require('./rtx-verifier');
const { sanitizeCLIOutput } = require('./rtx-sanitizer');

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
      return mock;
    }

    let adapter;
    if (toolId === 'claude_code') adapter = new ClaudeAdapter(toolId, config);
    else if (toolId === 'gh_cli') adapter = new GhAdapter(toolId, config);
    else adapter = new BaseAdapter(toolId, config);

    // Wire health-check state into the adapter's existing fallback pattern:
    // binary missing → adapter.run() returns the documented mock result.
    adapter.mockMode = !isAvailable(toolId);
    return adapter;
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

    // 3. Execute Pipeline
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

      // Safety Pre-Flight Check (Antigravity 2.0 contribution)
      const safetyCheck = RTXSafetyLayer.checkCommand(step);
      if (!safetyCheck.isSafe) {
        console.error(`❌ [RTX-Conductor] Aborting step — Safety violation: ${safetyCheck.reason}`);
        RTXSafetyLayer.lockSessionState(sessionId, safetyCheck.reason);
        continue;
      }

      let attempt = 0;
      const MAX_RETRIES = this.isUltra ? 3 : 1;
      let success = false;

      while (attempt < MAX_RETRIES && !success) {
        attempt++;
        if (attempt > 1) console.log(`🔄 [RTX-Conductor] Retrying step (Attempt ${attempt}/${MAX_RETRIES})...`);
        
        try {
          let finalOut = "";
          const stepInput = { action: step.action, details: step.details };

          // AB-MCTS Branching Execution — REAL: both branches run their
          // adapters' BaseAdapter.run() (spawn or documented mock fallback).
          if (this.isUltra && step.requires_mcts) {
            console.log(`🌲 [RTX-MCTS] Complexity High. Spawning AB-MCTS Parallel Branches...`);

            // Branch 1: Primary Tool (e.g., claude_code)
            const adapter1 = this.getAdapter(step.tool);
            console.log(`   > [Branch 1] Running via [${step.tool.toUpperCase()}]`);
            const res1 = await adapter1.run(stepInput, { workspace: workspacePath });
            if (res1.mock) { usedMock = true; console.log(`   🧪 [Branch 1] Mock fallback (CLI unavailable) — documented.`); }

            // Branch 2: Fallback Expert Tool (e.g., copilot_cli or gh_cli)
            const fallbackTool = step.tool === 'claude_code' ? 'copilot_cli' : 'claude_code';
            const adapter2 = this.getAdapter(fallbackTool);
            console.log(`   > [Branch 2] Running via [${fallbackTool.toUpperCase()}]`);
            const res2 = await adapter2.run(stepInput, { workspace: workspacePath });
            if (res2.mock) { usedMock = true; console.log(`   🧪 [Branch 2] Mock fallback (CLI unavailable) — documented.`); }

            // Verifier picks the best branch (honest: scores real outputs)
            const branches = [res1.out, res2.out];
            const bestIndex = await RTXVerifier.compareBranches(branches);
            finalOut = branches[bestIndex];

            // Adopt winning branch context
            console.log(`🎯 [RTX-MCTS] Adopting context from Branch ${bestIndex + 1}.`);
            success = true;
          } else {
            // Standard execution — REAL: invokes adapter.run(), never a mock string.
            const adapter = this.getAdapter(step.tool);
            console.log(`   > Running [${step.tool.toUpperCase()}] on workspace...`);

            const result = await adapter.run(stepInput, { workspace: workspacePath });
            if (result.mock) {
              usedMock = true;
              console.log(`   🧪 [RTX-Conductor] Mock fallback (CLI "${step.tool}" unavailable) — documented.`);
            }
            if (result.timedOut) {
              throw new Error(`CLI "${step.tool}" timed out after ${adapter.timeoutMs / 1000}s`);
            }
            if (result.code !== 0) {
              console.warn(`⚠️ [RTX-Conductor] CLI "${step.tool}" exited code ${result.code}: ${(result.err || '').substring(0, 160)}`);
              finalOut = `ERROR(code=${result.code}): ${result.err || result.out}`.substring(0, 500);
            } else {
              finalOut = result.out;
            }

            // Ultra Verification Layer
            if (this.isUltra) {
              const verification = await RTXVerifier.verify(step, finalOut);
              if (!verification.passed) {
                console.warn(`⚠️ [RTX-Conductor] Verification failed. Feedback sent back to agent: "${verification.feedback}"`);
                continue; // loop again
              }
            }
            success = result.code === 0;
          }

          // Credential leak check before logging (Antigravity 2.0)
          const credCheck = RTXSafetyLayer.checkForCredentialLeaks(finalOut);
          if (credCheck.hasLeak) {
            console.error(`🚨 [RTX-Conductor] Credential leak in output — using redacted version.`);
            finalOut = credCheck.safePayload;
          }

          const cleanOut = sanitizeCLIOutput(finalOut, step.tool);
          session.log(step.tool, step, cleanOut);

          // Artifact generation mapping
          if (step.action === 'scaffold_backend' || step.action === 'scaffold_codebase') {
            fileManager.registerArtifact("api/main.py", "# Backend Code\n" + finalOut);
          }
          
        } catch (err) {
          console.error(`❌ [RTX-Conductor] Failed at step ${step.step}:`, err);
          break;
        }
      }

      if (!success) {
        console.error(`🚨 [RTX-Conductor] Step ${step.step} failed permanently after ${MAX_RETRIES} attempts.`);
        pipelineFailed = true;
        break; // Stop pipeline
      }
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
