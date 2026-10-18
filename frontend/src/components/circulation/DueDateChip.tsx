'use client';

import React from 'react';
import { formatDistanceToNow, format, differenceInCalendarDays, isPast, parseISO } from 'date-fns';
import { Clock, AlertTriangle, CalendarCheck, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip } from '@/components/ui/Tooltip';

export interface DueDateChipProps {
  dueDate: string | Date;
  className?: string;
  showIcon?: boolean;
}

export const DueDateChip: React.FC<DueDateChipProps> = ({
  dueDate,
  className,
  showIcon = true,
}) => {
  const targetDate = typeof dueDate === 'string' ? parseISO(dueDate) : dueDate;
  const isValidDate = targetDate instanceof Date && !isNaN(targetDate.getTime());

  if (!isValidDate) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-[var(--neo-r-full)] text-xs font-semibold bg-[var(--neo-surface)] text-[var(--neo-text-3)] border border-[var(--neo-border-light)]">
        No due date
      </span>
    );
  }

  const now = new Date();
  const daysDiff = differenceInCalendarDays(targetDate, now);
  const isOverdue = daysDiff < 0 || (daysDiff === 0 && isPast(targetDate));

  let variant: 'green' | 'amber' | 'red' = 'green';
  let label = '';
  let Icon = CalendarCheck;

  if (isOverdue) {
    variant = 'red';
    Icon = AlertTriangle;
    const distance = formatDistanceToNow(targetDate, { addSuffix: true });
    label = distance.startsWith('about ') ? distance.replace('about ', '') : distance;
    if (!label.toLowerCase().includes('ago') && !label.toLowerCase().includes('overdue')) {
      label = `Overdue (${label})`;
    }
  } else if (daysDiff < 3) {
    variant = 'amber';
    Icon = Clock;
    const distance = formatDistanceToNow(targetDate, { addSuffix: true });
    label = `Due ${distance}`;
  } else {
    variant = 'green';
    Icon = Calendar;
    const distance = formatDistanceToNow(targetDate, { addSuffix: true });
    label = `Due ${distance}`;
  }

  const styleMap = {
    green: {
      bg: 'bg-[var(--neo-success-surface)] text-[var(--neo-success)] border-[var(--neo-success)]/30',
      dot: 'bg-[var(--neo-success)]',
    },
    amber: {
      bg: 'bg-[var(--neo-warning-surface)] text-[var(--neo-warning)] border-[var(--neo-warning)]/30',
      dot: 'bg-[var(--neo-warning)]',
    },
    red: {
      bg: 'bg-[var(--neo-danger-surface)] text-[var(--neo-danger)] border-[var(--neo-danger)]/30',
      dot: 'bg-[var(--neo-danger)] animate-pulse',
    },
  };

  const exactFormatted = format(targetDate, 'EEEE, MMM d, yyyy h:mm a');

  return (
    <Tooltip content={`Due date: ${exactFormatted}`}>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--neo-r-full)] text-xs font-semibold tracking-tight border select-none cursor-help [box-shadow:var(--neo-flat)]',
          styleMap[variant].bg,
          className
        )}
      >
        {showIcon && <Icon className="w-3.5 h-3.5 shrink-0" />}
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', styleMap[variant].dot)} />
        <span className="truncate">{label}</span>
      </span>
    </Tooltip>
  );
};
