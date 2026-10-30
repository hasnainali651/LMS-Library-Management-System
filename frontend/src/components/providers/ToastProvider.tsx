'use client';

import React from 'react';
import toast, { Toaster, Toast } from 'react-hot-toast';
import Link from 'next/link';
import Image from 'next/image';
import {
  BookOpen,
  Calendar,
  AlertCircle,
  Clock,
  X,
  CheckCircle2,
  DollarSign,
  User,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

/* ─── Interfaces ─── */

export interface BookIssuedToastProps {
  t: Toast;
  transaction: {
    _id?: string;
    dueDate?: string | Date;
    issueDate?: string | Date;
    book?: {
      title?: string;
      coverImage?: string;
      authors?: string[] | string;
    };
    member?: {
      name?: string;
      memberId?: string;
      email?: string;
    };
  };
}

export interface FineAddedToastProps {
  t: Toast;
  amount: number | string;
  bookTitle?: string;
  reason?: string;
  newBalance?: number | string;
}

export interface ReservationReadyToastProps {
  t: Toast;
  bookTitle: string;
  expiresAt: string | Date;
  coverImage?: string;
  reservationId?: string;
  memberId?: string;
}

/* ─── Custom Toast Components ─── */

/**
 * 1. BookIssuedToast: cover thumbnail + member name + issue & due details
 */
export const BookIssuedToast: React.FC<BookIssuedToastProps> = ({ t, transaction }) => {
  const book = transaction.book;
  const member = transaction.member;
  const dueDateStr = transaction.dueDate
    ? new Date(transaction.dueDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    : 'Standard term';

  return (
    <div
      className={`max-w-md w-full bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 shadow-2xl shadow-emerald-950/40 rounded-2xl p-4 transition-all duration-300 pointer-events-auto ${t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
        }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Cover thumbnail / fallback */}
        <div className="relative flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-emerald-500/20 bg-emerald-950/40 flex items-center justify-center shadow-inner">
          {book?.coverImage ? (
            <Image
              src={book.coverImage}
              alt={book.title || 'Book Cover'}
              width={48}
              height={64}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-1 text-emerald-400">
              <BookOpen className="w-6 h-6 stroke-[1.5]" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3 h-3" /> Book Issued
            </span>
            <span className="text-[11px] text-[#94a3b8] font-mono">
              Due {dueDateStr}
            </span>
          </div>

          <h4 className="text-sm font-semibold text-slate-100 truncate">
            {book?.title || 'Book Issued'}
          </h4>

          <div className="flex items-center gap-2 mt-1.5 text-xs text-[#cbd5e1]">
            <span className="flex items-center gap-1 text-[#94a3b8]">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <strong className="text-slate-200 font-medium">
                {member?.name || 'Member'}
              </strong>
            </span>
            {member?.memberId && (
              <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-[#94a3b8] font-mono">
                {member.memberId}
              </span>
            )}
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss notification"
          className="p-1 rounded-lg text-[#94a3b8] hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * 2. FineAddedToast: amount in red + book title + balance status
 */
export const FineAddedToast: React.FC<FineAddedToastProps> = ({
  t,
  amount,
  bookTitle,
  reason,
  newBalance,
}) => {
  return (
    <div
      className={`max-w-md w-full bg-slate-900/95 backdrop-blur-xl border border-rose-500/35 shadow-2xl shadow-rose-950/40 rounded-2xl p-4 transition-all duration-300 pointer-events-auto ${t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
        }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Red icon container */}
        <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
          <AlertCircle className="w-6 h-6" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30">
              Fine Incurred
            </span>
            {reason && (
              <span className="text-[11px] text-[#94a3b8] truncate">
                {reason}
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-bold font-mono text-rose-400 tracking-tight">
              +PKR {Number(amount).toLocaleString()}
            </span>
            {newBalance !== undefined && (
              <span className="text-xs text-[#94a3b8] font-mono">
                (Total: PKR {Number(newBalance).toLocaleString()})
              </span>
            )}
          </div>

          {bookTitle && (
            <p className="text-xs text-[#cbd5e1] truncate mt-1">
              For: <span className="text-slate-100 font-medium">&quot;{bookTitle}&quot;</span>
            </p>
          )}

          <div className="mt-2.5">
            <Link
              href="/dashboard/fines"
              onClick={() => toast.dismiss(t.id)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
            >
              <span>View fine breakdown</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss fine alert"
          className="p-1 rounded-lg text-[#94a3b8] hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/**
 * 3. ReservationReadyToast: book + pickup deadline + action link + dismissible X
 */
export const ReservationReadyToast: React.FC<ReservationReadyToastProps> = ({
  t,
  bookTitle,
  expiresAt,
  coverImage,
  reservationId,
}) => {
  const expiryFormatted = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : 'in 48 hours';

  return (
    <div
      className={`max-w-md w-full bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl shadow-amber-950/40 rounded-2xl p-4 transition-all duration-300 pointer-events-auto ${t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'
        }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Cover / Icon */}
        <div className="relative flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-amber-500/30 bg-amber-950/40 flex items-center justify-center shadow-inner">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={bookTitle}
              width={48}
              height={64}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-1 text-amber-400">
              <Sparkles className="w-6 h-6 stroke-[1.5]" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
              <Sparkles className="w-3 h-3 text-amber-400" /> Ready for Pickup!
            </span>
          </div>

          <h4 className="text-sm font-bold text-slate-100 truncate">
            {bookTitle}
          </h4>

          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-300/90 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Holds until {expiryFormatted}</span>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Link
              href="/dashboard/reservations"
              onClick={() => toast.dismiss(t.id)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
            >
              <span>Pickup Now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss reservation alert"
          className="p-1 rounded-lg text-[#94a3b8] hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ─── Imperative Toast Triggers ─── */

export const showBookIssuedToast = (
  transaction: BookIssuedToastProps['transaction'],
  duration = 4000
) => {
  return toast.custom(
    (t) => <BookIssuedToast t={t} transaction={transaction} />,
    { duration, id: `issued-${transaction._id || Date.now()}` }
  );
};

export const showFineAddedToast = (
  props: Omit<FineAddedToastProps, 't'>,
  duration = 5000
) => {
  return toast.custom(
    (t) => <FineAddedToast t={t} {...props} />,
    { duration, id: `fine-${Date.now()}` }
  );
};

export const showReservationReadyToast = (
  props: Omit<ReservationReadyToastProps, 't'>,
  duration = 8000
) => {
  return toast.custom(
    (t) => <ReservationReadyToast t={t} {...props} />,
    { duration, id: `res-ready-${props.reservationId || Date.now()}` }
  );
};

/* ─── ToastProvider Component ─── */

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(15, 23, 42, 0.95)',
            color: '#f8fafc',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(16px)',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6)',
            padding: '12px 16px',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#ffffff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#ffffff',
            },
          },
        }}
      />
    </>
  );
}

export {
  ApiErrorAlert,
  SuccessAlert,
  showApiErrorToast,
  showSuccessToast,
} from '@/components/ui/AlertNotification';

export default ToastProvider;

