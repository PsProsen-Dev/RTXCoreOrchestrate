#!/usr/bin/env node
/**
 * RTX score / C-score measurement harness — Team Eval-Scores.
 *
 * Zero npm deps (repo convention). Deterministic: feeds proposed golden tasks
 * through the ACTUAL engine modules (planner / router / verifier / safety /
 * mcts / conductor) of a target repo checkout and scores their behaviour.
 *
 * Usage:
 *   node eval/rtx-eval.js --target /path/to/repo/checkout [--golden eval/golden-tasks.json] [--out eval/results.json]
 *
 * Exit code: 0 on success (scores computed, even if low), 1 on harness/module failure.
 *
 * Honesty rule (from RTXCoreFramework eval kit): anything not measured is
 * reported as "unevaluated", never as 0.
 */
'use strict';

const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { target: null, golden: path.join(__dirname, 'golden-tasks.json'), out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target') a.target = argv[++i];
    else if (argv[i] === '--golden') a.golden = argv[++i];
    else if (argv[i] === '--out') a.out = argv[++i];
  }
  if (!a.target) { console.error('ERROR: --target <repo-checkout-path> required'); process.exit(1); }
  return a;
}

// ─── console muting (engine modules are very chatty) ──────────────────────────
const _orig = { log: console.log, warn: console.warn, error: console.error, info: console.info };
function mute() { for (const k of Object.keys(_orig)) console[k] = () => {}; }
function unmute() { for (const k of Object.keys(_orig)) console[k] = _orig[k]; }

// ─── shared golden code samples ───────────────────────────────────────────────
const SOLID_PLAIN = [
  'async function buildPipeline(config) {',
  '  const results = [];',
  '  try {',
  '    const conn = await connectDb(config.dsn);',
  '    for (const job of config.jobs) {',
  '      const out = await processJob(job, conn);',
  '      results.push(out);',
  '    }',
  '    await conn.close();',
  '    return results;',
  '  } catch (err) {',
  '    logError(err);',
  '    throw err;',
  '  }',
  '}',
].join('\n');
const TODO_CODE = SOLID_PLAIN + '\n// TODO: fix edge case in job 3';
const PREMIUM_SHORT = 'Premium advanced implementation.';

function resolveOutput(ref) {
  if (ref === 'good') return SOLID_PLAIN;
  if (ref === 'todo') return TODO_CODE;
  return ref;
}

