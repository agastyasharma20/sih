'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Loader2, ShieldOff, ShieldCheck, Info, Copy, Check } from 'lucide-react';
import type { UserProfile } from '@/lib/types';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  coordinator: 'Coordinator',
  judge: 'Judge',
  team_lead: 'Participant',
  super_admin: 'Administrator',
};

/** Suggests a strong password so nobody types "piemr123". */
function suggestPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  return Array.from(values, (n) => alphabet[n % alphabet.length]).join('');
}

export function AccountList({ users }: { users: UserProfile[] }) {
  const router = useRouter();
  const [resetting, setResetting] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function send(body: Record<string, unknown>, id: string) {
    setBusy(id);
    setMessage(null);

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    setBusy(null);
    setMessage({
      kind: response.ok && data.ok ? 'ok' : 'error',
      text: data.message ?? (response.ok ? 'Done.' : 'That did not work.'),
    });

    if (response.ok && data.ok) {
      setResetting(null);
      setPassword('');
      router.refresh();
    }
  }

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Accounts</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {users.length} account{users.length === 1 ? '' : 's'}.
          </p>
        </div>
      </div>

      {/* The question this screen gets asked most, answered before it is asked. */}
      <div className="mt-4 flex gap-3 rounded-xl border border-piemr-200 bg-piemr-50 p-4 text-sm dark:border-piemr-900 dark:bg-piemr-950/40">
        <Info className="h-5 w-5 shrink-0 text-piemr-600 dark:text-piemr-400" />
        <div className="text-piemr-900 dark:text-piemr-100">
          <p className="font-semibold">Existing passwords cannot be shown — by anyone</p>
          <p className="mt-0.5 text-piemr-800 dark:text-piemr-200">
            Only a one-way hash is stored, so there is no password here to read. If someone is
            locked out, set them a new one below and pass it on. Every reset is recorded in the
            audit log.
          </p>
        </div>
      </div>

      {message && (
        <p
          className={
            message.kind === 'ok'
              ? 'mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
          }
        >
          {message.text}
        </p>
      )}

      <div className="mt-5 divide-y divide-slate-200 dark:divide-slate-800">
        {users.map((user) => (
          <div key={user.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {user.full_name ?? user.email}
                  {!user.is_active && (
                    <span className="ml-2 badge bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Inactive
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {ROLE_LABEL[user.role] ?? user.role}
                  {user.admin_subtype ? ` · ${user.admin_subtype}` : ''}
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setResetting(resetting === user.id ? null : user.id);
                    setPassword(suggestPassword());
                    setCopied(false);
                    setMessage(null);
                  }}
                  className="btn-secondary py-1 text-xs"
                >
                  <KeyRound className="h-3 w-3" />
                  Reset password
                </button>

                <button
                  type="button"
                  disabled={busy === user.id}
                  onClick={() =>
                    send(
                      { action: 'set_active', user_id: user.id, is_active: !user.is_active },
                      user.id,
                    )
                  }
                  className="btn-secondary py-1 text-xs"
                  title={user.is_active ? 'Revoke access' : 'Restore access'}
                >
                  {busy === user.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : user.is_active ? (
                    <ShieldOff className="h-3 w-3" />
                  ) : (
                    <ShieldCheck className="h-3 w-3" />
                  )}
                  {user.is_active ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {resetting === user.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <label className="field-label" htmlFor={`pw-${user.id}`}>
                      New password for {user.email}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <input
                        id={`pw-${user.id}`}
                        type="text"
                        value={password}
                        minLength={12}
                        onChange={(e) => setPassword(e.target.value)}
                        className="field-input max-w-sm font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(password);
                          setCopied(true);
                        }}
                        className="btn-secondary"
                      >
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        type="button"
                        disabled={busy === user.id || password.length < 12}
                        onClick={() =>
                          send({ action: 'reset_password', user_id: user.id, password }, user.id)
                        }
                        className="btn-primary"
                      >
                        {busy === user.id && <Loader2 className="h-4 w-4 animate-spin" />}
                        Set password
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Generated for you — copy it before saving, because this is the only time
                      it is shown. Hand it over in person or through a channel you trust.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
