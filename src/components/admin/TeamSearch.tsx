'use client';

import { useMemo, useState, useDeferredValue } from 'react';
import { Search, X } from 'lucide-react';
import { matchesAllWords } from '@/lib/search';

/**
 * Filters the already-rendered team cards in place.
 *
 * The rows are server-rendered so they work without JavaScript; this only
 * hides the ones that do not match. With ~120 teams that is instant, and
 * it avoids duplicating the whole roster markup in a client component.
 */
export function TeamSearch({
  rows,
}: {
  rows: Array<{ id: string; text: string }>;
}) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);

  const hidden = useMemo(() => {
    if (!deferred.trim()) return new Set<string>();
    return new Set(
      rows
        .filter((row) => !matchesAllWords(row.text, deferred))
        // Ids are interpolated into a stylesheet below, so accept only
        // the shape a UUID can take. Anything else is left visible rather
        // than risking a selector that does not close.
        .filter((row) => /^[0-9a-fA-F-]{1,64}$/.test(row.id))
        .map((row) => row.id),
    );
  }, [rows, deferred]);

  const shown = rows.length - hidden.size;

  return (
    <>
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team ID, name, member or enrollment…"
          aria-label="Search teams"
          className="field-input pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {query.trim() && (
        <p aria-live="polite" className="mt-2 text-xs text-slate-500">
          {shown} of {rows.length} teams match
        </p>
      )}

      {/* Hiding by stylesheet keeps the server-rendered rows in the DOM,
          so the list still works with JavaScript disabled. */}
      <style>{[...hidden].map((id) => `[data-team-id="${id}"]`).join(',') + (hidden.size ? '{display:none}' : '')}</style>
    </>
  );
}
