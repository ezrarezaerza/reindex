import React from 'react';
import { Database, User, Lock, KeyRound, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, Info } from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (token: string, user: { id: number; username: string }) => void;
  onBypass: () => void;
  dbStatus: { connected: boolean; error?: string };
}

export default function AuthView({ onAuthSuccess, onBypass, dbStatus }: AuthViewProps) {
  const [isLogin, setIsLogin] = React.useState(true);
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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
              setError('Simulated Account: Username does not exist in local cache.');
              setLoading(false);
              return;
            }
            if (users[trimmedUsername] !== password) {
              setError('Simulated Account: Incorrect local password.');
              setLoading(false);
              return;
            }
            const token = `local_mock_token_${trimmedUsername}`;
            localStorage.setItem('reindex_token', token);
            onAuthSuccess(token, { id: 999, username: trimmedUsername });
          } else {
            if (users[trimmedUsername]) {
              setError('Simulated Account: Username already exists in local cache.');
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

  const [showCloudGuide, setShowCloudGuide] = React.useState(false);

  return (
    <div className="flex-1 flex items-center justify-center min-h-screen p-6 bg-slate-950" id="auth-view-screen">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col animate-in fade-in duration-300" id="auth-card">
        
        {/* Top visual banner */}
        <div className="px-8 py-6 bg-slate-900 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Database className="w-40 h-40" />
          </div>
          <div className="space-y-2">
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
              dbStatus.connected 
                ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-300' 
                : 'bg-amber-500/20 border-amber-400/30 text-amber-300'
            }`}>
              {dbStatus.connected ? '• Online' : 'Local Cache Mode (DB Offline)'}
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight">ReIndex Storage Portal</h1>
            <p className="text-slate-400 text-xs font-sans leading-relaxed">
              {dbStatus.connected 
                ? 'Sign in to sync, search, and manage your drive indexes in the cloud.' 
                : 'Database connection is offline. You can sign in using a Simulated local account or continue offline.'}
            </p>
          </div>
        </div>

        {/* Auth form container */}
        <div className="p-8 flex-1 flex flex-col justify-between">
          
          {/* Guide for database configuration when offline */}
          {!dbStatus.connected && (
            <div className="mb-6 p-3 bg-amber-50/60 border border-amber-200/50 rounded-xl space-y-1.5 text-xs text-amber-800">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Database is currently Offline
                </span>
                <button
                  type="button"
                  onClick={() => setShowCloudGuide(!showCloudGuide)}
                  className="text-amber-700 hover:text-amber-900 font-bold underline cursor-pointer text-[10px] tracking-wide uppercase"
                >
                  {showCloudGuide ? 'Hide Guide' : 'How to connect Cloud DB?'}
                </button>
              </div>
              <p className="text-slate-600 text-[11px] leading-normal">
                Credentials created now will reside safely inside this browser's secure cache only. Nobody on other devices can access or compromise them.
              </p>
              
              {showCloudGuide && (
                <div className="mt-2 pt-2 border-t border-amber-200/50 space-y-2 text-slate-700 text-[11px] leading-relaxed animate-in slide-in-from-top-1 duration-200">
                  <p>
                    To activate <strong>Cloud Mode (Postgres Connected)</strong>:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 font-sans pl-1">
                    <li>Go to your <strong>Vercel Dashboard</strong>.</li>
                    <li>Open your project's <strong>Settings &gt; Environment Variables</strong>.</li>
                    <li>Add a new variable called <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono text-[10px]">POSTGRES_URL</code>.</li>
                    <li>Paste your Vercel/Neon Postgres connection string.</li>
                    <li>Redeploy or restart the server to establish a live secure link.</li>
                  </ol>
                </div>
              )}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Error messaging bar */}
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 text-xs text-rose-700 font-medium" id="auth-error-banner">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label htmlFor="username-input" className="text-[11px] font-bold font-sans uppercase tracking-wider text-slate-500 block">
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
                  placeholder="e.g. engineer_max"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  className="w-full pl-9 pr-4 py-2 text-slate-800 text-sm placeholder:text-slate-400 border border-slate-200 focus:border-indigo-500 rounded-xl bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label htmlFor="password-input" className="text-[11px] font-bold font-sans uppercase tracking-wider text-slate-500 block">
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

            {/* Action buttons */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-indigo-100 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing credentials...</span>
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
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-sans">
                {isLogin ? "First time using ReIndex Cloud?" : "Already have a cloud profile?"}
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

            {/* Bypass Option */}
            <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-xl text-[11px] text-slate-500 space-y-2">
              <div className="flex items-start gap-1.5">
                <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  You can also continue using standard <strong>Local Cache Mode</strong>. Data will remain local to this browser session rather than syncing to Postgres.
                </span>
              </div>
              <button
                type="button"
                onClick={onBypass}
                disabled={loading}
                className="inline-flex items-center gap-1 text-xs text-slate-700 font-bold hover:text-slate-900 cursor-pointer group"
              >
                <span>Continue Offline (Local Cache)</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
