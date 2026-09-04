'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Slice } from '@/lib/analytics';

/**
 * A single categorical ramp used across every chart, so the same series
 * reads the same colour wherever it appears. Chosen to stay distinguishable
 * in both themes and for the common forms of colour blindness.
 */
const PALETTE = ['#2e63ff', '#ff9933', '#138808', '#8d6bff', '#e0457b', '#00a3a3'];

const axisProps = {
  stroke: 'currentColor',
  tick: { fontSize: 11, fill: 'currentColor' },
  tickLine: false,
} as const;

function ChartFrame({
  title,
  subtitle,
  children,
  empty,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  empty: boolean;
}) {
  return (
    <div className="card">
      <h3 className="text-sm font-bold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4 h-64 text-slate-400">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 10,
    border: '1px solid rgba(148,163,184,.35)',
    fontSize: 12,
    background: 'rgba(255,255,255,.96)',
    color: '#0f172a',
  },
} as const;

export function RegistrationTrend({ data }: { data: Array<{ name: string; total: number }> }) {
  return (
    <ChartFrame
      title="Registrations over time"
      subtitle="Cumulative teams registered"
      empty={data.length === 0}
    >
      <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PALETTE[0]} stopOpacity={0.35} />
            <stop offset="100%" stopColor={PALETTE[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipStyle} />
        <Area
          type="monotone"
          dataKey="total"
          name="Teams"
          stroke={PALETTE[0]}
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ChartFrame>
  );
}

export function CategoryBars({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: Slice[];
}) {
  return (
    <ChartFrame title={title} subtitle={subtitle} empty={data.length === 0}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} horizontal={false} />
        <XAxis type="number" allowDecimals={false} {...axisProps} />
        <YAxis type="category" dataKey="name" width={140} {...axisProps} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'currentColor', opacity: 0.06 }} />
        <Bar dataKey="value" name="Participants" radius={[0, 5, 5, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function CategoryDonut({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle?: string;
  data: Slice[];
}) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ChartFrame title={title} subtitle={subtitle} empty={total === 0}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((slice, index) => (
            <Cell key={slice.name} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </PieChart>
    </ChartFrame>
  );
}

/**
 * Problem-statement demand. Shows the busiest statements plus, crucially,
 * how many nobody has taken — that is what tells the SPOC what to promote
 * before registration closes.
 */
export function PsDemandTable({
  rows,
  untaken,
}: {
  rows: Array<{ ps_id: string; title: string; category: string; theme: string | null; teams: number }>;
  untaken: number;
}) {
  const chosen = rows.filter((row) => row.teams > 0);
  const busiest = Math.max(1, ...rows.map((row) => row.teams));

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">Problem statement demand</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Which statements teams have picked, most popular first.
          </p>
        </div>
        <span
          className={
            untaken > 0
              ? 'badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              : 'badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
          }
        >
          {untaken} with no team yet
        </span>
      </div>

      {chosen.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          No team has chosen a problem statement yet.
        </p>
      ) : (
        <div className="mt-4 max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-900">
              <tr>
                <th className="pb-2 pr-3">PS</th>
                <th className="pb-2 pr-3">Title</th>
                <th className="pb-2 pr-3">Theme</th>
                <th className="pb-2">Teams</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {chosen.map((row) => (
                <tr key={row.ps_id}>
                  <td className="py-2 pr-3 font-mono text-xs font-semibold">{row.ps_id}</td>
                  <td className="py-2 pr-3">
                    <span className="line-clamp-1">{row.title}</span>
                    <span className="text-xs capitalize text-slate-400">{row.category}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{row.theme ?? '—'}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-piemr-500"
                          style={{ width: `${(row.teams / busiest) * 100}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-semibold">{row.teams}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function GenderDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ChartFrame
      title="Gender split"
      subtitle={`${total} participants — every team needs at least one female member`}
      empty={total === 0}
    >
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
          {data.map((slice, index) => (
            <Cell
              key={slice.name}
              fill={slice.name === 'Female' ? PALETTE[1] : PALETTE[index % PALETTE.length]}
            />
          ))}
        </Pie>
        <Tooltip {...tooltipStyle} />
      </PieChart>
    </ChartFrame>
  );
}
