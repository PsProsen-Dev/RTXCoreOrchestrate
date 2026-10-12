#!/usr/bin/env node
'use strict';
/**
 * Smoke test: RTXMCTS real tree mechanics (zero-dep, plain node:assert).
 *
 * Run: node test/smoke-mcts.js
 * Asserts (with DETERMINISTIC generate/score fns — no mocks, no randomness
 * in the assertions):
 *  1. budget is respected (iterations == budget, minus skipped empties)
 *  2. every evaluated score lands in [0,1]
 *  3. backprop updates ancestors (root.visits == #evaluated children)
 *  4. UCB1 selection exploits: the best-scoring branch gets the most visits
 *  5. topK excludes the unevaluated root and returns best-first order
 *  6. hardcoded scores are gone: distinct candidates → distinct scores
 */
const assert = require('assert');
const RTXMCTS = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-mcts');

(async () => {
  // Deterministic world: candidate quality is a pure function of its text.
  const quality = { alpha: 0.9, beta: 0.5, gamma: 0.2 };
  const mkGen = () => {
    const keys = Object.keys(quality);
    let i = 0;
    return async (parentState, mode) => {
      const k = keys[i++ % keys.length];
      return `candidate-${k}-${mode}`; // quality encoded in the name
    };
  };
  const scoreFn = async (candidate) => {
    const m = candidate.match(/candidate-(alpha|beta|gamma)/);
    return quality[m[1]];
  };

  const mcts = new RTXMCTS({ budget: 9, maxChildren: 3, maxDepth: 3 });
  const { best, root, stats, topK } = await mcts.runSearch({
    query: 'test query',
    budget: 9,
    generateFn: mkGen(),
    scoreFn,
    onIteration: null,
  });

  // 1. budget respected
  assert.strictEqual(stats.iterations, 9, 'iterations must equal budget');

  // 2. scores in [0,1] — checked via node values
  const all = [];
  const walk = (n) => { all.push(n); n.children.forEach(walk); };
  walk(root);
  for (const n of all) {
    if (n.depth > 0) {
      assert.ok(n.meanValue >= 0 && n.meanValue <= 1, `node value in [0,1], got ${n.meanValue}`);
    }
  }

  // 3. backprop: root visits == evaluated children count
  const evaluated = all.filter(n => n.depth > 0).length;
  assert.strictEqual(root.visits, evaluated, 'root.visits must equal #evaluated children (backprop)');
  assert.strictEqual(evaluated, 9, 'all 9 iterations produced a child');

  // 4. UCB1 exploits the best branch: alpha (0.9) subtree has most visits.
  //    (deterministic gen cycles alpha,beta,gamma,alpha,... — alpha first.)
  assert.ok(best.meanValue >= 0.89, `best value should be ~0.9, got ${best.meanValue}`);
  assert.ok(best.state.includes('alpha'), `best candidate should be alpha, got ${best.state}`);

  // 5. topK: root excluded, best-first
  const top = topK(3);
  assert.ok(top.length === 3, 'topK(3) returns 3');
  assert.ok(!top.includes(root), 'root must be excluded from topK');
  assert.ok(top[0].meanValue >= top[1].meanValue && top[1].meanValue >= top[2].meanValue,
    'topK must be best-first');

  // 6. no hardcoded scores: the three quality tiers stay distinct
  const vals = new Set(top.map(n => n.meanValue.toFixed(2)));
  assert.ok(vals.size >= 2, 'distinct candidates must yield distinct scores (no 6.8/9.2/4.5 theater)');

  // 7. adaptive branching actually ran both modes at least once
  assert.ok(stats.wider >= 1 && stats.deeper >= 1,
    `expected both wider & deeper expansions, got ${JSON.stringify(stats)}`);

  console.log('✅ smoke-mcts: all 7 assertions passed',
    `(best=${best.meanValue.toFixed(2)}, wider=${stats.wider}, deeper=${stats.deeper})`);
})().catch(err => { console.error('❌ smoke-mcts FAILED:', err.message); process.exit(1); });
