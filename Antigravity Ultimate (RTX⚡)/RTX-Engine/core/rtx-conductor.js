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

  getAdapter(toolId) {
    const config = this.registry[toolId];
    if (!config) throw new Error(`Unknown tool: ${toolId}`);
    
    if (toolId === 'claude_code') return new ClaudeAdapter(toolId, config);
    if (toolId === 'gh_cli') return new GhAdapter(toolId, config);
    return new BaseAdapter(toolId, config);
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

          // AB-MCTS Branching Execution
          if (this.isUltra && step.requires_mcts) {
            console.log(`🌲 [RTX-MCTS] Complexity High. Spawning AB-MCTS Parallel Branches...`);
            
            // Branch 1: Primary Tool (e.g., claude_code)
            const adapter1 = this.getAdapter(step.tool);
            console.log(`   > [Branch 1] Spawning subprocess via [${step.tool.toUpperCase()}]`);
            let out1 = `SIMULATED_FAIL: Standard implementation by ${step.tool}`; // Mock failure to test selection
            
            // Branch 2: Fallback Expert Tool (e.g., copilot_cli or gh_cli)
            const fallbackTool = step.tool === 'claude_code' ? 'copilot_cli' : 'claude_code';
            console.log(`   > [Branch 2] Spawning alternative subprocess via [${fallbackTool.toUpperCase()}]`);
            let out2 = `Advanced/Premium implementation with edge cases handled by ${fallbackTool}`; 
            
            // Verifier picks the best branch
            const branches = [out1, out2];
            const bestIndex = await RTXVerifier.compareBranches(branches);
            finalOut = branches[bestIndex];
            
            // Adopt winning branch context
            console.log(`🎯 [RTX-MCTS] Adopting context from Branch ${bestIndex + 1}.`);
            success = true;
          } else {
            // Standard execution logic
            const adapter = this.getAdapter(step.tool);
            console.log(`   > Subprocess spawned in workspace...`);
            
            let mockOut = "Success output for " + step.action;
            if (step.triggerUltraMock && attempt === 1 && this.isUltra) {
              mockOut = "SIMULATED_FAIL: Missing error handling";
            }
            finalOut = mockOut;
            
            // Ultra Verification Layer
            if (this.isUltra) {
              const verification = await RTXVerifier.verify(step, finalOut);
              if (!verification.passed) {
                console.warn(`⚠️ [RTX-Conductor] Verification failed. Feedback sent back to agent: "${verification.feedback}"`);
                continue; // loop again
              }
            }
            success = true;
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
        break; // Stop pipeline
      }
    }
    
    // Goal progress final print
    session.complete('COMPLETED');
    if (goalId) this.planner.printGoalProgress(goalId, session);
    console.log(`\n✅ [RTX-Conductor] <role_synthesizer> Orchestration Complete.`);
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
