/**
 * RTX-Planner — Goal Decomposer & TRINITY Role Assigner
 * 
 * Team Discussion Implementation:
 * - Antigravity IDE (RTX⚡): TRINITY XML role tags injected into plan steps
 * - Ultron (RTX⚡):          Goal → JSON subtask graph generation
 * - Antigravity 2.0 (RTX⚡): Dynamic goal registration & dependency tracking
 * 
 * RTXCoreFramework Section 4 (Task Execution Workflow) + Section 8 (Fugu-Style Orchestration)
 * TRINITY Roles: <role_thinker> = this module
 */

const { routeTask } = require('./rtx-router');

// ─── Goal State Table (Antigravity 2.0 contribution) ─────────────────────────
const goalRegistry = new Map(); // goalId → { description, status, subtasks, timestamps }

class RTXPlanner {

  // ─── ROLE: <role_thinker> — Goal Registration ────────────────────────────────

  /**
   * Registers a new goal in the Goal State Table.
   * Antigravity 2.0: dynamic goal registration with dependency tracking.
   */
  registerGoal(goalId, description) {
    const entry = {
      goalId,
      description,
      status: 'PENDING',
      subtasks: [],
      registeredAt: new Date().toISOString(),
      completedAt: null,
    };
    goalRegistry.set(goalId, entry);
    console.log(`📋 [RTX-Planner] <role_thinker> Goal registered: [${goalId}] → "${description}"`);
    return entry;
  }

  /**
   * Updates goal status in the registry.
   */
  updateGoalStatus(goalId, status) {
    if (goalRegistry.has(goalId)) {
      const entry = goalRegistry.get(goalId);
      entry.status = status;
      if (status === 'COMPLETED' || status === 'FAILED') {
        entry.completedAt = new Date().toISOString();
      }
      goalRegistry.set(goalId, entry);
    }
  }

  /**
   * Prints current goal progress — Antigravity 2.0 contribution.
   */
  printGoalProgress(goalId) {
    const entry = goalRegistry.get(goalId);
    if (!entry) return;
    const done = entry.subtasks.filter(s => s.status === 'COMPLETED').length;
    console.log(`📊 [RTX-Planner] Goal: "${entry.description}" | Progress: ${done}/${entry.subtasks.length} subtasks | Status: ${entry.status}`);
  }

  // ─── ROLE: <role_thinker> — Goal Decomposition (Fugu-Style) ──────────────────

