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
  <div className="card" aria-busy="true">
    <div className="skeleton h-4 w-40" />
    <div className="skeleton mt-4 h-64" />
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

export const VelocityChart = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.VelocityChart),
  { ssr: false, loading: skeleton },
);

export const CriterionRadar = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.CriterionRadar),
  { ssr: false, loading: skeleton },
);

export const ScoreHistogram = dynamic(
  () => import('./AnalyticsCharts').then((m) => m.ScoreHistogram),
  { ssr: false, loading: skeleton },
);
