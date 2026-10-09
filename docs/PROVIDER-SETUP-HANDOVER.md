# Provider setup — TypeSafe skill and Gemini

The user requested the TypeSafe skill and Gemini as the generative provider.
Installed one method only:

```powershell
npx --yes skills add typesafe-ai/skills --skill typesafe-ai --agent codex --yes
```

The project skill is `.agents/skills/typesafe-ai/SKILL.md`, with its MIT license
and pinned provenance in `skills-lock.json`. Repository guidance references it
for subsequent TypeSafe work. The live index, HTTP API, Choice primitive, model
page and citation cookbook were read; the existing bounded Jev contract matches
the current docs. No cookbook confidence threshold was adopted as a project gate.

## Implementation

Added `geminiProvider` for scoped extraction, answer plans and draft plans. API
and CLI choose it when `LLM_PROVIDER=gemini`; OpenAI remains supported with the
explicit `openai` setting. Server-only header authentication uses `x-goog-api-key`,
not a URL query credential. Redirects are disabled, response size remains bounded,
and refusal/truncation/malformed output/model drift fail validation. Returned
model version must match the configured model. Thinking tokens join visible output
tokens in usage accounting. Cost remains unknown unless reviewed rates are supplied.

The REST schema uses `responseFormat.text.mimeType=APPLICATION_JSON`. The guide's
string MIME example initially caused HTTP 400; the current REST enum and live
diagnostic established the accepted format. References:
[Google REST schema](https://ai.google.dev/api/generate-content#TextResponseFormat),
[TypeSafe HTTP API](https://docs.typesafe.ai/api),
[TypeSafe model versions](https://docs.typesafe.ai/models).

`npm run providers:check -- --dataset <uuid> --live` performs at most one physical
attempt per provider using synthetic text only. It logs configuration/status,
HTTP status, usage and run IDs, never secrets/customer passages. Results are
persisted through the existing model ledger/cache. The retry loop preserves the
original provider failure when the physical-call budget prevents another attempt.

## Local verification and limits

User credentials were stored only in ignored `.env`. Local choices:
`jev-1.13.0`, `LLM_PROVIDER=gemini`, `gemini-3.8-flash`, two-call runtime limit,
30-second timeout and `QA_LIVE_ENABLED=false`. No keys are in this document.

- Jev: one successful live synthetic Choice request, HTTP 200, 827 input and 96
  output tokens, estimated USD 0.0000347340. Repeated smoke checks reuse that
  validated result with zero new calls. This is connectivity/contract verification,
  not dataset-wide model quality or independent label review.
- Gemini: model listing accepted the credential (HTTP 200), and the configured
  model appears in the available list. After correcting the request enum,
  generation returned **HTTP 402 Payment Required**. No Gemini generation succeeded.
  Two CLI generation attempts and one minimal diagnostic generation request were
  made; failed-request usage/cost is unknown, not assumed free.
- Google documents HTTP 402 as a prepay/billing condition. The provider account's
  billing/credit state must be resolved before retesting; this session did not
  change billing or make a purchase. See [Google billing](https://ai.google.dev/gemini-api/docs/billing).
- Typecheck, all 34 Vitest tests, six browser journeys and production build passed. Gemini transport
  tests use synthetic responses; they do not prove live generation quality.
- Existing UI templates stay available, with live generation disabled. Jev/LLM
  judgments are not automatically promoted into action-card authority or findings.

Next: resolve Gemini's payment/access condition, repeat the bounded provider check,
then set an explicit evaluation budget and review the dataset labels before larger
live benchmarking. Full fluent prose and human/live quality gates remain open.
