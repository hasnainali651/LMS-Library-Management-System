'use client';

import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, usePathname } from 'next/navigation';
import { useTrackedRouter as useRouter } from '@/hooks/useTrackedRouter';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  X,
  Filter,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Eye,
  Star,
  Bookmark,
  BookMarked,
  Layers,
  Globe,
  Calendar,
  SortAsc,
  ArrowUpDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { BookItem } from '@/components/ui/BookCard';
import { QuickViewModal, QuickViewBook } from '@/components/ui/QuickViewModal';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SearchBook extends QuickViewBook {
  publishedYear?: number;
  rating?: number;
  reviewCount?: number;
  language?: string;
  categories?: string[];
  publisher?: string;
}

interface AutocompleteItem {
  _id: string;
  title: string;
  authors: string[] | string;
  coverImage?: string;
}

type SortOption = 'relevance' | 'newest' | 'rating' | 'mostBorrowed';

// ─── Cover gradient by title hash ─────────────────────────────────────────────
const PALETTES = [
  ['#1e3a5f', '#2563eb'], ['#1a3636', '#059669'], ['#3d1a5f', '#7c3aed'],
  ['#5f1a1a', '#dc2626'], ['#3d3100', '#d97706'], ['#0f3d4f', '#0891b2'],
  ['#1f1f3d', '#4f46e5'], ['#3d1f10', '#ea580c'], ['#0f2a1f', '#10b981'],
];
function getGradient(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

// ─── BookSearchCard ───────────────────────────────────────────────────────────
const BookSearchCard: React.FC<{
  book: SearchBook;
  index: number;
  onQuickView: (b: SearchBook) => void;
}> = ({ book, index, onQuickView }) => {
  const [imgErr, setImgErr] = useState(false);
  const palette = getGradient(book.title);
  const authorsStr = Array.isArray(book.authors) ? book.authors.slice(0, 2).join(', ') : book.authors;
  const isAvailable = (book.availableCopies ?? 0) > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-primary-500/40 transition-all duration-250"
    >
      {/* Cover */}
      <div
        className="relative aspect-[3/4] overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${palette[0]}, ${palette[1]})` }}
      >
        {book.coverImage && !imgErr ? (
          <Image
            src={book.coverImage}
            alt={book.title}
            fill
            sizes="(max-width:640px) 100vw, (max-width:1024px) 50vw, 25vw"
            priority={index < 4}
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 gap-2">
            <div className="w-14 h-18 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-white/70" />
            </div>
            <p className="text-white/60 text-[10px] font-medium text-center line-clamp-2 max-w-[110px]">{book.title}</p>
          </div>
        )}

        {/* Category chip */}
        {(book.category || (book.categories ?? [])[0]) && (
          <div className="absolute top-2.5 left-2.5">
            <span className="px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase rounded bg-black/60 backdrop-blur text-white border border-white/10">
              {book.category ?? (book.categories ?? [])[0]}
            </span>
          </div>
        )}

        {/* Availability chip */}
        <div className="absolute top-2.5 right-2.5">
          <span className={cn(
            'text-[9px] font-bold px-2 py-0.5 rounded-full border',
            isAvailable
              ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-200 border-rose-500/40'
          )}>
            {isAvailable ? `${book.availableCopies} avail.` : 'On hold'}
          </span>
        </div>

        {/* Quick View overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <button
            onClick={() => onQuickView(book)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-slate-900 text-xs font-semibold shadow-lg hover:bg-primary-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            Quick View
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <Link href={`/search/${book._id}`}>
          <h3 className="font-display font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug hover:text-primary-600 dark:hover:text-primary-400 transition-colors cursor-pointer">
            {book.title}
          </h3>
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
          {authorsStr}
        </p>

        {/* Rating + Year */}
        <div className="flex items-center justify-between mt-2">
          {(book.rating ?? 0) > 0 ? (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
              <span className="text-[11px] font-semibold text-amber-500 tabular-nums">
                {book.rating!.toFixed(1)}
              </span>
              {(book.reviewCount ?? 0) > 0 && (
                <span className="text-[10px] text-slate-400">({book.reviewCount})</span>
              )}
            </div>
          ) : <div />}
          {book.publishedYear && (
            <span className="text-[10px] text-slate-400 tabular-nums">{book.publishedYear}</span>
          )}
        </div>

        {/* Copies */}
        <div className="mt-2.5 text-[11px] text-slate-500 dark:text-slate-400">
          <span className={cn('font-bold', isAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500')}>
            {book.availableCopies ?? 0}
          </span>
          {' / '}{book.totalCopies ?? '—'} copies available
        </div>
      </div>
    </motion.div>
  );
};

// ─── Sidebar Checkbox ─────────────────────────────────────────────────────────
const CheckItem: React.FC<{ label: string; count?: number; checked: boolean; onChange: () => void }> = ({
  label, count, checked, onChange,
}) => (
  <label className="flex items-center gap-2.5 cursor-pointer py-1 group">
    <span className={cn(
      'w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors',
      checked
        ? 'bg-primary-600 border-primary-600'
        : 'border-slate-300 dark:border-slate-600 group-hover:border-primary-400'
    )}>
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </span>
    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
      {label}
    </span>
    {count !== undefined && (
      <span className="text-[10px] text-slate-400 tabular-nums">{count}</span>
    )}
  </label>
);

// ─── Pagination ───────────────────────────────────────────────────────────────
const Pagination: React.FC<{ page: number; totalPages: number; onChange: (p: number) => void }> = ({
  page, totalPages, onChange,
}) => {
  if (totalPages <= 1) return null;

  const pages: (number | '…')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 2 && i <= page + 2)) pages.push(i);
    else if (pages[pages.length - 1] !== '…') pages.push('…');
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-10">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      {pages.map((p, i) =>
        p === '…' ? (
          <span key={`ellipsis-${i}`} className="px-2 text-slate-400">…</span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p as number)}
            className={cn(
              'w-9 h-9 rounded-lg text-sm font-medium transition-colors',
              p === page
                ? 'bg-primary-700 text-white shadow-sm shadow-primary-700/30'
                : 'border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptySearchState: React.FC<{ query: string }> = ({ query }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-20 text-center px-6"
  >
    <div className="relative mb-8">
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-950/60 dark:to-primary-900/40 flex items-center justify-center">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="8" y="10" width="26" height="36" rx="3" className="fill-primary-200 dark:fill-primary-800" />
          <rect x="14" y="10" width="26" height="36" rx="3" className="fill-primary-300 dark:fill-primary-700" />
          <rect x="20" y="10" width="26" height="36" rx="3" className="fill-primary-400 dark:fill-primary-600" />
          <circle cx="40" cy="34" r="9" className="fill-white dark:fill-slate-900 stroke-primary-500" strokeWidth="2.5" />
          <path d="M47 41l4 4" className="stroke-primary-500" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M36 34h8M40 30v8" className="stroke-primary-400 dark:stroke-primary-500" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
    <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
      No books found for &apos;{query}&apos;
    </h3>
    <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6 text-sm">
      Try a broader search term, remove some filters, or explore our categories to discover what we have.
    </p>
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        href="/categories"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm shadow-primary-700/20"
      >
        <Layers className="w-4 h-4" />
        Browse by Category
      </Link>
    </div>
  </motion.div>
);

// ─── Mock categories for sidebar ──────────────────────────────────────────────
const MOCK_CATEGORIES = [
  'Computer Science', 'Fiction', 'Science', 'History', 'Mathematics',
  'Philosophy', 'Psychology', 'Economics', 'Engineering', 'Literature',
  'Business', 'Medicine', 'Law', 'Arts', 'Languages',
];
const MOCK_LANGUAGES = ['English', 'Urdu', 'Arabic', 'French', 'German'];
const SORTS: { value: SortOption; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'newest', label: 'Newest First' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'mostBorrowed', label: 'Most Borrowed' },
];

