'use client';

import React from 'react';
import axios from 'axios';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { BookOpen, Home, RotateCcw, ServerCrash, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';

type ErrorKind = 'network' | 'server' | 'notFound';

function classifyError(error: unknown): ErrorKind {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 404) return 'notFound';
    if (!error.response) return 'network';
  }
  return 'server';
}

const errorContent = {
  network: {
    title: 'Unable to connect',
    description: 'Check your internet connection, then try again. Your library will be here when you’re back online.',
    icon: WifiOff,
  },
  server: {
    title: 'Something went wrong',
    description: 'We couldn’t load the library data. Please try again in a moment.',
    icon: ServerCrash,
  },
  notFound: {
    title: 'We couldn’t find that item',
    description: 'It may have been removed or the link may be out of date. Return to your dashboard or explore the library from home.',
    icon: BookOpen,
  },
};

interface BoundaryProps {
  children: React.ReactNode;
  pathname: string | null;
  onReset: () => void;
}

interface BoundaryState {
  hasError: boolean;
  error: unknown;
}

class QueryBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    return { hasError: true, error };
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (previousProps.pathname !== this.props.pathname && this.state.hasError) {
      this.reset();
    }
  }

  reset = () => {
    this.props.onReset();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const kind = classifyError(this.state.error);
    const { title, description, icon: Icon } = errorContent[kind];
    const linkClassName = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300 dark:hover:bg-primary-900/30';

    return (
      <section aria-labelledby="query-error-title" className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
        <div className="w-full max-w-lg text-center" role="alert">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
            <Icon className="h-8 w-8" aria-hidden="true" />
          </div>
          <h1 id="query-error-title" className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
          <p className="mt-4 leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={this.reset} leftIcon={<RotateCcw className="h-4 w-4" aria-hidden="true" />}>
              Try again
            </Button>
            <Link href="/dashboard" className={linkClassName}>Go to dashboard</Link>
            <Link href="/" className={linkClassName}>
              <Home className="h-4 w-4" aria-hidden="true" /> Go home
            </Link>
          </div>
        </div>
      </section>
    );
  }
}

export function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <QueryErrorResetBoundary>
      {({ reset }: { reset: () => void }) => (
        <QueryBoundary pathname={pathname} onReset={reset}>
          {children}
        </QueryBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
