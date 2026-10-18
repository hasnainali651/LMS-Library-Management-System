'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export interface CirculationPoint {
  date: string;
  issued: number;
  returned: number;
}

export interface CategoryPoint {
  category: string;
  borrows: number;
}

export interface FineMonthPoint {
  month: string;
  collected: number;
  waived: number;
  pending: number;
}

interface TooltipPayloadEntry {
  dataKey?: string;
  name?: string;
  color?: string;
  value?: number;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}

const ChartTooltip: React.FC<ChartTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--neo-card)] border border-[var(--neo-border-light)] rounded-[var(--neo-r-sm)] px-3.5 py-2.5 [box-shadow:var(--neo-raised)] text-xs min-w-[140px]">
      <p className="text-[var(--neo-text-3)] mb-2 font-semibold">{label}</p>
      {payload.map((entry, idx) => (
        <div key={entry.dataKey || idx} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
            <span className="text-[var(--neo-text-2)] font-medium capitalize">{entry.name}</span>
          </span>
          <span className="font-bold text-[var(--neo-text)] tabular-nums">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

export const CirculationTrendsChart: React.FC<{ data: CirculationPoint[] }> = ({ data }) => {
  return (
    <div className="h-72 w-full" role="img" aria-label="Circulation trends area chart for last 30 days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="issuedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--neo-accent)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--neo-accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="returnedGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--neo-success)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--neo-success)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--neo-shadow-dark)"
            opacity={0.3}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--neo-text-3)' }}
            tickLine={false}
            axisLine={false}
            interval={4}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--neo-text-3)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="issued"
            stroke="var(--neo-accent)"
            strokeWidth={2}
            fill="url(#issuedGrad)"
            name="Issued"
          />
          <Area
            type="monotone"
            dataKey="returned"
            stroke="var(--neo-success)"
            strokeWidth={2}
            fill="url(#returnedGrad)"
            name="Returned"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export const CategoryBorrowsChart: React.FC<{ data: CategoryPoint[] }> = ({ data }) => {
  return (
    <div className="h-72 w-full" role="img" aria-label="Borrow volume by book category chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--neo-shadow-dark)"
            opacity={0.3}
          />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 10, fill: 'var(--neo-text-3)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--neo-text-3)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="borrows" fill="var(--neo-accent)" radius={[6, 6, 0, 0]} name="Borrows" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export const FinesCollectedChart: React.FC<{ data: FineMonthPoint[] }> = ({ data }) => {
  return (
    <div className="h-72 w-full" role="img" aria-label="Fine recovery breakdown chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--neo-shadow-dark)"
            opacity={0.3}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: 'var(--neo-text-3)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--neo-text-3)' }} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="collected" fill="var(--neo-success)" radius={[4, 4, 0, 0]} name="Collected" />
          <Bar dataKey="waived" fill="var(--neo-text-3)" radius={[4, 4, 0, 0]} name="Waived" />
          <Bar dataKey="pending" fill="var(--neo-warning)" radius={[4, 4, 0, 0]} name="Pending" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
