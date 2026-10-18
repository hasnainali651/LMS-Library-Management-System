import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
export { NeoStatCard } from './Neo';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  number: string | number;
  label: string;
  trend?: {
    value: string | number;
    direction?: 'up' | 'down' | 'neutral';
    label?: string;
  };
  icon?: LucideIcon;
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'sky' | 'purple';
}

const colorThemes: Record<string, { iconText: string; iconBg: string }> = {
  primary: {
    iconText: 'text-[var(--neo-accent)]',
    iconBg: 'bg-[var(--neo-surface)]',
  },
  emerald: {
    iconText: 'text-[var(--neo-success)]',
    iconBg: 'bg-[var(--neo-success-surface)]',
  },
  amber: {
    iconText: 'text-[var(--neo-warning)]',
    iconBg: 'bg-[var(--neo-warning-surface)]',
  },
  rose: {
    iconText: 'text-[var(--neo-danger)]',
    iconBg: 'bg-[var(--neo-danger-surface)]',
  },
  sky: {
    iconText: 'text-[var(--neo-info)]',
    iconBg: 'bg-[var(--neo-info-surface)]',
  },
  purple: {
    iconText: 'text-[var(--neo-accent)]',
    iconBg: 'bg-[var(--neo-surface)]',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  number,
  label,
  trend,
  icon: Icon,
  color = 'primary',
  className,
  ...props
}) => {
  const theme = colorThemes[color] || colorThemes.primary;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] p-5 md:p-6 [box-shadow:var(--neo-raised)] hover:[box-shadow:var(--neo-raised-lg)] border border-[var(--neo-border-light)] transition-all duration-200',
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)]">
            {label}
          </p>
          <p className="font-display text-2xl md:text-3xl font-bold tracking-tight text-[var(--neo-text)] tabular-nums leading-none">
            {number}
          </p>
        </div>

        {Icon && (
          <div
            className={cn(
              'w-11 h-11 rounded-[var(--neo-r-sm)] flex items-center justify-center shrink-0 border border-[var(--neo-border-light)] [box-shadow:var(--neo-flat)]',
              theme.iconBg,
              theme.iconText
            )}
          >
            <Icon className="w-5 h-5 stroke-[2]" />
          </div>
        )}
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-1.5 text-xs font-medium pt-3 border-t border-[var(--neo-shadow-dark)]/25">
          {trend.direction === 'up' ? (
            <span className="flex items-center gap-0.5 text-[var(--neo-success)] font-semibold tabular-nums">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+{trend.value}</span>
            </span>
          ) : trend.direction === 'down' ? (
            <span className="flex items-center gap-0.5 text-[var(--neo-danger)] font-semibold tabular-nums">
              <TrendingDown className="w-3.5 h-3.5" />
              <span>{trend.value}</span>
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-[var(--neo-text-3)] font-medium">
              <Minus className="w-3.5 h-3.5" />
              <span>{trend.value}</span>
            </span>
          )}
          {trend.label && (
            <span className="text-[var(--neo-text-3)]">{trend.label}</span>
          )}
        </div>
      )}
    </div>
  );
};
