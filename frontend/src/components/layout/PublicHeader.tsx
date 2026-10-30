"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";

export function PublicHeader() {
  const router = useRouter();
  const { user, isAuthenticated, accessToken, logout } = useAuthStore();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const loggedIn = Boolean(user && (isAuthenticated || accessToken));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-[var(--neo-card)]/90 px-4 backdrop-blur-md [box-shadow:var(--neo-raised-sm)] transition-colors sm:px-8">
      <Link
        href="/"
        className="group flex items-center gap-2.5"
        aria-label="NextGen LMS home"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[var(--neo-r-sm)] [box-shadow:var(--neo-raised-sm)] transition-transform group-hover:scale-105">
          <Image
            src="/nextgen_lms.webp"
            alt="NextGen LMS Logo"
            width={40}
            height={40}
            className="h-full w-full object-cover"
            priority
          />
        </div>
        <div className="hidden sm:block">
          <span className="block font-display text-base font-bold tracking-tight text-[var(--neo-text)]">
            NextGen LMS
          </span>
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-[var(--neo-text-3)]">
            Community Circulation &amp; Catalog
          </span>
        </div>
      </Link>

      <div className="flex items-center gap-2 sm:gap-2.5">
        <ThemeToggle />

        {loggedIn && user ? (
          <>
            <Link href="/dashboard" className="hidden sm:block">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<LayoutDashboard className="h-3.5 w-3.5" />}
              >
                Dashboard
              </Button>
            </Link>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="flex cursor-pointer items-center gap-1.5 rounded-[var(--neo-r-sm)] p-1 pr-1 sm:gap-2 sm:pr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)]"
                aria-label={`Open account menu for ${user.name}`}
              >
                {user.avatar ? (
                  <Image
                    src={user.avatar}
                    alt={`${user.name} avatar`}
                    width={36}
                    height={36}
                    unoptimized
                    className="h-9 w-9 rounded-full object-cover ring-1 ring-[var(--neo-border-light)] dark:ring-[var(--neo-border-dark)]"
                  />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--neo-accent)] text-sm font-bold text-white">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </span>
                )}
                <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--neo-text-3)] sm:block" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="neo-card absolute right-0 mt-2 w-56 rounded-[var(--neo-r-md)] p-1.5 [box-shadow:var(--neo-raised-lg)]"
                >
                  <Link
                    href="/dashboard"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-[var(--neo-r-sm)] px-3 py-2 text-xs font-semibold text-[var(--neo-text)] hover:bg-[var(--neo-surface)]"
                  >
                    <LayoutDashboard className="h-3.5 w-3.5 text-[var(--neo-accent)]" />
                    Dashboard
                  </Link>
                  <Link
                    href="/dashboard/profile"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-[var(--neo-r-sm)] px-3 py-2 text-xs font-medium text-[var(--neo-text-2)] hover:bg-[var(--neo-surface)]"
                  >
                    <UserIcon className="h-3.5 w-3.5 text-[var(--neo-text-3)]" />
                    Profile
                  </Link>
                  <div className="mt-1 border-t border-[var(--neo-shadow-dark)]/25 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-2.5 rounded-[var(--neo-r-sm)] px-3 py-2 text-left text-xs font-medium text-[var(--neo-danger)] hover:bg-[var(--neo-danger-surface)]"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/books">
              <Button
                variant="primary"
                size="sm"
                rightIcon={<ArrowRight className="h-3.5 w-3.5" />}
                className="hidden md:inline-flex"
              >
                Explore Catalog
              </Button>
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
