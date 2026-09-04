'use client';

import { useMemo, useState, useDeferredValue } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Cpu, Code2 } from 'lucide-react';
import type { ProblemStatement } from '@/lib/types';
import { fadeUp, fadeIn, stagger } from '@/lib/motion';

/**
 * With a few hundred results a per-card stagger would take seconds to
 * finish, so only the first screenful is staggered and the rest simply
 * fade with the container.
 */
const STAGGERED_CARDS = 8;
const STAGGER_GAP = 0.04;

interface Props {
  statements: Array<ProblemStatement & { organisation?: string | null }>;
}

type Category = 'all' | 'software' | 'hardware';

/**
 * Browser for the full SIH catalogue — 226 statements in 2026, which is
 * far too many to scan. Everything filters client-side from one payload:
 * no request per keystroke, and it stays responsive on a phone.
 *
 * useDeferredValue keeps typing smooth by letting React re-render the
 * (large) result list at a lower priority than the input itself.
 */
export function ProblemStatementBrowser({ statements }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [theme, setTheme] = useState<string>('all');
  const deferredQuery = useDeferredValue(query);

  const themes = useMemo(
    () =>
      [...new Set(statements.map((s) => s.theme).filter(Boolean))].sort() as string[],
    [statements],
  );

  const results = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();

    return statements.filter((ps) => {
      if (category !== 'all' && ps.category !== category) return false;
      if (theme !== 'all' && ps.theme !== theme) return false;
      if (!needle) return true;

      // Search the fields someone would actually type: the PS number,
      // the title, its theme, and the sponsoring ministry.
      return (
        ps.ps_id.toLowerCase().includes(needle) ||
        ps.title.toLowerCase().includes(needle) ||
        (ps.theme ?? '').toLowerCase().includes(needle) ||
        (ps.organisation ?? '').toLowerCase().includes(needle) ||
        (ps.description ?? '').toLowerCase().includes(needle)
      );
    });
  }, [statements, deferredQuery, category, theme]);

  const filtered = query !== '' || category !== 'all' || theme !== 'all';

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-6 bg-slate-50/85 px-6 py-4 backdrop-blur dark:bg-sih-navy/85">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by PS number, title, theme or ministry…"
            aria-label="Search problem statements"
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(
            [
              ['all', 'All', null],
              ['software', 'Software', <Code2 key="s" className="h-3 w-3" />],
              ['hardware', 'Hardware', <Cpu key="h" className="h-3 w-3" />],
            ] as const
          ).map(([value, label, icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              className={
                category === value
                  ? 'inline-flex items-center gap-1.5 rounded-full bg-piemr-600 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'inline-flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-piemr-400 dark:border-slate-700 dark:text-slate-300'
              }
            >
              {icon}
              {label}
            </button>
          ))}

          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            aria-label="Filter by theme"
            className="field-input h-auto w-auto max-w-[15rem] py-1.5 text-xs"
          >
            <option value="all">All themes</option>
            {themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {filtered && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setCategory('all');
                setTheme('all');
              }}
              className="text-xs font-medium text-slate-500 underline hover:text-piemr-600"
            >
              Reset
            </button>
          )}
        </div>

        <p aria-live="polite" className="mt-3 text-xs text-slate-500">
          Showing <strong>{results.length}</strong> of {statements.length} problem statements
        </p>
      </div>

      {results.length === 0 ? (
        <p className="mt-10 text-center text-sm text-slate-500">
          Nothing matches that. Try a different word, or reset the filters.
        </p>
      ) : (
        <motion.div
          key={`${deferredQuery}-${category}-${theme}`}
          initial="hidden"
          animate="show"
          variants={stagger(STAGGER_GAP)}
          className="mt-5 grid gap-4 md:grid-cols-2"
        >
          <AnimatePresence mode="popLayout">
            {results.map((ps, index) => (
              // Only the cards near the top are worth staggering. Beyond
              // that they are below the fold, and animating hundreds of
              // them costs far more than it conveys.
              <motion.article
                key={ps.id}
                variants={index < STAGGERED_CARDS ? fadeUp : fadeIn}
                className="card"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-piemr-600 px-2 py-1 font-mono text-xs font-bold text-white">
                    {ps.ps_id}
                  </span>
                  <span className="badge bg-slate-100 capitalize text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {ps.category}
                  </span>
                  {ps.theme && (
                    <span className="badge bg-sih-saffron/15 text-sih-saffron">{ps.theme}</span>
                  )}
                </div>

                <h2 className="mt-3 font-semibold leading-snug">{ps.title}</h2>

                {ps.organisation && (
                  <p className="mt-1 text-xs font-medium text-slate-500">{ps.organisation}</p>
                )}

                {ps.description && (
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {ps.description}
                  </p>
                )}
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
