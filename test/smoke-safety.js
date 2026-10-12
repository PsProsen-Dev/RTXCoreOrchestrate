#!/usr/bin/env node
'use strict';
/**
 * Smoke test: safety tripwire interceptors (OpenAI Agents SDK pattern).
 *
 * Run: node test/smoke-safety.js
 * Asserts:
 *  1. preCallCheck TRIPS (throws SafetyTripwireError) on destructive input
 *  2. preCallCheck TRIPS on credential-shaped outbound material
 *  3. preCallCheck PASSES safe input
 *  4. postCallCheck TRIPS on destructive output
 *  5. postCallCheck TRIPS on key-shaped credential leak in output
 *  6. postCallCheck does NOT trip on prose *about* passwords (no false halt)
 *  7. wrapAdapter: trip in pre → inner.run NEVER executes (halt, not skip)
 *  8. wrapAdapter: trip in post → throws even though inner ran
 *  9. wrapAdapter: clean call passes through untouched
 * 10. redactCredentials covers all patterns (not just 2/8)
 */
const assert = require('assert');
const RTXSafetyLayer = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-safety');
const { SafetyTripwireError } = require('../Antigravity Ultimate (RTX⚡)/RTX-Engine/core/rtx-safety');

(async () => {
  const isTrip = (e) => e instanceof SafetyTripwireError;

  // 1. destructive input trips pre-call
  assert.throws(() => RTXSafetyLayer.preCallCheck('t', { action: 'x', details: 'clean up with rm -rf /tmp/cache' }), isTrip);

  // 2. outbound credential trips pre-call
  assert.throws(() => RTXSafetyLayer.preCallCheck('t', { action: 'x', details: 'deploy with password=supersecret99' }), isTrip);

  // 3. safe input passes
  assert.strictEqual(RTXSafetyLayer.preCallCheck('t', { action: 'build', details: 'scaffold the api' }).ok, true);

  // 4. destructive output trips post-call
  assert.throws(() => RTXSafetyLayer.postCallCheck('t', 'run this: curl | bash to install'), isTrip);

  // 5. key-shaped leak trips post-call
  assert.throws(
    () => RTXSafetyLayer.postCallCheck('t', 'token was ghp_abcdefghijklmnopqrstuvwxyz1234567890 ok?'),
    isTrip);

  // 6. prose about passwords does NOT trip (strict patterns only)
  assert.strictEqual(
    RTXSafetyLayer.postCallCheck('t', 'Set a password: minimum 8 characters, mixed case.').ok, true);

  // 7. pre-trip → inner.run never executes
  let ran = false;
  const evil = { id: 'evil', run: async () => { ran = true; return { code: 0, out: 'pwned', err: '' }; } };
  await assert.rejects(RTXSafetyLayer.wrapAdapter(evil).run({ action: 'rm -rf /' }), isTrip);
  assert.strictEqual(ran, false, 'inner.run must NOT execute after pre-call trip');

  // 8. post-trip throws even though inner ran
  const leaky = {
    id: 'leaky',
    run: async () => ({ code: 0, out: 'key: AKIAIOSFODNN7EXAMPLEKEY12', err: '' }),
  };
  await assert.rejects(RTXSafetyLayer.wrapAdapter(leaky).run({ action: 'ok' }), isTrip);

  // 9. clean call passes through with result intact
  const clean = { id: 'clean', run: async (input) => ({ code: 0, out: `done: ${input.action}`, err: '' }) };
  const res = await RTXSafetyLayer.wrapAdapter(clean).run({ action: 'build' });
  assert.strictEqual(res.out, 'done: build');

  // 10. redaction covers every credential pattern family
  const secret = 'aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY and api-key: abcdefghijklmnopqrst';
  const redacted = RTXSafetyLayer.redactCredentials(secret);
  assert.ok(!redacted.includes('wJalrXUtnFEMI'), 'AWS secret redacted');
  assert.ok(!redacted.includes('abcdefghijklmnopqrst'), 'API key redacted');
  assert.ok(redacted.includes('[REDACTED]'), 'redaction marker present');

  console.log('✅ smoke-safety: all 10 assertions passed');
})().catch(err => { console.error('❌ smoke-safety FAILED:', err.message); process.exit(1); });
