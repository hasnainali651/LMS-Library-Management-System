'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';

interface PublicSettings {
  libraryName: string;
  address: string;
  hours: string;
  contact: string;
}

export function PublicFooter() {
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: async ({ signal }) => {
      const response = await api.get<{ data: PublicSettings }>('/settings/public', { signal });
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    throwOnError: false,
  });

  return (
    <footer className="bg-[var(--neo-card)] px-4 py-10 text-sm text-[var(--neo-text-2)] [box-shadow:var(--neo-raised-sm)] print:hidden transition-colors">
      <div className="mx-auto max-w-7xl">
        {isPending ? (
          <p role="status" className="text-xs text-[var(--neo-text-3)] font-medium">Loading library information…</p>
        ) : isError && !data ? (
          <div className="flex flex-wrap items-center gap-3">
            <p role="status" className="text-xs text-[var(--neo-text-3)]">Library information is temporarily unavailable.</p>
            <Button variant="secondary" size="sm" disabled={isFetching} onClick={() => void refetch()}>
              {isFetching ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : data ? (
          <>
            {data.libraryName && (
              <h2 className="mb-4 break-words font-display text-lg font-bold text-[var(--neo-text)]">
                {data.libraryName}
              </h2>
            )}
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {([
                ['Address & Location', data.address],
                ['Operating Hours', data.hours],
                ['Contact Desk', data.contact],
              ] as const).map(([label, value]) => value ? (
                <div key={label} className="p-4 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] [box-shadow:var(--neo-flat)]">
                  <dt className="mb-1 text-xs font-bold uppercase tracking-wider text-[var(--neo-text-3)]">{label}</dt>
                  <dd className="whitespace-pre-line break-words text-sm font-medium text-[var(--neo-text)] leading-relaxed">{value}</dd>
                </div>
              ) : null)}
            </dl>
          </>
        ) : (
          <p className="text-xs text-[var(--neo-text-3)] font-medium">NextGen Community Library & Digital Circulation Service.</p>
        )}

        {/* Legal & Policy Navigation Bar */}
        <div className="mt-8 pt-6 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--neo-text-3)]">
          <p>© {new Date().getFullYear()} NextGen LMS. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a
              href="/terms"
              className="hover:text-[var(--neo-accent)] transition-colors duration-300 font-medium"
            >
              Terms of Service
            </a>
            <span className="text-[var(--neo-border-dark)]">•</span>
            <a
              href="/privacy"
              className="hover:text-[var(--neo-accent)] transition-colors duration-300 font-medium"
            >
              Privacy Policy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
