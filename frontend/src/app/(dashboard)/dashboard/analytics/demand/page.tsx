'use client';

import React, { useState } from 'react';
import {
  ShoppingCart,
  Archive,
  Download,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Package,
  Layers,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table, Column } from '@/components/ui/Table';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DemandBook {
  _id: string;
  title: string;
  authors: string[] | string;
  isbn?: string;
  coverImage?: string;
  availableCopies: number;
  totalCopies: number;
  reservationCount: number;
  suggestedQty: number;
  shelfLocation?: string;
}

interface IdleBook {
  _id: string;
  title: string;
  authors: string[] | string;
  isbn?: string;
  coverImage?: string;
  totalCopies: number;
  lastBorrowDate?: string;
  shelfLocation?: string;
}

// ─── CSV Helpers ──────────────────────────────────────────────────────────────
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const rows = [
    keys.join(','),
    ...data.map((row) =>
      keys.map((k) => JSON.stringify(row[k] ?? '')).join(',')
    ),
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Tab = 'demand' | 'idle';

export default function DemandPage() {
  const [activeTab, setActiveTab] = useState<Tab>('demand');

  // 1. Fetch Demand Query
  const {
    data: demandData,
    isLoading: demandLoading,
    isError: demandError,
    error: demandErrObj,
    refetch: refetchDemand,
  } = useQuery({
    queryKey: ['analytics', 'books', 'demand'],
    queryFn: async () => {
      const res = await api.get('/analytics/books/demand');
      const raw = res.data?.data || res.data;
      if (!Array.isArray(raw)) return [];
      return raw.map((b: any) => ({
        _id: b._id,
        title: b.title ?? b.book?.title ?? 'Untitled',
        authors: b.authors ?? b.book?.authors ?? [],
        isbn: b.isbn ?? b.book?.isbn,
        coverImage: b.coverImage ?? b.book?.coverImage,
        availableCopies: b.availableCopies ?? 0,
        totalCopies: b.totalCopies ?? 0,
        reservationCount: b.reservationCount ?? b.queueSize ?? 0,
        suggestedQty: Math.max(
          1,
          (b.reservationCount ?? b.queueSize ?? 0) - (b.availableCopies ?? 0) + 1
        ),
        shelfLocation: b.shelfLocation,
      })) as DemandBook[];
    },
  });

  // 2. Fetch Idle Query
  const {
    data: idleData,
    isLoading: idleLoading,
    isError: idleError,
    error: idleErrObj,
    refetch: refetchIdle,
  } = useQuery({
    queryKey: ['analytics', 'books', 'idle'],
    queryFn: async () => {
      const res = await api.get('/analytics/books/idle');
      const raw = res.data?.data || res.data;
      if (!Array.isArray(raw)) return [];
      return raw.map((b: any) => ({
        _id: b._id,
        title: b.title ?? b.book?.title ?? 'Untitled',
        authors: b.authors ?? b.book?.authors ?? [],
        isbn: b.isbn ?? b.book?.isbn,
        coverImage: b.coverImage ?? b.book?.coverImage,
        totalCopies: b.totalCopies ?? 0,
        lastBorrowDate: b.lastBorrowDate ?? b.lastCirculationDate,
        shelfLocation: b.shelfLocation,
      })) as IdleBook[];
    },
  });

  const demandBooks = demandData || [];
  const idleBooks = idleData || [];

  const authorStr = (a: string[] | string) =>
    Array.isArray(a) ? a.join(', ') : a || 'Unknown';

  // Demand table columns
  const demandColumns: Column<DemandBook>[] = [
    {
      key: 'title',
      header: 'Title & Author',
      sortable: true,
      render: (b) => (
        <div className="flex items-center gap-3">
          {b.coverImage ? (
            <img
              src={b.coverImage}
              alt=""
              className="w-8 h-10 object-cover rounded shadow-sm shrink-0"
            />
          ) : (
            <div className="w-8 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
              {b.title}
            </p>
            <p className="text-slate-400 text-[11px] truncate max-w-[200px] mt-0.5">
              {authorStr(b.authors)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'reservationCount',
      header: 'Queue',
      sortable: true,
      render: (b) => (
        <span className="inline-flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400 tabular-nums">
          <TrendingUp className="w-3 h-3" />
          {b.reservationCount}
        </span>
      ),
    },
    {
      key: 'availableCopies',
      header: 'Available / Total',
      render: (b) => (
        <span className="tabular-nums text-slate-600 dark:text-slate-300">
          <span
            className={
              b.availableCopies === 0
                ? 'text-rose-600 dark:text-rose-400 font-bold'
                : 'text-emerald-600 dark:text-emerald-400 font-bold'
            }
          >
            {b.availableCopies}
          </span>
          {' / '}
          {b.totalCopies}
        </span>
      ),
    },
    {
      key: 'suggestedQty',
      header: 'Buy More',
      sortable: true,
      render: (b) => (
        <Badge color="red" className="font-bold tabular-nums">
          +{b.suggestedQty} copies
        </Badge>
      ),
    },
    {
      key: 'shelfLocation',
      header: 'Shelf',
      render: (b) => (
        <span className="font-mono text-[11px] text-slate-500">
          {b.shelfLocation ?? '—'}
        </span>
      ),
    },
  ];

  // Idle table columns
  const idleColumns: Column<IdleBook>[] = [
    {
      key: 'title',
      header: 'Title & Author',
      sortable: true,
      render: (b) => (
        <div className="flex items-center gap-3">
          {b.coverImage ? (
            <img
              src={b.coverImage}
              alt=""
              className="w-8 h-10 object-cover rounded shadow-sm shrink-0"
            />
          ) : (
            <div className="w-8 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]">
              {b.title}
            </p>
            <p className="text-slate-400 text-[11px] truncate max-w-[200px] mt-0.5">
              {authorStr(b.authors)}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'totalCopies',
      header: 'Copies',
      sortable: true,
      render: (b) => (
        <span className="tabular-nums font-semibold text-slate-600 dark:text-slate-300">
          {b.totalCopies}
        </span>
      ),
    },
    {
      key: 'lastBorrowDate',
      header: 'Last Borrowed',
      sortable: true,
      render: (b) => (
        <span className="font-mono text-[11px] text-slate-500">
          {b.lastBorrowDate ? b.lastBorrowDate : 'Never'}
        </span>
      ),
    },
    {
      key: 'shelfLocation',
      header: 'Shelf',
      render: (b) => (
        <span className="font-mono text-[11px] text-slate-500">
          {b.shelfLocation ?? '—'}
        </span>
      ),
    },
    {
      key: 'weeding' as any,
      header: 'Recommendation',
      render: () => <Badge color="amber">Consider weeding</Badge>,
    },
  ];

  const handleDownloadDemand = () => {
    downloadCSV(
      demandBooks.map((b) => ({
        Title: b.title,
        Authors: authorStr(b.authors),
        ISBN: b.isbn ?? '',
        'Available Copies': b.availableCopies,
        'Total Copies': b.totalCopies,
        'Reservation Queue': b.reservationCount,
        'Suggested Purchase Qty': b.suggestedQty,
        'Shelf Location': b.shelfLocation ?? '',
      })),
      'demand-books.csv'
    );
    toast.success('Demand report exported');
  };

  const handleDownloadIdle = () => {
    downloadCSV(
      idleBooks.map((b) => ({
        Title: b.title,
        Authors: authorStr(b.authors),
        ISBN: b.isbn ?? '',
        'Total Copies': b.totalCopies,
        'Last Borrowed': b.lastBorrowDate ?? 'Never',
        'Shelf Location': b.shelfLocation ?? '',
        Recommendation: 'Consider weeding',
      })),
      'idle-books.csv'
    );
    toast.success('Idle books report exported');
  };

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    {
      key: 'demand',
      label: 'Buy More',
      icon: <ShoppingCart className="w-3.5 h-3.5" />,
      count: demandBooks.length,
    },
    {
      key: 'idle',
      label: 'Idle Books',
      icon: <Archive className="w-3.5 h-3.5" />,
      count: idleBooks.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Demand & Idle Analysis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Actionable procurement and weeding recommendations based on real circulation data.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={activeTab === 'demand' ? handleDownloadDemand : handleDownloadIdle}
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={() => {
              refetchDemand();
              refetchIdle();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          number={demandBooks.length}
          label="Books Needing More Copies"
          icon={ShoppingCart}
          color="rose"
          trend={{
            value: `${demandBooks.reduce((s, b) => s + b.suggestedQty, 0)} copies suggested`,
            direction: 'neutral',
          }}
        />
        <StatCard
          number={idleBooks.length}
          label="Idle Books (180+ Days)"
          icon={Archive}
          color="amber"
          trend={{
            value: `${idleBooks.reduce((s, b) => s + b.totalCopies, 0)} shelf copies`,
            direction: 'neutral',
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${activeTab === tab.key
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key
                  ? tab.key === 'demand'
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Demand Tab */}
      {activeTab === 'demand' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>High-Demand Books — Procurement Recommendations</CardTitle>
              <p className="text-xs text-slate-500">
                Suggested qty = reservations − available + 1
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {demandLoading ? (
              <div className="p-6">
                <Skeleton variant="table" rows={4} cols={5} />
              </div>
            ) : demandError ? (
              <div className="p-8">
                <ErrorState
                  title="Could not load demand data"
                  message={(demandErrObj as Error)?.message || 'Failed to fetch high-demand books.'}
                  onRetry={() => refetchDemand()}
                />
              </div>
            ) : demandBooks.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Package className="w-10 h-10 text-slate-300" />}
                  title="No demand gaps detected"
                  description="All books have sufficient copies to meet current reservation queues."
                />
              </div>
            ) : (
              <Table columns={demandColumns} data={demandBooks} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Idle Tab */}
      {activeTab === 'idle' && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Idle Books — Zero Borrows in 180 Days</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Weeding candidates
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {idleLoading ? (
              <div className="p-6">
                <Skeleton variant="table" rows={4} cols={5} />
              </div>
            ) : idleError ? (
              <div className="p-8">
                <ErrorState
                  title="Could not load idle books"
                  message={(idleErrObj as Error)?.message || 'Failed to fetch idle catalog inventory.'}
                  onRetry={() => refetchIdle()}
                />
              </div>
            ) : idleBooks.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={<Layers className="w-10 h-10 text-slate-300" />}
                  title="No idle books found"
                  description="All books in the collection have had at least one borrow in the past 180 days."
                />
              </div>
            ) : (
              <Table columns={idleColumns} data={idleBooks} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
