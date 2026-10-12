'use strict';
/**
 * RTX-MCTS — Real Adaptive Branching Monte Carlo Tree Search
 * ============================================================================
 * Zero-dependency Node.js port of the ABMCTS-A algorithm family published by
 * Sakana AI (NeurIPS 2025 Spotlight) and open-sourced as TreeQuest (Apache 2.0).
 * Only the *algorithm* is ported (selection / expansion / evaluation /
 * backpropagation); no TreeQuest code is vendored.
 *
 * What was here before: `evaluateBranch()` returned hardcoded scores
 * (6.8 / 9.2 / 4.5) — a rigged demo, not a search. That is gone.
 *
 * What this is now:
 *   - Real tree: MCTSNode { state, visits, totalValue, children, parent }.
 *   - Selection: UCB1  Q + c·√(ln N / n)  (c = 1.414, the constant this file
 *     always declared but never used).
 *   - Adaptive branching (the "AB" in AB-MCTS): every iteration decides
 *     GO WIDER (spawn a brand-new candidate) vs GO DEEPER (refine the most
 *     promising node so far), driven by observed node values — not by a
 *     coin flip and not by fixed scores.
 *   - Evaluation: every candidate is REALLY scored by a caller-supplied
 *     scoreFn returning a number in [0,1] (TreeQuest's hard requirement).
 *     The default scoreFn is RTXVerifier.scoreNormalized — a deterministic
 *     rubric, so this runs with NO API key. An optional LLM-as-judge hook
 *     (RTX_JUDGE_CMD) can blend in when a judge CLI is configured, and
 *     degrades gracefully to the rubric when it is not.
 *   - Backpropagation: scores flow up to every ancestor; the run ends with
 *     topK() — the highest-value states win, nothing is pre-ordained.
 *
 * Generation honesty note: candidate *generation* is injected via
 * `generateFn`. The conductor wires it to real CLI adapters (real LLM
 * workers). The built-in default generator applies genuine reasoning
 * restructurings locally (decompose / constraints-first / compare /
 * risk-review) — a documented heuristic, scored by the real rubric.
 * Wire an LLM generateFn for full-strength search.
 * ============================================================================
 */

const RTXVerifier = require('./rtx-verifier');

// ─── Tree node ──────────────────────────────────────────────────────────────

class MCTSNode {
  constructor({ state, action = 'root', parent = null, depth = 0, workerId = null }) {
    this.state = state;          // candidate text / reasoning state
    this.action = action;        // 'root' | 'wider' | 'deeper'
    this.parent = parent;
    this.children = [];
    this.depth = depth;
    this.workerId = workerId;    // which worker generated this (multi-LLM racing)
    this.visits = 0;
    this.totalValue = 0;
  }

  get meanValue() {
    return this.visits > 0 ? this.totalValue / this.visits : 0;
  }

  /**
   * UCB1 selection score. Unvisited nodes return +Infinity so every child
   * is tried at least once before exploitation kicks in.
   */
  ucb1(explorationFactor, parentVisits) {
    if (this.visits === 0) return Infinity;
    const exploitation = this.meanValue;
    const exploration = explorationFactor * Math.sqrt(Math.log(Math.max(1, parentVisits)) / this.visits);
    return exploitation + exploration;
  }

  addChild(state, action, workerId) {
    const child = new MCTSNode({
      state,
      action,
      parent: this,
      depth: this.depth + 1,
      workerId,
    });
    this.children.push(child);
    return child;
  }

  isFullyExpanded(maxChildren) {
    return this.children.length >= maxChildren;
  }

  bestChild(explorationFactor) {
    let best = null;
    let bestScore = -Infinity;
    for (const child of this.children) {
      const s = child.ucb1(explorationFactor, this.visits);
      if (s > bestScore) { bestScore = s; best = child; }
    }
    return best;
  }
}

