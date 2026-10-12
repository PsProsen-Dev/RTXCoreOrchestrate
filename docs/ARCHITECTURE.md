# RTXCoreOrchestrate — Architecture

**Engine location:** `Antigravity Ultimate (RTX⚡)/RTX-Engine/`
**Status:** CLI-first multi-agent orchestration **prototype** (simulation level — koi real LLM execution path connected nahi hai; details neeche).
**Evidence basis:** Saare core files khud padhe gaye + entry points 13 Oct 2026 ko live chalaye gaye. Ye doc code kya **karta** hai wahi batata hai — README ke claims nahi. (Draft ke dauran doosri teams ke P0 fixes — conductor wiring, router registry-only routing, `.gitignore`, `eval/` harness — working tree mein land hue; ye doc unko reflect karta hai. Uncommitted hain, isliye "working tree mein" tag ke saath marked.)

**Stack:** Node.js (pure stdlib — zero npm dependencies, koi `package.json` nahi), thoda Python (POC only).

---

## 1. Component map

### 1.1 `core/rtx-conductor.js` — main pipeline

- Entry: `node core/rtx-conductor.js [--ultra] "<goal>"`.
- Flow: planner se plan lo → per-step: TRINITY role display → heuristic model suggest (display only — step ka tool change **nahi** hota) → safety pre-flight → **adapter.run() se real execution** → credential-leak check → sanitizer → session log → artifact register.
- **P0 #3 fix (working tree mein, uncommitted):** pehle `getAdapter()` adapter sirf **instantiate** karta tha, `adapter.run()` **kabhi call nahi hota** tha — output hardcoded mock strings hote the. Ab har step `BaseAdapter.run()` se real spawn karta hai (30s timeout, ENOENT handling). CLI binary missing ho to hi documented mock fallback milta hai (`🧪 Mock fallback`), aur `usedMock` honesty flag track hota hai.
- ULTRA mode: `requires_mcts` steps par ab **dono branches real adapter outputs** chalate hain → `RTXVerifier.compareBranches()` unhi ko score karta hai. (Pehle 2 fixed strings the — Branch 2 SIMULATED_FAIL −30 penalty ki wajah se hamesha jeetta tha.)
- Unknown tool ids par `getAdapter()` ab throw nahi karta — warning + documented mock fallback.
- Retry: standard mode max 1 attempt, ULTRA max 3.

### 1.2 `core/rtx-planner.js` — keyword-based goal decomposer (`<role_thinker>`)

- Goal ko lowercase karke keyword match karta hai (`repo`/`git` → create_repo, `code`/`backend`/`api` → scaffold_codebase, `frontend`/`ui`/`react` → scaffold_frontend, `auth`/`jwt` → inject_authentication, `deploy`/`vercel` → production_deploy).
- Har goal hamesha `architecture_spec` (thinker) se start aur `synthesize_final_output` (synthesizer) par end hota hai. ULTRA mode mein extra `security_audit` verifier step.
- Har step: `{ step, tool, action, details, trinity_role, requires_mcts, dependencies }`. Tool router se aata hai (neeche §1.3).
- Goal registry **in-memory `Map`** hai — process exit par goals lost ho jate hain (session state alag se disk par hai, §1.8).

### 1.3 `core/rtx-router.js` — 5D feature-vector routing head (Fugu-style)

