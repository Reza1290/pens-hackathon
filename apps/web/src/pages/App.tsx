import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AccountDiagnosis, AiCandidateOpportunity, Evidence, OpportunityCard, QaResponse, User } from '@kasirnusa/contracts';
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

const scoped = (path: string, dataset: string, extra?: Record<string, string>) => {
  const params = new URLSearchParams({ dataset_id: dataset, ...extra });
  return path + '?' + params.toString();
};

interface RecentAccount {
  id: string;
  externalId: string;
  name: string;
  type?: string;
}

const RECENTS_KEY = 'kasirnusa_recents_v1';

function getStoredRecents(): RecentAccount[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function storeRecent(account: RecentAccount) {
  try {
    const current = getStoredRecents().filter((a) => a.id !== account.id);
    const updated = [account, ...current].slice(0, 8);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

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
  const currentAccountId =
    query.get('account_id') ??
    (location.pathname.startsWith('/accounts/') ? location.pathname.split('/')[2] : '');

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

  // Recents accordion state & localStorage sync
  const [recentsOpen, setRecentsOpen] = useState(true);
  const [recentAccounts, setRecentAccounts] = useState<RecentAccount[]>(() => getStoredRecents());

  useEffect(() => {
    const handleUpdate = () => setRecentAccounts(getStoredRecents());
    window.addEventListener('recents_updated', handleUpdate);
    return () => window.removeEventListener('recents_updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (accounts.data?.items?.length && getStoredRecents().length === 0) {
      const initial = accounts.data.items.slice(0, 3).map((a) => ({
        id: a.id,
        externalId: a.externalId,
        name: a.name,
        type: a.type,
      }));
      try {
        localStorage.setItem(RECENTS_KEY, JSON.stringify(initial));
        setRecentAccounts(initial);
      } catch {}
    }
  }, [accounts.data?.items]);

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
    <div className="h-screen max-h-screen flex flex-col overflow-hidden bg-white text-brand-text">
      <a className="skip" href="#main">
        Skip to content
      </a>

      {/* ================= TOP GLOBAL HEADER (56px / h-14) ================= */}
      <header className="h-14 border-b border-brand-border bg-white flex items-center justify-between shrink-0 select-none z-30">
        {/* Header Left: Exactly aligns with 272px sidebar on desktop */}
        <div className="w-auto md:w-[272px] h-full md:border-r border-brand-border flex items-center justify-between px-3 md:px-3.5 shrink-0 bg-white">
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            {/* Brand Logo: KasirNusa Triangle */}
            <Link
              to={scoped('/', selected)}
              className="flex items-center text-brand-orange hover:opacity-90 transition shrink-0"
              title="KasirNusa Expansion Workbench"
            >
              <svg className="w-5.5 h-5.5 text-brand-orange shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 19.5h20L12 2zm0 4.2l6.5 11.3H5.5L12 6.2z" />
              </svg>
            </Link>            {/* TOP LEFT SWITCH ACCOUNT: Single Source of Truth for Customer Account Scope */}
            <div className="relative flex-1 min-w-0">
              <div className="h-9 flex items-center space-x-2 text-xs text-brand-text bg-gray-50/80 border border-brand-border hover:border-gray-400 px-3 py-1.5 rounded-md transition min-w-0 shadow-2xs">
                <span className="font-semibold text-[12px] tracking-tight text-gray-800 truncate">
                  {activeAccount ? `${activeAccount.externalId} · ${activeAccount.name}` : 'All Accounts (Global)'}
                </span>
                <svg className="w-3.5 h-3.5 text-gray-400 shrink-0 ml-auto pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>

                {/* Accessible native select overlay matching Playwright role */}
                <select
                  aria-label="Investigate account"
                  value={currentAccountId}
                  onChange={(e) => {
                    const targetId = e.target.value;
                    if (targetId) {
                      const acc = accounts.data?.items.find((a) => a.id === targetId);
                      if (acc) {
                        storeRecent({
                          id: acc.id,
                          externalId: acc.externalId,
                          name: acc.name,
                          type: acc.type,
                        });
                        window.dispatchEvent(new Event('recents_updated'));
                      }
                    }

                    if (location.pathname === '/copilot') {
                      navigate(
                        scoped(
                          '/copilot',
                          selected,
                          targetId ? { account_id: targetId } : undefined
                        )
                      );
                    } else if (targetId) {
                      navigate(scoped('/accounts/' + targetId, selected));
                    } else {
                      navigate(scoped('/', selected));
                    }
                  }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                >
                  <option value="">All Accounts (Global)</option>
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

        {/* Right Header: Minimal User Profile */}
        <div className="flex items-center px-3 md:px-4 shrink-0">
          {/* User Account Menu (Minimal, Logout Only) */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="h-8 flex items-center space-x-2 px-2.5 rounded-md hover:bg-gray-100 border border-brand-border text-brand-text transition text-xs"
              title="User Account"
            >
              <div className="w-5 h-5 rounded-full bg-brand-blue text-white text-[10px] flex items-center justify-center font-bold">
                {currentUser.name[0]}
              </div>
              <span className="text-[11px] font-medium hidden sm:inline">{currentUser.name}</span>
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {userDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserDropdownOpen(false)} />
                <div className="absolute right-0 mt-1 w-52 bg-white border border-brand-border rounded-lg shadow-dropdown p-1.5 z-50 text-xs">
                  <div className="px-2.5 py-2 border-b border-brand-border mb-1">
                    <div className="font-semibold text-brand-text truncate">{currentUser.name}</div>
                    <div className="text-[11px] text-brand-subtle truncate">{currentUser.email}</div>
                    <div className="text-[10px] font-mono text-brand-blue mt-0.5 capitalize">{currentUser.role.replace('_', ' ')}</div>
                  </div>

                  <Link
                    to={scoped('/settings', selected)}
                    onClick={() => setUserDropdownOpen(false)}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-gray-50 text-brand-text flex items-center space-x-2 transition text-xs"
                  >
                    <svg className="w-3.5 h-3.5 text-brand-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Settings & Snapshot</span>
                  </Link>

                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      alert('Signed out successfully.');
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-red-50 text-red-600 flex items-center space-x-2 transition text-xs font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign out</span>
                  </button>
                </div>
              </>
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
            <div className="h-9 flex items-center bg-white border border-brand-border rounded-md px-2.5 text-brand-subtle focus-within:border-brand-blue focus-within:ring-1 focus-within:ring-brand-blue/20 transition shadow-2xs">
              <svg className="w-3.5 h-3.5 mr-2 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Quick search..."
                className="w-full min-w-0 bg-transparent text-xs text-brand-text placeholder-gray-400 outline-none pr-1.5"
              />
              <span className="shrink-0 whitespace-nowrap text-[10px] text-gray-400 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded font-mono leading-none">
                Ctrl K
              </span>
            </div>
          </div>

          {/* Navigation Tree */}
          <nav className="flex-1 px-2 space-y-1">
            {/* Dashboard / Opportunities */}
            <Link
              to={scoped('/', selected)}
              className={`w-full h-9 flex items-center px-2.5 rounded-md transition text-left text-xs ${
                isOpportunitiesRoot && !currentAccountId
                  ? 'bg-gray-200/70 text-brand-text font-medium'
                  : 'text-brand-muted hover:text-brand-text hover:bg-gray-100'
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-2.5">
                <svg className="w-4 h-4 text-brand-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </span>
              <span>Dashboard</span>
            </Link>

            {/* Account Copilot (Dedicated Full-Page) */}
            <Link
              to={scoped('/copilot', selected, currentAccountId ? { account_id: currentAccountId } : undefined)}
              className={`w-full h-9 flex items-center px-2.5 rounded-md transition text-left text-xs ${
                location.pathname === '/copilot'
                  ? 'bg-gray-200/70 text-brand-text font-medium'
                  : 'text-brand-muted hover:text-brand-text hover:bg-gray-100'
              }`}
            >
              <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-2.5">
                <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </span>
              <span>Account Copilot</span>
            </Link>

            {/* FOLDABLE RECENTS ACCORDION */}
            <div className="pt-0.5">
              <button
                onClick={() => setRecentsOpen(!recentsOpen)}
                className="w-full h-9 flex items-center justify-between px-2.5 rounded-md text-brand-muted hover:text-brand-text hover:bg-gray-100 transition text-left text-xs group"
              >
                <span className="flex items-center min-w-0">
                  <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-2.5">
                    <svg className="w-4 h-4 text-brand-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <span>Recents</span>
                </span>
                <svg
                  className={`w-3.5 h-3.5 text-gray-400 chevron-icon shrink-0 ${recentsOpen ? 'chevron-down-rotated' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div className={`accordion-content ${recentsOpen ? 'open' : ''}`}>
                <div className="accordion-inner ml-4 pl-2.5 border-l border-brand-border space-y-1 py-1">
                  {recentAccounts.length === 0 ? (
                    <div className="text-[11px] text-brand-subtle py-1">No recent accounts</div>
                  ) : (
                    recentAccounts.map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => {
                          if (location.pathname === '/copilot') {
                            navigate(scoped('/copilot', selected, { account_id: rec.id }));
                          } else {
                            navigate(scoped('/accounts/' + rec.id, selected));
                          }
                        }}
                        className="cursor-pointer group py-1"
                      >
                        <div className="text-[12px] text-gray-800 font-medium group-hover:text-brand-blue transition truncate">
                          {rec.externalId} · {rec.name}
                        </div>
                        {rec.type && (
                          <div className="text-[10px] text-gray-400 leading-tight truncate">
                            {rec.type}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Management Category */}
            <div className="pt-2 px-2.5 text-[10px] font-semibold tracking-wider text-gray-400 uppercase">
              Management
            </div>

            {/* Users */}
            <Link
              to={scoped('/users', selected)}
              className={`w-full h-9 flex items-center justify-between px-2.5 rounded-md transition text-left text-xs ${
                location.pathname === '/users'
                  ? 'bg-gray-200/70 text-brand-text font-medium'
                  : 'text-brand-muted hover:text-brand-text hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center">
                <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-2.5">
                  <svg className="w-4 h-4 text-brand-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </span>
                <span>Users</span>
              </span>
              <span className="text-[10px] font-mono text-gray-400">4 seats</span>
            </Link>

            {/* Settings Menu Item */}  
            <Link
              to={scoped('/settings', selected)}
              className={`w-full h-9 flex items-center justify-between px-2.5 rounded-md transition text-left text-xs ${
                location.pathname === '/settings'
                  ? 'bg-gray-200/70 text-brand-text font-medium'
                  : 'text-brand-muted hover:text-brand-text hover:bg-gray-100'
              }`}
            >
              <span className="flex items-center">
                <span className="w-4 h-4 flex items-center justify-center shrink-0 mr-2.5">
                  <svg className="w-4 h-4 text-brand-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </span>
                <span>Settings</span>
              </span>
            </Link>
          </nav>
        </aside>

        {/* ================= MAIN VIEW AREA ================= */}
        <main
          id="main"
          key={selected}
          className={`flex-1 ${
            location.pathname === '/copilot' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'
          } bg-white px-4 md:px-8 py-4 md:py-6 max-w-full`}
        >
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
                  path="/copilot"
                  element={
                    <CopilotView
                      dataset={selected}
                      currentAccountId={currentAccountId}
                      accounts={accounts.data?.items ?? []}
                    />
                  }
                />
                <Route path="/users" element={<UsersView currentUser={currentUser} onSwitchUser={setCurrentUser} />} />
                <Route path="/settings" element={<SettingsView selected={selected} datasets={datasets} />} />
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
      <footer className="h-8 border-t border-brand-border bg-brand-canvas px-4 flex items-center justify-between text-[11px] text-brand-subtle select-none shrink-0 sticky bottom-0 z-30">
        <span>KasirNusa Account Expansion Assistant · Historical snapshot</span>
        <span>Proposed actions for human review · CRM writes disabled</span>
      </footer>
    </div>
  );
}

// ================= COMPONENT: COPILOT RELATIONSHIP GRAPH VIEWER =================
function CopilotGraphViewer({
  dataset,
  accountId,
  openSource,
}: {
  dataset: string;
  accountId: string;
  openSource: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const graph = useLoad(
    open ? 'graph:' + dataset + 'accounts' + accountId : '',
    (s) => (open ? api.graph(dataset, 'accounts', accountId, s) : Promise.resolve(null))
  );

  return (
    <div className="border border-brand-border rounded-lg bg-gray-50/60 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-xs font-semibold text-brand-text">Context Relationship Graph</span>
          {graph.data && (
            <span className="text-[10px] font-mono text-gray-500 bg-white border border-gray-200 px-1.5 py-0.5 rounded">
              {graph.data.nodes.length} nodes · {graph.data.edges.length} edges
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-7 px-2.5 text-[11px] font-medium border border-brand-border rounded bg-white hover:bg-gray-50 text-brand-text flex items-center space-x-1.5 transition shadow-2xs"
        >
          <span>{open ? 'Hide Context Graph' : 'View Context Graph'}</span>
          <svg
            className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="pt-2">
          {!graph.data ? (
            <Pending error={graph.error} />
          ) : (
            <Suspense fallback={<p className="text-xs text-brand-subtle py-4 text-center">Rendering relationship network…</p>}>
              <div className="rounded-lg overflow-hidden border border-brand-border bg-white shadow-2xs">
                <Graph graph={graph.data} onEvidence={openSource} />
              </div>
            </Suspense>
          )}
        </div>
      )}
    </div>
  );
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-0.5 bg-white hover:bg-gray-50 border border-brand-border rounded text-brand-text transition shrink-0 select-none cursor-pointer"
    >
      {copied ? (
        <span className="text-emerald-600 font-semibold">✓ Copied</span>
      ) : (
        <>
          <svg className="w-3 h-3 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

// ================= VIEW: ACCOUNT COPILOT (STANDALONE FULL-PAGE CHAT) =================
interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  response?: QaResponse;
  accountContext?: string;
}

function CopilotView({
  dataset,
  currentAccountId,
  accounts,
}: {
  dataset: string;
  currentAccountId?: string;
  accounts: Array<{ id: string; externalId: string; name: string; type: string }>;
}) {
  const [language, setLanguage] = useState<'en' | 'id'>('en');
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [source, setSource] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeAccount = accounts.find((a) => a.id === currentAccountId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Clear conversation state when switching account scope
  useEffect(() => {
    setMessages([]);
    setError('');
    setInputQuestion('');
  }, [currentAccountId]);

  const handleSend = async (qText?: string) => {
    const textToSend = qText ?? inputQuestion;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      accountContext: activeAccount ? `${activeAccount.externalId} · ${activeAccount.name}` : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);
    setError('');

    try {
      const recentHistory = messages
        .filter((m) => m.sender === 'user')
        .slice(-3)
        .map((m) => ({ question: m.text }));

      const res = await api.qa({
        dataset_id: dataset,
        account_id: currentAccountId || undefined,
        question: textToSend,
        language,
        history: recentHistory,
        route: 'joint',
      });

      const assistantMsg: ChatMessage = {
        id: 'msg_res_' + Date.now(),
        sender: 'assistant',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        response: res,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setError(err.message || 'Copilot query failed');
    } finally {
      setLoading(false);
    }
  };

  const sampleQuestions = activeAccount
    ? [
        `Apa yang belum ditindaklanjuti untuk ${activeAccount.externalId}?`,
        `Siapa yang perlu dilibatkan untuk ${activeAccount.externalId}, dan apa buktinya?`,
        `Kalau ${activeAccount.externalId} tambah 10 outlet, berapa nilai tahunannya?`,
        `Apakah follow-up terakhir sudah menjawab kekhawatiran decision maker?`,
      ]
    : [
        'Pelanggan mana yang punya peluang ekspansi?',
        'Apa yang belum ditindaklanjuti untuk C06?',
        'Siapa yang perlu dilibatkan untuk C01, dan apa buktinya?',
        'Kalau C06 tambah 10 outlet, berapa nilai tahunannya?',
      ];

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-5xl mx-auto w-full">
      {/* Header - Styled consistently with other views */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 mb-3 border-b border-brand-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-text">Account Copilot</h1>
          <p className="text-xs text-brand-subtle mt-0.5">
            {activeAccount
              ? `Scoped to ${activeAccount.externalId} · ${activeAccount.name}. Ask questions about expansion signals, unaddressed requirements, or revenue scenarios.`
              : 'Ask questions about expansion signals, unaddressed requirements, stakeholder authority, or revenue scenarios.'}
          </p>
        </div>

        {/* Header Right: Language Switch */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex border border-brand-border rounded-md overflow-hidden text-xs">
            <button
              onClick={() => setLanguage('en')}
              className={`h-8 px-2.5 transition ${language === 'en' ? 'bg-brand-blue text-white font-medium' : 'bg-white text-brand-muted hover:text-brand-text'}`}
            >
              EN
            </button>
            <button
              onClick={() => setLanguage('id')}
              className={`h-8 px-2.5 transition ${language === 'id' ? 'bg-brand-blue text-white font-medium' : 'bg-white text-brand-muted hover:text-brand-text'}`}
            >
              ID
            </button>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-5">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200 flex items-center justify-center text-brand-orange shadow-2xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>

            <div className="space-y-1 max-w-md">
              <h3 className="text-sm font-semibold text-brand-text">What would you like to investigate?</h3>
              <p className="text-xs text-brand-subtle">
                Ask questions about expansion signals, unaddressed requirements, stakeholder authority, or revenue scenarios.
              </p>
            </div>

            {/* Quick Prompt Chips */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full text-left">
              {sampleQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="p-2.5 rounded-lg border border-brand-border hover:border-brand-blue/60 bg-white hover:bg-blue-50/50 text-xs text-brand-text transition flex items-start space-x-2 text-left shadow-2xs group"
                >
                  <span className="text-brand-blue shrink-0 group-hover:translate-x-0.5 transition-transform">→</span>
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'} space-y-1`}>
              {/* Message Header */}
              <div className="flex items-center space-x-1.5 text-[10px] text-brand-subtle px-1">
                <span className="font-medium text-brand-text">{m.sender === 'user' ? 'You' : 'KasirNusa Copilot'}</span>
                {m.accountContext && (
                  <span className="font-mono bg-gray-100 text-gray-600 px-1.5 rounded">
                    Scope: {m.accountContext}
                  </span>
                )}
                <span>· {m.timestamp}</span>
              </div>

              {/* Message Bubble */}
              {m.sender === 'user' ? (
                <div className="max-w-[85%] bg-blue-50 text-brand-text border border-blue-200/80 rounded-xl px-4 py-2.5 text-xs shadow-2xs">
                  {m.text}
                </div>
              ) : (() => {
                  const claims = m.response?.claims ?? [];
                  const actionClaims = claims.filter((c) => c.kind === 'proposed_action');
                  const diagnosticClaims = claims.filter((c) => c.kind === 'check');
                  const factClaims = claims.filter((c) => c.kind === 'fact' || c.kind === 'source_quote');

                  return (
                    <div className="max-w-[98%] bg-white border border-brand-border rounded-xl p-4 sm:p-5 space-y-4 text-xs shadow-2xs w-full">
                      {/* Header Row: Executive Telemetry Ribbon */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-brand-border">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {m.response?.commercial_context && (
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase tracking-wider border ${
                              m.response.commercial_context === 'expansion'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                : m.response.commercial_context === 'renewal'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-blue-50 text-brand-blue border-blue-300'
                            }`}>
                              {m.response.commercial_context === 'expansion'
                                ? '🚀 Expansion'
                                : m.response.commercial_context === 'renewal'
                                ? '🔄 Renewal'
                                : m.response.commercial_context}
                            </span>
                          )}
                          {m.response?.value_scenario && (
                            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-bold">
                              ARR: {amount(m.response.value_scenario.amount)} IDR
                            </span>
                          )}
                          {diagnosticClaims.some((c) => /no matching|unmatched/i.test(c.text)) && (
                            <span className="text-[10px] font-mono bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded font-medium">
                              ⚠️ Unmatched CRM
                            </span>
                          )}
                          {diagnosticClaims.some((c) => /no recorded follow-up/i.test(c.text)) && (
                            <span className="text-[10px] font-mono bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                              ⏱️ Follow-up Pending
                            </span>
                          )}
                          {m.response?.plan && (
                            <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                              {m.response.plan.operation.replaceAll('_', ' ')}
                            </span>
                          )}
                        </div>
                        {m.response?.as_of && (
                          <span className="text-[10px] font-mono text-brand-subtle">
                            Snapshot: {m.response.as_of}
                          </span>
                        )}
                      </div>

                      {/* Executive Summary Card */}
                      <div className="p-3.5 bg-brand-canvas/70 border border-brand-border rounded-lg space-y-1">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-subtle flex items-center space-x-1.5">
                          <svg className="w-3.5 h-3.5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>Executive Summary</span>
                        </div>
                        <div className="text-brand-text leading-relaxed whitespace-pre-line text-xs font-medium">
                          {m.text}
                        </div>
                      </div>

                      {/* Commercial Value Tile (if present) */}
                      {m.response?.value_scenario && (
                        <div className="p-3.5 bg-emerald-50/60 border border-emerald-300 rounded-lg space-y-2 text-xs shadow-2xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                              <svg className="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Commercial Revenue Scenario</span>
                            </div>
                            <span className="text-[10px] font-mono bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-semibold">
                              Conditional Incremental ARR
                            </span>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                            <div className="text-xl font-bold font-mono text-emerald-800">
                              {amount(m.response.value_scenario.amount)} IDR <span className="text-xs font-normal text-emerald-700">/ year</span>
                            </div>
                            <div className="text-[11px] font-mono text-emerald-700 bg-white/90 border border-emerald-200 px-2 py-0.5 rounded">
                              {m.response.value_scenario.formula}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                            <div className="p-2 bg-white rounded border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] text-gray-500 block uppercase font-mono">Additional Outlets</span>
                              <span className="font-bold font-mono text-brand-text">{m.response.value_scenario.inputs.additional_outlets} Outlets</span>
                            </div>
                            <div className="p-2 bg-white rounded border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] text-gray-500 block uppercase font-mono">Monthly Rate / Outlet</span>
                              <span className="font-bold font-mono text-brand-text">{amount(m.response.value_scenario.inputs.monthly_rate)} IDR</span>
                            </div>
                            <div className="p-2 bg-white rounded border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] text-gray-500 block uppercase font-mono">Discount Rate</span>
                              <span className="font-bold font-mono text-brand-text">{m.response.value_scenario.inputs.discount_percent}%</span>
                            </div>
                          </div>

                          {m.response.value_scenario.assumptions.length > 0 && (
                            <div className="text-[10px] text-emerald-900/80 pt-1 space-y-0.5">
                              <span className="font-semibold uppercase tracking-wider">Assumptions:</span>
                              <ul className="list-disc list-inside">
                                {m.response.value_scenario.assumptions.map((a, idx) => (
                                  <li key={idx}>{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Observed Gaps & Diagnostic Checks */}
                      {diagnosticClaims.length > 0 && (
                        <div className="border border-brand-border rounded-lg bg-white overflow-hidden shadow-2xs">
                          <div className="flex items-center justify-between px-3.5 py-2.5 bg-amber-50/50 border-b border-amber-200/80">
                            <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-950">
                              <svg className="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span>Observed Gaps & Recorded Constraints</span>
                            </div>
                            <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-amber-200 text-amber-900 font-medium">
                              {diagnosticClaims.length} items checked
                            </span>
                          </div>
                          <div className="p-3 space-y-2">
                            {diagnosticClaims.map((claim) => {
                              const isWarning = /no matching|no recorded|unfulfilled|unmet|mismatch|conflict|cannot/i.test(claim.text);
                              return (
                                <div
                                  key={claim.id}
                                  className={`p-2.5 rounded-md border text-xs space-y-1.5 ${
                                    isWarning ? 'bg-amber-50/30 border-amber-200' : 'bg-gray-50/50 border-gray-200'
                                  }`}
                                >
                                  <div className="flex items-start space-x-2">
                                    <span className={`mt-0.5 shrink-0 ${isWarning ? 'text-amber-600 font-bold' : 'text-blue-500'}`}>
                                      {isWarning ? '⚠️' : 'ℹ️'}
                                    </span>
                                    <div className="flex-1">
                                      <p className="text-brand-text font-medium leading-relaxed">{claim.text}</p>
                                    </div>
                                  </div>
                                  {claim.evidence_ids.length > 0 && (
                                    <div className="pl-6 pt-0.5">
                                      <Refs ids={claim.evidence_ids} evidence={m.response?.evidence ?? []} open={(id) => setSource(id)} />
                                    </div>
                                  )}
                                  {claim.check && (
                                    <details className="pl-6 text-[10px] text-gray-500">
                                      <summary className="cursor-pointer hover:text-brand-text font-medium select-none">
                                        Inspect recorded check criteria
                                      </summary>
                                      <pre className="mt-1 font-mono text-[9px] bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                                        {JSON.stringify(claim.check, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Recommended Sales Action Plan */}
                      {actionClaims.length > 0 && (
                        <div className="border border-blue-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                          <div className="flex items-center justify-between px-3.5 py-2.5 bg-blue-50/70 border-b border-blue-200">
                            <div className="flex items-center space-x-1.5 text-xs font-semibold text-brand-text">
                              <svg className="w-4 h-4 text-brand-blue shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>Recommended Sales Action Plan</span>
                            </div>
                            <CopyButton
                              text={actionClaims.map((c, i) => `${i + 1}. ${c.text}`).join('\n')}
                              label="Copy Action Plan"
                            />
                          </div>
                          <div className="p-3 space-y-2">
                            {actionClaims.map((claim, idx) => (
                              <div key={claim.id} className="p-3 bg-blue-50/20 border border-blue-100 rounded-md text-xs space-y-1.5">
                                <div className="flex items-start space-x-2.5">
                                  <span className="h-5 w-5 rounded-full bg-brand-blue text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                    {idx + 1}
                                  </span>
                                  <div className="flex-1 space-y-1">
                                    <p className="text-brand-text font-medium leading-relaxed">{claim.text}</p>
                                    {claim.evidence_ids.length > 0 && (
                                      <div className="pt-0.5">
                                        <Refs ids={claim.evidence_ids} evidence={m.response?.evidence ?? []} open={(id) => setSource(id)} />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Question Premise Notice (if checking outcome questions) */}
                      {m.response?.premise_check && (
                        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-amber-900 text-xs">
                              Question Premise: {words(m.response.premise_check.status)}
                            </h4>
                            <span className="text-[10px] font-mono bg-amber-100/80 px-2 py-0.5 rounded text-amber-900 border border-amber-200 font-medium uppercase">
                              {m.response.premise_check.status}
                            </span>
                          </div>
                          <p className="text-amber-800 leading-relaxed">{m.response.premise_check.coverage}</p>
                          {m.response.premise_check.clarification && (
                            <p className="text-amber-800 leading-relaxed">{m.response.premise_check.clarification}</p>
                          )}
                          {m.response.premise_check.calculation && (
                            <pre className="font-mono text-[10px] bg-white/90 p-2.5 rounded border border-amber-200 text-amber-950 overflow-x-auto">
                              {JSON.stringify(m.response.premise_check.calculation, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Requirement Assessments (if present) */}
                      {m.response?.requirement_assessments && m.response.requirement_assessments.length > 0 && (
                        <div className="space-y-2 pt-1 border-t border-brand-border">
                          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-subtle">
                            Requirement Assessments
                          </div>
                          <div className="space-y-2">
                            {m.response.requirement_assessments.map((a) => (
                              <article key={a.id} className="border border-brand-border rounded-lg p-3 bg-white text-xs space-y-1.5 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-brand-text">{a.requirement}</span>
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-700 border border-gray-200 uppercase font-medium">
                                    {a.status.replaceAll('_', ' ')}
                                  </span>
                                </div>
                                <p className="text-brand-subtle text-[11px]">
                                  Fulfillment: {a.fulfillment.status.replaceAll('_', ' ')}. {a.fulfillment.reason}
                                </p>
                                {a.missing_details.length > 0 && (
                                  <p className="text-brand-subtle text-[11px]">
                                    Missing: {a.missing_details.join(', ')}
                                  </p>
                                )}
                                <div className="pt-0.5">
                                  <Refs ids={a.source_ids} evidence={m.response?.evidence ?? []} open={(id) => setSource(id)} />
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Follow-up Draft if present */}
                      {m.response?.draft && (
                        <div className="p-3.5 bg-gray-50 border border-brand-border rounded-lg space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center space-x-1.5 font-semibold text-brand-text">
                              <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              <span>Ready-to-Send Follow-Up Draft ({m.response.draft.route} route)</span>
                            </div>
                            <CopyButton
                              text={`Subject: ${m.response.draft.subject}\n\n${m.response.draft.body}`}
                              label="Copy Draft"
                            />
                          </div>
                          <div className="text-[11px] text-brand-text font-medium bg-white px-3 py-1.5 rounded border border-gray-200">
                            <span className="text-gray-400 font-mono mr-1.5">Subject:</span> {m.response.draft.subject}
                          </div>
                          <div className="text-xs text-brand-muted bg-white p-3 rounded border border-gray-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed shadow-2xs">
                            {m.response.draft.body}
                          </div>
                        </div>
                      )}

                      {/* Verified Account Context & Stakeholder Facts */}
                      {factClaims.length > 0 && (
                        <details className="border border-brand-border rounded-lg bg-gray-50/40 p-3 space-y-2 text-xs">
                          <summary className="font-semibold text-brand-text cursor-pointer select-none flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <svg className="w-3.5 h-3.5 text-brand-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                              <span>Verified Stakeholder & Baseline Context ({factClaims.length})</span>
                            </span>
                            <span className="text-[10px] font-mono text-brand-subtle font-normal">Click to toggle</span>
                          </summary>
                          <div className="space-y-1.5 pt-2">
                            {factClaims.map((claim) => (
                              <div key={claim.id} className="p-2.5 bg-white border border-brand-border rounded text-xs space-y-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-brand-text font-normal leading-relaxed">{claim.text}</p>
                                  {claim.kind === 'source_quote' && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded shrink-0">
                                      Direct Quote
                                    </span>
                                  )}
                                </div>
                                {claim.evidence_ids.length > 0 && (
                                  <Refs ids={claim.evidence_ids} evidence={m.response?.evidence ?? []} open={(id) => setSource(id)} />
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Context Relationship Graph (Cytoscape Nodes & Edges) */}
                      {(m.response?.account_id || currentAccountId) && (
                        <CopilotGraphViewer
                          dataset={dataset}
                          accountId={(m.response?.account_id ?? currentAccountId)!}
                          openSource={(id) => setSource(id)}
                        />
                      )}

                      {/* Cited Evidence Passages */}
                      {m.response?.evidence && m.response.evidence.length > 0 && (
                        <details className="border border-brand-border rounded-lg bg-gray-50/50 p-3 space-y-2 text-xs">
                          <summary className="font-semibold text-brand-text cursor-pointer select-none flex items-center justify-between">
                            <span className="flex items-center space-x-1.5">
                              <svg className="w-3.5 h-3.5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>Cited Evidence Passages ({m.response.evidence.length})</span>
                            </span>
                            <span className="text-[10px] font-mono text-brand-subtle font-normal">Click to expand</span>
                          </summary>
                          <div className="space-y-2 pt-2">
                            {m.response.evidence.map((e, idx) => (
                              <div key={idx} className="p-2.5 bg-white border border-brand-border rounded-md space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-mono text-brand-blue">
                                  <span>{e.source_external_id ?? e.filename} · {e.field}</span>
                                  <span className="text-gray-400">{e.filename}:{e.locator}</span>
                                </div>
                                <blockquote className="p-2 bg-gray-50 border-l-2 border-brand-blue text-[11px] font-mono text-gray-700 whitespace-pre-wrap">
                                  {e.passage}
                                </blockquote>
                                <div className="pt-1 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setSource(e.source_id)}
                                    className="h-6 px-2.5 text-[10px] font-medium border border-brand-border rounded bg-white hover:bg-gray-100 text-brand-text transition"
                                  >
                                    Open original record
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {/* Method Limitations */}
                      {m.response?.limitations && m.response.limitations.length > 0 && (
                        <div className="text-[11px] text-brand-subtle border-t border-dashed border-brand-border pt-2 space-y-0.5">
                          <span className="font-semibold text-gray-500">Method limitations:</span>
                          <ul className="list-disc list-inside">
                            {m.response.limitations.map((lim, i) => (
                              <li key={i}>{lim}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center space-x-2 p-3 text-xs text-brand-subtle bg-gray-50 rounded-lg animate-pulse border border-brand-border">
            <svg className="w-4 h-4 text-brand-orange animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Retrieving context graph & synthesizing cited response…</span>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <span className="font-semibold">Error:</span> {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Sticky Input Bar */}
      <div className="pt-3 border-t border-brand-border shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2 bg-white border border-brand-border rounded-lg p-1.5 shadow-2xs focus-within:border-brand-blue focus-within:ring-1 focus-within:ring-brand-blue/20"
        >
          <input
            type="text"
            placeholder={
              activeAccount
                ? `Ask about ${activeAccount.externalId} (${activeAccount.name})…`
                : 'Ask about any expansion opportunity, blocker, or stakeholder…'
            }
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent px-2 text-xs text-brand-text placeholder-gray-400 outline-none min-w-0"
          />
          <button
            type="submit"
            disabled={!inputQuestion.trim() || loading}
            className="h-8 px-4 bg-brand-blue hover:bg-brand-blue-hover disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-md transition shrink-0 flex items-center space-x-1"
          >
            <span>Send</span>
            <span>↵</span>
          </button>
        </form>
      </div>

      {source && <Source dataset={dataset} id={source} close={() => setSource('')} />}
    </div>
  );
}

// ================= VIEW: USERS & RBAC =================
function UsersView({
  currentUser,
  onSwitchUser,
}: {
  currentUser: User;
  onSwitchUser: (u: User) => void;
}) {
  const usersList: Array<{
    id: string;
    name: string;
    email: string;
    role: 'account_manager' | 'sales_rep' | 'admin';
    externalId: string | null;
    accounts: string;
  }> = [
    {
      id: 'e0400000-0000-4000-8000-000000000001',
      name: 'Wahyu Setiawan',
      email: 'wahyu@kasirnusa.id',
      role: 'account_manager',
      externalId: 'E04',
      accounts: 'C06 (Bakmi GM), C02 (Kopi Janji Jiwa)',
    },
    {
      id: 'e0100000-0000-4000-8000-000000000001',
      name: 'Andi Prasetyo',
      email: 'andi@kasirnusa.id',
      role: 'account_manager',
      externalId: 'E01',
      accounts: 'C01 (Kopi Kenangan)',
    },
    {
      id: 'e0200000-0000-4000-8000-000000000001',
      name: 'Sari Wulandari',
      email: 'sari@kasirnusa.id',
      role: 'sales_rep',
      externalId: 'E02',
      accounts: 'P01 (Warung Pintar), P04 (Kulo Group)',
    },
    {
      id: '00000000-0000-4000-8000-admin0000001',
      name: 'Administrator',
      email: 'admin@kasirnusa.id',
      role: 'admin',
      externalId: null,
      accounts: 'All Accounts (Tenant Supervisor)',
    },
  ];

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-brand-subtle mb-1">
          <span>Workbench</span>
          <span>/</span>
          <span>Management</span>
          <span>/</span>
          <span className="text-brand-text font-medium">Users</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-text">Users & Team Access</h1>
        <p className="text-xs text-brand-subtle mt-1 leading-relaxed">
          Manage team members, assigned accounts, and role-based permissions (RBAC).
        </p>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-brand-border rounded-xl shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-brand-border flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs font-semibold text-brand-text">Active Team Members</span>
          </div>
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
            4 of 10 Seats Provisioned
          </span>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50 border-b border-brand-border text-brand-subtle text-[11px] font-medium uppercase">
            <tr>
              <th className="py-2.5 px-4">User</th>
              <th className="py-2.5 px-3">Role</th>
              <th className="py-2.5 px-3">Assigned Accounts</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-4 text-right">Active Session</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usersList.map((u) => {
              const isActive = currentUser.email === u.email;
              return (
                <tr key={u.email} className={`hover:bg-gray-50 transition ${isActive ? 'bg-blue-50/40' : ''}`}>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-6 h-6 rounded-full bg-brand-blue text-white text-[10px] flex items-center justify-center font-bold shrink-0">
                        {u.name[0]}
                      </div>
                      <div>
                        <div className="font-semibold text-brand-text">{u.name}</div>
                        <div className="text-[11px] text-brand-subtle font-mono">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium capitalize bg-gray-100 text-gray-700 border border-gray-200">
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-brand-muted text-[11px] font-mono">
                    {u.accounts}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Active
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {isActive ? (
                      <span className="text-[11px] font-semibold text-brand-blue flex items-center justify-end space-x-1">
                        <span>● Current User</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          onSwitchUser({
                            id: u.id,
                            email: u.email,
                            name: u.name,
                            employee_external_id: u.externalId,
                            role: u.role,
                            is_active: true,
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString(),
                          });
                        }}
                        className="h-7 px-2.5 bg-white border border-brand-border hover:bg-gray-50 text-brand-text rounded text-[11px] transition"
                      >
                        Switch Persona
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* RBAC Policy Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-brand-border rounded-xl space-y-1.5">
          <div className="text-xs font-semibold text-brand-text">Account Manager</div>
          <p className="text-[11px] text-brand-subtle leading-relaxed">
            Full view of assigned customer accounts, expansion discovery, action plan drafting, and stakeholder requirement matrix.
          </p>
        </div>
        <div className="p-4 bg-white border border-brand-border rounded-xl space-y-1.5">
          <div className="text-xs font-semibold text-brand-text">Sales Representative</div>
          <p className="text-[11px] text-brand-subtle leading-relaxed">
            Prospect account routing, customer referral pathways (e.g. C06 to P04), and pipeline gap diagnosis.
          </p>
        </div>
        <div className="p-4 bg-white border border-brand-border rounded-xl space-y-1.5">
          <div className="text-xs font-semibold text-brand-text">Administrator</div>
          <p className="text-[11px] text-brand-subtle leading-relaxed">
            Snapshot partition switching, database verification, LLM execution budgets, and full context graph telemetry.
          </p>
        </div>
      </div>
    </section>
  );
}

// ================= VIEW: SYSTEM & USER SETTINGS =================
function SettingsView({
  selected,
  datasets,
}: {
  selected: string;
  datasets: Array<{ id: string; version: string; asOf: string; analyzedAt?: string }>;
}) {
  const navigate = useNavigate();
  const currentDataset = datasets.find((d) => d.id === selected) ?? datasets[0];
  const [copiedKey, setCopiedKey] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText('kn_live_usr_9981f4a9b2fc7701e82844a');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <section className="space-y-6 max-w-4xl mx-auto">
      {/* Page Title & Breadcrumbs */}
      <div>
        <div className="flex items-center space-x-2 text-xs text-brand-subtle mb-1">
          <Link to={scoped('/', selected)} className="hover:text-brand-text">
            Workbench
          </Link>
          <span>/</span>
          <span className="text-brand-text font-medium">Settings</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-brand-text">Settings & Configuration</h1>
        <p className="text-xs text-brand-subtle mt-1 leading-relaxed">
          Configure dataset snapshots, manage developer API credentials, and review LLM inference providers.
        </p>
      </div>

      {/* SECTION 1: DATASET SNAPSHOT SETTINGS */}
      <div className="bg-white border border-brand-border rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-brand-border pb-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-text flex items-center space-x-2">
              <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1.5 3 3.5 3h9c2 0 3.5-1 3.5-3V7M4 7c0-2 1.5-3 3.5-3h9c2 0 3.5 1 3.5 3M4 7h16m-8 4v6m-3-3h6" />
              </svg>
              <span>Dataset Snapshot Management</span>
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Select and inspect the verified evidentiary partition used for graph traversal, deterministic rules, and AI discovery.
            </p>
          </div>
          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded font-mono font-medium">
            Active: {currentDataset?.version ?? 'None'}
          </span>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label htmlFor="snapshot-select" className="block text-xs font-medium text-brand-text mb-1">
              Active Snapshot Partition
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-2xl">
              <select
                id="snapshot-select"
                aria-label="Snapshot"
                value={selected}
                onChange={(e) => navigate(scoped('/settings', e.target.value))}
                className="h-9 flex-1 text-xs border border-brand-border rounded-md px-3 bg-white text-brand-text hover:border-gray-400 outline-none focus:ring-1 focus:ring-brand-blue"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.version} · Cutoff: {d.asOf} (ID: {d.id})
                  </option>
                ))}
              </select>

              <Link
                to={scoped('/', selected)}
                className="h-9 px-4 bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-medium rounded-md flex items-center justify-center shrink-0 transition shadow-2xs"
              >
                Go to Opportunities
              </Link>
            </div>
            <p className="text-[11px] text-brand-subtle mt-1.5">
              Switching snapshots immediately recalibrates all accounts, deterministic checks, and premise calculations to that snapshot's as-of date.
            </p>
          </div>

          {currentDataset && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3 bg-gray-50 border border-brand-border rounded-lg">
                <div className="text-[10px] uppercase font-mono text-brand-subtle">Version Tag</div>
                <div className="text-xs font-semibold text-brand-text font-mono mt-0.5">{currentDataset.version}</div>
              </div>
              <div className="p-3 bg-gray-50 border border-brand-border rounded-lg">
                <div className="text-[10px] uppercase font-mono text-brand-subtle">Analysis Cutoff Date</div>
                <div className="text-xs font-semibold text-brand-text font-mono mt-0.5">{currentDataset.asOf}</div>
              </div>
              <div className="p-3 bg-gray-50 border border-brand-border rounded-lg">
                <div className="text-[10px] uppercase font-mono text-brand-subtle">Dataset Partition ID</div>
                <div className="text-xs font-mono text-brand-muted mt-0.5 truncate" title={currentDataset.id}>
                  {currentDataset.id}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: USER API TOKENS & INTEGRATIONS (TODO) */}
      <div className="bg-white border border-brand-border rounded-xl p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-brand-border pb-3">
          <div>
            <h2 className="text-sm font-semibold text-brand-text flex items-center space-x-2">
              <svg className="w-4 h-4 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              <span>User API Tokens & Live Integrations</span>
            </h2>
            <p className="text-xs text-brand-muted mt-0.5">
              Personal API credentials and third-party connector webhooks.
            </p>
          </div>
          <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-mono font-medium">
            TODO / Coming Soon
          </span>
        </div>

        <div className="space-y-4 pt-1">
          {/* User API Token */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-brand-text">
              Personal API Key (Scoped per user)
            </label>
            <div className="flex items-center space-x-2 max-w-xl">
              <input
                type="text"
                readOnly
                value="kn_live_usr_9981f4a9b2fc7701e82844a"
                className="h-9 flex-1 text-xs font-mono bg-gray-50 border border-brand-border rounded-md px-3 text-brand-muted select-all outline-none"
              />
              <button
                onClick={handleCopy}
                className="h-9 px-3 bg-white border border-brand-border hover:bg-gray-50 text-brand-text text-xs rounded-md transition shrink-0"
              >
                {copiedKey ? 'Copied!' : 'Copy Key'}
              </button>
              <button
                disabled
                className="h-9 px-3 bg-gray-100 border border-brand-border text-gray-400 text-xs rounded-md cursor-not-allowed shrink-0"
                title="TODO: Regenerate key feature coming soon"
              >
                Rotate Key
              </button>
            </div>
            <p className="text-[11px] text-brand-subtle">
              Authenticate programmatic inquiries, export context graph assertions, and invoke Copilot endpoints via REST API.
            </p>
          </div>

          {/* Model Provider & Webhooks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl pt-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-brand-text">
                Active AI Model Provider
              </label>
              <select
                disabled
                className="h-9 w-full text-xs border border-brand-border rounded-md px-3 bg-gray-50 text-brand-text cursor-not-allowed outline-none"
              >
                <option>Jev AI System-1 (Zero Hallucination Classification)</option>
                <option>Google Gemini 1.5 Pro (Fallback & Q&A Synthesis)</option>
                <option>Anthropic Claude 3.5 Sonnet</option>
              </select>
              <p className="text-[10px] text-brand-subtle">
                Currently locked to system environment defaults (`JEV_API_KEY`).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-brand-text">
                Live CRM Webhook Target
              </label>
              <input
                type="text"
                disabled
                placeholder="https://api.kasirnusa.id/webhooks/deals"
                value="https://api.kasirnusa.id/webhooks/deals"
                className="h-9 w-full text-xs font-mono border border-brand-border rounded-md px-3 bg-gray-50 text-brand-muted cursor-not-allowed outline-none"
              />
              <p className="text-[10px] text-brand-subtle">
                Planned outbound sync for verified expansion opportunities.
              </p>
            </div>
          </div>

          {/* Architectural Callout Banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900 flex items-start space-x-2.5">
            <svg className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="space-y-1 leading-relaxed">
              <span className="font-semibold">TODO Note for Per-User Credentials:</span>
              <p className="text-[11px] text-blue-800">
                Individual user API keys, custom webhook endpoints, and per-account notification preferences will be stored in the newly provisioned PostgreSQL user table in the next sprint. For now, all interactions run with tenant-level system security.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
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
      {/* Dashboard & Opportunities Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-brand-border">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-text">Dashboard</h1>
          <p className="text-xs text-brand-subtle mt-0.5">
            Expansion opportunities, CRM reconciliation, and stakeholder-tailored action items.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onOpenScan}
            className="inline-flex items-center space-x-1.5 h-8 px-3 rounded-md bg-white hover:bg-orange-50 border border-brand-border hover:border-brand-orange text-brand-text hover:text-brand-orange text-xs font-medium transition shadow-2xs"
            title="Scan customer communications for unrecorded expansion intent"
          >
            <svg className="w-3.5 h-3.5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>AI Deep Scan</span>
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

  useEffect(() => {
    if (result.data) {
      const res = result.data;
      const isCard = 'signal' in res;
      const accId = res.account.id;
      const accName = res.account.name;
      const accCode = isCard ? res.account.external_id : res.account.externalId;
      if (accId) {
        storeRecent({ id: accId, name: accName, externalId: accCode || accId });
        window.dispatchEvent(new Event('recents_updated'));
      }
    }
  }, [result.data]);

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
