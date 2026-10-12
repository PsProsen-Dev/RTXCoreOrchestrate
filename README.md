# ⚡ RTXCoreOrchestrate

> **Honest status (13 Oct 2026):** Ye ek **CLI-first multi-agent orchestration prototype** hai — Sakana AI ke Fugu / Marlin / TRINITY ideas se inspired. Architecture ke building blocks real hain (real CLI spawning, real AB-MCTS, real safety tripwires), par **is environment mein koi LLM CLI installed nahi hai** — isliye LLM steps **documented mock fallback** par chalte hain. Jo kaam karta hai wo neeche clearly marked hai; jo limited hai wo [Current limitations](#-current-limitations-honest-list) mein.
>
> ⚠️ **License note:** `LICENSE` file mein MIT hai — **par license choice user confirmation pending hai.** Client/production use se pehle confirm karo.

**By [Prosenjit Paul (aka Prosen)](https://github.com/PsProsen-Dev)** · Zero npm dependencies · Pure Node.js stdlib

---

## Ye kya hai (3 lines, honestly)

1. Ek **CLI-first multi-agent orchestration prototype** — ek user goal andar jata hai, planner steps banata hai, conductor unhe CLI workers (Claude Code, GitHub CLI, Copilot CLI) par chalata hai, verifier quality check karta hai.
2. Conductor ab **real `adapter.run()`** se CLIs spawn karta hai (30s timeout, argv-only execution); CLI binary missing ho to **documented mock fallback** (`🧪`) milta hai — output mein hamesha visible rehta hai ki mock tha ya real.
3. Search/selection real hai: **AB-MCTS** (UCB1, adaptive wider/deeper branching, backprop), **TRINITY turn-loop** (worker → verifier → revise), **safety tripwires** har adapter call par — par scoring **deterministic rubric** par chalti hai; LLM-as-judge optional hai aur abhi unconfigured.

---

## 🚀 Quick Start

Har command neeche 13 Oct 2026 ko **khud chalakar verify** kiya gaya hai. Folder names mein spaces + emoji hain — path quotes mein lo.

### Prerequisites

| Tool | Zaroori? | Note |
|------|----------|------|
| Node.js v18+ | ✅ Yes | Sirf yehi required hai (tested: v24.20.0) |
| `gh` CLI | ⚠️ Optional | Missing → uske steps mock fallback par |
| `claude` CLI | ⚠️ Optional | Missing → mock fallback par (is env mein missing) |
| `github-copilot-cli` | ⚠️ Optional | Missing → mock fallback par (is env mein missing) |
| Python 3.10+ | ⚠️ Optional | Sirf `mini_fugu_conductor.py` POC ke liye |

### Setup

```bash
# Clone the repository
git clone https://github.com/PsProsen-Dev/RTXCoreOrchestrate.git
cd RTXCoreOrchestrate

# Engine directory (note the quotes — spaces + emoji in folder names)
cd "Antigravity Ultimate (RTX⚡)"/RTX-Engine

# System health check — kaunsi CLI real chalegi, kaunsi mock par
node scripts/health-check.js
```

Expected output (is env mein):

```
  ⚠️   [claude_code   ] claude                   NOT FOUND → mock mode
  ✅  [gh_cli        ] gh                       gh version 2.102.0
  ⚠️   [copilot_cli   ] github-copilot-cli       NOT FOUND → mock mode
  ✅  [node          ] node                     v24.20.0
  ✅  [git           ] git                      git version 2.43.0

✅ [RTX-HealthCheck] All REQUIRED binaries present. Engine is go! 🚀
🧪 [RTX-HealthCheck] Mock mode CLIs: [claude_code, copilot_cli]
```

### Chalao (examples)

```bash
# Standard pipeline: planner → conductor → verifier → session
node core/rtx-conductor.js "Build a FastAPI backend with JWT authentication"

# ULTRA mode: parallel candidate racing + verifier best-selection + zyada turn budget
node core/rtx-conductor.js --ultra "Create a hello world REST API"

# AB-MCTS standalone: real tree search (koi API key nahi chahiye — rubric scoring)
node core/rtx-mcts.js --depth 2 --width 3 --budget 12 "Best architecture for a real-time trading system"

# Marlin: 3-layer research report apne notes/sources se
RTX_MARLIN_SOURCES=/path/to/your/notes node core/marlin-conductor.js "Your research question"

# Repo root se: eval harness (target ABSOLUTE path hona chahiye — relative path fail hota hai)
cd ../..   # wapas repo root par
node eval/rtx-eval.js --target "$PWD" --out /tmp/eval-results.json

# Smoke tests (repo root se; zero-dep, plain node:assert)
node test/smoke-mcts.js
node test/smoke-router.js
node test/smoke-safety.js
node test/smoke-verifier.js
node test/smoke-planner.js
```

---

## 🖥️ CLI reference (har entry point jo actually exist karta hai)

| Entry point | Command | Kya karta hai (verified) |
|---|---|---|
| Main pipeline | `node core/rtx-conductor.js [--ultra] "<goal>"` | Plan → per-step TRINITY turn-loop (worker→verifier→revise, budget 2 standard / 4 ultra) → real `adapter.run()` spawn ya documented mock → credential check → sanitize → session log → `COMPLETED ✅` |
| ULTRA racing | (upar wala, `--ultra` flag) | `requires_mcts` steps par real AB-MCTS search (budget 8, worker pool = step.tool + fallback chain); hard non-MCTS steps par **parallel candidate racing** (`Promise.all` across router fallback chain, verifier winner chunta hai) |
| Research reports | `node core/marlin-conductor.js "<goal>"` | 5 stages: evidence gather (`RTX_MARLIN_SOURCES` dir / `RTX_MARLIN_NOTES` file / optional `queryAdapter`) → hypotheses → real ContradictionTracker → real AB-MCTS → **3-layer report** (Verified Facts / Working Assumptions / Inferences), har line source-linked |
| Standalone search | `node core/rtx-mcts.js --depth N --width M --budget K "<query>"` | Real AB-MCTS: tree nodes, UCB1 (c=1.414) selection, adaptive GO WIDER / GO DEEPER, backprop, `topK()` best-first. Defaults: `--depth 1 --width 3 --budget 12`. Bina LLM ke chalta hai — deterministic rubric scoring |
| Health diagnostics | `node scripts/health-check.js` | 5 CLIs scan karta hai (`claude`, `gh`, `github-copilot-cli`, `node`, `git`), `health-report.json` likhta hai, missing CLIs ko mock mode declare karta hai |
| Eval harness | `node eval/rtx-eval.js --target <ABSOLUTE path> [--golden eval/golden-tasks.json] [--out results.json]` | Golden tasks ko **actual engine modules** se chala kar behaviour score karta hai. Honesty rule: jo measure nahi hua wo "unevaluated" report hota hai, kabhi 0 nahi. ⚠️ `--target` relative path (`.`) par **fail hota hai** (exit 1) — absolute path use karo |
| Smoke tests | `node test/smoke-{mcts,router,safety,verifier,planner}.js` | Zero-dep assertions har core module par — sab exit 0 (verified 13 Oct 2026) |
| Python POC | `python3 "Antigravity 2.0 (RTX⚡)"/mini_fugu_conductor.py "<task>"` | Lightweight Fugu-style orchestrator **POC — sirf echo-based mocks**, real execution nahi. argv-based execution (`shell=True` injection fix landed) |

**Run karne ki jagah:** engine commands `Antigravity Ultimate (RTX⚡)/RTX-Engine/` ke andar se; `eval/` aur `test/` repo root se.

### Registered CLIs (routing targets)

`config/cli-registry.json` mein **sirf 3** CLIs hain — router inhi par route karta hai, inke bahar kuch nahi:

| ID | Binary | Type |
|---|---|---|
| `claude_code` | `claude` | LLM coder |
| `gh_cli` | `gh` | VCS (repo/PR/deploy) |
| `copilot_cli` | `gh copilot` | LLM coder |

> Note: GPT / Gemini registry mein **nahin** hain. README ke purane "Claude, GPT, Gemini" claim ko hata diya gaya hai.

---

## ✅ Kya actually kaam karta hai (verified list, 13 Oct 202
...[truncated 8553 chars]