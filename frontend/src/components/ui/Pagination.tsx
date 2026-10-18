'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  totalItems?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  totalItems,
  onPageChange,
  onPageSizeChange,
  className,
}) => {
  const safeTotalPages = Math.max(1, totalPages);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis-start');

      const start = Math.max(2, page - 1);
      const end = Math.min(safeTotalPages - 1, page + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < safeTotalPages - 2) pages.push('ellipsis-end');
      pages.push(safeTotalPages);
    }
    return pages;
  };

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2 select-none',
        className
      )}
    >
      <div className="flex items-center gap-3 text-xs text-[var(--neo-text-3)] font-medium">
        {totalItems !== undefined && (
          <span>
            Total <strong className="font-semibold text-[var(--neo-text)] tabular-nums">{totalItems}</strong> items
          </span>
        )}
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span>Show:</span>
            <select
              aria-label="Select page size"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-[var(--neo-r-sm)] bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)] px-2 text-xs text-[var(--neo-text)] focus:outline-none focus:border-[var(--neo-accent)] cursor-pointer"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt} className="bg-[var(--neo-card)] text-[var(--neo-text)]">
                  {opt} / page
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          className="h-8 px-2.5"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div className="flex items-center gap-1.5">
          {getPageNumbers().map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1 text-xs text-[var(--neo-text-3)] select-none"
                >
                  …
                </span>
              );
            }

            const isActive = p === page;
            return (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'h-8 min-w-[2rem] px-2 text-xs font-semibold rounded-[var(--neo-r-sm)] transition-all tabular-nums',
                  isActive
                    ? 'bg-[var(--neo-inset-bg)] text-[var(--neo-accent)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)]'
                    : 'bg-[var(--neo-card)] text-[var(--neo-text-2)] hover:text-[var(--neo-text)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-border-light)] active:[box-shadow:var(--neo-inset-sm)] active:translate-y-[1px]'
                )}
              >
                {p}
              </button>
            );
          })}
        </div>

        <Button
          variant="secondary"
          size="sm"
          disabled={page >= safeTotalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          className="h-8 px-2.5"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
