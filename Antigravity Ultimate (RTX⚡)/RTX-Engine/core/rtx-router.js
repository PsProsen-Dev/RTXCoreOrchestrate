/**
 * RTX-Router — 5D Feature Vector Selection Head (Fugu-Style)
 *
 * Team Discussion Final Decision:
 * - Antigravity IDE (RTX⚡): 5D feature vector approach (simple + fast)
 * - Ultron (RTX⚡):          Add historyMultiplier for adaptive weight adjustment
 * - Antigravity 2.0 (RTX⚡): Casting vote — 5D vector + regex token group compromise
 *
 * Fugu Technical Report inspired:
 * "A lightweight selection head operating on the backbone's hidden state
 *  vector h ∈ ℝᵈ, bypassing slow autoregressive token generation."
 *
 * Our Node.js simulation: h = 5D feature vector derived from task description.
 * historyMultiplier = Ultron's adaptive weight from past failures.
 *
 * RTXCoreFramework Section 8.3 — Model Selection Head
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── Registry-Only Routing (P0 fix) ──────────────────────────────────────────
// The router may ONLY route to CLIs that exist in config/cli-registry.json.
// Legacy ids ('gemini-cli', 'marlin') are not registered — routing to them used
// to make the conductor crash in getAdapter(). Now they are impossible.
let _registryCliIds = ['claude_code', 'gh_cli', 'copilot_cli']; // safe default
try {
  const registryPath = path.join(__dirname, '../config/cli-registry.json');
  _registryCliIds = Object.keys(JSON.parse(fs.readFileSync(registryPath, 'utf-8')));
} catch (err) {
  console.warn(`⚠️  [RTX-Router] Could not load cli-registry.json (${err.message}) — using default CLI set.`);
}
const ALLOWED_CLIS = new Set(_registryCliIds);

// ─── File-Persisted Outcome History (Fugu honest port) ───────────────────────
// Fugu's real mechanism is "learn from historical worker performance".
// recordOutcome() used to die with the process — now every outcome is
// appended to a JSON ledger under ~/.local/share/rtx/ (runtime state lives
// OUTSIDE the repo; review P1 #10). Selections blend this learned prior
// with the fast 5D heuristic via temperature-scaled softmax.
function _historyFilePath() {
  if (process.env.RTX_ROUTER_HISTORY_FILE) return process.env.RTX_ROUTER_HISTORY_FILE;
  try {
    const dir = path.join(os.homedir(), '.local', 'share', 'rtx');
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'router-history.json');
  } catch {
    return path.join(os.tmpdir(), 'rtx-router-history.json');
  }
}
const HISTORY_FILE = _historyFilePath();

function _freshHistory() {
  const h = { success: {}, fail: {} };
  for (const cli of ALLOWED_CLIS) { h.success[cli] = 0; h.fail[cli] = 0; }
  return h;
}

function loadHistory() {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return _freshHistory();
    parsed.success = parsed.success || {};
    parsed.fail = parsed.fail || {};
    return parsed;
  } catch {
    return _freshHistory();
  }
}

let _persisted = loadHistory();

function _saveHistory() {
  try {
    const tmp = HISTORY_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_persisted, null, 2));
    fs.renameSync(tmp, HISTORY_FILE); // atomic — no half-written ledger
  } catch (err) {
    console.warn(`⚠️  [RTX-Router] Could not persist outcome history (${err.message}) — continuing in-memory.`);
  }
}

/** Test/ops helper: clears the persisted ledger. */
function resetHistory() {
  _persisted = _freshHistory();
  _saveHistory();
}

// ─── Legacy Pattern Routing Map (registry-only targets) ─────────────────────
const ROUTING_MAP = {
  'git|repo|pr|issue|release|branch': 'gh_cli',
  'review|explain|refactor|debug':    'copilot_cli',
  // Research/web/vision/design tasks have no dedicated CLI in the registry —
  // claude_code is the registry's general-purpose LLM worker, so they land here.
  'image|vision|creative|design':     'claude_code',
  'generate|scaffold|boilerplate':    'claude_code',
  'translate|math|chinese':           'claude_code',
  'search|web|research':              'claude_code',
};

// ─── Adaptive History Multiplier (Ultron's contribution) ─────────────────────
// Tracks failure counts per model — adjusts selection weights dynamically.
// Keys are restricted to registry CLIs (P0 fix — legacy 'gemini-cli' removed).
const _historyState = {
  failCounts: { claude_code: 0, copilot_cli: 0, gh_cli: 0 },
  successCounts: { claude_code: 0, copilot_cli: 0, gh_cli: 0 },
};

/**
 * Records outcome for a model — updates adaptive history weights AND the
 * file-persisted Fugu ledger (survives process restarts).
 * @param {string} model - model id (must be a registry CLI)
 * @param {boolean} success - did it succeed?
 */
