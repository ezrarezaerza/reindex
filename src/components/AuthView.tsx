import React from 'react';
import { Database, User, Lock, KeyRound, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, Info } from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: (token: string, user: { id: number; username: string }) => void;
  onBypass: () => void;
}

export default function AuthView({ onAuthSuccess, onBypass }: AuthViewProps) {
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

  return (
    <div className="flex-1 flex items-center justify-center min-h-[600px] p-6 bg-slate-50" id="auth-view-screen">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden flex flex-col" id="auth-card">
        
        {/* Top visual banner */}
        <div className="px-8 py-6 bg-slate-900 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Database className="w-40 h-40" />
          </div>
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[10px] font-mono text-indigo-300 font-bold tracking-wider uppercase">
              Cloud Catalog Sync Active
            </div>
            <h1 className="text-2xl font-bold font-sans tracking-tight">ReIndex Storage Portal</h1>
            <p className="text-slate-400 text-xs font-sans">
              Connect to your Vercel PostgreSQL database to sync and backup your drive indexes securely.
            </p>
          </div>
        </div>

        {/* Auth form container */}
        <div className="p-8 flex-1 flex flex-col justify-between">
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
