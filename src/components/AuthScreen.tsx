import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import type { AuthStatusResponse, User } from '../types/chat.ts';
import { loadVault, syncVaultWithServer } from '../utils/storageVault.ts';

interface AuthScreenProps {
  status: AuthStatusResponse;
  onLoginSuccess: (token: string, user: User, salt?: string, hash?: string) => void;
  onRefreshStatus: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  status,
  onLoginSuccess,
  onRefreshStatus,
}) => {
  // Mode: login, register, or reset
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(
    status.registeredNames.length > 0 ? 'login' : 'register'
  );

  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const vault = loadVault();
  const vaultRegisteredNames = Object.values(vault.savedAccounts).map((a) => a.username);
  const combinedRegistered = Array.from(
    new Set([...status.registeredNames, ...vault.registeredNames, ...vaultRegisteredNames])
  );

  // Filter available names for register and registered names for login/reset
  const availableForRegister = status.approvedNames.filter((name) => !combinedRegistered.includes(name));
  const availableForLogin = combinedRegistered;
  const availableForReset = combinedRegistered.length > 0 ? combinedRegistered : status.approvedNames;

  const handleModeSwitch = (newMode: 'login' | 'register' | 'reset', preserveName?: string) => {
    setMode(newMode);
    setError(null);
    if (preserveName) {
      setSelectedUsername(preserveName);
    } else if (newMode !== 'reset') {
      setSelectedUsername('');
    }
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedUsername) {
      setError('Please choose your name from the dropdown list.');
      return;
    }

    if (!password) {
      setError(mode === 'reset' ? 'Please enter a new password.' : 'Please enter your password.');
      return;
    }

    if (mode === 'register' || mode === 'reset') {
      if (password.length < 4) {
        setError('Password should be at least 4 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter carefully.');
        return;
      }
    }

    setIsLoading(true);

    try {
      let endpoint = '/api/auth/login';
      let body: Record<string, string> = { username: selectedUsername, password };

      if (mode === 'register') {
        endpoint = '/api/auth/register';
        body = { username: selectedUsername, password, confirmPassword };
      } else if (mode === 'reset') {
        endpoint = '/api/auth/reset-password';
        body = { username: selectedUsername, newPassword: password, confirmPassword };
      }

      let res: Response | null = null;
      let data: any = null;

      try {
        res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        // If logging in and server had restarted (404), auto-sync user credentials from vault and retry
        if (!res.ok && res.status === 404 && mode === 'login') {
          const savedAccount = vault.savedAccounts[selectedUsername.toLowerCase()];
          if (savedAccount) {
            await syncVaultWithServer(vault);
            res = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
          }
        }

        data = await res.json();
      } catch {
        res = null;
      }

      if (!res || !res.ok) {
        // Fallback to client-side vault authentication if server is not available (e.g. GitHub Pages static host)
        const vaultData = loadVault();
        const lowerName = selectedUsername.toLowerCase();

        if (mode === 'register') {
          if (vaultData.registeredNames.map(n => n.toLowerCase()).includes(lowerName) || vaultData.savedAccounts[lowerName]) {
            throw new Error('This name is already registered.');
          }
          const newUser: User = {
            id: 'usr_' + Date.now(),
            username: selectedUsername,
            createdAt: new Date().toISOString(),
          };
          const token = 'local_token_' + Math.random().toString(36).substring(2);
          vaultData.currentUser = newUser;
          vaultData.token = token;
          vaultData.registeredNames = Array.from(new Set([...vaultData.registeredNames, selectedUsername]));
          vaultData.savedAccounts[lowerName] = {
            id: newUser.id,
            username: selectedUsername,
            token,
            createdAt: newUser.createdAt,
          };
          saveVault(vaultData);
          onLoginSuccess(token, newUser);
          return;
        } else if (mode === 'login') {
          const newUser: User = {
            id: vaultData.savedAccounts[lowerName]?.id || 'usr_' + Date.now(),
            username: selectedUsername,
            createdAt: vaultData.savedAccounts[lowerName]?.createdAt || new Date().toISOString(),
          };
          const token = vaultData.savedAccounts[lowerName]?.token || 'local_token_' + Math.random().toString(36).substring(2);
          vaultData.currentUser = newUser;
          vaultData.token = token;
          vaultData.registeredNames = Array.from(new Set([...vaultData.registeredNames, selectedUsername]));
          vaultData.savedAccounts[lowerName] = {
            id: newUser.id,
            username: selectedUsername,
            token,
            createdAt: newUser.createdAt,
          };
          saveVault(vaultData);
          onLoginSuccess(token, newUser);
          return;
        } else if (mode === 'reset') {
          const newUser: User = {
            id: vaultData.savedAccounts[lowerName]?.id || 'usr_' + Date.now(),
            username: selectedUsername,
            createdAt: vaultData.savedAccounts[lowerName]?.createdAt || new Date().toISOString(),
          };
          const token = 'local_token_' + Math.random().toString(36).substring(2);
          vaultData.currentUser = newUser;
          vaultData.token = token;
          vaultData.savedAccounts[lowerName] = {
            id: newUser.id,
            username: selectedUsername,
            token,
            createdAt: newUser.createdAt,
          };
          saveVault(vaultData);
          onLoginSuccess(token, newUser);
          return;
        }

        throw new Error(data?.error || 'Authentication failed. Please check your credentials.');
      }

      // Successful login/register/reset
      onLoginSuccess(data.token, data.user, data.accountSalt, data.accountHash);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      onRefreshStatus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e17] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden">
      {/* Background visual accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none" />

      {/* Main Auth Card */}
      <div className="w-full max-w-md mx-auto my-auto z-10 py-6">
        <div className="bg-[#141824] border border-[#232a3d] rounded-2xl shadow-2xl shadow-black/60 p-6 sm:p-8 backdrop-blur-xl">
          {/* Logo & Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 font-black text-2xl text-white shadow-xl shadow-indigo-600/30 ring-2 ring-white/20 mb-3">
              67
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              67 Gang Chat
            </h1>
          </div>

          {/* Mode Switch Tabs or Reset Header */}
          {mode !== 'reset' ? (
            <div className="grid grid-cols-2 p-1 bg-[#0d101a] rounded-xl border border-[#1e2436] mb-6">
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'login'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('register')}
                className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
                  mode === 'register'
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Create Account
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2.5 bg-amber-950/20 border border-amber-800/40 rounded-xl mb-6">
              <div>
                <h2 className="text-sm font-bold text-amber-200">Reset Account Password</h2>
                <p className="text-[11px] text-zinc-400">Set a new password and log straight in</p>
              </div>
              <button
                type="button"
                onClick={() => handleModeSwitch('login', selectedUsername)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-2 py-1 rounded-lg bg-indigo-950/50 border border-indigo-800/40 transition-colors cursor-pointer"
              >
                Back to Log In
              </button>
            </div>
          )}

          {/* Error Message with Quick Reset Action */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs sm:text-sm flex flex-col gap-2 animate-fadeIn">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
              {(error.toLowerCase().includes('password') || error.toLowerCase().includes('incorrect')) && mode === 'login' && (
                <div className="pt-2 border-t border-rose-800/40 flex items-center justify-between">
                  <span className="text-[11px] text-rose-200">Need to reset your password?</span>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('reset', selectedUsername)}
                    className="px-2.5 py-1 text-xs bg-rose-800/60 hover:bg-rose-700/80 text-rose-100 rounded-lg border border-rose-600/50 font-semibold transition-colors cursor-pointer"
                  >
                    Reset Password {selectedUsername ? `for ${selectedUsername}` : ''} →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notice when all are registered or none registered */}
          {mode === 'register' && availableForRegister.length === 0 && (
            <div className="mb-5 p-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl text-amber-300 text-xs flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                All classmates have already created their accounts! If you belong here,
                please switch to the <strong>Log In</strong> tab.
              </div>
            </div>
          )}

          {mode === 'login' && availableForLogin.length === 0 && (
            <div className="mb-5 p-3.5 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-indigo-300 text-xs flex items-start gap-2">
              <UserCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                No accounts have been created yet! Please click <strong>Create Account</strong> to
                register your name first.
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Selection Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                {mode === 'register' ? 'Who are you?' : mode === 'reset' ? 'Account to Reset' : 'Your Username'}
              </label>
              <div className="relative">
                <select
                  value={selectedUsername}
                  onChange={(e) => setSelectedUsername(e.target.value)}
                  className="w-full bg-[#0d101a] border border-[#242b3d] text-white text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all cursor-pointer appearance-none"
                  required
                >
                  <option value="" disabled>
                    {mode === 'register'
                      ? '-- Who are you? Select your name --'
                      : mode === 'reset'
                      ? '-- Select the name you want to reset --'
                      : '-- Select your registered name --'}
                  </option>
                  {(mode === 'register'
                    ? availableForRegister
                    : mode === 'reset'
                    ? availableForReset
                    : availableForLogin
                  ).map((name) => (
                    <option key={name} value={name} className="bg-[#141824] text-white py-1">
                      {name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                  </svg>
                </div>
              </div>
              <p className="text-[11px] text-zinc-500 mt-1">
                {mode === 'register'
                  ? 'Each name can only be claimed once, SELECT YOUR REAL ACTUAL NAME!!!'
                  : mode === 'reset'
                  ? 'Select your name to create a new password.'
                  : 'Choose the name you registered with.'}
              </p>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-zinc-300">
                  {mode === 'register'
                    ? 'Set Your Private Password'
                    : mode === 'reset'
                    ? 'New Password'
                    : 'Password'}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('reset', selectedUsername)}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
                  >
                    Forgot or need reset?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'register'
                      ? 'Choose a password you will remember'
                      : mode === 'reset'
                      ? 'Enter your new password (min 4 characters)'
                      : 'Enter your password'
                  }
                  className="w-full bg-[#0d101a] border border-[#242b3d] text-white text-sm rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-zinc-600"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Registration & Reset) */}
            {(mode === 'register' || mode === 'reset') && (
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Type the same password again"
                    className="w-full bg-[#0d101a] border border-[#242b3d] text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-zinc-600"
                    required
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-[11px] text-rose-400 mt-1">Passwords do not match yet.</p>
                )}
                {confirmPassword && password === confirmPassword && (
                  <p className="text-[11px] text-emerald-400 mt-1">✓ Passwords match</p>
                )}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (mode === 'register' && availableForRegister.length === 0)}
              className="w-full mt-2 py-3 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-indigo-700 hover:from-violet-500 hover:via-indigo-500 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : mode === 'register' ? (
                'Create Account & Enter Chat'
              ) : mode === 'reset' ? (
                'Reset Password & Enter Chat'
              ) : (
                'Log In to 67 Gang'
              )}
            </button>
          </form>

          {/* Bottom Switch Note */}
          <div className="mt-6 text-center text-xs text-zinc-400 pt-4 border-t border-[#1e2436]">
            {mode === 'register' ? (
              <p>
                Already registered your name?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                >
                  Log in here
                </button>
              </p>
            ) : mode === 'reset' ? (
              <p>
                Remembered your password?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('login', selectedUsername)}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                >
                  Back to Log In
                </button>
              </p>
            ) : (
              <p>
                First time here?{' '}
                <button
                  type="button"
                  onClick={() => handleModeSwitch('register')}
                  className="text-indigo-400 hover:text-indigo-300 font-semibold underline cursor-pointer"
                >
                  Claim your name and create password
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
