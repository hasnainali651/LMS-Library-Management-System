'use client';

import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this section.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-danger)]/30 max-w-lg mx-auto',
        className
      )}
    >
      <div className="w-12 h-12 rounded-[var(--neo-r-sm)] bg-[var(--neo-danger-surface)] text-[var(--neo-danger)] flex items-center justify-center mb-4 [box-shadow:var(--neo-flat)] border border-[var(--neo-danger)]/25">
        <AlertCircle className="w-6 h-6 stroke-[2]" />
      </div>

      <h3 className="font-display text-base md:text-lg font-bold text-[var(--neo-text)] mb-1.5">
        {title}
      </h3>

      {message && (
        <p className="text-sm text-[var(--neo-text-2)] max-w-sm mb-5 leading-relaxed">
          {message}
        </p>
      )}

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
        >
          Try Again
        </Button>
      )}
    </div>
  );
};