// ─── Impeccable: search page skill ref loaded ─────────────────────────────────
const BOOKS_PER_PAGE = 12;

// ─── Main Search Page (wrapped in Suspense for useSearchParams) ───────────────
function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { user } = useAuthStore();

  // URL-driven state
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    (searchParams.get('categories') ?? '').split(',').filter(Boolean)
  );
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    (searchParams.get('languages') ?? '').split(',').filter(Boolean)
  );
  const [yearFrom, setYearFrom] = useState(searchParams.get('yearFrom') ?? '');
  const [yearTo, setYearTo] = useState(searchParams.get('yearTo') ?? '');
  const [availableOnly, setAvailableOnly] = useState(searchParams.get('available') === '1');
  const [sort, setSort] = useState<SortOption>((searchParams.get('sort') as SortOption) ?? 'relevance');

  // Results
  const [books, setBooks] = useState<SearchBook[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>(MOCK_CATEGORIES);

  // Autocomplete
  const [acItems, setAcItems] = useState<AutocompleteItem[]>([]);
  const [acOpen, setAcOpen] = useState(false);
  const [acLoading, setAcLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sidebar mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Quick View
  const [quickViewBook, setQuickViewBook] = useState<SearchBook | null>(null);
  const [quickViewOpen, setQuickViewOpen] = useState(false);

  // ── URL sync ──────────────────────────────────────────────
  const buildParams = useCallback((overrides: Record<string, string | null> = {}) => {
    const p = new URLSearchParams();
    const q = overrides.q !== undefined ? overrides.q : query;
    if (q) p.set('q', q);
    const pg = overrides.page !== undefined ? overrides.page : String(page);
    if (pg && pg !== '1') p.set('page', pg);
    const cats = selectedCategories.join(',');
    if (cats) p.set('categories', cats);
    const langs = selectedLanguages.join(',');
    if (langs) p.set('languages', langs);
    if (yearFrom) p.set('yearFrom', yearFrom);
    if (yearTo) p.set('yearTo', yearTo);
    if (availableOnly) p.set('available', '1');
    if (sort !== 'relevance') p.set('sort', sort);
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === null) p.delete(k); else p.set(k, v);
    });
    return p.toString();
  }, [query, page, selectedCategories, selectedLanguages, yearFrom, yearTo, availableOnly, sort]);

  // ── Fetch books ───────────────────────────────────────────
  const fetchBooks = useCallback(async (q: string, pg: number, cats: string[], langs: string[], yFrom: string, yTo: string, avail: boolean, srt: SortOption) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(pg), limit: String(BOOKS_PER_PAGE) };
      if (q) params.q = q;
      if (cats.length) params.categories = cats.join(',');
      if (langs.length) params.language = langs.join(',');
      if (yFrom) params.yearFrom = yFrom;
      if (yTo) params.yearTo = yTo;
      if (avail) params.available = '1';
      if (srt !== 'relevance') params.sort = srt;

      const res = await api.get('/search/books', { params });
      const raw = res.data?.data || res.data;

      setBooks(
        (raw?.books ?? raw ?? []).map((b: any) => ({
          _id: b._id,
          title: b.title,
          authors: b.authors ?? [],
          coverImage: b.coverImage,
          isbn: b.isbn,
          category: b.category ?? b.categories?.[0],
          categories: b.categories,
          availableCopies: b.availableCopies ?? 0,
          totalCopies: b.totalCopies ?? 0,
          shelfLocation: b.shelfLocation,
          status: b.status,
          publishedYear: b.publishedYear,
          rating: b.rating,
          reviewCount: b.reviewCount,
          language: b.language,
          publisher: b.publisher,
          description: b.description ?? b.aiSummary,
        }))
      );
      setTotalResults(raw?.total ?? raw?.length ?? 0);
    } catch {
      // Use empty on error
      setBooks([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch categories ──────────────────────────────────────
  useEffect(() => {
    api.get('/search/categories').then((res) => {
      const raw = res.data?.data || res.data;
      if (Array.isArray(raw) && raw.length > 0) {
        setCategories(raw.map((c: any) => c.name ?? c._id ?? c));
      }
    }).catch(() => {});
  }, []);

  // ── Initial + param-driven search ────────────────────────
  useEffect(() => {
    fetchBooks(query, page, selectedCategories, selectedLanguages, yearFrom, yearTo, availableOnly, sort);
  }, [query, page, selectedCategories, selectedLanguages, yearFrom, yearTo, availableOnly, sort]);

  // ── Autocomplete ──────────────────────────────────────────
  const fetchAutocomplete = useCallback((val: string) => {
    if (!val.trim() || val.length < 2) { setAcItems([]); setAcOpen(false); return; }
    setAcLoading(true);
    api.get('/search/autocomplete', { params: { q: val, limit: 6 } })
      .then((res) => {
        const raw = res.data?.data || res.data;
        setAcItems(Array.isArray(raw) ? raw : []);
        setAcOpen(true);
      })
      .catch(() => setAcItems([]))
      .finally(() => setAcLoading(false));
  }, []);

  const handleInputChange = (val: string) => {
    setInputValue(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchAutocomplete(val), 300);
  };

  const commitSearch = (q: string) => {
    setQuery(q);
    setInputValue(q);
    setPage(1);
    setAcOpen(false);
    router.replace(`/search?${buildParams({ q, page: '1' })}`);
  };

  const handleFilterChange = (overrides: Record<string, unknown> = {}) => {
    setPage(1);
    // URL update for shareability
    const qs = buildParams({ page: '1' });
    router.replace(`/search?${qs}`, { scroll: false });
  };

  const clearFilters = () => {
    setSelectedCategories([]);
    setSelectedLanguages([]);
    setYearFrom('');
    setYearTo('');
    setAvailableOnly(false);
    setSort('relevance');
    setPage(1);
    router.replace(`/search?${query ? `q=${encodeURIComponent(query)}` : ''}`, { scroll: false });
  };

  const totalPages = Math.ceil(totalResults / BOOKS_PER_PAGE);
  const activeFilterCount =
    selectedCategories.length + selectedLanguages.length +
    (yearFrom ? 1 : 0) + (yearTo ? 1 : 0) +
    (availableOnly ? 1 : 0) +
    (sort !== 'relevance' ? 1 : 0);

  // ── Quick View + URL ?book= ────────────────────────────────
  const openQuickView = (b: SearchBook) => {
    setQuickViewBook(b);
    setQuickViewOpen(true);
    const qs = buildParams();
    router.replace(`/search?${qs}&book=${b._id}`, { scroll: false });
  };

  const closeQuickView = (open: boolean) => {
    if (!open) {
      setQuickViewOpen(false);
      const qs = buildParams();
      router.replace(`/search?${qs}`, { scroll: false });
    }
  };

  // Restore quick view from URL on mount
  useEffect(() => {
    const bookId = searchParams.get('book');
    if (bookId && books.length > 0) {
      const b = books.find((bk) => bk._id === bookId);
      if (b) { setQuickViewBook(b); setQuickViewOpen(true); }
    }
  }, [books]);

  // ── Sidebar content ────────────────────────────────────────
  const SidebarContent = () => (
    <div className="space-y-6 text-sm">
      {/* Sort */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ArrowUpDown className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">Sort By</h3>
        </div>
        <div className="space-y-1">
          {SORTS.map((s) => (
            <label key={s.value} className="flex items-center gap-2.5 cursor-pointer py-1 group">
              <span className={cn(
                'w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors',
                sort === s.value ? 'bg-primary-600 border-primary-600' : 'border-slate-300 dark:border-slate-600'
              )}>
                {sort === s.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              <span className="text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">
                {s.label}
              </span>
              <input type="radio" className="sr-only" checked={sort === s.value} onChange={() => { setSort(s.value); handleFilterChange(); }} />
            </label>
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800" />

      {/* Availability */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">Availability</h3>
        </div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-slate-700 dark:text-slate-300">Available now only</span>
          <button
            type="button"
            role="switch"
            aria-checked={availableOnly}
            onClick={() => { setAvailableOnly((v) => !v); handleFilterChange(); }}
            className={cn(
              'relative inline-flex h-5 w-9 rounded-full border-2 transition-colors duration-200',
              availableOnly ? 'bg-primary-600 border-primary-600' : 'bg-slate-200 dark:bg-slate-700 border-transparent'
            )}
          >
            <span className={cn(
              'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200',
              availableOnly ? 'translate-x-4' : 'translate-x-0'
            )} />
          </button>
        </label>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800" />

      {/* Category */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">Category</h3>
        </div>
        <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
          {categories.slice(0, 15).map((cat) => (
            <CheckItem
              key={cat}
              label={cat}
              checked={selectedCategories.includes(cat)}
              onChange={() => {
                setSelectedCategories((prev) =>
                  prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                );
                handleFilterChange();
              }}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800" />

      {/* Language */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">Language</h3>
        </div>
        <div className="space-y-0.5">
          {MOCK_LANGUAGES.map((lang) => (
            <CheckItem
              key={lang}
              label={lang}
              checked={selectedLanguages.includes(lang)}
              onChange={() => {
                setSelectedLanguages((prev) =>
                  prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
                );
                handleFilterChange();
              }}
            />
          ))}
        </div>
      </div>

      <div className="h-px bg-slate-100 dark:bg-slate-800" />

      {/* Year range */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="w-4 h-4 text-primary-600" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-xs uppercase tracking-wider">Publication Year</h3>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="From"
            value={yearFrom}
            min={1900}
            max={2026}
            onChange={(e) => { setYearFrom(e.target.value); handleFilterChange(); }}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
          <span className="text-slate-400 flex-shrink-0">–</span>
          <input
            type="number"
            placeholder="To"
            value={yearTo}
            min={1900}
            max={2026}
            onChange={(e) => { setYearTo(e.target.value); handleFilterChange(); }}
            className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-600"
          />
        </div>
      </div>

      {/* Clear */}
      {activeFilterCount > 0 && (
        <button
          onClick={clearFilters}
          className="w-full py-2 rounded-xl border border-rose-200 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
        >
          Clear all filters ({activeFilterCount})
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── HERO SEARCH ────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-primary-900 via-primary-800 to-slate-900 overflow-hidden">
        {/* Decorative blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute -bottom-20 right-10 w-96 h-96 rounded-full bg-accent-500/10 blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-16 text-center">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
            Search the Catalogue
          </h1>
          <p className="text-primary-200 mb-10 text-base">
            {totalResults > 0
              ? `Explore ${totalResults.toLocaleString()} results across our entire collection`
              : 'Browse 5,000+ books across every genre and discipline'}
          </p>

          {/* Search Input with Autocomplete */}
          <div className="relative max-w-2xl mx-auto">
            <div className="relative flex items-center rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-white/10 overflow-visible">
              <Search className="absolute left-5 w-5 h-5 text-slate-400 pointer-events-none z-10" />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitSearch(inputValue);
                  if (e.key === 'Escape') setAcOpen(false);
                }}
                onBlur={() => setTimeout(() => setAcOpen(false), 150)}
                onFocus={() => { if (acItems.length > 0) setAcOpen(true); }}
                placeholder="Search by title, author, ISBN..."
                className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 text-base pl-14 pr-16 py-4 focus:outline-none placeholder:text-slate-400"
                autoComplete="off"
              />
              {inputValue && (
                <button
                  onClick={() => { setInputValue(''); setQuery(''); setAcOpen(false); inputRef.current?.focus(); }}
                  className="absolute right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {acOpen && acItems.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 z-50 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
                >
                  {acItems.map((item, i) => (
                    <button
                      key={item._id}
                      onMouseDown={() => commitSearch(item.title)}
                      className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                    >
                      {item.coverImage ? (
                        <img src={item.coverImage} alt="" className="w-8 h-10 object-cover rounded shrink-0 shadow-sm" />
                      ) : (
                        <div className="w-8 h-10 rounded bg-primary-100 dark:bg-primary-950/60 flex items-center justify-center shrink-0">
                          <BookOpen className="w-3.5 h-3.5 text-primary-600" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{item.title}</p>
                        <p className="text-xs text-slate-400 truncate">
                          {Array.isArray(item.authors) ? item.authors.join(', ') : item.authors}
                        </p>
                      </div>
                      <Search className="w-3.5 h-3.5 text-slate-300 ml-auto shrink-0" />
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── BODY ───────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-sm">
              <SidebarContent />
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 gap-4">
              <div>
                {loading ? (
                  <Skeleton className="h-5 w-48 rounded" />
                ) : (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {query ? (
                      <>
                        Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{totalResults.toLocaleString()}</span> results for{' '}
                        <span className="font-semibold text-primary-600 dark:text-primary-400">&apos;{query}&apos;</span>
                      </>
                    ) : (
                      <><span className="font-semibold text-slate-900 dark:text-slate-100">{totalResults.toLocaleString()}</span> books in catalogue</>
                    )}
                  </p>
                )}
              </div>

              {/* Mobile filter button */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active filter chips */}
            {(selectedCategories.length > 0 || selectedLanguages.length > 0 || yearFrom || yearTo || availableOnly) && (
              <div className="flex flex-wrap gap-2 mb-5">
                {selectedCategories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedCategories((p) => p.filter((x) => x !== c))}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-400 text-xs font-medium hover:bg-primary-200 dark:hover:bg-primary-950 transition-colors"
                  >
                    {c} <X className="w-3 h-3 ml-0.5" />
                  </button>
                ))}
                {selectedLanguages.map((l) => (
                  <button
                    key={l}
                    onClick={() => setSelectedLanguages((p) => p.filter((x) => x !== l))}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 text-xs font-medium hover:bg-purple-200 transition-colors"
                  >
                    {l} <X className="w-3 h-3 ml-0.5" />
                  </button>
                ))}
                {availableOnly && (
                  <button
                    onClick={() => setAvailableOnly(false)}
                    className="flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-200 transition-colors"
                  >
                    Available only <X className="w-3 h-3 ml-0.5" />
                  </button>
                )}
              </div>
            )}

            {/* Results grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-4 gap-4">
                {Array.from({ length: BOOKS_PER_PAGE }).map((_, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                    <Skeleton className="aspect-[3/4] w-full" />
                    <div className="p-4 space-y-2">
                      <Skeleton className="h-4 w-full rounded" />
                      <Skeleton className="h-3 w-2/3 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : books.length === 0 ? (
              <EmptySearchState query={query} />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {books.map((book, i) => (
                  <BookSearchCard
                    key={book._id}
                    book={book}
                    index={i}
                    onQuickView={openQuickView}
                  />
                ))}
              </div>
            )}

            {/* Pagination */}
            <Pagination page={page} totalPages={totalPages} onChange={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-slate-900 shadow-2xl p-6 overflow-y-auto lg:hidden"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-slate-900 dark:text-slate-100">Filters</h2>
                <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quick View Modal */}
      <QuickViewModal
        book={quickViewBook}
        open={quickViewOpen}
        onOpenChange={closeQuickView}
        onWaitlist={(b) => { toast.success(`Added to waitlist for "${b.title}"`); closeQuickView(false); }}
        onBorrow={(b) => { toast.success(`Borrow request submitted for "${b.title}"`); closeQuickView(false); }}
        onViewDetail={(b) => router.push(`/search/${b._id}`)}
      />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
      </div>
    }>
      <SearchPageInner />
    </Suspense>
  );
}
