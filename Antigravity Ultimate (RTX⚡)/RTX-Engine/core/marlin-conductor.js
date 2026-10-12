'use strict';
/**
 * Marlin-Conductor — Virtual CSO research engine (real methodology)
 * ============================================================================
 * What was here before: a fixed script — three hardcoded PDF filenames
 * "scraped" via console.log, two fixed sentences fed to the
 * ContradictionTracker, a pre-written resolution. A report template
 * generator, not a research engine.
 *
 * What this is now (Marlin's published methodology — hypotheses → evidence
 * → weigh competing evidence → report — as code, MetaGPT-style staged
 * artifacts):
 *
 *   1. EVIDENCE GATHER  — real sources only, every item source-tracked:
 *        a. Local source directory (RTX_MARLIN_SOURCES, or the run workspace):
 *           actual files, actual text — never invented filenames.
 *        b. Operator notes file (RTX_MARLIN_NOTES): brief / prior findings.
 *        c. Optional queryAdapter seam: when a live research CLI is wired in,
 *           its real output becomes evidence (marked with the adapter id).
 *   2. HYPOTHESES       — bottom-up: one hypothesis per evidence item
 *      (extractive first-sentence claim, source-linked) + the goal question.
 *   3. CONTRADICTIONS   — the REAL ContradictionTracker on the REAL evidence
 *      (no fixed sentences anymore).
 *   4. AB-MCTS          — the real RTXMCTS searches the hypothesis space:
 *      GO WIDER drafts hypotheses from unused evidence, GO DEEPER refines a
 *      promising hypothesis against its contradicting evidence; the judge
 *      scores in [0,1] (deterministic rubric, optional RTX_JUDGE_CMD blend).
 *   5. 3-LAYER REPORT   — Verified Facts / Working Assumptions / Inferences,
 *      every line carrying its source(s). Methodology IP preserved (dossier
 *      row 19: UNIQUE-RAKHO), template theater removed.
 *
 * Honesty note: hypothesis *wording* is extractive/heuristic (no LLM call
 * is made unless queryAdapter is provided). Everything else — evidence
 * intake, contradiction detection, scoring, selection, source attribution —
 * is real computation on real inputs. The report's method section says
 * exactly this.
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const RTXMCTS = require('./rtx-mcts');
const RTXSafetyLayer = require('./rtx-safety');
const RTXSession = require('./rtx-session');
const RTXFileManager = require('./rtx-file-manager');
const RTXVerifier = require('./rtx-verifier');
const { ContradictionTracker } = require('./contradiction-tracker');

const MAX_EVIDENCE_ITEMS = 20;
const MAX_FILE_CHARS = 1500;
const MAX_FILES = 8;

// ─── Evidence gatherer — real sources, source-tracked ───────────────────────

class EvidenceGatherer {
  /**
   * @param {string} goal
   * @param {Object} opts
   * @param {string} opts.workspacePath   run workspace (scanned for source files)
   * @param {string} [opts.sourcesDir]    override / additional source directory
   * @param {Object} [opts.queryAdapter]  optional live adapter (must expose .run)
   * @returns {Promise<Array<{id, text, source, kind}>>}
   */
  async gather(goal, { workspacePath, sourcesDir, queryAdapter }) {
    const items = [];
    let n = 0;
    const add = (text, source, kind) => {
      const clean = String(text || '').trim();
      if (clean.length < 40 || n >= MAX_EVIDENCE_ITEMS) return; // skip stubs
      items.push({ id: `ev-${++n}`, text: clean.substring(0, MAX_FILE_CHARS), source, kind });
    };

    // (a) Local source files — real directory walk, real file contents.
    const dirs = [sourcesDir, process.env.RTX_MARLIN_SOURCES, workspacePath].filter(Boolean);
    const seenDirs = new Set();
    for (const dir of dirs) {
      if (seenDirs.has(dir)) continue;
      seenDirs.add(dir);
      let files = [];
      try {
        files = fs.readdirSync(dir)
          .filter(f => /\.(md|txt|json|csv)$/i.test(f))
          .filter(f => !/strategic_report|session/i.test(f)) // never ingest our own output
          .slice(0, MAX_FILES);
      } catch { continue; } // missing dir — not an error, just no sources there
      for (const f of files) {
        try {
          const content = fs.readFileSync(path.join(dir, f), 'utf-8');
          add(content, f, 'local-file');
          if (content.trim().length >= 40) {
            console.log(`   📄 [Evidence] Ingested "${f}" (${Math.min(content.length, MAX_FILE_CHARS)} chars)`);
          }
        } catch (err) {
          console.warn(`   ⚠️  [Evidence] Could not read "${f}": ${err.message}`);
        }
      }
    }

    // (b) Operator notes — explicit brief, source-labeled as such.
    const notesPath = process.env.RTX_MARLIN_NOTES;
    if (notesPath) {
      try {
        add(fs.readFileSync(notesPath, 'utf-8'), path.basename(notesPath), 'operator-notes');
        console.log(`   📝 [Evidence] Ingested operator notes "${notesPath}"`);
      } catch (err) {
        console.warn(`   ⚠️  [Evidence] RTX_MARLIN_NOTES unreadable: ${err.message}`);
      }
    }

    // (c) Live adapter query — real CLI output becomes evidence when wired.
    if (queryAdapter && typeof queryAdapter.run === 'function') {
      try {
        const res = await queryAdapter.run(
          { action: 'research_brief', details: `Research brief for: ${goal}. Return concise factual findings with source names.` },
          { workspace: workspacePath }
        );
        if (res && !res.mock && res.code === 0 && (res.out || '').trim().length >= 40) {
          // Output guardrail still applies to ingested evidence.
          RTXSafetyLayer.postCallCheck(queryAdapter.id || 'marlin-adapter', res.out);
          add(res.out, `${queryAdapter.id || 'adapter'}:live-query`, 'live-query');
          console.log(`   🌐 [Evidence] Live adapter returned research brief.`);
        } else if (res && res.mock) {
          console.log(`   🧪 [Evidence] Adapter in mock mode — no live evidence ingested (documented).`);
        }
      } catch (err) {
        console.warn(`   ⚠️  [Evidence] Live query failed: ${err.message} — continuing with local evidence.`);
      }
    }

    return items;
  }
}

