'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  X,
  BookOpen,
  Star,
  MapPin,
  Bookmark,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';
import { Button } from './Button';
import { BookItem } from './BookCard';
import { useAuthStore } from '@/store/authStore';

const COVER_PALETTES = [
  ['#1e293b', '#334155'],
  ['#0f172a', '#1e1b4b'],
  ['#022c22', '#064e3b'],
  ['#450a0a', '#7f1d1d'],
  ['#431407', '#7c2d12'],
  ['#172554', '#1e40af'],
];

function hashTitle(title: string): number {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return h % COVER_PALETTES.length;
}

const StarRating: React.FC<{ rating?: number; count?: number }> = ({ rating = 0, count = 0 }) => (
  <div className="flex items-center gap-1.5">
    {Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn(
          'w-3.5 h-3.5',
          i < Math.round(rating)
            ? 'fill-amber-400 stroke-amber-400'
            : 'fill-transparent stroke-[var(--neo-text-3)]'
        )}
      />
    ))}
    {count > 0 && <span className="text-xs text-[var(--neo-text-3)] tabular-nums">({count})</span>}
  </div>
);

export interface QuickViewBook extends BookItem {
  publishedYear?: number;
  language?: string;
  publisher?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  categories?: string[];
}

export interface QuickViewModalProps {
  book: QuickViewBook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBorrow?: (book: QuickViewBook) => void;
  onWaitlist?: (book: QuickViewBook) => void;
  onViewDetail?: (book: QuickViewBook) => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  book,
  open,
  onOpenChange,
  onBorrow,
  onWaitlist,
  onViewDetail,
}) => {
  const { user } = useAuthStore();
  const [descExpanded, setDescExpanded] = useState(false);

  if (!book) return null;

  const palette = COVER_PALETTES[hashTitle(book.title)];
  const authorsStr = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
  const isAvailable = (book.availableCopies ?? 0) > 0;
  const isStudent = user?.role === 'student';

  const description = book.description ?? 'No detailed description available for this title.';
  const truncated = description.length > 240;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 overflow-y-auto">
          <DialogPrimitive.Content className="relative w-full max-w-2xl rounded-[var(--neo-r-xl)] bg-[var(--neo-card)] text-[var(--neo-text)] border border-[var(--neo-border-light)] [box-shadow:var(--neo-raised-lg)] duration-200 data-[state=open]:animate-slide-up data-[state=closed]:animate-out outline-none overflow-hidden">
            {/* Close Button */}
            <DialogPrimitive.Close className="absolute top-4 right-4 z-10 neo-btn w-8 h-8 rounded-full flex items-center justify-center text-[var(--neo-text-2)] hover:text-[var(--neo-text)] active:scale-[0.97] transition-all">
              <X className="w-4 h-4" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>

            <div className="flex flex-col sm:flex-row">
              {/* Cover Inset Well */}
              <div
                className="sm:w-52 sm:min-h-full h-56 shrink-0 flex items-center justify-center relative overflow-hidden bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border-b sm:border-b-0 sm:border-r border-[var(--neo-border-dark)]"
                style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}
              >
                {book.coverImage ? (
                  <Image
                    src={book.coverImage}
                    alt={book.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 208px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                    <div className="w-16 h-20 rounded-lg bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-white/90" />
                    </div>
                    <p className="text-white/80 text-xs font-medium line-clamp-3">{book.title}</p>
                  </div>
                )}
                {/* Availability pill */}
                <div className="absolute bottom-3 left-3">
                  <Badge status={isAvailable ? 'available' : 'issued'} />
                </div>
              </div>

              {/* Information Section */}
              <div className="flex-1 p-6 min-w-0 flex flex-col justify-between">
                <div>
                  <DialogPrimitive.Title className="font-display text-xl font-bold text-[var(--neo-text)] leading-snug pr-8">
                    {book.title}
                  </DialogPrimitive.Title>

                  <p className="text-sm text-[var(--neo-text-2)] mt-1">
                    by <span className="text-[var(--neo-accent)] font-semibold">{authorsStr}</span>
                  </p>

                  {/* Rating */}
                  {(book.rating ?? 0) > 0 && (
                    <div className="mt-2">
                      <StarRating rating={book.rating} count={book.reviewCount} />
                    </div>
                  )}

                  {/* Metadata Chips */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-[var(--neo-text-3)] font-medium">
                    {book.publishedYear && <span>Year: {book.publishedYear}</span>}
                    {book.language && <span className="capitalize">Lang: {book.language}</span>}
                    {book.publisher && <span>Pub: {book.publisher}</span>}
                    {book.isbn && <span className="font-mono text-[11px]">ISBN: {book.isbn}</span>}
                  </div>

                  {/* Categories */}
                  {(book.categories ?? (book.category ? [book.category] : [])).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {(book.categories ?? [book.category!]).map((c) => (
                        <Badge key={c} color="blue" showDot={false}>
                          {c}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Description */}
                  <div className="mt-4">
                    <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
                      {truncated && !descExpanded ? description.slice(0, 240) + '…' : description}
                    </p>
                    {truncated && (
                      <button
                        onClick={() => setDescExpanded((v) => !v)}
                        className="mt-1 text-xs font-semibold text-[var(--neo-accent)] hover:underline"
                      >
                        {descExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>

                  {/* Shelf Location */}
                  {book.shelfLocation && (
                    <div className="flex items-center gap-1.5 mt-4 text-xs text-[var(--neo-text-2)]">
                      <MapPin className="w-3.5 h-3.5 text-[var(--neo-accent)] shrink-0" />
                      <span>Shelf: <strong className="font-mono text-[var(--neo-text)]">{book.shelfLocation}</strong></span>
                    </div>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center gap-3 pt-5 mt-5 border-t border-[var(--neo-shadow-dark)]/25">
                  {isAvailable ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onBorrow?.(book)}
                      leftIcon={<CheckCircle2 className="w-4 h-4" />}
                      className="flex-1"
                    >
                      Request Checkout
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onWaitlist?.(book)}
                      leftIcon={<Bookmark className="w-4 h-4" />}
                      className="flex-1"
                    >
                      Join Hold Queue
                    </Button>
                  )}
                  {onViewDetail && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetail(book)}
                    >
                      Full Details
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
