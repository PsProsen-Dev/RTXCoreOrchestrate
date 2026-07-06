/**
 * RTX Contradiction Tracker — Regex Token + Negation Classifier
 *
 * Team Discussion Final Decision (Casting Vote by Antigravity 2.0):
 * - v1: Simple keyword/negation matching (Antigravity IDE's position)
 * - Architecture NLP-ready (Ultron's requirement for v2 extensibility)
 * - Implementation: Regex Token-Groups (Ultron's compromise)
 *
 * Antigravity 2.0's casting vote:
 *   "Simple matching + regex token-group for v1, NLP plug-in ready for v2"
 *
 * RTXCoreFramework Section 8.8 — Contradiction Tracker Integration
 * Used by: marlin-conductor.js — Marlin research report synthesis
 */

// ─── Negation Token Groups (Ultron's regex token-group compromise) ────────────
const NEGATION_PATTERNS = [
  /\bnot\b/i, /\bnever\b/i, /\bno\b/i,
  /\bfalse\b/i, /\bincorrect\b/i, /\bwrong\b/i,
  /\bdenied\b/i, /\binvalid\b/i, /\bfailed\b/i,
  /\bcannot\b/i, /\bwon't\b/i, /\bdoesn't\b/i,
  /\bisn't\b/i, /\bwasn't\b/i, /\baren't\b/i,
];

const AFFIRMATION_PATTERNS = [
  /\bis\b/i, /\bwas\b/i, /\bare\b/i, /\bwere\b/i,
  /\bconfirmed\b/i, /\btrue\b/i, /\bcorrect\b/i,
  /\bvalid\b/i, /\bsucceeded\b/i, /\bapproved\b/i,
];

// ─── Fact Normalizer ──────────────────────────────────────────────────────────

class FactNormalizer {
  /**
   * Normalizes a research node into a structured fact object.
   * @param {{ text: string, source: string, metadata?: object }} node
   */
  normalize(node) {
    const text = node.text.toLowerCase().trim();
    return {
      source:     node.source,
      rawText:    text,
      numbers:    this._extractNumbers(text),
      years:      this._extractYears(text),
      hasNeg:     this._hasNegation(text),
      hasAff:     this._hasAffirmation(text),
      negTokens:  this._matchTokens(text, NEGATION_PATTERNS),
      keywords:   this._extractKeywords(text),
    };
  }

  _extractNumbers(text) {
    const matches = text.match(/\b\d+(\.\d+)?\b/g) || [];
    return matches.map(Number);
  }

  _extractYears(text) {
    const matches = text.match(/\b(19|20)\d{2}\b/g) || [];
    return matches.map(Number);
  }

  _hasNegation(text) {
    return NEGATION_PATTERNS.some(p => p.test(text));
  }

  _hasAffirmation(text) {
    return AFFIRMATION_PATTERNS.some(p => p.test(text));
  }

  _matchTokens(text, patterns) {
    return patterns.filter(p => p.test(text)).map(p => p.source);
  }

  _extractKeywords(text) {
    // Remove stopwords, return meaningful content words
    const stopwords = new Set(['the', 'a', 'an', 'is', 'it', 'in', 'on', 'at', 'to', 'of', 'and', 'or', 'for', 'with', 'by']);
    return text
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));
  }
}

// ─── Contradiction Matcher ────────────────────────────────────────────────────

class ContradictionMatcher {
  /**
   * Compares two normalized facts for contradictions.
   * Returns { isContradiction, type, severity, detail }
   */
  detect(factA, factB) {
    // ── 1. Direct Negation Check ──────────────────────────────────────────────
    // One has negation, other doesn't — AND they share significant keywords
    const sharedKeywords = factA.keywords.filter(k => factB.keywords.includes(k));
    const keywordOverlap = sharedKeywords.length / Math.max(factA.keywords.length, factB.keywords.length, 1);

    if (factA.hasNeg !== factB.hasNeg && keywordOverlap > 0.4) {
      return {
        isContradiction: true,
        type:            'direct_negation',
        severity:        'HIGH',
        detail:          `Negation conflict on shared topic: [${sharedKeywords.slice(0, 3).join(', ')}]`,
        sharedKeywords,
      };
    }

    // ── 2. Numeric Disagreement ───────────────────────────────────────────────
    if (factA.numbers.length > 0 && factB.numbers.length > 0 && keywordOverlap > 0.3) {
      for (let i = 0; i < Math.min(factA.numbers.length, factB.numbers.length); i++) {
        const a = factA.numbers[i];
        const b = factB.numbers[i];
        if (a === 0 && b === 0) continue;
        const diff = Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1);
        if (diff > 0.1) { // >10% difference = contradiction
          const severity = diff > 0.5 ? 'HIGH' : 'MEDIUM';
          return {
            isContradiction: true,
            type:            'numeric_disagreement',
            severity,
            detail:          `Numeric conflict: ${a} vs ${b} (${(diff * 100).toFixed(1)}% diff)`,
            sharedKeywords,
          };
        }
      }
    }

