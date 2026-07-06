# Sakana Fugu & Fugu Ultra Research Papers

This document lists the core research papers and technical reports published by Sakana AI and the research community relating to multi-agent coordination, evolved routing, and reinforcement learning orchestrators.

---

## 1. Fugu Technical Report (2026)
* **Title**: *Sakana Fugu: Multi-Agent System as a Model*
* **Link**: [arXiv:2606.21228](https://arxiv.org/abs/2606.21228)
* **Summary**:
  - Outlines the core product strategy for Sakana Fugu, introducing the "Multi-Agent System as a Model" paradigm.
  - Documents how the platform translates a single OpenAI-compatible API call into complex multi-model pipelines.
  - Demonstrates benchmark improvements across LiveCodeBench, GPQA-Diamond, and SWE-bench, proving Fugu Ultra outperforms individual frontier models.

---

## 2. TRINITY Paper (2025)
* **Title**: *TRINITY: Evolved Model Coordination for Multi-Agent Systems*
* **Link**: [arXiv:2512.04695](https://arxiv.org/abs/2512.04695)
* **Summary**:
  - Introduces the evolutionary coordinator system designed to delegate tasks to specific roles (Thinker, Worker, Verifier) based on natural language task descriptions.
  - Explains the algorithm behind dynamic, context-aware role-mapping, which serves as the direct foundation for Fugu's internal router.

---

## 3. Conductor Paper (2025)
* **Title**: *Conductor: Learning Natural-Language Coordination Strategies for Multi-Agent Systems*
* **Link**: [arXiv:2512.04388](https://arxiv.org/abs/2512.04388)
* **Summary**:
  - Details how reinforcement learning is used to train an orchestrator model to generate optimal natural-language coordination templates.
  - Outlines the agent-to-agent communication strategies that minimize token bloat while maximizing the accuracy of synthesized multi-model outputs.
