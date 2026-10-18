import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'rectangular' | 'circular' | 'card' | 'table';
  rows?: number;
  cols?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  rows = 1,
  cols = 4,
  className,
  ...props
}) => {
  if (variant === 'circular') {
    return (
      <div
        className={cn(
          'w-10 h-10 rounded-full bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)] animate-pulse shrink-0',
          className
        )}
        {...props}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] [box-shadow:var(--neo-raised)] border border-[var(--neo-border-light)] p-5 space-y-4 animate-pulse',
          className
        )}
        {...props}
      >
        <div className="h-44 bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] rounded-[var(--neo-r-md)] w-full" />
        <div className="space-y-2">
          <div className="h-4 bg-[var(--neo-surface)] rounded w-3/4" />
          <div className="h-3 bg-[var(--neo-surface)] rounded w-1/2" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="h-6 bg-[var(--neo-surface)] rounded-full w-20" />
          <div className="h-8 bg-[var(--neo-surface)] rounded-[var(--neo-r-sm)] w-24" />
        </div>
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={cn('w-full space-y-3 p-4', className)} {...props}>
        {/* Table header skeleton */}
        <div className="flex gap-4 pb-2 border-b border-[var(--neo-shadow-dark)]/25">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <div
              key={`th-skel-${cIdx}`}
              className="h-4 bg-[var(--neo-surface)] rounded flex-1 animate-pulse"
            />
          ))}
        </div>
        {/* Table rows skeleton */}
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={`tr-skel-${rIdx}`}
            className="flex gap-4 py-2.5 items-center border-b border-[var(--neo-shadow-dark)]/15"
          >
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={`td-skel-${rIdx}-${cIdx}`}
                className="h-3.5 bg-[var(--neo-surface)]/80 rounded flex-1 animate-pulse"
                style={{ width: `${Math.max(40, 100 - cIdx * 15)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)]',
        variant === 'text' ? 'h-4 w-full' : 'h-12 w-full',
        className
      )}
      {...props}
    />
  );
};
