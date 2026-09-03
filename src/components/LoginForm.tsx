'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Mail, KeyRound, CheckCircle2 } from 'lucide-react';

type Mode = 'link' | 'password';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next');

  const [mode, setMode] = useState<Mode>('link');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStatus('busy');

    const endpoint = mode === 'link' ? '/api/auth/otp' : '/api/auth/password';
    const body = mode === 'link' ? { email, next } : { email, password };

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

      router.push(next && next.startsWith('/') ? next : result.redirectTo);
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
        {mode === 'password' && (
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
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-input"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
          {error}
        </p>
      )}

      <button type="submit" disabled={status === 'busy'} className="btn-primary w-full">
        {status === 'busy' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : mode === 'link' ? (
          <Mail className="h-4 w-4" />
        ) : (
          <KeyRound className="h-4 w-4" />
        )}
        {mode === 'link' ? 'Email me a sign-in link' : 'Sign in'}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode(mode === 'link' ? 'password' : 'link');
          setError(null);
        }}
        className="w-full text-center text-sm font-medium text-slate-500 hover:text-piemr-600 dark:text-slate-400"
      >
        {mode === 'link' ? 'Use a password instead' : 'Email me a sign-in link instead'}
      </button>
    </form>
  );
}
