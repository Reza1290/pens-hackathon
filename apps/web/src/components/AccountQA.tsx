import { useEffect, useRef, useState } from 'react';
import type { Evidence, QaResponse } from '@kasirnusa/contracts';
import { api } from '../lib/api';

export function AccountQA({
  dataset,
  account,
  opportunity,
  route,
  open,
}: {
  dataset: string;
  account: string;
  opportunity?: string;
  route: string;
  open: (id: string) => void;
}) {
  const [language, setLanguage] = useState<'en' | 'id'>('en');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QaResponse>();
  const [history, setHistory] = useState<{ question: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [metric, setMetric] = useState('');
  const [periods, setPeriods] = useState({
    previous_start: '',
    previous_end: '',
    current_start: '',
    current_end: '',
  });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function ask() {
    if (Object.values(periods).some(Boolean) && !Object.values(periods).every(Boolean)) {
      setError('Provide all four comparison dates before asking.');
      return;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setError('');
    setResult(undefined);
    setDraft('');
    try {
      const data = await api.qa(
        {
          dataset_id: dataset,
          account_id: account,
          opportunity_id: opportunity,
          question,
          language,
          history,
          route: route === 'direct' ? 'direct' : route === 'intermediary' ? 'intermediary' : 'joint',
          ...(metric ? { metric: metric as 'repeat_expansion' | 'renewal' | 'revenue' | 'closed_expansion_deal_proxy' } : {}),
          ...(Object.values(periods).every(Boolean) ? { periods } : {}),
        },
        current.signal
      );
      if (current.signal.aborted) return;
      setResult(data);
      setDraft(data.draft?.body ?? '');
      setHistory((previous) => [...previous, { question }].slice(-3));
    } catch (e) {
      if (!current.signal.aborted) setError(e instanceof Error ? e.message : 'Question unavailable');
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }

  const refs = (ids: string[], evidence: Evidence[]) =>
    ids.map((id) => (
      <button
        key={id}
        onClick={() => open(id)}
        className="h-6 px-2 text-[11px] font-mono border border-brand-border rounded bg-white hover:bg-gray-50 text-brand-blue"
      >
        {evidence.find((e) => e.source_id === id)?.source_external_id ?? 'Source record'}
      </button>
    ));

  return (
    <section aria-label="Account questions" className="border border-brand-border rounded-lg bg-white p-5 space-y-4 shadow-xs">
      <div className="flex items-center justify-between border-b border-brand-border pb-3">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-base font-semibold text-brand-text">Ask about this account</h2>
        </div>
        <span className="text-[11px] text-brand-subtle">
          Grounded with historical snapshot & cited evidence
        </span>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="w-full sm:w-48 shrink-0">
            <label className="text-[11px] font-medium text-brand-subtle block mb-1">
              Answer language
              <select
                aria-label="Answer language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'id')}
                className="mt-1 w-full h-8 text-xs border border-brand-border rounded-md px-2.5 bg-white text-brand-text focus:border-brand-blue outline-none"
              >
                <option value="en">English</option>
                <option value="id">Indonesian</option>
              </select>
            </label>
          </div>

          <div className="flex-1">
            <label className="text-[11px] font-medium text-brand-subtle block mb-1">
              Account question
              <input
                aria-label="Account question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                maxLength={500}
                placeholder="What should we discuss with the CFO? / Siapa decision maker untuk akun ini?"
                className="mt-1 w-full h-8 text-xs border border-brand-border rounded-md px-3 bg-white text-brand-text placeholder-gray-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue/20 outline-none"
              />
            </label>
          </div>

          <div className="sm:self-end">
            <button
              disabled={loading || !question.trim()}
              className="h-8 px-4 bg-brand-blue hover:bg-brand-blue-hover disabled:opacity-50 text-white text-xs font-medium rounded-md transition shadow-xs flex items-center space-x-1.5"
            >
              {loading ? (
                <span>Thinking…</span>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span>Ask account question</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <details className="text-xs border border-gray-100 rounded-md p-3 bg-brand-canvas">
        <summary className="font-medium text-brand-muted hover:text-brand-text cursor-pointer select-none">
          Outcome metric and comparison periods
        </summary>
        <div className="mt-3 space-y-3">
          <label className="block text-[11px] text-brand-subtle">
            Comparison metric
            <select
              aria-label="Comparison metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="mt-1 w-full sm:w-80 h-8 text-xs border border-brand-border rounded-md px-2 bg-white text-brand-text outline-none"
            >
              <option value="">Clarify from question</option>
              <option value="repeat_expansion">Repeat expansion orders</option>
              <option value="renewal">Renewals</option>
              <option value="revenue">Revenue</option>
              <option value="closed_expansion_deal_proxy">Won expansion deals (closing-date proxy)</option>
            </select>
          </label>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {Object.entries(periods).map(([key, value]) => (
              <label key={key} className="text-[11px] text-brand-subtle block">
                {key.replaceAll('_', ' ')}
                <input
                  aria-label={key.replaceAll('_', ' ')}
                  type="date"
                  value={value}
                  onChange={(e) => setPeriods((p) => ({ ...p, [key]: e.target.value }))}
                  className="mt-1 w-full h-8 text-xs border border-brand-border rounded-md px-2 bg-white text-brand-text outline-none"
                />
              </label>
            ))}
          </div>
          {Object.values(periods).some(Boolean) && !Object.values(periods).every(Boolean) && (
            <p role="alert" className="text-xs text-red-600 font-medium">
              Provide all four comparison dates before asking.
            </p>
          )}
        </div>
      </details>

      {loading && <p role="status" className="text-xs text-brand-muted animate-pulse">Retrieving scoped evidence…</p>}
      {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-md">{error}</p>}

      {result && (
        <div aria-live="polite" className="space-y-4 pt-2 border-t border-brand-border">
          <div className="flex items-center space-x-2 text-xs">
            <span className="bg-brand-canvas border border-brand-border px-2 py-0.5 rounded text-[11px] font-mono text-brand-muted">
              {result.status.replaceAll('_', ' ')}
            </span>
            <span className="text-brand-subtle font-mono text-[11px]">· {result.commercial_context} · as of {result.as_of}</span>
          </div>

          {result.premise_check && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 space-y-1">
              <h3 className="text-xs font-semibold text-amber-900">
                Question premise: {result.premise_check.status.replaceAll('_', ' ')}
              </h3>
              <p className="text-xs text-amber-800">{result.premise_check.coverage}</p>
              <p className="text-xs text-amber-800">{result.premise_check.clarification}</p>
              {result.premise_check.calculation && (
                <pre className="text-[11px] font-mono bg-white/80 p-2 rounded border border-amber-100 text-amber-950 mt-1">
                  {JSON.stringify(
                    {
                      metric: result.premise_check.metric,
                      periods: result.premise_check.periods,
                      calculation: result.premise_check.calculation,
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </div>
          )}

          {result.plan && (
            <div className="text-[11px] font-mono text-brand-muted bg-gray-50 border border-brand-border px-2.5 py-1 rounded inline-block">
              Operation: {result.plan.operation.replaceAll('_', ' ')}
            </div>
          )}

          <div className="p-4 bg-brand-canvas/60 border border-brand-border rounded-lg space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-subtle">Documented findings</h3>
            <p className="text-xs text-brand-text leading-relaxed font-medium">{result.answer}</p>
          </div>

          {result.requirement_assessments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-brand-muted">Requirement assessments</h4>
              {result.requirement_assessments.map((a) => (
                <article key={a.id} className="border border-brand-border rounded-md p-3 bg-white text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-brand-text">Requirement: {a.status.replaceAll('_', ' ')}</h3>
                    <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{a.status}</span>
                  </div>
                  <p className="text-brand-muted">{a.requirement}</p>
                  <p className="text-brand-subtle text-[11px]">
                    Fulfillment: {a.fulfillment.status.replaceAll('_', ' ')}. {a.fulfillment.reason}
                  </p>
                  <p className="text-brand-subtle text-[11px]">
                    Missing details: {a.missing_details.join(', ') || 'Not established'}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {refs(a.source_ids.filter((id) => result.evidence.some((e) => e.source_id === id)), result.evidence)}
                  </div>
                </article>
              ))}
            </div>
          )}

          {result.claims.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-brand-muted">Grounded claims & citations</h4>
              {result.claims.map((claim) => (
                <article key={claim.id} className="border border-brand-border rounded-md p-3 bg-white text-xs space-y-1.5">
                  <span className="text-[10px] font-mono uppercase bg-blue-50 text-brand-blue border border-blue-200 px-1.5 py-0.5 rounded">
                    {claim.kind.replaceAll('_', ' ')}
                  </span>
                  <p className="text-brand-text">{claim.text}</p>
                  <div className="flex flex-wrap gap-1">
                    {refs(claim.evidence_ids, result.evidence)}
                  </div>
                  {claim.check && (
                    <details className="text-[11px] text-gray-500 pt-1">
                      <summary className="cursor-pointer hover:text-brand-text">Scope, calculation or recorded check</summary>
                      <pre className="mt-1 font-mono text-[10px] bg-gray-50 p-2 rounded border border-gray-200 overflow-x-auto">
                        {JSON.stringify(claim.check, null, 2)}
                      </pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}

          {result.draft && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-brand-text block">
                Editable answer draft
                <textarea
                  aria-label="Editable answer draft"
                  rows={8}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="mt-1 w-full text-xs font-mono border border-brand-border rounded-md p-3 bg-white text-brand-text focus:border-brand-blue outline-none"
                />
              </label>
            </div>
          )}

          {result.limitations.length > 0 && (
            <div className="text-[11px] text-brand-subtle space-y-0.5 border-t border-dashed border-brand-border pt-2">
              <span className="font-semibold text-gray-500">Method limitations:</span>
              <ul className="list-disc list-inside">
                {result.limitations.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] font-mono text-gray-400 flex items-center justify-between border-t border-brand-border pt-2">
            <span>
              Generation: {result.generation.status} · {result.generation.cached ? 'cached' : 'not cached'} ·{' '}
              {result.generation.calls} calls · {result.generation.latency_ms} ms
            </span>
            <span>Estimated cost: ${result.generation.cost_usd ?? '0.00'}</span>
          </div>
        </div>
      )}
    </section>
  );
}
