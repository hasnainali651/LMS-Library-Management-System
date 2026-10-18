'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import {
  Home,
  Search,
  BookOpen,
  Bookmark,
  Receipt,
  User,
  LayoutDashboard,
  ArrowLeftRight,
  Library,
  Users,
  AlertTriangle,
  BarChart3,
  Settings,
  ShieldCheck,
  BookMarked,
  UserCog,
  Camera,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS, UserRole } from '@/lib/tokens';
import { cn } from '@/lib/utils';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const role: UserRole = (user?.role as UserRole) || 'student';

  // Role-based Navigation Links
  const studentNav: NavItem[] = [
    { label: 'Home', href: '/dashboard', icon: Home },
    { label: 'Search', href: '/books', icon: Search },
    { label: 'My Books', href: '/dashboard/my-books', icon: BookOpen },
    { label: 'Reservations', href: '/dashboard/reservations', icon: Bookmark },
    { label: 'Fines', href: '/dashboard/fines', icon: Receipt },
    { label: 'Loan History', href: '/dashboard/history', icon: BookMarked },
    { label: 'Profile', href: '/dashboard/profile', icon: User },
  ];

  const librarianNav: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Circulation', href: '/dashboard/circulation', icon: ArrowLeftRight },
    { label: 'Books', href: '/dashboard/books', icon: Library },
    { label: 'Members', href: '/dashboard/members', icon: Users },
    { label: 'Reservations', href: '/dashboard/reservations', icon: Bookmark },
    { label: 'Shelf Audit', href: '/dashboard/shelf-audit', icon: Camera },
    { label: 'Overdue', href: '/dashboard/overdue', icon: AlertTriangle },
  ];

  const adminNav: NavItem[] = [
    ...librarianNav,
    { label: 'Fines', href: '/dashboard/fines', icon: Receipt },
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Staff', href: '/dashboard/users', icon: UserCog },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
    { label: 'Audit Log', href: '/dashboard/audit-log', icon: ShieldCheck },
  ];

  const navItems = role === 'admin' ? adminNav : role === 'librarian' ? librarianNav : studentNav;

  const isLinkActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Desktop Sidebar Rail */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-[var(--neo-card)] [box-shadow:var(--neo-raised-sm)] min-h-screen sticky top-0 h-screen select-none z-20 transition-colors">
        {/* Brand Header */}
        <div className="p-6 border-b border-[var(--neo-shadow-dark)]/15 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-10 h-10 overflow-hidden shrink-0">
              <Image src="/nextgen_lms.webp" alt="NextGen LMS" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            <div>
              <span className="font-display font-bold text-base text-[var(--neo-text)] tracking-tight block">
                NextGen LMS
              </span>
              <span className="text-[10px] font-bold text-[var(--neo-text-3)] uppercase tracking-wider block">
                {ROLE_LABELS[role] || 'Library Portal'}
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-5 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-[var(--neo-text-3)]">
            Circulation Menu
          </div>

          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isLinkActive(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-[var(--neo-r-sm)] text-xs font-semibold transition-all duration-150',
                  active
                    ? 'bg-[var(--neo-inset-bg)] text-[var(--neo-accent)] [box-shadow:var(--neo-inset-sm)]'
                    : 'text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)]/70'
                )}
              >
                <Icon
                  className={cn(
                    'w-4 h-4 shrink-0 transition-colors',
                    active ? 'text-[var(--neo-accent)]' : 'text-[var(--neo-text-3)]'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--neo-card)]/95 backdrop-blur-lg border-t border-[var(--neo-border-light)] [box-shadow:var(--neo-raised-lg)] px-2 py-1.5 flex items-center justify-around">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isLinkActive(item.href);

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-[var(--neo-r-sm)] text-[10px] font-semibold transition-all',
                active
                  ? 'text-[var(--neo-accent)] bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)]'
                  : 'text-[var(--neo-text-3)] hover:text-[var(--neo-text)]'
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate max-w-[50px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
};
