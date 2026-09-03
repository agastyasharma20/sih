'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Judges and coordinators do not self-register — an admin creates the
 * account here and passes on the credentials.
 */
export function CreateAccountForm({ canCreateAdmin }: { canCreateAdmin: boolean }) {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    role: 'judge',
    admin_subtype: 'spoc',
    password: '',
  });
  const [status, setStatus] = useState<'idle' | 'busy'>('idle');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus('busy');
    setMessage(null);

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        admin_subtype: form.role === 'admin' ? form.admin_subtype : null,
      }),
    });

    const result = await response.json();
    setStatus('idle');

    if (!response.ok || !result.ok) {
      setMessage({ kind: 'error', text: result.message ?? 'Could not create the account.' });
      return;
    }

    setMessage({
      kind: 'ok',
      text: `Account created for ${result.email}. Share the password with them directly.`,
    });
    setForm({ ...form, full_name: '', email: '', password: '' });
  }

  return (
    <form onSubmit={submit} className="card space-y-5">
      <div>
        <h2 className="text-lg font-bold">Create an account</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Set a strong password and hand it over directly — it is never emailed from here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="acct-name">
            Full name
          </label>
          <input
            id="acct-name"
            required
            className="field-input"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="acct-email">
            Email
          </label>
          <input
            id="acct-email"
            type="email"
            required
            className="field-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="acct-role">
            Role
          </label>
          <select
            id="acct-role"
            className="field-input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            <option value="judge">Judge</option>
            <option value="coordinator">Coordinator</option>
            {canCreateAdmin && <option value="admin">Admin</option>}
          </select>
        </div>

        {form.role === 'admin' && (
          <div>
            <label className="field-label" htmlFor="acct-subtype">
              Admin type
            </label>
            <select
              id="acct-subtype"
              className="field-input"
              value={form.admin_subtype}
              onChange={(e) => setForm({ ...form, admin_subtype: e.target.value })}
            >
              <option value="spoc">SIH SPOC — operational</option>
              <option value="director">Sr. Director — read &amp; analytics</option>
            </select>
          </div>
        )}

        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="acct-password">
            Temporary password
          </label>
          <input
            id="acct-password"
            type="text"
            required
            minLength={12}
            className="field-input font-mono"
            placeholder="At least 12 characters"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
      </div>

      {message && (
        <p
          className={
            message.kind === 'ok'
              ? 'rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
          }
        >
          {message.text}
        </p>
      )}

      <button type="submit" disabled={status === 'busy'} className="btn-primary">
        {status === 'busy' && <Loader2 className="h-4 w-4 animate-spin" />}
        Create account
      </button>
    </form>
  );
}