function recordOutcome(model, success) {
  if (!ALLOWED_CLIS.has(model)) {
    console.warn(`⚠️  [RTX-Router] recordOutcome for unregistered CLI "${model}" — ignoring.`);
    return;
  }
  if (success) {
    _historyState.successCounts[model] = (_historyState.successCounts[model] || 0) + 1;
    _persisted.success[model] = (_persisted.success[model] || 0) + 1;
  } else {
    _historyState.failCounts[model] = (_historyState.failCounts[model] || 0) + 1;
    _persisted.fail[model] = (_persisted.fail[model] || 0) + 1;
  }
  _saveHistory();
}

/**
 * Historical pass-rate for a model with Laplace smoothing: (s+1)/(s+f+2).
 * A model with no history scores 0.5 — neutral, never punished for being new.
 */
function getPassRate(model) {
  const s = _persisted.success[model] || 0;
  const f = _persisted.fail[model] || 0;
  return (s + 1) / (s + f + 2);
}

/**
 * Computes historyMultiplier for a model.
 * Higher failures → lower multiplier → deprioritized in selection.
 * Range: 0.1 (many failures) → 1.0 (no failures)
 */
function getHistoryMultiplier(model) {
  const fails = _historyState.failCounts[model] || 0;
  const successes = _historyState.successCounts[model] || 0;
  const total = fails + successes;
  if (total === 0) return 1.0;
  const successRate = successes / total;
  return Math.max(0.1, successRate); // Clamp minimum to 0.1 (never fully exclude)
}

// ─── 5D Feature Vector Extractor (Antigravity IDE's design) ──────────────────

/**
 * Extracts a 5D feature vector from a task description string.
 * h = [complexity, hasCode, hasResearch, hasDeploy, isUrgent]
 *
 * Each dimension: float 0.0–1.0
 */
function extractFeatureVector(taskDescription) {
  const desc = taskDescription.toLowerCase();

  // Dimension 1: Complexity (keyword density + length signal)
  const complexKeywords = ['architecture', 'integrate', 'system', 'pipeline', 'orchestrat', 'framework', 'multi', 'distributed'];
  const complexScore = complexKeywords.filter(k => desc.includes(k)).length / complexKeywords.length;
  const complexity = Math.min(1.0, complexScore + (desc.length > 200 ? 0.3 : 0));

  // Dimension 2: hasCode (coding task signals)
  const codeKeywords = ['code', 'function', 'api', 'backend', 'frontend', 'class', 'module', 'script', 'implement', 'scaffold', 'auth', 'app', 'react', 'node', 'python'];
  const hasCode = codeKeywords.some(k => desc.includes(k)) ? 1.0 : 0.0;

  // Dimension 3: hasResearch (research/analysis task signals)
  const researchKeywords = ['research', 'analyze', 'analyze', 'search', 'find', 'investigate', 'report', 'study', 'compare', 'explain', 'web'];
  const hasResearch = researchKeywords.some(k => desc.includes(k)) ? 1.0 : 0.0;

  // Dimension 4: hasDeploy (deployment/ops task signals)
  const deployKeywords = ['deploy', 'publish', 'release', 'vercel', 'netlify', 'ci', 'cd', 'pipeline', 'docker', 'production', 'push'];
  const hasDeploy = deployKeywords.some(k => desc.includes(k)) ? 1.0 : 0.0;

  // Dimension 5: isUrgent (urgency signals)
  const urgentKeywords = ['urgent', 'asap', 'immediately', 'critical', 'fix', 'hotfix', 'bug', 'broken', 'error', 'fail'];
  const isUrgent = urgentKeywords.some(k => desc.includes(k)) ? 1.0 : 0.0;

  return { complexity, hasCode, hasResearch, hasDeploy, isUrgent };
}

// ─── Selection Head — Fugu-Style Model Selector ───────────────────────────────

/**
 * Selection head: maps 5D feature vector → { model, confidence, fallbackChain }
 * Applies historyMultiplier (Ultron) for adaptive weight adjustment.
 *
 * Returns routing decision in both STANDARD and ULTRA modes.
 */
