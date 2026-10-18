'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Search, WifiOff } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { api } from '@/lib/api';
import { NAVIGATION_CANCEL, NAVIGATION_START, startNavigation, useTrackedRouter } from '@/hooks/useTrackedRouter';

interface SearchResult {
  _id: string;
  title: string;
  authors: string[];
}

function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const lastRoute = useRef(routeKey);
  const [progress, setProgress] = useState(0);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearTimers = useCallback(() => {
    clearInterval(interval.current);
    clearTimeout(deadline.current);
    clearTimeout(hideTimer.current);
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    setProgress(current => current > 0 ? 1 : 0);
    hideTimer.current = setTimeout(() => setProgress(0), 180);
  }, [clearTimers]);

  useEffect(() => {
    lastRoute.current = routeKey;
    finish();
  }, [routeKey, finish]);

  useEffect(() => {
    const start = () => {
      clearTimers();
      setProgress(0.15);
      interval.current = setInterval(() => setProgress(current => Math.min(0.9, current + (0.95 - current) * 0.15)), 300);
      // App Router has no cancellation event; never leave a cancelled navigation stuck.
      deadline.current = setTimeout(finish, 15000);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self') || anchor.rel.includes('external')) return;
      startNavigation(anchor.href);
    };
    const onPopState = () => {
      const nextRoute = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      if (lastRoute.current !== nextRoute) start();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener(NAVIGATION_START, start);
    window.addEventListener(NAVIGATION_CANCEL, finish);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener(NAVIGATION_START, start);
      window.removeEventListener(NAVIGATION_CANCEL, finish);
      clearTimers();
    };
  }, [clearTimers, finish]);

  return progress > 0 ? (
    <div className="global-navigation-progress fixed inset-x-0 top-0 h-[3px] origin-left bg-accent-600 print:hidden" style={{ transform: `scaleX(${progress})` }} role="progressbar" aria-label="Loading page" />
  ) : null;
}

export function GlobalExperience() {
  const router = useTrackedRouter();
  const pathname = usePathname();
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const queryText = query.trim();

  const changeOpen = useCallback((next: boolean) => {
    if (next) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    setOpen(next);
  }, []);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.altKey) {
        event.preventDefault();
        if (!event.repeat) changeOpen(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeOpen, open]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (open) inputRef.current?.focus();
      else if (returnFocus.current?.isConnected) returnFocus.current.focus();
    }, 0);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    setResults([]);
    if (!open || !queryText) {
      setStatus('idle');
      return;
    }
    if (offline) {
      setStatus('error');
      return;
    }
    let active = true;
    const controller = new AbortController();
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await api.get<{ data: SearchResult[] }>('/search/autocomplete', {
          params: { q: queryText },
          signal: controller.signal,
        });
        if (active) {
          setResults(response.data.data);
          setStatus('success');
        }
      } catch {
        if (active) setStatus('error');
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, queryText, attempt, offline]);

  return (
    <>
      <Suspense fallback={null}><NavigationProgress /></Suspense>
      {offline && (
        <div className="global-offline-banner fixed inset-x-0 top-0 flex h-10 items-center justify-center gap-2 bg-red-700 px-4 text-sm font-semibold text-white print:hidden" role="alert">
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          No internet connection
        </div>
      )}
      <button
        type="button"
        onClick={() => changeOpen(true)}
        aria-label="Search library (Ctrl+K or Command+K)"
        aria-keyshortcuts="Control+k Meta+k"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="global-search-trigger fixed bottom-24 cursor-pointer right-4 z-40 flex items-center rounded-full border border-[var(--neo-border-light)] bg-[var(--neo-card)] px-2.5 py-2.5 text-[var(--neo-accent)] [box-shadow:var(--neo-raised-lg)] hover:[box-shadow:var(--neo-raised)] active:[box-shadow:var(--neo-inset-sm)] active:translate-y-[1px] transition-all md:bottom-6 md:right-6 print:hidden"
      >
        <Search className="h-6 w-6" aria-hidden="true" />
      </button>
      <Modal open={open} onOpenChange={changeOpen} title="Search the library" description="Find a title or author. Press Enter for all results, or Tab to choose a book." maxWidth="lg" className="global-search-dialog max-h-[85dvh] overflow-y-auto print:hidden">
        <form onSubmit={event => {
          event.preventDefault();
          if (!queryText) return;
          changeOpen(false);
          router.push(`/search?q=${encodeURIComponent(queryText)}`);
        }}>
          <Input ref={inputRef} label="Title or author" type="search" autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search books…" className="placeholder:text-slate-500 dark:placeholder:text-slate-400" aria-controls="global-search-results" />
          <div id="global-search-results" className="mt-4" aria-busy={status === 'loading'}>
            <p role="status" aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">
              {!queryText ? 'Start typing to search the catalog.' : status === 'loading' ? 'Searching…' : status === 'success' ? results.length ? `${results.length} suggestions found.` : 'No results. Try another title or author.' : ''}
            </p>
            {status === 'error' && (
              <div className="space-y-3">
                <p role="alert" className="text-sm text-red-700 dark:text-red-300">{offline ? 'Search is unavailable while offline.' : 'Search could not load. Please try again.'}</p>
                <Button type="button" variant="secondary" size="sm" disabled={offline} onClick={() => setAttempt(value => value + 1)}>Retry search</Button>
              </div>
            )}
            {status === 'success' && results.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {results.map(book => (
                  <li key={book._id}>
                    <Link href={`/search/${encodeURIComponent(book._id)}`} onClick={(event: React.MouseEvent) => {
                      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) changeOpen(false);
                    }} className="block rounded-lg px-3 py-3 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600 dark:hover:bg-slate-800">
                      <span className="block break-words text-sm font-semibold text-slate-900 dark:text-slate-100">{book.title}</span>
                      {book.authors?.length > 0 && <span className="block break-words text-xs text-slate-600 dark:text-slate-300">{book.authors.join(', ')}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button type="submit" variant="primary" className="mt-4" disabled={!queryText}>View all results</Button>
        </form>
      </Modal>
    </>
  );
}
