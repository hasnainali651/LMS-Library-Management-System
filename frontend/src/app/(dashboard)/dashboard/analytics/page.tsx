'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
        totalBooks: d.totalBooks ?? 0,
        totalBooksChange: d.totalBooksChange ?? 0,
        activeMembers: d.activeMembers ?? 0,
        activeMembersChange: d.activeMembersChange ?? 0,
        issuedThisMonth: d.issuedThisMonth ?? 0,
        issuedThisMonthChange: d.issuedThisMonthChange ?? 0,
        finesCollectedThisMonth: d.finesCollectedThisMonth ?? 0,
        finesCollectedChange: d.finesCollectedChange ?? 0,
        totalBooks_sparkline: d.totalBooks_sparkline ?? [],
        activeMembers_sparkline: d.activeMembers_sparkline ?? [],
        issued_sparkline: d.issued_sparkline ?? [],
        fines_sparkline: d.fines_sparkline ?? [],
      });
    } catch {
      setMetrics(null);
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
            : []
        );
      } else {
        setCirculation([]);
      }

      if (catRes.status === 'fulfilled') {
        const raw = catRes.value.data?.data || catRes.value.data;
        setCategories(
          Array.isArray(raw)
            ? raw
                .slice(0, 10)
                .sort((a: any, b: any) => (b.count ?? b.borrows ?? 0) - (a.count ?? a.borrows ?? 0))
                .map((c: any) => ({ category: c.category ?? c._id ?? 'Unknown', borrows: c.count ?? c.borrows ?? 0 }))
            : []
        );
      } else {
        setCategories([]);
      }

      if (fineRes.status === 'fulfilled') {
        const raw = fineRes.value.data?.data || fineRes.value.data;
        setFinesSummary(Array.isArray(raw) ? raw : []);
      } else {
        setFinesSummary([]);
      }
    } catch {
      setCirculation([]);
      setFinesSummary([]);
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
          : []
      );
    } catch {
      setPopularBooks([]);
    } finally {
      setBooksLoading(false);
    }
  };

  const handleRefresh = () => {
    setLastRefreshed(new Date());
    fetchMetrics();
    fetchCharts();
    fetchPopularBooks();
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [dashRes, circRes, catRes, fineRes, popularRes] = await Promise.allSettled([
          api.get('/analytics/dashboard'),
          api.get('/analytics/circulation/trends'),
          api.get('/analytics/categories/demand'),
          api.get('/analytics/fines/summary'),
          api.get('/analytics/books/popular'),
        ]);

        if (!active) return;

        if (dashRes.status === 'fulfilled') {
          const d = dashRes.value.data?.data || dashRes.value.data;
          setMetrics({
            totalBooks: d.totalBooks ?? 0,
            totalBooksChange: d.totalBooksChange ?? 0,
            activeMembers: d.activeMembers ?? 0,
            activeMembersChange: d.activeMembersChange ?? 0,
            issuedThisMonth: d.issuedThisMonth ?? 0,
            issuedThisMonthChange: d.issuedThisMonthChange ?? 0,
            finesCollectedThisMonth: d.finesCollectedThisMonth ?? 0,
            finesCollectedChange: d.finesCollectedChange ?? 0,
            totalBooks_sparkline: d.totalBooks_sparkline ?? [],
            activeMembers_sparkline: d.activeMembers_sparkline ?? [],
            issued_sparkline: d.issued_sparkline ?? [],
            fines_sparkline: d.fines_sparkline ?? [],
          });
        }
        setMetricsLoading(false);

        if (circRes.status === 'fulfilled') {
          const raw = circRes.value.data?.data || circRes.value.data;
          setCirculation(
            Array.isArray(raw)
              ? raw.map((p: any) => ({
                  date: p.date ? format(parseISO(p.date), 'MMM d') : p.label,
                  issued: p.issued ?? p.checkouts ?? 0,
                  returned: p.returned ?? p.returns ?? 0,
                }))
              : []
          );
        }

        if (catRes.status === 'fulfilled') {
          const raw = catRes.value.data?.data || catRes.value.data;
          setCategories(
            Array.isArray(raw)
              ? raw
                  .slice(0, 10)
                  .sort((a: any, b: any) => (b.count ?? b.borrows ?? 0) - (a.count ?? a.borrows ?? 0))
                  .map((c: any) => ({ category: c.category ?? c._id ?? 'Unknown', borrows: c.count ?? c.borrows ?? 0 }))
              : []
          );
        }

        if (fineRes.status === 'fulfilled') {
          const raw = fineRes.value.data?.data || fineRes.value.data;
          setFinesSummary(Array.isArray(raw) ? raw : []);
        }
        setChartsLoading(false);

        if (popularRes.status === 'fulfilled') {
          const raw = popularRes.value.data?.data || popularRes.value.data;
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
              : []
          );
        }
        setBooksLoading(false);
      } catch {
        if (active) {
          setMetricsLoading(false);
          setChartsLoading(false);
          setBooksLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
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
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
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
            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
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
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-medium">
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
                    <th className="px-5 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider w-10">#</th>
                    <th className="px-5 py-3 text-left font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Title</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">This Month</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">All-Time</th>
                    <th className="px-5 py-3 text-right font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Rating</th>
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
                          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {book.rank}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {book.coverImage ? (
                            <Image
                              src={book.coverImage}
                              alt={book.title || 'Book cover'}
                              width={32}
                              height={40}
                              unoptimized
                              className="w-8 h-10 object-cover rounded shadow-sm shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-10 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              <BookOpen className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[220px]">{book.title}</p>
                            <p className="text-slate-600 dark:text-slate-400 font-medium truncate max-w-[200px] mt-0.5">{authorStr(book.authors)}</p>
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
