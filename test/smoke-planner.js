#!/usr/bin/env node
'use strict';
/**
 * Smoke test: planner plan-as-data (Conductor paper 3-list format).
 *
 * Run: node test/smoke-planner.js
 * Asserts:
 *  1. every step carries an `access` array (topology, not prose)
 *  2. access indices are valid: integers, strictly earlier steps
 *  3. emitPlanJSON returns 3 ALIGNED lists (worker_ids/subtasks/access_list)
 *  4. synthesizer step sees all prior steps (full access)
 *  5. worker_ids are registry CLIs only
 */
const assert = require('assert');
const RTXPlanner = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-planner');

(async () => {
  const planner = new RTXPlanner();
  const { plan, goalId } = await planner.plan('build backend api with auth and deploy', {}, 'ULTRA');

  // 1. access arrays present
  for (const s of plan) {
    assert.ok(Array.isArray(s.access), `step ${s.step} must carry access[]`);
  }

  // 2. valid indices: integer, 0-based, strictly earlier
  plan.forEach((s, i) => {
    for (const a of s.access) {
      assert.ok(Number.isInteger(a) && a >= 0 && a < i,
        `step ${s.step}: access index ${a} must be an earlier step`);
    }
  });

  // 3. aligned 3-list JSON
  const j = planner.emitPlanJSON(plan, goalId);
  assert.strictEqual(j.goal_id, goalId);
  assert.strictEqual(j.worker_ids.length, plan.length);
  assert.strictEqual(j.subtasks.length, plan.length);
  assert.strictEqual(j.access_list.length, plan.length);
  assert.ok(j.subtasks.every(t => typeof t === 'string' && t.includes(':')), 'subtasks are NL instructions');

  // 4. synthesizer sees everything before it
  const synth = plan[plan.length - 1];
  assert.strictEqual(synth.trinity_role, 'synthesizer');
  assert.deepStrictEqual(synth.access, plan.slice(0, -1).map((_, i) => i));

  // 5. registry-only workers
  const registry = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/config/cli-registry.json');
  for (const w of j.worker_ids) {
    assert.ok(w in registry, `worker_id "${w}" must be a registry CLI`);
  }

  console.log(`✅ smoke-planner: all 5 assertions passed (${plan.length} steps)`);
})().catch(err => { console.error('❌ smoke-planner FAILED:', err.message); process.exit(1); });
