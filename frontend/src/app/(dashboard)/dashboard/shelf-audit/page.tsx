'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/Skeleton';

const ShelfAuditPage = dynamic(
  () => import('@/components/ShelfAuditPage').then((mod) => mod.ShelfAuditPage),
  {
    loading: () => (
      <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-pulse">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
          <div className="lg:col-span-5 space-y-4">
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
          <div className="lg:col-span-7 space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function ShelfAuditRoute() {
  return <ShelfAuditPage />;
}
