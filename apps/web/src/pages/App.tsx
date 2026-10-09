import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AccountDiagnosis, AiCandidateOpportunity, Evidence, OpportunityCard, User } from '@kasirnusa/contracts';
import { api } from '../lib/api';
import { AccountQA } from '../components/AccountQA';

const Graph = lazy(() => import('../components/Graph').then((module) => ({ default: module.Graph })));

const words = (s: string) => s.replaceAll('_', ' ');
const amount = (s: string) => {
  const [whole, fraction = '00'] = s.split('.');
  return new Intl.NumberFormat('id-ID').format(BigInt(whole)) + ',' + fraction;
};
type Resource = OpportunityCard | AccountDiagnosis;

function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>({ key: '' });
  useEffect(() => {
    const controller = new AbortController();
    setState({ key });
    load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setState({ key, error: e.message });
      });
    return () => controller.abort();
  }, [key]);
  return state.key === key ? state : { key };
}

function Pending({ error }: { error?: string }) {
  return error ? (
    <div role="alert" className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
      <span className="font-semibold">Error:</span> {error}
    </div>
  ) : (
    <div role="status" className="p-8 text-center text-xs text-brand-subtle animate-pulse">
      Loading supplied evidence…
    </div>
  );
}

const scoped = (path: string, dataset: string) => path + '?' + new URLSearchParams({ dataset_id: dataset });

