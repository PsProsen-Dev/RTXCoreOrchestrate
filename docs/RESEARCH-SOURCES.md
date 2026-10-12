# Research Sources — RTXCoreOrchestrate

Is engine ka design neeche diye gaye research par based hai. Har source ke saath bataya gaya hai ki engine ke **kis hisse** ko isne inspire kiya. Kuch sources repo ke apne `docs/fugu-research/` notes se hain, baaki Team Research ne Oct 2026 mein verify kiye the.

> Note: full team research reports is repo mein nahi hain — wo yahan hain: `~/workspace/research_notes/rtx-core-orchestrate-review/work/` (team1-codebase-recon, team2-usecase-research, team3-landscape-compare, team4-practical-verdict).

---

## 1. Primary papers (engine ka direct inspiration)

### 1.1 Fugu technical report
- **Title:** *Sakana Fugu: Multi-Agent System as a Model*
- **URL:** https://arxiv.org/abs/2606.21228
- **Kya liya:** multi-agent coordination ko single unified API endpoint ke peeche package karna; complex sub-agent network ko client se chhupana. Engine ka `RTXConductor` isi philosophy ka CLI-native attempt hai.
- **Repo note:** `Antigravity Ultimate (RTX⚡)/docs/fugu-research/fugu-tech-report-summary.md`

### 1.2 TRINITY paper (ICLR 2026)
- **Title:** *TRINITY: Evolved Model Coordination for Multi-Agent Systems*
- **URL:** https://arxiv.org/abs/2512.04695
- **Kya liya:** Thinker/Worker/Verifier role assignment — task steps ko specialized agents ko route karna. Engine ke `trinity_role` tags (`rtx-planner.js`, `rtx-verifier.js`) seedha yahin se aaye.
- **Repo note:** `Antigravity Ultimate (RTX⚡)/docs/fugu-research/trinity-paper-summary.md`

### 1.3 Conductor paper
- **Title:** *Conductor: Learning Natural-Language Coordination Strategies for Multi-Agent Systems*
- **URL:** https://arxiv.org/abs/2512.04388
- **Kya liya:** RL-trained orchestrator jo collaboration strategies khud seekhta hai (natural-language prompts se dusre models ko guide karna). Engine ka heuristic `RTXHeuristicConductor` iska simplified, non-RL version hai.
- **Repo note:** `Antigravity Ultimate (RTX⚡)/docs/fugu-research/conductor-paper-summary.md`

### 1.4 Sakana AI — Fugu official product page
- **URL:** https://sakana.ai/fugu
- **Kya liya:** architecture components (TRINITY, Conductor), Fugu vs Fugu Ultra ka difference — low-latency default vs quality-first test-time scaling mode. Engine ka `--ultra` flag isi distinction ka naam leta hai.
- **Repo note:** `Antigravity Ultimate (RTX⚡)/docs/fugu-research/fugu-official.md`

---

## 2. Launch coverage & community discussion

| Source | URL | Note |
|---|---|---|
| VentureBeat — Fugu launch report | https://venturebeat.com/orchestration/no-claude-fable-5-no-problem-sakana-achieves-frontier-performance-with-new-fugu-multi-model-auto-synthesis-system | Frontier performance claims, swappable model pool (vendor lock-in se bachav) |
| ayautomate — Fugu explainer | https://www.ayautomate.com/blog/what-is-sakana-fugu | Architecture explainer |
| Reddit r/ClaudeAI — community discussion | https://www.reddit.com/r/ClaudeAI/comments/1ud87za/sakana_ais_fugu_from_a_claude_users_view | Users ka nazariya |
| datanorth.ai | (Fugu launch, Jun 2026 — team2 dossier) | Launch coverage |
| blog.codercops.com | (Fugu Ultra v2, 11 Sep 2026 — team2 dossier) | Ultra v2 + Fugu Max pricing |
| economictimes.indiatimes.com | (Fugu explainer — team2 dossier) | Explainer |
| kensink.com | (Fugu Ultra brief — team2 dossier) | Ultra positioning (Kaggle, paper reproduction, security analysis) |
| tpsreport.news | (pricing — team2 dossier) | $5/$30 per 1M tokens pricing context |
| thetweaks.com | (7B orchestrator — team2 dossier) | Lightweight orchestrator angle |

Repo note: `Antigravity Ultimate (RTX⚡)/docs/fugu-research/blogs-community-summary.md`

---

## 3. Framework landscape (Team Research ne Oct 2026 mein verify kiya)

Ye sources engine ko **build-vs-adopt** faisle ke liye use hue the (review §4). RTX ka recommended direction: "framework banana band karo, differentiation layer banao" — LangGraph-compatible plugin pack (AB-MCTS racing + CLI adapters + Marlin methodology).

