'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { addDays, format, parseISO } from 'date-fns';
import { Calendar, RotateCcw, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

export interface LoanRenewItem {
  _id: string;
  bookTitle?: string;
  title?: string;
  author?: string;
  authors?: string[] | string;
  coverImage?: string;
  dueDate: string;
  renewalCount?: number;
  maxRenewals?: number;
  isOverdue?: boolean;
  hasHolds?: boolean;
  unrenewableReason?: string;
}

export interface RenewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loan: LoanRenewItem | null;
  onSuccess?: (updatedLoan: any) => void;
}

export const RenewModal: React.FC<RenewModalProps> = ({
  open,
  onOpenChange,
  loan,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);

  if (!loan) return null;

  const title = loan.bookTitle || loan.title || 'Borrowed Book';
  const author = Array.isArray(loan.authors)
    ? loan.authors.join(', ')
    : loan.author || 'Unknown Author';

  const currentDueDate = parseISO(loan.dueDate);
  const isValidDate = !isNaN(currentDueDate.getTime());
  const newDueDate = isValidDate ? addDays(currentDueDate, 14) : addDays(new Date(), 14);

  const renewalCount = loan.renewalCount || 0;
  const maxRenewals = loan.maxRenewals || 2;
  const isMaxReached = renewalCount >= maxRenewals;
  const isOverdue = loan.isOverdue || (isValidDate && currentDueDate < new Date());

  let blockReason: string | null = null;
  if (loan.unrenewableReason) {
    blockReason = loan.unrenewableReason;
  } else if (isOverdue) {
    blockReason = 'Overdue loans cannot be renewed online. Please return the book at the circulation desk.';
  } else if (isMaxReached) {
    blockReason = `Maximum renewal limit reached (${renewalCount}/${maxRenewals} renewals used).`;
  } else if (loan.hasHolds) {
    blockReason = 'This book has a waitlist queue from another patron and must be returned on time.';
  }

  const isBlocked = !!blockReason;

  const handleRenew = async () => {
    if (isBlocked) return;
    setLoading(true);

    try {
      let res;
      try {
        res = await api.patch('/circulation/renew', { transactionId: loan._id });
      } catch (patchErr: any) {
        if (patchErr?.response?.status === 404 || patchErr?.response?.status === 405) {
          res = await api.post('/circulation/renew', { transactionId: loan._id });
        } else {
          throw patchErr;
        }
      }

      const formattedNewDate = format(newDueDate, 'MMM d, yyyy');
      toast.success(`"${title}" renewed! New due date: ${formattedNewDate}`);
      onSuccess?.(res?.data?.data?.transaction || { ...loan, dueDate: newDueDate.toISOString() });
      onOpenChange(false);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Renewal request could not be processed.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Renew Book Loan"
      description="Extend your borrowing period by 14 days without visiting the desk."
      maxWidth="md"
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleRenew}
            isLoading={loading}
            disabled={isBlocked}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            Confirm 14-Day Renewal
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Book Info Summary */}
        <div className="flex items-start gap-3.5 p-4 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] border border-[var(--neo-border-light)] [box-shadow:var(--neo-flat)]">
          {loan.coverImage ? (
            <Image
              src={loan.coverImage}
              alt={title}
              width={48}
              height={64}
              className="w-12 h-16 object-cover rounded shadow-sm shrink-0"
              unoptimized
            />
          ) : (
            <div className="w-12 h-16 rounded-[var(--neo-r-xs)] bg-[var(--neo-card)] text-[var(--neo-accent)] flex items-center justify-center shrink-0 border border-[var(--neo-border-light)]">
              <RotateCcw className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm text-[var(--neo-text)] truncate">
              {title}
            </h4>
            <p className="text-xs text-[var(--neo-text-2)] truncate mt-0.5">
              by {author}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-[var(--neo-r-full)] bg-[var(--neo-card)] text-[var(--neo-text-2)] border border-[var(--neo-border-light)] tabular-nums">
                Renewal count: {renewalCount} / {maxRenewals}
              </span>
            </div>
          </div>
        </div>

        {/* Block Warning Banner if Applicable */}
        {isBlocked && (
          <div className="p-3.5 rounded-[var(--neo-r-sm)] bg-[var(--neo-danger-surface)] border border-[var(--neo-danger)]/30 flex items-start gap-3 text-xs text-[var(--neo-danger)]">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Renewal Not Permitted</p>
              <p className="mt-0.5 leading-relaxed">{blockReason}</p>
            </div>
          </div>
        )}

        {/* Date Comparison Cards */}
        {!isBlocked && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3.5 rounded-[var(--neo-r-sm)] border border-[var(--neo-border-light)] bg-[var(--neo-card)] [box-shadow:var(--neo-raised-sm)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--neo-text-3)] mb-1">
                Current Due Date
              </p>
              <p className="text-sm font-semibold text-[var(--neo-text)] tabular-nums">
                {isValidDate ? format(currentDueDate, 'MMM d, yyyy') : loan.dueDate}
              </p>
            </div>

            <div className="p-3.5 rounded-[var(--neo-r-sm)] border border-[var(--neo-success)]/30 bg-[var(--neo-success-surface)] [box-shadow:var(--neo-flat)]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--neo-success)] mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                New Due (+14d)
              </p>
              <p className="text-sm font-bold text-[var(--neo-success)] tabular-nums">
                {format(newDueDate, 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
