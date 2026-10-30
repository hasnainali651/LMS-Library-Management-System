'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Sparkles, BookOpen, ArrowLeft, Bookmark, Loader2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { BookCard, BookItem } from '@/components/ui/BookCard';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthStore } from '@/store/authStore';

export default function BooksPage() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBook, setSelectedBook] = useState<(BookItem & { description?: string }) | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [reservingId, setReservingId] = useState<string | null>(null);

  // 1. Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/search/categories');
      const raw = res.data?.data || res.data;
      if (!Array.isArray(raw)) return [];
      return raw.map((c: any) => c.name ?? c._id ?? String(c));
    },
    staleTime: 5 * 60 * 1000,
  });

  const categoryList = ['All', ...(categoriesData || ['Computer Science', 'Fiction', 'Science', 'History', 'Mathematics'])];

  // 2. Fetch Books Query
  const {
    data: booksData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['books', searchTerm, selectedCategory, page, pageSize],
    queryFn: async () => {
      const params: Record<string, string> = {
        page: String(page),
        limit: String(pageSize),
      };
      if (searchTerm.trim()) params.search = searchTerm.trim();
      if (selectedCategory !== 'All') params.category = selectedCategory;

      const res = await api.get('/books', { params });
      return res.data;
    },
  });

  const rawBooks = booksData?.data?.books ?? (Array.isArray(booksData?.data) ? booksData?.data : []);
  const totalBooks = booksData?.data?.total ?? booksData?.data?.totalDocs ?? rawBooks.length;
  const totalPages = booksData?.data?.totalPages ?? Math.max(1, Math.ceil(totalBooks / pageSize));

  const books: (BookItem & { description?: string })[] = rawBooks.map((b: any) => ({
    _id: b._id,
    title: b.title,
    authors: b.authors || [],
    isbn: b.isbn || '',
    category: b.category ?? b.categories?.[0] ?? 'General',
    totalCopies: b.totalCopies ?? 1,
    availableCopies: b.availableCopies ?? 0,
    shelfLocation: b.shelfLocation || 'Main Stack',
    status: (b.availableCopies ?? 0) > 0 ? 'available' : 'issued',
    description: b.description || '',
    aiSummary: b.aiSummary || '',
    coverImage: b.coverImage,
  }));

  // 3. Reserve Mutation
  const reserveMutation = useMutation({
    mutationFn: async (bookId: string) => {
      setReservingId(bookId);
      const res = await api.post('/reservations', { bookId });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Reservation hold placed! You will be notified when ready for pickup.');
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['books'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Could not place reservation. Please sign in or check your account.';
      toast.error(msg);
    },
    onSettled: () => {
      setReservingId(null);
    },
  });

  const handleReserve = (bookId: string) => {
    if (!isAuthenticated) {
      toast.error('Please log in to reserve titles.');
      return;
    }
    reserveMutation.mutate(bookId);
  };

  return (
    <div className="min-h-screen bg-[var(--neo-bg)] text-[var(--neo-text)] py-8 px-4 sm:px-6 lg:px-8 transition-colors">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[var(--neo-shadow-dark)]/25 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--neo-accent)] mb-1.5">
              <Link href="/" className="hover:underline flex items-center gap-1.5">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
              </Link>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--neo-text)]">
              Community Library Catalog
            </h1>
            <p className="text-xs sm:text-sm text-[var(--neo-text-2)] mt-1">
              Explore thousands of titles, view AI chapter insights, and check real-time branch availability.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <ThemeToggle />
            <Link href="/dashboard">
              <Button variant="secondary" size="md" leftIcon={<BookOpen className="w-4 h-4" />}>
                My Dashboard
              </Button>
            </Link>
          </div>
        </div>

        {/* Tactile Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search by book title, author name, or ISBN..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categoryList.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setPage(1);
                  }}
                  className={`px-3.5 py-2 rounded-[var(--neo-r-sm)] text-xs font-bold whitespace-nowrap transition-all select-none ${
                    isSelected
                      ? 'bg-[var(--neo-inset-bg)] text-[var(--neo-accent)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)]'
                      : 'bg-[var(--neo-card)] text-[var(--neo-text-2)] hover:text-[var(--neo-text)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-border-light)]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content States */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Catalog temporarily unavailable"
            message={(error as Error)?.message || 'Failed to load books from server.'}
            onRetry={() => refetch()}
          />
        ) : books.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No matching books found"
            description="Try modifying your keywords or removing category filters to see more catalog titles."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('All');
                }}
              >
                Clear Filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book, idx) => {
                const isAvail = (book.availableCopies ?? 0) > 0;
                const isThisReserving = reservingId === book._id;
                return (
                  <BookCard
                    key={book._id}
                    book={book}
                    index={idx}
                    onSelect={() => setSelectedBook(book)}
                    actionButtons={
                      <div className="flex items-center justify-between w-full gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBook(book)}
                          leftIcon={<Sparkles className="w-3.5 h-3.5 text-[var(--neo-accent)]" />}
                          className="text-xs"
                        >
                          AI Insights
                        </Button>

                        {isAvail ? (
                          <Link href={`/search/${book._id}`}>
                            <Button variant="primary" size="sm" className="text-xs">
                              View & Hold
                            </Button>
                          </Link>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            disabled={isThisReserving || reserveMutation.isPending}
                            onClick={() => handleReserve(book._id)}
                            leftIcon={
                              isThisReserving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Bookmark className="w-3.5 h-3.5" />
                              )
                            }
                            className="text-xs"
                          >
                            {isThisReserving ? 'Reserving...' : 'Waitlist Hold'}
                          </Button>
                        )}
                      </div>
                    }
                  />
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalItems={totalBooks}
                onPageChange={setPage}
                onPageSizeChange={(sz) => {
                  setPageSize(sz);
                  setPage(1);
                }}
              />
            )}
          </div>
        )}

        {/* Book Details & Gemini AI Summary Modal */}
        <Modal
          open={!!selectedBook}
          onOpenChange={(open) => !open && setSelectedBook(null)}
          title={selectedBook?.title}
          description={`by ${Array.isArray(selectedBook?.authors) ? selectedBook?.authors.join(', ') : selectedBook?.authors}`}
          footer={
            <div className="flex items-center justify-between w-full">
              <Link href={selectedBook ? `/search/${selectedBook._id}` : '#'}>
                <Button variant="primary" size="sm">
                  View Full Record
                </Button>
              </Link>
              <Button variant="secondary" size="sm" onClick={() => setSelectedBook(null)}>
                Close
              </Button>
            </div>
          }
        >
          {selectedBook && (
            <div className="space-y-4 text-sm text-[var(--neo-text)]">
              {/* Shelf Location & ISBN */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] border border-[var(--neo-border-light)] [box-shadow:var(--neo-flat)]">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--neo-text-3)] block tracking-wider">ISBN</span>
                  <strong className="font-mono text-xs">{selectedBook.isbn || 'N/A'}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[var(--neo-text-3)] block tracking-wider">Shelf / Rack</span>
                  <strong className="font-mono text-xs text-[var(--neo-accent)]">
                    {selectedBook.shelfLocation || 'Main Stack'}
                  </strong>
                </div>
              </div>

              {/* Gemini AI Summary Box */}
              {selectedBook.aiSummary && (
                <div className="p-4 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] border border-[var(--neo-accent)]/30 [box-shadow:var(--neo-raised-sm)] space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--neo-accent)]">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Synopsis</span>
                  </div>
                  <p className="text-xs text-[var(--neo-text-2)] leading-relaxed italic">
                    &ldquo;{selectedBook.aiSummary}&rdquo;
                  </p>
                </div>
              )}

              {/* Description */}
              {selectedBook.description && (
                <div>
                  <h5 className="font-bold text-xs uppercase tracking-wider text-[var(--neo-text-3)] mb-1">
                    Book Overview
                  </h5>
                  <p className="text-xs leading-relaxed text-[var(--neo-text-2)]">
                    {selectedBook.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
