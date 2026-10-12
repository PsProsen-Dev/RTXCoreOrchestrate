#!/usr/bin/env node
'use strict';
/**
 * Smoke test: verifier scoring honesty.
 *
 * Run: node test/smoke-verifier.js
 * Asserts:
 *  1. scoreNormalized always lands in [0,1]
 *  2. empty output scores 0 (no partial credit)
 *  3. credential leak in candidate → hard 0
 *  4. ERROR(code=N) failure dump scores BELOW mock output (never wins)
 *  5. mock output scores BELOW real substantive output
 *  6. NO keyword rigging: 'premium/advanced' fluff loses to substantive text
 *  7. scoreReasoning discriminates (spread across candidates, in [0,1])
 *  8. llmJudge degrades gracefully (no RTX_JUDGE_CMD → null, never throws)
 *  9. compareBranches picks the substantive branch, not the fluff one
 */
const assert = require('assert');
const RTXVerifier = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-verifier');

const in01 = (x, label) => assert.ok(x >= 0 && x <= 1, `${label} in [0,1], got ${x}`);

(async () => {
  const mock = '[MOCK] copilot_cli executed: scaffold_codebase';
  const errDump = 'ERROR(code=1): unknown command "scaffold_codebase"\n' + 'usage text '.repeat(120);
  const fluff = 'Premium advanced implementation. Very premium. Advanced synergy.';
  const substance = [
    '# Implementation plan',
    '- Add GET /notes with pagination (page, limit)',
    '- POST /notes validates title (min 3 chars) and body',
    '- try/catch around DB calls; async handlers throughout',
    '- 12 unit tests covering empty-title and DB-failure paths',
  ].join('\n');

  // 1. range
  for (const [t, l] of [[mock, 'mock'], [errDump, 'errDump'], [fluff, 'fluff'], [substance, 'substance'], ['', 'empty']]) {
    in01(RTXVerifier.scoreNormalized(t), `scoreNormalized(${l})`);
    in01(RTXVerifier.scoreReasoning(t), `scoreReasoning(${l})`);
  }

  // 2. empty → 0
  assert.strictEqual(RTXVerifier.scoreNormalized('   '), 0, 'empty scores 0');

  // 3. leak → hard 0
  assert.strictEqual(
    RTXVerifier.scoreNormalized('config: ghp_abcdefghijklmnopqrstuvwxyz1234567890'), 0, 'leak scores 0');

  // 4. failure dump < mock
  assert.ok(RTXVerifier.scoreNormalized(errDump) < RTXVerifier.scoreNormalized(mock),
    'ERROR(code=N) dump must score below mock output');

  // 5. mock < substantive real output
  assert.ok(RTXVerifier.scoreNormalized(mock) < RTXVerifier.scoreNormalized(substance),
    'mock must score below substantive output');

  // 6. no keyword rigging — the old '+25 for premium/advanced' is gone
  assert.ok(RTXVerifier.scoreNormalized(fluff) < RTXVerifier.scoreNormalized(substance),
    'keyword fluff must NOT beat substantive output');

  // 7. scoreReasoning discriminates
  const cands = [
    'Short take.',
    'Decompose the problem: scope, constraints, and three candidate approaches with trade-offs? List hard constraints first.',
    'Risk review: identify three failure modes (auth bypass, data loss, downtime), propose mitigations, re-rank by residual risk. Which option survives all three? Evidence: prior incident reports.',
  ];
  const scores = cands.map(c => RTXVerifier.scoreReasoning(c));
  assert.ok(new Set(scores.map(s => s.toFixed(2))).size >= 2, 'reasoning scorer must spread candidates');
  assert.ok(scores[2] > scores[0], 'richer reasoning scores higher');

  // 8. llmJudge graceful degrade
  delete process.env.RTX_JUDGE_CMD;
  assert.strictEqual(await RTXVerifier.llmJudge('anything'), null, 'no judge cmd → null');
  process.env.RTX_JUDGE_CMD = '/nonexistent-binary-rtx-test';
  assert.strictEqual(await RTXVerifier.llmJudge('anything'), null, 'bad judge cmd → null, not throw');
  delete process.env.RTX_JUDGE_CMD;

  // 9. compareBranches: substance wins over fluff AND over mock
  const idx = await RTXVerifier.compareBranches([fluff, mock, substance]);
  assert.strictEqual(idx, 2, `compareBranches must pick substance (index 2), got ${idx}`);

  console.log('✅ smoke-verifier: all 9 assertions passed');
})().catch(err => { console.error('❌ smoke-verifier FAILED:', err.message); process.exit(1); });
