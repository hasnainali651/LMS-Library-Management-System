'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { BookOpen, MapPin, RotateCcw, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { parseISO, differenceInCalendarDays, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { DueDateChip } from './DueDateChip';
import { RenewModal, LoanRenewItem } from './RenewModal';

export interface LoanCardData {
  _id: string;
  bookId?: string;
  title: string;
  bookTitle?: string;
  author?: string;
  authors?: string[] | string;
  coverImage?: string;
  issueDate?: string;
  borrowDate?: string;
  dueDate: string;
  returnDate?: string | null;
  renewalCount?: number;
  maxRenewals?: number;
  shelfLocation?: string;
  copyBarcode?: string;
  fine?: number;
  fineAmount?: number;
  hasHolds?: boolean;
  unrenewableReason?: string;
  status?: string;
}

export interface LoanCardProps {
  loan: LoanCardData;
  index?: number;
  onRenewSuccess?: (updatedLoan: any) => void;
  className?: string;
}

export const LoanCard: React.FC<LoanCardProps> = ({
  loan,
  index = 0,
  onRenewSuccess,
  className,
}) => {
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const title = loan.bookTitle || loan.title || 'Untitled Title';
  const author = Array.isArray(loan.authors)
    ? loan.authors.join(', ')
    : loan.author || 'Unknown Author';

  const dueDateObj = parseISO(loan.dueDate);
  const isValidDate = !isNaN(dueDateObj.getTime());
  const now = new Date();
  const daysDiff = isValidDate ? differenceInCalendarDays(dueDateObj, now) : 0;
  const isOverdue = isValidDate && (daysDiff < 0 || (daysDiff === 0 && isPast(dueDateObj)));
  const overdueDays = isOverdue ? Math.abs(daysDiff) : 0;

  const renewalCount = loan.renewalCount || 0;
  const maxRenewals = loan.maxRenewals || 2;
  const isMaxReached = renewalCount >= maxRenewals;

  let isRenewable = true;
  let disableReason = '';

  if (loan.unrenewableReason) {
    isRenewable = false;
    disableReason = loan.unrenewableReason;
  } else if (isOverdue) {
    isRenewable = false;
    disableReason = 'Overdue books cannot be renewed online. Return at circulation desk.';
  } else if (isMaxReached) {
    isRenewable = false;
    disableReason = `Max renewal limit reached (${maxRenewals} renewals allowed).`;
  } else if (loan.hasHolds) {
    isRenewable = false;
    disableReason = 'A patron is waiting in queue for this title.';
  }

  const fineTotal = loan.fine ?? loan.fineAmount ?? 0;

  const renewItemData: LoanRenewItem = {
    _id: loan._id,
    bookTitle: title,
    authors: loan.authors || author,
    coverImage: loan.coverImage,
    dueDate: loan.dueDate,
    renewalCount,
    maxRenewals,
    isOverdue,
    hasHolds: loan.hasHolds,
    unrenewableReason: disableReason || undefined,
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.3,
          delay: Math.min(index * 0.04, 0.3),
          ease: [0.16, 1, 0.3, 1],
        }}
        whileHover={{ y: -2 }}
        className={cn(
          'group relative flex flex-col sm:flex-row items-stretch rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] text-[var(--neo-text)] overflow-hidden [box-shadow:var(--neo-raised)] hover:[box-shadow:var(--neo-raised-lg)] border border-[var(--neo-border-light)] transition-all duration-200',
          isOverdue && 'border-[var(--neo-danger)]/50',
          className
        )}
      >
        {/* Book Cover Inset Well */}
        <div className="relative w-full sm:w-32 aspect-[3/4] sm:aspect-auto shrink-0 bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border-b sm:border-b-0 sm:border-r border-[var(--neo-border-dark)] flex items-center justify-center overflow-hidden">
          {loan.coverImage && !imageError ? (
            <Image
              src={loan.coverImage}
              alt={title}
              fill
              sizes="(max-width: 640px) 100vw, 128px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-3 text-center">
              <div className="w-10 h-12 rounded-[var(--neo-r-xs)] bg-[var(--neo-surface)] text-[var(--neo-accent)] flex items-center justify-center mb-1 [box-shadow:var(--neo-flat)] border border-[var(--neo-border-light)]">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[10px] text-[var(--neo-text-3)] font-mono">No cover</span>
            </div>
          )}

          {isOverdue && (
            <div className="absolute top-2 left-2 sm:hidden">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--neo-danger)] text-white uppercase tracking-wider">
                Overdue
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="flex-1 p-5 flex flex-col justify-between min-w-0">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-display font-bold text-sm sm:text-base text-[var(--neo-text)] truncate leading-snug">
                  {title}
                </h4>
                <p className="text-xs text-[var(--neo-text-2)] truncate mt-0.5">
                  by {author}
                </p>
              </div>

              {/* Due Date Chip */}
              <DueDateChip dueDate={loan.dueDate} />
            </div>

            {/* Overdue alert and fines badge if any */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[var(--neo-r-full)] text-[11px] font-bold bg-[var(--neo-danger-surface)] text-[var(--neo-danger)] border border-[var(--neo-danger)]/30">
                  <AlertTriangle className="w-3 h-3" />
                  {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue
                </span>
              )}

              {fineTotal > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[var(--neo-r-full)] text-[11px] font-bold bg-[var(--neo-warning-surface)] text-[var(--neo-warning)] border border-[var(--neo-warning)]/30 tabular-nums">
                  Accrued Fine: PKR {fineTotal.toFixed(2)}
                </span>
              )}

              {loan.shelfLocation && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[var(--neo-text-3)] font-medium">
                  <MapPin className="w-3 h-3 text-[var(--neo-accent)]" />
                  {loan.shelfLocation}
                </span>
              )}

              <span className="text-[11px] font-medium text-[var(--neo-text-3)] px-2 py-0.5 rounded-[var(--neo-r-full)] bg-[var(--neo-surface)] border border-[var(--neo-border-light)] tabular-nums">
                Renewals: {renewalCount}/{maxRenewals}
              </span>
            </div>
          </div>

          {/* Action Row */}
          <div className="mt-4 pt-3 border-t border-[var(--neo-shadow-dark)]/25 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[var(--neo-text-3)]">
              {isOverdue
                ? 'Return at desk to settle overdue fine'
                : isRenewable
                ? 'Eligible for 14-day online renewal'
                : disableReason}
            </span>

            <Button
              variant={isRenewable ? 'secondary' : 'ghost'}
              size="sm"
              disabled={!isRenewable}
              onClick={() => setRenewModalOpen(true)}
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Renew Loan
            </Button>
          </div>
        </div>
      </motion.div>

      <RenewModal
        open={renewModalOpen}
        onOpenChange={setRenewModalOpen}
        loan={renewItemData}
        onSuccess={onRenewSuccess}
      />
    </>
  );
};
