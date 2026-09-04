'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, LockOpen, Download } from 'lucide-react';

/** Per-team and bulk lock controls, plus the roster export. */
export function TeamControls({
  teamId,
  locked,
  canLock,
}: {
  teamId: string;
  locked: boolean;
  canLock: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!canLock) return null;

  async function toggle() {
    setBusy(true);
    await fetch('/api/admin/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'team', team_id: teamId, locked: !locked }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="btn-secondary py-1 text-xs"
      title={locked ? 'Allow this team to edit again' : 'Freeze this team’s details'}
    >
      {busy ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : locked ? (
        <LockOpen className="h-3 w-3" />
      ) : (
        <Lock className="h-3 w-3" />
      )}
      {locked ? 'Unlock' : 'Lock'}
    </button>
  );
}

export function TeamBulkActions({ canLock }: { canLock: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<'lock' | 'unlock' | null>(null);

  async function bulk(locked: boolean) {
    setBusy(locked ? 'lock' : 'unlock');
    await fetch('/api/admin/teams', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'all', locked }),
    });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a href="/api/admin/teams/export" className="btn-secondary py-1.5 text-xs">
        <Download className="h-3.5 w-3.5" />
        Export roster (CSV)
      </a>

      {canLock && (
        <>
          <button
            type="button"
            onClick={() => bulk(true)}
            disabled={busy !== null}
            className="btn-secondary py-1.5 text-xs"
          >
            {busy === 'lock' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            Lock all
          </button>
          <button
            type="button"
            onClick={() => bulk(false)}
            disabled={busy !== null}
            className="btn-secondary py-1.5 text-xs"
          >
            {busy === 'unlock' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <LockOpen className="h-3.5 w-3.5" />
            )}
            Unlock all
          </button>
        </>
      )}
    </div>
  );
}
