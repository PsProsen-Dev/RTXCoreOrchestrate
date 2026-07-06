# Sakana Fugu & Fugu Ultra Overview

This document provides a technical summary of the logic, concept, architecture, and technology underlying Sakana AI's Fugu and Fugu Ultra multi-agent orchestration platforms.

---

## 1. Logic & Concept

### Multi-Agent System as a Model
Unlike standard monolithic LLMs, Fugu is designed as a **Multi-Agent System as a Model**. Externally, it presents a single, standardized, OpenAI-compatible API endpoint. Internally, it acts as an intelligent router and coordinator that delegates tasks to a swappable pool of third-party frontier models (such as Claude, Gemini, and GPT-4).

### Key Philosophies
1. **Model Decoupling & Swappability**: Reduces vendor lock-in. If a new, more powerful model is released by any provider, it can be seamlessly integrated into the agent pool without modifying the client-side API calls.
2. **Collective Intelligence**: Combines the specific strengths of different models (e.g., Claude's reasoning, Gemini's token throughput, GPT's direct coding execution).
3. **Adaptive Test-Time Scaling**: Scales compute dynamically based on task complexity. Rather than using the same massive model for a simple query, Fugu routes simple tasks directly, while calling cascades of agents for complex, high-stakes tasks.

---

## 2. Architecture & Orchestration

Fugu's internal architecture is composed of two primary learned coordinators:

```
                  ┌──────────────────────┐
                  │   User Request API   │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ TRINITY Coordinator  │
                  └──────────┬───────────┘
                             │ (Role & Model Selection)
                             ▼
                  ┌──────────────────────┐
                  │ Conductor Controller │
                  └────┬───────┬───────┬─┘
                       │       │       │
                       ▼       ▼       ▼
                    [Agent] [Agent] [Agent]
```

### TRINITY (Evolved Coordinator)
- **Role**: Handles task delegation and role assignment.
- **Mechanism**: Projects incoming tasks into specialized roles such as `<role_thinker>`, `<role_worker>`, and `<role_verifier>` and determines which model should run each role.

### Conductor (RL-Trained Orchestrator)
- **Role**: Manages communication topologies and outputs synthesis.
- **Mechanism**: Discovers optimal, natural-language-based coordination strategies using reinforcement learning. It acts as the "project manager," coordinating data passing, self-reflection loops, and final result compilation.

---

## 3. Fugu vs. Fugu Ultra

- **Fugu (Standard)**:
  - Focuses on balanced performance and low latency.
  - Dynamically routes to the most efficient models.
  - Ideal for general coding, translation, and structured API queries.

- **Fugu Ultra (Deep)**:
  - Focuses on quality maximization for high-stakes tasks (e.g., competitive programming, security audits, patent research).
  - Utilizes a fixed pool of deep reasoning expert models.
  - Employs parallel candidate generation, Monte Carlo Tree Search (MCTS) branching, and recursive verifier reflection loops.