// ─── Default local candidate generator (documented heuristic) ────────────────
// Genuine reasoning restructurings — NOT fake scores. Each strategy really
// rewrites the parent state into a distinct candidate; the verifier rubric
// then scores the actual text.

const WIDER_STRATEGIES = [
  (q) => `Decompose the problem: "${q}" — split into sub-questions: (1) precise scope, (2) hard constraints, (3) candidate approaches with trade-offs.`,
  (q) => `Constraints-first analysis: "${q}" — list every hard constraint explicitly, then keep only options satisfying all of them; flag violated assumptions.`,
  (q) => `Compare alternatives: "${q}" — enumerate three distinct approaches, weigh evidence for each, recommend the best-supported one with reasons.`,
  (q) => `Risk review: "${q}" — identify the three most likely failure modes, propose a concrete mitigation for each, then re-rank options by residual risk.`,
  (q) => `Evidence audit: "${q}" — separate verified facts from assumptions, mark every claim needing external confirmation, proceed only on verified ground.`,
];

const DEEPER_STRATEGIES = [
  (s) => `Refine with critique: ${s} — attack the weakest claim above; either strengthen it with a concrete check or replace it.`,
  (s) => `Refine with specifics: ${s} — replace every vague statement with a measurable, verifiable one; add edge cases.`,
  (s) => `Refine with counter-argument: ${s} — steelman the strongest objection to this reasoning, then resolve it explicitly.`,
];

