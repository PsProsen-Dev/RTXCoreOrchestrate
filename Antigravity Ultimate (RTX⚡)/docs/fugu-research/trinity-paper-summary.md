# TRINITY Paper Summary: Evolved Model Coordination

* **Paper URL**: [https://arxiv.org/abs/2512.04695](https://arxiv.org/abs/2512.04695)
* **Title**: *TRINITY: Evolved Model Coordination for Multi-Agent Systems*

---

## 1. Core Methodology
TRINITY is an evolutionary model coordination framework designed to automatically route task steps to specialized agents. Instead of using hardcoded rules or heuristic routing tables, TRINITY uses a trained coordinator LLM to project goals into distinct agent roles.

---

## 2. TRINITY Role Definitions
TRINITY defines three main role archetypes for multi-agent cascades:
1. **`<role_thinker>`**: Focuses on task decomposition, strategy planning, and high-level logic.
2. **`<role_worker>`**: Executes the planner's steps, generates code, or runs terminal tasks.
3. **`<role_verifier>`**: Audits outputs, compiles tests, checks constraints, and manages rollback branches.

---

## 3. Benchmarks & Results
The paper demonstrates that using evolved role delegation via TRINITY consistently outperforms monolithic model generation across competitive programming datasets and complex logical reasoning tasks.
