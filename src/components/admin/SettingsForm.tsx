'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

const DATE_KEYS = [
  ['hackathon_date', 'Hackathon day'],
  ['ps_release_date', 'Problem statements released'],
  ['submission_deadline', 'Submission deadline'],
  ['results_date', 'Results published'],
] as const;

const TOGGLE_KEYS = [
  ['registration_open', 'Team registration is open'],
  ['ps_list_published', 'Problem statement list is published'],
] as const;

function asDateValue(value: unknown): string {
  return typeof value === 'string' && value ? value.slice(0, 10) : '';
}

export function SettingsForm({ initial }: { initial: Record<string, unknown> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  const [status, setStatus] = useState<'idle' | 'busy' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus('busy');
    setError(null);

    const updates = [
      ...DATE_KEYS.map(([key]) => ({
        key,
        value: values[key] ? values[key] : null,
      })),
      ...TOGGLE_KEYS.map(([key]) => ({ key, value: values[key] === true })),
      { key: 'event_name', value: values.event_name ?? 'PIEMR Internal Hackathon' },
    ];

    const response = await fetch('/api/admin/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      setError(result.message ?? 'Could not save settings.');
      setStatus('idle');
      return;
    }

    setStatus('saved');
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-6">
      <h2 className="text-lg font-bold">Schedule &amp; switches</h2>

      <div>
        <label className="field-label" htmlFor="event_name">
          Event name
        </label>
        <input
          id="event_name"
          className="field-input max-w-md"
          value={String(values.event_name ?? '')}
          onChange={(e) => setValues({ ...values, event_name: e.target.value })}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {DATE_KEYS.map(([key, label]) => (
          <div key={key}>
            <label className="field-label" htmlFor={key}>
              {label}
            </label>
            <input
              id={key}
              type="date"
              className="field-input"
              value={asDateValue(values[key])}
              onChange={(e) => setValues({ ...values, [key]: e.target.value || null })}
            />
            <p className="mt-1 text-xs text-slate-500">Leave blank while TBD.</p>
          </div>
        ))}
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
        {TOGGLE_KEYS.map(([key, label]) => (
          <label key={key} className="flex items-center gap-3 text-sm font-medium">
            <input
              type="checkbox"
              checked={values[key] === true}
              onChange={(e) => setValues({ ...values, [key]: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-piemr-600 focus:ring-piemr-500"
            />
            {label}
          </label>
        ))}
        <p className="text-xs text-slate-500">
          Closing registration immediately stops new registrations and freezes every team&apos;s
          details — enforced in the database, not just here.
        </p>
      </div>

      {error && <p className="field-error">{error}</p>}

      <div className="flex items-center gap-4">
        <button type="submit" disabled={status === 'busy'} className="btn-primary">
          {status === 'busy' && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </button>
        {status === 'saved' && (
          <span className="text-sm font-medium text-emerald-600">Saved.</span>
        )}
      </div>
    </form>
  );
}