// ─── Marlin conductor ────────────────────────────────────────────────────────

class MarlinConductor {
  constructor(options = {}) {
    this.mcts = new RTXMCTS({
      budget: options.mctsBudget ?? 10,
      maxChildren: 3,
      maxDepth: 3,
    });
    this.tracker = new ContradictionTracker();
    this.gatherer = new EvidenceGatherer();
  }

  async runResearch(goal, opts = {}) {
    console.log(`\n🕵️  [Marlin-Conductor] Waking up Virtual CSO (Chief Strategy Officer) Agent...`);
    console.log(`🕵️  [Marlin-Conductor] Goal Registered: "${goal}"`);

    const sessionId = 'marlin_session_' + Date.now();
    const session = new RTXSession(sessionId);
    const fileManager = new RTXFileManager(sessionId);
    const workspacePath = fileManager.getWorkspacePath();
    await session.init(sessionId, []);

    // ── Stage 1: EVIDENCE (real) ──────────────────────────────────────────
    console.log(`\n⏳ [Marlin-Conductor] Stage 1/5 — Gathering evidence from real sources...`);
    const evidence = await this.gatherer.gather(goal, {
      workspacePath,
      sourcesDir: opts.sourcesDir,
      queryAdapter: opts.queryAdapter,
    });
    const sourceCount = new Set(evidence.map(e => e.source)).size;
    console.log(`   📚 [Marlin-Conductor] ${evidence.length} evidence items from ${sourceCount} source(s).`);
    if (evidence.length === 0) {
      console.log(`   💡 [Marlin-Conductor] No local sources found — set RTX_MARLIN_SOURCES=<dir> or RTX_MARLIN_NOTES=<file> for richer input.`);
    }

    // ── Stage 2: HYPOTHESES (bottom-up, source-linked) ────────────────────
    console.log(`\n💡 [Marlin-Conductor] Stage 2/5 — Forming hypotheses from evidence...`);
    const hypotheses = this._formHypotheses(goal, evidence);
    console.log(`   🧪 [Marlin-Conductor] ${hypotheses.length} hypotheses (1 goal + ${hypotheses.length - 1} evidence-derived).`);

    // ── Stage 3: CONTRADICTIONS (real tracker, real inputs) ────────────────
    // Sentence-level claims: contradictions live between CLAIMS, not whole
    // documents (a document-level negation flag is poisoned by one unrelated
    // "no" — e.g. "no app install needed" masking a real dispute).
    console.log(`\n⚖️  [Marlin-Conductor] Stage 3/5 — Weighing competing evidence...`);
    const claimNodes = [];
    for (const ev of evidence) {
      const sentences = ev.text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 40).slice(0, 6);
      sentences.forEach((s, i) => claimNodes.push({ text: s, source: `${ev.source}#s${i + 1}`, evId: ev.id }));
    }
    const contradictions = this.tracker.track(claimNodes.map(n => ({ text: n.text, source: n.source })));
    // Map contradiction sources back to evidence ids for scoring/layering.
    const nodeBySource = new Map(claimNodes.map(n => [n.source, n.evId]));
    const contestedEvIds = new Set();
    for (const c of contradictions) {
      for (const s of [c.sourceA, c.sourceB]) {
        const evId = nodeBySource.get(s);
        if (evId) contestedEvIds.add(evId);
      }
    }

