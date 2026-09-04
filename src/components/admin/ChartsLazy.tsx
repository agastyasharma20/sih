'use client';

import dynamic from 'next/dynamic';

/**
 * Recharts is ~110 kB and only ever renders below the fold on one screen.
 * Loading it dynamically keeps it out of the shared bundle, so every
 * other page — including the registration form students actually use —
 * stays light. `ssr: false` because the charts measure their container,
 * which means they re-render on the client anyway.
 */
const skeleton = () => (
  <div className="card">
    <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
    <div className="mt-4 h-64 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60" />
  </div>
);

export const RegistrationTrend = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.RegistrationTrend),
  { ssr: false, loading: skeleton },
);

export const CategoryBars = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.CategoryBars),
  { ssr: false, loading: skeleton },
);

export const GenderDonut = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.GenderDonut),
  { ssr: false, loading: skeleton },
);

export const CategoryDonut = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.CategoryDonut),
  { ssr: false, loading: skeleton },
);
