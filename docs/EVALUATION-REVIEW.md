# Evaluation review before optimization

Current decision is defer. This checklist describes missing evidence; completing
a synthetic regression run does not approve labels or choose numerical gates.

1. Review the generated `label-review.json` passages/labels. Record reviewer,
   review date, source support and corrections. Separately review the Phase 5
   account answers, attribution, numeric inputs and narrower decline diagnoses.
   Synthetic fixture IDs and real source IDs must remain distinguishable.
2. Assemble a source-grounded, versioned evaluation manifest: dataset/snapshot,
   exact source IDs/content hashes, labels, scope and human review. Include missed
   requests and negative/cancellation/contradiction cases beyond showcase accounts.
   Store raw customer material and labels locally, outside Git.
3. Identify thread and near-duplicate groups before any train/evaluation split.
   Keep groups together and document account/time holdouts. Do not train a local
   classifier unless reviewed multi-label volume supports these splits.
4. Agree numerical minimum buying-signal recall/precision and maximum unsupported
   claims/incorrect scoped authority. Record rationale, sample sizes and treatment
   of unavailable inference. Null thresholds are pending, not permission to deploy.
5. Benchmark rules and explicitly configured Jev on identical manifest cases.
   Include all cases in recall, keep unanswered cases separate, report latency,
   physical attempts, cached calls, reported tokens and known/unknown cost. Review
   extraction, support and authority independently; request-label accuracy alone
   does not establish stakeholder correctness.
6. Collect relevant retrieval misses using expected sources and account/date
   boundaries. Document whether normalization, aliases or graph queries address
   misses before proposing semantic retrieval. Show actual misses; do not infer
   them merely because embeddings are available.
7. Record an enable/defer decision with versions, evidence and rollback. Enabling
   a future method requires reviewed gates, meaningful fallback tests and a new
   configuration version; the current assessment never auto-promotes a model.

Current tools produce review packets and comparisons, not an approved-label
importer or production quality certification. Live provider/model selection,
human review and agreed numerical thresholds remain outstanding decisions.
