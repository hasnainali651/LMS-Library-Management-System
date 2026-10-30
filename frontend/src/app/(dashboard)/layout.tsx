'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopNav } from '@/components/layout/TopNav';
import { VerificationBanner } from '@/components/layout/VerificationBanner';
import { useSocketEvents } from '@/hooks/useSocketEvents';

function DashboardSocketListener() {
  useSocketEvents();
  return null;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--neo-bg)] text-[var(--neo-text)] transition-colors">
      <DashboardSocketListener />
      {/* Sidebar: Desktop vertical fixed rail + Mobile bottom fixed nav */}
      <Sidebar />

      {/* Main Circulation Console Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8 md:pl-64">
        <TopNav />
        <VerificationBanner />
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
