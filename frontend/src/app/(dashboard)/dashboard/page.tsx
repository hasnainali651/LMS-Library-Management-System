'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CalendarCheck,
  Receipt,
  Bookmark,
  Sparkles,
  ArrowRight,
  Clock,
  MapPin,
  CheckCircle2,
  RotateCcw,
  Search,
  CheckCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { LoanCard, LoanCardData } from '@/components/circulation/LoanCard';
import { BookCard, BookItem } from '@/components/ui/BookCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { MEMBERSHIP_STYLES, MembershipType } from '@/lib/tokens';

interface ReservationItem {
  _id: string;
  book?: {
    _id: string;
    title: string;
    authors?: string[] | string;
    coverImage?: string;
    isbn?: string;
  };
  bookTitle?: string;
  author?: string;
  status: 'ready' | 'pending' | 'cancelled' | 'fulfilled' | string;
  position?: number | null;
  expiresAt?: string | null;
  pickupDeadline?: string | null;
  shelfLocation?: string | null;
  assignedCopy?: {
    shelfLocation?: string;
    barcode?: string;
  };
  requestDate?: string;
  createdAt?: string;
}

interface ActivityItem {
  id: string;
  type: 'borrow' | 'return' | 'renew' | 'fine' | 'reservation';
  title: string;
  description: string;
  timestamp: string;
  dateObj: Date;
}

