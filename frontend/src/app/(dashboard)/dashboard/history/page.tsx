'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  BookOpen,
  Calendar,
  Clock,
  Star,
  CheckCircle2,
  Search,
  MessageSquare,
  Sparkles,
  ArrowRight,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { StatCard } from '@/components/ui/StatCard';
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { ReviewModal } from '@/components/circulation/ReviewModal';

export interface PastLoanItem {
  _id: string;
  bookId: string;
  title: string;
  author: string;
  coverImage?: string;
  borrowDate: string;
  returnDate: string;
  durationDays: number;
  reviewed?: boolean;
  userRating?: number;
}

export default function LoanHistoryPage() {
  const { user } = useAuthStore();
  const [historyLoans, setHistoryLoans] = useState<PastLoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // Review Modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedBookForReview, setSelectedBookForReview] = useState<{
    id: string;
    title: string;
    author: string;
    coverImage?: string;
  } | null>(null);

  // Fetch past loans
  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const userId = user?._id;

    if (!userId) {
      setHistoryLoans([]);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get(`/circulation/member/${userId}`);
      const data = res.data?.data || res.data;
      if (Array.isArray(data)) {
        const returned = data
          .filter((l: any) => l.returnDate || l.status === 'returned')
          .map((l: any) => {
            const bDate = parseISO(l.issueDate || l.borrowDate || new Date().toISOString());
            const rDate = parseISO(l.returnDate || new Date().toISOString());
            const diff = Math.max(1, differenceInCalendarDays(rDate, bDate));

            return {
              _id: l._id || l.id,
              bookId: l.book?._id || l.bookId || 'b1',
              title: l.book?.title || l.bookTitle || l.title || 'Untitled Book',
              author: Array.isArray(l.book?.authors)
                ? l.book.authors.join(', ')
                : l.book?.authors || l.authors || l.author || 'Author',
              coverImage: l.book?.coverImage || l.coverImage,
              borrowDate: l.issueDate || l.borrowDate || new Date().toISOString(),
              returnDate: l.returnDate || new Date().toISOString(),
              durationDays: diff,
              reviewed: false,
            };
          });
        setHistoryLoans(returned);
      } else {
        setHistoryLoans([]);
      }
    } catch {
      setFetchError('Unable to load past borrowing history. Please try again.');
      setHistoryLoans([]);
    } finally {
      setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleOpenReview = (loan: PastLoanItem) => {
    setSelectedBookForReview({
      id: loan.bookId,
      title: loan.title,
      author: loan.author,
      coverImage: loan.coverImage,
    });
    setReviewModalOpen(true);
  };

  const handleReviewSuccess = () => {
    if (selectedBookForReview) {
      setHistoryLoans((prev) =>
        prev.map((l) =>
          l.bookId === selectedBookForReview.id
            ? { ...l, reviewed: true, userRating: 5 }
            : l
        )
      );
    }
  };

  // Filter & Pagination
  const filtered = historyLoans.filter(
    (l) =>
      l.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedLoans = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const avgDuration =
    historyLoans.length > 0
      ? Math.round(
          historyLoans.reduce((acc, l) => acc + l.durationDays, 0) /
            historyLoans.length
        )
      : 14;

  const totalReviewed = historyLoans.filter((l) => l.reviewed).length;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Circulation Loan History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Complete archive of your past borrowed books, lending durations, and community book reviews.
          </p>
        </div>
        <Link href="/books">
          <Button variant="primary" size="sm" leftIcon={<Search className="w-4 h-4" />}>
            Explore More Titles
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          number={historyLoans.length}
          label="Total Books Read"
          icon={BookOpen}
          color="primary"
          trend={{ value: 'Completed borrowings', direction: 'neutral' }}
        />
        <StatCard
          number={`${avgDuration} Days`}
          label="Average Loan Duration"
          icon={Clock}
          color="sky"
          trend={{ value: 'Standard reading pace', direction: 'neutral' }}
        />
        <StatCard
          number={`${totalReviewed} / ${historyLoans.length}`}
          label="Books Reviewed"
          icon={Star}
          color="amber"
          trend={{
            value: totalReviewed > 0 ? 'Contributing community reviews' : 'No reviews written yet',
            direction: totalReviewed > 0 ? 'up' : 'neutral',
          }}
        />
      </div>

      {/* Search Input */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search completed loans by title or author..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-inset-bg)] text-[var(--neo-text-primary)] placeholder-[var(--neo-text-muted)] shadow-[var(--neo-inset-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
          />
        </div>
        <span className="text-xs text-[var(--neo-text-muted)] font-mono tabular-nums">
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Paginated Past Loans Cards List */}
      {loading ? (
        <div className="space-y-3">
          <Skeleton variant="card" className="h-32" />
          <Skeleton variant="card" className="h-32" />
        </div>
      ) : fetchError ? (
        <ErrorState
          title="Could Not Load History"
          message={fetchError}
          onRetry={fetchHistory}
        />
      ) : paginatedLoans.length > 0 ? (
        <div className="space-y-3.5">
          {paginatedLoans.map((loan, idx) => (
            <motion.div
              key={loan._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: idx * 0.04,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] shadow-[var(--neo-raised)] hover:shadow-[var(--neo-raised-lg)] transition-all"
            >
              {/* Cover & Title Details */}
              <div className="flex items-start gap-4 flex-1 min-w-0">
                <div className="w-14 h-20 rounded-xl bg-[var(--neo-inset-bg)] overflow-hidden shrink-0 border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] flex items-center justify-center shadow-[var(--neo-inset-sm)] relative">
                  {loan.coverImage ? (
                    <Image
                      src={loan.coverImage}
                      alt={loan.title}
                      width={56}
                      height={80}
                      unoptimized
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <BookOpen className="w-6 h-6 text-[var(--neo-text-muted)]" />
                  )}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                      <CheckCircle2 className="w-3 h-3" />
                      Returned
                    </span>

                    <span className="text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300">
                      Loan Duration: <strong>{loan.durationDays} days</strong>
                    </span>
                  </div>

                  <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                    {loan.title}
                  </h3>
                  <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
                    by {loan.author}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      Borrowed: {format(parseISO(loan.borrowDate), 'MMM d, yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      Returned: {format(parseISO(loan.returnDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Write Review action or Reviewed Badge */}
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {loan.reviewed ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{loan.userRating ? `★ ${loan.userRating}/5` : 'Reviewed'}</span>
                  </div>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleOpenReview(loan)}
                    leftIcon={<Star className="w-3.5 h-3.5 text-amber-500" />}
                    className="hover:border-amber-400 text-xs"
                  >
                    Write Review
                  </Button>
                )}
              </div>
            </motion.div>
          ))}

          {/* Pagination Component */}
          {totalPages > 1 && (
            <div className="pt-4 flex justify-center">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No Past Loans Found"
          description={
            searchQuery
              ? `No loan records match "${searchQuery}".`
              : 'You have not returned any titles yet. When you return a book, it will appear here in your loan archive.'
          }
        />
      )}

      {/* Review Modal */}
      {selectedBookForReview && (
        <ReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          bookId={selectedBookForReview.id}
          bookTitle={selectedBookForReview.title}
          author={selectedBookForReview.author}
          coverImage={selectedBookForReview.coverImage}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}
