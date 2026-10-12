#!/usr/bin/env node
'use strict';
/**
 * Smoke test: router Fugu honest port — file-persisted history + temperature
 * softmax routing. Uses an isolated history file (RTX_ROUTER_HISTORY_FILE)
 * so the real ledger is untouched.
 *
 * Run: node test/smoke-router.js
 */
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpHist = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rtx-router-test-')), 'history.json');
process.env.RTX_ROUTER_HISTORY_FILE = tmpHist;

const router = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-router');

(async () => {
  // 1. fresh history → neutral 0.5 pass rates, selection still works
  router.resetHistory();
  assert.strictEqual(router.getPassRate('claude_code'), 0.5, 'no history → neutral 0.5');
  const h = router.extractFeatureVector('fix urgent bug in auth code');
  const r1 = router.selectModelFromVector(h, 'ULTRA');
  assert.ok(r1.model && r1.fallbackChain.length >= 2, 'selection returns model + fallback chain');
  const pSum = Object.values(r1.probs).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(pSum - 1) < 1e-9, `softmax probs must sum to 1, got ${pSum}`);

  // 2. recordOutcome persists to file
  router.recordOutcome('claude_code', true);
  router.recordOutcome('claude_code', true);
  router.recordOutcome('gh_cli', false);
  const onDisk = JSON.parse(fs.readFileSync(tmpHist, 'utf-8'));
  assert.strictEqual(onDisk.success.claude_code, 2, 'successes persisted');
  assert.strictEqual(onDisk.fail.gh_cli, 1, 'failures persisted');

  // 3. pass rates reflect history (Laplace smoothing)
  //    claude_code: (2+1)/(2+0+2) = 0.75 ; gh_cli: (0+1)/(0+1+2) ≈ 0.333
  assert.ok(Math.abs(router.getPassRate('claude_code') - 0.75) < 1e-9, 'pass rate 0.75');
  assert.ok(Math.abs(router.getPassRate('gh_cli') - 1 / 3) < 1e-9, 'pass rate 1/3');

  // 4. history survives a fresh require (persistence across processes)
  delete require.cache[require.resolve('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-router')];
  const router2 = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-router');
  assert.ok(Math.abs(router2.getPassRate('claude_code') - 0.75) < 1e-9, 'history reloaded from disk');

  // 5. learned prior MOVES selection: claude_code with strong history beats
  //    its heuristic rival on a neutral task (all-zero feature vector).
  const neutral = { complexity: 0, hasCode: 0, hasResearch: 0, hasDeploy: 0, isUrgent: 0 };
  const r2 = router2.selectModelFromVector(neutral, 'STANDARD');
  assert.strictEqual(r2.model, 'claude_code', `history should elect claude_code, got ${r2.model}`);

  // 6. temperature sharpens/flattens: T→0 ≈ argmax, high T ≈ uniform-ish
  process.env.RTX_ROUTER_TEMPERATURE = '0.001';
  const sharp = router2.selectModelFromVector(neutral, 'STANDARD');
  assert.ok(sharp.probs[sharp.model] > 0.99, 'low T sharpens to near-argmax');
  process.env.RTX_ROUTER_TEMPERATURE = '100';
  const flat = router2.selectModelFromVector(neutral, 'STANDARD');
  const vals = Object.values(flat.probs);
  assert.ok(Math.max(...vals) - Math.min(...vals) < 0.2, 'high T flattens distribution');
  delete process.env.RTX_ROUTER_TEMPERATURE;

  // 7. registry guard preserved (P0): never routes outside the registry
  assert.ok(!('gemini-cli' in (r2.probs || {})), 'no legacy gemini-cli in pool');

  console.log('✅ smoke-router: all 7 assertions passed');
})().catch(err => { console.error('❌ smoke-router FAILED:', err.message); process.exit(1); });
