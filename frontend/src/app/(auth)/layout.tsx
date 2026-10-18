'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 md:p-8 bg-[var(--neo-bg)] text-[var(--neo-text)] relative select-none transition-colors">
      {/* Brand Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 mb-6 text-center"
      >
        <Link
          href="/"
          className="inline-flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)] rounded-[var(--neo-r-md)] p-2 transition-transform hover:scale-105"
        >
          <div className="w-12 h-12 overflow-hidden shrink-0">
            <Image
              src="/nextgen_lms.webp"
              alt="NextGen LMS Logo"
              width={48}
              height={48}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <div className="text-left">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[var(--neo-text)]">
              NextGen LMS
            </h1>
            <p className="text-[10px] font-bold text-[var(--neo-text-3)] uppercase tracking-widest">
              Digital Patron & Staff Portal
            </p>
          </div>
        </Link>
      </motion.div>

      {/* Tactile Neumorphic Auth Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md sm:max-w-lg"
      >
        <div className="neo-card p-6 sm:p-9 rounded-[var(--neo-r-xl)] [box-shadow:var(--neo-raised-lg)] border border-[var(--neo-border-light)] text-[var(--neo-text)]">
          {children}
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="relative z-10 mt-6 text-center text-xs text-[var(--neo-text-3)] font-medium"
      >
        &copy; {new Date().getFullYear()} NextGen LMS Community Library Services.
      </motion.div>
    </div>
  );
}