  /**
   * Decomposes a goal into subtasks with TRINITY role assignments.
   * Each subtask carries:  { step, tool, action, details, trinity_role, requires_mcts, dependencies }
   * 
   * Ultron's contribution: returns JSON subtask graph (not just flat array).
   */
  async plan(taskDescription, registry, mode = 'ULTRA') {
    const goalId = 'goal_' + Date.now();
    console.log(`\n🧠 [RTX-Planner] <role_thinker> Decomposing goal: "${taskDescription}"`);
    console.log(`🧠 [RTX-Planner] Mode: [${mode}] | AAS (Adaptive Agentic Scaffolding) active`);

    this.registerGoal(goalId, taskDescription);

    const steps = [];
    const desc = taskDescription.toLowerCase();

    // ── TRINITY Thinker Step: Architecture Spec ──────────────────────────────
    steps.push({
      step: steps.length + 1,
      tool: routeTask('architecture spec', mode),
      action: 'architecture_spec',
      details: 'TRINITY <role_thinker>: Generate architecture spec — database schema, API routes, component map.',
      trinity_role: 'thinker',
      requires_mcts: false,
      dependencies: [],
    });

    // ── TRINITY Worker Steps ─────────────────────────────────────────────────
    if (desc.includes('repo') || desc.includes('git') || desc.includes('github')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('create git repository', mode),
        action: 'create_repo',
        details: 'TRINITY <role_worker>: Initialize local repository and synchronize with remote origin.',
        trinity_role: 'worker',
        requires_mcts: false,
        dependencies: ['architecture_spec'],
      });
    }

    if (desc.includes('code') || desc.includes('backend') || desc.includes('script') || desc.includes('app') || desc.includes('api')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('scaffold codebase', mode),
        action: 'scaffold_codebase',
        details: 'TRINITY <role_worker>: Generate primary source directories and boilerplate with full error handling.',
        trinity_role: 'worker',
        requires_mcts: true, // AB-MCTS parallel generation
        dependencies: ['architecture_spec'],
      });
    }

    if (desc.includes('frontend') || desc.includes('ui') || desc.includes('react') || desc.includes('next')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('scaffold frontend', mode),
        action: 'scaffold_frontend',
        details: 'TRINITY <role_worker>: Generate frontend components, routing, and UI layer.',
        trinity_role: 'worker',
        requires_mcts: true,
        dependencies: ['architecture_spec'],
      });
    }

    if (desc.includes('auth') || desc.includes('login') || desc.includes('jwt')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('add auth login middleware', mode),
        action: 'inject_authentication',
        details: 'TRINITY <role_worker>: Configure JWT token management and user authentication middlewares.',
        trinity_role: 'worker',
        requires_mcts: false,
        dependencies: ['scaffold_codebase'],
      });
    }

    if (desc.includes('test') || desc.includes('spec') || mode === 'ULTRA') {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('run tests', mode),
        action: 'run_verification_tests',
        details: 'TRINITY <role_verifier>: Execute unit tests, lint checks, and validation sweeps.',
        trinity_role: 'verifier',
        requires_mcts: false,
        dependencies: ['scaffold_codebase', 'inject_authentication'],
      });
    }

    // ── ULTRA mode: Security audit step ─────────────────────────────────────
    if (mode === 'ULTRA') {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('security audit', mode),
        action: 'security_audit',
        details: 'TRINITY <role_verifier>: Static analysis — credential leaks, vulnerability scan, RTX-Safety pre-flight.',
        trinity_role: 'verifier',
        requires_mcts: false,
        dependencies: ['run_verification_tests'],
      });
    }

    if (desc.includes('deploy') || desc.includes('publish') || desc.includes('vercel') || desc.includes('netlify')) {
      steps.push({
        step: steps.length + 1,
        tool: routeTask('deploy prod', mode),
        action: 'production_deploy',
        details: 'TRINITY <role_worker>: Deploy finalized workspace to hosting environment.',
        trinity_role: 'worker',
        requires_mcts: false,
        dependencies: ['security_audit', 'run_verification_tests'],
      });
    }

    // ── TRINITY Synthesizer Step ─────────────────────────────────────────────
    steps.push({
      step: steps.length + 1,
      tool: routeTask('synthesize results', mode),
      action: 'synthesize_final_output',
      details: 'TRINITY <role_synthesizer>: Combine all verified outputs into final deliverable + summary.',
      trinity_role: 'synthesizer',
      requires_mcts: false,
      dependencies: steps.map(s => s.action),
    });

    // Register subtasks in goal registry
    const goalEntry = goalRegistry.get(goalId);
    goalEntry.subtasks = steps.map(s => ({ action: s.action, role: s.trinity_role, status: 'PENDING' }));
    goalRegistry.set(goalId, goalEntry);

    console.log(`\n📋 [RTX-Planner] Decomposed into ${steps.length} subtasks (TRINITY roles assigned):`);
    steps.forEach(s => {
      const roleIcon = { thinker: '🧠', worker: '⚙️', verifier: '🔍', synthesizer: '🎯' }[s.trinity_role] || '▪️';
      console.log(`   ${roleIcon} Step ${s.step}: [${s.trinity_role.toUpperCase()}] ${s.action} via ${s.tool}${s.requires_mcts ? ' 🌲 (AB-MCTS)' : ''}`);
    });

    return { plan: steps, goalId };
  }
}

module.exports = RTXPlanner;
