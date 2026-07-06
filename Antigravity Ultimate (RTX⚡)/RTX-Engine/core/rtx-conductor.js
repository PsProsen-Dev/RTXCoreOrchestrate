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

    // 2. Plan
    const { plan } = await this.planner.plan(goal, this.registry, this.isUltra ? 'ULTRA' : 'STANDARD');

    // 3. Execute Pipeline
    for (const step of plan) {
      console.log(`\n⚙️  [RTX-Step ${step.step}] Executing via [${step.tool.toUpperCase()}] -> ${step.action}`);
      
      // Safety Check
      const safetyCheck = RTXSafetyLayer.checkCommand(step);
      if (!safetyCheck.isSafe) {
        console.error(`❌ [RTX-Conductor] Aborting step due to safety violation: ${safetyCheck.reason}`);
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
    
    console.log(`\n✅ [RTX-Conductor] Orchestration Complete.`);
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
