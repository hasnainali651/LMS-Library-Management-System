'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PasswordStrengthProps {
  password?: string;
  className?: string;
  showRules?: boolean;
}

export interface RuleCheck {
  id: string;
  label: string;
  valid: boolean;
}

export function checkPasswordRules(password: string = ''): {
  rules: RuleCheck[];
  score: number;
  strength: 'None' | 'Weak' | 'Medium' | 'Strong';
} {
  const rules: RuleCheck[] = [
    {
      id: 'min8',
      label: 'At least 8 characters',
      valid: password.length >= 8,
    },
    {
      id: 'uppercase',
      label: 'At least 1 uppercase letter',
      valid: /[A-Z]/.test(password),
    },
    {
      id: 'number',
      label: 'At least 1 number',
      valid: /[0-9]/.test(password),
    },
    {
      id: 'special',
      label: 'At least 1 special character (@$!%*?&#^_-)',
      valid: /[@$!%*?&#^_\-]/.test(password),
    },
  ];

  const score = rules.filter((r) => r.valid).length;

  let strength: 'None' | 'Weak' | 'Medium' | 'Strong' = 'None';
  if (!password) {
    strength = 'None';
  } else if (score <= 1) {
    strength = 'Weak';
  } else if (score <= 3) {
    strength = 'Medium';
  } else {
    strength = 'Strong';
  }

  return { rules, score, strength };
}

export const PasswordStrength: React.FC<PasswordStrengthProps> = ({
  password = '',
  className,
  showRules = true,
}) => {
  const { rules, score, strength } = useMemo(
    () => checkPasswordRules(password),
    [password]
  );

  const getSegmentColor = (index: number) => {
    if (index >= score) return 'bg-[var(--neo-surface)]';
    if (score <= 1) return 'bg-[var(--neo-danger)]';
    if (score <= 3) return 'bg-[var(--neo-warning)]';
    return 'bg-[var(--neo-success)]';
  };

  const getLabelColor = () => {
    if (strength === 'Weak') return 'text-[var(--neo-danger)]';
    if (strength === 'Medium') return 'text-[var(--neo-warning)]';
    if (strength === 'Strong') return 'text-[var(--neo-success)]';
    return 'text-[var(--neo-text-3)]';
  };

  return (
    <div className={cn('w-full space-y-2.5 select-none', className)}>
      {/* 4 Colored Segments with Inset Track */}
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3].map((index) => {
          const isFilled = index < score;
          return (
            <div
              key={index}
              className="h-2 flex-1 rounded-full bg-[var(--neo-inset-bg)] [box-shadow:var(--neo-inset-sm)] border border-[var(--neo-border-dark)] overflow-hidden"
            >
              <motion.div
                className={cn('h-full w-full', getSegmentColor(index))}
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: isFilled ? 1 : 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              />
            </div>
          );
        })}
      </div>

      {/* Label Text */}
      <div className="flex items-center justify-between text-[11px] font-medium">
        <span className="text-[var(--neo-text-3)]">Password Strength:</span>
        <motion.span
          key={strength}
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('font-bold uppercase tracking-wider', getLabelColor())}
        >
          {strength === 'None' ? 'Required' : strength}
        </motion.span>
      </div>

      {/* 4 Rule Badges / Checklist */}
      {showRules && (
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                'flex items-center gap-1.5 text-[11px] transition-colors',
                rule.valid
                  ? 'text-[var(--neo-success)] font-medium'
                  : 'text-[var(--neo-text-3)]'
              )}
            >
              <div
                className={cn(
                  'w-3.5 h-3.5 rounded-full flex items-center justify-center text-[10px] shrink-0 transition-colors border',
                  rule.valid
                    ? 'bg-[var(--neo-success-surface)] text-[var(--neo-success)] border-[var(--neo-success)]/30'
                    : 'bg-[var(--neo-surface)] text-[var(--neo-text-3)] border-[var(--neo-border-light)]'
                )}
              >
                {rule.valid ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2.5 h-2.5" />}
              </div>
              <span className="truncate">{rule.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
