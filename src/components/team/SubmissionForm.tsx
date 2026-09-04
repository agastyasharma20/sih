'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, CheckCircle2, AlertCircle, Save, Info } from 'lucide-react';
import type { ProblemStatement } from '@/lib/types';

interface Submission {
  idea_slot: number;
  ps_id: string | null;
  ppt_url: string | null;
  github_url: string | null;
  video_url: string | null;
  architecture_url: string | null;
  submitted_at: string | null;
}

const LINK_FIELDS = [
  {
    key: 'ppt_url' as const,
    label: 'Presentation (slides)',
    placeholder: 'https://drive.google.com/file/d/...',
    hint: 'Google Drive, OneDrive or a PDF link',
  },
  {
    key: 'architecture_url' as const,
    label: 'Architecture diagram',
    placeholder: 'https://drive.google.com/file/d/...',
    hint: 'An image or PDF link',
  },
  {
    key: 'github_url' as const,
    label: 'GitHub repository',
    placeholder: 'https://github.com/team/project',
    hint: 'Make the repository public',
  },
  {
    key: 'video_url' as const,
    label: 'Demo video',
    placeholder: 'https://youtu.be/...',
    hint: 'YouTube (unlisted is fine) or Drive',
  },
];

export function SubmissionForm({
  slot,
  existing,
  problemStatements,
  submissionsOpen,
  takenPsIds,
}: {
  slot: number;
  existing: Submission | null;
  problemStatements: ProblemStatement[];
  submissionsOpen: boolean;
  takenPsIds: string[];
}) {
  const router = useRouter();

  const [form, setForm] = useState({
    ps_id: existing?.ps_id ?? '',
    ppt_url: existing?.ppt_url ?? '',
    github_url: existing?.github_url ?? '',
    video_url: existing?.video_url ?? '',
    architecture_url: existing?.architecture_url ?? '',
  });
  const [busy, setBusy] = useState<'draft' | 'final' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const finalised = Boolean(existing?.submitted_at);
  const disabled = !submissionsOpen;

  async function save(final: boolean) {
    setBusy(final ? 'final' : 'draft');
    setError(null);
    setMessage(null);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, idea_slot: slot, final }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message ?? 'Could not save.');
        return;
      }

      setMessage(final ? 'Idea submitted.' : 'Draft saved.');
      router.refresh();
    } catch {
      setError('Network error. Nothing was saved.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Idea {slot}</h2>
        {finalised ? (
          <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Submitted {new Date(existing!.submitted_at!).toLocaleDateString('en-IN')}
          </span>
        ) : (
          <span className="badge bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        )}
      </div>

      <div>
        <label className="field-label" htmlFor={`ps-${slot}`}>
          Problem statement
        </label>
        <select
          id={`ps-${slot}`}
          className="field-input"
          value={form.ps_id}
          disabled={disabled}
          onChange={(e) => setForm({ ...form, ps_id: e.target.value })}
        >
          <option value="">Not chosen yet</option>
          {problemStatements.map((ps) => {
            const usedByOtherIdea = takenPsIds.includes(ps.ps_id) && ps.ps_id !== existing?.ps_id;
            return (
              <option key={ps.id} value={ps.ps_id} disabled={usedByOtherIdea}>
                {ps.ps_id} — {ps.title}
                {usedByOtherIdea ? ' (used by your other idea)' : ''}
              </option>
            );
          })}
        </select>
        {problemStatements.length === 0 && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            The problem statement list has not been published yet.
          </p>
        )}
      </div>

      {/* The single most common failure on presentation day is a Drive link
          the judge cannot open, so the warning sits above the inputs. */}
      <div className="flex gap-3 rounded-xl border border-piemr-200 bg-piemr-50 p-4 text-sm dark:border-piemr-900 dark:bg-piemr-950/40">
        <Info className="h-5 w-5 shrink-0 text-piemr-600 dark:text-piemr-400" />
        <div>
          <p className="font-semibold text-piemr-900 dark:text-piemr-100">
            Set every link to &ldquo;Anyone with the link can view&rdquo;
          </p>
          <p className="mt-0.5 text-piemr-800 dark:text-piemr-200">
            Judges open these on the day. A restricted Drive file or a private
            repository counts as nothing submitted. Test each link in a private
            browser window before you submit.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LINK_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="field-label" htmlFor={`${field.key}-${slot}`}>
              {field.label}
            </label>
            <input
              id={`${field.key}-${slot}`}
              type="url"
              inputMode="url"
              className="field-input"
              placeholder={field.placeholder}
              value={form[field.key]}
              disabled={disabled}
              onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">{field.hint}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.p>
        )}
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {message}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={disabled || busy !== null}
          className="btn-secondary"
        >
          {busy === 'draft' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save draft
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={disabled || busy !== null || !form.ps_id}
          className="btn-primary"
        >
          {busy === 'final' ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {finalised ? 'Update submission' : 'Submit idea'}
        </button>
      </div>

      {!form.ps_id && (
        <p className="text-xs text-slate-500">
          Choose a problem statement to enable submission. Drafts save without one.
        </p>
      )}
    </div>
  );
}
