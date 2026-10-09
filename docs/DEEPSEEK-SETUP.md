# DeepSeek provider switch

The user selected DeepSeek after Gemini's generation endpoint returned HTTP 402.
Local ignored `.env` now selects `LLM_PROVIDER=deepseek`, `LLM_MODEL=deepseek-flash`
and the supplied credential. Jev remains the bounded-judgment provider. Gemini
and OpenAI adapters remain available through explicit configuration.

The DeepSeek adapter uses the official Chat Completions endpoint with server-side
Bearer authentication, non-streaming JSON mode, disabled thinking and a 2,048-token
output cap. JSON/schema instructions are explicit. JSON mode is not strict schema
enforcement: Zod validates returned extraction/fact-plan shape, then Interpreter
validates evidence/fact scope before accepting or caching a result. Malformed JSON,
truncation, model mismatch and added claims fail closed. Existing bounded transport,
timeouts, cache, usage and call budgets apply. No new dependency/database/migration.

The current official API exposes `deepseek-flash` as a model name; it is not an
immutable dated model version. The response model is checked, but vendor upgrades
behind that name require explicit evaluation/cache-version invalidation. Do not
interpret this as a permanently pinned underlying model. References:
[DeepSeek Chat API](https://api-docs.deepseek.com/api/create-chat-completion/),
[model names and versions](https://api-docs.deepseek.com/quick_start/pricing/).
No generic flat price was configured: cache/peak-dependent billing needs reviewed
rate handling. Unknown cost stays null rather than being treated as free.

## Actual validation

`npm run providers:check -- --dataset 93bb692a-2168-5ef3-a37d-8e929f9b6340 --live`:

- Jev: existing successful synthetic check reused from cache, zero new calls.
- DeepSeek: one synthetic `answer_plan` call succeeded, HTTP 200, 447 input and
  13 output tokens. Estimated cost unknown. Ledger run
  `f471a7b3-d253-400f-925f-a6b292f5c94b`.
- No customer text was sent in this connection test, and no key was printed.
- Typecheck, all 36 Vitest tests, six browser journeys and API/frontend build passed.
  New tests cover request/authentication shape, strict output validation, malformed
  output, truncation and model mismatch; scope checks remain in shared Interpreter.

`QA_LIVE_ENABLED=false`, the two-call local runtime cap and the existing templates
remain in place. The provider is connected; dataset-wide live quality, reviewed
labels, agreed thresholds and fluent generated prose remain open gates. This
successful connection test does not approve model judgments as verified facts.

Next: agree an evaluation budget and review scope, run the live dataset benchmark,
then explicitly enable live UI generation once its quality is acceptable.
