'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ArrowRight,
  Sparkles,
  Search,
  CheckCircle2,
  Bookmark,
  RotateCcw,
  Clock,
  Layers,
  MapPin,
  ChevronRight,
  Shield,
  Star,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PublicFooter } from '@/components/layout/PublicFooter';

interface SpotlightBook {
  id: string;
  title: string;
  author: string;
  category: string;
  callNumber: string;
  shelf: string;
  availableCopies: number;
  totalCopies: number;
  rating: number;
  aiTakeaways: string[];
  summary: string;
}

const FEATURED_BOOKS: SpotlightBook[] = [
  {
    id: 'b-1',
    title: 'Designing Data-Intensive Applications',
    author: 'Martin Kleppmann',
    category: 'Computer Science',
    callNumber: 'QA76.9.D3 K54',
    shelf: 'Rack 4, Shelf B',
    availableCopies: 3,
    totalCopies: 4,
    rating: 4.9,
    summary: 'The definitive architectural guide to distributed data systems, reliability, scalability, and maintainability.',
    aiTakeaways: [
      'Contrasts batch vs. stream processing models in distributed architectures.',
      'Deconstructs consensus protocols including Paxos and Raft.',
      'Deep dive into replication lag, transaction isolation levels, and eventual consistency.'
    ],
  },
  {
    id: 'b-2',
    title: 'Dune: The Masterwork Edition',
    author: 'Frank Herbert',
    category: 'Literature & Sci-Fi',
    callNumber: 'PS3558.E63 D8',
    shelf: 'Rack 7, Shelf A',
    availableCopies: 2,
    totalCopies: 5,
    rating: 4.8,
    summary: 'An epic tale of politics, ecology, religion, and human endurance set upon the desert world of Arrakis.',
    aiTakeaways: [
      'Explores the ecological interdependence between desert biomes and giant sandworms.',
      'Critiques messianic hero figures and charismatic political leadership.',
      'Rich exploration of spice melange as a geopolitical resource analog.'
    ],
  },
  {
    id: 'b-3',
    title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
    author: 'Robert C. Martin',
    category: 'Software Engineering',
    callNumber: 'QA76.76.C54 M3',
    shelf: 'Rack 4, Shelf D',
    availableCopies: 1,
    totalCopies: 3,
    rating: 4.7,
    summary: 'A foundational handbook for writing robust, readable, and maintainable software with disciplined craftsmanship.',
    aiTakeaways: [
      'Emphasizes intention-revealing naming conventions and single-responsibility functions.',
      'Actionable heuristics for unit test coverage and meaningful refactoring.',
      'Techniques for eliminating side effects and defensive code clutter.'
    ],
  },
  {
    id: 'b-4',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    category: 'Psychology & Economics',
    callNumber: 'BF441 .K238',
    shelf: 'Rack 2, Shelf C',
    availableCopies: 4,
    totalCopies: 6,
    rating: 4.8,
    summary: 'Nobel laureate Daniel Kahneman explains the two cognitive systems that drive the way we think and decide.',
    aiTakeaways: [
      'Contrasts intuitive, emotional System 1 with deliberate, logical System 2.',
      'Explains anchoring effects, availability heuristics, and loss aversion.',
      'Examines overconfidence bias in professional forecasting and institutional planning.'
    ],
  },
];

const POPULAR_SEARCH_CHIPS = [
  'Data Systems',
  'Frank Herbert',
  'Artificial Intelligence',
  'Cognitive Psychology',
  'Software Architecture',
  'Astrophysics',
];

