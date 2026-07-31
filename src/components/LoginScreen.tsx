import { useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Lock, Mail, Waves } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function LoginScreen() {
  const { login, error, isSubmitting } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);

  const emailValid = /\S+@\S+\.\S+/.test(email);
  const passwordValid = password.length >= 1;
  const showEmailError = touched && !emailValid;
  const showPasswordError = touched && !passwordValid;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!emailValid || !passwordValid) return;
    try {
      await login(email, password);
    } catch {
      // error state surfaced via useAuth().error
    }
  }

  return (
    <div className="relative flex h-dvh w-full items-center justify-center overflow-hidden bg-(--color-bg) px-4">
      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-(--color-purple) opacity-30 blur-[100px] drift-slow" />
      <div
        className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-(--color-pink) opacity-25 blur-[110px] drift-slow"
        style={{ animationDelay: '-6s' }}
      />

      <form
        onSubmit={handleSubmit}
        className="glass glow-purple relative z-10 w-full max-w-sm rounded-2xl p-8"
        noValidate
      >
        <div className="mb-8 flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-(--color-purple) to-(--color-pink)">
            <Waves className="h-5 w-5 text-white" strokeWidth={2.25} />
          </div>
          <div>
            <p className="font-(family-name:--font-display) text-lg font-semibold leading-none">
              MediaFeed
            </p>
            <p className="mt-1 text-xs text-(--color-text-dim)">Sign in to keep scrolling</p>
          </div>
        </div>

        <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)" htmlFor="email">
          Email
        </label>
        <div className="relative mb-1">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-dim)" />
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={`w-full rounded-lg border bg-(--color-surface-2) py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-(--color-text-dim) focus:border-(--color-pink) ${
              showEmailError ? 'border-red-500/60' : 'border-(--color-border)'
            }`}
          />
        </div>
        {showEmailError && <p className="mb-3 text-xs text-red-400">Enter a valid email address.</p>}
        {!showEmailError && <div className="mb-3" />}

        <label className="mb-1.5 block text-xs font-medium text-(--color-text-dim)" htmlFor="password">
          Password
        </label>
        <div className="relative mb-1">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-dim)" />
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={`w-full rounded-lg border bg-(--color-surface-2) py-2.5 pl-9 pr-9 text-sm outline-none transition placeholder:text-(--color-text-dim) focus:border-(--color-pink) ${
              showPasswordError ? 'border-red-500/60' : 'border-(--color-border)'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-text-dim) hover:text-(--color-text)"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {showPasswordError && (
          <p className="mb-3 text-xs text-red-400">Enter your password.</p>
        )}
        {!showPasswordError && <div className="mb-3" />}

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="mt-2 w-full rounded-lg bg-gradient-to-r from-(--color-purple) to-(--color-pink) py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
