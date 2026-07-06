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

// ─── Legacy Pattern Routing Map (preserved for backward compat) ──────────────
const ROUTING_MAP = {
  'git|repo|pr|issue|release|branch': 'gh_cli',
  'review|explain|refactor|debug':    'copilot_cli',
  'image|vision|creative|design':     'gemini-cli',
  'generate|scaffold|boilerplate':    'claude_code',
  'translate|math|chinese':           'claude_code',
  'search|web|research':              'gemini-cli',
};

// ─── Adaptive History Multiplier (Ultron's contribution) ─────────────────────
// Tracks failure counts per model — adjusts selection weights dynamically.
const _historyState = {
  failCounts: { claude_code: 0, 'gemini-cli': 0, copilot_cli: 0, gh_cli: 0, marlin: 0 },
  successCounts: { claude_code: 0, 'gemini-cli': 0, copilot_cli: 0, gh_cli: 0, marlin: 0 },
};

/**
 * Records outcome for a model — updates adaptive history weights.
 * @param {string} model - model id
 * @param {boolean} success - did it succeed?
 */
function recordOutcome(model, success) {
  if (success) {
    _historyState.successCounts[model] = (_historyState.successCounts[model] || 0) + 1;
  } else {
    _historyState.failCounts[model] = (_historyState.failCounts[model] || 0) + 1;
  }
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
  // Base scores per model from feature dimensions
  const scores = {
    'claude_code': (h.hasCode * 0.6) + (h.complexity * 0.4),
    'gemini-cli':  (h.hasResearch * 0.7) + (h.isUrgent * 0.1) + (1 - h.hasCode) * 0.2,
    'copilot_cli': (h.hasCode * 0.4) + (0.3),
    'gh_cli':      (h.hasDeploy * 0.9) + (0.1),
    'marlin':      (h.hasResearch * 0.5) + (h.complexity * 0.3) + (1 - h.isUrgent) * 0.2,
  };

  // Apply Ultron's historyMultiplier — adaptive weight adjustment
  for (const model of Object.keys(scores)) {
    scores[model] *= getHistoryMultiplier(model);
  }

  // ULTRA mode: boost claude_code for high-complexity tasks
  if (mode === 'ULTRA' && h.complexity > 0.6) {
    scores['claude_code'] = Math.min(1.0, scores['claude_code'] + 0.2);
  }

  // Sort by score descending → build fallback chain
  const ranked = Object.entries(scores)
    .sort((a, b) => b[1] - a[1]);

  const [bestModel, bestScore] = ranked[0];
  const fallbackChain = ranked.map(([model]) => model);

  console.log(`   🎯 [RTX-Router] Feature Vector: complexity=${h.complexity.toFixed(2)} code=${h.hasCode} research=${h.hasResearch} deploy=${h.hasDeploy} urgent=${h.isUrgent}`);
  console.log(`   🔀 [RTX-Router] Selected: ${bestModel} (score: ${bestScore.toFixed(3)}) | Fallback: ${fallbackChain.slice(1, 3).join(' → ')}`);

  return {
    model: bestModel,
    confidence: bestScore,
    fallbackChain,
    scores,
  };
}

// ─── Legacy routeTask (backward compatible — still works) ─────────────────────

/**
 * Public routing function — used by rtx-planner.js
 * Now internally uses 5D feature vector + historyMultiplier.
 */
function routeTask(taskDescription, mode = 'ULTRA') {
  const h = extractFeatureVector(taskDescription);
  const { model } = selectModelFromVector(h, mode);

  // Legacy pattern override (for explicit git/repo tasks)
  const desc = taskDescription.toLowerCase();
  for (const [pattern, cli] of Object.entries(ROUTING_MAP)) {
    if (new RegExp(pattern).test(desc)) {
      // Only override if pattern match is more specific than vector result
      if (cli === 'gh_cli' && h.hasDeploy > 0.5) return 'gh_cli';
    }
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
};
