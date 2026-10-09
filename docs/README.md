# Development plan

Authority: [AGENTS.md](../AGENTS.md), v0.3. Phase 0 source inspection is **completed**;
Phase 1 is **implemented and locally verified**; Phase 2 has **tested interpretation
infrastructure with live evaluation gates open**; Phase 3 has a **locally verified
deterministic stakeholder backend**; Phase 4 delivers a **locally verified workflow and template drafts**; Phase 5 has **tested grounded Q&A with live/human gates open**; Phase 6 has **assessment tooling with optimization deferred**. A checkbox is completed
only when its supporting validation is recorded. PRD numbering starts at `0x1`
while implementation phase numbering starts at 0, matching AGENTS.md.

| PRD | Phase | Exit deliverable | Dependency |
| --- | --- | --- | --- |
| [PRD-0x1](PRD-0x1.md) | 0: Source verification (completed) | Inventory, mappings, reviewed C06 source path | Baseplate |
| [PRD-0x2](PRD-0x2.md) | 1: Deterministic evidence path (verified) | Runnable workspace, repeatable import, C06 card API | 0x1 |
| [PRD-0x3](PRD-0x3.md) | 2: Interpretation | Validated rules/provider outputs and evaluation | 0x2 |
| [PRD-0x4](PRD-0x4.md) | 3: Stakeholder guidance (backend verified) | C01 diagnosis, P01 route, C02 constraints, premise checks | 0x2; automated judgments depend on 0x3 |
| [PRD-0x5](PRD-0x5.md) | 4: Product workflow (locally verified) | Three views, evidence inspection, editable template drafts | 0x4 |
| [PRD-0x6](PRD-0x6.md) | 5: Grounded Q&A (local regression verified) | Cited bilingual answers and customized drafts | 0x3, 0x5 |
| [PRD-0x7](PRD-0x7.md) | 6: Conditional optimization (deferred) | Measured quality/cost decision | 0x6 and reviewed evaluation set |
| [PRD-0x8](PRD-0x8.md) | 7: Stakeholder/Q&A integration (review gates open) | Connected evidence, scoped ordered actions, validated planner | 0x6; 0x7 optimization remains optional |
| [PRD-0x9](PRD-0x9.md) | 8: AI validation (review/live gates open) | Extraction review lifecycle, failure matrix and capability decisions | 0x8 |

## Shared definition of done

Every phase must satisfy its own checklist and these shared requirements:

- Record implemented behavior, changed files, checks run and actual results,
  known limitations, unresolved decisions, and the next concrete task in a handover.
- Keep planned, implemented, tested and source-verified status distinct.
- Material factual claims resolve to source evidence or recorded code checks.
  Unknowns, conflicts, dates, dataset version and commercial context stay explicit.
- Run checks appropriate to the changes. Once runtime scripts exist, record
  typecheck, relevant tests and build results; documentation work uses link and
  consistency checks. Never report unrun commands or fabricated performance.
- Commit no raw customer records, secrets, generated reports or trained binaries.
  Fixtures are synthetic/redacted; provider fixtures contain no real customer data.
- Keep deterministic arithmetic, identity resolution and access scoping in code.
  Models interpret evidence; they cannot authorize commercial action.
- Customer text remains untrusted data. Retrieval is bounded to the authorized
  dataset/account; no model-generated SQL or browser-supplied filesystem paths.

## Out of scope for MVP development

Autonomous messages, CRM writes, discount approvals, contract changes, live
connectors, automatic web enrichment, multi-agent orchestration, Apriori,
purchase-probability prediction and custom expansion-outcome models are excluded.
No personality scoring, causal claims about individual contacts, or blended
unexplained priority scores. No Neo4j, Redis, vector database, separate Python
service or microservice architecture. Hosting is undecided; remote exposure of
customer data requires an authentication/access design before deployment.

Classifier training, semantic retrieval, reference introductions and response-time
analytics are conditional later work, not required MVP delivery. A complete MVP
requires both expansion discovery and stakeholder guidance, plus the workflow
and grounded Q&A; C06 alone does not complete it.

## Current handover

See [Phase 8 handover](PHASE-8-HANDOVER.md) for review tooling, independent capability validation, observed live extraction failure and defer decisions.

See [Phase 7 handover](PHASE-7-HANDOVER.md) for the latest integration, acceptance
checks, provider smoke discrepancy, flags and rollback. This supersedes earlier
global implementation-status statements; independent review remains pending.

See [Phase 3 handover](PHASE-3-HANDOVER.md): 26 tables, 45 account diagnoses,
30 internal decisions and source-verified C01/P01/C02 guidance and premise checks.
All 229,627 records remain retained. Live Jev/LLM evaluation, human-reviewed labels
and acceptance gates remain open; no model result is accepted into action cards.
See [Phase 4 handover](PHASE-4-HANDOVER.md) for workflow views, Cytoscape
evidence inspection and editable template drafts. See [Phase 5 handover](PHASE-5-HANDOVER.md) for bounded retrieval, cited Q&A
and constrained draft customization. Human claim review and live evaluation remain
open. See [Phase 6 handover](PHASE-6-HANDOVER.md) for the defer decision,
comparison tooling and label-review packet. No classifier or semantic retrieval
is enabled; next is [human/live review](EVALUATION-REVIEW.md).
