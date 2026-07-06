# Fugu Technical Report Summary

* **Report URL**: [https://arxiv.org/abs/2606.21228](https://arxiv.org/abs/2606.21228)
* **Title**: *Sakana Fugu: Multi-Agent System as a Model*

---

## 1. Design Philosophy
The Fugu technical report details Sakana AI's product design for packaging a complex, multi-agent coordination system behind a single unified API endpoint. It allows standard client applications to leverage collective model intelligence without managing the sub-agent network.

---

## 2. Core Benchmarks
The report provides extensive benchmarks evaluating Fugu Ultra against individual models (such as GPT-4o and Claude 3.5 Sonnet):
- **LiveCodeBench**: Demonstrates high performance on competitive coding tasks.
- **GPQA-Diamond**: Measures logic accuracy on graduate-level scientific and mathematical reasoning tasks.
- **SWE-bench Pro**: Evaluates execution on real-world, multi-file software engineering issues.

---

## 3. Results
In all evaluated benchmarks, Fugu Ultra outperformed monolithic models by utilizing parallel model generations, tree searches, and verifier-feedback loops.
