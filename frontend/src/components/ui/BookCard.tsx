'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { BookOpen, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';
import { BookStatus } from '@/lib/tokens';

export interface BookItem {
  _id: string;
  title: string;
  authors: string[] | string;
  coverImage?: string;
  isbn?: string;
  category?: string;
  status?: BookStatus | string;
  availableCopies?: number;
  totalCopies?: number;
  shelfLocation?: string;
  aiSummary?: string;
}

export interface BookCardProps {
  book: BookItem;
  index?: number;
  actionButtons?: React.ReactNode;
  onSelect?: (book: BookItem) => void;
  className?: string;
}

const GRADIENT_PALETTES = [
  'from-slate-800 via-indigo-900 to-slate-950',
  'from-slate-800 via-emerald-900 to-slate-950',
  'from-slate-800 via-purple-900 to-slate-950',
  'from-slate-800 via-amber-950 to-slate-950',
  'from-slate-800 via-sky-950 to-slate-950',
  'from-slate-800 via-rose-950 to-slate-950',
];

export function getDeterministicGradient(id?: string): string {
  if (!id) return GRADIENT_PALETTES[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[idx];
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  index = 0,
  actionButtons,
  onSelect,
  className,
}) => {
  const [imageError, setImageError] = useState(false);

  const authorsString = Array.isArray(book.authors)
    ? book.authors.join(', ')
    : book.authors || 'Unknown Author';

  const isAvailable =
    book.status === 'available' ||
    (typeof book.availableCopies === 'number' && book.availableCopies > 0);

  const statusKey: BookStatus = isAvailable
    ? 'available'
    : (book.status as BookStatus) || 'issued';

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: Math.min(index * 0.04, 0.3),
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -3 }}
      className={cn(
        'group flex flex-col rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] text-[var(--neo-text)] overflow-hidden [box-shadow:var(--neo-raised)] hover:[box-shadow:var(--neo-raised-lg)] border border-[var(--neo-border-light)] transition-all duration-200',
        className
      )}
    >
      {/* Book Cover Inset Well */}
      <div className="relative aspect-[3/4] w-full overflow-hidden flex items-center justify-center bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border-b border-[var(--neo-border-dark)]">
        {book.coverImage && !imageError ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
            priority={index < 4}
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <div
            className={cn(
              'w-full h-full bg-gradient-to-br flex flex-col items-center justify-center text-center p-4 text-white',
              getDeterministicGradient(book._id)
            )}
          >
            <div className="w-14 h-18 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-2.5 shadow-sm group-hover:scale-105 transition-transform">
              <BookOpen className="w-7 h-7 text-white/90" />
            </div>
            <p className="text-xs font-bold text-white/95 line-clamp-2 max-w-[140px]">
              {book.title}
            </p>
            <p className="text-[10px] font-medium text-white/70 line-clamp-1 max-w-[120px] mt-0.5">
              {authorsString}
            </p>
          </div>
        )}

        {/* Category Badge */}
        {book.category && (
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase rounded-[var(--neo-r-full)] bg-[var(--neo-card)] text-[var(--neo-text)] [box-shadow:var(--neo-flat)] border border-[var(--neo-border-light)]">
              {book.category}
            </span>
          </div>
        )}

        {/* Availability Badge */}
        <div className="absolute top-3 right-3">
          <Badge status={statusKey} />
        </div>
      </div>

      {/* Book Information */}
      <div className="flex flex-col flex-1 p-5">
        <h4
          onClick={() => onSelect?.(book)}
          className={cn(
            'font-display text-base font-bold text-[var(--neo-text)] line-clamp-2 leading-snug mb-1',
            onSelect && 'cursor-pointer hover:text-[var(--neo-accent)] transition-colors'
          )}
        >
          {book.title}
        </h4>

        <p className="text-xs text-[var(--neo-text-2)] line-clamp-1 mb-3">
          by {authorsString}
        </p>

        {book.shelfLocation && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--neo-text-2)] mb-3">
            <MapPin className="w-3.5 h-3.5 text-[var(--neo-accent)] shrink-0" />
            <span className="font-mono text-[11px] font-medium tracking-tight">{book.shelfLocation}</span>
          </div>
        )}

        {/* Copies Available */}
        {book.totalCopies !== undefined && (
          <div className="text-xs text-[var(--neo-text-2)] mb-4 flex items-center justify-between">
            <span>Branch Copies:</span>
            <span className="font-semibold text-[var(--neo-text)] tabular-nums">
              {book.availableCopies ?? 0} / {book.totalCopies} available
            </span>
          </div>
        )}

        {/* Action Buttons */}
        {actionButtons && (
          <div className="mt-auto pt-3 border-t border-[var(--neo-shadow-dark)]/25 flex items-center gap-2">
            {actionButtons}
          </div>
        )}
      </div>
    </motion.div>
  );
};
