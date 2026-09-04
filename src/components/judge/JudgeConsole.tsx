'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, CheckCircle2, ExternalLink, AlertCircle, Code2, Video, FileText, Network,
} from 'lucide-react';

interface Criterion {
  id: string;
  name: string;
  description: string | null;
  max_marks: number;
}

interface Slot {
  idea_slot: number;
  submission_id: string;
  ps_id: string | null;
  ps_title: string | null;
  github_url: string | null;
  video_url: string | null;
  ppt_url: string | null;
  architecture_url: string | null;
  submitted_at: string | null;
  scored_criteria: number;
}

interface Lookup {
  team: { id: string; team_id_short: string; team_name: string; status: string };
  slots: Slot[];
}

function ArtefactLink({
  href,
  label,
  icon,
}: {
  href: string | null;
  label: string;
  icon: React.ReactNode;
}) {
  if (!href) return null;

  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="btn-secondary py-1.5 text-xs">
      {icon}
      {label}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

export function JudgeConsole({
  criteria,
  judgingOpen,
}: {
  criteria: Criterion[];
  judgingOpen: boolean;
}) {
  const [teamId, setTeamId] = useState('');
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [activeSlot, setActiveSlot] = useState<Slot | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const total = criteria.reduce((sum, c) => sum + Number(c.max_marks), 0);
  const awarded = criteria.reduce((sum, c) => sum + (Number(marks[c.id]) || 0), 0);

  function selectSlot(slot: Slot) {
    setActiveSlot(slot);
    setMarks({});
    setRemarks({});
    setSaved(false);
  }

  async function find(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setLookup(null);
    setActiveSlot(null);
    setBusy(true);

    try {
      const response = await fetch(`/api/scores?team=${encodeURIComponent(teamId.trim())}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message ?? 'Team not found.');
        return;
      }

      setLookup({ team: data.team, slots: data.slots });

      if (data.slots.length === 0) {
        setError('That team has not submitted anything yet.');
      } else if (data.slots.length === 1) {
        // Nothing to choose between — open the only idea directly.
        selectSlot(data.slots[0]);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitScores() {
    if (!activeSlot) return;

    const entries = criteria
      .filter((c) => (marks[c.id] ?? '') !== '')
      .map((c) => ({
        criterion_id: c.id,
        marks_given: Number(marks[c.id]),
        remarks: remarks[c.id] ?? '',
      }));

    if (entries.length !== criteria.length) {
      setError('Enter a mark for every criterion before saving.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: activeSlot.submission_id, scores: entries }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.message ?? 'Could not save scores.');
        return;
      }

      setSaved(true);
    } catch {
      setError('Network error. Your scores were not saved.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={find} className="card">
        <label className="field-label" htmlFor="team-lookup">
          Team ID
        </label>
        <p className="mb-3 text-xs text-slate-500">
          The 3-digit ID the team was given at registration.
        </p>
        <div className="flex gap-3">
          <input
            id="team-lookup"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value.replace(/\D/g, '').slice(0, 3))}
            inputMode="numeric"
            placeholder="001"
            className="field-input max-w-[10rem] text-center font-mono text-2xl font-bold tracking-[0.3em]"
          />
          <button type="submit" disabled={busy || !teamId} className="btn-primary">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Find team
          </button>
        </div>
      </form>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
          >
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {lookup && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-gradient-to-r from-piemr-700 to-sih-navy p-5 text-white">
            <span className="rounded-lg bg-white/15 px-3 py-1.5 font-mono text-xl font-black tracking-widest">
              {lookup.team.team_id_short}
            </span>
            <div>
              <p className="font-bold">{lookup.team.team_name}</p>
              <p className="text-xs text-piemr-200">
                {lookup.slots.length} idea{lookup.slots.length === 1 ? '' : 's'} submitted
              </p>
            </div>
          </div>

          {lookup.slots.length > 1 && (
            <div className="flex gap-2">
              {lookup.slots.map((slot) => (
                <button
                  key={slot.idea_slot}
                  type="button"
                  onClick={() => selectSlot(slot)}
                  className={
                    activeSlot?.idea_slot === slot.idea_slot
                      ? 'rounded-lg bg-piemr-600 px-4 py-2 text-sm font-semibold text-white'
                      : 'rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300'
                  }
                >
                  Idea {slot.idea_slot}
                  {slot.scored_criteria > 0 && ' ✓'}
                </button>
              ))}
            </div>
          )}

          {activeSlot && (
            <>
              <div className="card">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Problem statement
                    </p>
                    <p className="mt-1 font-semibold">
                      {activeSlot.ps_id
                        ? `${activeSlot.ps_id} — ${activeSlot.ps_title}`
                        : 'Not selected'}
                    </p>
                  </div>
                  {activeSlot.scored_criteria > 0 && (
                    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      You have already scored this idea
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ArtefactLink
                    href={activeSlot.github_url}
                    label="GitHub"
                    icon={<Code2 className="h-3.5 w-3.5" />}
                  />
                  <ArtefactLink
                    href={activeSlot.video_url}
                    label="Demo video"
                    icon={<Video className="h-3.5 w-3.5" />}
                  />
                  <ArtefactLink
                    href={activeSlot.ppt_url}
                    label="Slides"
                    icon={<FileText className="h-3.5 w-3.5" />}
                  />
                  <ArtefactLink
                    href={activeSlot.architecture_url}
                    label="Architecture"
                    icon={<Network className="h-3.5 w-3.5" />}
                  />
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Scoring</h2>
                  <span className="font-mono text-sm font-bold">
                    {awarded} / {total}
                  </span>
                </div>

                {!judgingOpen && (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    Judging has not been opened by the administrator yet. You can review the
                    submission, but scores cannot be saved.
                  </p>
                )}

                <div className="mt-5 space-y-5">
                  {criteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="border-b border-slate-200 pb-5 last:border-0 dark:border-slate-800"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex-1">
                          <p className="font-medium">{criterion.name}</p>
                          {criterion.description && (
                            <p className="mt-0.5 text-sm text-slate-500">{criterion.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={criterion.max_marks}
                            step="0.5"
                            value={marks[criterion.id] ?? ''}
                            onChange={(e) => setMarks({ ...marks, [criterion.id]: e.target.value })}
                            className="field-input w-24 text-center font-mono font-bold"
                            aria-label={`Marks for ${criterion.name}`}
                          />
                          <span className="text-sm font-medium text-slate-500">
                            / {criterion.max_marks}
                          </span>
                        </div>
                      </div>
                      <input
                        value={remarks[criterion.id] ?? ''}
                        onChange={(e) => setRemarks({ ...remarks, [criterion.id]: e.target.value })}
                        placeholder="Constructive remarks for the team (optional)"
                        className="field-input mt-3 text-sm"
                        aria-label={`Remarks for ${criterion.name}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={submitScores}
                    disabled={busy || !judgingOpen}
                    className="btn-primary"
                  >
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save scores
                  </button>
                  {saved && (
                    <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" />
                      Saved. You can revise these until judging closes.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
