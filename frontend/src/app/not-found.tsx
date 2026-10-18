import Link from 'next/link';
import { ArrowRight, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <section aria-labelledby="not-found-title" className="w-full max-w-lg text-center">
        <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-6 h-24 w-28 text-primary-700 dark:text-primary-300" aria-hidden="true">
          <path d="M60 39C47 30 30 28 12 31v51c18-3 35-1 48 8 13-9 30-11 48-8V31c-8-1-15-1-22 0M60 39v51" />
          <path d="M24 46c9-1 17 1 24 5M24 59c9-1 17 1 24 5M73 61c8-3 15-4 23-3M73 73c8-3 15-4 23-3" />
          <circle cx="77" cy="23" r="19" className="fill-slate-50 dark:fill-slate-950" />
          <path d="M71 18a6 6 0 0 1 12 0c0 4-6 4-6 8M77 32h.01" />
        </svg>
        <p className="mb-2 text-sm font-semibold text-primary-700 dark:text-primary-300">Error 404</p>
        <h1 id="not-found-title" className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          This page isn’t on the shelf
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          The page may have moved, or the link may be incorrect. Search the catalog to find your next read.
        </p>
        <form action="/search" method="get" role="search" className="mt-8 text-left">
          <label htmlFor="not-found-search" className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Search the library</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input id="not-found-search" name="q" type="search" placeholder="Title, author, or ISBN" className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400" />
            <button type="submit" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800 active:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950">
              <Search className="h-4 w-4" aria-hidden="true" />
              Search
            </button>
          </div>
        </form>
        <Link href="/dashboard" className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-primary-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300">
          Go to dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