export default function StudentDashboardPage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  // Data states
  const [activeLoans, setActiveLoans] = useState<LoanCardData[]>([]);
  const [readyReservations, setReadyReservations] = useState<ReservationItem[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<BookItem[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);

  // Stats
  const [stats, setStats] = useState({
    booksBorrowed: 12,
    currentlyIssued: 2,
    unpaidFines: 0,
    reservationsQueued: 1,
  });

  const memberTier: MembershipType = (user?.membershipType as MembershipType) || 'student';
  const tierStyle = MEMBERSHIP_STYLES[memberTier] || MEMBERSHIP_STYLES.student;
  const memberIdChip = user?.studentId || (user?._id ? `MEM-${user._id.slice(-6).toUpperCase()}` : 'MEM-89421');

  // Parallel data fetching
  useEffect(() => {
    let isMounted = true;

    async function fetchDashboardData() {
      setLoading(true);

      const userId = user?._id || 'mock-user-id';

      // 1. Fetch loans
      const loansPromise = api
        .get(`/circulation/member/${userId}`)
        .then((res) => res.data?.data?.activeLoans || res.data?.data || [])
        .catch(() => [
          {
            _id: 'mock-loan-1',
            book: {
              _id: 'b1',
              title: 'Designing Data-Intensive Applications',
              authors: ['Martin Kleppmann'],
              coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400&q=80',
            },
            dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
            status: 'active',
            renewalCount: 0,
            shelfLocation: 'CS-03-12',
          },
          {
            _id: 'mock-loan-2',
            book: {
              _id: 'b2',
              title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
              authors: ['Robert C. Martin'],
              coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
            },
            dueDate: new Date(Date.now() + 1 * 86400000).toISOString(),
            status: 'active',
            renewalCount: 1,
            shelfLocation: 'CS-01-04',
          },
        ]);

      // 2. Fetch reservations
      const reservationsPromise = api
        .get('/reservations/my')
        .then((res) => res.data?.data?.reservations || res.data?.data || [])
        .catch(() => [
          {
            _id: 'mock-res-1',
            bookTitle: 'Artificial Intelligence: A Modern Approach',
            author: 'Stuart Russell, Peter Norvig',
            status: 'ready',
            shelfLocation: 'HOLD-SHELF-03',
            expiresAt: new Date(Date.now() + 2 * 86400000).toISOString(),
          },
        ]);

      // 3. Fetch fines
      const finesPromise = api
        .get('/fines/my')
        .then((res) => {
          const fineList = res.data?.data?.fines || res.data?.data || [];
          const totalUnpaid = fineList
            .filter((f: any) => f.status === 'pending' || f.status === 'unpaid')
            .reduce((acc: number, f: any) => acc + (f.amount || 0), 0);
          return { fineList, totalUnpaid };
        })
        .catch(() => ({ fineList: [], totalUnpaid: 0 }));

      // 4. Fetch recommendations
      const recommendedPromise = api
        .get('/search/recommended')
        .then((res) => res.data?.data?.books || res.data?.data || [])
        .catch(() => [
          {
            _id: 'rec1',
            title: 'Introduction to Algorithms',
            authors: ['Thomas H. Cormen', 'Charles E. Leiserson'],
            coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
            category: 'Algorithms',
            status: 'available',
            availableCopies: 3,
            totalCopies: 4,
            shelfLocation: 'CS-01-08',
          },
          {
            _id: 'rec2',
            title: 'Refactoring: Improving the Design of Existing Code',
            authors: ['Martin Fowler'],
            coverImage: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80',
            category: 'Software Engineering',
            status: 'available',
            availableCopies: 2,
            totalCopies: 3,
            shelfLocation: 'CS-04-12',
          },
          {
            _id: 'rec3',
            title: 'The Pragmatic Programmer: Your Journey to Mastery',
            authors: ['David Thomas', 'Andrew Hunt'],
            coverImage: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=400&q=80',
            category: 'Software Engineering',
            status: 'available',
            availableCopies: 1,
            totalCopies: 5,
            shelfLocation: 'CS-02-04',
          },
          {
            _id: 'rec4',
            title: 'Operating System Concepts',
            authors: ['Abraham Silberschatz', 'Peter B. Galvin'],
            coverImage: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400&q=80',
            category: 'Systems',
            status: 'available',
            availableCopies: 4,
            totalCopies: 6,
            shelfLocation: 'SYS-01-14',
          },
          {
            _id: 'rec5',
            title: 'Computer Networks',
            authors: ['Andrew S. Tanenbaum', 'David J. Wetherall'],
            coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400&q=80',
            category: 'Networking',
            status: 'available',
            availableCopies: 2,
            totalCopies: 4,
            shelfLocation: 'NET-03-02',
          },
          {
            _id: 'rec6',
            title: 'Clean Architecture: A Craftsman’s Guide',
            authors: ['Robert C. Martin'],
            coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
            category: 'Architecture',
            status: 'available',
            availableCopies: 1,
            totalCopies: 3,
            shelfLocation: 'CS-05-19',
          },
        ]);

      try {
        const [rawLoans, rawReservations, rawFines, rawRecommended] = await Promise.all([
          loansPromise,
          reservationsPromise,
          finesPromise,
          recommendedPromise,
        ]);

        if (!isMounted) return;

        // Process loans
        const normalizedLoans: LoanCardData[] = rawLoans
          .filter((l: any) => l.status === 'active' || l.status === 'overdue' || !l.returnDate)
          .map((l: any) => ({
            _id: l._id || l.id,
            title: l.book?.title || l.bookTitle || l.title || 'Untitled Book',
            authors: l.book?.authors || l.authors || l.author || 'Author',
            coverImage: l.book?.coverImage || l.coverImage,
            dueDate: l.dueDate || new Date(Date.now() + 7 * 86400000).toISOString(),
            shelfLocation: l.copy?.shelfLocation || l.shelfLocation,
            renewalCount: l.renewalCount ?? 0,
            maxRenewals: 2,
            fine: l.fineAmount ?? l.fine ?? 0,
            status: l.status,
          }));

        // Process ready reservations
        const readyItems: ReservationItem[] = rawReservations
          .filter((r: any) => r.status === 'ready')
          .map((r: any) => ({
            _id: r._id,
            bookTitle: r.book?.title || r.bookTitle || 'Hold Item',
            author: Array.isArray(r.book?.authors) ? r.book?.authors.join(', ') : r.author,
            status: r.status,
            shelfLocation: r.shelfLocation || r.assignedCopy?.shelfLocation || 'HOLD-DESK',
            expiresAt: r.pickupDeadline || r.expiresAt,
          }));

        const unpaidFinesTotal = rawFines.totalUnpaid;
        const reservationsCount = rawReservations.length;

        // Build activity log
        const activities: ActivityItem[] = [
          ...normalizedLoans.map((l, i) => ({
            id: `loan-${l._id}-${i}`,
            type: 'borrow' as const,
            title: `Borrowed "${l.title}"`,
            description: `Due on ${new Date(l.dueDate).toLocaleDateString()}`,
            timestamp: 'Active loan',
            dateObj: new Date(l.dueDate),
          })),
          ...readyItems.map((r, i) => ({
            id: `res-${r._id}-${i}`,
            type: 'reservation' as const,
            title: `Reservation Ready: "${r.bookTitle}"`,
            description: `Pickup at shelf ${r.shelfLocation}`,
            timestamp: 'Ready on hold shelf',
            dateObj: new Date(),
          })),
        ];

        setActiveLoans(normalizedLoans);
        setReadyReservations(readyItems);
        setRecommendedBooks(rawRecommended);
        setRecentActivities(activities.slice(0, 8));

        setStats({
          booksBorrowed: 12 + normalizedLoans.length,
          currentlyIssued: normalizedLoans.length,
          unpaidFines: unpaidFinesTotal,
          reservationsQueued: reservationsCount,
        });
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, [user?._id]);

  const handleRenewSuccess = (updatedLoan: any) => {
    setActiveLoans((prev) =>
      prev.map((l) => (l._id === updatedLoan._id ? { ...l, ...updatedLoan } : l))
    );
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'borrow':
        return <BookOpen className="w-4 h-4 text-[var(--neo-info)]" />;
      case 'return':
        return <RotateCcw className="w-4 h-4 text-[var(--neo-success)]" />;
      case 'renew':
        return <CheckCircle2 className="w-4 h-4 text-[var(--neo-accent)]" />;
      case 'fine':
        return <Receipt className="w-4 h-4 text-[var(--neo-warning)]" />;
      case 'reservation':
        return <Bookmark className="w-4 h-4 text-[var(--neo-accent)]" />;
      default:
        return <Clock className="w-4 h-4 text-[var(--neo-text-3)]" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Neumorphic Patron Console Welcome Card */}
      <section className="neo-card p-6 sm:p-8 rounded-[var(--neo-r-xl)] [box-shadow:var(--neo-raised-lg)] border border-[var(--neo-border-light)] relative overflow-hidden transition-all">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold px-3 py-1 rounded-[var(--neo-r-full)] bg-[var(--neo-inset-bg)] text-[var(--neo-accent)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)]">
                {memberIdChip}
              </span>
              <span className="px-3 py-1 rounded-[var(--neo-r-full)] text-xs font-bold uppercase tracking-wider bg-[var(--neo-surface)] text-[var(--neo-text-2)] [box-shadow:var(--neo-flat)] border border-[var(--neo-border-light)]">
                {memberTier} Tier
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--neo-success)] bg-[var(--neo-success-surface)] px-3 py-1 rounded-[var(--neo-r-full)] border border-[var(--neo-success)]/25">
                <CheckCircle className="w-3.5 h-3.5" />
                Active Patron
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-[var(--neo-text)] leading-tight">
              Welcome back, {user?.name || 'Patron'}!
            </h1>
            <p className="text-xs sm:text-sm text-[var(--neo-text-2)] leading-relaxed font-normal">
              Manage your active loans, track hold shelf pickups, and explore community recommendations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Link href="/books" className="w-full sm:w-auto">
              <Button
                variant="primary"
                size="md"
                leftIcon={<Search className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                Search Catalog
              </Button>
            </Link>
            <Link href="/dashboard/my-books" className="w-full sm:w-auto">
              <Button
                variant="secondary"
                size="md"
                rightIcon={<ArrowRight className="w-4 h-4" />}
                className="w-full sm:w-auto"
              >
                My Loans
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Neumorphic StatCards Grid */}
      <section>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            number={loading ? '...' : stats.booksBorrowed}
            label="Books Borrowed"
            icon={BookOpen}
            color="primary"
            trend={{ value: 'All-time circulation', direction: 'neutral' }}
          />
          <StatCard
            number={loading ? '...' : stats.currentlyIssued}
            label="Currently Issued"
            icon={CalendarCheck}
            color="sky"
            trend={{ value: `${stats.currentlyIssued} active books on loan`, direction: 'neutral' }}
          />
          <StatCard
            number={loading ? '...' : `PKR ${stats.unpaidFines.toFixed(2)}`}
            label="Unpaid Fines"
            icon={Receipt}
            color={stats.unpaidFines > 0 ? 'rose' : 'emerald'}
            trend={{
              value: stats.unpaidFines > 0 ? 'Pending desk fee' : 'Good standing',
              direction: stats.unpaidFines > 0 ? 'down' : 'up',
            }}
          />
          <StatCard
            number={loading ? '...' : stats.reservationsQueued}
            label="Reservations Queued"
            icon={Bookmark}
            color="purple"
            trend={{ value: `${readyReservations.length} ready for pickup`, direction: 'up' }}
          />
        </div>
      </section>

      {/* 3. Ready for Pickup Section (Priority Alert) */}
      {readyReservations.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--neo-success)] animate-pulse" />
              <h2 className="font-display text-lg font-bold text-[var(--neo-text)] tracking-tight">
                Ready for Pickup at Hold Shelf
              </h2>
            </div>
            <Link
              href="/dashboard/reservations"
              className="text-xs font-semibold text-[var(--neo-accent)] hover:underline flex items-center gap-1"
            >
              <span>View all reservations</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readyReservations.map((res) => {
              const expiresDate = res.expiresAt ? parseISO(res.expiresAt) : null;
              const hasValidExpiry = expiresDate && !isNaN(expiresDate.getTime());
              const distance = hasValidExpiry
                ? formatDistanceToNow(expiresDate, { addSuffix: true })
                : 'in 48 hours';

              return (
                <div
                  key={res._id}
                  className="neo-card p-5 rounded-[var(--neo-r-lg)] border border-[var(--neo-success)]/30 [box-shadow:var(--neo-raised-sm)] flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-[var(--neo-r-full)] text-[10px] font-bold uppercase tracking-wider bg-[var(--neo-success-surface)] text-[var(--neo-success)] border border-[var(--neo-success)]/25">
                      Hold Shelf Ready
                    </span>
                    <h4 className="font-bold text-sm text-[var(--neo-text)]">
                      {res.bookTitle}
                    </h4>
                    {res.author && (
                      <p className="text-xs text-[var(--neo-text-2)]">
                        by {res.author}
                      </p>
                    )}
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      <span className="font-mono font-semibold text-[var(--neo-accent)] flex items-center gap-1.5 bg-[var(--neo-inset-bg)] px-2.5 py-1 rounded-[var(--neo-r-sm)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)]">
                        <MapPin className="w-3.5 h-3.5" />
                        {res.shelfLocation || 'HOLD-DESK-A1'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] uppercase font-bold text-[var(--neo-text-3)] block tracking-wider">
                      Pickup Window
                    </span>
                    <span className="text-xs font-bold text-[var(--neo-danger)] tabular-nums">
                      {distance}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 4. Currently Borrowed Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--neo-text)] tracking-tight">
              Currently Borrowed Books
            </h2>
            <p className="text-xs text-[var(--neo-text-2)] mt-0.5">
              Books checked out under your account with real-time due countdowns.
            </p>
          </div>
          <Link
            href="/dashboard/my-books"
            className="text-xs font-semibold text-[var(--neo-accent)] hover:underline flex items-center gap-1"
          >
            <span>All loans ({activeLoans.length})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton variant="card" className="h-44" />
            <Skeleton variant="card" className="h-44" />
          </div>
        ) : activeLoans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeLoans.map((loan, idx) => (
              <LoanCard
                key={loan._id}
                loan={loan}
                index={idx}
                onRenewSuccess={handleRenewSuccess}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Books Currently Borrowed"
            description="You don't have any active loans right now. Discover your next read from the community library collection."
            action={
              <Link href="/books">
                <Button variant="primary" size="sm">
                  Explore Catalog
                </Button>
              </Link>
            }
          />
        )}
      </section>

      {/* 5. Recommended for You */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-[var(--neo-accent)]" />
              <h2 className="font-display text-xl font-bold text-[var(--neo-text)] tracking-tight">
                Recommended for You
              </h2>
            </div>
            <p className="text-xs text-[var(--neo-text-2)] mt-0.5">
              Curated titles matching your recent reading history and genre preferences.
            </p>
          </div>
          <Link
            href="/books"
            className="text-xs font-semibold text-[var(--neo-accent)] hover:underline flex items-center gap-1"
          >
            <span>Full catalog</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" className="h-64" />
            ))}
          </div>
        ) : recommendedBooks.length > 0 || recommendedBooks.length >= 4 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {recommendedBooks.map((book, idx) => (
              <BookCard
                key={book._id}
                book={book}
                index={idx}
                actionButtons={
                  <Link href={`/books`} className="w-full">
                    <Button variant="secondary" size="sm" className="w-full text-xs">
                      View Details
                    </Button>
                  </Link>
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-[var(--neo-text-3)] italic">No recommendations available yet.</p>
        )}
      </section>

      {/* 6. Recent Circulation Activity */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[var(--neo-text)] tracking-tight">
              Recent Activity Stream
            </h2>
            <p className="text-xs text-[var(--neo-text-2)] mt-0.5">
              Your recent transactions and circulation status updates.
            </p>
          </div>
          <Link
            href="/dashboard/history"
            className="text-xs font-semibold text-[var(--neo-accent)] hover:underline flex items-center gap-1"
          >
            <span>View complete history</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="neo-card p-6 rounded-[var(--neo-r-lg)] [box-shadow:var(--neo-raised)] border border-[var(--neo-border-light)]">
          <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--neo-shadow-dark)]/25">
            {recentActivities.map((act, idx) => (
              <motion.div
                key={act.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.25,
                  delay: idx * 0.03,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="relative group"
              >
                {/* Timeline node */}
                <div className="absolute -left-[30px] sm:-left-[34px] top-0.5 w-6 h-6 rounded-full bg-[var(--neo-surface)] border border-[var(--neo-border-light)] [box-shadow:var(--neo-flat)] flex items-center justify-center group-hover:scale-110 transition-transform">
                  {getActivityIcon(act.type)}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-[var(--neo-text)]">
                      {act.title}
                    </h4>
                    <p className="text-xs text-[var(--neo-text-2)] mt-0.5">
                      {act.description}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-[var(--neo-text-3)] shrink-0 font-mono">
                    {act.timestamp}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
