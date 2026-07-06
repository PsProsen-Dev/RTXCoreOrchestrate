<div align="center">

# ⚡ RTXCoreOrchestrate

### *Reasoning · Thinking · Xtreme*

[![RTX Core](https://img.shields.io/badge/RTX⚡-Framework%20v2.0-7c3aed?style=for-the-badge)](https://github.com/PsProsen-Dev/RTXCoreOrchestrate)
[![Fugu Ultra](https://img.shields.io/badge/Fugu-Ultra%20Edition-f97316?style=for-the-badge)](https://sakana.ai/fugu)
[![Marlin](https://img.shields.io/badge/Marlin-Conductor-0d9488?style=for-the-badge)](https://sakana.ai/marlin)
[![AB-MCTS](https://img.shields.io/badge/AB--MCTS-Enabled-16a34a?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-MIT-3b82f6?style=for-the-badge)](#license)

**A modular, CLI-native AI orchestration engine built on the RTX⚡ Core Framework.**  
Coordinates multiple frontier LLMs through a unified terminal interface —  
inspired by Sakana AI's Fugu Ultra multi-agent architecture and Marlin strategic research methodology.

**By [Prosenjit Paul (PsProsen-Dev)](https://github.com/PsProsen-Dev)**

</div>

---

## 📌 What is RTXCoreOrchestrate?

RTXCoreOrchestrate is a **CLI-first AI orchestration system** that turns your terminal into a multi-agent command center. It routes tasks across frontier LLMs (Claude, GPT, Gemini) using a custom planner → conductor → verifier pipeline — with zero GUI dependencies.

It ships two core components:

| Component | File | Purpose |
|-----------|------|---------|
| **RTX Framework** | `RTXCoreOrchestrate/RTXCoreFramework.md` | Universal AI system prompt — calibrates any LLM |
| **RTX Engine** | `RTXCoreOrchestrate/RTX-Engine/` | Node.js orchestration core — runs real CLI pipelines |
| **Mini Conductor** | `RTXCoreOrchestrate/mini_fugu_conductor.py` | Lightweight Python Fugu-style task orchestrator |

---

## 🗂️ Repository Structure

```
RTXCoreOrchestrate/                        ← Root
├── README.md
└── RTXCoreOrchestrate/                    ← Main engine directory
    ├── RTXCoreFramework.md                ← Master AI system prompt (RTX v2.0)
    ├── mini_fugu_conductor.py             ← Python lightweight orchestrator
    ├── fugu_scratchpads/                  ← Session state cache
    └── RTX-Engine/                        ← Node.js orchestration core
        ├── config/
        │   └── cli-registry.json          ← Registered CLI tool definitions
        ├── core/
        │   ├── rtx-conductor.js           ← Main task conductor
        │   ├── rtx-planner.js             ← AAS dynamic step planner
        │   ├── rtx-router.js              ← Model routing (Standard / Ultra)
        │   ├── rtx-mcts.js                ← AB-MCTS tree search engine
        │   ├── marlin-conductor.js        ← Strategic research report generator
        │   ├── rtx-verifier.js            ← Output quality auditor
        │   ├── rtx-safety.js              ← Pre-flight security scanner
        │   ├── rtx-session.js             ← Session state manager
        │   ├── rtx-file-manager.js        ← Workspace file manager
        │   ├── rtx-sanitizer.js           ← Input/output sanitizer
        │   ├── rtx-cli-bridge.js          ← CLI process bridge layer
        │   └── adapters/
        │       ├── BaseAdapter.js         ← Abstract adapter interface
        │       ├── ClaudeAdapter.js       ← Anthropic Claude CLI adapter
        │       └── GhAdapter.js           ← GitHub CLI adapter
        ├── scripts/
        │   └── health-check.js            ← System health diagnostics
        └── workspaces/                    ← Auto-generated session outputs
```

---

## 🧠 RTXCoreFramework.md — The Master AI Prompt

The **RTX⚡ Core Framework** is a universal system prompt that calibrates any AI agent into a high-performance assistant. Works with Claude, GPT, Gemini, Codex, Cursor, Antigravity, and any LLM that accepts a system prompt.

**Core Protocol (RTX):**

| Letter | Meaning | Role |
|--------|---------|------|
| **R** | Reasoning | Logic verification, problem decomposition, intent understanding |
| **T** | Thinking | Self-assessment, learning, continuous refinement |
| **X** | Xtreme | Action-oriented execution, maximum speed and output quality |

**How to use:**
> Copy the full contents of `RTXCoreOrchestrate/RTXCoreFramework.md` and paste it as a **System Prompt** or **Custom Instructions** in any AI tool.

On first load, the agent runs the **First-Boot Protocol** — asking 3 sequential questions (mother tongue, agent name, addressal preference) to permanently configure its behavior.

---

## ⚙️ RTX-Engine — Orchestration Pipeline

Inspired by **Sakana AI's Fugu Ultra**, the engine dispatches subtasks to specialized CLI workers using a multi-stage pipeline:

```
                    ┌─────────────┐
     User Prompt ──►│  rtx-router │ ◄── Selects: Standard / Ultra mode
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ rtx-planner │ ◄── AAS: Generates dynamic step plan
                    └──────┬──────┘
                           │
                    ┌──────▼────────┐
                    │ rtx-conductor │ ◄── Dispatches to CLI workers
                    └──┬────────┬───┘
                       │        │
              ┌─────────▼─┐  ┌──▼──────────┐
              │ Candidate A│  │ Candidate B  │  ◄── Parallel generation
              │  (Claude)  │  │  (GH/Other) │
              └─────────┬──┘  └──┬──────────┘
                        │        │
                    ┌───▼────────▼───┐
                    │   rtx-mcts     │ ◄── AB-MCTS: Selects best candidate
                    └───────┬────────┘
                            │
                    ┌───────▼────────┐
                    │  rtx-verifier  │ ◄── Quality audit + reflection loop
                    └───────┬────────┘
                            │
                       Final Output ✅
```

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | v18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | [python.org](https://python.org) |
| Claude CLI | Latest | `npm install -g @anthropic-ai/claude-code` |
| GitHub CLI | Latest | [cli.github.com](https://cli.github.com) |

### Setup

```bash
# Clone the repository
git clone https://github.com/PsProsen-Dev/RTXCoreOrchestrate.git
cd RTXCoreOrchestrate/RTXCoreOrchestrate/RTX-Engine

# Run system health check
node scripts/health-check.js
```

---

## 💡 Usage Examples

### Fugu-Ultra Mode — AI Code Generation
```bash
node core/rtx-conductor.js --ultra "Build a FastAPI backend with JWT authentication"
```

### Marlin Mode — Strategic Research Report
```bash
node core/marlin-conductor.js "Assess geopolitical impact of Strait of Hormuz blockade"
```

### AB-MCTS Mode — Decision Tree Analysis
```bash
node core/rtx-mcts.js --depth 3 --width 2 "Best architecture for a real-time trading system"
```

### Python Mini Conductor — Lightweight Tasks
```bash
cd ../
python mini_fugu_conductor.py "Summarize and compare these two research papers"
```

---

## 🗺️ Marlin Intelligence Architecture

Marlin-style research reports follow a strict **3-layer analytical structure**:

| Layer | Label | Description |
|-------|-------|-------------|
| ✅ **Layer 1** | Verified Facts | Hard data cross-referenced with citations |
| 🔶 **Layer 2** | Working Assumptions | Unverified but plausible inputs |
| 💡 **Layer 3** | Analyst Inferences | Reasoned conclusions drawn from above |

**Monitoring Horizon Tiers:**

| Tier | Window | Focus |
|------|--------|-------|
| Tier 1 | 0–6 months | Immediate leading indicators |
| Tier 2 | 0–12 months | Medium-term developments |
| Tier 3 | 6–36 months | Long-term structural shifts |

---

## 🛡️ Security

- **Pre-flight payload scanning** on all shell commands before execution
- **Credential filtering** — no AWS/GCP/SSH keys leaked to CLI APIs
- **Input validation** on agent names and all prompt arguments
- **License auditing** on injected boilerplate dependencies
- Full security policy documented in `RTXCoreFramework.md` — Section 14

---

## 📚 References

- [Sakana AI — Fugu Technical Report](https://arxiv.org/html/2606.21228v1)
- [Sakana AI — Fugu Product Page](https://sakana.ai/fugu)
- [Sakana AI — Marlin Strategic Intelligence](https://sakana.ai/marlin)
- [Sakana AI — AB-MCTS](https://sakana.ai/ab-mcts)

---

## 📝 License

MIT License — Free to use, modify, and distribute with attribution to the original author.

---

<div align="center">

**Built with ⚡ by [Prosenjit Paul (PsProsen-Dev)](https://github.com/PsProsen-Dev)**

*"Reasoning. Thinking. Xtreme."*

</div>