export function App() {
  const navigate = useNavigate();
  const [query] = useSearchParams();
  const location = useLocation();

  const result = useLoad('datasets', (signal) => api.datasets(signal));
  const datasets = result.data?.items ?? [];
  const selected = query.get('dataset_id') ?? datasets[0]?.id ?? '';
  const dataset = datasets.find((d) => d.id === selected);

  const accounts = useLoad('accounts:' + selected, (signal) =>
    selected ? api.accounts(selected, signal) : Promise.resolve({ items: [] })
  );

  // Active view state
  const isOpportunitiesRoot = location.pathname === '/' || location.pathname === '/opportunities';
  const currentAccountId = location.pathname.startsWith('/accounts/')
    ? location.pathname.split('/')[2]
    : '';

  // Auth User state (default: Wahyu Setiawan E04)
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'e0400000-0000-4000-8000-000000000001',
    email: 'wahyu@kasirnusa.id',
    name: 'Wahyu Setiawan',
    employee_external_id: 'E04',
    role: 'account_manager',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Recents accordion state
  const [recentsOpen, setRecentsOpen] = useState(true);

  // Copilot drawer state
  const [copilotOpen, setCopilotOpen] = useState(false);

  // AI Deep Scan state & modal
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanCandidates, setScanCandidates] = useState<AiCandidateOpportunity[]>([]);
  const [scanStats, setScanStats] = useState<{ scanned: number; found: number; calls: number } | null>(null);

  const handleRunDeepScan = async () => {
    if (!selected) return;
    setScanLoading(true);
    try {
      const res = await api.deepScan(selected, {
        account_id: currentAccountId || undefined,
        max_scan: 20,
      });
      setScanCandidates(res.candidates);
      setScanStats({
        scanned: res.messages_scanned,
        found: res.candidates_found,
        calls: res.model_calls,
      });
      setScanModalOpen(true);
    } catch (e: any) {
      alert('Deep scan failed: ' + e.message);
    } finally {
      setScanLoading(false);
    }
  };

  const activeAccount = accounts.data?.items.find((a) => a.id === currentAccountId);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>

      {/* ================= TOP GLOBAL HEADER (44px / h-11) ================= */}
      <header className="h-11 border-b border-brand-border bg-white flex items-center justify-between sticky top-0 z-40 select-none">
        {/* Header Left: Exactly aligns with 272px sidebar on desktop */}
        <div className="w-auto md:w-[272px] h-full md:border-r border-brand-border flex items-center justify-between px-2.5 md:px-3.5 shrink-0 bg-white">
          <div className="flex items-center space-x-2 md:space-x-2.5 min-w-0 flex-1">
            {/* Brand Logo: KasirNusa Triangle */}
            <Link
              to={scoped('/', selected)}
              className="flex items-center text-brand-orange hover:opacity-90 transition shrink-0"
              title="KasirNusa Expansion Workbench"
            >
              <svg className="w-5 h-5 text-brand-orange" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 19.5h20L12 2zm0 4.2l6.5 11.3H5.5L12 6.2z" />
              </svg>
            </Link>

            {/* TOP LEFT SWITCH ACCOUNT: Directly functional as Customer Account Switcher */}
            <div className="relative flex-1 min-w-0 max-w-[170px] md:max-w-none">
              <div className="flex items-center space-x-1 text-xs text-brand-text bg-gray-50 border border-brand-border hover:border-gray-400 px-2 py-0.5 rounded transition min-w-0">
                <span className="font-medium truncate text-[11px] font-mono">
                  {activeAccount ? `${activeAccount.externalId} · ${activeAccount.name}` : 'Switch Account…'}
                </span>
                <svg className="w-3 h-3 text-brand-subtle shrink-0 ml-auto pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>

                {/* Accessible native select overlay matching Playwright role */}
                <select
                  aria-label="Investigate account"
                  value={currentAccountId}
                  onChange={(e) => {
                    if (e.target.value) {
                      navigate(scoped('/accounts/' + e.target.value, selected));
                    } else {
                      navigate(scoped('/', selected));
                    }
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                >
                  <option value="">Switch Account…</option>
                  {accounts.data?.items.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.externalId} · {a.name} · {a.type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Header Tools */}
        <div className="flex items-center space-x-2 md:space-x-3 text-xs font-medium text-brand-muted px-2 md:px-4 shrink-0">
          {/* Ask Copilot Button */}
          <button
            onClick={() => setCopilotOpen(!copilotOpen)}
            className="h-7 flex items-center space-x-1 hover:text-brand-text px-2 md:px-2.5 rounded hover:bg-gray-50 transition border border-transparent hover:border-brand-border"
          >
            <svg className="w-3.5 h-3.5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline">Ask Copilot</span>
          </button>

          {/* AI Deep Scan Action */}
          <button
            onClick={handleRunDeepScan}
            disabled={scanLoading}
            className="h-7 flex items-center space-x-1 bg-orange-50 hover:bg-orange-100 text-brand-orange px-2 md:px-2.5 rounded transition border border-orange-200"
            title="Scan interactions for non-regex expansion requests"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline">{scanLoading ? 'Scanning…' : 'AI Deep Scan'}</span>
          </button>

          {/* Snapshot Selector Combobox */}
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-brand-subtle hidden sm:inline">Snapshot:</span>
            <select
              aria-label="Snapshot"
              value={selected}
              onChange={(e) => navigate(scoped('/', e.target.value))}
              className="h-7 text-xs border border-brand-border rounded px-2 bg-white text-brand-text hover:border-gray-400 outline-none"
            >
              {datasets.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.version} · {d.asOf}
                </option>
              ))}
            </select>
          </div>

          <div className="h-3.5 w-[1px] bg-brand-border"></div>

          {/* User Account Switcher Menu */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="h-7 flex items-center space-x-1.5 px-2 rounded hover:bg-gray-100 border border-brand-border text-brand-text transition"
              title="Current User"
            >
              <div className="w-4 h-4 rounded-full bg-brand-blue text-white text-[9px] flex items-center justify-center font-bold">
                {currentUser.name[0]}
              </div>
              <span className="text-[11px] font-medium hidden md:inline">{currentUser.name}</span>
              <span className="text-[9px] bg-blue-50 text-brand-blue px-1 rounded font-mono">
                {currentUser.employee_external_id ?? currentUser.role}
              </span>
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-1 w-60 bg-white border border-brand-border rounded-lg shadow-dropdown p-2 z-50 text-xs">
                <div className="px-2 py-1.5 border-b border-brand-border mb-1">
                  <div className="font-semibold text-brand-text">{currentUser.name}</div>
                  <div className="text-[11px] text-brand-subtle">{currentUser.email}</div>
                  <div className="text-[10px] font-mono text-emerald-600 mt-0.5">Role: {currentUser.role}</div>
                </div>

                <div className="text-[10px] font-semibold uppercase text-brand-subtle px-2 pt-1 pb-0.5">
                  Switch Active Persona
                </div>

                {[
                  { name: 'Wahyu Setiawan', email: 'wahyu@kasirnusa.id', id: 'E04', role: 'account_manager' },
                  { name: 'Andi Prasetyo', email: 'andi@kasirnusa.id', id: 'E01', role: 'account_manager' },
                  { name: 'Sari Wulandari', email: 'sari@kasirnusa.id', id: 'E02', role: 'sales_rep' },
                  { name: 'Administrator', email: 'admin@kasirnusa.id', id: null, role: 'admin' },
                ].map((u) => (
                  <button
                    key={u.email}
                    onClick={() => {
                      setCurrentUser({
                        id: '00000000-0000-4000-8000-' + (u.id ?? 'admin'),
                        email: u.email,
                        name: u.name,
                        employee_external_id: u.id,
                        role: u.role as any,
                        is_active: true,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                      });
                      setUserDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded hover:bg-gray-50 flex items-center justify-between transition ${
                      currentUser.email === u.email ? 'bg-blue-50 text-brand-blue font-medium' : 'text-brand-text'
                    }`}
                  >
                    <span>{u.name}</span>
                    <span className="text-[10px] font-mono text-brand-subtle">{u.id ?? 'Admin'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ================= WORKSPACE BODY (SIDEBAR + MAIN) ================= */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT SIDEBAR: Matched width (272px) */}
        <aside className="hidden md:flex w-[272px] bg-brand-sidebar border-r border-brand-border flex-col shrink-0 overflow-y-auto text-xs select-none">
          {/* Quick Search */}
          <div className="p-2.5 pb-2">
            <div className="h-8 flex items-center bg-white border border-brand-border rounded-md px-2.5 text-brand-subtle focus-within:border-brand-blue focus-within:ring-1 focus-within:ring-brand-blue/20 transition">
              <svg className="w-3.5 h-3.5 mr-2 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Quick search..."
                className="w-full bg-transparent text-xs text-brand-text placeholder-gray-400 outline-none"
              />
              <span className="text-[10px] text-gray-400 bg-gray-100 border border-gray-200 px-1 py-0.2 rounded font-mono">
                Ctrl K
              </span>
            </div>
          </div>

          {/* Navigation Tree */}
          <nav className="flex-1 px-2 space-y-1">
            {/* Account Home / Opportunities */}
            <Link
              to={scoped('/', selected)}
              className={`w-full h-8 flex items-center px-2.5 rounded transition text-left ${
                isOpportunitiesRoot && !currentAccountId
                  ? 'bg-gray-200/70 text-brand-text font-medium'
                  : 'text-brand-muted hover:text-brand-text hover:bg-gray-100'
              }`}
            >
              <svg className="w-4 h-4 mr-2.5 text-brand-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span>Opportunities</span>
            </Link>

            {/* FOLDABLE RECENTS ACCORDION: Two-Line Item Architecture */}
            <div className="pt-1">
              <button
                onClick={() => setRecentsOpen(!recentsOpen)}
                className="w-full px-2 py-1 flex items-center justify-between text-xs font-medium text-brand-subtle hover:text-brand-text transition group rounded"
              >
                <span className="flex items-center">
                  <svg className="w-3.5 h-3.5 mr-1.5 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Recents</span>
                </span>
                <svg
                  className={`w-3 h-3 text-gray-400 chevron-icon ${recentsOpen ? 'chevron-down-rotated' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div className={`accordion-content ${recentsOpen ? 'open' : ''}`}>
                <div className="accordion-inner ml-3.5 pl-2.5 border-l border-brand-border space-y-1.5 py-1">
                  {/* Recent 1: C06 */}
                  {accounts.data?.items.find((a) => a.externalId === 'C06') && (
                    <div
                      onClick={() =>
                        navigate(
                          scoped('/accounts/' + accounts.data?.items.find((a) => a.externalId === 'C06')?.id, selected)
                        )
                      }
                      className="cursor-pointer group py-0.5"
                    >
                      <div className="text-[12px] text-gray-800 font-medium group-hover:text-brand-blue transition truncate">
                        C06 · PT Bakmi GM Indonesia
                      </div>
                      <div className="text-[10px] text-gray-400 leading-tight">10 Outlets Q2 2027 · Jakarta</div>
                    </div>
                  )}

                  {/* Recent 2: C01 */}
                  {accounts.data?.items.find((a) => a.externalId === 'C01') && (
                    <div
                      onClick={() =>
                        navigate(
                          scoped('/accounts/' + accounts.data?.items.find((a) => a.externalId === 'C01')?.id, selected)
                        )
                      }
                      className="cursor-pointer group py-0.5"
                    >
                      <div className="text-[12px] text-gray-800 font-medium group-hover:text-brand-blue transition truncate">
                        C01 · PT Kenangan Abadi
                      </div>
                      <div className="text-[10px] text-gray-400 leading-tight">Renewal Risk · POS Integration</div>
                    </div>
                  )}

                  {/* Recent 3: P01 */}
                  {accounts.data?.items.find((a) => a.externalId === 'P01') && (
                    <div
                      onClick={() =>
                        navigate(
                          scoped('/accounts/' + accounts.data?.items.find((a) => a.externalId === 'P01')?.id, selected)
                        )
                      }
                      className="cursor-pointer group py-0.5"
                    >
                      <div className="text-[12px] text-gray-800 font-medium group-hover:text-brand-blue transition truncate">
                        P01 · PT Retail Maju
                      </div>
                      <div className="text-[10px] text-gray-400 leading-tight">Prospect · Intermediary Route</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Observability & AI Engine Category */}
            <div className="pt-2 px-2.5 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              AI & Telemetry
            </div>

            <button
              onClick={handleRunDeepScan}
              className="w-full h-8 flex items-center justify-between px-2.5 rounded text-brand-muted hover:text-brand-text hover:bg-gray-100 transition text-left"
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2.5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI Deep Scan</span>
              </span>
              <span className="text-[9px] bg-orange-100 text-brand-orange px-1 rounded font-medium">Auto</span>
            </button>

            <button
              onClick={() => setCopilotOpen(!copilotOpen)}
              className="w-full h-8 flex items-center justify-between px-2.5 rounded text-brand-muted hover:text-brand-text hover:bg-gray-100 transition text-left"
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2.5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span>Account Copilot QA</span>
              </span>
            </button>

            {/* Management Category */}
            <div className="pt-2 px-2.5 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              Organization
            </div>

            <button
              onClick={() => setUserDropdownOpen(true)}
              className="w-full h-8 flex items-center justify-between px-2.5 rounded text-brand-muted hover:text-brand-text hover:bg-gray-100 transition text-left"
            >
              <span className="flex items-center">
                <svg className="w-4 h-4 mr-2.5 text-brand-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Team & RBAC</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400">4 seats</span>
            </button>
          </nav>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-brand-border text-[11px] text-brand-subtle flex items-center justify-between">
            <span className="font-mono">KasirNusa v0.4</span>
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">Verified</span>
          </div>
        </aside>

        {/* ================= MAIN VIEW AREA ================= */}
        <main id="main" key={selected} className="flex-1 overflow-y-auto bg-white px-4 md:px-8 py-4 md:py-6 max-w-full">
          {!result.data ? (
            <Pending error={result.error} />
          ) : !datasets.length ? (
            <p className="text-sm text-brand-muted">No ready dataset. Run the import and analysis first.</p>
          ) : !dataset ? (
            <p role="alert" className="text-sm text-red-600">
              Snapshot is unavailable. Select an authorized snapshot.
            </p>
          ) : (
            <>
              {accounts.error && <Pending error={accounts.error} />}
              <Routes>
                <Route path="/" element={<Opportunities dataset={selected} onOpenScan={() => setScanModalOpen(true)} />} />
                <Route
                  path="/:kind/:id"
                  element={<Detail key={location.pathname} dataset={selected} action={false} />}
                />
                <Route
                  path="/:kind/:id/action"
                  element={<Detail key={location.pathname} dataset={selected} action />}
                />
                <Route path="*" element={<p role="alert">Page unavailable.</p>} />
              </Routes>
            </>
          )}
        </main>
      </div>

      {/* ================= SLIDING COPILOT DRAWER ================= */}
      {copilotOpen && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-[460px] bg-white border-l border-brand-border shadow-2xl z-50 flex flex-col">
          <div className="h-11 border-b border-brand-border px-4 flex items-center justify-between bg-gray-50">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-semibold text-brand-text">KasirNusa Copilot</span>
            </div>
            <button
              onClick={() => setCopilotOpen(false)}
              className="text-xs text-brand-subtle hover:text-brand-text p-1"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <AccountQA
              key={'copilot-' + selected + currentAccountId}
              dataset={selected}
              account={currentAccountId || (accounts.data?.items[0]?.id ?? '')}
              route="joint"
              open={() => {}}
            />
          </div>
        </div>
      )}

      {/* ================= AI DEEP SCAN RESULTS MODAL ================= */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl border border-brand-border shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 rounded-md bg-orange-100 text-brand-orange">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-brand-text">AI Deep Scan Results</h3>
                  <p className="text-[11px] text-brand-subtle">
                    Discovered buying signals bypassing deterministic regex
                  </p>
                </div>
              </div>
              <button onClick={() => setScanModalOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">
                ✕
              </button>
            </div>

            {scanStats && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-gray-50 border border-brand-border rounded">
                  <div className="text-[10px] text-gray-400 uppercase font-mono">Messages Scanned</div>
                  <div className="font-bold text-gray-800 text-sm mt-0.5">{scanStats.scanned}</div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-brand-border rounded">
                  <div className="text-[10px] text-gray-400 uppercase font-mono">Candidates Found</div>
                  <div className="font-bold text-emerald-600 text-sm mt-0.5">{scanStats.found}</div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-brand-border rounded">
                  <div className="text-[10px] text-gray-400 uppercase font-mono">Model Invocations</div>
                  <div className="font-bold text-brand-blue text-sm mt-0.5">{scanStats.calls}</div>
                </div>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-brand-border rounded-lg">
              {scanCandidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-brand-subtle">
                  No additional non-regex candidates detected in current message window.
                </div>
              ) : (
                scanCandidates.map((c) => (
                  <div key={c.id} className="p-3.5 space-y-1.5 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-brand-text">
                        {c.account_external_id} · {c.account_name}
                      </span>
                      <span className="text-[10px] font-mono bg-blue-50 text-brand-blue px-2 py-0.5 rounded-full border border-blue-200">
                        {c.signal.kind}
                      </span>
                    </div>
                    <blockquote className="text-xs italic text-gray-700 bg-gray-50 p-2 rounded border-l-2 border-brand-orange">
                      "{c.signal.raw_quote}"
                    </blockquote>
                    <div className="flex items-center justify-between text-[11px] text-brand-subtle font-mono">
                      <span>
                        Quantity: {c.signal.quantity} {c.signal.unit} · {c.signal.location ?? 'Location unstated'}
                      </span>
                      <span>Intent: {c.intent_assessment.choice} ({Math.round(c.intent_assessment.confidence * 100)}%)</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setScanModalOpen(false)}
                className="h-8 px-4 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-medium rounded-md shadow-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-8 border-t border-brand-border bg-brand-canvas px-4 flex items-center justify-between text-[11px] text-brand-subtle select-none">
        <span>KasirNusa Account Expansion Assistant · Historical snapshot</span>
        <span>Proposed actions for human review · CRM writes disabled</span>
      </footer>
    </>
  );
}

// ================= VIEW: EXPANSION OPPORTUNITIES =================
function Opportunities({ dataset, onOpenScan }: { dataset: string; onOpenScan: () => void }) {
  const [status, setStatus] = useState('active');
  const [kind, setKind] = useState('');
  const [account, setAccount] = useState('');
  const [page, setPage] = useState(1);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const accounts = useLoad('filter-accounts:' + dataset, (s) => api.accounts(dataset, s));
  const options = {
    page: String(page),
    page_size: '10',
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(account ? { account_id: account } : {}),
  };
  const result = useLoad(dataset + JSON.stringify(options), (signal) =>
    api.opportunities(dataset, options, signal)
  );

  return (
    <section className="space-y-6 max-w-5xl mx-auto">
      {/* Onboarding / Status Banner */}
      <div className="flex justify-center">
        <div
          onClick={onOpenScan}
          className="inline-flex items-center space-x-2 bg-brand-canvas border border-brand-border px-3.5 py-1 rounded-full text-xs text-brand-muted hover:border-gray-400 transition cursor-pointer"
        >
          <span>Run Autonomous Deep Scan to surface unrecorded signals</span>
          <span className="text-xs">⚡ 🔍 🚀</span>
        </div>
      </div>

      {/* Page Title & Scannability Subtitle */}
      <div className="text-center pt-1 pb-1">
        <h1 className="text-2xl font-semibold tracking-tight text-brand-text">Expansion opportunities</h1>
        <p className="text-xs text-brand-subtle mt-1 max-w-xl mx-auto leading-relaxed">
          Explicit expansion requests, recorded CRM gaps, and audience-tailored next actions.
        </p>
      </div>

      {/* Marketing Glow Card (Halftone & Sunset Orange Gradient) */}
      <div className="rounded-xl border border-brand-border hero-glow-card p-5 text-white shadow-xs flex flex-col md:flex-row items-center justify-between gap-5 hero-dot-grid">
        <div className="space-y-1.5 z-10 max-w-xl">
          <div className="flex items-center space-x-2">
            <h2 className="text-base font-bold tracking-tight">Expansion Intelligence & Stakeholder Guidance</h2>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-medium">Core Feature</span>
          </div>
          <p className="text-xs text-white/90 leading-relaxed">
            Identifies buying signals, maps stakeholder authority vs documented decision requirements, and produces cited action plans.
          </p>
        </div>
        <div className="z-10 shrink-0">
          <button
            onClick={onOpenScan}
            className="h-8 px-3.5 bg-white text-brand-text hover:bg-gray-100 font-medium text-xs rounded-md transition shadow-xs flex items-center space-x-1.5"
          >
            <svg className="w-3.5 h-3.5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>Scan Opportunities</span>
          </button>
        </div>
      </div>

      {/* Micro-Telemetry Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border border-brand-border rounded-lg p-4 bg-white">
          <span className="text-xs text-brand-subtle font-medium">Recorded Opportunities</span>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold font-mono text-brand-text">
              {result.data?.total ?? 0}
            </span>
            <span className="text-xs text-emerald-600 font-medium font-mono">100% verified</span>
          </div>
        </div>

        <div className="border border-brand-border rounded-lg p-4 bg-white">
          <span className="text-xs text-brand-subtle font-medium">Priority Distribution</span>
          <div className="mt-2 text-xs text-brand-muted space-y-0.5 font-mono">
            <div>Quotation Requests: <strong className="text-brand-text font-bold">High</strong></div>
            <div>Explicit Plans: <strong className="text-brand-text font-bold">Medium</strong></div>
          </div>
        </div>

        <div className="border border-brand-border rounded-lg p-4 bg-white">
          <span className="text-xs text-brand-subtle font-medium">Reconciliation Rule</span>
          <div className="mt-2 text-xs text-brand-muted space-y-0.5 font-mono">
            <div>Account + Scope + Timing</div>
            <div className="text-[11px] text-brand-subtle">Deterministic matching</div>
          </div>
        </div>
      </div>

      {/* Filter Row (Calibrated: h-8, rounded-md, text-xs) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Combobox */}
          <div className="h-8 flex items-center bg-white border border-brand-border rounded-md px-2 text-xs">
            <span className="text-[11px] text-brand-subtle mr-1.5">Status:</span>
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-brand-text outline-none text-xs font-medium cursor-pointer"
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="cancelled">Cancelled</option>
              <option value="unclear">Unclear</option>
            </select>
          </div>

          {/* Request Type Combobox */}
          <div className="h-8 flex items-center bg-white border border-brand-border rounded-md px-2 text-xs">
            <span className="text-[11px] text-brand-subtle mr-1.5">Type:</span>
            <select
              aria-label="Request type"
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-brand-text outline-none text-xs font-medium cursor-pointer"
            >
              <option value="">All request types</option>
              <option value="quotation_request">Quotation request</option>
              <option value="explicit_plan">Explicit plan</option>
            </select>
          </div>

          {/* Account Filter Combobox */}
          <div className="h-8 flex items-center bg-white border border-brand-border rounded-md px-2 text-xs">
            <span className="text-[11px] text-brand-subtle mr-1.5">Account:</span>
            <select
              aria-label="Account filter"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-brand-text outline-none text-xs font-medium cursor-pointer max-w-44 truncate"
            >
              <option value="">All accounts</option>
              {accounts.data?.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.externalId} · {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-[11px] text-brand-subtle font-mono">
          Showing {result.data?.items.length ?? 0} of {result.data?.total ?? 0} opportunities
        </div>
      </div>

      {/* Main Opportunities Data Table with Foldable Drawer Rows */}
      {!result.data ? (
        <Pending error={result.error} />
      ) : (
        <div className="border border-brand-border rounded-lg overflow-hidden bg-white shadow-xs">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-brand-canvas border-b border-brand-border text-brand-subtle font-medium">
              <tr>
                <th className="py-2.5 px-4">Account <span className="text-[10px]">↕</span></th>
                <th className="py-2.5 px-4">Signal & Status</th>
                <th className="py-2.5 px-4">Incremental Value</th>
                <th className="py-2.5 px-4">Next Action & Owner</th>
                <th className="py-2.5 px-4">Elapsed</th>
                <th className="py-2.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-brand-text">
              {result.data.items.map((card) => {
                const isOpen = expandedRow === card.id;
                return (
                  <>
                    <tr
                      key={card.id}
                      className="hover:bg-brand-canvas/80 transition cursor-pointer"
                      onClick={() => setExpandedRow(isOpen ? null : card.id)}
                    >
                      {/* Account Link */}
                      <td className="py-3 px-4 font-mono font-medium text-brand-blue">
                        <Link
                          to={scoped('/opportunities/' + card.id, dataset)}
                          className="hover:underline flex items-center space-x-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span>{card.account.external_id} · {card.account.name}</span>
                        </Link>
                      </td>

                      {/* Signal & Status */}
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          <span
                            className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                              card.signal.status === 'active'
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : card.signal.status === 'cancelled'
                                ? 'text-red-700 bg-red-50 border-red-200'
                                : 'text-amber-700 bg-amber-50 border-amber-200'
                            }`}
                          >
                            {card.signal.status}
                          </span>
                          <span className="text-[10px] text-brand-subtle font-mono">
                            {words(card.signal.kind)}
                          </span>
                        </div>
                      </td>

                      {/* Value Scenario */}
                      <td className="py-3 px-4 font-mono">
                        {card.value_scenario ? (
                          <div>
                            <span className="font-semibold text-brand-text">
                              {amount(card.value_scenario.amount)} IDR
                            </span>
                            <div className="text-[10px] text-brand-subtle">annual conditional</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-[11px]">New terms required</span>
                        )}
                      </td>

                      {/* Owner & Task */}
                      <td className="py-3 px-4 max-w-xs truncate">
                        <div className="font-medium text-brand-text">{card.people.owner.name}</div>
                        <div className="text-[11px] text-brand-muted truncate">{card.next_action.task}</div>
                      </td>

                      {/* Elapsed Days */}
                      <td className="py-3 px-4 text-brand-subtle font-mono">
                        {card.elapsed_days}d
                      </td>

                      {/* Details Accordion Toggle */}
                      <td className="py-3 px-4 text-right">
                        <span className="inline-flex items-center space-x-1 text-xs text-brand-subtle hover:text-brand-text">
                          <span className="text-[11px] mr-0.5">Inspect</span>
                          <svg
                            className={`w-3.5 h-3.5 chevron-icon ${isOpen ? 'chevron-down-rotated' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </span>
                      </td>
                    </tr>

                    {/* FOLDABLE ACCORDION DETAIL ROW */}
                    {isOpen && (
                      <tr key={card.id + '-foldable'} className="bg-brand-canvas/60 border-t border-brand-border">
                        <td colSpan={6} className="p-4 space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                            <div className="p-3 bg-white border border-brand-border rounded">
                              <div className="text-[10px] text-gray-400 font-medium uppercase">Scope & Location</div>
                              <div className="font-semibold text-gray-800 mt-0.5">
                                {card.signal.additional_outlets ?? 'Unknown'} outlets · {card.signal.location ?? 'Location unstated'}
                              </div>
                              <div className="text-[11px] text-gray-500 mt-0.5">Target: {card.signal.target_period ?? 'Timing unstated'}</div>
                            </div>

                            <div className="p-3 bg-white border border-brand-border rounded">
                              <div className="text-[10px] text-gray-400 font-medium uppercase">CRM Reconciliation</div>
                              <div className="font-semibold text-gray-800 mt-0.5">{words(card.reconciliation.status)}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">Search scope verified</div>
                            </div>

                            <div className="p-3 bg-white border border-brand-border rounded">
                              <div className="text-[10px] text-gray-400 font-medium uppercase">Observed Blocker / Finding</div>
                              <div className="font-semibold text-gray-800 mt-0.5 truncate">{card.findings[0]?.label ?? 'No active blockers'}</div>
                              <div className="text-[11px] text-gray-500 mt-0.5">Contact: {card.people.contact?.name ?? 'Unknown'}</div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-brand-subtle font-mono">
                              Request Date: {card.signal.date} · Snapshot As of: {card.as_of}
                            </span>
                            <Link
                              to={scoped('/opportunities/' + card.id, dataset)}
                              className="h-8 px-3.5 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-medium rounded-md transition shadow-xs flex items-center space-x-1"
                            >
                              <span>Inspect evidence and context</span>
                              <span>→</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}

              {!result.data.items.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-brand-subtle">
                    No opportunities match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination Toolbar */}
          <div className="px-4 py-2 border-t border-brand-border flex items-center justify-between text-[11px] text-brand-subtle bg-brand-canvas">
            <div>
              Showing page {page} of {Math.ceil((result.data.total || 1) / 10)}
            </div>
            <div className="flex items-center space-x-2 pagination">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-7 px-2.5 border border-brand-border rounded bg-white text-brand-text disabled:opacity-40 hover:bg-gray-50 text-xs font-medium"
              >
                Previous
              </button>
              <span className="font-mono text-brand-text">Page {page}</span>
              <button
                disabled={page * 10 >= result.data.total}
                onClick={() => setPage((p) => p + 1)}
                className="h-7 px-2.5 border border-brand-border rounded bg-white text-brand-text disabled:opacity-40 hover:bg-gray-50 text-xs font-medium"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ================= COMPONENT: EVIDENCE REFERENCES =================
function Refs({
  ids,
  evidence,
  open,
}: {
  ids: string[];
  evidence: Evidence[];
  open: (id: string) => void;
}) {
  return (
    <span className="refs inline-flex flex-wrap gap-1 my-1">
      {[...new Set(ids)].map((id) => {
        const found = evidence.find((e) => e.source_id === id);
        return (
          <button
            key={id}
            onClick={() => open(id)}
            className="h-6 px-2 text-[11px] font-mono border border-brand-border rounded bg-white hover:bg-gray-50 text-brand-blue"
          >
            {found?.source_external_id ?? found?.filename ?? 'Source record'}
          </button>
        );
      })}
    </span>
  );
}

// ================= COMPONENT: SOURCE RECORD DRAWER =================
function Source({
  dataset,
  id,
  close,
}: {
  dataset: string;
  id: string;
  close: () => void;
}) {
  const target = useRef<HTMLElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    target.current?.focus();
    target.current?.scrollIntoView({ block: 'nearest' });
    return () => prior?.focus();
  }, [id]);

  const result = useLoad(dataset + id, (s) => api.source(dataset, id, s));

  return (
    <aside
      ref={target}
      role="complementary"
      aria-label="Original source"
      tabIndex={-1}
      className="fixed inset-y-0 right-0 w-full sm:w-[520px] bg-white border-l border-brand-border shadow-2xl z-50 flex flex-col"
    >
      <div className="h-11 border-b border-brand-border px-4 flex items-center justify-between bg-gray-50">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h2 className="text-xs font-semibold text-brand-text">Original source</h2>
        </div>
        <button
          onClick={close}
          className="h-7 px-3 text-xs font-medium border border-brand-border rounded bg-white hover:bg-gray-100 text-brand-text transition"
        >
          Close source
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {!result.data ? (
          <Pending error={result.error} />
        ) : (
          <>
            <div>
              <h3 className="text-sm font-bold font-mono text-brand-text">
                {result.data.external_id ?? 'Record'} · {result.data.filename}:{result.data.locator}
              </h3>
              <p className="text-[11px] text-brand-subtle mt-0.5">
                As of {result.data.as_of} · Hash: <span className="font-mono">{result.data.content_hash.slice(0, 16)}…</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-brand-subtle uppercase text-[10px] tracking-wider">Raw Payload Text</span>
              <pre className="font-mono text-xs bg-gray-50 p-3 rounded-lg border border-brand-border overflow-x-auto whitespace-pre-wrap leading-relaxed">
                {result.data.raw_text}
              </pre>
            </div>

            <details className="border border-brand-border rounded-lg p-3 bg-brand-canvas" open>
              <summary className="font-medium text-brand-text cursor-pointer select-none">
                Parsed source fields
              </summary>
              <dl className="mt-2 divide-y divide-gray-200">
                {Object.entries(result.data.payload).map(([field, value]) => (
                  <div key={field} className="py-1.5 flex flex-col sm:flex-row sm:justify-between text-[11px]">
                    <dt className="font-mono font-semibold text-brand-muted">{field}</dt>
                    <dd className="font-mono text-brand-text sm:text-right mt-0.5 sm:mt-0 max-w-xs break-words">
                      {value || '(empty)'}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </>
        )}
      </div>
    </aside>
  );
}

// ================= VIEW: DETAIL & DIAGNOSIS WORKBENCH =================
function Detail({ dataset, action }: { dataset: string; action: boolean }) {
  const { kind, id } = useParams();
  const [route, setRoute] = useState('joint');
  const [question, setQuestion] = useState('');
  const [source, setSource] = useState('');
  const open = useCallback((srcId: string) => setSource(srcId), []);

  const valid = kind === 'accounts' || kind === 'opportunities';
  const options = { route, ...(question ? { question } : {}) };

  const result = useLoad<Resource>(
    dataset + kind + id + JSON.stringify(options),
    (s) => (kind === 'opportunities' ? api.card(dataset, id!, s) : api.diagnosis(dataset, id!, options, s))
  );

  const graph = useLoad(
    'graph:' + dataset + kind + id,
    (s) => api.graph(dataset, kind as 'accounts' | 'opportunities', id!, s)
  );

  if (!valid) return <p role="alert" className="p-4 text-xs text-red-600">Resource unavailable.</p>;
  if (!result.data) return <Pending error={result.error} />;

  const resource: Resource = result.data;
  const card = 'signal' in resource;
  const accountCode = card ? resource.account.external_id : resource.account.externalId;
  const owner = card ? resource.people.owner : resource.owner;
  const plan = card ? resource.next_action : resource.action_plan;
  const name = (pId: string) =>
    card
      ? [owner, resource.people.contact].find((p) => p?.id === pId)?.name ?? pId
      : [owner, ...resource.stakeholder_context.map((p) => p.person)].find((p) => p.id === pId)?.name ?? pId;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Eyebrow & Title */}
      <div>
        <p className="eyebrow text-[11px] font-mono uppercase tracking-wider text-brand-subtle">
          {words(resource.commercial_context)} · {resource.dataset_version} · AS OF {resource.as_of}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-text mt-1">
          {accountCode} · {resource.account.name}
        </h1>
      </div>

      {/* ANIMATED TABS BAR (Sliding Indicator Tab Component) */}
      <div className="relative border-b border-brand-border">
        <nav aria-label="Account workflow" className="flex space-x-8 text-xs font-medium">
          <Link
            aria-current={!action ? 'page' : undefined}
            to={scoped('/' + kind + '/' + id, dataset)}
            className={`pb-2.5 transition ${!action ? 'text-brand-blue font-semibold border-b-2 border-brand-blue' : 'text-brand-subtle hover:text-brand-text'}`}
          >
            Evidence and context
          </Link>
          <Link
            aria-current={action ? 'page' : undefined}
            to={scoped('/' + kind + '/' + id + '/action', dataset)}
            className={`pb-2.5 transition ${action ? 'text-brand-blue font-semibold border-b-2 border-brand-blue' : 'text-brand-subtle hover:text-brand-text'}`}
          >
            Action plan
          </Link>
          {card && (
            <Link
              to={scoped('/accounts/' + resource.account.id, dataset)}
              className="pb-2.5 text-brand-subtle hover:text-brand-text transition"
            >
              Account diagnosis
            </Link>
          )}
        </nav>
      </div>

      {/* Outcome Question Premise Check Form */}
      {!card && (
        <form
          className="question border border-brand-border rounded-lg p-4 bg-brand-canvas flex flex-col sm:flex-row items-end gap-3 shadow-xs"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            setQuestion(String(data.get('question') ?? ''));
          }}
        >
          <div className="flex-1 w-full">
            <label className="text-[11px] font-medium text-brand-subtle block mb-1">
              Check an outcome question
              <input
                name="question"
                aria-label="Check an outcome question"
                maxLength={500}
                placeholder="Why are repeat orders lower? / Mengapa repeat order menurun?"
                className="mt-1 w-full h-8 text-xs border border-brand-border rounded-md px-3 bg-white text-brand-text placeholder-gray-400 focus:border-brand-blue outline-none"
              />
            </label>
          </div>
          <button className="h-8 px-4 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-medium rounded-md shadow-xs transition shrink-0">
            Check premise
          </button>
        </form>
      )}

      {/* Premise Check Notice */}
      {!card && resource.premise_check && (
        <section className="notice border border-amber-200 bg-amber-50 rounded-lg p-4 text-xs space-y-2">
          <h2 className="text-sm font-semibold text-amber-900">
            Premise check: {words(resource.premise_check.status)}
          </h2>
          <p className="text-amber-800">{resource.premise_check.coverage}</p>
          <p className="text-amber-800">{resource.premise_check.clarification}</p>
          <p className="text-amber-800">{resource.premise_check.qualifying_events}</p>
          {resource.premise_check.calculation && (
            <pre className="font-mono text-[11px] bg-white/80 p-2.5 rounded border border-amber-200 text-amber-950">
              {JSON.stringify(resource.premise_check.calculation, null, 2)}
            </pre>
          )}
          <ul className="list-disc list-inside text-amber-800 text-[11px]">
            {resource.premise_check.limitations.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <div className="pt-1">
            <Refs ids={resource.premise_check.evidence_ids} evidence={resource.evidence} open={open} />
          </div>
        </section>
      )}

      {/* Account QA Grounded Inquiry */}
      <AccountQA
        key={dataset + kind + id + route}
        dataset={dataset}
        account={resource.account.id}
        opportunity={card ? resource.id : undefined}
        route={route}
        open={open}
      />

      {/* ACTION VIEW OR EVIDENCE VIEW */}
      {action ? (
        <div className="space-y-6">
          {/* Proposed Next Action Card */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <h2 className="text-base font-semibold text-brand-text">Proposed next action</h2>
              <span className="text-[11px] font-mono bg-blue-50 text-brand-blue px-2.5 py-0.5 rounded-full border border-blue-200">
                {words(plan.route)} · proposed
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-brand-canvas border border-brand-border rounded">
                <span className="text-brand-subtle font-medium block">Responsible owner:</span>
                <span className="font-semibold text-brand-text">{owner.name}</span>
                <Refs ids={owner.evidence_ids} evidence={resource.evidence} open={open} />
              </div>

              <div className="p-3 bg-brand-canvas border border-brand-border rounded">
                <span className="text-brand-subtle font-medium block">Recipients:</span>
                <span className="font-semibold text-brand-text">
                  {plan.recipient_ids.map(name).join(', ') || 'Confirm the appropriate stakeholder'}
                </span>
              </div>
            </div>

            {!card && (
              <p className="text-xs text-brand-subtle">
                Supporting internal owner references:{' '}
                {resource.action_plan.supporting_owner_ids.map(name).join(', ') || 'None identified'}
              </p>
            )}

            <div className="p-3.5 bg-gray-50 border border-brand-border rounded-lg text-xs leading-relaxed font-medium text-brand-text">
              {plan.task}
            </div>

            {!card && <p className="text-xs text-brand-muted leading-relaxed">{resource.action_plan.rationale}</p>}

            {!card &&
              ['joint_decision_maker_discussion', 'prepare_through_intermediary'].includes(plan.route) && (
                <div className="pt-2">
                  <label className="text-xs font-semibold text-brand-text block mb-1">
                    Conversation route
                    <select
                      aria-label="Conversation route"
                      value={route}
                      onChange={(e) => setRoute(e.target.value)}
                      className="mt-1 h-8 text-xs border border-brand-border rounded-md px-2.5 bg-white text-brand-text outline-none focus:border-brand-blue"
                    >
                      <option value="joint">Joint discussion</option>
                      <option value="intermediary">Prepare through intermediary</option>
                      <option value="direct">Direct discussion if supported</option>
                    </select>
                  </label>
                </div>
              )}

            <div className="pt-2 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-subtle">
                Ordered preparation and discussion tasks
              </h3>
              {!card && (
                <ol className="space-y-2 list-decimal list-inside text-xs">
                  {resource.action_plan.tasks.map((t) => (
                    <li key={t.order} className="p-2.5 border border-brand-border rounded-md bg-white">
                      <span>{t.text}</span>
                      <Refs ids={t.evidence_ids} evidence={resource.evidence} open={open} />
                    </li>
                  ))}
                </ol>
              )}

              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-subtle pt-2">
                Audience-specific discussion points
              </h3>
              <ul className="space-y-2 text-xs">
                {plan.discussion_points.map((point, i) => (
                  <li key={i} className="p-2.5 border border-brand-border rounded-md bg-white">
                    {'audience_ids' in point && (
                      <strong className="text-brand-blue mr-1">
                        {point.audience_ids.map(name).join(', ') || 'Account owner'}:
                      </strong>
                    )}
                    <span>{point.text}</span>
                    <Refs ids={point.evidence_ids} evidence={resource.evidence} open={open} />
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Follow-up Draft Generator */}
          <Draft
            key={dataset + kind + id + route}
            dataset={dataset}
            kind={kind as 'accounts' | 'opportunities'}
            id={id!}
            options={{ route }}
            evidence={resource.evidence}
            open={open}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card Request & Reconciliation */}
          {card && (
            <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-xs">
              <h2 className="text-base font-semibold text-brand-text">Request and reconciliation</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-brand-canvas border border-brand-border rounded space-y-1">
                  <div className="font-medium text-brand-text">
                    {words(resource.signal.kind)} · {resource.signal.status}
                  </div>
                  <div className="text-brand-muted">
                    {resource.signal.additional_outlets ?? 'Unknown'} additional outlets ·{' '}
                    {resource.signal.location ?? 'Unknown location'} · {resource.signal.target_period ?? 'Unknown target'}
                  </div>
                  <div className="text-[11px] text-brand-subtle">
                    Request date {resource.signal.date} · {resource.elapsed_days} days elapsed
                  </div>
                </div>

                <div className="p-3 bg-brand-canvas border border-brand-border rounded space-y-1">
                  <div className="font-semibold text-brand-text">CRM: {words(resource.reconciliation.status)}</div>
                  <pre className="font-mono text-[10px] bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                    {JSON.stringify(resource.reconciliation.check, null, 2)}
                  </pre>
                </div>
              </div>
            </section>
          )}

          {/* Recorded Findings */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-xs">
            <h2 className="text-base font-semibold text-brand-text">Recorded findings</h2>
            <div className="space-y-2">
              {resource.findings.map((finding, i) => (
                <article key={i} className="border border-brand-border rounded-md p-3 bg-brand-canvas text-xs space-y-1.5">
                  <p className="font-medium text-brand-text">{finding.label}</p>
                  <Refs ids={finding.evidence_ids} evidence={resource.evidence} open={open} />
                  {finding.check && (
                    <details className="text-[11px] text-gray-500 pt-1">
                      <summary className="cursor-pointer hover:text-brand-text">Deterministic check</summary>
                      <pre className="mt-1 font-mono text-[10px] bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                        {JSON.stringify(finding.check, null, 2)}
                      </pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* Stakeholder Context */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-xs">
            <h2 className="text-base font-semibold text-brand-text">Stakeholder context</h2>
            {card ? (
              <div className="space-y-3 text-xs">
                <p className="text-brand-muted">
                  {resource.people.contact?.name ?? 'Contact unknown'} · Purchasing authority unknown
                </p>
                {resource.stakeholder_context.map((p, i) => (
                  <article key={i} className="border border-brand-border rounded-md p-3 bg-brand-canvas space-y-1">
                    <p className="font-semibold text-brand-text">
                      {p.role} · valid at request: {String(p.valid_at_request)} · {p.source_date} · direct
                    </p>
                    <p className="text-brand-muted">{p.knowledge}</p>
                    <Refs ids={p.evidence_ids} evidence={resource.evidence} open={open} />
                  </article>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {resource.stakeholder_context.map((p) => (
                  <article key={p.person.id} className="border border-brand-border rounded-md p-4 bg-brand-canvas text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-brand-text text-sm">
                        {p.person.name} ·{' '}
                        <span className={p.current ? 'text-emerald-600' : 'text-amber-600'}>
                          {p.current ? 'Current' : 'Historical — do not recommend as current employee'}
                        </span>
                      </h3>
                      <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-brand-border">
                        Authority: {words(p.authority)}
                      </span>
                    </div>

                    <div className="space-y-1 text-brand-muted">
                      {p.employments.map((e, i) => (
                        <p key={i}>
                          {e.role} · {e.start} — {e.end ?? 'ongoing'}{' '}
                          <Refs ids={e.evidence_ids} evidence={resource.evidence} open={open} />
                        </p>
                      ))}
                    </div>

                    {p.statements.map((s) => (
                      <div key={s.id} className="border-l-2 border-brand-blue pl-3 py-1 space-y-1 bg-white p-2 rounded">
                        <div className="flex items-center justify-between text-[11px]">
                          <strong>{words(s.predicate)}</strong>
                          <span className="text-gray-400 font-mono">
                            {s.event_date} · {s.attribution} · {s.verification}
                          </span>
                        </div>
                        <p className="text-gray-500 text-[11px]">
                          Speaker: {s.speaker_id ? name(s.speaker_id) : 'Unknown'} · scoped to this recorded exchange
                        </p>
                        <blockquote className="italic text-gray-700 font-mono text-[11px]">"{s.text}"</blockquote>
                        <Refs ids={s.evidence_ids} evidence={resource.evidence} open={open} />
                      </div>
                    ))}

                    <div className="flex flex-wrap gap-1 pt-1">
                      <Refs ids={p.person.evidence_ids} evidence={resource.evidence} open={open} />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Internal Decisions and Commitments */}
          {!card && resource.internal_decisions.length > 0 && (
            <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-xs">
              <h2 className="text-base font-semibold text-brand-text">Internal decisions and commitments</h2>
              <p className="text-xs text-brand-subtle">These are KasirNusa approvals, not evidence of customer purchasing authority.</p>
              <div className="space-y-2">
                {resource.internal_decisions.map((d) => (
                  <article key={d.id} className="border border-brand-border rounded-md p-3 bg-brand-canvas text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-brand-text">
                      <span>{d.external_id} · {d.date}</span>
                      <span className="font-mono text-[11px] text-brand-blue">{d.outcome}</span>
                    </div>
                    <p className="text-brand-muted">{d.rationale}</p>
                    <Refs ids={d.evidence_ids} evidence={resource.evidence} open={open} />
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Requirement Follow-up Assessment */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-xs">
            <h2 className="text-base font-semibold text-brand-text">Requirement follow-up assessment</h2>
            {!card && (
              <div className="space-y-2">
                {resource.requirement_assessments.map((a) => (
                  <article key={a.id} className="border border-brand-border rounded-md p-3 bg-brand-canvas text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-brand-text">
                      <h3 className="text-xs uppercase">{a.status.replaceAll('_', ' ')}</h3>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-gray-200">{a.status}</span>
                    </div>
                    <p className="text-brand-muted font-medium">{a.requirement}</p>
                    <p className="text-brand-subtle text-[11px]">
                      Fulfillment: {a.fulfillment.status.replaceAll('_', ' ')}. {a.fulfillment.reason}
                    </p>
                    <p className="text-brand-subtle text-[11px]">
                      Missing: {a.missing_details.join(', ') || 'Not established'}
                    </p>
                    <Refs ids={a.source_ids} evidence={resource.evidence} open={open} />
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* Commercial Scenario */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-xs">
            <h2 className="text-base font-semibold text-brand-text">Commercial scenario</h2>
            {resource.value_scenario ? (
              <div className="space-y-2 text-xs">
                <p className="text-xl font-bold font-mono text-emerald-700">
                  {amount(resource.value_scenario.amount)} IDR / year, conditional annual increment
                </p>
                <p className="font-mono text-xs text-brand-muted">{resource.value_scenario.formula}</p>
                <pre className="font-mono text-[11px] bg-brand-canvas p-3 rounded-md border border-brand-border">
                  {JSON.stringify(resource.value_scenario.inputs, null, 2)}
                </pre>
                <ul className="list-disc list-inside text-brand-subtle">
                  {resource.value_scenario.assumptions.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
                <Refs ids={resource.value_scenario.evidence_ids} evidence={resource.evidence} open={open} />
              </div>
            ) : (
              <p className="text-xs text-brand-subtle">
                No supported incremental value in this diagnosis. Confirm terms before quoting.
              </p>
            )}
          </section>

          {/* Relationship Path Graph */}
          {!graph.data ? (
            <Pending error={graph.error} />
          ) : (
            <Suspense fallback={<p role="status" className="text-xs text-brand-subtle">Loading relationship path…</p>}>
              <Graph graph={graph.data} onEvidence={open} />
            </Suspense>
          )}

          {/* Evidence Passages */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-xs">
            <h2 className="text-base font-semibold text-brand-text">Evidence passages</h2>
            <div className="space-y-2 text-xs">
              {resource.evidence.map((e, i) => (
                <details key={i} className="border border-brand-border rounded-md p-3 bg-brand-canvas">
                  <summary className="font-mono font-medium text-brand-blue cursor-pointer select-none">
                    {e.source_external_id ?? e.filename} · {e.field} · {e.filename}:{e.locator}
                  </summary>
                  <blockquote className="my-2 p-2.5 bg-white border-l-2 border-brand-blue font-mono text-[11px] text-gray-700">
                    {e.passage}
                  </blockquote>
                  <button
                    onClick={() => open(e.source_id)}
                    className="h-7 px-3 text-[11px] font-medium border border-brand-border rounded bg-white hover:bg-gray-50 text-brand-text"
                  >
                    Open original record
                  </button>
                </details>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* Unknowns & Limitations */}
      <section className="border border-brand-border rounded-lg p-5 bg-white space-y-2 shadow-xs text-xs">
        <h2 className="text-base font-semibold text-brand-text">Unknowns and limitations</h2>
        <ul className="list-disc list-inside text-brand-subtle space-y-1">
          {[...resource.unknowns, ...resource.limitations].map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </section>

      {/* Source Record Drawer */}
      {source && <Source dataset={dataset} id={source} close={() => setSource('')} />}
    </div>
  );
}

// ================= COMPONENT: FOLLOW-UP DRAFT =================
function Draft({
  dataset,
  kind,
  id,
  options,
  evidence,
  open,
}: {
  dataset: string;
  kind: 'accounts' | 'opportunities';
  id: string;
  options: Record<string, string>;
  evidence: Evidence[];
  open: (id: string) => void;
}) {
  const [language, setLanguage] = useState<'en' | 'id'>('en');
  const [prepared, setPrepared] = useState(false);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');

  const result = useLoad(
    dataset + kind + id + language + prepared + JSON.stringify(options),
    (s) => (prepared ? api.draft(dataset, kind, id, language, options, s) : Promise.resolve(null))
  );

  useEffect(() => {
    setBody(result.data?.body ?? '');
    setSubject(result.data?.subject ?? '');
  }, [result.data]);

  return (
    <section className="border border-brand-border rounded-lg p-5 bg-white space-y-4 shadow-xs text-xs">
      <div>
        <h2 className="text-base font-semibold text-brand-text">Follow-up draft</h2>
        <p className="text-xs text-brand-subtle mt-0.5">
          Template for human review. Confirm recipients and facts; remove internal review notes before use.
        </p>
      </div>

      <div className="flex items-center space-x-3">
        <label className="text-xs font-medium text-brand-text flex items-center space-x-2">
          <span>Template language:</span>
          <select
            aria-label="Template language"
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value as 'en' | 'id');
              setPrepared(false);
              setBody('');
              setSubject('');
            }}
            className="h-8 text-xs border border-brand-border rounded-md px-2.5 bg-white text-brand-text outline-none focus:border-brand-blue"
          >
            <option value="en">English</option>
            <option value="id">Indonesian</option>
          </select>
        </label>

        <button
          onClick={() => setPrepared(true)}
          className="h-8 px-4 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-medium rounded-md shadow-xs transition"
        >
          Prepare draft
        </button>
      </div>

      {prepared && (
        <>
          {!result.data ? (
            <Pending error={result.error} />
          ) : (
            <div className="space-y-3 pt-2 border-t border-brand-border">
              <span className="text-[11px] font-mono bg-blue-50 text-brand-blue px-2 py-0.5 rounded border border-blue-200">
                Human review required · {result.data.method} · {words(result.data.commercial_context)}
              </span>

              <label className="block text-xs font-semibold text-brand-text">
                Editable subject
                <input
                  aria-label="Editable subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1 w-full h-8 text-xs font-mono border border-brand-border rounded-md px-3 bg-white text-brand-text outline-none focus:border-brand-blue"
                />
              </label>

              <label className="block text-xs font-semibold text-brand-text">
                Editable follow-up draft
                <textarea
                  aria-label="Editable follow-up draft"
                  rows={14}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1 w-full text-xs font-mono border border-brand-border rounded-md p-3 bg-white text-brand-text outline-none focus:border-brand-blue leading-relaxed"
                />
              </label>

              <div className="pt-1">
                <Refs ids={result.data.evidence_ids} evidence={evidence} open={open} />
              </div>

              <p className="text-[11px] text-brand-subtle italic">
                Edits remain in this browser view and reset when the account, snapshot, route or language changes.
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