    // ── 3. Temporal Disagreement ──────────────────────────────────────────────
    if (factA.years.length > 0 && factB.years.length > 0 && keywordOverlap > 0.3) {
      for (let i = 0; i < Math.min(factA.years.length, factB.years.length); i++) {
        if (factA.years[i] !== factB.years[i]) {
          return {
            isContradiction: true,
            type:            'temporal_disagreement',
            severity:        'MEDIUM',
            detail:          `Year conflict: ${factA.years[i]} vs ${factB.years[i]}`,
            sharedKeywords,
          };
        }
      }
    }

    // ── 4. Affirmation vs Negation (Ultron's token-group) ────────────────────
    if (factA.hasAff && factB.hasNeg && keywordOverlap > 0.5) {
      return {
        isContradiction: true,
        type:            'affirmation_negation_conflict',
        severity:        'HIGH',
        detail:          `Source affirms while other negates: [${sharedKeywords.slice(0, 3).join(', ')}]`,
        sharedKeywords,
      };
    }

    return { isContradiction: false };
  }
}

// ─── Main Contradiction Tracker ───────────────────────────────────────────────

class ContradictionTracker {
  constructor() {
    this.normalizer = new FactNormalizer();
    this.matcher    = new ContradictionMatcher();
  }

  /**
   * Tracks contradictions across an array of research nodes.
   * @param {Array<{ text: string, source: string }>} nodes
   * @returns {Array} contradictions array with full report
   */
  track(nodes) {
    console.log(`\n🔬 [ContradictionTracker] Analyzing ${nodes.length} research nodes...`);

    const facts         = nodes.map(n => this.normalizer.normalize(n));
    const contradictions = [];

    // Pairwise comparison — O(n²) but fine for Marlin's ≤20 research nodes
    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        const result = this.matcher.detect(facts[i], facts[j]);
        if (result.isContradiction) {
          contradictions.push({
            sourceA:          facts[i].source,
            sourceB:          facts[j].source,
            contradictionType: result.type,
            severity:         result.severity,
            detail:           result.detail,
            sharedKeywords:   result.sharedKeywords || [],
          });

          const icon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }[result.severity] || '⚪';
          console.log(`  ${icon} [${result.severity}] ${result.type}`);
          console.log(`     Source A: "${facts[i].source}"`);
          console.log(`     Source B: "${facts[j].source}"`);
          console.log(`     Detail: ${result.detail}`);
        }
      }
    }

    // Summary
    const high   = contradictions.filter(c => c.severity === 'HIGH').length;
    const medium = contradictions.filter(c => c.severity === 'MEDIUM').length;
    console.log(`\n📊 [ContradictionTracker] Found ${contradictions.length} contradictions — 🔴 HIGH: ${high}, 🟡 MEDIUM: ${medium}`);

    return contradictions;
  }

  /**
   * Generates a Marlin-style contradiction section for the final report.
   */
  generateReportSection(contradictions) {
    if (contradictions.length === 0) {
      return `## ⚖️ Contradiction Analysis\n\nNo contradictions detected across research nodes. All sources are consistent.\n`;
    }

    let md = `## ⚖️ Contradiction Analysis\n\n`;
    md += `| Severity | Type | Source A | Source B | Detail |\n`;
    md += `|----------|------|----------|----------|--------|\n`;

    for (const c of contradictions) {
      const icon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🟢' }[c.severity] || '⚪';
      md += `| ${icon} ${c.severity} | ${c.contradictionType} | ${c.sourceA} | ${c.sourceB} | ${c.detail} |\n`;
    }

    md += `\n> **Note:** Contradictions marked 🔴 HIGH require manual verification before publishing.\n`;
    return md;
  }
}

module.exports = { ContradictionTracker, FactNormalizer, ContradictionMatcher };
