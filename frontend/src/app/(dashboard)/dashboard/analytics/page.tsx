'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const CirculationTrendsChart = dynamic(
  () => import('@/components/analytics/AnalyticsCharts').then((m) => m.CirculationTrendsChart),
  {
    loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
    ssr: false,
  }
);

const CategoryBorrowsChart = dynamic(
  () => import('@/components/analytics/AnalyticsCharts').then((m) => m.CategoryBorrowsChart),
  {
    loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
    ssr: false,
  }
);

const FinesCollectedChart = dynamic(
  () => import('@/components/analytics/AnalyticsCharts').then((m) => m.FinesCollectedChart),
  {
    loading: () => <Skeleton className="h-72 w-full rounded-xl" />,
    ssr: false,
  }
);
import {
  Library,
  Users,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Banknote,
  BarChart3,
  Star,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw,
  Download,
  AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { format, subDays, parseISO } from 'date-fns';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashboardMetrics {
  totalBooks: number;
  totalBooksChange: number;
  activeMembers: number;
  activeMembersChange: number;
  issuedThisMonth: number;
  issuedThisMonthChange: number;
  finesCollectedThisMonth: number;
  finesCollectedChange: number;
  totalBooks_sparkline: number[];
  activeMembers_sparkline: number[];
  issued_sparkline: number[];
  fines_sparkline: number[];
}

interface CirculationPoint {
  date: string;
  issued: number;
  returned: number;
}

interface CategoryPoint {
  category: string;
  borrows: number;
}

interface PopularBook {
  rank: number;
  _id: string;
  title: string;
  authors: string[] | string;
  coverImage?: string;
  thisMonthBorrows: number;
  totalBorrows: number;
  rating?: number;
}

interface FineMonthPoint {
  month: string;
  collected: number;
  waived: number;
  pending: number;
}

// ─── Sparkline Mini Chart (Pure SVG for fast rendering) ─────────────────────
const MiniSparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  if (!data?.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * 96;
      const y = 32 - ((val - min) / range) * 26 - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <div className="w-24 h-8" role="img" aria-label="Trend sparkline">
      <svg className="w-full h-full overflow-visible" viewBox="0 0 96 32">
        <polyline
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    </div>
  );
};

// ─── StatCard with Sparkline ──────────────────────────────────────────────────
interface AnalyticsStatCardProps {
  label: string;
  value: string;
  change: number;
  sparkline: number[];
  sparkColor: string;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
}

const AnalyticsStatCard: React.FC<AnalyticsStatCardProps> = ({
  label, value, change, sparkline, sparkColor, icon, iconBg, loading,
}) => {
  const isUp = change >= 0;
  const isNeutral = change === 0;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[var(--neo-card)] p-5 border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] shadow-[var(--neo-raised)] hover:shadow-[var(--neo-raised-lg)] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--neo-text-muted)] mb-1">
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-28 rounded-md" />
          ) : (
            <p className="font-display text-2xl font-bold tracking-tight tabular-nums text-[var(--neo-text-primary)]">
              {value}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium">
            {isNeutral ? (
              <span className="flex items-center gap-0.5 text-[var(--neo-text-muted)]">
                <Minus className="w-3 h-3" />
                <span>No change</span>
              </span>
            ) : isUp ? (
              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>+{Math.abs(change)}%</span>
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-semibold tabular-nums">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>{change}%</span>
              </span>
            )}
            <span className="text-[var(--neo-text-muted)]">vs last period</span>
          </div>
        </div>
        <div className="w-11 h-11 rounded-xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] shadow-[var(--neo-inset-sm)] flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        {loading ? (
          <Skeleton className="h-8 w-24 rounded" />
        ) : (
          <MiniSparkline data={sparkline} color={sparkColor} />
        )}
      </div>
    </div>
  );
};

// ─── Mock helpers (real API called first, fallback to mock) ───────────────────
function generateCirculationMock(): CirculationPoint[] {
  return Array.from({ length: 30 }, (_, i) => ({
    date: format(subDays(new Date(), 29 - i), 'MMM d'),
    issued: Math.floor(18 + Math.random() * 42),
    returned: Math.floor(14 + Math.random() * 38),
  }));
}