    // ── Stage 4: AB-MCTS over the hypothesis space ─────────────────────────
    console.log(`\n🌳 [Marlin-Conductor] Stage 4/5 — AB-MCTS hypothesis search (best-first refinement)...`);
    const refined = await this._searchHypotheses(hypotheses, evidence, contradictions, contestedEvIds);

    // ── Stage 5: 3-LAYER CLASSIFICATION + REPORT ───────────────────────────
    console.log(`\n✍️  [Marlin-Conductor] Stage 5/5 — Compiling 3-layer strategic report...`);
    const layers = this._classifyLayers(refined, evidence, contestedEvIds);
    const report = this._renderReport(goal, layers, contradictions, evidence);

    const reportPath = path.join(workspacePath, 'strategic_report.md');
    fs.writeFileSync(reportPath, report);
    fileManager.registerArtifact('strategic_report.md', report);
    session.log('marlin', { action: 'runResearch' }, `Report: ${layers.facts.length} facts, ${layers.assumptions.length} assumptions, ${layers.inferences.length} inferences, ${contradictions.length} contradictions.`);
    session.complete('COMPLETED');

    console.log(`\n📂 [Marlin-Conductor] Strategic report: ${reportPath}`);
    console.log(`   ✅ Verified facts: ${layers.facts.length} | Assumptions: ${layers.assumptions.length} | Inferences: ${layers.inferences.length} | Contradictions: ${contradictions.length}`);
    console.log(`\n✅ [Marlin-Conductor] Long-Horizon Strategy Complete.`);
    return { layers, contradictions, evidence, reportPath };
  }

  // ─── Stage 2: hypothesis formation ─────────────────────────────────────────

  /** Extractive claim: first substantive sentence, markdown headers skipped. */
  _firstClaim(text) {
    const body = String(text).split('\n').filter(l => !l.trim().startsWith('#')).join(' ').trim();
    const sentences = body.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 20);
    return (sentences[0] || body).substring(0, 280);
  }

  _formHypotheses(goal, evidence) {
    const hyps = [{ id: 'h-goal', statement: `Core question under investigation: ${goal}`, evidenceIds: [], kind: 'goal' }];
    const meta = new Map([[hyps[0].statement, hyps[0]]]);
    evidence.forEach((ev) => {
      // Extractive claim: the evidence's own words, not ours.
      const statement = this._firstClaim(ev.text);
      const hyp = { id: `h-${ev.id}`, statement, evidenceIds: [ev.id], kind: 'evidence' };
      hyps.push(hyp);
      meta.set(statement, hyp);
    });
    this._hypMeta = meta; // statement text → hypothesis record
    return hyps;
  }

  // ─── Stage 4: AB-MCTS hypothesis search ────────────────────────────────────

  async _searchHypotheses(hypotheses, evidence, contradictions, contestedEvIds) {
    const meta = this._hypMeta;
    const evById = new Map(evidence.map(e => [e.id, e]));
    // Evidence ids already consumed by wider-expansion, to force novelty.
    const usedEvidence = new Set(hypotheses.flatMap(h => h.evidenceIds));
    let widerIdx = 0;

    const generateFn = async (parentState, mode) => {
      const parent = meta.get(parentState) || { statement: parentState, evidenceIds: [], kind: 'unknown' };
      if (mode === 'deeper') {
        // Refine against contradicting evidence (Marlin: weigh competing evidence).
        const touched = parent.evidenceIds
          .map(id => evById.get(id))
          .filter(e => e && contestedEvIds.has(e.id));
        const counter = touched.length > 0 ? touched[0] : null;
        const refined = counter
          ? `${parent.statement} — qualified: competing evidence from ${counter.source} notes "${counter.text.substring(0, 160)}…"; treat the unqualified claim as provisional.`
          : `${parent.statement} — sharpened: scope limited to what the cited source(s) directly support; flag the rest as assumption.`;
        const hyp = {
          id: `h-r${Date.now()}${Math.floor(Math.random() * 1e4)}`,
          statement: refined,
          evidenceIds: [...parent.evidenceIds],
          kind: 'refined',
        };
        if (counter && !hyp.evidenceIds.includes(counter.id)) hyp.evidenceIds.push(counter.id);
        meta.set(refined, hyp);
        return refined;
      }
      // GO WIDER: draft a hypothesis from as-yet-unused evidence.
      const fresh = evidence.filter(e => !usedEvidence.has(e.id));
      const pick = fresh.length > 0 ? fresh[widerIdx++ % fresh.length] : evidence[widerIdx++ % Math.max(1, evidence.length)];
      if (!pick) return `${parentState} — no further evidence available; hold as provisional.`;
      usedEvidence.add(pick.id);
      const statement = `Additional angle per ${pick.source}: ${this._firstClaim(pick.text)}`;
      meta.set(statement, { id: `h-w${Date.now()}${widerIdx}`, statement, evidenceIds: [pick.id], kind: 'evidence' });
      return statement;
    };

    const scoreFn = async (candidate) => {
      const hyp = meta.get(candidate);
      const evCount = hyp ? hyp.evidenceIds.length : 0;
      const distinctSources = hyp ? new Set(hyp.evidenceIds.map(id => evById.get(id)?.source).filter(Boolean)).size : 0;
      // Judge: reasoning quality × corroboration, minus contradiction penalty.
      let score = RTXVerifier.scoreReasoning(candidate);
      score *= (0.5 + 0.25 * Math.min(2, distinctSources)); // corroboration lift
      const touchedContra = (hyp?.evidenceIds || []).some(id => contestedEvIds.has(id));
      if (touchedContra) score *= 0.8; // unresolved tension costs
      // Optional LLM judge blend (graceful degrade when unconfigured).
      const judged = await RTXVerifier.judgeCandidate(candidate, { action: 'marlin_hypothesis' }, 'strategic soundness');
      if (judged.basis === 'rubric+llm') score = (score + judged.score) / 2;
      return Math.max(0, Math.min(1, score));
    };

    const seed = hypotheses.length > 0
      ? hypotheses[0].statement
      : 'No hypotheses formed — insufficient evidence.';

    const { topK } = await this.mcts.runSearch({
      query: seed,
      generateFn,
      scoreFn,
      onIteration: null,
    });
    // Wide net: the 3-layer report needs the best of EACH layer, not just the
    // global top-5 (which refinement bias would fill with inferences alone).
    const winners = topK(12);
    return winners.map(n => ({ node: n, hyp: meta.get(n.state) || { statement: n.state, evidenceIds: [], kind: 'unknown' } }));
  }

  // ─── Stage 5: 3-layer classification ───────────────────────────────────────

  _classifyLayers(refined, evidence, contestedEvIds) {
    const evById = new Map(evidence.map(e => [e.id, e]));

    const facts = [];
    const assumptions = [];
    const inferences = [];
    const seen = new Set();

    for (const { node, hyp } of refined) {
      const key = hyp.statement.substring(0, 120);
      if (seen.has(key)) continue;
      seen.add(key);
      const sources = [...new Set(hyp.evidenceIds.map(id => evById.get(id)?.source).filter(Boolean))];
      const sourceTag = sources.length > 0 ? sources.map(s => `[${s}]`).join(' ') : '[unattributed]';
      const contested = hyp.evidenceIds.some(id => contestedEvIds.has(id));
      const item = {
        statement: hyp.statement,
        sources,
        sourceTag,
        score: node.meanValue,
        contested,
      };
      if (hyp.kind === 'refined' || node.depth >= 2) {
        inferences.push(item); // derived via MCTS refinement — an inference, source-linked
      } else if (sources.length >= 2 && !contested) {
        facts.push(item); // corroborated by 2+ independent sources, uncontested
      } else {
        assumptions.push({ ...item, caveat: contested ? 'contested by competing evidence — verify before deciding' : 'single-source — treat as working assumption' });
      }
    }
    return { facts, assumptions, inferences };
  }

  // ─── Stage 5: report rendering ─────────────────────────────────────────────

  _renderReport(goal, layers, contradictions, evidence) {
    const line = (it) => `- ${it.statement}\n  Sources: ${it.sourceTag}${it.contested ? ' ⚠️ contested' : ''} (judge score: ${it.score.toFixed(2)})`;
    const aLine = (it) => `- ${it.statement}\n  Sources: ${it.sourceTag} — *${it.caveat}* (judge score: ${it.score.toFixed(2)})`;

    return `# RTX Strategic Report: ${goal}

_Generated ${new Date().toISOString()} — Marlin-Conductor (real methodology run)._

## 1. Verified Facts
${layers.facts.length > 0 ? layers.facts.map(line).join('\n') : '_None — no claim met the 2+-independent-source bar on this run._'}

## 2. Working Assumptions
${layers.assumptions.length > 0 ? layers.assumptions.map(aLine).join('\n') : '_None._'}

## 3. Inferences (MCTS-refined)
${layers.inferences.length > 0 ? layers.inferences.map(line).join('\n') : '_None — refinement produced no surviving inferences._'}

## 4. Contradiction Log
${contradictions.length > 0
    ? contradictions.map(c => `- [${c.severity}] ${c.contradictionType}: ${c.detail}\n  ${c.sourceA}  vs  ${c.sourceB}`).join('\n')
    : '_No contradictions detected across ingested evidence._'}

${this.tracker.generateReportSection(contradictions)}

## 5. Evidence Inventory
${evidence.length > 0 ? evidence.map(e => `- ${e.id} [${e.kind}] ${e.source}`).join('\n') : '_No evidence ingested._'}

## 6. Method Note (honesty)
- Evidence: real files/notes/adapter output only — filenames are never invented.
- Hypotheses: extractive (first-sentence claims in the evidence's own words).
- Scoring: deterministic judge in [0,1] (reasoning quality × source corroboration, contradiction penalty)${process.env.RTX_JUDGE_CMD ? '; LLM judge blended via RTX_JUDGE_CMD' : ''}.
- Selection: AB-MCTS (UCB1, adaptive wider/deeper, backprop) over the hypothesis space.
- Layers: Verified Fact = 2+ independent sources AND uncontested; otherwise Working Assumption; MCTS-refined syntheses = Inferences. Every line carries its sources.
`;
  }
}

if (require.main === module) {
  const rawArgs = process.argv.slice(2);
  let sourcesDir = null;
  const positional = [];
  for (let i = 0; i < rawArgs.length; i++) {
    if (rawArgs[i] === '--sources' && rawArgs[i + 1]) { sourcesDir = rawArgs[++i]; }
    else if (!rawArgs[i].startsWith('--')) { positional.push(rawArgs[i]); }
    else { console.error(`⚠️  [Marlin-Conductor] Unknown flag "${rawArgs[i]}" — ignoring.`); }
  }
  const goal = positional.join(' ') || 'Assess structural risks of multi-vendor AI systems under the new Global AI Regulation Patchwork.';
  const conductor = new MarlinConductor();
  conductor.runResearch(goal, { sourcesDir }).catch(err => {
    console.error('❌ [Marlin-Conductor]', err);
    process.exit(1);
  });
}

module.exports = MarlinConductor;
module.exports.EvidenceGatherer = EvidenceGatherer;
