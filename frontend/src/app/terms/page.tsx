import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Shield, BookCheck, FileText, Scale } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Legal terms, patron borrowing guidelines, renewal policies, and circulation terms for NextGen LMS.',
  openGraph: {
    title: 'Terms of Service | NextGen LMS',
    description: 'Legal terms and circulation policies governing the NextGen Library Management System.',
    images: ['/nextgen_lms.webp'],
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[var(--neo-bg)] text-[var(--neo-text)] flex flex-col transition-colors selection:bg-[var(--neo-accent)]/20">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[var(--neo-card)]/90 backdrop-blur-md px-4 sm:px-8 h-16 flex items-center justify-between [box-shadow:var(--neo-raised-sm)] transition-colors">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--neo-text-2)] hover:text-[var(--neo-accent)] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Library Home</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="font-display font-bold text-base text-[var(--neo-text)] tracking-tight">
            NextGen LMS
          </span>
          <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-8 py-12">
        <div className="neo-card p-6 sm:p-10 [box-shadow:var(--neo-raised)] space-y-8">
          <div className="border-b border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] pb-6">
            <div className="flex items-center gap-3 text-[var(--neo-accent)] mb-2">
              <Scale className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-wider">Patron Agreement</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-[var(--neo-text)] tracking-tight">
              Terms of Service
            </h1>
            <p className="text-xs text-[var(--neo-text-3)] mt-2">
              Last updated: October 2026 • Effective for all community members, faculty, and circulating patrons.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <BookCheck className="w-4 h-4 text-[var(--neo-accent)]" />
              1. Library Membership & Borrowing Privileges
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              Membership to NextGen LMS is granted to verified students, faculty, and registered community members. Borrowing privileges are contingent upon maintaining account standing in good order. Borrowers are strictly responsible for all materials checked out under their credentials until an authorized check-in receipt is issued.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[var(--neo-accent)]" />
              2. Circulation Periods & Renewals
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              Standard book loan periods are 14 calendar days. Eligible titles may be renewed online up to two (2) consecutive times, provided no other patron has placed an active hold on the title. Overdue items or materials flagged with reserved waitlists cannot be renewed.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[var(--neo-accent)]" />
              3. Overdue Fines & Lost Book Replacement
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              Daily overdue fines are calculated automatically at midnight based on policy rates. If a title is overdue beyond 30 days without notification, the volume is classified as lost, and replacement processing costs equal to the publisher list price will be applied to the patron account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <Scale className="w-4 h-4 text-[var(--neo-accent)]" />
              4. Code of Conduct & System Usage
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              Patrons agree not to misuse digital reservation tools, automated scrapers, or excessive API requests against catalog endpoints. Any attempt to bypass circulation holds or tamper with barcode tracking triggers account suspension.
            </p>
          </section>

          <div className="pt-6 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] flex items-center justify-between">
            <Link href="/privacy">
              <Button variant="ghost" size="sm">
                View Privacy Policy
              </Button>
            </Link>
            <Link href="/books">
              <Button variant="primary" size="sm">
                Explore Catalog
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
