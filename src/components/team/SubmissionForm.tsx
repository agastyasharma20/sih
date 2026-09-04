'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Upload, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
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

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const ACCEPTED = {
  ppt: '.pdf,.ppt,.pptx',
  architecture: '.pdf,.png,.jpg,.jpeg,.webp',
};

export function SubmissionForm({
  teamId,
  slot,
  existing,
  problemStatements,
  submissionsOpen,
  takenPsIds,
}: {
  teamId: string;
  slot: number;
  existing: Submission | null;
  problemStatements: ProblemStatement[];
  submissionsOpen: boolean;
  takenPsIds: string[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [form, setForm] = useState({
    ps_id: existing?.ps_id ?? '',
    ppt_url: existing?.ppt_url ?? '',
    github_url: existing?.github_url ?? '',
    video_url: existing?.video_url ?? '',
    architecture_url: existing?.architecture_url ?? '',
  });
  const [busy, setBusy] = useState<'draft' | 'final' | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const finalised = Boolean(existing?.submitted_at);

  /** Uploads straight to Supabase Storage. The bucket policy scopes writes
   *  to this team's own folder, so the file never passes through our API. */
  async function upload(kind: 'ppt' | 'architecture', file: File) {
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`${file.name} is larger than 25 MB.`);
      return;
    }

    setUploading(kind);
    setError(null);

    const extension = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${teamId}/idea-${slot}-${kind}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from('submissions')
      .upload(path, file, { upsert: true, contentType: file.type || undefined });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setUploading(null);
      return;
    }

    // The bucket is private, so hand judges a time-limited signed link.
    const { data: signed } = await supabase.storage
      .from('submissions')
      .createSignedUrl(path, 60 * 60 * 24 * 30);

    setForm((current) => ({
      ...current,
      [kind === 'ppt' ? 'ppt_url' : 'architecture_url']: signed?.signedUrl ?? '',
    }));
    setUploading(null);
    setMessage(`${file.name} uploaded. Remember to save.`);
  }

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

  const disabled = !submissionsOpen;

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
          {problemStatements.map((ps) => (
            <option
              key={ps.id}
              value={ps.ps_id}
              // The other idea slot cannot reuse this statement.
              disabled={takenPsIds.includes(ps.ps_id) && ps.ps_id !== existing?.ps_id}
            >
              {ps.ps_id} — {ps.title}
              {takenPsIds.includes(ps.ps_id) && ps.ps_id !== existing?.ps_id
                ? ' (used by your other idea)'
                : ''}
            </option>
          ))}
        </select>
        {problemStatements.length === 0 && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            The problem statement list has not been published yet.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`gh-${slot}`}>
            GitHub repository
          </label>
          <input
            id={`gh-${slot}`}
            className="field-input"
            placeholder="https://github.com/team/project"
            value={form.github_url}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, github_url: e.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`vid-${slot}`}>
            Demo video URL
          </label>
          <input
            id={`vid-${slot}`}
            className="field-input"
            placeholder="https://youtu.be/..."
            value={form.video_url}
            disabled={disabled}
            onChange={(e) => setForm({ ...form, video_url: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ['ppt', 'Presentation (PDF or PPTX)', form.ppt_url],
          ['architecture', 'Architecture diagram', form.architecture_url],
        ] as const).map(([kind, label, url]) => (
          <div key={kind}>
            <label className="field-label" htmlFor={`file-${kind}-${slot}`}>
              {label}
            </label>
            <input
              id={`file-${kind}-${slot}`}
              type="file"
              accept={ACCEPTED[kind]}
              disabled={disabled || uploading !== null}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(kind, file);
              }}
              className="field-input file:mr-3 file:rounded-md file:border-0 file:bg-piemr-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-piemr-700"
            />
            {uploading === kind && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Uploading…
              </p>
            )}
            {url && uploading !== kind && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-1 inline-block text-xs font-medium text-piemr-600 underline"
              >
                View uploaded file
              </a>
            )}
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
          {busy === 'draft' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save draft
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={disabled || busy !== null || !form.ps_id}
          className="btn-primary"
        >
          {busy === 'final' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
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
