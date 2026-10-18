'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTrackedRouter as useRouter } from '@/hooks/useTrackedRouter';
import {
  Monitor,
  BookOpen,
  Beaker,
  History,
  Calculator,
  Brain,
  Globe,
  DollarSign,
  Cpu,
  Landmark,
  BookMarked,
  Palette,
  Music,
  Heart,
  Scale,
  Leaf,
  Star,
  Layers,
  Search,
  ArrowRight,
  ScrollText,
  FlaskConical,
  Languages,
  BarChart2,
  Drama,
  Coffee,
  Atom,
  Map,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { ErrorState } from '@/components/ui/ErrorState';

// ─── Category definition ──────────────────────────────────────────────────────
interface CategoryTile {
  name: string;
  icon: React.ReactNode;
  gradient: string;
  textColor: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Computer Science': <Monitor className="w-7 h-7" />,
  'Fiction': <BookOpen className="w-7 h-7" />,
  'Science': <Beaker className="w-7 h-7" />,
  'History': <History className="w-7 h-7" />,
  'Mathematics': <Calculator className="w-7 h-7" />,
  'Psychology': <Brain className="w-7 h-7" />,
  'Geography': <Globe className="w-7 h-7" />,
  'Economics': <DollarSign className="w-7 h-7" />,
  'Engineering': <Cpu className="w-7 h-7" />,
  'Philosophy': <ScrollText className="w-7 h-7" />,
  'Literature': <BookMarked className="w-7 h-7" />,
  'Arts': <Palette className="w-7 h-7" />,
  'Music': <Music className="w-7 h-7" />,
  'Medicine': <Heart className="w-7 h-7" />,
  'Law': <Scale className="w-7 h-7" />,
  'Biology': <Leaf className="w-7 h-7" />,
  'Physics': <Atom className="w-7 h-7" />,
  'Chemistry': <FlaskConical className="w-7 h-7" />,
  'Languages': <Languages className="w-7 h-7" />,
  'Business': <BarChart2 className="w-7 h-7" />,
  'Drama': <Drama className="w-7 h-7" />,
  'Astronomy': <Star className="w-7 h-7" />,
  'Travel': <Map className="w-7 h-7" />,
  'Sociology': <Landmark className="w-7 h-7" />,
  'Religion': <Star className="w-7 h-7" />,
  'Self-Help': <Coffee className="w-7 h-7" />,
};

const CATEGORY_GRADIENTS: Record<string, [string, string, string]> = {
  'Computer Science': ['from-blue-600 to-indigo-700', 'text-blue-100', 'bg-blue-900/30'],
  'Fiction': ['from-violet-600 to-purple-700', 'text-violet-100', 'bg-violet-900/30'],
  'Science': ['from-cyan-600 to-sky-700', 'text-cyan-100', 'bg-cyan-900/30'],
  'History': ['from-amber-600 to-orange-700', 'text-amber-100', 'bg-amber-900/30'],
  'Mathematics': ['from-emerald-600 to-teal-700', 'text-emerald-100', 'bg-emerald-900/30'],
  'Psychology': ['from-pink-600 to-rose-700', 'text-pink-100', 'bg-pink-900/30'],
  'Geography': ['from-teal-600 to-cyan-700', 'text-teal-100', 'bg-teal-900/30'],
  'Economics': ['from-yellow-600 to-amber-700', 'text-yellow-100', 'bg-yellow-900/30'],
  'Engineering': ['from-slate-600 to-zinc-700', 'text-slate-100', 'bg-slate-900/30'],
  'Philosophy': ['from-indigo-600 to-violet-700', 'text-indigo-100', 'bg-indigo-900/30'],
  'Literature': ['from-rose-600 to-pink-700', 'text-rose-100', 'bg-rose-900/30'],
  'Arts': ['from-fuchsia-600 to-purple-700', 'text-fuchsia-100', 'bg-fuchsia-900/30'],
  'Music': ['from-purple-600 to-indigo-700', 'text-purple-100', 'bg-purple-900/30'],
  'Medicine': ['from-red-600 to-rose-700', 'text-red-100', 'bg-red-900/30'],
  'Law': ['from-slate-700 to-gray-800', 'text-slate-100', 'bg-slate-900/30'],
  'Biology': ['from-green-600 to-emerald-700', 'text-green-100', 'bg-green-900/30'],
  'Physics': ['from-sky-600 to-blue-700', 'text-sky-100', 'bg-sky-900/30'],
  'Chemistry': ['from-orange-600 to-amber-700', 'text-orange-100', 'bg-orange-900/30'],
  'Languages': ['from-teal-500 to-green-600', 'text-teal-100', 'bg-teal-900/30'],
  'Business': ['from-blue-700 to-sky-600', 'text-blue-100', 'bg-blue-900/30'],
  'Drama': ['from-yellow-500 to-orange-600', 'text-yellow-100', 'bg-yellow-900/30'],
  'Astronomy': ['from-indigo-800 to-violet-900', 'text-indigo-100', 'bg-indigo-900/30'],
  'Travel': ['from-emerald-500 to-cyan-600', 'text-emerald-100', 'bg-emerald-900/30'],
  'Sociology': ['from-amber-700 to-yellow-600', 'text-amber-100', 'bg-amber-900/30'],
  'Religion': ['from-violet-700 to-purple-800', 'text-violet-100', 'bg-violet-900/30'],
  'Self-Help': ['from-rose-500 to-pink-600', 'text-rose-100', 'bg-rose-900/30'],
};

// Default for unknown categories
function getCategoryGradient(name: string): [string, string, string] {
  if (CATEGORY_GRADIENTS[name]) return CATEGORY_GRADIENTS[name];
  const fallbacks: [string, string, string][] = [
    ['from-primary-600 to-primary-800', 'text-primary-100', 'bg-primary-900/30'],
    ['from-slate-600 to-slate-800', 'text-slate-100', 'bg-slate-900/30'],
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return fallbacks[h % fallbacks.length];
}

// ─── Main Page ────────────────────────────────────────────────────────────────
interface CategoryData {
  name: string;
  count: number;
}

export default function CategoriesPage() {
  const router = useRouter();
  const [searchFilter, setSearchFilter] = useState('');

  const {
    data: categories = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CategoryData[]>({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await api.get('/search/categories');
      const raw = res.data?.data || res.data;
      if (Array.isArray(raw)) {
        return raw.map((c: any) => ({
          name: c.name ?? c._id ?? String(c),
          count: c.count ?? c.bookCount ?? 0,
        }));
      }
      return [];
    },
  });

  const filtered = categories.filter((c) =>
    !searchFilter || c.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.04 } },
  };
  const item = {
    hidden: { opacity: 0, y: 24, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  };

  const totalBooks = categories.reduce((s, c) => s + c.count, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-slate-900 via-primary-900 to-indigo-900 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-primary-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-10 w-64 h-64 rounded-full bg-indigo-600/10 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 py-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-primary-200 text-xs font-semibold mb-6 backdrop-blur-sm">
              <Layers className="w-3.5 h-3.5" />
              {categories.length} Categories · {totalBooks.toLocaleString()} Books
            </div>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-3 tracking-tight">
              Browse by Category
            </h1>
            <p className="text-primary-200 text-base mb-10 max-w-xl mx-auto">
              Discover our curated collection across every discipline — from Computer Science to Classic Literature.
            </p>
          </motion.div>

          {/* Filter input */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative max-w-md mx-auto"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter categories..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-xl border border-white/10"
            />
          </motion.div>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 15 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : 'Failed to load categories'}
            onRetry={refetch}
          />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Layers className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-4" />
            <h3 className="font-display text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
              {searchFilter ? `No categories match "${searchFilter}"` : 'No categories found'}
            </h3>
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="mt-4 text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4"
          >
            {filtered.map((cat) => {
              const [grad, textColor] = getCategoryGradient(cat.name);
              const icon = CATEGORY_ICONS[cat.name] ?? <BookOpen className="w-7 h-7" />;

              return (
                <motion.div key={cat.name} variants={item}>
                  <Link
                    href={`/search?categories=${encodeURIComponent(cat.name)}`}
                    className={`group relative flex flex-col items-center justify-center text-center p-6 h-40 rounded-2xl bg-gradient-to-br ${grad} overflow-hidden shadow-md hover:shadow-xl hover:-translate-y-1.5 transition-all duration-250 cursor-pointer`}
                  >
                    {/* Background decoration */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/10" />
                    <div className="absolute -bottom-3 -right-3 w-20 h-20 rounded-full bg-white/5" />
                    <div className="absolute -top-3 -left-3 w-16 h-16 rounded-full bg-white/5" />

                    {/* Icon */}
                    <div className={`relative z-10 mb-3 ${textColor} group-hover:scale-110 transition-transform duration-200`}>
                      {icon}
                    </div>

                    {/* Name */}
                    <p className={`relative z-10 font-display font-bold text-sm ${textColor} leading-tight`}>
                      {cat.name}
                    </p>

                    {/* Count */}
                    {cat.count > 0 && (
                      <p className={`relative z-10 text-[11px] mt-1 opacity-75 ${textColor} tabular-nums`}>
                        {cat.count.toLocaleString()} book{cat.count !== 1 ? 's' : ''}
                      </p>
                    )}

                    {/* Arrow on hover */}
                    <div className={`absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-x-1 group-hover:translate-x-0 ${textColor}`}>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Bottom CTA */}
        {!isLoading && !isError && filtered.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-16 text-center"
          >
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Looking for something specific?
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary-700 text-white text-sm font-semibold hover:bg-primary-600 transition-colors shadow-sm shadow-primary-700/20"
            >
              <Search className="w-4 h-4" />
              Full Text Search
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