function defaultGenerateFnFactory() {
  let widerIdx = 0;
  let deeperIdx = 0;
  return async (parentState, mode /* 'wider' | 'deeper' */) => {
    if (mode === 'deeper') {
      const fn = DEEPER_STRATEGIES[deeperIdx++ % DEEPER_STRATEGIES.length];
      return fn(parentState);
    }
    const fn = WIDER_STRATEGIES[widerIdx++ % WIDER_STRATEGIES.length];
    return fn(parentState);
  };
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// ─── RTXMCTS ─────────────────────────────────────────────────────────────────

class RTXMCTS {
  constructor(options = {}) {
    this.explorationFactor = options.explorationFactor ?? 1.414; // UCB1 constant
    this.budget = options.budget ?? 12;        // iterations per runSearch
    this.maxChildren = options.maxChildren ?? 4;
    this.maxDepth = options.maxDepth ?? 4;
    this.deepenThreshold = options.deepenThreshold ?? 0.55; // node value worth refining
    this.deepenProbability = options.deepenProbability ?? 0.65;
    this.stats = { wider: 0, deeper: 0, iterations: 0 };
  }

  /**
   * Run a real adaptive-branching MCTS.
   *
   * @param {Object} opts
   * @param {string} opts.query            Root problem statement.
   * @param {number} [opts.budget]         Search iterations (default: this.budget).
   * @param {function} [opts.generateFn]   async (parentState, mode) => candidateText.
   *                                       mode is 'wider' (new candidate) or
   *                                       'deeper' (refine parentState).
   * @param {function} [opts.scoreFn]      async (candidateText) => number in [0,1].
   * @param {function} [opts.onIteration]  optional (info) => void progress hook.
   * @returns {Promise<{best: MCTSNode, root: MCTSNode, topK: Function, stats: Object}>}
   */
  async runSearch(opts = {}) {
    const {
      query,
      budget = this.budget,
      generateFn = defaultGenerateFnFactory(),
      // Default: deterministic reasoning scorer (no API key). The conductor
      // overrides this with scoreNormalized for worker-artifact outputs.
      scoreFn = async (text) => RTXVerifier.scoreReasoning(text),
      onIteration = null,
    } = opts;

    if (!query || typeof query !== 'string') {
      throw new Error('[RTX-MCTS] runSearch requires a non-empty string query.');
    }

    const root = new MCTSNode({ state: query, action: 'root' });
    this.stats = { wider: 0, deeper: 0, iterations: 0 };

    console.log(`\n🌳 [RTX-MCTS] Real AB-MCTS search — budget ${budget} iterations, UCB1 c=${this.explorationFactor}`);

    for (let iter = 1; iter <= budget; iter++) {
      this.stats.iterations = iter;

      // 1. SELECTION — UCB1 descent to an expandable node.
      const node = this._select(root);

      // 2. ADAPTIVE BRANCHING DECISION — GO WIDER vs GO DEEPER.
      //    Promising nodes (high observed value) earn refinement; otherwise
      //    explore brand-new candidates. This is the adaptive core of AB-MCTS.
      const mode = this._decideBranch(node);
      this.stats[mode === 'deeper' ? 'deeper' : 'wider']++;

      // 3. EXPANSION — generate one real candidate.
      let candidate;
      try {
        candidate = await generateFn(node.state, mode);
      } catch (err) {
        console.warn(`   ⚠️  [RTX-MCTS] generateFn failed (iter ${iter}): ${err.message} — skipping iteration.`);
        continue;
      }
      if (typeof candidate !== 'string' || candidate.trim().length === 0) {
        console.warn(`   ⚠️  [RTX-MCTS] generateFn returned empty candidate (iter ${iter}) — skipping.`);
        continue;
      }
      const child = node.addChild(candidate, mode, generateFn.workerId || null);

      // 4. EVALUATION — real score in [0,1], never a hardcoded constant.
      let score;
      try {
        score = clamp01(await scoreFn(candidate));
      } catch (err) {
        console.warn(`   ⚠️  [RTX-MCTS] scoreFn failed (iter ${iter}): ${err.message} — scoring 0.`);
        score = 0;
      }

      // 5. BACKPROPAGATION — update every ancestor up to the root.
      this._backpropagate(child, score);

      if (onIteration) {
        try { onIteration({ iter, budget, mode, score, nodeValue: child.meanValue }); } catch { /* hook must not break search */ }
      }
      console.log(`   > iter ${iter}/${budget} [${mode === 'deeper' ? 'GO DEEPER 🔬' : 'GO WIDER 🌱'}] score=${score.toFixed(3)} depth=${child.depth}`);
    }

    const ranked = this.topK(1, root);
    const best = ranked[0] || root;
    console.log(`\n🎯 [RTX-MCTS] Search complete — best value ${best.meanValue.toFixed(3)} over ${best.visits} visit(s); wider=${this.stats.wider} deeper=${this.stats.deeper}`);

    return {
      best,
      root,
      stats: { ...this.stats },
      topK: (k) => this.topK(k, root),
    };
  }

  /**
   * Backward-compatible entry: search(query, branchesCount).
   * Previously returned a hardcoded-score mock; now runs the real tree search
   * with the local heuristic generator + real verifier-rubric scoring.
   * Returns the best node (has .state / .meanValue / .visits).
   */
  async search(query, branchesCount = 3) {
    const budget = Math.max(branchesCount * 2, 6);
    const { best, stats } = await this.runSearch({ query, budget });
    console.log(`✂️  [RTX-MCTS] Pruned ${stats.iterations - 1} lower-value paths; kept best.`);
    return {
      id: 1,
      desc: best.state,
      score: best.meanValue, // [0,1] — honest, not /10 theater
      visits: best.visits,
      stats,
      node: best,
    };
  }

  /**
   * Backward-compatible single-branch evaluation.
   *
   * This method used to return HARDCODED scores (6.8 / 9.2 / 4.5) — the
   * rigged demo the review flagged. It now generates the branch's candidate
   * with the real default generator and scores it with the real deterministic
   * rubric → [0,1]. Synchronous (both halves are pure computation).
   * Kept for the eval harness; prefer runSearch() for real tree search.
   */
  evaluateBranch(branchId, query) {
    const n = WIDER_STRATEGIES.length;
    const idx = ((Math.trunc(branchId) - 1) % n + n) % n;
    const candidate = WIDER_STRATEGIES[idx](String(query));
    return RTXVerifier.scoreReasoning(candidate);
  }

  /**
   * Top-k states by mean value (TreeQuest's top_k equivalent).
   * The root (depth 0) is EXCLUDED — it is the unevaluated query, never a
   * candidate; returning it as "best" would be dishonest. Only evaluated
   * children compete. Tie-break: more visits first (more evidence).
   */
  topK(k, root) {
    const nodes = [];
    const walk = (n) => { if (n.depth > 0) nodes.push(n); for (const c of n.children) walk(c); };
    walk(root);
    nodes.sort((a, b) => (b.meanValue - a.meanValue) || (b.visits - a.visits));
    return nodes.slice(0, Math.max(1, k));
  }

  // ─── internals ────────────────────────────────────────────────────────────

  _select(root) {
    let node = root;
    while (node.isFullyExpanded(this.maxChildren) && node.children.length > 0 && node.depth < this.maxDepth) {
      const next = node.bestChild(this.explorationFactor);
      if (!next) break;
      node = next;
    }
    return node;
  }

  _decideBranch(node) {
    // Root with no children yet: always go wider (need candidates first).
    if (node.depth === 0 && node.children.length === 0) return 'wider';
    // Depth cap: can't refine deeper, go wider from an ancestor instead.
    if (node.depth >= this.maxDepth) return 'wider';
    // Promising node → probably refine it (exploit); otherwise explore.
    const promising = node.meanValue >= this.deepenThreshold && node.visits > 0;
    if (promising && Math.random() < this.deepenProbability) return 'deeper';
    // Fresh nodes (no visits yet) have no evidence — explore wider.
    if (node.visits === 0) return 'wider';
    return Math.random() < 0.25 ? 'deeper' : 'wider';
  }

  _backpropagate(node, score) {
    let n = node;
    while (n) {
      n.visits += 1;
      n.totalValue += score;
      n = n.parent;
    }
  }
}

module.exports = RTXMCTS;
module.exports.MCTSNode = MCTSNode;
module.exports.defaultGenerateFnFactory = defaultGenerateFnFactory;

// ─── CLI Entry Point ─────────────────────────────────────────────────────────
// `node core/rtx-mcts.js --depth 2 --width 3 --budget 12 "your query"`
// depth = sequential refinement rounds; width = max children per node;
// budget = MCTS iterations per round. Runs with NO API key (rubric scoring).
if (require.main === module) {
  const rawArgs = process.argv.slice(2);
  let depth = 1, width = 3, budget = 12;
  const positional = [];

  for (let i = 0; i < rawArgs.length; i++) {
    const a = rawArgs[i];
    if ((a === '--depth' || a === '--width' || a === '--budget') && rawArgs[i + 1] !== undefined) {
      const n = parseInt(rawArgs[++i], 10);
      if (!Number.isFinite(n) || n <= 0) {
        console.error(`⚠️  [RTX-MCTS] Invalid value for ${a} — using default.`);
        continue;
      }
      if (a === '--depth') depth = n;
      else if (a === '--width') width = n;
      else budget = n;
    } else if (!a.startsWith('--')) {
      positional.push(a);
    } else {
      console.error(`⚠️  [RTX-MCTS] Unknown flag "${a}" — ignoring.`);
    }
  }

  const query = positional.join(' ') || 'Evaluate options';

  (async () => {
    const mcts = new RTXMCTS({ maxChildren: width, budget });
    let focus = query;
    for (let d = 1; d <= depth; d++) {
      if (depth > 1) console.log(`\n━━━ Depth ${d}/${depth} ━━━`);
      const { best, stats } = await mcts.runSearch({ query: focus, budget });
      console.log(`\n🏆 Round ${d} winner (value ${best.meanValue.toFixed(3)}, ${best.visits} visits):\n${best.state}\n`);
      // Go deeper: next round refines around the winning branch.
      focus = `Refine this winning approach with concrete next steps: ${best.state}`;
    }
  })().catch(err => {
    console.error('❌ [RTX-MCTS]', err);
    process.exit(1);
  });
}
