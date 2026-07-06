# ⚡ RTXCoreOrchestrate

<div align="center">

![RTX Core](https://img.shields.io/badge/RTX⚡-Core%20Framework%20v2.0-blueviolet?style=for-the-badge&logo=lightning)
![Fugu Ultra](https://img.shields.io/badge/Fugu-Ultra%20Edition-orange?style=for-the-badge)
![Marlin](https://img.shields.io/badge/Marlin-Conductor-teal?style=for-the-badge)
![AB-MCTS](https://img.shields.io/badge/AB--MCTS-Enabled-green?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)

**The Ultimate AI Orchestration Engine — Built on the RTX⚡ Core Framework**

*Reasoning | Thinking | Xtreme*

**By [Prosenjit Paul (PsProsen-Dev)](https://github.com/PsProsen-Dev)**

</div>

---

## 🧠 What is RTXCoreOrchestrate?

**RTXCoreOrchestrate** is a modular, CLI-native AI orchestration system that coordinates multiple frontier LLMs (Claude, GPT, Gemini) through a unified engine — inspired by Sakana AI's **Fugu Ultra** multi-agent architecture and **Marlin** strategic research methodology.

It turns any terminal into a powerful AI command center — no GUI, no bloat, just pure CLI power.

---

## 🏗️ Architecture Overview

```
RTXCoreOrchestrate/
│
├── Antigravity Ultimate (RTX⚡)/       ← Main Engine Directory
│   ├── RTXCoreFramework.md             ← Master AI System Prompt (RTX v2.0)
│   ├── mini_fugu_conductor.py          ← Lightweight Python Fugu orchestrator
│   │
│   └── RTX-Engine/                     ← Node.js Orchestration Core
│       ├── config/
│       │   └── cli-registry.json       ← CLI tool registry (Claude, GH, etc.)
│       ├── core/
│       │   ├── rtx-conductor.js        ← Main task conductor (Fugu-Ultra style)
│       │   ├── rtx-planner.js          ← AAS dynamic step planner
│       │   ├── rtx-router.js           ← Model routing (Standard / Ultra mode)
│       │   ├── rtx-mcts.js             ← AB-MCTS tree search branching
│       │   ├── marlin-conductor.js     ← Strategic research report generator
│       │   ├── rtx-verifier.js         ← Output quality auditor
│       │   ├── rtx-safety.js           ← Pre-flight security scanner
│       │   ├── rtx-session.js          ← Session state manager
│       │   ├── rtx-file-manager.js     ← Workspace file manager
│       │   ├── rtx-sanitizer.js        ← Input/output sanitizer
│       │   ├── rtx-cli-bridge.js       ← CLI process bridge
│       │   └── adapters/
│       │       ├── BaseAdapter.js      ← Abstract adapter interface
│       │       ├── ClaudeAdapter.js    ← Anthropic Claude CLI adapter
│       │       └── GhAdapter.js        ← GitHub CLI adapter
│       ├── scripts/
│       │   └── health-check.js         ← System health diagnostics
│       └── workspaces/                 ← Auto-generated session outputs
│
├── Sakana_Marlin_Samples/              ← Sample Marlin strategy reports (PDF)
├── Fugu_technical_report.pdf           ← Sakana Fugu technical reference
└── ORGINAL Framework/                  ← Original RTX framework baseline
```

---

## ⚡ Core Components

### 1. 📄 RTXCoreFramework.md — The Master AI Prompt
The **RTX⚡ Core Framework** is a universal system prompt that calibrates any AI agent (Claude, GPT, Gemini, Codex, Antigravity, etc.) into a high-performance assistant following the **RTX protocol**:
- 🧠 **R**easoning — Logic, problem decomposition, intent verification
- 💡 **T**hinking — Continuous self-assessment and refinement
- ⚡ **X**treme — Action-oriented execution, maximum productivity

**How to use:**
> Copy the contents of `RTXCoreFramework.md` and paste it as a **System Prompt** or **Custom Instructions** in any AI tool.

---

### 2. 🐡 RTX-Engine — Node.js Orchestration Core

Inspired by **Sakana AI's Fugu Ultra**, the RTX-Engine coordinates multiple AI CLI tools as specialized workers.

#### Fugu-Ultra Mode (Multi-Agent Code Generation)
```bash
cd "Antigravity Ultimate (RTX⚡)/RTX-Engine"
node core/rtx-conductor.js --ultra "Build a FastAPI backend with JWT authentication"
```

#### Marlin Mode (Strategic Research Reports)
```bash
node core/marlin-conductor.js "Assess geopolitical impact of Strait of Hormuz blockade"
```

#### AB-MCTS Mode (Tree Search Decision Making)
```bash
node core/rtx-mcts.js --depth 3 --width 2 "Best architecture for a real-time trading system"
```

#### System Health Check
```bash
node scripts/health-check.js
```

---

### 3. 🐍 mini_fugu_conductor.py — Lightweight Python Orchestrator
A standalone Python-based Fugu-style conductor for quick task orchestration without the full Node.js engine.

```bash
python mini_fugu_conductor.py "Summarize and compare these two research papers"
```

---

## 🔧 Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| Node.js v18+ | RTX-Engine runtime | [nodejs.org](https://nodejs.org) |
| Python 3.10+ | mini_fugu_conductor | [python.org](https://python.org) |
| Claude CLI | AI code execution adapter | `npm install -g @anthropic-ai/claude-code` |
| GitHub CLI | Repo management adapter | [cli.github.com](https://cli.github.com) |

---

## 🚀 Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/PsProsen-Dev/RTXCoreOrchestrate.git
cd RTXCoreOrchestrate

# 2. Navigate to engine
cd "Antigravity Ultimate (RTX⚡)/RTX-Engine"

# 3. Install dependencies (if package.json exists)
npm install

# 4. Run health check
node scripts/health-check.js

# 5. Execute your first orchestrated task
node core/rtx-conductor.js "Create a hello world REST API"
```

---

## 🐟 Fugu-Ultra Architecture (How it Works)

```
User Prompt
     │
     ▼
 rtx-router.js         ← Selects Standard or Ultra mode
     │
     ▼
 rtx-planner.js        ← AAS: Generates dynamic step plan
     │
     ▼
 rtx-conductor.js      ← Dispatches tasks to CLI workers
   ├── Candidate A  ──► ClaudeAdapter.js
   └── Candidate B  ──► GhAdapter.js
          │
          ▼
     rtx-mcts.js       ← AB-MCTS: Selects best candidate
          │
          ▼
    rtx-verifier.js    ← Quality audit + reflection loop
          │
          ▼
      Final Output
```

---

## 🗺️ Marlin Intelligence Architecture

Marlin-style reports follow a **3-layer analytical structure**:

| Layer | Type | Description |
|-------|------|-------------|
| ✅ Verified Facts | Hard Data | Cross-referenced with citations |
| 🔶 Working Assumptions | Soft Data | Unverified but plausible inputs |
| 💡 Analyst Inferences | Logic | Reasoned conclusions from above |

**Monitoring Tiers:**
- **Tier 1** (0–6 months) — Immediate leading indicators
- **Tier 2** (0–12 months) — Medium-term developments
- **Tier 3** (6–36 months) — Long-term structural shifts

---

## 🛡️ Security

- Pre-flight payload scanning on ALL shell commands
- No credential storage in session state files
- Input validation on agent names and parameters
- See **Section 14** of `RTXCoreFramework.md` for full security policy

---

## 📚 References & Inspiration

- [Sakana AI — Fugu Technical Report](https://arxiv.org/html/2606.21228v1)
- [Sakana AI — Marlin Strategic Intelligence](https://sakana.ai/marlin)
- [Sakana AI — AB-MCTS](https://sakana.ai/ab-mcts)
- [RTX⚡ Core Framework](./Antigravity%20Ultimate%20%28RTX%E2%9A%A1%29/RTXCoreFramework.md)

---

## 📝 License

MIT License — Free to use, modify, and distribute with attribution.

---

<div align="center">

**Built with ⚡ by [Prosenjit Paul (PsProsen-Dev)](https://github.com/PsProsen-Dev)**

*"Reasoning. Thinking. Xtreme."*

</div>
