# Local extraction review

Use this workflow for model-generated stakeholder candidates. It records a
reviewer's decision; it does not supply independent review on the reviewer's behalf.
The local CLI trusts the supplied reviewer identity. Production authentication is
outside this phase.

1. Find the extraction run ID in the diagnosis/Q&A capability metadata.
2. Inspect the candidate and original source locally:

```powershell
npx tsx apps/api/src/cli/review-extraction.ts --run <model-run-uuid> --index 0
```

The command displays customer text intentionally for local review. Do not send its
output to a provider or commit it. Compare the claim with the original record,
holder/speaker, attribution, event date, decision scope, competing statements and
model/source versions. A matching text span alone is not semantic support.

3. Save a decision JSON in an ignored local directory such as `artifacts/reviews`:

```json
{
  "model_run_id": "<model-run-uuid>",
  "candidate_index": 0,
  "state": "accepted",
  "reviewer": "<your reviewer identity>",
  "rationale": "<why this interpretation and decision scope are supported>",
  "supersedes": null
}
```

States are `pending_review`, `accepted`, `rejected`. To revise a prior decision,
set `supersedes` to the current review ID. A prior review is effectively superseded
when a successor exists; its stored record remains unchanged. A `correction` may
contain a complete corrected extraction assertion using the existing extraction
schema. It retains the original source and must pass all source-span, identity,
attribution, date and scope checks again. Correcting a claim creates a new review
record; there is no overwrite operation.

4. Apply the decision and recompute affected read models:

```powershell
npx tsx apps/api/src/cli/review-extraction.ts --review-file artifacts/reviews/decision.json
```

The command validates current source hashes, dated customer employment and resolved
decision scope. Internal employees cannot become customer approvers. An unresolved
contradiction blocks acceptance. Legacy runs lacking captured context/source hashes
must be re-extracted. Expansion-quantity promotion requires separate deterministic
commercial validation and is deliberately not accepted by this stakeholder tool.

Reviews are append-only and idempotent for identical inputs/source revisions.
Changing a decision requires the current revision ID. Acceptance/rejection removes
the current account read models atomically, then the CLI rebuilds account and
previously prepared decision scopes. If rebuilding fails, the unavailable read
model is explicit rather than displaying a stale accepted claim. Historical
recommendations and reviews remain intact. Q&A also prepares its selected scope.

Source changes, employment changes, contradictions or changed scope invalidate
accepted claims on read/recomputation. A stale diagnosis returns a rebuild-required
response. Accepted reviews survive disabling candidate generation: a human-reviewed
claim is separate from a capability flag. Revoke it with a rejected successor if
appropriate. Pending/rejected candidates never become authoritative statements.

Before enabling capabilities broadly, independently review
`tests/fixtures/phase8-review.json` and record disagreements. Its 28 proposed labels
are unapproved. The report command checks source hashes, splits and review status:

```powershell
npx tsx apps/api/src/cli/phase8-review-report.ts
```

No quality result is produced while independent labels and gates are pending.
