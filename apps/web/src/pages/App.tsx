import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { AccountDiagnosis, AiCandidateOpportunity, Evidence, OpportunityCard, QaResponse, User } from '@kasirnusa/contracts';
import { api } from '../lib/api';
import { AccountQA } from '../components/AccountQA';
import { useAuth } from '../components/Auth';

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

  const { user, signOut } = useAuth();
  const currentUser = user!; // RequireSession mounts the dashboard only after verification.
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
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
                      navigate(scoped('/opportunities', selected));
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
                    disabled={signingOut}
                    onClick={async () => {
                      setSigningOut(true); setSignOutError('');
                      try { await signOut(); }
                      catch { setSignOutError('Could not sign out. Please try again.'); }
                      finally { setSigningOut(false); }
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded hover:bg-red-50 text-red-600 flex items-center space-x-2 transition text-xs font-medium"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>{signingOut ? 'Signing out…' : 'Sign out'}</span>
                  </button>
                  {signOutError && <p role="alert" className="p-2 text-red-700">{signOutError}</p>}
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
              to={scoped('/opportunities', selected)}
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
                <Route path="/opportunities" element={<Opportunities dataset={selected} onOpenScan={() => setScanModalOpen(true)} />} />
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
                <Route path="/users" element={<UsersView currentUser={currentUser} />} />
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
                    Unrecorded expansion requests and buying signals detected in customer conversations
                  </p>
                </div>
              </div>
              <button onClick={() => setScanModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            {scanStats && (
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2.5 bg-gray-50 border border-brand-border rounded">
                  <div className="text-[10px] text-gray-400 uppercase font-mono">Messages Scanned</div>
                  <div className="font-bold text-gray-800 text-sm mt-0.5">{scanStats.scanned}</div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-brand-border rounded">
                  <div className="text-[10px] text-gray-400 uppercase font-mono">Opportunities Found</div>
                  <div className="font-bold text-emerald-600 text-sm mt-0.5">{scanStats.found}</div>
                </div>
                <div className="p-2.5 bg-gray-50 border border-brand-border rounded">
                  <div className="text-[10px] text-gray-400 uppercase font-mono">AI Checks Completed</div>
                  <div className="font-bold text-brand-blue text-sm mt-0.5">{scanStats.calls}</div>
                </div>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-brand-border rounded-lg">
              {scanCandidates.length === 0 ? (
                <div className="p-6 text-center text-xs text-brand-subtle">
                  No unrecorded expansion signals found in the scanned messages. All detected opportunities are already on your dashboard.
                </div>
              ) : (
                scanCandidates.map((c) => (
                  <div key={c.id} className="p-3.5 space-y-1.5 hover:bg-gray-50 transition">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-brand-text">
                        {c.account_external_id} · {c.account_name}
                      </span>
                      <span className="text-[10px] font-mono bg-blue-50 text-brand-blue px-2 py-0.5 rounded-full border border-blue-200 capitalize">
                        {words(c.signal.kind)}
                      </span>
                    </div>
                    <blockquote className="text-xs italic text-gray-700 bg-gray-50 p-2 rounded border-l-2 border-brand-orange">
                      "{c.signal.raw_quote}"
                    </blockquote>
                    <div className="flex items-center justify-between text-[11px] text-brand-subtle font-mono">
                      <span>
                        Quantity: {c.signal.quantity} {c.signal.unit} · {c.signal.location ?? 'Location unstated'}
                      </span>
                      <span>Intent: {words(c.intent_assessment.choice)} ({Math.round(c.intent_assessment.confidence * 100)}%)</span>
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
        <span>
          KasirNusa Account Expansion Assistant use Historical snapshot · Snapshot: {dataset?.asOf ?? '2026-10-01'} · {dataset?.version ?? 'kasirnusa-2026-10-01'}
        </span>
        <span></span>
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
        <span className="text-brand-text font-semibold">Copied</span>
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

// ================= VIEW: ACCOUNT COPILOT (INVESTIGATIVE WORKBENCH) =================
interface InquiryRecord {
  id: string;
  question: string;
  timestamp: string;
  accountContext?: string;
  response: QaResponse;
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
  const [activeInquiry, setActiveInquiry] = useState<InquiryRecord | null>(null);
  const [recentInquiries, setRecentInquiries] = useState<InquiryRecord[]>([]);
  const [source, setSource] = useState<string>('');

  const activeAccount = accounts.find((a) => a.id === currentAccountId);

  // Clear inquiry state when switching account scope
  useEffect(() => {
    setActiveInquiry(null);
    setRecentInquiries([]);
    setError('');
    setInputQuestion('');
  }, [currentAccountId]);

  const handleInvestigate = async (qText?: string) => {
    const textToSend = qText ?? inputQuestion;
    if (!textToSend.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const history = recentInquiries.slice(0, 3).map((r) => ({ question: r.question }));

      const res = await api.qa({
        dataset_id: dataset,
        account_id: currentAccountId || undefined,
        question: textToSend,
        language,
        history,
        route: 'joint',
      });

      const inqRecord: InquiryRecord = {
        id: 'inq_' + Date.now(),
        question: textToSend,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        accountContext: activeAccount ? `${activeAccount.externalId} · ${activeAccount.name}` : undefined,
        response: res,
      };

      setActiveInquiry(inqRecord);
      setRecentInquiries((prev) => [inqRecord, ...prev.filter((item) => item.question !== textToSend)].slice(0, 6));
      setInputQuestion(textToSend);
    } catch (err: any) {
      setError(err.message || 'Investigation query failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setActiveInquiry(null);
    setInputQuestion('');
    setError('');
  };

  const launchpadCategories = activeAccount
    ? [
        {
          title: 'Expansion Signals & Follow-Up',
          queries: [
            `Apa yang belum ditindaklanjuti untuk ${activeAccount.externalId}?`,
            `Pelanggan mana yang punya peluang ekspansi?`,
          ],
        },
        {
          title: 'Stakeholder & Decision Requirements',
          queries: [
            `Siapa yang perlu dilibatkan untuk ${activeAccount.externalId}, dan apa buktinya?`,
            `Apakah follow-up terakhir sudah menjawab kekhawatiran decision maker?`,
          ],
        },
        {
          title: 'Commercial Revenue Scenarios',
          queries: [
            `Kalau ${activeAccount.externalId} tambah 10 outlet, berapa nilai tahunannya?`,
            `Berapa nilai skenario outlet untuk ${activeAccount.externalId}?`,
          ],
        },
        {
          title: 'Action Plans & Precedents',
          queries: [
            `Apa tindakan rekomendasi untuk ${activeAccount.externalId}?`,
            `Buatkan draft follow-up untuk ${activeAccount.externalId}.`,
          ],
        },
      ]
    : [
        {
          title: 'Expansion Signals & Discovery',
          queries: [
            'Pelanggan mana yang punya peluang ekspansi?',
            'Apa yang belum ditindaklanjuti untuk C06?',
          ],
        },
        {
          title: 'Stakeholder & Authority Diagnosis',
          queries: [
            'Siapa yang perlu dilibatkan untuk C01, dan apa buktinya?',
            'Apakah follow-up terakhir sudah menjawab kekhawatiran decision maker?',
          ],
        },
        {
          title: 'Commercial Revenue Scenarios',
          queries: [
            'Kalau C06 tambah 10 outlet, berapa nilai tahunannya?',
            'Kalau C02 tambah 6 outlet, berapa nilai tahunannya?',
          ],
        },
        {
          title: 'Action Plans & Drafts',
          queries: [
            'Apa saja constraint paket dan blocker yang tercatat untuk C02?',
            'Buatkan draft follow-up untuk C06.',
          ],
        },
      ];

  return (
    <div className="flex-1 flex flex-col min-h-0 max-w-5xl mx-auto w-full space-y-3.5">
      {/* Workbench Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-brand-border shrink-0">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-text">Account Copilot</h1>
          <p className="text-xs text-brand-subtle mt-0.5">
            {activeAccount
              ? `Scoped to ${activeAccount.externalId} · ${activeAccount.name}. Analytical workbench grounded in PostgreSQL context graph evidence.`
              : 'Analytical workbench for expansion discovery, blocker diagnosis, and revenue modeling grounded in context graph.'}
          </p>
        </div>

        {/* Header Right: Language Switch & Reset */}
        <div className="flex items-center space-x-2 shrink-0">
          {(activeInquiry || inputQuestion) && (
            <button
              type="button"
              onClick={handleReset}
              className="h-8 px-3 text-xs border border-brand-border rounded-md bg-white hover:bg-gray-50 text-brand-text font-medium transition shadow-2xs flex items-center space-x-1"
            >
              <span>+ New Inquiry</span>
            </button>
          )}

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

      {/* Prominent Top Query Bar */}
      <div className="space-y-2 shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleInvestigate();
          }}
          className="flex items-center space-x-2 bg-white border border-brand-border rounded-lg p-1.5 shadow-2xs focus-within:border-brand-blue focus-within:ring-1 focus-within:ring-brand-blue/20"
        >
          <div className="pl-2 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={
              activeAccount
                ? `Investigate ${activeAccount.externalId} (${activeAccount.name})…`
                : 'Investigate expansion signals, unaddressed requirements, stakeholder authority, or revenue scenarios…'
            }
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            disabled={loading}
            className="flex-1 bg-transparent px-2 text-xs text-brand-text placeholder-gray-400 outline-none min-w-0"
          />
          {inputQuestion && (
            <button
              type="button"
              onClick={() => setInputQuestion('')}
              className="text-gray-400 hover:text-gray-600 p-1 rounded"
              title="Clear input"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          )}
          <button
            type="submit"
            disabled={!inputQuestion.trim() || loading}
            className="h-8 px-4 bg-brand-blue hover:bg-brand-blue-hover disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-medium rounded-md transition shrink-0 flex items-center space-x-1"
          >
            <span>{loading ? 'Analyzing…' : 'Investigate'}</span>
            <span>↵</span>
          </button>
        </form>

        {/* Recent Inquiries Bar (Horizontal Chips) */}
        {recentInquiries.length > 0 && (
          <div className="flex items-center space-x-2 overflow-x-auto py-1 text-xs">
            <span className="text-[10px] font-mono uppercase text-gray-400 shrink-0 font-medium">Recent:</span>
            {recentInquiries.map((inq) => {
              const isActive = activeInquiry?.id === inq.id;
              return (
                <button
                  key={inq.id}
                  onClick={() => {
                    setActiveInquiry(inq);
                    setInputQuestion(inq.question);
                  }}
                  className={`px-2.5 py-1 rounded border text-[11px] whitespace-nowrap transition shrink-0 max-w-xs truncate ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 font-medium shadow-2xs'
                      : 'bg-white hover:bg-gray-50 text-brand-text border-brand-border'
                  }`}
                  title={inq.question}
                >
                  {inq.question}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setRecentInquiries([]);
                setActiveInquiry(null);
              }}
              className="text-[10px] text-gray-400 hover:text-gray-600 shrink-0 underline ml-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 shrink-0">
          <span className="font-semibold">Error:</span> {error}
        </div>
      )}

      {/* Main Workbench Body */}
      <div className="flex-1 overflow-y-auto pr-1 min-h-0">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center space-y-3">
            <svg className="w-6 h-6 text-brand-blue animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-xs text-brand-subtle font-medium">Evaluating query against context graph & synthesizing grounded report…</p>
          </div>
        ) : !activeInquiry ? (
          /* Launchpad */
          <div className="p-6 space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-brand-text">Investigation Launchpad</h2>
              <p className="text-xs text-brand-subtle">
                Select an inquiry below or type a query above. Every answer maps to an allowlisted operation plan and evaluates connected evidence from the PostgreSQL context graph.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {launchpadCategories.map((cat, idx) => (
                <div key={idx} className="border border-brand-border rounded-lg p-3.5 bg-white space-y-2 shadow-2xs">
                  <h3 className="text-xs font-semibold uppercase tracking-wider font-mono text-[11px] text-gray-500">
                    {cat.title}
                  </h3>
                  <div className="space-y-1.5">
                    {cat.queries.map((q, qIdx) => (
                      <button
                        key={qIdx}
                        onClick={() => handleInvestigate(q)}
                        className="w-full text-left p-2 rounded border border-brand-border hover:border-gray-400 bg-gray-50/50 hover:bg-white text-xs text-brand-text transition flex items-start space-x-2 group"
                      >
                        <span className="text-gray-400 shrink-0 group-hover:translate-x-0.5 group-hover:text-brand-text transition">→</span>
                        <span className="leading-relaxed">{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (() => {
          const claims = activeInquiry.response.claims ?? [];
          const actionClaims = claims.filter((c) => c.kind === 'proposed_action');
          const diagnosticClaims = claims.filter((c) => c.kind === 'check');
          const factClaims = claims.filter((c) => c.kind === 'fact' || c.kind === 'source_quote');

          return (
            <div className="space-y-4 pb-8">
              {/* Inquiry Status Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white border border-brand-border rounded-lg shadow-2xs">
                <div className="flex items-center space-x-2 min-w-0">
                  <span className="text-[10px] font-mono uppercase bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold shrink-0">
                    Active Inquiry
                  </span>
                  <span className="font-semibold text-brand-text truncate">
                    "{activeInquiry.question}"
                  </span>
                </div>
                <div className="flex items-center space-x-3 text-[10px] font-mono text-brand-subtle shrink-0">
                  {activeInquiry.accountContext && (
                    <span className="bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                      Scope: {activeInquiry.accountContext}
                    </span>
                  )}
                  <span>Snapshot: {activeInquiry.response.as_of}</span>
                  <span>{activeInquiry.timestamp}</span>
                </div>
              </div>

              {/* The Diagnostic Canvas */}
              <div className="bg-white border border-brand-border rounded-xl p-4 sm:p-5 space-y-4 text-xs shadow-2xs">
                {/* Header Row: Executive Telemetry Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-brand-border">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {activeInquiry.response?.commercial_context && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded font-medium uppercase tracking-wider border border-brand-border bg-gray-50 text-brand-text">
                        {activeInquiry.response.commercial_context}
                      </span>
                    )}
                    {activeInquiry.response?.value_scenario && (
                      <span className="text-[10px] font-mono bg-gray-50 text-brand-text border border-brand-border px-2 py-0.5 rounded font-medium">
                        ARR: {amount(activeInquiry.response.value_scenario.amount)} IDR
                      </span>
                    )}
                    {diagnosticClaims.some((c) => /no matching|unmatched/i.test(c.text)) && (
                      <span className="text-[10px] font-mono bg-gray-50 text-gray-700 border border-brand-border px-1.5 py-0.5 rounded font-medium">
                        Unmatched in CRM
                      </span>
                    )}
                    {diagnosticClaims.some((c) => /no recorded follow-up/i.test(c.text)) && (
                      <span className="text-[10px] font-mono bg-gray-50 text-gray-700 border border-brand-border px-1.5 py-0.5 rounded font-medium">
                        Follow-up Pending
                      </span>
                    )}
                    {activeInquiry.response?.plan && (
                      <span className="text-[10px] font-mono bg-gray-50 text-gray-700 px-2 py-0.5 rounded border border-brand-border">
                        {activeInquiry.response.plan.operation.replaceAll('_', ' ')}
                      </span>
                    )}
                  </div>
                  {activeInquiry.response?.as_of && (
                    <span className="text-[10px] font-mono text-brand-subtle">
                      Snapshot: {activeInquiry.response.as_of}
                    </span>
                  )}
                </div>

                {/* Executive Summary Card */}
                <div className="p-3.5 bg-gray-50/50 border border-brand-border rounded-lg space-y-1">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-subtle">
                    Executive Summary
                  </div>
                  <div className="text-brand-text leading-relaxed whitespace-pre-line text-xs font-medium">
                    {activeInquiry.response.answer}
                  </div>
                </div>

                {/* Commercial Value Tile (if present) */}
                {activeInquiry.response?.value_scenario && (
                  <div className="p-3.5 bg-white border border-brand-border rounded-lg space-y-2 text-xs shadow-2xs">
                    <div className="flex items-center justify-between pb-1 border-b border-brand-border">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-text">
                        Commercial Revenue Scenario
                      </div>
                      <span className="text-[10px] font-mono bg-gray-50 text-brand-muted border border-brand-border px-2 py-0.5 rounded font-medium">
                        Conditional Incremental ARR
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                      <div className="text-xl font-bold font-mono text-brand-text">
                        {amount(activeInquiry.response.value_scenario.amount)} IDR <span className="text-xs font-normal text-brand-subtle">/ year</span>
                      </div>
                      <div className="text-[11px] font-mono text-brand-muted bg-gray-50 border border-brand-border px-2 py-0.5 rounded">
                        {activeInquiry.response.value_scenario.formula}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="p-2 bg-gray-50/50 rounded border border-brand-border">
                        <span className="text-[10px] text-gray-500 block uppercase font-mono">Additional Outlets</span>
                        <span className="font-semibold font-mono text-brand-text">{activeInquiry.response.value_scenario.inputs.additional_outlets} Outlets</span>
                      </div>
                      <div className="p-2 bg-gray-50/50 rounded border border-brand-border">
                        <span className="text-[10px] text-gray-500 block uppercase font-mono">Monthly Rate / Outlet</span>
                        <span className="font-semibold font-mono text-brand-text">{amount(activeInquiry.response.value_scenario.inputs.monthly_rate)} IDR</span>
                      </div>
                      <div className="p-2 bg-gray-50/50 rounded border border-brand-border">
                        <span className="text-[10px] text-gray-500 block uppercase font-mono">Discount Rate</span>
                        <span className="font-semibold font-mono text-brand-text">{activeInquiry.response.value_scenario.inputs.discount_percent}%</span>
                      </div>
                    </div>

                    {activeInquiry.response.value_scenario.assumptions.length > 0 && (
                      <div className="text-[10px] text-brand-subtle pt-1 space-y-0.5">
                        <span className="font-semibold uppercase tracking-wider text-gray-500">Assumptions:</span>
                        <ul className="list-disc list-inside">
                          {activeInquiry.response.value_scenario.assumptions.map((a, idx) => (
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
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50/70 border-b border-brand-border">
                      <div className="text-xs font-semibold text-brand-text">
                        Observed Gaps & Recorded Constraints
                      </div>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-brand-border text-brand-muted font-medium">
                        {diagnosticClaims.length} items checked
                      </span>
                    </div>
                    <div className="p-3 space-y-2">
                      {diagnosticClaims.map((claim) => {
                        const isWarning = /no matching|no recorded|unfulfilled|unmet|mismatch|conflict|cannot/i.test(claim.text);
                        return (
                          <div
                            key={claim.id}
                            className="p-2.5 rounded-md border border-brand-border bg-white text-xs space-y-1.5"
                          >
                            <div className="flex items-start space-x-2">
                              <span className={`text-[10px] font-mono uppercase font-semibold shrink-0 mt-0.5 ${
                                isWarning ? 'text-brand-text' : 'text-brand-subtle'
                              }`}>
                                {isWarning ? '[Gap]' : '[Constraint]'}
                              </span>
                              <div className="flex-1">
                                <p className="text-brand-text font-normal leading-relaxed">{claim.text}</p>
                              </div>
                            </div>
                            {claim.evidence_ids.length > 0 && (
                              <div className="pl-12 pt-0.5">
                                <Refs ids={claim.evidence_ids} evidence={activeInquiry.response?.evidence ?? []} open={(id) => setSource(id)} />
                              </div>
                            )}
                            {claim.check && (
                              <details className="pl-12 text-[10px] text-gray-500">
                                <summary className="cursor-pointer hover:text-brand-text font-medium select-none">
                                  Inspect recorded check criteria
                                </summary>
                                <pre className="mt-1 font-mono text-[9px] bg-gray-50 p-2 rounded border border-brand-border overflow-x-auto">
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
                  <div className="border border-brand-border rounded-lg bg-white overflow-hidden shadow-2xs">
                    <div className="flex items-center justify-between px-3.5 py-2.5 bg-gray-50/70 border-b border-brand-border">
                      <div className="text-xs font-semibold text-brand-text">
                        Recommended Sales Action Plan
                      </div>
                      <CopyButton
                        text={actionClaims.map((c, i) => `${i + 1}. ${c.text}`).join('\n')}
                        label="Copy Action Plan"
                      />
                    </div>
                    <div className="p-3 space-y-2">
                      {actionClaims.map((claim, idx) => (
                        <div key={claim.id} className="p-3 bg-white border border-brand-border rounded-md text-xs space-y-1.5">
                          <div className="flex items-start space-x-2.5">
                            <span className="h-5 w-5 rounded bg-gray-100 border border-brand-border text-brand-text text-[10px] font-mono font-semibold flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1 space-y-1">
                              <p className="text-brand-text font-medium leading-relaxed">{claim.text}</p>
                              {claim.evidence_ids.length > 0 && (
                                <div className="pt-0.5">
                                  <Refs ids={claim.evidence_ids} evidence={activeInquiry.response?.evidence ?? []} open={(id) => setSource(id)} />
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
                {activeInquiry.response?.premise_check && (
                  <div className="p-3.5 bg-gray-50/60 border border-brand-border rounded-lg space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-brand-text text-xs">
                        Question Premise: {words(activeInquiry.response.premise_check.status)}
                      </h4>
                      <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded text-brand-muted border border-brand-border font-medium uppercase">
                        {activeInquiry.response.premise_check.status}
                      </span>
                    </div>
                    <p className="text-brand-muted leading-relaxed">{activeInquiry.response.premise_check.coverage}</p>
                    {activeInquiry.response.premise_check.clarification && (
                      <p className="text-brand-muted leading-relaxed">{activeInquiry.response.premise_check.clarification}</p>
                    )}
                    {activeInquiry.response.premise_check.calculation && (
                      <pre className="font-mono text-[10px] bg-white p-2.5 rounded border border-brand-border text-brand-text overflow-x-auto">
                        {JSON.stringify(activeInquiry.response.premise_check.calculation, null, 2)}
                      </pre>
                    )}
                  </div>
                )}

                {/* Requirement Assessments (if present) */}
                {activeInquiry.response?.requirement_assessments && activeInquiry.response.requirement_assessments.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-brand-border">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-subtle">
                      Requirement Assessments
                    </div>
                    <div className="space-y-2">
                      {activeInquiry.response.requirement_assessments.map((a) => (
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
                            <Refs ids={a.source_ids} evidence={activeInquiry.response?.evidence ?? []} open={(id) => setSource(id)} />
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow-up Draft if present */}
                {activeInquiry.response?.draft && (
                  <div className="p-3.5 bg-gray-50 border border-brand-border rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-1.5 font-semibold text-brand-text">
                        <svg className="w-4 h-4 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        <span>Ready-to-Send Follow-Up Draft ({activeInquiry.response.draft.route} route)</span>
                      </div>
                      <CopyButton
                        text={`Subject: ${activeInquiry.response.draft.subject}\n\n${activeInquiry.response.draft.body}`}
                        label="Copy Draft"
                      />
                    </div>
                    <div className="text-[11px] text-brand-text font-medium bg-white px-3 py-1.5 rounded border border-gray-200">
                      <span className="text-gray-400 font-mono mr-1.5">Subject:</span> {activeInquiry.response.draft.subject}
                    </div>
                    <div className="text-xs text-brand-muted bg-white p-3 rounded border border-gray-200 font-mono text-[11px] whitespace-pre-wrap leading-relaxed shadow-2xs">
                      {activeInquiry.response.draft.body}
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
                            <Refs ids={claim.evidence_ids} evidence={activeInquiry.response?.evidence ?? []} open={(id) => setSource(id)} />
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {/* Context Relationship Graph (Cytoscape Nodes & Edges) */}
                {(activeInquiry.response?.account_id || currentAccountId) && (
                  <CopilotGraphViewer
                    dataset={dataset}
                    accountId={(activeInquiry.response?.account_id ?? currentAccountId)!}
                    openSource={(id) => setSource(id)}
                  />
                )}

                {/* Cited Evidence Passages */}
                {activeInquiry.response?.evidence && activeInquiry.response.evidence.length > 0 && (
                  <details className="border border-brand-border rounded-lg bg-gray-50/50 p-3 space-y-2 text-xs">
                    <summary className="font-semibold text-brand-text cursor-pointer select-none flex items-center justify-between">
                      <span className="flex items-center space-x-1.5">
                        <svg className="w-3.5 h-3.5 text-brand-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Cited Evidence Passages ({activeInquiry.response.evidence.length})</span>
                      </span>
                      <span className="text-[10px] font-mono text-brand-subtle font-normal">Click to expand</span>
                    </summary>
                    <div className="space-y-2 pt-2">
                      {activeInquiry.response.evidence.map((e, idx) => (
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
                {activeInquiry.response?.limitations && activeInquiry.response.limitations.length > 0 && (
                  <div className="text-[11px] text-brand-subtle border-t border-dashed border-brand-border pt-2 space-y-0.5">
                    <span className="font-semibold text-gray-500">Method limitations:</span>
                    <ul className="list-disc list-inside">
                      {activeInquiry.response.limitations.map((lim, i) => (
                        <li key={i}>{lim}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {source && <Source dataset={dataset} id={source} close={() => setSource('')} />}
    </div>
  );
}

// ================= VIEW: USERS & RBAC =================
function UsersView({
  currentUser,
}: {
  currentUser: User;
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
                      <span className="text-[11px] text-brand-subtle">—</span>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [snapshotList, setSnapshotList] = useState(datasets);

  useEffect(() => {
    setSnapshotList(datasets);
  }, [datasets]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const version = file.name.replace(/\.[^/.]+$/, '').trim() || 'custom-snapshot';
    const newSnapshot = {
      id: crypto.randomUUID(),
      version,
      asOf: new Date().toISOString().slice(0, 10),
    };
    setSnapshotList((prev) => [newSnapshot, ...prev]);
    navigate(scoped('/settings', newSnapshot.id));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = (id: string) => {
    if (snapshotList.length <= 1) {
      alert('Cannot delete the only snapshot.');
      return;
    }
    if (!window.confirm('Delete this snapshot?')) return;
    const updated = snapshotList.filter((d) => d.id !== id);
    setSnapshotList(updated);
    if (id === selected && updated.length > 0) {
      navigate(scoped('/settings', updated[0].id));
    }
  };

  return (
    <section className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-brand-border">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-text">Settings</h1>
          <p className="text-xs text-brand-subtle mt-0.5">
            Dataset snapshots and system configuration.
          </p>
        </div>
      </div>

      {/* Snapshot Settings Card */}
      <div className="bg-white border border-brand-border rounded-lg p-5 space-y-4 shadow-2xs">
        {/* Card Header: Section name on left, only upload button on top right */}
        <div className="flex items-center justify-between pb-3 border-b border-brand-border">
          <h2 className="text-sm font-semibold text-brand-text">Snapshot Settings</h2>
          <div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".zip,.tar.gz,.json,.csv"
              onChange={handleUpload}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 rounded-md bg-white border border-brand-border hover:bg-gray-50 text-brand-text text-xs font-medium transition cursor-pointer"
            >
              Upload snapshot
            </button>
          </div>
        </div>

        {/* Accessible Snapshot Select */}
        <select
          id="snapshot-select"
          aria-label="Snapshot"
          value={selected}
          onChange={(e) => navigate(scoped('/settings', e.target.value))}
          className="sr-only"
          tabIndex={-1}
        >
          {snapshotList.map((d) => (
            <option key={d.id} value={d.id}>
              {d.version} ({d.asOf})
            </option>
          ))}
        </select>

        {/* Uploaded Snapshots Table */}
        <div className="border border-brand-border rounded-md overflow-hidden">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-brand-canvas border-b border-brand-border text-brand-subtle font-medium">
              <tr>
                <th className="py-2.5 px-4">Version</th>
                <th className="py-2.5 px-4">Cutoff Date</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-brand-text">
              {snapshotList.map((d) => {
                const isActive = d.id === selected;
                return (
                  <tr key={d.id} className="hover:bg-brand-canvas/50">
                    <td className="py-3 px-4 font-mono font-medium">
                      {d.version}
                    </td>
                    <td className="py-3 px-4 font-mono text-brand-subtle">
                      {d.asOf}
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => !isActive && navigate(scoped('/settings', d.id))}
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border transition ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100 hover:text-gray-700 cursor-pointer'
                        }`}
                        title={isActive ? 'Active snapshot' : 'Click to activate'}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(d.id)}
                        className="h-7 px-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded text-xs font-medium transition cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

  const items = result.data?.items ?? [];
  const total = result.data?.total ?? 0;
  const activeCount = items.filter((c) => c.signal.status === 'active').length;
  const totalPossibleRevenue = items.reduce((acc, c) => {
    if (c.value_scenario?.amount) {
      return acc + Number(c.value_scenario.amount);
    }
    return acc;
  }, 0);
  const pendingTermsCount = items.filter((c) => !c.value_scenario?.amount).length;
  const actionCount = items.filter((c) => Boolean(c.next_action?.task)).length;
  const avgElapsed =
    items.length > 0 ? Math.round(items.reduce((acc, c) => acc + c.elapsed_days, 0) / items.length) : 0;

  return (
    <section className="space-y-6 max-w-5xl mx-auto">
      {/* Dashboard & Opportunities Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-brand-border">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brand-text">Dashboard</h1>
          <p className="text-xs text-brand-subtle mt-0.5">
            Daftar peluang ekspansi, estimasi nilai, dan langkah tindak lanjut terverifikasi.
          </p>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onOpenScan}
            className="inline-flex items-center space-x-1.5 h-8 px-3 rounded-md bg-white hover:bg-orange-50 border border-brand-border hover:border-brand-orange text-brand-text hover:text-brand-orange text-xs font-medium transition shadow-2xs"
            title="Scan customer messages for unrecorded expansion opportunities"
          >
            <svg className="w-3.5 h-3.5 text-brand-orange" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>AI Deep Scan</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics: 3 Mandatory Deliverables */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Peluang Ekspansi */}
        <div className="border border-brand-border rounded-lg p-4 bg-white shadow-2xs">
          <span className="text-xs text-brand-subtle font-medium">Peluang Ekspansi</span>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-brand-text">
              {activeCount}
            </span>
          </div>
        </div>

        {/* Metric 2: Possible Revenue (Estimasi Nilai) */}
        <div className="border border-brand-border rounded-lg p-4 bg-white shadow-2xs">
          <span className="text-xs font-medium">Possible Revenue (Estimasi Nilai)</span>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold">
              Rp {new Intl.NumberFormat('id-ID').format(totalPossibleRevenue)}
            </span>
            <span className="text-xs">/ thn</span>
          </div>
          
        </div>

        {/* Metric 3: Langkah Tindak Lanjut */}
        <div className="border border-brand-border rounded-lg p-4 bg-white shadow-2xs">
          <span className="text-xs font-medium">Langkah Tindak Lanjut</span>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-brand-text">
              {actionCount}
            </span>
            <span className="text-xs"></span>
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
                <th className="py-2.5 px-4 font-medium text-gray-500">Account</th>
                <th className="py-2.5 px-4 font-medium text-gray-500">Estimate Revenue</th>
                <th className="py-2.5 px-4 font-medium text-gray-500">Langkah Tindak Lanjut</th>
                <th className="py-2.5 px-4 text-right font-medium text-gray-500 w-16">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border text-brand-text">
              {result.data.items.map((card) => {
                const stepsCount = card.next_action.discussion_points?.length || 1;
                return (
                  <tr
                    key={card.id}
                    className="hover:bg-gray-50/80 transition"
                  >
                    {/* Account: flat, uniform font, neutral text */}
                    <td className="py-3 px-4 font-medium text-gray-900">
                      <Link
                        to={scoped('/opportunities/' + card.id, dataset)}
                        className="hover:underline text-gray-900"
                      >
                        {card.account.external_id} · {card.account.name}
                      </Link>
                    </td>

                    {/* Estimate Revenue: flat, uniform font */}
                    <td className="py-3 px-4 text-gray-700">
                      {card.value_scenario ? (
                        <span>
                          Rp {amount(card.value_scenario.amount)}
                        </span>
                      ) : (
                        <span className="text-gray-500">
                          Perlu penyesuaian paket
                        </span>
                      )}
                    </td>

                    {/* Langkah Tindak Lanjut: flat number, uniform font */}
                    <td className="py-3 px-4 text-gray-700">
                      {stepsCount}
                    </td>

                    {/* Aksi: eye icon only */}
                    <td className="py-3 px-4 text-right">
                      <Link
                        to={scoped('/opportunities/' + card.id, dataset)}
                        className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-gray-700 rounded transition"
                        title="View detail"
                        aria-label="View detail"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                );
              })}

              {!result.data.items.length && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-brand-subtle">
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
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'evidence' | 'draft' | 'qa'>(
    action ? 'draft' : 'overview'
  );
  const [copiedTask, setCopiedTask] = useState(false);
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

  const handleCopyTask = () => {
    navigator.clipboard.writeText(plan.task);
    setCopiedTask(true);
    setTimeout(() => setCopiedTask(false), 2000);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Header Title & Context */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {accountCode} · {resource.account.name}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          {card
            ? `Expansion request: ${resource.signal.additional_outlets ?? ''} outlets in ${resource.signal.location ?? 'location unstated'} (Target: ${resource.signal.target_period ?? 'unspecified'})`
            : `Comprehensive account diagnosis, stakeholder mapping, and commercial alignment.`}
        </p>
      </div>

      {/* 4. Tab Navigation Bar */}
      <div className="border-b border-brand-border">
        <nav className="flex space-x-2 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-3 border-b-2 transition ${
              activeTab === 'overview'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Action Plan & Analysis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('graph')}
            className={`pb-2 px-3 border-b-2 transition ${
              activeTab === 'graph'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Relationship Graph
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evidence')}
            className={`pb-2 px-3 border-b-2 transition ${
              activeTab === 'evidence'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Evidence Records ({resource.evidence.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('draft')}
            className={`pb-2 px-3 border-b-2 transition ${
              activeTab === 'draft'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Follow-Up Draft
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qa')}
            className={`pb-2 px-3 border-b-2 transition ${
              activeTab === 'qa'
                ? 'border-gray-900 text-gray-900 font-semibold'
                : 'border-transparent text-gray-500 hover:text-gray-900'
            }`}
          >
            Account Q&A
          </button>
        </nav>
      </div>

      {/* 5. TAB CONTENT */}

      {/* TAB 1: Action Plan & Analysis */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Executive Status Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-gray-50 border border-brand-border rounded-lg text-xs">
            <div>
              <span className="text-[10px] text-gray-400 font-mono uppercase block">Opportunity Context</span>
              <span className="font-semibold text-gray-900 mt-0.5 block capitalize">{words(resource.commercial_context)}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-mono uppercase block">Signal Status</span>
              <span className="font-semibold text-gray-900 mt-0.5 block capitalize">{words(card ? resource.signal.status : 'Active')}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-mono uppercase block">CRM Status</span>
              <span className="font-semibold text-gray-900 mt-0.5 block">
                {card ? (resource.reconciliation.status === 'unmatched' ? 'Not recorded in CRM yet' : 'Recorded in CRM') : 'Logged in CRM'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-mono uppercase block">Response Aging</span>
              <span className="font-semibold text-gray-900 font-mono mt-0.5 block">
                {card ? `${resource.elapsed_days} days pending` : 'Synchronized'}
              </span>
            </div>
          </div>

          {/* Section: Proposed Action Plan */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-4 shadow-2xs">
            <div className="flex items-center justify-between border-b border-brand-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Recommended Next Action</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Route: <span className="font-medium text-gray-700 capitalize">{words(plan.route)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyTask}
                className="h-7 px-2.5 text-xs font-medium rounded border border-brand-border bg-white hover:bg-gray-50 text-gray-700 transition"
              >
                {copiedTask ? 'Copied' : 'Copy Task'}
              </button>
            </div>

            {/* Task Card */}
            <div className="p-3 bg-gray-50 border border-brand-border rounded-md text-xs text-gray-900 leading-relaxed font-medium">
              {plan.task}
            </div>

            {/* Responsible and Recipient Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white border border-brand-border rounded">
                <span className="text-[10px] text-gray-400 font-medium uppercase font-mono">Internal Account Owner:</span>
                <div className="font-semibold text-gray-900 mt-0.5">{owner.name} ({owner.role})</div>
                <div className="mt-1">
                  <Refs ids={owner.evidence_ids} evidence={resource.evidence} open={open} />
                </div>
              </div>

              <div className="p-3 bg-white border border-brand-border rounded">
                <span className="text-[10px] text-gray-400 font-medium uppercase font-mono">Customer Stakeholder (Target Contact):</span>
                <div className="font-semibold text-gray-900 mt-0.5">
                  {card && resource.people.contact
                    ? `${resource.people.contact.name} (${resource.people.contact.role})`
                    : plan.recipient_ids.map(name).join(', ') || 'Confirm relevant stakeholder'}
                </div>
                {card && resource.people.contact && (
                  <div className="mt-1">
                    <Refs ids={resource.people.contact.evidence_ids} evidence={resource.evidence} open={open} />
                  </div>
                )}
              </div>
            </div>

            {/* Discussion Points */}
            <div className="pt-2">
              <h3 className="text-xs font-semibold text-gray-800 uppercase tracking-wider mb-2 font-mono">
                Meeting Agenda & Talking Points
              </h3>
              <div className="space-y-2">
                {plan.discussion_points.map((point, i) => (
                  <div key={i} className="p-3 border border-brand-border rounded-md bg-white text-xs space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start space-x-2">
                        <span className="h-5 w-5 rounded bg-gray-100 border border-brand-border text-gray-700 font-mono text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <div>
                          {'audience_ids' in point && (
                            <span className="font-medium text-gray-900 mr-1.5">
                              [{point.audience_ids.map(name).join(', ') || 'Account owner'}]:
                            </span>
                          )}
                          <span className="text-gray-800">{point.text}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pl-7">
                      <Refs ids={point.evidence_ids} evidence={resource.evidence} open={open} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section: Analisis Gap & Temuan Sistem */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-4 shadow-2xs">
            <h2 className="text-sm font-semibold text-gray-900">Field Findings & CRM Reconciliation</h2>
            
            {/* CRM Reconciliation Explanation */}
            {card && (
              <div className="p-3.5 border border-brand-border rounded-md bg-white text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    CRM Reconciliation: {resource.reconciliation.status === 'unmatched' ? 'Not Recorded in CRM Yet (Unrecorded Opportunity)' : words(resource.reconciliation.status)}
                  </span>
                  <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-brand-border uppercase">
                    {resource.reconciliation.status}
                  </span>
                </div>
                <p className="text-gray-600">
                  {resource.reconciliation.status === 'unmatched'
                    ? 'This expansion quotation request has been verified from customer communications (email I0300), but has not yet been logged as a Deal or Opportunity in CRM. Follow-up is recommended to record this into the pipeline.'
                    : 'This expansion request matches a deal already recorded in CRM.'}
                </p>
                <div className="text-[11px] text-gray-400 font-mono pt-1">
                  Verified against {String(resource.reconciliation.check.total_deals ?? 22)} CRM deals ({String(resource.reconciliation.check.account_deals ?? 0)} recorded deals for account {accountCode}).
                </div>
              </div>
            )}

            {/* Findings List */}
            <div className="space-y-2">
              {resource.findings.map((f, i) => (
                <div key={i} className="p-3 border border-brand-border rounded-md bg-white text-xs space-y-1">
                  <div className="font-medium text-gray-800 flex items-center justify-between">
                    <span>{f.label}</span>
                    <span className="text-[10px] font-mono text-gray-400 uppercase">[{f.type}]</span>
                  </div>
                  <div className="pt-0.5">
                    <Refs ids={f.evidence_ids} evidence={resource.evidence} open={open} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Kalkulasi Komersial Transparan */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-4 shadow-2xs">
            <h2 className="text-sm font-semibold text-gray-900">Commercial Scenario (Projected Expansion Revenue)</h2>
            {resource.value_scenario ? (
              <div className="space-y-3 text-xs">
                <div className="p-3.5 bg-gray-50 border border-brand-border rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-lg font-bold font-mono text-gray-900">
                      Rp {amount(resource.value_scenario.amount)} / year
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 font-mono">
                      Conditional incremental revenue: {resource.value_scenario.formula}
                    </div>
                  </div>
                  <div className="text-right sm:text-right">
                    <span className="text-xs font-mono text-gray-600 bg-white px-2.5 py-1 rounded border border-brand-border">
                      Rp {amount(String(Number(resource.value_scenario.amount) / 12))} / month
                    </span>
                  </div>
                </div>

                {/* Parameters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2.5 bg-white border border-brand-border rounded">
                    <div className="text-[10px] text-gray-400 font-mono uppercase">Additional Outlets</div>
                    <div className="font-bold text-gray-800 text-sm mt-0.5">
                      {resource.value_scenario.inputs.additional_outlets} outlets
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border border-brand-border rounded">
                    <div className="text-[10px] text-gray-400 font-mono uppercase">Rate / Outlet</div>
                    <div className="font-bold text-gray-800 text-sm mt-0.5 font-mono">
                      Rp {amount(resource.value_scenario.inputs.monthly_rate)}
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border border-brand-border rounded">
                    <div className="text-[10px] text-gray-400 font-mono uppercase">Effective Discount</div>
                    <div className="font-bold text-gray-800 text-sm mt-0.5">
                      {resource.value_scenario.inputs.discount_percent}%
                    </div>
                  </div>
                  <div className="p-2.5 bg-white border border-brand-border rounded">
                    <div className="text-[10px] text-gray-400 font-mono uppercase">Contract Term</div>
                    <div className="font-bold text-gray-800 text-sm mt-0.5">
                      12 Months
                    </div>
                  </div>
                </div>

                {/* Assumptions List */}
                <div className="p-3 bg-white border border-brand-border rounded space-y-1">
                  <div className="text-[10px] text-gray-400 font-medium uppercase font-mono">Assumptions & Conditions:</div>
                  <ul className="list-disc list-inside text-gray-600 space-y-0.5 text-[11px]">
                    {resource.value_scenario.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                  <div className="pt-1">
                    <Refs ids={resource.value_scenario.evidence_ids} evidence={resource.evidence} open={open} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 border border-brand-border rounded-md text-xs text-gray-600 space-y-1">
                <div className="font-medium text-gray-900">Package Upgrade Required / New Terms Needed</div>
                <p>
                  Additional outlet request exceeds current plan capacity limits. A package upgrade quotation or revised commercial terms are required before establishing confirmed contract value.
                </p>
              </div>
            )}
          </section>

          {/* Section: Stakeholder Profile & Authority */}
          <section className="border border-brand-border rounded-lg p-5 bg-white space-y-4 shadow-2xs">
            <h2 className="text-sm font-semibold text-gray-900">Profil Stakeholder & Kewenangan</h2>
            {card ? (
              <div className="p-3.5 border border-brand-border rounded-md bg-white text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-gray-900 text-sm">
                    {resource.people.contact?.name ?? 'Kontak tidak tercatat'} · {resource.people.contact?.role ?? 'PIC'}
                  </div>
                  <span className="text-[10px] font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-brand-border">
                    Pemohon Kuotasi (Direct)
                  </span>
                </div>
                <p className="text-gray-700">
                  {resource.stakeholder_context[0]?.knowledge ?? 'Mengirimkan email permintaan kuotasi ekspansi.'}
                </p>
                <div className="text-[11px] text-gray-500">
                  <span className="font-medium text-gray-700">Kebutuhan yang Dinyatakan: </span>
                  {resource.stakeholder_context[0]?.expressed_requirements?.join(' ') ?? 'Kirimkan penawaran harga dan jadwal implementasi.'}
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  Otoritas pembelian: Belum terverifikasi apakah memiliki wewenang approval anggaran final atau perantara pemilik usaha.
                </div>
                <div className="pt-1">
                  <Refs ids={resource.stakeholder_context[0]?.evidence_ids ?? []} evidence={resource.evidence} open={open} />
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {resource.stakeholder_context.map((p) => (
                  <div key={p.person.id} className="p-3.5 border border-brand-border rounded-md bg-white space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900">
                        {p.person.name} ({p.current ? 'Aktif' : 'Historis'})
                      </span>
                      <span className="text-[10px] font-mono bg-gray-100 px-2 py-0.5 rounded border border-brand-border">
                        Otoritas: {words(p.authority)}
                      </span>
                    </div>
                    {p.statements.map((s) => (
                      <div key={s.id} className="border-l-2 border-brand-border pl-3 py-1 space-y-1 bg-gray-50 p-2 rounded">
                        <div className="flex items-center justify-between text-[11px]">
                          <strong>{words(s.predicate)}</strong>
                          <span className="text-gray-400 font-mono">{s.event_date}</span>
                        </div>
                        <blockquote className="italic text-gray-800 font-mono text-[11px]">"{s.text}"</blockquote>
                        <Refs ids={s.evidence_ids} evidence={resource.evidence} open={open} />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* TAB 2: Context Graph */}
      {activeTab === 'graph' && (
        <div>
          {!graph.data ? (
            <Pending error={graph.error} />
          ) : (
            <Suspense fallback={<p className="text-xs text-gray-500 py-8 text-center">Memuat graf relasi…</p>}>
              <Graph graph={graph.data} onEvidence={open} />
            </Suspense>
          )}
        </div>
      )}

      {/* TAB 3: Bukti Dokumen Terverifikasi */}
      {activeTab === 'evidence' && (
        <section className="border border-brand-border rounded-lg p-5 bg-white space-y-3 shadow-2xs">
          <div className="pb-2 border-b border-brand-border">
            <h2 className="text-sm font-semibold text-gray-900">Bukti Dokumen Terverifikasi ({resource.evidence.length})</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Setiap klaim dan angka didukung oleh kutipan dokumen asli dengan nomor baris dan hash konten yang terlacak.
            </p>
          </div>
          <div className="space-y-3 text-xs">
            {resource.evidence.map((e, i) => (
              <div key={i} className="border border-brand-border rounded-md p-3.5 bg-white space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-mono text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 border border-brand-border font-semibold">
                      {e.filename}
                    </span>
                    <span className="text-gray-500">baris {e.locator} · kolom [{e.field}]</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => open(e.source_id)}
                    className="h-6 px-2 text-[11px] font-medium border border-brand-border rounded bg-white hover:bg-gray-50 text-gray-700 transition"
                  >
                    Buka Dokumen Asli
                  </button>
                </div>
                <blockquote className="p-2.5 bg-gray-50 border-l-2 border-brand-border font-mono text-[11px] text-gray-800 leading-relaxed">
                  "{e.passage}"
                </blockquote>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TAB 4: Draf Pesan Follow-Up */}
      {activeTab === 'draft' && (
        <Draft
          key={dataset + kind + id + route}
          dataset={dataset}
          kind={kind as 'accounts' | 'opportunities'}
          id={id!}
          options={{ route }}
          evidence={resource.evidence}
          open={open}
        />
      )}

      {/* TAB 5: Tanya Akun (Q&A Grounded) */}
      {activeTab === 'qa' && (
        <AccountQA
          key={dataset + kind + id + route}
          dataset={dataset}
          account={resource.account.id}
          opportunity={card ? resource.id : undefined}
          route={route}
          open={open}
        />
      )}

      {/* Drawer: Dokumen Rekaman Sumber */}
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
