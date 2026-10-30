'use client';

import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from './Skeleton';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  sortable?: boolean;
  className?: string;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  isLoading?: boolean;
  skeletonRows?: number;
  sortKey?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  className?: string;
}

export function Table<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor = (item, index) => item.id || item._id || index,
  isLoading = false,
  skeletonRows = 8,
  sortKey,
  sortOrder,
  onSort,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items matching your criteria at this moment.',
  emptyAction,
  className,
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('w-full rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] overflow-hidden [box-shadow:var(--neo-raised)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]', className)}>
        <Skeleton variant="table" rows={skeletonRows} cols={columns.length} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={cn('w-full rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] p-8 [box-shadow:var(--neo-raised)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]', className)}>
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'w-full rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] text-[var(--neo-text)] overflow-hidden [box-shadow:var(--neo-raised)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]',
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-[var(--neo-shadow-dark)]/25 bg-[var(--neo-surface)]">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      'px-4 py-3.5 text-xs font-bold uppercase tracking-wider text-[var(--neo-text-2)] select-none',
                      col.sortable && 'cursor-pointer hover:text-[var(--neo-text)]',
                      col.className
                    )}
                    onClick={() => col.sortable && onSort?.(col.key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="shrink-0 text-[var(--neo-text-3)]">
                          {isSorted ? (
                            sortOrder === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--neo-shadow-dark)]/15">
            {data.map((row, index) => (
              <motion.tr
                key={String(keyExtractor(row, index))}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.2,
                  delay: Math.min(index * 0.02, 0.25),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="hover:bg-[var(--neo-surface)]/60 transition-colors"
              >
                {columns.map((col) => (
                  <td
                    key={`${String(keyExtractor(row, index))}-${col.key}`}
                    className={cn(
                      'px-4 py-3.5 text-[var(--neo-text)] align-middle tabular-nums',
                      col.className
                    )}
                  >
                    {col.render ? col.render(row, index) : row[col.key]}
                  </td>
                ))}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export { NeoTable } from './Neo';
