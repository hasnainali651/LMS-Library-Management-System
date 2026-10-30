'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className }) => {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Current theme: ${theme}. Click to switch theme.`}
        aria-expanded={open}
        className="p-2 cursor-pointer"
      >
        {resolvedTheme === 'dark' ? (
          <Moon className="w-4 h-4 text-[var(--neo-accent)]" />
        ) : (
          <Sun className="w-4 h-4 text-amber-500" />
        )}
      </button>

      {open && (
        <div className="neo-card absolute right-0 mt-2 w-36 p-1.5 rounded-[var(--neo-r-md)] [box-shadow:var(--neo-raised-lg)] z-50 animate-fade-in border border-[var(--neo-border-light)] space-y-1">
          {options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setTheme(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-semibold rounded-[var(--neo-r-sm)] transition-colors text-left',
                  isSelected
                    ? 'bg-[var(--neo-inset-bg)] text-[var(--neo-accent)] [box-shadow:var(--neo-inset-sm)]'
                    : 'text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)]'
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{opt.label}</span>
                </span>
                {isSelected && <Check className="w-3 h-3 text-[var(--neo-accent)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

