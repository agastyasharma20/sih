'use client';

import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface TabSection {
  id: string;
  label: string;
  /** Rendered on the server and passed down, so no chart moves to the client. */
  content: ReactNode;
  badge?: number;
}

/**
 * Section switcher for the analytics page.
 *
 * Every panel is server-rendered and handed in as a prop, so switching
 * tabs is a local state change with no fetch and no chart re-mount cost.
 * The moving underline is a shared layout element rather than one
 * transition per tab, which keeps it correct when labels wrap.
 */
export function Tabs({ sections }: { sections: TabSection[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  const current = sections.find((section) => section.id === active) ?? sections[0];
  /**
   * Arrow keys move between tabs and move focus with the selection, which
   * is what the tablist pattern requires — without it the only way to
   * reach the fifth tab from the keyboard is five presses of Tab.
   */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1 };
    const step = keys[event.key];

    let next: number | undefined;
    if (step !== undefined) {
      const index = sections.findIndex((section) => section.id === current?.id);
      next = (index + step + sections.length) % sections.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = sections.length - 1;
    }

    if (next === undefined) return;
    event.preventDefault();
    setActive(sections[next].id);
    // getElementById rather than a selector: section ids come from the
    // page, and one that is not a valid CSS identifier would throw.
    document.getElementById(`tab-${sections[next].id}`)?.focus();
  };

  return (
    <div>
      <div
        role="tablist"
        aria-label="Analytics sections"
        onKeyDown={onKeyDown}
        className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 dark:border-slate-800"
      >
        {sections.map((section) => {
          const selected = section.id === current?.id;

          return (
            <button
              key={section.id}
              role="tab"
              type="button"
              id={`tab-${section.id}`}
              aria-selected={selected}
              aria-controls={`panel-${section.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(section.id)}
              className={`relative shrink-0 rounded-t-lg px-3.5 py-2.5 text-sm font-semibold transition ${
                selected
                  ? 'text-piemr-600 dark:text-piemr-300'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {section.label}
                {section.badge !== undefined && section.badge > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-1.5 text-[10px] font-bold tabular-nums text-amber-600 dark:text-amber-400">
                    {section.badge}
                  </span>
                )}
              </span>
              {selected && (
                <motion.span
                  layoutId="analytics-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-piemr-500"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current?.id}
          role="tabpanel"
          id={`panel-${current?.id}`}
          aria-labelledby={`tab-${current?.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22 }}
          className="pt-6"
        >
          {current?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
