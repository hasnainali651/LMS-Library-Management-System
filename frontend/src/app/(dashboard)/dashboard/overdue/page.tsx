'use client';

import React, { useState } from 'react';
import { AlertTriangle, Mail, BellRing, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Table, Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';

interface OverdueLoan {
  _id: string;
  member?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    memberId?: string;
  };
  book?: {
    _id?: string;
    title?: string;
    isbn?: string;
  };
  dueDate: string;
  issueDate?: string;
  fineAmount?: number;
}

export default function OverduePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pendingRemindId, setPendingRemindId] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['circulation', 'overdue', page, limit],
    queryFn: async () => {
      const res = await api.get('/circulation/overdue', {
        params: { page, limit },
      });
      return res.data;
    },
  });

  const remindMutation = useMutation({
    mutationFn: async (transactionId: string) => {
      setPendingRemindId(transactionId);
      const res = await api.post(`/circulation/${transactionId}/remind`);
      return res.data;
    },
    onSuccess: (_, transactionId) => {
      toast.success('Overdue reminder dispatched to patron.');
      queryClient.invalidateQueries({ queryKey: ['circulation', 'overdue'] });
      queryClient.invalidateQueries({ queryKey: ['circulation'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to dispatch alert');
    },
    onSettled: () => {
      setPendingRemindId(null);
    },
  });

  const rawDocs = data?.data?.docs ?? (Array.isArray(data?.data) ? data?.data : []);
  const totalDocs = data?.data?.totalDocs ?? rawDocs.length;
  const totalPages = data?.data?.totalPages ?? Math.max(1, Math.ceil(totalDocs / limit));

  const items: OverdueLoan[] = rawDocs;

  // Compute accrued stats
  const totalFinesAccrued = items.reduce((acc, loan) => {
    if (loan.fineAmount) return acc + loan.fineAmount;
    const due = parseISO(loan.dueDate);
    const days = Math.max(0, differenceInCalendarDays(new Date(), due));
    return acc + days * 5;
  }, 0);

  const columns: Column<OverdueLoan>[] = [
    {
      key: 'book',
      header: 'Book & Patron',
      sortable: true,
      render: (o) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {o.book?.title || 'Unknown Title'}
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            {o.member?.name || 'Unknown Patron'} ({o.member?.email || o.member?.memberId || 'N/A'})
          </p>
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (o) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300 tabular-nums">
          {o.dueDate ? format(parseISO(o.dueDate), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'daysLate',
      header: 'Days Overdue',
      sortable: true,
      render: (o) => {
        const days = Math.max(1, differenceInCalendarDays(new Date(), parseISO(o.dueDate)));
        return (
          <span className="font-bold text-xs text-rose-600 dark:text-rose-400 tabular-nums">
            {days} day{days === 1 ? '' : 's'} late
          </span>
        );
      },
    },
    {
      key: 'fineAccrued',
      header: 'Accrued Fine',
      sortable: true,
      render: (o) => {
        const days = Math.max(1, differenceInCalendarDays(new Date(), parseISO(o.dueDate)));
        const fine = o.fineAmount ?? days * 5;
        return (
          <span className="font-semibold text-xs text-rose-600 dark:text-rose-400 tabular-nums">
            PKR {fine.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Action',
      className: 'text-right',
      render: (o) => {
        const isThisPending = pendingRemindId === o._id;
        return (
          <Button
            variant="secondary"
            size="sm"
            disabled={isThisPending || remindMutation.isPending}
            onClick={() => remindMutation.mutate(o._id)}
            leftIcon={
              isThisPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <BellRing className="w-3.5 h-3.5 text-amber-500" />
              )
            }
          >
            {isThisPending ? 'Dispatching...' : 'Dispatch Alert'}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Overdue Management Desk
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
          Monitor late returns and dispatch automated reminder alerts to overdue patrons.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          number={totalDocs}
          label="Total Overdue Loans"
          icon={AlertTriangle}
          color="rose"
        />
        <StatCard
          number={`PKR ${totalFinesAccrued.toFixed(2)}`}
          label="Uncollected Accrued Fines (Page)"
          icon={Mail}
          color="amber"
        />
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <Skeleton variant="table" rows={5} cols={5} />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load overdue records"
          message={(error as Error)?.message || 'Failed to connect to circulation API.'}
          onRetry={() => refetch()}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No overdue loans"
          description="All active library loans are in good standing with unexpired return dates."
        />
      ) : (
        <div className="space-y-4">
          <Table columns={columns} data={items} />
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-2">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Showing page {page} of {totalPages} ({totalDocs} total overdue)
              </p>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