export default function HomePage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBook, setSelectedBook] = useState<SpotlightBook>(FEATURED_BOOKS[0]);
  const [activePersona, setActivePersona] = useState<'reader' | 'librarian'>('reader');

  return (
    <div className="min-h-screen bg-[var(--neo-bg)] text-[var(--neo-text)] flex flex-col transition-colors selection:bg-[var(--neo-accent)]/20">
      {/* ── Top Soft Navigation ──────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full bg-[var(--neo-card)]/90 backdrop-blur-md px-4 sm:px-8 h-16 flex items-center justify-between [box-shadow:var(--neo-raised-sm)] transition-colors">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-[var(--neo-r-sm)] overflow-hidden [box-shadow:var(--neo-raised-sm)] group-hover:scale-105 transition-transform shrink-0">
            <Image
              src="/nextgen_lms.webp"
              alt="NextGen LMS Logo"
              width={40}
              height={40}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div>
            <span className="font-display font-bold text-base text-[var(--neo-text)] tracking-tight block">
              NextGen LMS
            </span>
            <span className="text-[10px] font-semibold text-[var(--neo-text-3)] uppercase tracking-wider block">
              Community Circulation &amp; Catalog
            </span>
          </div>
        </Link>

        {/* Center Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[var(--neo-text-2)]">
          <Link href="/books" className="hover:text-[var(--neo-accent)] transition-colors">
            Catalog
          </Link>
          <a href="#spotlight" className="hover:text-[var(--neo-accent)] transition-colors">
            Featured Titles
          </a>
          <a href="#workflows" className="hover:text-[var(--neo-accent)] transition-colors">
            How It Works
          </a>
          <a href="#community" className="hover:text-[var(--neo-accent)] transition-colors">
            Community
          </a>
        </nav>

        {/* Right Action Pod */}
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Sign In
            </Button>
          </Link>
          <Link href="/books">
            <Button variant="primary" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
              Explore Catalog
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero Section (Soft Lighting, No Kickers, Live Functional Search) ────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 px-4 sm:px-8">
        {/* Soft, warm ambient light glow behind hero */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 45% at 50% 0%, rgba(79, 70, 229, 0.07), transparent 70%)',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-5xl text-center space-y-6">
          {/* Main Headline (No kicker stacked above) */}
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--neo-text)] leading-[1.12]">
            The intelligent library for effortless reading and discovery.
          </h1>

          {/* Subheading */}
          <p className="text-base sm:text-lg text-[var(--neo-text-2)] max-w-2xl mx-auto leading-relaxed font-normal">
            Search thousands of curated physical and digital titles, view intelligent AI chapter synopses, verify exact shelf call numbers, and manage loans in seconds.
          </p>

          {/* Functional Search Console (Debossed Well + Soft Highlight on Focus) */}
          <div className="pt-4 max-w-2xl mx-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (searchQuery.trim()) {
                  router.push(`/books?q=${encodeURIComponent(searchQuery.trim())}`);
                }
              }}
              className="neo-card p-2 sm:p-2.5 [box-shadow:var(--neo-raised-lg)] flex flex-col sm:flex-row items-center gap-2"
            >
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--neo-text-3)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by book title, author, topic, or ISBN..."
                  className="neo-input w-full pl-10 pr-4 py-2.5 text-sm"
                  aria-label="Search catalog titles or authors"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full sm:w-auto shrink-0"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Search Books
                </Button>
              </div>
            </form>

            {/* Quick Query Recommendation Chips */}
            <div className="pt-3 flex items-center justify-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-[var(--neo-text-3)] mr-1">Trending:</span>
              {POPULAR_SEARCH_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => {
                    setSearchQuery(chip);
                    router.push(`/books?q=${encodeURIComponent(chip)}`);
                  }}
                  className="px-2.5 py-1 rounded-[var(--neo-r-full)] text-xs font-medium text-[var(--neo-text-2)] bg-[var(--neo-surface)] hover:text-[var(--neo-accent)] hover:[box-shadow:var(--neo-raised-sm)] transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Live Library Vitals Ribbon ─────────────────────────────────── */}
      <section className="px-4 sm:px-8 -mt-4 mb-16">
        <div className="mx-auto max-w-5xl neo-card p-6 md:p-8 [box-shadow:var(--neo-raised)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 divide-y md:divide-y-0 md:divide-x divide-[var(--neo-shadow-dark)]/15">
            <div className="text-center pt-2 md:pt-0">
              <p className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--neo-text)] tabular-nums">
                14,280+
              </p>
              <p className="text-xs font-semibold text-[var(--neo-text-3)] mt-1 uppercase tracking-wider">
                Cataloged Volumes
              </p>
            </div>

            <div className="text-center pt-2 md:pt-0">
              <p className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--neo-text)] tabular-nums">
                4,890
              </p>
              <p className="text-xs font-semibold text-[var(--neo-text-3)] mt-1 uppercase tracking-wider">
                Active Readers
              </p>
            </div>

            <div className="text-center pt-2 md:pt-0">
              <p className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--neo-success)] tabular-nums">
                99.4%
              </p>
              <p className="text-xs font-semibold text-[var(--neo-text-3)] mt-1 uppercase tracking-wider">
                On-Time Returns
              </p>
            </div>

            <div className="text-center pt-2 md:pt-0">
              <p className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--neo-accent)] tabular-nums">
                Instant
              </p>
              <p className="text-xs font-semibold text-[var(--neo-text-3)] mt-1 uppercase tracking-wider">
                AI Book Insights
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Titles & Interactive AI Preview ───────────────────── */}
      <section id="spotlight" className="py-16 px-4 sm:px-8 bg-[var(--neo-surface)]/40 transition-colors">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="text-left space-y-2 max-w-2xl">
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-[var(--neo-text)] tracking-tight">
              Featured Titles on the Shelf Today
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              Real books available in circulation right now. Select any title to preview its AI chapter takeaways and physical shelf coordinates.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Book Selector List */}
            <div className="lg:col-span-5 space-y-3">
              {FEATURED_BOOKS.map((book) => {
                const isSelected = selectedBook.id === book.id;
                return (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className={`neo-card p-4 cursor-pointer transition-all ${
                      isSelected
                        ? 'border border-[var(--neo-accent)]/30 [box-shadow:var(--neo-raised-lg)] bg-[var(--neo-card)]'
                        : 'hover:[box-shadow:var(--neo-raised-sm)] opacity-85 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--neo-accent)]">
                          {book.category}
                        </span>
                        <h3 className="font-display text-base font-bold text-[var(--neo-text)] leading-snug mt-0.5">
                          {book.title}
                        </h3>
                        <p className="text-xs text-[var(--neo-text-2)] mt-0.5">{book.author}</p>
                      </div>

                      <div className="flex items-center gap-1 text-xs font-bold text-amber-500 shrink-0">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span className="tabular-nums">{book.rating}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-[var(--neo-text-3)] pt-2.5 border-t border-[var(--neo-shadow-dark)]/15">
                      <span className="flex items-center gap-1 font-medium">
                        <MapPin className="w-3 h-3 text-[var(--neo-accent)]" />
                        {book.shelf}
                      </span>
                      <span className="font-semibold text-[var(--neo-success)] tabular-nums">
                        {book.availableCopies} available
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right Column: Interactive AI Insights Console */}
            <div className="lg:col-span-7">
              <div className="neo-card p-6 sm:p-8 [box-shadow:var(--neo-raised-lg)] space-y-6">
                {/* Header Pod */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[var(--neo-shadow-dark)]/15">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-[var(--neo-r-full)] text-[10px] font-bold uppercase tracking-wider bg-[var(--neo-accent)]/10 text-[var(--neo-accent)]">
                      {selectedBook.category}
                    </span>
                    <h3 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--neo-text)]">
                      {selectedBook.title}
                    </h3>
                    <p className="text-sm font-medium text-[var(--neo-text-2)]">{selectedBook.author}</p>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1">
                    <span className="text-xs font-semibold text-[var(--neo-text-3)]">Classification</span>
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-[var(--neo-r-sm)] bg-[var(--neo-inset-bg)] text-[var(--neo-text)] tabular-nums">
                      {selectedBook.callNumber}
                    </span>
                  </div>
                </div>

                {/* Book Summary */}
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--neo-text-3)]">
                    Overview
                  </h4>
                  <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
                    {selectedBook.summary}
                  </p>
                </div>

                {/* AI Chapter Insights Box (Highlighted with soft border & ambient glow) */}
                <div className="p-5 rounded-[var(--neo-r-md)] bg-[var(--neo-surface)] border border-[var(--neo-accent)]/25 [box-shadow:var(--neo-raised-sm)] space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--neo-accent)]">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>AI Key Takeaways</span>
                  </div>
                  <ul className="space-y-2 text-xs text-[var(--neo-text-2)] leading-relaxed">
                    {selectedBook.aiTakeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--neo-accent)] shrink-0 mt-0.5" />
                        <span>{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Shelf Availability & Action Trigger */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-inset-bg)] flex items-center justify-center text-[var(--neo-accent)] shrink-0">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--neo-text)]">
                        Location: {selectedBook.shelf}
                      </p>
                      <p className="text-[11px] text-[var(--neo-text-3)]">
                        {selectedBook.availableCopies} of {selectedBook.totalCopies} copies ready on shelf
                      </p>
                    </div>
                  </div>

                  <Link href={`/books?q=${encodeURIComponent(selectedBook.title)}`} className="w-full sm:w-auto">
                    <Button variant="primary" size="md" className="w-full sm:w-auto" rightIcon={<ArrowRight className="w-4 h-4" />}>
                      Borrow Title
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Purpose-Built Workflows (Readers & Staff) ────────────────── */}
      <section id="workflows" className="py-20 px-4 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="font-display text-2xl sm:text-4xl font-extrabold text-[var(--neo-text)] tracking-tight">
              Engineered for curious readers and busy library teams
            </h2>
            <p className="text-sm sm:text-base text-[var(--neo-text-2)] leading-relaxed">
              A single unified circulation system that eliminates overdue stress for readers while automating high-volume workflows for library staff.
            </p>
          </div>

          {/* Persona Switcher Toggle */}
          <div className="flex justify-center">
            <div className="neo-inset-well-sm p-1.5 flex items-center gap-2 rounded-[var(--neo-r-full)]">
              <button
                type="button"
                onClick={() => setActivePersona('reader')}
                className={`px-5 py-2 rounded-[var(--neo-r-full)] text-xs font-bold transition-all ${
                  activePersona === 'reader'
                    ? 'bg-[var(--neo-card)] text-[var(--neo-accent)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-accent)]/20'
                    : 'text-[var(--neo-text-2)] hover:text-[var(--neo-text)]'
                }`}
              >
                For Community Patrons
              </button>
              <button
                type="button"
                onClick={() => setActivePersona('librarian')}
                className={`px-5 py-2 rounded-[var(--neo-r-full)] text-xs font-bold transition-all ${
                  activePersona === 'librarian'
                    ? 'bg-[var(--neo-card)] text-[var(--neo-accent)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-accent)]/20'
                    : 'text-[var(--neo-text-2)] hover:text-[var(--neo-text)]'
                }`}
              >
                For Librarians & Staff
              </button>
            </div>
          </div>

          {/* Workflow Showcase Details */}
          {activePersona === 'reader' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="neo-card p-6 [box-shadow:var(--neo-raised)] space-y-3">
                <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-[var(--neo-accent)] flex items-center justify-center [box-shadow:var(--neo-raised-sm)]">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--neo-text)]">
                  Instant AI Chapter Summaries
                </h3>
                <p className="text-xs text-[var(--neo-text-2)] leading-relaxed">
                  Decide what to read in seconds. Every catalog title features concise chapter summaries and reader level assessments.
                </p>
              </div>

              <div className="neo-card p-6 [box-shadow:var(--neo-raised)] space-y-3">
                <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-[var(--neo-success)] flex items-center justify-center [box-shadow:var(--neo-raised-sm)]">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--neo-text)]">
                  One-Click Online Renewals
                </h3>
                <p className="text-xs text-[var(--neo-text-2)] leading-relaxed">
                  Renew books directly from your phone or laptop with zero phone calls or visits to the circulation desk.
                </p>
              </div>

              <div className="neo-card p-6 [box-shadow:var(--neo-raised)] space-y-3">
                <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-[var(--neo-info)] flex items-center justify-center [box-shadow:var(--neo-raised-sm)]">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--neo-text)]">
                  Digital Member Barcode
                </h3>
                <p className="text-xs text-[var(--neo-text-2)] leading-relaxed">
                  No physical card needed. Your profile provides an instant high-resolution barcode ready for kiosk or desk checkout.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="neo-card p-6 [box-shadow:var(--neo-raised)] space-y-3">
                <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-[var(--neo-accent)] flex items-center justify-center [box-shadow:var(--neo-raised-sm)]">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--neo-text)]">
                  Sub-Second Checkouts
                </h3>
                <p className="text-xs text-[var(--neo-text-2)] leading-relaxed">
                  Two-panel circulation workbench with live barcode entry, book condition logging, and auto-printed return receipts.
                </p>
              </div>

              <div className="neo-card p-6 [box-shadow:var(--neo-raised)] space-y-3">
                <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-amber-500 flex items-center justify-center [box-shadow:var(--neo-raised-sm)]">
                  <Bookmark className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--neo-text)]">
                  Automated Reservation Queues
                </h3>
                <p className="text-xs text-[var(--neo-text-2)] leading-relaxed">
                  When a returned book is scanned, waitlisted patrons immediately receive SMS and email ready-for-pickup notifications.
                </p>
              </div>

              <div className="neo-card p-6 [box-shadow:var(--neo-raised)] space-y-3">
                <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-[var(--neo-success)] flex items-center justify-center [box-shadow:var(--neo-raised-sm)]">
                  <Shield className="w-5 h-5" />
                </div>
                <h3 className="font-display text-base font-bold text-[var(--neo-text)]">
                  AI Shelf & Spine Auditing
                </h3>
                <p className="text-xs text-[var(--neo-text-2)] leading-relaxed">
                  Capture a photo of library stacks; AI automatically extracts spine titles and flags misplaced books in real time.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Community Voice / Testimonial ─────────────────────────────── */}
      <section id="community" className="py-16 px-4 sm:px-8 bg-[var(--neo-surface)]/50 transition-colors">
        <div className="mx-auto max-w-4xl neo-card p-8 sm:p-12 [box-shadow:var(--neo-raised)] text-center space-y-6">
          <div className="flex justify-center text-amber-400 gap-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="w-4 h-4 fill-amber-400" />
            ))}
          </div>

          <blockquote className="font-display text-lg sm:text-2xl font-bold text-[var(--neo-text)] leading-relaxed max-w-2xl mx-auto">
            &ldquo;The AI chapter summaries save me hours of preliminary skimming, and seeing the exact physical rack location before visiting the branch makes finding research texts completely effortless.&rdquo;
          </blockquote>

          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="w-10 h-10 rounded-[var(--neo-r-full)] bg-[var(--neo-accent)] text-white font-bold text-sm flex items-center justify-center">
              ER
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-[var(--neo-text)]">Elena Rostova</p>
              <p className="text-xs text-[var(--neo-text-3)]">PhD Candidate & Branch Patron</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Commanding Call-to-Action ─────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-8 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(79, 70, 229, 0.06), transparent 60%)',
          }}
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-3xl space-y-6">
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold text-[var(--neo-text)] tracking-tight">
            Your next favorite book is waiting on the shelf.
          </h2>
          <p className="text-base text-[var(--neo-text-2)] max-w-xl mx-auto leading-relaxed">
            Join thousands of curious minds borrowing, reading, and learning every day. Browse the open catalog now or sign into your patron dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link href="/books">
              <Button variant="primary" size="lg" rightIcon={<ArrowRight className="w-4 h-4" />}>
                Browse the Catalog
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg">
                Member Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Public Dynamic Footer ────────────────────────────────────── */}
      <PublicFooter />
    </div>
  );
}
