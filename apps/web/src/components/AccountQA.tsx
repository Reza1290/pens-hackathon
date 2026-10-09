import { useEffect, useRef, useState } from 'react';
import type { Evidence, QaResponse } from '@kasirnusa/contracts';
import { api } from '../lib/api';

const PROMPT_SUGGESTIONS = [
  'Apa yang belum ditindaklanjuti untuk akun ini?',
  'Siapa yang perlu dilibatkan dan apa buktinya?',
  'Kalau tambah 10 outlet, berapa nilai tahunannya?',
  'Buatkan draft follow-up',
  'Why are repeat orders lower?',
];

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
  const [language, setLanguage] = useState<'en' | 'id'>('id');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QaResponse>();
  const [history, setHistory] = useState<{ question: string }[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [copiedDraft, setCopiedDraft] = useState(false);
  const [metric, setMetric] = useState('');
  const [periods, setPeriods] = useState({
    previous_start: '',
    previous_end: '',
    current_start: '',
    current_end: '',
  });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function ask(customQuestion?: string) {
    const q = customQuestion ?? question;
    if (!q.trim()) return;

    if (Object.values(periods).some(Boolean) && !Object.values(periods).every(Boolean)) {
      setError('Lengkapi keempat tanggal komparasi periode sebelum mengirim pertanyaan.');
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
          question: q,
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
      setHistory((previous) => [...previous, { question: q }].slice(-3));
    } catch (e) {
      if (!current.signal.aborted) setError(e instanceof Error ? e.message : 'Pertanyaan tidak dapat diproses');
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }

  const handleCopyDraft = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  };

  const refs = (ids: string[], evidence: Evidence[]) =>
    ids.map((id) => (
      <button
        key={id}
        onClick={() => open(id)}
        className="h-6 px-2 text-[11px] font-mono border border-brand-border rounded bg-white hover:bg-gray-50 text-gray-700 transition"
      >
        {evidence.find((e) => e.source_id === id)?.source_external_id ?? 'Record'}
      </button>
    ));

  return (
    <section aria-label="Account questions" className="border border-brand-border rounded-lg bg-white p-5 space-y-4 shadow-2xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-border pb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Tanya Akun (Grounded Q&A)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Jawaban diverifikasi terhadap context graph, riwayat komunikasi, dan batasan komersial tanpa halusinasi.
          </p>
        </div>
        <span className="text-[11px] font-mono text-gray-400 hidden sm:inline">
          Grounded with historical snapshot
        </span>
      </div>

      {/* Prompt Suggestions */}
      <div className="space-y-1.5">
        <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider block">
          Pertanyaan Cepat (Saran):
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PROMPT_SUGGESTIONS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setQuestion(item);
                void ask(item);
              }}
              className="px-2.5 py-1 text-xs border border-brand-border rounded bg-gray-50 hover:bg-gray-100 text-gray-700 transition text-left"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* Main Input Form */}
      <form onSubmit={(e) => { e.preventDefault(); void ask(); }} className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="w-full sm:w-44 shrink-0">
            <label className="text-[11px] font-medium text-gray-500 block mb-1 font-mono uppercase">
              Bahasa Jawaban
              <select
                aria-label="Answer language"
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'en' | 'id')}
                className="mt-1 w-full h-8 text-xs border border-brand-border rounded-md px-2.5 bg-white text-gray-900 outline-none"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>

          <div className="flex-1">
            <label className="text-[11px] font-medium text-gray-500 block mb-1 font-mono uppercase">
              Pertanyaan Akun
              <input
                aria-label="Account question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                required
                maxLength={500}
                placeholder="Ajukan pertanyaan terkait peluang, stakeholder, atau kalkulasi..."
                className="mt-1 w-full h-8 text-xs border border-brand-border rounded-md px-3 bg-white text-gray-900 placeholder-gray-400 outline-none"
              />
            </label>
          </div>

          <div className="sm:self-end">
            <button
              disabled={loading || !question.trim()}
              aria-label="Ask account question"
              className="h-8 px-4 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 text-white text-xs font-medium rounded-md transition shadow-2xs flex items-center justify-center space-x-1.5 shrink-0"
            >
              {loading ? (
                <span>Menganalisis...</span>
              ) : (
                <span>Ask account question</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Collapsible Parameter Komparasi Periode (FR-13 Outcome Questions) */}
      <details className="text-xs border border-brand-border rounded-md p-3 bg-gray-50/50">
        <summary className="font-medium text-gray-700 hover:text-gray-900 cursor-pointer select-none flex items-center justify-between">
          <span>Parameter Komparasi Periode (Opsional · Validasi FR-13)</span>
          <span className="text-[11px] font-mono text-gray-400">
            {Object.values(periods).some(Boolean) ? 'Kustom Tanggal Aktif' : 'Default: Klarifikasi Otomatis'}
          </span>
        </summary>
        <div className="mt-3 space-y-3 pt-2 border-t border-brand-border">
          <p className="text-[11px] text-gray-500">
            Digunakan saat memvalidasi klaim penurunan repeat order atau pendapatan antar dua rentang waktu. Jika dikosongkan, sistem menganalisis langsung dari pertanyaan.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-[11px] text-gray-600 font-mono uppercase">
                Metrik Komparasi
                <select
                  aria-label="Comparison metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="mt-1 w-full h-8 text-xs border border-brand-border rounded-md px-2.5 bg-white text-gray-900 outline-none"
                >
                  <option value="">Klarifikasi otomatis dari pertanyaan</option>
                  <option value="repeat_expansion">Repeat expansion orders</option>
                  <option value="renewal">Renewals (Perpanjangan)</option>
                  <option value="revenue">Revenue (Pendapatan)</option>
                  <option value="closed_expansion_deal_proxy">Won expansion deals (closing-date proxy)</option>
                </select>
              </label>
            </div>

            {Object.values(periods).some(Boolean) && (
              <button
                type="button"
                onClick={() => {
                  setPeriods({ previous_start: '', previous_end: '', current_start: '', current_end: '' });
                  setMetric('');
                }}
                className="h-8 px-3 text-xs text-gray-600 hover:text-gray-900 border border-brand-border rounded bg-white transition"
              >
                Reset Tanggal
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-white border border-brand-border rounded space-y-2">
              <span className="text-[10px] font-mono text-gray-400 uppercase font-semibold block">Periode Acuan (Baseline)</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-gray-500 block">
                  Mulai (previous start)
                  <input
                    aria-label="previous start"
                    type="date"
                    value={periods.previous_start}
                    onChange={(e) => setPeriods((p) => ({ ...p, previous_start: e.target.value }))}
                    className="mt-1 w-full h-7 text-xs border border-brand-border rounded px-1.5 bg-white text-gray-900 outline-none"
                  />
                </label>
                <label className="text-[10px] text-gray-500 block">
                  Selesai (previous end)
                  <input
                    aria-label="previous end"
                    type="date"
                    value={periods.previous_end}
                    onChange={(e) => setPeriods((p) => ({ ...p, previous_end: e.target.value }))}
                    className="mt-1 w-full h-7 text-xs border border-brand-border rounded px-1.5 bg-white text-gray-900 outline-none"
                  />
                </label>
              </div>
            </div>

            <div className="p-3 bg-white border border-brand-border rounded space-y-2">
              <span className="text-[10px] font-mono text-gray-400 uppercase font-semibold block">Periode Pembanding (Current)</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[10px] text-gray-500 block">
                  Mulai (current start)
                  <input
                    aria-label="current start"
                    type="date"
                    value={periods.current_start}
                    onChange={(e) => setPeriods((p) => ({ ...p, current_start: e.target.value }))}
                    className="mt-1 w-full h-7 text-xs border border-brand-border rounded px-1.5 bg-white text-gray-900 outline-none"
                  />
                </label>
                <label className="text-[10px] text-gray-500 block">
                  Selesai (current end)
                  <input
                    aria-label="current end"
                    type="date"
                    value={periods.current_end}
                    onChange={(e) => setPeriods((p) => ({ ...p, current_end: e.target.value }))}
                    className="mt-1 w-full h-7 text-xs border border-brand-border rounded px-1.5 bg-white text-gray-900 outline-none"
                  />
                </label>
              </div>
            </div>
          </div>
          {Object.values(periods).some(Boolean) && !Object.values(periods).every(Boolean) && (
            <p role="alert" className="text-xs text-red-600 font-medium">
              Lengkapi keempat tanggal komparasi periode sebelum mengirim pertanyaan.
            </p>
          )}
        </div>
      </details>

      {/* Loading & Error States */}
      {loading && <p role="status" className="text-xs text-gray-500 animate-pulse font-mono">Menganalisis context graph & bukti dokumen terkait…</p>}
      {error && <p role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 p-2.5 rounded-md">{error}</p>}

      {/* Answer Dossier */}
      {result && (
        <div aria-live="polite" className="space-y-4 pt-3 border-t border-brand-border">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="bg-gray-100 border border-brand-border px-2 py-0.5 rounded text-[11px] font-mono text-gray-800">
              Status: {result.status.replaceAll('_', ' ').toUpperCase()}
            </span>
            <span className="text-gray-400 font-mono text-[11px]">
              Konteks: {result.commercial_context} · Snapshot: {result.as_of}
            </span>
            {result.plan && (
              <span className="text-[11px] font-mono text-gray-600 bg-gray-50 border border-brand-border px-2 py-0.5 rounded ml-auto">
                Operasi: {result.plan.operation.replaceAll('_', ' ')}
              </span>
            )}
          </div>

          {/* Premise Check Card */}
          {result.premise_check && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-md p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-amber-900">
                  Question premise: {result.premise_check.status.replaceAll('_', ' ')}
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white text-amber-900 border border-amber-200">
                  {result.premise_check.status}
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">{result.premise_check.coverage}</p>
              {result.premise_check.clarification && (
                <p className="text-xs text-amber-800 italic">{result.premise_check.clarification}</p>
              )}
              {result.premise_check.calculation && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-amber-200/60 text-xs text-center font-mono">
                  <div className="p-2 bg-white rounded border border-amber-200">
                    <span className="text-[10px] text-gray-400 block uppercase">Baseline</span>
                    <span className="font-semibold text-gray-900">{result.premise_check.calculation.previous}</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-amber-200">
                    <span className="text-[10px] text-gray-400 block uppercase">Berjalan</span>
                    <span className="font-semibold text-gray-900">{result.premise_check.calculation.current}</span>
                  </div>
                  <div className="p-2 bg-white rounded border border-amber-200">
                    <span className="text-[10px] text-gray-400 block uppercase">Perubahan</span>
                    <span className="font-semibold text-gray-900">{result.premise_check.calculation.change}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Documented Findings */}
          <div className="p-4 bg-gray-50/70 border border-brand-border rounded-lg space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-mono">
              Temuan terdokumentasi (Documented findings)
            </h3>
            <p className="text-xs text-gray-900 leading-relaxed font-medium">{result.answer}</p>
          </div>

          {/* Requirement Assessments */}
          {result.requirement_assessments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700">Evaluasi Kebutuhan Stakeholder</h4>
              {result.requirement_assessments.map((a) => (
                <article key={a.id} className="border border-brand-border rounded-md p-3 bg-white text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Requirement: {a.status.replaceAll('_', ' ')}</h3>
                    <span className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{a.status}</span>
                  </div>
                  <p className="text-gray-700">{a.requirement}</p>
                  <p className="text-gray-500 text-[11px]">
                    Fulfillment: {a.fulfillment.status.replaceAll('_', ' ')}. {a.fulfillment.reason}
                  </p>
                  <p className="text-gray-500 text-[11px]">
                    Missing details: {a.missing_details.join(', ') || 'Not established'}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {refs(a.source_ids.filter((id) => result.evidence.some((e) => e.source_id === id)), result.evidence)}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Grounded claims & citations */}
          {result.claims.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-700">Klaim Terverifikasi & Bukti Sitasi</h4>
              {result.claims.map((claim) => (
                <article key={claim.id} className="border border-brand-border rounded-md p-3 bg-white text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase bg-gray-100 text-gray-800 border border-brand-border px-1.5 py-0.5 rounded">
                      {claim.kind.replaceAll('_', ' ')}
                    </span>
                  </div>
                  <p className="text-gray-800">{claim.text}</p>
                  <div className="flex flex-wrap gap-1">
                    {refs(claim.evidence_ids, result.evidence)}
                  </div>
                  {claim.check && (
                    <details className="text-[11px] text-gray-500 pt-1">
                      <summary className="cursor-pointer hover:text-gray-900 font-mono text-[10px]">Detail parameter kalkulasi / verifikasi</summary>
                      <div className="mt-1 p-2 bg-gray-50 rounded border border-gray-200 text-[11px] font-mono grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {Object.entries(claim.check).map(([k, v]) => (
                          <div key={k} className="flex justify-between border-b border-gray-100 py-0.5">
                            <span className="text-gray-500 mr-2">{k}:</span>
                            <span className="font-semibold text-gray-800 text-right">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}

          {/* Editable Answer Draft */}
          {result.draft && (
            <div className="space-y-2 border border-brand-border rounded-md p-3.5 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-900">Draf Pesan Terstruktur</span>
                <button
                  type="button"
                  onClick={handleCopyDraft}
                  className="h-6 px-2.5 text-xs font-medium rounded border border-brand-border bg-white hover:bg-gray-100 text-gray-700 transition"
                >
                  {copiedDraft ? 'Tersalin' : 'Salin Draf'}
                </button>
              </div>
              <textarea
                aria-label="Editable answer draft"
                rows={8}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full text-xs font-mono border border-brand-border rounded-md p-3 bg-white text-gray-900 outline-none leading-relaxed"
              />
            </div>
          )}

          {/* Method limitations */}
          {result.limitations.length > 0 && (
            <div className="text-[11px] text-gray-500 space-y-0.5 border-t border-brand-border pt-2 font-mono">
              <span className="font-semibold text-gray-600">Batasan Metodologi Data:</span>
              <ul className="list-disc list-inside">
                {result.limitations.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Execution Cost & Telemetry */}
          <div className="text-[10px] font-mono text-gray-400 flex items-center justify-between border-t border-brand-border pt-2">
            <span>
              Generasi: {result.generation.status} · {result.generation.cached ? 'cached' : 'live'} ·{' '}
              {result.generation.calls} calls · {result.generation.latency_ms} ms
            </span>
            <span>Biaya: ${result.generation.cost_usd ?? '0.00'}</span>
          </div>
        </div>
      )}
    </section>
  );
}