function selectModelFromVector(h, mode = 'ULTRA') {
  // Base scores per model from feature dimensions.
  // P0 fix: scored models are exactly the registry CLIs — nothing else can win.
  const scores = {
    'claude_code': (h.hasCode * 0.6) + (h.complexity * 0.4) + (h.hasResearch * 0.5),
    'copilot_cli': (h.hasCode * 0.4) + (0.3),
    'gh_cli':      (h.hasDeploy * 0.9) + (0.1),
  };

  // Unknown registry CLIs (future additions) participate with a flat base score.
  for (const cliId of ALLOWED_CLIS) {
    if (!(cliId in scores)) scores[cliId] = 0.2;
  }

  // Apply Ultron's historyMultiplier — adaptive weight adjustment
  for (const model of Object.keys(scores)) {
    scores[model] *= getHistoryMultiplier(model);
  }

  // ULTRA mode: boost claude_code for high-complexity tasks
  if (mode === 'ULTRA' && h.complexity > 0.6) {
    scores['claude_code'] = Math.min(1.0, scores['claude_code'] + 0.2);
  }

  // ── Fugu layer: historical performance → temperature-scaled softmax ────────
  // The fast 5D heuristic above is the "poor-man's hidden state head"
  // (UNIQUE-RAKHO). This layer is Fugu's actual learned mechanism:
  // soft targets from historical worker pass-rates, blended with the
  // heuristic, then temperature-scaled softmax over the pool.
  //   logit_i = (1-λ)·heuristic_i + λ·passRate_i ;  p_i = softmax(logit/T)_i
  // λ=0.6: when outcomes exist the learned prior dominates; with no history
  // (all priors 0.5) the heuristic decides — as it should.
  // T→0 sharpens toward argmax, T→∞ flattens. Default T=1.0, env-overridable.
  const HISTORY_WEIGHT = 0.6;
  let temperature = parseFloat(process.env.RTX_ROUTER_TEMPERATURE || '1.0');
  if (!Number.isFinite(temperature) || temperature <= 0) temperature = 1.0;

  const logits = {};
  for (const model of Object.keys(scores)) {
    logits[model] = scores[model] * (1 - HISTORY_WEIGHT) + getPassRate(model) * HISTORY_WEIGHT;
  }
  const probs = _softmax(logits, temperature);

  // Sort by probability descending → build fallback chain
  const ranked = Object.entries(probs)
    .sort((a, b) => b[1] - a[1]);

  const [bestModel, bestProb] = ranked[0];
  const fallbackChain = ranked.map(([model]) => model);

  console.log(`   🎯 [RTX-Router] Feature Vector: complexity=${h.complexity.toFixed(2)} code=${h.hasCode} research=${h.hasResearch} deploy=${h.hasDeploy} urgent=${h.isUrgent}`);
  console.log(`   🔀 [RTX-Router] Selected: ${bestModel} (p=${bestProb.toFixed(3)}, T=${temperature}) | Fallback: ${fallbackChain.slice(1, 3).join(' → ')}`);

  return {
    model: bestModel,
    confidence: bestProb,
    fallbackChain,
    scores,
    probs,
  };
}

/**
 * Temperature-scaled softmax over a {key: logit} map.
 * Numerically stable (subtracts max logit before exp).
 */
function _softmax(logits, temperature) {
  const keys = Object.keys(logits);
  const max = Math.max(...keys.map(k => logits[k]));
  const exps = {};
  let sum = 0;
  for (const k of keys) {
    // Guard: extreme T makes exponents overflow — clamp the scaled logit.
    const scaled = Math.max(-50, Math.min(50, (logits[k] - max) / temperature));
    exps[k] = Math.exp(scaled);
    sum += exps[k];
  }
  const probs = {};
  for (const k of keys) probs[k] = sum > 0 ? exps[k] / sum : 1 / keys.length;
  return probs;
}

// ─── Legacy routeTask (backward compatible — still works) ─────────────────────

/**
 * Public routing function — used by rtx-planner.js
 * Now internally uses 5D feature vector + historyMultiplier.
 */
function routeTask(taskDescription, mode = 'ULTRA') {
  const h = extractFeatureVector(taskDescription);
  const { model } = selectModelFromVector(h, mode);

  // Legacy pattern override (for explicit git/repo tasks) —
  // only when the pattern target is a registered CLI.
  const desc = taskDescription.toLowerCase();
  for (const [pattern, cli] of Object.entries(ROUTING_MAP)) {
    if (new RegExp(pattern).test(desc)) {
      if (ALLOWED_CLIS.has(cli)) return cli;
      console.warn(`⚠️  [RTX-Router] Pattern "${pattern}" maps to unregistered CLI "${cli}" — ignoring.`);
    }
  }

  // Final guard: never return a CLI that isn't in the registry.
  if (!ALLOWED_CLIS.has(model)) {
    console.warn(`⚠️  [RTX-Router] Selector picked unregistered CLI "${model}" — falling back to claude_code.`);
    return ALLOWED_CLIS.has('claude_code') ? 'claude_code' : [...ALLOWED_CLIS][0];
  }
  return model;
}

module.exports = {
  routeTask,
  ROUTING_MAP,
  extractFeatureVector,
  selectModelFromVector,
  recordOutcome,
  getHistoryMultiplier,
  getPassRate,
  loadHistory,
  resetHistory,
  HISTORY_FILE,
};
