import React from 'react';
import { 
  Database, 
  User, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowRight, 
  Loader2, 
  Info, 
  Cloud, 
  CloudOff, 
  CheckCircle2, 
  Settings 
} from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (token: string, user: { id: number; username: string }) => void;
  onBypass: () => void;
  dbStatus: { connected: boolean; error?: string };
  onRefreshDbStatus?: () => Promise<any>;
}

export default function AuthView({ 
  onAuthSuccess, 
  onBypass, 
  dbStatus, 
  onRefreshDbStatus 
}: AuthViewProps) {
  // Tabs: 'credentials' for normal Login/Register, 'setup' for Postgres URL connector
  const [activeTab, setActiveTab] = React.useState<'credentials' | 'setup'>(
    dbStatus.connected ? 'credentials' : 'setup'
  );
  
  const [isLogin, setIsLogin] = React.useState(true);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // Connection Setup States
  const [postgresUrl, setPostgresUrl] = React.useState('');
  const [setupLoading, setSetupLoading] = React.useState(false);
  const [setupFeedback, setSetupFeedback] = React.useState<{ success: boolean; message: string } | null>(null);

  // If the DB connectivity changes on parent update, align tab
  React.useEffect(() => {
    if (dbStatus.connected) {
      setActiveTab('credentials');
    }
  }, [dbStatus.connected]);

  // Handle Cloud Account Authentication
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError('Please provide both username and password.');
      return;
    }

    if (trimmedUsername.length < 3) {
      setError('Username must be at least 3 characters long.');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setLoading(true);

    if (!dbStatus.connected) {
      // Simulate local auth in localStorage when database is offline
      setTimeout(() => {
        try {
          const localUsersKey = 'reindex_simulated_users';
          const rawUsers = localStorage.getItem(localUsersKey);
          const users = rawUsers ? JSON.parse(rawUsers) : {};

          if (isLogin) {
            if (!users[trimmedUsername]) {
              setError('Simulated Profile Error: This username is not registered in this browser.');
              setLoading(false);
              return;
            }
            if (users[trimmedUsername] !== password) {
              setError('Simulated Profile Error: Incorrect password.');
              setLoading(false);
              return;
            }
            const token = `local_mock_token_${trimmedUsername}`;
            localStorage.setItem('reindex_token', token);
            onAuthSuccess(token, { id: 999, username: trimmedUsername });
          } else {
            if (users[trimmedUsername]) {
              setError('Simulated Profile Error: This username is already registered in this browser.');
              setLoading(false);
              return;
            }
            users[trimmedUsername] = password;
            localStorage.setItem(localUsersKey, JSON.stringify(users));
            const token = `local_mock_token_${trimmedUsername}`;
            localStorage.setItem('reindex_token', token);
            onAuthSuccess(token, { id: 999, username: trimmedUsername });
          }
        } catch (err: any) {
          setError('Failed to run local authentication simulation.');
        } finally {
          setLoading(false);
        }
      }, 500);
      return;
    }

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: trimmedUsername, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed. Please try again.');
      }

      // Save token to localStorage
      localStorage.setItem('reindex_token', data.token);
      
      // Notify parent app
      onAuthSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Dynamic DB Connection Submission
  const handleSetupConnection = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupFeedback(null);

    const trimmedUrl = postgresUrl.trim();
    if (!trimmedUrl) {
      setSetupFeedback({ success: false, message: 'Please enter a valid PostgreSQL connection string.' });
      return;
    }

    setSetupLoading(true);

    try {
      const res = await fetch('/api/connect-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postgresUrl: trimmedUrl })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify connection to the database.');
      }

      setSetupFeedback({ 
        success: true, 
        message: 'Success! Connection established and schemas initialized.' 
      });

      // Refresh parent app's DB status
      if (onRefreshDbStatus) {
        await onRefreshDbStatus();
      }

      // Automatically shift back to credentials tab after a brief delay
      setTimeout(() => {
        setActiveTab('credentials');
        setSetupFeedback(null);
      }, 1500);

    } catch (err: any) {
      setSetupFeedback({ 
        success: false, 
        message: err.message || 'Database connection test failed. Verify the URL string.' 
      });
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen p-6 bg-slate-950" id="auth-view-screen">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col animate-in fade-in duration-300" id="auth-card">
        
        {/* Top visual banner */}
        <div className="px-8 py-6 bg-slate-900 text-white relative shrink-0">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Database className="w-40 h-40" />
          </div>
          <div className="space-y-2">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
              dbStatus.connected 
                ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' 
                : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
            }`}>
              {dbStatus.connected ? 'Vercel Postgres Connected' : 'Local Cache Mode (DB Offline)'}
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight">ReIndex Storage Portal</h1>
            <p className="text-slate-400 text-xs font-sans leading-relaxed">
              {dbStatus.connected 
                ? 'Authenticate securely to sync and search your hard drive catalogs in the cloud.' 
                : 'Your cloud connection is currently offline. Setup cloud parameters or proceed with a secure local workspace.'}
            </p>
          </div>
        </div>

        {/* Tab Segment Toggles */}
        <div className="px-8 pt-6 pb-2 shrink-0">
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/60" id="auth-tabs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('credentials');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'credentials' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>{dbStatus.connected ? 'Account Sign In' : 'Simulated Profile'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('setup');
                setSetupFeedback(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'setup' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Connection Manager</span>
            </button>
          </div>
        </div>

        {/* Active view layout content */}
        <div className="p-8 flex-1 flex flex-col justify-between">
          
          {activeTab === 'credentials' ? (
            /* --- Tab 1: Login / Register Panel --- */
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Context notification */}
              {!dbStatus.connected && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/50 rounded-xl space-y-1 text-[11px] text-amber-800">
                  <p className="font-semibold flex items-center gap-1">
                    <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                    Offline Local Profile Sandbox
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    Profiles made in offline mode are saved <strong>only inside your browser's private storage sandbox</strong>. They will never leak to other devices or users.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error messaging bar */}
                {error && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-medium animate-shake" id="auth-error-banner">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Username Input */}
                <div className="space-y-1.5">
                  <label htmlFor="username-input" className="text-[10px] font-bold font-sans uppercase tracking-wider text-slate-500 block">
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="username-input"
                      type="text"
                      required
                      placeholder={dbStatus.connected ? "Enter your cloud username" : "Create simulated username"}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                      className="w-full pl-9 pr-4 py-2 text-slate-800 text-sm placeholder:text-slate-400 border border-slate-200 focus:border-indigo-500 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label htmlFor="password-input" className="text-[10px] font-bold font-sans uppercase tracking-wider text-slate-500 block">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="w-full pl-9 pr-10 py-2 text-slate-800 text-sm placeholder:text-slate-400 border border-slate-200 focus:border-indigo-500 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Action Submit */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-indigo-150 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing Profile...</span>
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-4 h-4" />
                        <span>{isLogin ? 'Sign In to Workspace' : 'Create New Account'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Toggle Register / Login */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-sans">
                  {isLogin ? "First time using ReIndex?" : "Already have a profile?"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                  }}
                  disabled={loading}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold cursor-pointer underline underline-offset-2"
                >
                  {isLogin ? 'Register account' : 'Sign in instead'}
                </button>
              </div>

            </div>
          ) : (
            /* --- Tab 2: Dynamic DB Setup Panel --- */
            <div className="space-y-4 animate-in fade-in duration-200">
              
              <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1.5 text-xs text-indigo-800">
                <div className="font-semibold flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-indigo-600" />
                  Cloud Database Setup Manager
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Provide a valid connection string to connect your workspace directly to <strong>Vercel Postgres</strong> or <strong>Neon PostgreSQL</strong>.
                </p>
              </div>

              <form onSubmit={handleSetupConnection} className="space-y-4">
                
                {/* Feedback Toast */}
                {setupFeedback && (
                  <div className={`p-3 border rounded-xl flex items-start gap-2.5 text-xs font-medium ${
                    setupFeedback.success 
                      ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                      : 'bg-rose-50 border-rose-100 text-rose-800'
                  }`} id="setup-feedback-alert">
                    {setupFeedback.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{setupFeedback.message}</span>
                  </div>
                )}

                {/* Database URL Field */}
                <div className="space-y-1.5">
                  <label htmlFor="postgres-url-input" className="text-[10px] font-bold font-sans uppercase tracking-wider text-slate-500 block">
                    PostgreSQL Connection URL (POSTGRES_URL)
                  </label>
                  <textarea
                    id="postgres-url-input"
                    rows={3}
                    required
                    disabled={setupLoading}
                    placeholder="postgres://default:pass@ep-cool-rock-1234.us-east-1.postgres.vercel-storage.com:5432/verceldb?sslmode=require"
                    value={postgresUrl}
                    onChange={(e) => setPostgresUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-slate-800 text-xs placeholder:text-slate-400 border border-slate-200 focus:border-indigo-500 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none font-mono resize-none leading-relaxed"
                  />
                </div>

                {/* Setup Button */}
                <button
                  type="submit"
                  disabled={setupLoading}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-indigo-150 disabled:opacity-75 disabled:cursor-not-allowed"
                >
                  {setupLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Testing connection parameters...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-4 h-4" />
                      <span>Test & Establish Connection</span>
                    </>
                  )}
                </button>
              </form>

              {/* Instructions box */}
              <div className="pt-4 border-t border-slate-100 space-y-2 text-[11px] text-slate-600 leading-relaxed">
                <p className="font-semibold text-slate-700">How to locate your credentials:</p>
                <ol className="list-decimal list-inside space-y-1 pl-1">
                  <li>Navigate to your <strong>Vercel Project Dashboard</strong>.</li>
                  <li>Click on the <strong>Storage</strong> tab and select your Postgres instance.</li>
                  <li>Copy the <strong>.env connection string</strong> (starting with `postgres://`).</li>
                  <li>Paste the full URL above to activate instant multi-device sync!</li>
                </ol>
              </div>

            </div>
          )}

          {/* Bypass Option Footer */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl text-[11px] text-slate-500 space-y-2">
              <div className="flex items-start gap-1.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  No Postgres database? You can bypass setup entirely to index files in <strong>Offline Local Mode</strong> immediately.
                </span>
              </div>
              <button
                type="button"
                onClick={onBypass}
                disabled={loading || setupLoading}
                className="inline-flex items-center gap-1 text-xs text-slate-700 font-bold hover:text-slate-900 cursor-pointer group"
              >
                <span>Continue Offline (Local Sandbox)</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
