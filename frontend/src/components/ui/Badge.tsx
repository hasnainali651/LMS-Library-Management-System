import React from 'react';
import { BookStatus, STATUS_STYLES } from '@/lib/tokens';
import { cn } from '@/lib/utils';
export { NeoBadge } from './Neo';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BookStatus | string;
  color?: 'green' | 'blue' | 'amber' | 'red' | 'orange' | 'gray' | 'purple' | 'accent' | 'default';
  showDot?: boolean;
  inset?: boolean;
}

const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
  green: {
    bg: 'bg-[var(--neo-success-surface)]',
    text: 'text-[var(--neo-success)]',
    dot: 'bg-[var(--neo-success)]',
  },
  blue: {
    bg: 'bg-[var(--neo-info-surface)]',
    text: 'text-[var(--neo-info)]',
    dot: 'bg-[var(--neo-info)]',
  },
  amber: {
    bg: 'bg-[var(--neo-warning-surface)]',
    text: 'text-[var(--neo-warning)]',
    dot: 'bg-[var(--neo-warning)]',
  },
  red: {
    bg: 'bg-[var(--neo-danger-surface)]',
    text: 'text-[var(--neo-danger)]',
    dot: 'bg-[var(--neo-danger)]',
  },
  orange: {
    bg: 'bg-[var(--neo-warning-surface)]',
    text: 'text-[var(--neo-warning)]',
    dot: 'bg-[var(--neo-warning)]',
  },
  gray: {
    bg: 'bg-[var(--neo-surface)]',
    text: 'text-[var(--neo-text-2)]',
    dot: 'bg-[var(--neo-text-3)]',
  },
  purple: {
    bg: 'bg-[var(--neo-surface)]',
    text: 'text-[var(--neo-accent)]',
    dot: 'bg-[var(--neo-accent)]',
  },
  accent: {
    bg: 'bg-[var(--neo-surface)]',
    text: 'text-[var(--neo-accent)]',
    dot: 'bg-[var(--neo-accent)]',
  },
  default: {
    bg: 'bg-[var(--neo-surface)]',
    text: 'text-[var(--neo-text-2)]',
    dot: 'bg-[var(--neo-text-3)]',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  status,
  color,
  showDot = true,
  inset = false,
  children,
  className,
  ...props
}) => {
  let resolvedStyle = colorMap.gray;
  let label = children;

  if (status && status in STATUS_STYLES) {
    const validStatus = status as BookStatus;
    const s = STATUS_STYLES[validStatus];
    resolvedStyle = {
      bg: s.bg,
      text: s.text,
      dot: s.dot,
    };
    if (!label) {
      label = status.charAt(0).toUpperCase() + status.slice(1);
    }
  } else if (color && color in colorMap) {
    resolvedStyle = colorMap[color];
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-0.5 rounded-[var(--neo-r-full)] text-[11px] font-semibold tracking-wide select-none transition-colors',
        inset ? 'neo-badge-inset' : 'neo-badge',
        resolvedStyle.bg,
        resolvedStyle.text,
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', resolvedStyle.dot)}
          aria-hidden="true"
        />
      )}
      <span>{label || children}</span>
    </span>
  );
};
