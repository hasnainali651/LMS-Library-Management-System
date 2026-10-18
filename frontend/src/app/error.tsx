'use client';

import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { reset: resetQueries } = useQueryErrorResetBoundary();

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-slate-50 px-4 py-16 dark:bg-slate-950">
      <section aria-labelledby="error-title" className="w-full max-w-lg text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
          <AlertTriangle className="h-8 w-8" aria-hidden="true" />
        </div>
        <h1 id="error-title" className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Something went wrong
        </h1>
        <p className="mt-4 text-base leading-relaxed text-slate-600 dark:text-slate-300">
          We couldn’t load this page. Try again, or head home to keep exploring the library.
        </p>
        {process.env.NODE_ENV === 'development' && (
          <pre className="mt-6 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white p-4 text-left text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            {error.message}
          </pre>
        )}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={() => { resetQueries(); reset(); }} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
            Try again
          </Button>
          <Link href="/" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-950">
            <Home className="h-4 w-4" aria-hidden="true" />
            Go home
          </Link>
        </div>
      </section>
    </main>
  );
}