- Feature vector `h = [complexity, hasCode, hasResearch, hasDeploy, isUrgent]` — sab keyword-based, 0.0–1.0.
- Scores: `claude_code` (code-heavy), `copilot_cli` (code default), `gh_cli` (deploy) — phir `historyMultiplier` (Ultron's adaptive weight; `recordOutcome()` se update hota hai, par conductor isko **kabhi call nahi karta** — history hamesha 1.0 rehta hai).
- **P0 #6 fix (working tree mein, uncommitted):** pehle router `gemini-cli`/`marlin` return kar sakta tha — dono `config/cli-registry.json` mein **nahi** the, aur `conductor.getAdapter()` `Unknown tool` throw karke pipeline tod deta tha (13 Oct 2026 ko live reproduce hua). Ab routing **registry-only** hai: `ALLOWED_CLIS` set `cli-registry.json` se load hota hai, uske bahar kuch return nahi hota.
- `RTXHeuristicConductor` (conductor ke andar): `computeComplexity()` + `selectModel()` — sirf **suggestion** print karta hai (`🎛️ Heuristic override`), actual routing nahi badalta.

### 1.4 `core/rtx-mcts.js` — "AB-MCTS" (label honest nahi hai — ye fixed-score mock hai)

- `search(query, branchesCount=3)`: 3 hardcoded branch descriptions print karta hai, `evaluateBranch()` **fixed scores** deta hai (Branch 1: 6.8, Branch 2: 9.2, Branch 3: 4.5), max select hota hai.
- **Koi tree nahi banta, koi rollout/simulation/backpropagation nahi.** UCB1 constant (`1.414`) declare hai par kahin use nahi hota. "Go Wider / Go Deeper" sirf console.log labels hain.
- Callers: `marlin-conductor.js` (`search(goal, 3)`). Conductor ka ULTRA path MCTS class use nahi karta — apne 2 branches khud banata hai (P0 #3 ke baad dono real adapter runs hain).
- **Koi CLI entry point nahi** — `node core/rtx-mcts.js --depth 3 --width 2` silently kuch nahi karta, exit 0 (live verified 13 Oct 2026).

### 1.5 `core/marlin-conductor.js` — standalone research-report **template** generator

- Flow: `mcts.search()` → 3 hardcoded PDF filenames ka "scraping" console.log → `ContradictionTracker.track()` 2 **hardcoded** sentences par → pre-written resolution → `strategic_report.md` template.
- Output shape real hai (markdown report file banti hai), content fixed hai — 3 mein se 2 committed sample reports byte-identical hain.
- `rtx-safety.js` import karta hai par **kabhi call nahi karta**.

### 1.6 `core/rtx-verifier.js` — keyword math scoring (`<role_verifier>`)

- `_scoreOutput()`: syntax (base 50; `SIMULATED_FAIL`/`ERROR:` par −30; `try/catch` +15; `async/await` +10) + complexity (base 25; TODO/FIXME/placeholder par −20) + safety (base 25; destructive pattern par 0). **Total 100 mein se; <40 = fail.**
- Note: "premium"/"advanced" par +25 ka **koi effect nahi** — complexity 25 base par +25 = 50, phir `min(25, …)` clamp se wapas 25. Dead bonus hai.
- `compareBranches()`: ULTRA mein Branch 1 (70: syntax 20) vs Branch 2 (100: syntax 50) — **Branch 2 hamesha jeetta hai**, jeet ka reason SIMULATED_FAIL penalty hai, keyword bonus nahi. Live verified.
- Credential leak mile to auto-fail (score 0).

### 1.7 `core/rtx-safety.js` — pre-flight scanner (weak — hardening pending)

- `checkCommand()`: ~50 destructive **substring** patterns (`rm -rf`, `curl | bash`, `drop table`, PowerShell bypass flags…). Substring matching trivially bypass hota hai — ye foundation hai, guarantee nahi.
- `checkForCredentialLeaks()`: 8 regex patterns (AWS keys, GitHub PAT, SSH private keys, generic secrets). **Par redaction sirf 2 patterns par hota hai** (`ghp_*`, `AKIA*`) — baaki 6 detect to hote hain par payload mein rehte hain.
- `lockSessionState()`: sirf ek lock-object **return** karta hai — session file mein kuch nahi likhta. Conductor isko call karta hai par result use nahi karta.

### 1.8 `core/rtx-session.js` — REAL state checkpoint/resume

- State file: `<cwd>/workspaces/<sessionId>/.rtx_orchestration_state.json` (har step ke baad `_persist()`).
- Crash resume: `sessionLocked` flag check karke auto-recover; `getNextPendingStep()` PENDING/FAILED step dhoondhta hai.
- Counters: `modelRoutes{}`, `failCount`, `credentialLeaksBlocked`.
- ⚠️ **Dir-split inconsistency:** session state `<cwd>/workspaces/` mein jata hai, par artifacts (`rtx-file-manager.js`) engine-relative `RTX-Engine/workspaces/` mein. Dono alag jagah — resume/artifacts kabhi ek saath nahi milte.

### 1.9 Adapters — `core/adapters/` (machinery ready, ignition disconnected)

| File | Kya hai | Status |
|---|---|---|
| `BaseAdapter.js` | Real `child_process.spawn()`: 30s timeout + kill, ENOENT handling, PowerShell-on-Windows, UTF-8 env, `stdio: ['ignore',…]` (no stdin hang), mock fallback jab `mockMode` | Code genuinely production-grade soch ka hai — **par `run()` ko conductor kabhi call nahi karta** |
| `ClaudeAdapter.js` | `buildArgs`: `claude -p "<details>" --output-format json` | Thin wrapper, real banne ke liye ready |
| `GhAdapter.js` | `create_repo` → `gh repo create`, `open_pr` → `gh pr create`, baaki passthrough | Thin wrapper |
| `config/cli-registry.json` | 3 CLI defs: `claude_code`, `gh_cli`, `copilot_cli` | Router ke `gemini-cli`/`marlin` outputs yahan missing hain (P0 #6) |

Note: `mockMode` ab conductor se wire hai — `getAdapter()` health-check ke `isAvailable(toolId)` se `adapter.mockMode` set karta hai (P0 #3 fix, working tree). Binary missing → `BaseAdapter.run()` documented mock result deta hai; binary present → real spawn.

### 1.10 Baaki modules

| File | Kaam | Status |
|---|---|---|
| `core/rtx-cli-bridge.js` | CLI dispatch | **P0 security fix working tree mein hai** — pehle `bash -c "<cmd> <command>"` string concat (injection surface); ab argv array + `shell: false`. (Team Security ka kaam — CHANGELOG dekho) |
| `core/rtx-sanitizer.js` | ANSI color codes + startup noise strip | Chhota, kaam karta hai |
| `core/rtx-file-manager.js` | Artifacts `RTX-Engine/workspaces/<sessionId>/` mein likhta hai | Kaam karta hai; dir-split issue §1.8 dekho |
| `core/contradiction-tracker.js` | **REAL module:** `FactNormalizer` (negation token-groups, number/year extraction, keyword overlap) + `ContradictionMatcher` (direct_negation jab keyword overlap >0.4; numeric disagreement jab >10% diff). O(n²) pairwise — ~≤20 nodes tak fine | Testable aur sahi hai; problem sirf ye hai ki marlin-conductor isko hamesha wahi 2 hardcoded sentences deta hai |
| `scripts/health-check.js` | 5 CLIs scan karta hai (`claude`, `gh`, `github-copilot-cli`, `node`, `git`), `health-report.json` likhta hai | ✅ Live verified 13 Oct 2026: `gh 2.102.0` aur `node v24.20.0` present; `claude`/`github-copilot-cli` missing → mock mode |
| `mini_fugu_conductor.py` (×2 copies: `Antigravity 2.0/` aur `Antigravity IDE/` folders) | Python POC orchestrator — echo-based mocks | Chalta hai; `shell=True` injection fix in-progress (P0 #2) |

---

## 2. Data flow (asli — intended nahi)

### 2.1 Conductor pipeline

```
User Prompt
   │  node core/rtx-conductor.js [--ultra] "<goal>"
   ▼
┌──────────────────┐
│ rtx-planner      │  keyword match → steps (thinker→worker→verifier→synthesizer)
│                  │  tool per step ← rtx-router (⚠️ gemini-cli/marlin → CRASH)
└──────┬───────────┘
       ▼
┌──────────────────┐
│ rtx-conductor    │  heuristic model SUGGEST (display only, routing nahi badalta)
│                  │  rtx-safety.checkCommand(step) → unsafe = skip + (fake) lock
└──────┬───────────┘
       ▼
   ULTRA + requires_mcts? ──YES──▶ dono branches REAL adapter.run() chalate
       │                              hain → verifier.compareBranches real
       │                              outputs ko score karta hai
       │ NO ▼
   ┌───────────────────────────────────────────────┐
   │ adapter = getAdapter(step.tool)               │
   │ result = await adapter.run(stepInput, {       │
   │   workspace })  ← ✅ P0 #3: REAL spawn        │
   │ CLI missing → documented mock fallback (🧪)    │
   │   + usedMock honesty flag                     │
   └───────────────────────────────────────────────┘
       ▼
┌──────────────────┐
│ rtx-verifier     │  keyword score (<40 = fail → retry, ULTRA: max 3, standard: max 1)
│ rtx-safety       │  credential-leak check → redacted version (sirf ghp_/AKIA)
│ rtx-sanitizer    │  ANSI/noise strip
└──────┬───────────┘
       ▼
┌──────────────────────────────────────────────────┐
│ rtx-session  → state JSON: <cwd>/workspaces/<id>/ │
│ rtx-file-manager → artifacts: engine/workspaces/  │  ← ⚠️ alag directories
└──────────────────────────────────────────────────┘
       ▼  "COMPLETED ✅" (kuch real kiya ho ya na ho)
```

### 2.2 Marlin standalone flow

```
node core/marlin-conductor.js "<goal>"
   ▼
rtx-mcts.search(goal, 3) → fixed scores (6.8/9.2/4.5) → Branch 2 "jeetta"
   ▼
"Scraping" = 3 hardcoded PDF filenames ka console.log (koi file read nahi hoti)
   ▼
ContradictionTracker.track(2 hardcoded sentences) → 1 contradiction → pre-written resolution
   ▼
strategic_report.md template → engine/workspaces/marlin_session_<ts>/
```

---

## 3. Entry points (live verified 13 Oct 2026)

| Entry point | Command | Result |
|---|---|---|
| Main pipeline | `node core/rtx-conductor.js [--ultra] "<goal>"` | ✅ Chalta hai — mock pipeline, `COMPLETED ✅` print hota hai, koi real execution nahi |
| Research reports | `node core/marlin-conductor.js "<goal>"` | ✅ Chalta hai — fixed-content template report generate hoti hai |
| CLI availability | `node scripts/health-check.js` | ✅ Chalta hai — 5 CLIs scan, `health-report.json` likhta hai |
| MCTS direct | `node core/rtx-mcts.js --depth 3 --width 2` | ❌ Silently kuch nahi karta (exit 0) — koi CLI entry point nahi; sirf `module.exports` |
| Python POC | `python mini_fugu_conductor.py` | ⚠️ Chalta hai — sab echo mocks; `shell=True` (fix in-progress) |
| Programmatic | `require('./core/rtx-conductor')` etc. | ✅ Har core module require-able hai |

**Run karne ki jagah:** `Antigravity Ultimate (RTX⚡)/RTX-Engine/` ke andar se — folder name mein spaces + emoji hain, isliye path quotes mein lo.

---

## 4. TRINITY roles → modules

| Role | Matlab | Module |
|---|---|---|
| `<role_thinker>` | Goal decompose, architecture spec | `rtx-planner.js` |
| `<role_worker>` | Step execute (intended) | adapters (`BaseAdapter.run()` — abhi unwired) |
| `<role_verifier>` | Quality audit, branch scoring | `rtx-verifier.js` + `rtx-safety.js` |
| `<role_synthesizer>` | Final output combine | conductor ka last step (currently sirf completion print) |

---

## 5. Jaan-boojh kar documented limitations

Ye cheezein design mein **abhi** aisi hain — roadmap mein fix planned hai (CHANGELOG.md dekho).
(P0 #3 conductor wiring aur P0 #6 router bug working tree mein fix ho chuke hain —
upar §1.1/§1.3 mein current state documented hai.)

1. Session state aur artifacts alag directories mein jate hain (§1.8).
2. Safety substring-matching bypassable hai; redaction adhura hai (P1: hardening).
3. Goal registry in-memory hai — restart par goals lost (P1: router history persist).
4. Zero tests / CI / lint (P1) — `eval/` harness abhi aaya hai, unit tests abhi bhi nahi.
5. Teen folder variants mein duplicate files (`mini_fugu_conductor.py` ×2, `health-check.js` ×2) (P1: dedup).
6. Purana runtime junk (workspaces, state JSONs) abhi bhi repo mein committed hai — `.gitignore` sirf future noise rokta hai (P0 #4 ka baaki hissa).

---

*Ye doc `improve/rtx-engine-real` branch ka hissa hai. Code badle to ye doc bhi update karo — jhootha doc, jhoothe README se behtar nahi hai.*
