'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTrackedRouter as useRouter } from '@/hooks/useTrackedRouter';
import Link from 'next/link';
import {
  ArrowLeft,
  Star,
  MapPin,
  BookOpen,
  BookMarked,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Users,
  Copy,
  Globe,
  Calendar,
  Hash,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Wrench,
  MessageSquare,
  ThumbsUp,
  Send,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';
import { useStateDraft } from '@/hooks/useFormDraft';

// ─── Types ────────────────────────────────────────────────────────────────────
interface BookDetail {
  _id: string;
  title: string;
  authors: string[];
  isbn: string;
  publisher?: string;
  publishedYear?: number;
  language?: string;
  category?: string;
  categories?: string[];
  description?: string;
  aiSummary?: string;
  coverImage?: string;
  shelfLocation?: string;
  availableCopies: number;
  totalCopies: number;
  rating?: number;
  reviewCount?: number;
  status?: string;
}

interface BookCopy {
  _id: string;
  barcode?: string;
  status: 'available' | 'issued' | 'reserved' | 'damaged' | 'lost' | 'retired';
  shelfLocation?: string;
  condition?: string;
}

interface Review {
  _id: string;
  user: { name: string; email?: string };
  rating: number;
  comment?: string;
  createdAt: string;
  isApproved: boolean;
}

interface SimilarBook {
  _id: string;
  title: string;
  authors: string[] | string;
  coverImage?: string;
  availableCopies?: number;
  category?: string;
  rating?: number;
}

// ─── Cover Gradient ───────────────────────────────────────────────────────────
const PALETTES = [
  ['#1e3a5f', '#2563eb'], ['#1a3636', '#059669'], ['#3d1a5f', '#7c3aed'],
  ['#5f1a1a', '#dc2626'], ['#3d3100', '#d97706'], ['#0f3d4f', '#0891b2'],
  ['#1f1f3d', '#4f46e5'], ['#3d1f10', '#ea580c'],
];
function getGradient(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

// ─── Star Row ─────────────────────────────────────────────────────────────────
const StarRow: React.FC<{ value: number; size?: 'sm' | 'md'; interactive?: boolean; onChange?: (v: number) => void }> = ({
  value, size = 'md', interactive = false, onChange,
}) => {
  const [hovered, setHovered] = useState(0);
  const sz = size === 'sm' ? 'w-3.5 h-3.5' : 'w-5 h-5';
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => {
        const filled = i < (interactive ? (hovered || value) : Math.round(value));
        return (
          <Star
            key={i}
            className={cn(sz, filled ? 'fill-amber-400 stroke-amber-400' : 'fill-transparent stroke-slate-300 dark:stroke-slate-600', interactive && 'cursor-pointer')}
            onMouseEnter={() => interactive && setHovered(i + 1)}
            onMouseLeave={() => interactive && setHovered(0)}
            onClick={() => interactive && onChange?.(i + 1)}
          />
        );
      })}
    </div>
  );
};

// ─── Copy Status Map ──────────────────────────────────────────────────────────
const COPY_STATUS: Record<string, { label: string; color: string }> = {
  available: { label: 'Available', color: 'text-emerald-600 dark:text-emerald-400' },
  issued: { label: 'Issued', color: 'text-sky-600 dark:text-sky-400' },
  reserved: { label: 'Reserved', color: 'text-amber-600 dark:text-amber-400' },
  damaged: { label: 'Damaged', color: 'text-orange-600 dark:text-orange-400' },
  lost: { label: 'Lost', color: 'text-rose-600 dark:text-rose-400' },
  retired: { label: 'Retired', color: 'text-slate-400' },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const userId = useAuthStore((state) => state.user?._id);
  return <BookDetailContent key={`${userId}:${bookId}`} bookId={bookId} />;
}

