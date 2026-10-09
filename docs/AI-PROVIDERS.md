# Interpretation providers

Verified against official documentation on 9 October 2026. No live provider
requests or provider quality measurements have been made in this implementation.
HTTP transport tests use explicitly synthetic responses.

## Jev

The adapter sends bounded Choice questions to TypeSafe's
`POST https://api.typesafe.ai/v1/systemone`, using Bearer authentication and
`state`, `model`, and a named `questions` map. It validates the returned question
type, choice set, probabilities, confidence, resolved model and usage.
See the [official API reference](https://docs.typesafe.ai/api).

The configured default is the pinned `jev-1.13.0`, rather than a moving alias.
The official model page lists $0.042 per million **input** tokens, free output,
64k total context, and 32k state plus the longest question. Our smaller application
limits are 4 passages, 12 scoped candidates, and 32,000 serialized characters.
Input characters are a size guard, not a tokenizer or billing measurement.
Prices/rate limits can change; the fixed price applies only to this model/version
and is recorded as an estimate from reported usage. Other versions have unknown
cost until rates are verified. TypeSafe says English has the strongest coverage;
Indonesian quality must be measured on reviewed examples.
See [official models, pricing and language support](https://docs.typesafe.ai/models).

## Generative extraction

One adapter uses the OpenAI Responses API with `text.format` set to a strict
JSON schema, `store: false`, no tools, and a 2,048 output-token cap. The adapter
rejects refusals, incomplete responses, unexpected models and invalid evidence.
See [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

`LLM_MODEL` is deliberately unset: configure a versioned model supporting this
schema after choosing/evaluating it. `LLM_API_KEY` stays in the ignored server
environment. Optional input/output rates are explicitly configured, rather than
invented. Missing rates produce an unknown cost; they do not mean free inference.
An exact source quote does not by itself prove the extracted claim is supported.
Every model result still requires semantic review.

## Controls and use

Interpretation adapters are CLI opt-in. Normal imports and analysis make zero
model calls. Interpretation `--live` opts into calls; Q&A uses the separate server
`QA_LIVE_ENABLED` switch (false by default). Missing configuration returns `unavailable`.
`MODEL_MAX_CALLS` caps physical attempts per CLI process, including retries
(default 20). `MODEL_TIMEOUT_MS` defaults to 15 seconds; concurrency is two per
runtime, with at most one retry for retryable HTTP failures. These are call/size
budgets, not a guaranteed monetary ceiling; provider-side spend limits remain a
separate configuration. Timeouts may still incur provider charges, so missing
usage/cost remains unknown. Logs print status and record references, not passages.

```powershell
# Offline first: unavailable status is persisted, no inference is fabricated.
npm run data:interpret -- --dataset <uuid> --account C06 --sources I0300 --subject K116 --operation intent
# After server credentials/model selection, explicitly opt in:
npm run data:interpret -- --dataset <uuid> --account C06 --sources I0300 --subject K116 --operation extract_details --live
npm run eval -- --dataset <uuid>
```

Operations: `intent`, `role`, `relevance`, `concern_addressed`, `extract_details`.
For relevance pass `--claim`; for concerns pass ordered `--sources
<concern-id>,<followup-id>`. Retrieval verifies ready dataset, account, snapshot
date, exact source IDs, event-date employment and constrained candidate identity.
Historical employment is preserved; this command does not recommend departed
contacts as current approvers. No provider can execute SQL or send messages.

Successful validated outputs are cached in `model_runs` by dataset/account,
content, operation, provider/model, prompt/schema and parameter versions.
Cross-process advisory locks serialize the same key. Every cache read is
revalidated. Failures are tracked separately and never reused as success.
Changed content/version yields a different key. Model results are excluded from
findings, so current findings have no model dependency to invalidate yet.

The evaluation command uses 25 synthetic cases with human review pending. A live
Jev run uses the same set; raise `MODEL_MAX_CALLS` above 25 to allow retries. It
records model judgments alongside rules and separates unanswered cases from
measured answers. It neither installs filtering nor promotes model judgments.
The live comparison, human-reviewed dataset labels, agreed thresholds, complex
extraction benchmark and automatic fallback/promotion remain unfinished.

## Grounded Q&A plans

Phase 5 adds server operations `answer_plan` and `draft_plan` through the OpenAI
adapter. They select supplied fact IDs, not new claims or unrestricted prose.
Enable only with an explicit exact model and `QA_LIVE_ENABLED=true`; no live
quality result is claimed. The same call budget applies per API runtime. Cached
plans are revalidated, costs/usage are tracked, and deterministic answers/template
drafts remain available on failure. See [Phase 5 handover](PHASE-5-HANDOVER.md).