function generateFineMock(): FineMonthPoint[] {
  const months = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
  return months.map((month) => ({
    month,
    collected: Math.floor(800 + Math.random() * 900),
    waived: Math.floor(80 + Math.random() * 180),
    pending: Math.floor(200 + Math.random() * 400),
  }));
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [chartsLoading, setChartsLoading] = useState(true);
  const [booksLoading, setBooksLoading] = useState(true);

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [circulation, setCirculation] = useState<CirculationPoint[]>([]);
  const [categories, setCategories] = useState<CategoryPoint[]>([]);
  const [popularBooks, setPopularBooks] = useState<PopularBook[]>([]);
  const [finesSummary, setFinesSummary] = useState<FineMonthPoint[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  const fetchMetrics = async () => {
    setMetricsLoading(true);
    try {
      const res = await api.get('/analytics/dashboard');
      const d = res.data?.data || res.data;
      setMetrics({
        totalBooks: d.totalBooks ?? 4820,
        totalBooksChange: d.totalBooksChange ?? 3.2,
        activeMembers: d.activeMembers ?? 642,
        activeMembersChange: d.activeMembersChange ?? 8.1,
        issuedThisMonth: d.issuedThisMonth ?? 938,
        issuedThisMonthChange: d.issuedThisMonthChange ?? 14.2,
        finesCollectedThisMonth: d.finesCollectedThisMonth ?? 12480,
        finesCollectedChange: d.finesCollectedChange ?? -2.5,
        totalBooks_sparkline: d.totalBooks_sparkline ?? [44, 47, 46, 50, 49, 51, 53, 52, 55, 58, 57, 60],
        activeMembers_sparkline: d.activeMembers_sparkline ?? [580, 590, 600, 595, 610, 620, 615, 630, 638, 640, 641, 642],
        issued_sparkline: d.issued_sparkline ?? [750, 800, 810, 820, 870, 900, 880, 910, 920, 935, 940, 938],
        fines_sparkline: d.fines_sparkline ?? [14000, 13500, 13800, 12900, 13200, 12800, 12600, 12300, 12000, 12400, 12500, 12480],
      });
    } catch {
      setMetrics({
        totalBooks: 4820, totalBooksChange: 3.2,
        activeMembers: 642, activeMembersChange: 8.1,
        issuedThisMonth: 938, issuedThisMonthChange: 14.2,
        finesCollectedThisMonth: 12480, finesCollectedChange: -2.5,
        totalBooks_sparkline: [44, 47, 46, 50, 49, 51, 53, 52, 55, 58, 57, 60],
        activeMembers_sparkline: [580, 590, 600, 595, 610, 620, 615, 630, 638, 640, 641, 642],
        issued_sparkline: [750, 800, 810, 820, 870, 900, 880, 910, 920, 935, 940, 938],
        fines_sparkline: [14000, 13500, 13800, 12900, 13200, 12800, 12600, 12300, 12000, 12400, 12500, 12480],
      });
    } finally {
      setMetricsLoading(false);
    }
  };

  const fetchCharts = async () => {
    setChartsLoading(true);
    try {
      const [circRes, catRes, fineRes] = await Promise.allSettled([
        api.get('/analytics/circulation/trends'),
        api.get('/analytics/categories/demand'),
        api.get('/analytics/fines/summary'),
      ]);

      if (circRes.status === 'fulfilled') {
        const raw = circRes.value.data?.data || circRes.value.data;
        setCirculation(
          Array.isArray(raw)
            ? raw.map((p: any) => ({
                date: p.date ? format(parseISO(p.date), 'MMM d') : p.label,
                issued: p.issued ?? p.checkouts ?? 0,
                returned: p.returned ?? p.returns ?? 0,
              }))
            : generateCirculationMock()
        );
      } else {
        setCirculation(generateCirculationMock());
      }

      if (catRes.status === 'fulfilled') {
        const raw = catRes.value.data?.data || catRes.value.data;
        setCategories(
          Array.isArray(raw)
            ? raw
                .slice(0, 10)
                .sort((a: any, b: any) => (b.count ?? b.borrows ?? 0) - (a.count ?? a.borrows ?? 0))
                .map((c: any) => ({ category: c.category ?? c._id ?? 'Unknown', borrows: c.count ?? c.borrows ?? 0 }))
            : [
                { category: 'Computer Science', borrows: 480 },
                { category: 'Fiction', borrows: 320 },
                { category: 'Science', borrows: 260 },
                { category: 'History', borrows: 210 },
                { category: 'Mathematics', borrows: 195 },
                { category: 'Philosophy', borrows: 140 },
                { category: 'Psychology', borrows: 130 },
                { category: 'Economics', borrows: 115 },
                { category: 'Engineering', borrows: 100 },
                { category: 'Literature', borrows: 90 },
              ]
        );
      } else {
        setCategories([
          { category: 'Computer Science', borrows: 480 },
          { category: 'Fiction', borrows: 320 },
          { category: 'Science', borrows: 260 },
          { category: 'History', borrows: 210 },
          { category: 'Mathematics', borrows: 195 },
          { category: 'Philosophy', borrows: 140 },
          { category: 'Psychology', borrows: 130 },
          { category: 'Economics', borrows: 115 },
          { category: 'Engineering', borrows: 100 },
          { category: 'Literature', borrows: 90 },
        ]);
      }

      if (fineRes.status === 'fulfilled') {
        const raw = fineRes.value.data?.data || fineRes.value.data;
        setFinesSummary(Array.isArray(raw) ? raw : generateFineMock());
      } else {
        setFinesSummary(generateFineMock());
      }
    } catch {
      setCirculation(generateCirculationMock());
      setFinesSummary(generateFineMock());
    } finally {
      setChartsLoading(false);
    }
  };

  const fetchPopularBooks = async () => {
    setBooksLoading(true);
    try {
      const res = await api.get('/analytics/books/popular');
      const raw = res.data?.data || res.data;
      setPopularBooks(
        Array.isArray(raw)
          ? raw.slice(0, 10).map((b: any, i: number) => ({
              rank: i + 1,
              _id: b._id,
              title: b.title ?? b.book?.title ?? 'Untitled',
              authors: b.authors ?? b.book?.authors ?? [],
              coverImage: b.coverImage ?? b.book?.coverImage,
              thisMonthBorrows: b.thisMonthBorrows ?? b.monthBorrows ?? b.borrows ?? 0,
              totalBorrows: b.totalBorrows ?? b.allTimeBorrows ?? 0,
              rating: b.rating,
            }))
          : mockPopularBooks
      );
    } catch {
      setPopularBooks(mockPopularBooks);
    } finally {
      setBooksLoading(false);
    }
  };

  const mockPopularBooks: PopularBook[] = [
    { rank: 1, _id: 'b1', title: 'Clean Code', authors: ['Robert C. Martin'], thisMonthBorrows: 38, totalBorrows: 412, rating: 4.8 },
    { rank: 2, _id: 'b2', title: 'The Pragmatic Programmer', authors: ['David Thomas', 'Andrew Hunt'], thisMonthBorrows: 31, totalBorrows: 388 },
    { rank: 3, _id: 'b3', title: 'Design Patterns', authors: ['Gang of Four'], thisMonthBorrows: 29, totalBorrows: 360, rating: 4.6 },
    { rank: 4, _id: 'b4', title: 'Introduction to Algorithms', authors: ['CLRS'], thisMonthBorrows: 27, totalBorrows: 342, rating: 4.5 },
    { rank: 5, _id: 'b5', title: 'Atomic Habits', authors: ['James Clear'], thisMonthBorrows: 25, totalBorrows: 310, rating: 4.9 },
    { rank: 6, _id: 'b6', title: 'Deep Work', authors: ['Cal Newport'], thisMonthBorrows: 22, totalBorrows: 280 },
    { rank: 7, _id: 'b7', title: 'The Psychology of Money', authors: ['Morgan Housel'], thisMonthBorrows: 20, totalBorrows: 255, rating: 4.7 },
    { rank: 8, _id: 'b8', title: 'Sapiens', authors: ['Yuval Noah Harari'], thisMonthBorrows: 18, totalBorrows: 240, rating: 4.4 },
    { rank: 9, _id: 'b9', title: 'AI: A Modern Approach', authors: ['Stuart Russell'], thisMonthBorrows: 16, totalBorrows: 215 },
    { rank: 10, _id: 'b10', title: 'Dune', authors: ['Frank Herbert'], thisMonthBorrows: 14, totalBorrows: 198, rating: 4.8 },
  ];

  const handleRefresh = () => {
    setLastRefreshed(new Date());
    fetchMetrics();
    fetchCharts();
    fetchPopularBooks();
  };

  useEffect(() => {
    fetchMetrics();
    fetchCharts();
    fetchPopularBooks();
  }, []);

  const authorStr = (a: string[] | string) =>
    Array.isArray(a) ? a.join(', ') : a || 'Unknown';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Analytics Dashboard
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Last refreshed at {format(lastRefreshed, 'h:mm a')} · Real-time library intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/analytics/demand">
            <Button variant="secondary" size="sm" leftIcon={<BarChart3 className="w-3.5 h-3.5" />}>
              Demand & Idle
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleRefresh} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        </div>
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <AnalyticsStatCard
          label="Total Books"
          value={metrics ? metrics.totalBooks.toLocaleString() : '—'}
          change={metrics?.totalBooksChange ?? 0}
          sparkline={metrics?.totalBooks_sparkline ?? []}
          sparkColor="#2563eb"
          icon={<Library className="w-5 h-5 text-primary-700 dark:text-primary-400" />}
          iconBg="bg-primary-100 dark:bg-primary-950/60"
          loading={metricsLoading}
        />
        <AnalyticsStatCard
          label="Active Members"
          value={metrics ? metrics.activeMembers.toLocaleString() : '—'}
          change={metrics?.activeMembersChange ?? 0}
          sparkline={metrics?.activeMembers_sparkline ?? []}
          sparkColor="#8b5cf6"
          icon={<Users className="w-5 h-5 text-purple-700 dark:text-purple-400" />}
          iconBg="bg-purple-100 dark:bg-purple-950/60"
          loading={metricsLoading}
        />
        <AnalyticsStatCard
          label="Issued This Month"
          value={metrics ? metrics.issuedThisMonth.toLocaleString() : '—'}
          change={metrics?.issuedThisMonthChange ?? 0}
          sparkline={metrics?.issued_sparkline ?? []}
          sparkColor="#10b981"
          icon={<BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />}
          iconBg="bg-emerald-100 dark:bg-emerald-950/60"
          loading={metricsLoading}
        />
        <AnalyticsStatCard
          label="Fines Collected (PKR)"
          value={metrics ? `PKR ${metrics.finesCollectedThisMonth.toLocaleString()}` : '—'}
          change={metrics?.finesCollectedChange ?? 0}
          sparkline={metrics?.fines_sparkline ?? []}
          sparkColor="#f59e0b"
          icon={<Banknote className="w-5 h-5 text-amber-700 dark:text-amber-400" />}
          iconBg="bg-amber-100 dark:bg-amber-950/60"
          loading={metricsLoading}
        />
      </div>

      {/* ── Circulation Trends ─────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Circulation Trends — Last 30 Days</CardTitle>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary-500" />
                Issued
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Returned
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {chartsLoading ? (
            <Skeleton className="h-72 w-full rounded-xl" />
          ) : (
            <CirculationTrendsChart data={circulation} />
          )}
        </CardContent>
      </Card>

      {/* ── Category Demand + Fine Summary ─────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Category Demand */}
        <Card>
          <CardHeader>
            <CardTitle>Category Demand — Top 10</CardTitle>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : (
              <CategoryBorrowsChart data={categories} />
            )}
          </CardContent>
        </Card>

        {/* Fine Collection Stacked Bar */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Fine Collection — Last 6 Months</CardTitle>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />Collected</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" />Waived</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-400" />Pending</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {chartsLoading ? (
              <Skeleton className="h-72 w-full rounded-xl" />
            ) : (
              <FinesCollectedChart data={finesSummary} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Popular Books Table ────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Popular Books — Top 10 This Month</CardTitle>
            <Link href="/dashboard/analytics/demand">
              <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                Demand Report
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {booksLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    <th className="px-5 py-3 text-left font-semibold text-slate-400 uppercase tracking-wider w-10">#</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-400 uppercase tracking-wider">Title</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-400 uppercase tracking-wider">This Month</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-400 uppercase tracking-wider">All-Time</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-400 uppercase tracking-wider">Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {popularBooks.map((book, idx) => (
                    <motion.tr
                      key={book._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                          idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                          idx === 1 ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300' :
                          idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' :
                          'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {book.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {book.coverImage ? (
                            <img
                              src={book.coverImage}
                              alt=""
                              className="w-8 h-10 object-cover rounded shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]">{book.title}</p>
                            <p className="text-slate-400 truncate max-w-[200px] mt-0.5">{authorStr(book.authors)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-bold text-primary-700 dark:text-primary-400 tabular-nums">{book.thisMonthBorrows}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="text-slate-600 dark:text-slate-300 tabular-nums">{book.totalBorrows.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {book.rating ? (
                          <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold tabular-nums">
                            <Star className="w-3 h-3 fill-amber-400 stroke-amber-500" />
                            {book.rating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
