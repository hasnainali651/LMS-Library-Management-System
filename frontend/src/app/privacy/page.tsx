import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Lock, Eye, Database, KeyRound, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Patron privacy policy, data collection disclosures, cookie handling, and record confidentiality in NextGen LMS.',
  openGraph: {
    title: 'Privacy Policy | NextGen LMS',
    description: 'Understand how NextGen LMS protects patron identity, reading history, and digital library activity.',
    images: ['/nextgen_lms.webp'],
  },
};

export default function PrivacyPolicyPage() {
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
              <Lock className="w-6 h-6" />
              <span className="text-xs font-bold uppercase tracking-wider">Data Protection</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-extrabold text-[var(--neo-text)] tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-[var(--neo-text-3)] mt-2">
              Last updated: October 2026 • Governing patron circulation records, search queries, and digital sessions.
            </p>
          </div>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <Eye className="w-4 h-4 text-[var(--neo-accent)]" />
              1. Reading History Confidentiality
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              In accordance with American Library Association (ALA) and international intellectual freedom guidelines, patron reading histories are treated with strict confidentiality. Active loan transactions are linked to your profile only for circulation duration; once returned, borrowing links are decoupled and anonymized for aggregate circulation analytics.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--neo-accent)]" />
              2. Data We Collect & How It Is Used
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              We collect minimal patron details necessary to administer digital circulation:
            </p>
            <ul className="space-y-2 text-sm text-[var(--neo-text-2)] pl-5 list-disc">
              <li><strong>Contact Coordinates:</strong> Name, university/library email, and optional phone number for hold pickup SMS notices.</li>
              <li><strong>Circulation Events:</strong> Checkouts, due dates, renewal timestamps, and unpaid balance tallies.</li>
              <li><strong>Search Analytics:</strong> Anonymized catalog search terms to optimize collection purchases and inventory indexing.</li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[var(--neo-accent)]" />
              3. Cookies & Session Authentication
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              NextGen LMS utilizes secure, HTTP-only, SameSite session cookies exclusively for maintaining authenticated circulation sessions and protecting against Cross-Site Request Forgery (CSRF). We never deploy third-party advertising cookies or tracking beacons.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-lg font-bold text-[var(--neo-text)] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[var(--neo-accent)]" />
              4. Patron Data Rights
            </h2>
            <p className="text-sm text-[var(--neo-text-2)] leading-relaxed">
              Patrons may request a full export of their circulation profile or request account decommissioning directly through the circulation desk or patron profile settings.
            </p>
          </section>

          <div className="pt-6 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] flex items-center justify-between">
            <Link href="/terms">
              <Button variant="ghost" size="sm">
                View Terms of Service
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="primary" size="sm">
                Go to Patron Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
