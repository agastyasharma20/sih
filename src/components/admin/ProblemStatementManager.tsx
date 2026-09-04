'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { ProblemStatement } from '@/lib/types';

const SAMPLE = `PS Number,Problem Statement Title,Category,Theme,Organization
SIH25001,Smart water quality monitoring,Software,Clean Water,Ministry of Jal Shakti
SIH25042,Assistive device for the visually impaired,Hardware,MedTech,Ministry of Social Justice`;

interface ImportResult {
  imported: number;
  deactivated?: number;
  skipped: Array<{ row: number; reason: string }>;
}

export function ProblemStatementManager({
  statements,
}: {
  statements: ProblemStatement[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'import' | 'single'>('import');

  const [text, setText] = useState('');
  const [deactivateMissing, setDeactivateMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const [single, setSingle] = useState({
    ps_id: '',
    title: '',
    category: 'software',
    theme: '',
    description: '',
  });

  async function post(body: unknown) {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/admin/problem-statements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message ?? 'Import failed.');
        if (data.skipped) setResult({ imported: 0, skipped: data.skipped });
        return;
      }

      setResult({ imported: data.imported, deactivated: data.deactivated, skipped: data.skipped ?? [] });
      router.refresh();
    } catch {
      setError('Network error. Nothing was imported.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(id: string, isActive: boolean) {
    await fetch('/api/admin/problem-statements', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: isActive }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="card">
        <div className="mb-5 flex gap-2">
          {(['import', 'single'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={
                tab === value
                  ? 'rounded-lg bg-piemr-600 px-3 py-1.5 text-sm font-semibold text-white'
                  : 'rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:text-piemr-600'
              }
            >
              {value === 'import' ? 'Bulk import' : 'Add one'}
            </button>
          ))}
        </div>

        {tab === 'import' ? (
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="ps-import">
                Paste CSV or spreadsheet rows
              </label>
              <p className="mb-2 text-xs text-slate-500">
                Paste the official SIH list straight from the spreadsheet — its own column
                names are understood, so nothing needs renaming. A header row is required, and{' '}
                <strong>PS Number</strong>, <strong>Problem Statement Title</strong> and{' '}
                <strong>Category</strong> must be present. <strong>Theme</strong>,{' '}
                <strong>Organization</strong> and <strong>Description</strong> are optional but
                power the analytics. Rows with a PS number you already have are updated, not
                duplicated, so re-importing a corrected sheet is safe.
              </p>
              <textarea
                id="ps-import"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={SAMPLE}
                className="field-input font-mono text-xs"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={deactivateMissing}
                onChange={(e) => setDeactivateMissing(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-piemr-600 focus:ring-piemr-500"
              />
              Retire any active statement missing from this list
            </label>
            <p className="-mt-2 text-xs text-slate-500">
              Retiring hides a statement from new teams but keeps it for teams that already
              chose it. Nothing is deleted.
            </p>

            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={() => post({ mode: 'bulk', text, deactivate_missing: deactivateMissing })}
              className="btn-primary"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Import
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="ps-id">PS ID</label>
              <input
                id="ps-id"
                className="field-input"
                value={single.ps_id}
                onChange={(e) => setSingle({ ...single, ps_id: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="ps-cat">Category</label>
              <select
                id="ps-cat"
                className="field-input"
                value={single.category}
                onChange={(e) => setSingle({ ...single, category: e.target.value })}
              >
                <option value="software">Software</option>
                <option value="hardware">Hardware</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ps-title">Title</label>
              <input
                id="ps-title"
                className="field-input"
                value={single.title}
                onChange={(e) => setSingle({ ...single, title: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="ps-theme">Theme</label>
              <input
                id="ps-theme"
                className="field-input"
                value={single.theme}
                onChange={(e) => setSingle({ ...single, theme: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ps-desc">Description</label>
              <textarea
                id="ps-desc"
                rows={3}
                className="field-input"
                value={single.description}
                onChange={(e) => setSingle({ ...single, description: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={busy || !single.ps_id || !single.title}
                onClick={() => post({ mode: 'single', statement: { ...single, is_active: true } })}
                className="btn-primary"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Save problem statement
              </button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
            >
              {error}
            </motion.p>
          )}

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-900 dark:bg-emerald-950/40"
            >
              <p className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-100">
                <CheckCircle2 className="h-4 w-4" />
                Imported {result.imported} problem statement
                {result.imported === 1 ? '' : 's'}
                {result.deactivated ? `, retired ${result.deactivated}` : ''}.
              </p>

              {result.skipped.length > 0 && (
                <div className="mt-3">
                  <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="h-4 w-4" />
                    {result.skipped.length} row{result.skipped.length === 1 ? '' : 's'} skipped
                  </p>
                  <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-amber-900 dark:text-amber-200">
                    {result.skipped.map((entry, i) => (
                      <li key={i}>
                        {entry.row ? `Line ${entry.row}: ` : ''}
                        {entry.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold">
          Current list{' '}
          <span className="text-sm font-normal text-slate-500">
            ({statements.filter((s) => s.is_active).length} active of {statements.length})
          </span>
        </h2>

        {statements.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Nothing imported yet. Until at least one statement exists, teams can only choose
            &ldquo;TBD&rdquo; during registration.
          </p>
        ) : (
          <div className="mt-4 max-h-[28rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900">
                <tr>
                  <th className="pb-2 pr-4">PS ID</th>
                  <th className="pb-2 pr-4">Title</th>
                  <th className="pb-2 pr-4">Category</th>
                  <th className="pb-2 pr-4">Theme</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {statements.map((ps) => (
                  <tr key={ps.id}>
                    <td className="py-2 pr-4 font-mono text-xs font-semibold">{ps.ps_id}</td>
                    <td className="py-2 pr-4">{ps.title}</td>
                    <td className="py-2 pr-4 capitalize">{ps.category}</td>
                    <td className="py-2 pr-4">{ps.theme ?? '—'}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => toggle(ps.id, !ps.is_active)}
                        className={
                          ps.is_active
                            ? 'badge bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'badge bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400'
                        }
                      >
                        {ps.is_active ? 'Active' : 'Retired'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
