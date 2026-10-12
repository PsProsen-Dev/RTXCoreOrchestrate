# Changelog

Is project ke saare notable changes is file mein document honge.

Format [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) par based hai,
aur ye project [Semantic Versioning](https://semver.org/spec/v2.0.0.html) follow karega
(pehli tagged release abhi baaki hai).

> **Imandari note:** "Unreleased" mein sirf wahi entries hain jo branch
> `improve/rtx-engine-real` mein **actually maujood** hain (committed, 13 Oct 2026
> ko live verify hue). Jo kaam roadmap mein hai par abhi code mein nahi, wo
> "Planned" ke neeche clearly marked hai — implemented hone par hi upar move hoga.
> (Review: `research_notes/rtx-core-orchestrate-review/`, §6 roadmap.)

## [Unreleased]

### Added
- **Real AB-MCTS** (`core/rtx-mcts.js` rewrite) — fixed scores (6.8/9.2/4.5) gaye.
  Ab: real tree nodes (`MCTSNode`), UCB1 selection (c=1.414), adaptive GO WIDER /
  GO DEEPER branching, backpropagation, `topK()` best-first. Candidate scoring
  caller-supplied `scoreFn` se — default `RTXVerifier.scoreNormalized` ([0,1]
  deterministic rubric, koi API key nahi). **Naya CLI entry point:**
  `node core/rtx-mcts.js --depth N --width M --budget K "<query>"` (pehle silently
  kuch nahi karta tha).
- **Honest verifier** (`core/rtx-verifier.js`) — keyword-rigging hatai; `[0,1]`
  normalized scoring contract (AB-MCTS requirement), reasoning-candidate scorer,
  aur optional **LLM-as-judge hook** (`RTX_JUDGE_CMD` env var — unconfigured hone
  par gracefully rubric par degrade, kabhi throw nahi).
- **Router: persisted history + temperature softmax** (`core/rtx-router.js`) —
  `recordOutcome()` ab success/fail counts `router-history.json` mein persist karta
  hai (conductor har step ke baad call karta hai); selection temperature-scaled
  softmax par; final guard hamesha registry-only.
- **TRINITY turn-loop + parallel racing** (`core/rtx-conductor.js`) — har step
  worker→verifier→revise loop chalata hai (turn budget 2 standard / 4 ultra;
  REJECT par semantic feedback worker ko wapas). ULTRA mein `requires_mcts` steps
  real MCTS search chalate hain (budget 8, live-adapter candidate generation,
  verifier-scored), aur hard non-MCTS steps **parallel candidate racing**
  (`Promise.all` across router fallback chain — verifier winner chunta hai).
  Mock-determinism guard: identical mock output twice → loop honestly early exit.
- **Real Marlin loop** (`core/marlin-conductor.js`) — fixed script gaya. Ab 5
  stages: real evidence intake (`RTX_MARLIN_SOURCES` dir / `RTX_MARLIN_NOTES` /
  optional `queryAdapter`) → evidence-derived hypotheses → **real**
  ContradictionTracker real evidence par → real AB-MCTS hypothesis search →
  3-layer report (Verified Facts / Working Assumptions / Inferences), har line
  source-linked. Verified-fact bar strict: 2+ independent sources, warna assumption.
- **Safety tripwires** (`core/rtx-safety.js`) — pre/post interceptors har adapter
  call ko wrap karte hain (`RTXSafetyLayer.wrapAdapter`); trip = immediate halt
  (`SafetyTripwireError`), kabhi silent pass nahi.
- `test/` — zero-dep smoke tests (`smoke-mcts`, `smoke-router`, `smoke-safety`,
  `smoke-verifier`, `smoke-planner`; plain `node:assert`, sab exit 0).
- `LICENSE` (MIT) — Copyright (c) 2026 Prosenjit Paul (aka Prosen). README ka MIT
  badge ab legally true hai; pehle LICENSE file thi hi nahi (legally all rights
  reserved tha). P0 fix #1. ⚠️ **License choice user confirmation pending** —
  client/production use se pehle confirm karo.
- `.gitignore` — runtime junk (`**/workspaces/`, state JSONs, `health-report.json`,
  `fugu_scratchpads/`, logs, editor files) ab commit nahi hoga. Note: purana
  committed junk abhi bhi repo mein hai — ye sirf future noise rokta hai. P0 fix #4.
- `eval/` — zero-dep measurement harness (`eval/rtx-eval.js` + `eval/golden-tasks.json`):
  golden tasks ko ACTUAL engine modules se chala kar behaviour score karta hai.
  Honesty rule: jo measure nahi hua wo "unevaluated" report hota hai, kabhi 0 nahi.
  ⚠️ `--target` ko ABSOLUTE path chahiye — relative path (`.`) exit 1 par fail hota hai.

### Fixed
- **README honest rewrite** (P0 fix #5) — full rewrite: sirf verified claims, tested
  Quick Start (13 Oct 2026, har command khud chalaya), sahi paths (toota hua
  `cd RTXCoreOrchestrate/RTXCoreOrchestrate/RTX-Engine` gaya), "Current limitations"
  section, CLI reference har entry point ka, eval snapshot, prominent license-pending
  flag. Koi marketing fluff nahi, koi jhootha badge nahi.
- **Conductor ab real `adapter.run()` call karta hai** (P0 fix #3 — sabse bada change).
  Pehle `getAdapter()` sirf instantiate karta tha aur output hardcoded mock strings
  hote the. Ab: har step `BaseAdapter.run()` se real spawn karta hai (30s timeout,
  ENOENT handling); CLI binary missing ho to hi documented mock fallback
  (`🧪 Mock fallback (CLI unavailable)`) — aur `usedMock` honesty flag track hota
  hai. ULTRA ke rigged `SIMULATED_FAIL` branches gaye — dono branches ab real
  adapter outputs chalate hain, verifier unhi ko score karta hai.
- **Router ab sirf registered CLIs par route karta hai** (P0 fix #6). `gemini-cli` /
  `marlin` routing targets se hata diye gaye — `config/cli-registry.json` se load
  hui `ALLOWED_CLIS` set ke bahar kuch return nahi hota. Saath hi `getAdapter()` ab
  unknown tool par throw nahi karta — warning + documented mock fallback.
  (13 Oct 2026 ko crash live reproduce hua tha: `"research the web"` → `gemini-cli`
  → `Unknown tool` — ab impossible hai.)

### Security
- `core/rtx-cli-bridge.js` — `dispatch()` ab shell string-concatenation nahi karta.
  Pehle `bash -c "<cmd> <command>"` banta tha (command-injection surface); ab binary
  aur har argument argv array mein jate hain, `shell: false`. P0 fix #2 (JS part).
- `mini_fugu_conductor.py` (dono copies) — `shell=True` injection fix **landed**:
  execution ab argv-based hai, `shell=False`. (CHANGELOG draft mein "in-progress"
  tha — 13 Oct 2026 ko verify hua: actual code mein koi `shell=True` nahi bacha.)
  P0 fix #2 (Python part).

## [0.1.0] - 2026-07-06 (retrospective)

> Ye entry retrospective hai — us waqt koi changelog nahi tha. Single-day build
> sprint (12 commits) ka summary, review ke findings se compile kiya gaya.

### Added
- RTX-Engine scaffold: `rtx-conductor`, `rtx-planner`, `rtx-router` (5D feature vector),
  `rtx-mcts` (fixed-score simulation), `marlin-conductor`, `contradiction-tracker`,
  `rtx-verifier`, `rtx-safety`, `rtx-session`, `rtx-file-manager`, `rtx-sanitizer`,
  `rtx-cli-bridge`, adapters (`BaseAdapter` real spawn, `ClaudeAdapter`, `GhAdapter`),
  `scripts/health-check.js`.
- `config/cli-registry.json` — 3 CLI defs (`claude_code`, `gh_cli`, `copilot_cli`).
- `mini_fugu_conductor.py` Python POC (2 copies), `docs/fugu-research/` Sakana paper notes.
- README with pipeline diagram, Marlin tiers, usage examples.

### Known issues (is release mein maujood the)
- Conductor `adapter.run()` kabhi call nahi karta — sab output mock strings.
- AB-MCTS fixed scores (6.8/9.2/4.5); UCB1 constant unused; `rtx-mcts.js` ka koi CLI entry point nahi.
- Marlin "scraping" hardcoded filenames; contradiction input 2 fixed sentences.
- README mein galat paths aur false claims ("runs real CLI pipelines"); LICENSE file missing
  (badge ke bawajood); `.gitignore` missing; zero tests/CI.

---

[Unreleased]: https://github.com/PsProsen-Dev/RTXCoreOrchestrate/compare/v0.1.0...improve/rtx-engine-real
[0.1.0]: https://github.com/PsProsen-Dev/RTXCoreOrchestrate/releases/tag/v0.1.0
