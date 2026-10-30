'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTrackedRouter as useRouter } from '@/hooks/useTrackedRouter';
import {
  Bell,
  ChevronRight,
  User as UserIcon,
  LogOut,
  Settings,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { ROLE_LABELS, UserRole } from '@/lib/tokens';
import { NotificationDrawer } from './NotificationDrawer';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { cn } from '@/lib/utils';

export const TopNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicked outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute breadcrumbs from pathname
  const pathSegments = pathname.split('/').filter(Boolean);
  const breadcrumbs = pathSegments.map((segment, index) => {
    const href = '/' + pathSegments.slice(0, index + 1).join('/');
    const formatted = segment
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { label: formatted, href, isLast: index === pathSegments.length - 1 };
  });

  const handleLogout = async () => {
    setUserDropdownOpen(false);
    await logout();
    router.push('/login');
  };

  const role = (user?.role as UserRole) || 'student';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)]/95 px-4 md:px-8 backdrop-blur-md [box-shadow:var(--neo-raised-sm)] transition-colors">
      {/* Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[var(--neo-text-3)] font-medium">
        <Link
          href="/dashboard"
          className="hover:text-[var(--neo-text)] transition-colors"
        >
          Home
        </Link>
        {breadcrumbs.map((crumb) => (
          <React.Fragment key={crumb.href}>
            <ChevronRight className="w-3.5 h-3.5 text-[var(--neo-text-3)] shrink-0 opacity-70" />
            {crumb.isLast ? (
              <span className="font-semibold text-[var(--neo-text)] truncate max-w-[160px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="hover:text-[var(--neo-text)] transition-colors truncate max-w-[120px]"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right Controls Pod */}
      <div className="flex items-center gap-2.5">
        {/* Theme Toggle (Eye-comfort switcher) */}
        <ThemeToggle />

        {/* Notification Bell with Badge */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative p-2.5 cursor-pointer"
          aria-label={`View notifications (${unreadCount} unread)`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--neo-danger)] px-1 text-[10px] font-bold text-white shadow-sm ring-2 ring-[var(--neo-card)] tabular-nums">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* User Dropdown Pod */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setUserDropdownOpen((prev) => !prev)}
            aria-expanded={userDropdownOpen}
            className="cursor-pointer flex items-center gap-2.5 p-1.5 pr-3 rounded-[var(--neo-r-sm)]"
          >
            {user?.avatar ? (
              <Image
                src={user.avatar}
                alt={user.name || 'User avatar'}
                width={32}
                height={32}
                className="w-8 h-8 rounded-full object-cover shadow-sm ring-1 ring-[var(--neo-border-light)] dark:ring-[var(--neo-border-dark)]"
                unoptimized
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[var(--neo-accent)] text-white font-bold text-xs flex items-center justify-center shadow-sm">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-bold text-[var(--neo-text)] line-clamp-1 max-w-[120px]">
                {user?.name || 'Patron'}
              </span>
              <span className="text-[10px] font-semibold text-[var(--neo-text-3)] uppercase tracking-wider">
                {ROLE_LABELS[role] || 'Member'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--neo-text-3)] hidden md:block" />
          </button>

          {/* Tactile Menu Dropdown */}
          {userDropdownOpen && (
            <div className="neo-card absolute right-0 mt-2 w-56 p-1.5 rounded-[var(--neo-r-md)] [box-shadow:var(--neo-raised-lg)] z-50 animate-fade-in space-y-1">
              <div className="px-3 py-2 border-b border-[var(--neo-shadow-dark)]/15 mb-1">
                <p className="text-xs font-bold text-[var(--neo-text)] truncate">
                  {user?.name || 'Signed in'}
                </p>
                <p className="text-[11px] text-[var(--neo-text-3)] truncate">
                  {user?.email || 'patron@library.com'}
                </p>
              </div>

              <Link
                href="/dashboard/profile"
                onClick={() => setUserDropdownOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)] rounded-[var(--neo-r-sm)] transition-colors"
              >
                <UserIcon className="w-3.5 h-3.5 text-[var(--neo-accent)]" />
                Profile & ID Card
              </Link>

              {role === 'admin' && (
                <Link
                  href="/dashboard/settings"
                  onClick={() => setUserDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)] rounded-[var(--neo-r-sm)] transition-colors"
                >
                  <Settings className="w-3.5 h-3.5 text-[var(--neo-text-3)]" />
                  Branch Settings
                </Link>
              )}

              <div className="pt-1 border-t border-[var(--neo-shadow-dark)]/25">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-[var(--neo-danger)] hover:bg-[var(--neo-danger-surface)] rounded-[var(--neo-r-sm)] transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onUnreadCountChange={setUnreadCount}
      />
    </header>
  );
};
