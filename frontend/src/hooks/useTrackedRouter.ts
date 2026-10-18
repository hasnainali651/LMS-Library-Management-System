'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

export const NAVIGATION_START = 'lms:navigation-start';
export const NAVIGATION_CANCEL = 'lms:navigation-cancel';

export function startNavigation(href: string) {
  const target = new URL(href, window.location.href);
  if (
    target.origin !== window.location.origin ||
    (target.pathname === window.location.pathname && target.search === window.location.search)
  ) return;
  window.dispatchEvent(new Event(NAVIGATION_START));
}

export function useTrackedRouter() {
  const router = useRouter();

  return useMemo(() => ({
    ...router,
    push: (...args: Parameters<typeof router.push>) => {
      startNavigation(args[0]);
      try {
        router.push(...args);
      } catch (error) {
        window.dispatchEvent(new Event(NAVIGATION_CANCEL));
        throw error;
      }
    },
    replace: (...args: Parameters<typeof router.replace>) => {
      startNavigation(args[0]);
      try {
        router.replace(...args);
      } catch (error) {
        window.dispatchEvent(new Event(NAVIGATION_CANCEL));
        throw error;
      }
    },
  }), [router]);
}