// ─── result collector ─────────────────────────────────────────────────────────
function newSuite(name) { return { name, cases: [], pass: 0, total: 0 }; }
function record(suite, id, ok, detail) {
  suite.cases.push({ id, ok: !!ok, detail: detail || '' });
  suite.total++; if (ok) suite.pass++;
}
function rate(s) { return s.total ? s.pass / s.total : null; }

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const core = path.join(args.target, 'Antigravity Ultimate (RTX⚡)', 'RTX-Engine', 'core');
  const golden = JSON.parse(fs.readFileSync(args.golden, 'utf8'));
  const registry = JSON.parse(fs.readFileSync(path.join(core, '..', 'config', 'cli-registry.json'), 'utf8'));

  // Require ACTUAL engine modules from the target checkout.
  const RTXPlanner = require(path.join(core, 'rtx-planner.js'));
  const router = require(path.join(core, 'rtx-router.js'));
  const RTXVerifier = require(path.join(core, 'rtx-verifier.js'));
  const RTXSafetyLayer = require(path.join(core, 'rtx-safety.js'));
  const RTXMCTS = require(path.join(core, 'rtx-mcts.js'));
  const RTXConductor = require(path.join(core, 'rtx-conductor.js'));
  const BaseAdapter = require(path.join(core, 'adapters', 'BaseAdapter.js'));
  const RTXSession = require(path.join(core, 'rtx-session.js'));

  const results = { target: args.target, golden_version: golden.version, suites: {}, composites: {} };

  // ── P_plan: planner structural validity ────────────────────────────────────
  {
    const s = newSuite('P_plan');
    const planner = new RTXPlanner();
    mute();
    for (const g of golden.planner.goals) {
      let plan;
      try { ({ plan } = await planner.plan(g.goal, registry, 'STANDARD')); }
      catch (e) { unmute(); record(s, g.id, false, 'plan() threw: ' + e.message); mute(); continue; }
      const roles = new Set(plan.map(st => st.trinity_role));
      const need = ['thinker', 'worker', 'verifier', 'synthesizer'];
      const okRoles = need.every(r => roles.has(r));
      const okTools = plan.every(st => st.tool && registry[st.tool]);
      const okShape = plan.length > 0 && plan.every(st => st.action && st.trinity_role);
      record(s, g.id, okRoles && okTools && okShape,
        `steps=${plan.length} roles=[${[...roles].join(',')}] allToolsValid=${okTools}`);
    }
    unmute();
    results.suites.P_plan = { ...s, rate: rate(s) };
  }

  // ── P_route: router correctness vs intended mapping ────────────────────────
  {
    const s = newSuite('P_route');
    mute();
    for (const c of golden.router) {
      let model;
      try { model = router.routeTask(c.desc, 'ULTRA'); }
      catch (e) { unmute(); record(s, c.id, false, 'routeTask threw: ' + e.message); mute(); continue; }
      const valid = !!registry[model];
      record(s, c.id, model === c.expected && valid,
        `got=${model} expected=${c.expected} registryValid=${valid}` + (c.note ? ` | ${c.note}` : ''));
    }
    unmute();
    results.suites.P_route = { ...s, rate: rate(s) };
  }

  // ── P_verify: verifier discrimination ──────────────────────────────────────
  {
    const s = newSuite('P_verify');
    mute();
    for (const c of golden.verifier.cases) {
      const output = c.output_ref ? resolveOutput(c.output_ref) : c.output;
      let r;
      try { r = await RTXVerifier.verify(golden.verifier.step, output); }
      catch (e) { unmute(); record(s, c.id, false, 'verify threw: ' + e.message); mute(); continue; }
      record(s, c.id, r.passed === c.expected_pass,
        `${c.name}: passed=${r.passed} (expected ${c.expected_pass}) score=${r.score}` + (c.note ? ` | ${c.note}` : ''));
    }
    unmute();
    results.suites.P_verify = { ...s, rate: rate(s) };
  }

  // ── P_select: candidate-selection correctness ──────────────────────────────
  {
    const s = newSuite('P_select');
    mute();
    for (const c of golden.branch_select) {
      const branches = c.branches_ref
        ? c.branches_ref.map(r => (r === 'premium_short' ? PREMIUM_SHORT : SOLID_PLAIN))
        : (c.id === 'BS-3' ? [c.branches[0], 'ERROR: build failed\n' + SOLID_PLAIN] : c.branches);
      let idx;
      try { idx = await RTXVerifier.compareBranches(branches); }
      catch (e) { unmute(); record(s, c.id, false, 'compareBranches threw: ' + e.message); mute(); continue; }
      record(s, c.id, idx === c.expected_index,
        `selected=${idx} expected=${c.expected_index}` + (c.note ? ` | ${c.note}` : ''));
    }
    unmute();
    results.suites.P_select = { ...s, rate: rate(s) };
  }

  // ── P_safety: destructive-command + credential classification ──────────────
  {
    const s = newSuite('P_safety');
    mute();
    for (const c of golden.safety_commands) {
      const r = RTXSafetyLayer.checkCommand(c.payload);
      record(s, c.id, r.isSafe === c.expected_safe,
        `isSafe=${r.isSafe} (expected ${c.expected_safe}) :: ${c.payload.details}`);
    }
    for (const c of golden.safety_credentials) {
      const r = RTXSafetyLayer.checkForCredentialLeaks(c.payload);
      record(s, c.id, r.hasLeak === c.expected_leak,
        `hasLeak=${r.hasLeak} (expected ${c.expected_leak})`);
    }
    unmute();
    results.suites.P_safety = { ...s, rate: rate(s) };
  }

  // ── MCTS honesty probe (informational, not in composite) ───────────────────
  {
    const mcts = new RTXMCTS();
    const perBranch = { 1: new Set(), 2: new Set(), 3: new Set() };
    mute();
    for (const q of golden.mcts_honesty.queries)
      for (const b of [1, 2, 3]) perBranch[b].add(mcts.evaluateBranch(b, q));
    unmute();
    const hardcoded = [1, 2, 3].every(b => perBranch[b].size === 1);
    results.suites.MCTS_honesty = {
      name: 'MCTS_honesty (informational)',
      hardcoded,
      note: hardcoded
        ? 'evaluateBranch returns identical scores for all queries — hardcoded, not a real search (matches review §2.2)'
        : 'evaluateBranch varies with query — real scoring signal present',
      scores: Object.fromEntries([1, 2, 3].map(b => [b, [...perBranch[b]]])),
    };
  }

  // ── C_route: heuristic conductor routing accuracy ──────────────────────────
  // RTXHeuristicConductor is module-internal in rtx-conductor.js (not exported).
  // We isolate the REAL class source (everything before "class RTXConductor")
  // and compile it separately — so this suite tests actual code, not a copy.
  {
    const s = newSuite('C_route');
    const src = fs.readFileSync(path.join(core, 'rtx-conductor.js'), 'utf8');
    const cutAt = src.indexOf('\nclass RTXConductor');
    if (cutAt < 0) throw new Error('could not isolate RTXHeuristicConductor from rtx-conductor.js');
    const Module = require('module');
    const isoFilename = path.join(core, 'rtx-heuristic-conductor.isolated.js');
    const iso = new Module(isoFilename, module);
    iso.filename = isoFilename;
    iso.paths = Module._nodeModulePaths(path.dirname(isoFilename));
    iso._compile(
      src.slice(0, cutAt) + '\nmodule.exports = RTXHeuristicConductor;\n',
      isoFilename
    );
    const HC = iso.exports;
    mute();
    for (const c of golden.heuristic_conductor) {
      const complexity = HC.computeComplexity(c.step);
      const model = HC.selectModel(c.step.trinity_role, complexity);
      record(s, c.id, model === c.expected && !!registry[model],
        `got=${model} expected=${c.expected} complexity=${complexity.toFixed(2)}` + (c.note ? ` | ${c.note}` : ''));
    }
    unmute();
    results.suites.C_route = { ...s, rate: rate(s) };
  }

  // ── C_exec + C_complete + C_retry: instrumented end-to-end conductor runs ──
  {
    const sExec = newSuite('C_exec');
    const sComplete = newSuite('C_complete');
    let failedVerifications = 0;
    let retriedStepsRecovered = null; // unevaluated unless failures observed

    const origRun = BaseAdapter.prototype.run;
    let runInvocations = 0;
    BaseAdapter.prototype.run = async function (...a) { runInvocations++; return origRun.apply(this, a); };

    const origVerify = RTXVerifier.verify;
    RTXVerifier.verify = async function (step, output) {
      const r = await origVerify.call(this, step, output);
      if (!r.passed) failedVerifications++;
      return r;
    };

    const origComplete = RTXSession.prototype.complete;
    const completions = [];
    RTXSession.prototype.complete = function (status) { completions.push(status); return origComplete.call(this, status); };

    const planner = new RTXPlanner();
    const goals = golden.conductor_e2e.goals;
    const modes = { standard: false, ultra: true };
    mute();
    for (const [modeName, isUltra] of Object.entries(modes)) {
      const goal = goals[modeName === 'standard' ? 0 : 1];
      let plan;
      try { ({ plan } = await planner.plan(goal, registry, isUltra ? 'ULTRA' : 'STANDARD')); }
      catch (e) { unmute(); record(sExec, `exec-${modeName}`, false, 'plan() threw'); record(sComplete, `complete-${modeName}`, false, 'plan() threw'); mute(); continue; }
      const steps = plan.length;
      runInvocations = 0; completions.length = 0;
      const conductor = new RTXConductor(isUltra);
      let threw = null;
      try { await conductor.processGoal(goal); } catch (e) { threw = e; }
      const execRate = steps ? runInvocations / steps : null;
      record(sExec, `exec-${modeName}`, execRate === 1,
        threw ? `threw: ${threw.message}`
              : `adapter.run() invoked ${runInvocations}/${steps} steps (real-execution rate=${execRate === null ? 'n/a' : execRate.toFixed(3)})`);
      const completed = !threw && completions.includes('COMPLETED');
      record(sComplete, `complete-${modeName}`, completed,
        threw ? `threw: ${threw.message}` : `session.complete status: ${completions.join(',') || 'none'}`);
    }
    unmute();
    BaseAdapter.prototype.run = origRun;
    RTXVerifier.verify = origVerify;
    RTXSession.prototype.complete = origComplete;

    results.suites.C_exec = { ...sExec, rate: rate(sExec) };
    results.suites.C_complete = { ...sComplete, rate: rate(sComplete) };

    // C_retry: retry efficiency — meaningful only if failures were injected/observed.
    const sRetry = newSuite('C_retry');
    if (failedVerifications === 0) {
      sRetry.unevaluated = true;
      sRetry.note = `unevaluated — 0 failed verifications across ${Object.keys(modes).length} pipeline runs, so no retry was ever triggered. The retry loop (MAX_RETRIES=${'3 ultra / 1 standard'}) was never exercised. Re-run after real execution is wired (failures will occur).`;
    } else {
      record(sRetry, 'retry-recovery', false, `${failedVerifications} failed verifications observed — recovery attribution not yet instrumented`);
    }
    results.suites.C_retry = { ...sRetry, rate: rate(sRetry) };
  }

  // ── composites ─────────────────────────────────────────────────────────────
  const rtxParts = ['P_plan', 'P_route', 'P_verify', 'P_select', 'P_safety'].map(k => results.suites[k].rate);
  results.composites.RTX_score = {
    value: rtxParts.every(v => v !== null) ? rtxParts.reduce((a, b) => a + b, 0) / rtxParts.length * 100 : null,
    parts: Object.fromEntries(['P_plan', 'P_route', 'P_verify', 'P_select', 'P_safety'].map((k, i) => [k, rtxParts[i]])),
    weights: 'equal (0.2 each) — proposed, user-correctable',
  };
  const cParts = [['C_route', 'C_exec', 'C_retry', 'C_complete']].flat()
    .map(k => (results.suites[k].unevaluated ? null : results.suites[k].rate));
  const cEval = cParts.filter(v => v !== null);
  results.composites.C_score = {
    value: cEval.length ? cEval.reduce((a, b) => a + b, 0) / cEval.length * 100 : null,
    parts: Object.fromEntries(['C_route', 'C_exec', 'C_retry', 'C_complete'].map((k, i) => [k, cParts[i] === null ? 'unevaluated' : cParts[i]])),
    weights: 'mean over EVALUATED submetrics only (RTXCoreFramework eval-kit honesty rule)',
  };

  // ── output ─────────────────────────────────────────────────────────────────
  const out = JSON.stringify(results, null, 2);
  if (args.out) fs.writeFileSync(args.out, out, 'utf8');
  process.stdout.write(out + '\n');

  // Human-readable summary table
  const L = [];
  L.push('');
  L.push('=== RTX score / C-score ===');
  L.push(`target: ${args.target}`);
  for (const k of ['P_plan', 'P_route', 'P_verify', 'P_select', 'P_safety']) {
    const s = results.suites[k];
    L.push(`${k.padEnd(9)} ${(s.rate * 100).toFixed(1).padStart(6)}%   (${s.pass}/${s.total})`);
  }
  L.push(`RTX score: ${results.composites.RTX_score.value === null ? 'unevaluated' : results.composites.RTX_score.value.toFixed(1) + ' / 100'}`);
  L.push('');
  for (const k of ['C_route', 'C_exec', 'C_retry', 'C_complete']) {
    const s = results.suites[k];
    L.push(`${k.padEnd(9)} ${s.unevaluated ? 'unevaluated' : (s.rate * 100).toFixed(1).padStart(6) + '%'}   (${s.pass}/${s.total})${s.note ? '  ← ' + s.note.split('.')[0] : ''}`);
  }
  L.push(`C-score:   ${results.composites.C_score.value === null ? 'unevaluated' : results.composites.C_score.value.toFixed(1) + ' / 100'}`);
  L.push(`MCTS honesty probe: ${results.suites.MCTS_honesty.hardcoded ? 'HARDCODED (mock)' : 'real signal'}`);
  L.push('');
  process.stderr.write(L.join('\n'));
  return 0;
}

main().then(c => process.exit(c)).catch(e => { unmute(); console.error('HARNESS FAILURE:', e); process.exit(1); });
