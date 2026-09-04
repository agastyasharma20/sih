'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, KeyRound, CheckCircle2, UserPlus } from 'lucide-react';

/**
 * One form for every role. Password is the default because the free
 * Supabase plan rate-limits auth emails to a few per hour, which ~120
 * team leads signing in at once would exhaust. The sign-in link stays
 * available for anyone who prefers it.
 */
type Mode = 'password' | 'signup' | 'link';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('busy');

    const endpoint =
      mode === 'link' ? '/api/auth/otp' : mode === 'signup' ? '/api/auth/signup' : '/api/auth/password';

    const body =
      mode === 'link'
        ? { email, next }
        : mode === 'signup'
          ? { email, password, full_name: fullName }
          : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        setError(result.message ?? 'Something went wrong. Please try again.');
        setStatus('idle');
        return;
      }

      if (mode === 'link') {
        setStatus('sent');
        return;
      }

      // A freshly created account that could not be auto-signed-in falls
      // back to the password form rather than stranding the user.
      if (mode === 'signup' && result.signedIn === false) {
        setMode('password');
        setStatus('idle');
        setError(result.message ?? 'Account created. Please sign in.');
        return;
      }

      router.push(next && next.startsWith('/') ? next : (result.redirectTo ?? '/dashboard'));
      router.refresh();
    } catch {
      setError('Network error. Please check your connection and try again.');
      setStatus('idle');
    }
  }

  if (status === 'sent') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950/40"
      >
        <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        <h2 className="mt-3 font-semibold text-emerald-900 dark:text-emerald-100">
          Check your inbox
        </h2>
        <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
          We sent a sign-in link to <strong>{email}</strong>. It expires shortly, so use it soon.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="mt-4 text-sm font-semibold text-emerald-700 underline dark:text-emerald-300"
        >
          Use a different email
        </button>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-4">
      <AnimatePresence initial={false}>
        {mode === 'signup' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <label htmlFor="full_name" className="field-label">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              autoComplete="name"
              required={mode === 'signup'}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="field-input"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <label htmlFor="email" className="field-label">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@piemr.edu.in"
          className="field-input"
        />
      </div>

      <AnimatePresence initial={false}>
        {mode !== 'link' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={mode === 'signup' ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
            />
            {mode === 'signup' && (
              <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p
          role="alert"
          className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
        >
          {error}
        </p>
      )}

      <button type="submit" disabled={status === 'busy'} className="btn-primary w-full">
        {status === 'busy' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === 'link' ? (
          <Mail className="h-4 w-4" />
        ) : mode === 'signup' ? (
          <UserPlus className="h-4 w-4" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        {mode === 'link'
          ? 'Email me a sign-in link'
          : mode === 'signup'
            ? 'Create my account'
            : 'Sign in'}
      </button>

      <div className="space-y-2 pt-1 text-center text-sm">
        {mode !== 'signup' ? (
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
            }}
            className="block w-full font-medium text-piemr-600 hover:text-piemr-700"
          >
            New participant? Create an account
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode('password');
              setError(null);
            }}
            className="block w-full font-medium text-piemr-600 hover:text-piemr-700"
          >
            Already have an account? Sign in
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'link' ? 'password' : 'link');
            setError(null);
          }}
          className="block w-full text-slate-500 hover:text-piemr-600 dark:text-slate-400"
        >
          {mode === 'link' ? 'Use a password instead' : 'Email me a sign-in link instead'}
        </button>
      </div>
    </form>
  );
}
