/**
 * RTX-Session — Live State Manager with Checkpoint & Resume
 *
 * Team Discussion Final Decision:
 * - Antigravity 2.0 (RTX⚡): Full .rtx_orchestration_state.json live tracking,
 *                             lock/unlock mechanism, crash resume via checkpoint
 * - Antigravity IDE (RTX⚡): SRP — session handles state, not safety
 * - Ultron (RTX⚡):          Track modelRoutes[] history for contradiction analysis
 *
 * RTXCoreFramework Section 8.6 — Goal-State Tracking
 */

const fs   = require('fs');
const path = require('path');

class RTXSession {
  constructor(sessionId, workspacePath) {
    this.id        = sessionId;
    this.workspace = workspacePath || path.join(process.cwd(), 'workspaces', sessionId);

    // Ensure workspace directory exists
    if (!fs.existsSync(this.workspace)) {
      fs.mkdirSync(this.workspace, { recursive: true });
    }

    this.stateFile = path.join(this.workspace, '.rtx_orchestration_state.json');

    // In-memory mirrors (for backward compat with rtx-conductor.js)
    this.history          = [];
    this.cliOutputs       = {};
    this.synthesized      = [];
    this.activeSpecialists = new Set();

    // Persisted state object
    this.state = null;
  }

  // ─── Init / Resume ─────────────────────────────────────────────────────────

  /**
   * Initialize a new session or resume from existing checkpoint.
   * Antigravity 2.0: crash detection via sessionLocked flag.
   * Returns true if resumed from crash, false if fresh start.
   */
  async init(goalId, steps = []) {
    if (fs.existsSync(this.stateFile)) {
      try {
        const raw = fs.readFileSync(this.stateFile, 'utf8');
        this.state = JSON.parse(raw);

        if (this.state.sessionLocked) {
          console.warn(`\n⚠️  [RTX-Session] Previous session crashed while locked — auto-recovering...`);
          console.warn(`   Resuming from step ${this.state.currentStep} / ${this.state.steps.length}`);
          this.state.sessionLocked = false;
          this.state.status = 'RUNNING';
          this._persist();
        } else {
          console.log(`\n📂 [RTX-Session] Resuming existing session [${this.id}] at step ${this.state.currentStep}`);
        }

        return true; // Resumed
      } catch (parseErr) {
        console.warn(`   State file corrupt — starting fresh: ${parseErr.message}`);
      }
    }

    // Fresh session
    this.state = {
      goalId,
      sessionId:             this.id,
      currentStep:           1,
      status:                'RUNNING',
      steps:                 steps.map(s => ({
        step:         s.step,
        tool:         s.tool,
        action:       s.action,
        details:      s.details || '',
        trinity_role: s.trinity_role || 'worker',
        status:       'PENDING',
        attempts:     0,
        outputFile:   null,
        requires_mcts: s.requires_mcts || false,
      })),
      modelRoutes:           {},  // action → model used
      failCount:             0,
      credentialLeaksBlocked: 0,
      sessionLocked:         false,
      createdAt:             new Date().toISOString(),
      updatedAt:             new Date().toISOString(),
    };

    this._persist();
    console.log(`\n📋 [RTX-Session] New session initialized: [${this.id}] | Goal: ${goalId}`);
    return false; // Fresh start
  }

  // ─── Step Management ───────────────────────────────────────────────────────

  /**
   * Update a step's status and metadata.
   * Locks state during write to prevent concurrent corruption.
   */
  updateStep(stepNum, updates) {
    this._lock();

    const step = this.state.steps.find(s => s.step === stepNum);
    if (step) {
      Object.assign(step, updates);
      if (updates.status === 'PASSED') step.attempts = (step.attempts || 0) + 1;
    }
    this.state.currentStep = stepNum;
    this.state.updatedAt   = new Date().toISOString();

    this._unlock();
  }

  /**
   * Checkpoint: get next pending/failed step for resume logic.
   * Antigravity 2.0: crash recovery — picks up where it left off.
   */
  getNextPendingStep() {
    if (!this.state) return null;
    return this.state.steps.find(s => s.status === 'PENDING' || s.status === 'FAILED') || null;
  }

  /**
   * Record which model was used for an action (Ultron — for history tracking).
   */
  recordModelRoute(action, model) {
    if (this.state) {
      this.state.modelRoutes[action] = model;
      this._persist();
    }
  }

  /**
   * Increment credential leak blocked counter.
   */
  recordLeakBlocked() {
    if (this.state) {
      this.state.credentialLeaksBlocked = (this.state.credentialLeaksBlocked || 0) + 1;
      this._persist();
    }
  }

  /**
   * Increment fail counter (used by adaptive historyMultiplier in rtx-router.js).
   */
  recordFail() {
    if (this.state) {
      this.state.failCount = (this.state.failCount || 0) + 1;
      this._persist();
    }
  }

  // ─── Legacy log() — backward compatible with rtx-conductor.js ─────────────

  log(cliName, input, output) {
    this.history.push({ cli: cliName, input, output, ts: Date.now() });
    this.cliOutputs[cliName] = output;

    // Also persist to state if initialized
    if (this.state) {
      const step = this.state.steps.find(s => s.action === input.action);
      if (step) {
        step.status = 'PASSED';
        step.attempts = (step.attempts || 0) + 1;
      }
      this.state.modelRoutes[input.action || cliName] = cliName;
      this.state.updatedAt = new Date().toISOString();
      this._persist();
    }
  }

  // ─── Finalize Session ──────────────────────────────────────────────────────

  complete(status = 'COMPLETED') {
    if (this.state) {
      this.state.status      = status;
      this.state.completedAt = new Date().toISOString();
      this.state.sessionLocked = false;
      this._persist();
      console.log(`\n✅ [RTX-Session] Session [${this.id}] marked as ${status}`);
    }
  }

  // ─── Internal Helpers ──────────────────────────────────────────────────────

  _lock() {
    if (this.state) {
      this.state.sessionLocked = true;
      this._persist();
    }
  }

  _unlock() {
    if (this.state) {
      this.state.sessionLocked = false;
      this._persist();
    }
  }

  _persist() {
    if (this.state) {
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2), 'utf8');
    }
  }
}

module.exports = RTXSession;