| Framework | 2026 state (sources ke mutabiq) | Key sources |
|---|---|---|
| **LangGraph** | King — 34–39M monthly downloads, v1.2.x, Klarna/Uber/LinkedIn production, MIT | https://dev.to/jamilxt/langgraph-vs-crewai-vs-openai-agents-sdk-picking-your-agent-framework-in-2026-2heo · https://atlan.com/know/ai-agent/ai-agent-memory/what-is-langgraph/ · https://autonainews.com/graph-architectures-dominate-ai-agent-teams-langgraph-leads/ |
| **CrewAI** | v1.15.23, ~59k stars; Mar 2026 mein CERT/CC ne 4 vulnerabilities publish ki (2 ka CVSS 9.8) | https://tech-insider.org/langchain-vs-llamaindex-vs-crewai-2026/ · https://aperion.ai/blog/crewai-security-governance-guide/ · https://dev.to/saaro_net/multi-agent-orchestration-2026-langgraph-crewai-and-autogen-compared-34bd |
| **AutoGen** | Maintenance mode (dead); successor Microsoft Agent Framework 1.19.x (GA Apr 2026) | https://www.analyticsinsight.net/artificial-intelligence/microsoft-autogen-explained-building-multi-agent-ai-systems?utm_source=website&utm_medium=related-stories · https://github.com/bossmetalique/agentbrake/blob/HEAD/docs/research/framework-security-map.md · http://dev.to/bitneka/single-agent-vs-multi-agent-a-decision-framework-for-enterprise-teams-b5b |
| **OpenAI Agents SDK** | v0.23.1 (0.x = API risk), 14.7M downloads | https://tech-insider.org/openai-agents-sdk-tutorial-python-13-steps-2026/ · https://nerova.ai/comparisons/openai-agents-sdk-vs-langgraph-2026 · https://aitechconnect.in/tips/langgraph-vs-crewai-vs-openai-agents-sdk-2026 |
| **n8n** | v2.0, 500+ integrations, self-hosted $0 executions. **DHYAN:** fair-code license (Sustainable Use) — OSI open-source **nahi** | https://tech-insider.org/n8n-tutorial-workflow-automation-complete-guide-2026/ · http://dev.to/codeloopsoftware/n8n-vs-make-vs-zapier-the-honest-2026-comparison-dfm · https://github.com/sudokrishna/sim/blob/HEAD/apps/sim/content/library/best-ai-agent-platforms-2026/index.mdx |
| **Google ADK** | 2.0 GA, A2A native, 4 languages; prod = GCP billing risk | https://www.analyticsinsight.net/artificial-intelligence/best-ai-agent-frameworks-in-2026-features-pros-cons-use-cases · https://vertexfrontier.com/google-agent-development-kit-adk/ · https://www.gsuitenews.com/google-cloud/agent-development-kit-adk |

**Strategic angle (review §4.3):** A2A protocol compatibility — 2026 ka standard (CrewAI, MAF, ADK sab support karte hain); RTX workers A2A bolne lagen to "A2A-compatible CLI agent mesh" positioning ban sakti hai.

---

## 4. Production cases & use-case research (Team 2, Oct 2026)

| Case | Source |
|---|---|
| Klarna — LangGraph agent, ~700 FTE equivalent | https://github.com/mfethe1/rare-agent-work |
| Toast IQ — restaurant Menu/Answering/Scheduling agents (Oct 2026) | https://pymnts.com (Toast IQ agents) |
| Kutlerri.ai — $4M raise, restaurant catering-prospecting agents | https://restauranttechnologynews.com |
| Enterprise agent use cases | https://skycrumbs.com |
| Orchestration patterns | https://wizrai.medium.com |
| Production checklist | https://navthemes.com |
| ~60% AI agent projects abandoned | https://youtube.com/watch?v=k9RdSviTONo |
| SMB AI ROI cases | https://designloud.com |
| Restaurant AI trends | https://malou.io |
| India SMB AI | https://vocal.media |
| MCTS applications (supply-chain, scheduling, routing, treatment-planning; AlphaGo = landmark) | https://data-flair.training · https://klu.ai · https://sapien.io · https://schneppat.com |
| Open-source phone-call agents (DineLine, GoodFaith) | https://github.com/calle-ai/awesome-phone-call-agents |
| AI news / framework comparisons | https://github.com/eponalab/ai-news |

---

## 5. Source hygiene note

- arXiv links (2512.04388, 2512.04695, 2606.21228) repo ke apne research notes se liye gaye hain — paper metadata (exact titles, author lists, ICLR 2026 acceptance status) independently verify nahi kiya gaya hai. Kisi publication mein cite karne se pehle arXiv par khud check karo.
- Team Research ke web sources Oct 2026 mein verify hue the; links rot ho sakte hain — tootey link mile to team dossier (`~/workspace/research_notes/rtx-core-orchestrate-review/work/`) mein alternate dhundho.
- Naya source add karte waqt isi format mein entry dalo: title/URL + "engine ke kis hisse ko inspire kiya".
