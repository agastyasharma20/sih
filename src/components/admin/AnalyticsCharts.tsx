'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
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

/* --------------------------------------------------------------- deep views */

/**
 * Daily arrivals as bars against the cumulative line.
 *
 * The cumulative curve alone always climbs and so always looks healthy;
 * the bars underneath are what show a stall.
 */
export function VelocityChart({
  data,
}: {
  data: Array<{ name: string; value: number; total: number }>;
}) {
  return (
    <ChartFrame
      title="Registration velocity"
      subtitle="Teams per day (bars) against the running total (line)"
      empty={data.length === 0}
    >
      <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
        <XAxis dataKey="name" {...axisProps} />
        <YAxis yAxisId="left" allowDecimals={false} {...axisProps} />
        <YAxis yAxisId="right" orientation="right" allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipStyle} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="value" name="New teams" fill={PALETTE[1]} radius={[4, 4, 0, 0]} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="total"
          name="Cumulative"
          stroke={PALETTE[0]}
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ChartFrame>
  );
}

/**
 * Per-criterion averages as a share of each criterion's ceiling.
 *
 * Normalising to a percentage is the point: criteria are worth different
 * marks, so raw averages plotted on one axis would compare nothing.
 */
export function CriterionRadar({
  data,
}: {
  data: Array<{ name: string; utilisation: number }>;
}) {
  return (
    <ChartFrame
      title="Criterion utilisation"
      subtitle="Average marks awarded as a percentage of each criterion's maximum"
      empty={data.length === 0}
    >
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="currentColor" opacity={0.2} />
        <PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: 'currentColor' }} />
        <Tooltip {...tooltipStyle} formatter={(value) => [`${value}%`, 'Utilisation']} />
        <Radar
          name="Utilisation"
          dataKey="utilisation"
          stroke={PALETTE[0]}
          fill={PALETTE[0]}
          fillOpacity={0.28}
        />
      </RadarChart>
    </ChartFrame>
  );
}

/** Distribution of averaged team totals, in fixed bands. */
export function ScoreHistogram({ data, title, subtitle }: { data: Slice[]; title: string; subtitle?: string }) {
  const total = data.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <ChartFrame title={title} subtitle={subtitle} empty={total === 0}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.15} vertical={false} />
        <XAxis dataKey="name" {...axisProps} interval={0} angle={-30} textAnchor="end" height={46} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'currentColor', opacity: 0.06 }} />
        <Bar dataKey="value" name="Teams" fill={PALETTE[3]} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}
