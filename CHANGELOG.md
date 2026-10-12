# Changelog

Is project ke saare notable changes is file mein document honge.

Format [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) par based hai,
aur ye project [Semantic Versioning](https://semver.org/spec/v2.0.0.html) follow karega
(pehli tagged release abhi baaki hai).

> **Imandari note:** "Unreleased" mein sirf wahi entries hain jo working tree mein
> **actually maujood** hain (chahe commit na hue hon). Jo kaam roadmap mein hai par
> abhi code mein nahi, wo "Planned" ke neeche clearly marked hai — implemented
> hone par hi upar move hoga. (Review: `research_notes/rtx-core-orchestrate-review/`, §6 roadmap.)

## [Unreleased]

### Added
- `LICENSE` (MIT) — Copyright (c) 2026 Prosenjit Paul (aka Prosen). README ka MIT
  badge ab legally true hai; pehle LICENSE file thi hi nahi (legally all rights
  reserved tha). P0 fix #1.
- `.gitignore` — runtime junk (`**/workspaces/`, state JSONs, `health-report.json`,
  `fugu_scratchpads/`, logs, editor files) ab commit nahi hoga. Note: purana
  committed junk abhi bhi repo mein hai — ye sirf future noise rokta hai. P0 fix #4.
- `eval/` — zero-dep measurement harness (`eval/rtx-eval.js` + `eval/golden-tasks.json`):
  golden tasks ko ACTUAL engine modules se chala kar behaviour score karta hai.
  Honesty rule: jo measure nahi hua wo "unevaluated" report hota hai, kabhi 0 nahi.

### Fixed
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
- `mini_fugu_conductor.py` (dono copies) — `shell=True` injection fix in-progress.
  P0 fix #2 (Python part).

### Planned (roadmap — abhi implement nahi hua)
- **README honest rewrite** — sahi paths, jhoothe claims ("runs real CLI pipelines",
  fake MCTS flags) hatao ya real status likho, Quick Start khud chalakar verify karo,
  LICENSE section add karo. P0 fix #5. (Team Docs: commander ke "finalize" message
  ke baad Phase 2 mein hoga; is draft ke saare commands 13 Oct 2026 ko live verify
  hue hain — docs/ARCHITECTURE.md §3 dekho.)

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