function BookDetailContent({ bookId }: { bookId: string }) {
  const router = useRouter();
  const { user } = useAuthStore();

  const [book, setBook] = useState<BookDetail | null>(null);
  const [bookLoading, setBookLoading] = useState(true);

  const [copies, setCopies] = useState<BookCopy[]>([]);
  const [copiesLoading, setCopiesLoading] = useState(false);
  const [showCopies, setShowCopies] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  const [similar, setSimilar] = useState<SimilarBook[]>([]);
  const [similarLoading, setSimilarLoading] = useState(true);

  const [descExpanded, setDescExpanded] = useState(false);

  // Review form
  const [reviewModal, setReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const { clearDraft: clearReviewDraft } = useStateDraft({
    formId: 'book-review', entityId: bookId, enabled: reviewModal, label: 'Book review',
    fields: ['rating', 'comment'], values: { rating: reviewRating, comment: reviewComment },
    onRestore: (draft) => {
      if (draft.rating !== undefined) setReviewRating(draft.rating);
      if (draft.comment !== undefined) setReviewComment(draft.comment);
    },
  });

  // Waitlist
  const [waitlisting, setWaitlisting] = useState(false);

  const isStudent = user?.role === 'student';
  const isLibrarian = user?.role === 'librarian' || user?.role === 'admin';
  const isLoggedIn = !!user;

  // ── Fetch book ─────────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    setBookLoading(true);
    api.get(`/books/${bookId}`)
      .then((res) => {
        const d = res.data?.data || res.data;
        setBook({
          _id: d._id,
          title: d.title,
          authors: Array.isArray(d.authors) ? d.authors : [d.authors],
          isbn: d.isbn,
          publisher: d.publisher,
          publishedYear: d.publishedYear,
          language: d.language,
          category: d.category ?? d.categories?.[0],
          categories: d.categories,
          description: d.description ?? d.aiSummary,
          coverImage: d.coverImage,
          shelfLocation: d.shelfLocation,
          availableCopies: d.availableCopies ?? 0,
          totalCopies: d.totalCopies ?? 0,
          rating: d.rating,
          reviewCount: d.reviewCount,
          status: d.status,
        });
      })
      .catch(() => setBook(null))
      .finally(() => setBookLoading(false));
  }, [bookId]);

  // ── Fetch reviews ──────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    api.get(`/books/${bookId}/reviews`)
      .then((res) => {
        const raw = res.data?.data || res.data;
        setReviews(
          (Array.isArray(raw) ? raw : []).filter((r: Review) => r.isApproved ?? true)
        );
      })
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [bookId]);

  // ── Fetch similar ──────────────────────────────────────────
  useEffect(() => {
    if (!bookId) return;
    api.get(`/books/${bookId}/similar`)
      .then((res) => {
        const raw = res.data?.data || res.data;
        setSimilar(Array.isArray(raw) ? raw.slice(0, 6) : []);
      })
      .catch(() => setSimilar([]))
      .finally(() => setSimilarLoading(false));
  }, [bookId]);

  // ── Fetch copies (librarian) ───────────────────────────────
  useEffect(() => {
    if (!bookId || !isLibrarian) return;
    setCopiesLoading(true);
    api.get(`/books/${bookId}/copies`)
      .then((res) => {
        const raw = res.data?.data || res.data;
        setCopies(Array.isArray(raw) ? raw : []);
      })
      .catch(() => setCopies([]))
      .finally(() => setCopiesLoading(false));
  }, [bookId, isLibrarian]);

  // ── Waitlist ───────────────────────────────────────────────
  const handleWaitlist = async () => {
    if (!book) return;
    setWaitlisting(true);
    try {
      await api.post('/reservations', { bookId: book._id });
      toast.success(`You've joined the waitlist for "${book.title}"`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not join waitlist');
    } finally {
      setWaitlisting(false);
    }
  };

  // ── Submit Review ──────────────────────────────────────────
  const handleSubmitReview = async () => {
    if (reviewRating === 0) { toast.error('Please select a rating'); return; }
    setSubmittingReview(true);
    try {
      await api.post(`/books/${bookId}/reviews`, { rating: reviewRating, comment: reviewComment });
      clearReviewDraft();
      toast.success('Review submitted! It will appear after moderation.');
      setReviewModal(false);
      setReviewRating(0);
      setReviewComment('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  // ── Rating distribution ────────────────────────────────────
  const ratingDist = Array.from({ length: 5 }, (_, i) => {
    const star = 5 - i;
    const count = reviews.filter((r) => r.rating === star).length;
    return { star, count, pct: reviews.length > 0 ? (count / reviews.length) * 100 : 0 };
  });

  if (bookLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 py-10 space-y-6">
          <Skeleton className="h-8 w-32 rounded-xl" />
          <div className="flex gap-8">
            <Skeleton className="w-56 aspect-[3/4] rounded-2xl flex-shrink-0" />
            <div className="flex-1 space-y-4">
              <Skeleton className="h-10 w-3/4 rounded-xl" />
              <Skeleton className="h-5 w-1/2 rounded" />
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-32 w-full rounded-xl mt-6" />
              <div className="flex gap-3">
                <Skeleton className="h-11 w-32 rounded-xl" />
                <Skeleton className="h-11 w-36 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Book Not Found</h2>
          <p className="text-slate-500 mb-6">This book doesn&apos;t exist or has been removed.</p>
          <Link href="/search" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </Link>
        </div>
      </div>
    );
  }

  const palette = getGradient(book.title);
  const isAvailable = book.availableCopies > 0;
  const description = book.description ?? 'No description available.';
  const desc = descExpanded ? description : description.slice(0, 480);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 py-8">

        {/* Back */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 text-sm font-medium mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* ── TOP SECTION ────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-10">

          {/* Left: Cover + Similar */}
          <div className="flex flex-col gap-6 lg:w-56 flex-shrink-0">
            {/* Cover */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full lg:w-56 aspect-[3/4] rounded-2xl overflow-hidden shadow-xl relative"
              style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}
            >
              {book.coverImage ? (
                <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-3 text-center">
                  <div className="w-16 h-20 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-white/80" />
                  </div>
                  <p className="text-white/70 text-xs font-medium">{book.title}</p>
                </div>
              )}
            </motion.div>

            {/* Quick meta */}
            <div className="hidden lg:block space-y-3 text-xs text-slate-500 dark:text-slate-400">
              {book.isbn && (
                <div className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{book.isbn}</span>
                </div>
              )}
              {book.publisher && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{book.publisher}</span>
                </div>
              )}
              {book.publishedYear && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>{book.publishedYear}</span>
                </div>
              )}
              {book.language && (
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="capitalize">{book.language}</span>
                </div>
              )}
              {book.shelfLocation && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary-500 shrink-0" />
                  <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{book.shelfLocation}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Main info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex-1 min-w-0"
          >
            {/* Title */}
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {book.title}
            </h1>

            {/* Authors */}
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              by{' '}
              {book.authors.map((a, i) => (
                <React.Fragment key={a}>
                  <Link
                    href={`/search?q=${encodeURIComponent(a)}`}
                    className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    {a}
                  </Link>
                  {i < book.authors.length - 1 && ', '}
                </React.Fragment>
              ))}
            </p>

            {/* Rating */}
            {(book.rating ?? 0) > 0 && (
              <div className="flex items-center gap-3 mt-3">
                <StarRow value={book.rating!} size="md" />
                <span className="font-bold text-amber-500 tabular-nums">{book.rating!.toFixed(1)}</span>
                <span className="text-sm text-slate-400">({book.reviewCount ?? reviews.length} reviews)</span>
              </div>
            )}

            {/* Categories */}
            <div className="flex flex-wrap gap-2 mt-4">
              {(book.categories ?? (book.category ? [book.category] : [])).map((c) => (
                <Link key={c} href={`/search?categories=${encodeURIComponent(c)}`}>
                  <Badge color="blue" showDot={false}>{c}</Badge>
                </Link>
              ))}
            </div>

            {/* Mobile meta */}
            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs text-slate-500 dark:text-slate-400 lg:hidden">
              {book.isbn && <span className="font-mono">{book.isbn}</span>}
              {book.publishedYear && <span>{book.publishedYear}</span>}
              {book.language && <span className="capitalize">{book.language}</span>}
              {book.publisher && <span>{book.publisher}</span>}
            </div>

            {/* Description */}
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">Description</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                {description.length > 480 && !descExpanded ? desc + '…' : desc}
              </p>
              {description.length > 480 && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-2 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  {descExpanded ? <><ChevronUp className="w-3.5 h-3.5" />Show less</> : <><ChevronDown className="w-3.5 h-3.5" />Read more</>}
                </button>
              )}
            </div>

            {/* ── Availability Widget ─────────────────────────── */}
            <div className="mt-8 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Availability</p>
                  <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
                    <span className={isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}>
                      {book.availableCopies}
                    </span>{' '}
                    <span className="text-slate-400 font-normal text-lg">of {book.totalCopies}</span>
                  </p>
                  <p className="text-xs text-slate-400">copies available</p>
                </div>
                <div className={cn(
                  'w-14 h-14 rounded-full flex items-center justify-center',
                  isAvailable ? 'bg-emerald-100 dark:bg-emerald-950/60' : 'bg-rose-100 dark:bg-rose-950/60'
                )}>
                  {isAvailable
                    ? <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    : <Clock className="w-7 h-7 text-rose-500" />}
                </div>
              </div>

              {/* CTAs */}
              {isLoggedIn && isStudent && (
                <div className="flex flex-wrap gap-3">
                  {isAvailable ? (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-850 text-xs text-emerald-800 dark:text-emerald-300 w-full">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                      <span>Available on shelf {book?.shelfLocation ? <strong>({book.shelfLocation})</strong> : ''}. Please visit the library circulation desk to borrow this copy.</span>
                    </div>
                  ) : (
                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={<Bookmark className="w-4 h-4" />}
                      onClick={handleWaitlist}
                      isLoading={waitlisting}
                    >
                      Join Waitlist
                    </Button>
                  )}
                </div>
              )}

              {isLoggedIn && isLibrarian && (
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="primary"
                    size="md"
                    leftIcon={<BookMarked className="w-4 h-4" />}
                    onClick={() => router.push(`/dashboard/circulation?search=${encodeURIComponent(book?.isbn || book?.title || '')}`)}
                  >
                    Issue at Circulation Desk
                  </Button>
                </div>
              )}

              {!isLoggedIn && (
                <p className="text-xs text-slate-400">
                  <Link href="/login" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">Sign in</Link> to borrow or reserve this book.
                </p>
              )}

              {/* Librarian: Manage Copies */}
              {isLibrarian && (
                <button
                  onClick={() => setShowCopies((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-2"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  {showCopies ? 'Hide' : 'Manage'} Copies
                  {!copiesLoading && <span className="text-slate-400 font-normal">({copies.length} total)</span>}
                </button>
              )}
            </div>

            {/* ── Copies Table (Librarian) ─────────────────────── */}
            <AnimatePresence>
              {isLibrarian && showCopies && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 overflow-hidden"
                >
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {copiesLoading ? (
                      <div className="p-4 space-y-2">
                        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
                      </div>
                    ) : (
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Copy #</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Barcode</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-500 uppercase tracking-wider">Shelf</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {copies.map((c, idx) => {
                            const st = COPY_STATUS[c.status] ?? { label: c.status, color: 'text-slate-500' };
                            return (
                              <tr key={c._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-400">#{idx + 1}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{c.barcode ?? c._id.slice(-8)}</td>
                                <td className={cn('px-4 py-3 font-semibold', st.color)}>{st.label}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{c.shelfLocation ?? '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── REVIEWS SECTION ────────────────────────────────── */}
        <section className="mt-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
              Reader Reviews
            </h2>
            {isLoggedIn && (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<MessageSquare className="w-4 h-4" />}
                onClick={() => {
                  setReviewRating(0);
                  setReviewComment('');
                  setReviewModal(true);
                }}
              >
                Write Review
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Rating Distribution */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-6">
              <div className="text-center mb-6">
                <p className="font-display text-5xl font-bold text-slate-900 dark:text-slate-100">
                  {(book.rating ?? 0).toFixed(1)}
                </p>
                <StarRow value={book.rating ?? 0} size="md" />
                <p className="text-xs text-slate-400 mt-2">{reviews.length} reviews</p>
              </div>
              <div className="space-y-2">
                {ratingDist.map(({ star, count, pct }) => (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-4 tabular-nums text-slate-500 text-right">{star}</span>
                    <Star className="w-3 h-3 fill-amber-400 stroke-amber-400 shrink-0" />
                    <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: star * 0.05 }}
                        className="h-full rounded-full bg-amber-400"
                      />
                    </div>
                    <span className="w-6 tabular-nums text-slate-400 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reviews list */}
            <div className="lg:col-span-2 space-y-4">
              {reviewsLoading ? (
                [1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl w-full" />)
              ) : reviews.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <MessageSquare className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-500">No reviews yet</p>
                  <p className="text-xs text-slate-400 mt-1">Be the first to share your thoughts</p>
                </div>
              ) : (
                reviews.slice(0, 6).map((review, i) => {
                  const nameParts = review.user.name.split(' ');
                  const displayName = nameParts.length > 1
                    ? `${nameParts[0]} ${nameParts[nameParts.length - 1].charAt(0)}.`
                    : nameParts[0];
                  return (
                    <motion.div
                      key={review._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {nameParts[0].charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{displayName}</p>
                            <p className="text-[11px] text-slate-400">
                              {review.createdAt ? format(parseISO(review.createdAt), 'MMM d, yyyy') : ''}
                            </p>
                          </div>
                        </div>
                        <StarRow value={review.rating} size="sm" />
                      </div>
                      {review.comment && (
                        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                          {review.comment}
                        </p>
                      )}
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* ── SIMILAR BOOKS ──────────────────────────────────── */}
        {(similarLoading || similar.length > 0) && (
          <section className="mt-16">
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">
              Similar Books
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {similarLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden">
                      <Skeleton className="aspect-[3/4] w-full" />
                      <Skeleton className="h-4 w-3/4 rounded mt-2 mx-auto" />
                    </div>
                  ))
                : similar.map((sb, i) => {
                    const pal = getGradient(sb.title);
                    const authStr = Array.isArray(sb.authors) ? sb.authors[0] : sb.authors;
                    return (
                      <motion.div
                        key={sb._id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <Link href={`/search/${sb._id}`} className="group block">
                          <div
                            className="aspect-[3/4] rounded-xl overflow-hidden shadow-sm group-hover:shadow-md transition-all group-hover:-translate-y-1"
                            style={{ background: `linear-gradient(135deg, ${pal[0]}, ${pal[1]})` }}
                          >
                            {sb.coverImage ? (
                              <img src={sb.coverImage} alt={sb.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-6 h-6 text-white/60" />
                              </div>
                            )}
                          </div>
                          <p className="mt-2 text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {sb.title}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{authStr}</p>
                          {sb.rating && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                              <span className="text-[11px] text-amber-500 font-medium">{sb.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </Link>
                      </motion.div>
                    );
                  })}
            </div>
          </section>
        )}
      </div>

      {/* ── REVIEW MODAL ──────────────────────────────────────── */}
      <Modal
        open={reviewModal}
        onOpenChange={setReviewModal}
        title="Write a Review"
        description={`Share your thoughts about "${book.title}"`}
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setReviewModal(false)} disabled={submittingReview}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmitReview}
              isLoading={submittingReview}
              disabled={reviewRating === 0}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Submit Review
            </Button>
          </>
        }
      >
        <div className="space-y-5 text-sm">
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-2">Your Rating</label>
            <StarRow value={reviewRating} size="md" interactive onChange={setReviewRating} />
            {reviewRating > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewRating]}
              </p>
            )}
          </div>
          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-2">
              Comment <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={4}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              maxLength={1000}
              placeholder="What did you think about this book?"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none"
            />
            <p className="text-[11px] text-slate-400 text-right mt-1">{reviewComment.length}/1000</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
