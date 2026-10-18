import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';
export { NeoInput } from './Neo';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      required,
      leftIcon,
      rightIcon,
      className,
      id: customId,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = customId || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)] flex items-center gap-1 select-none"
          >
            {label}
            {required && <span className="text-[var(--neo-danger)] font-bold" aria-hidden="true">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[var(--neo-text-3)]">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            className={cn(
              'w-full h-10 rounded-[var(--neo-r-sm)] text-sm transition-all duration-150',
              'bg-[var(--neo-inset-bg)] text-[var(--neo-text)] [box-shadow:var(--neo-inset)] border border-[var(--neo-border-dark)]',
              'placeholder:text-[var(--neo-text-3)]',
              'focus:outline-none focus:border-[var(--neo-accent)] focus:[box-shadow:var(--neo-inset),0_0_0_3px_rgba(79,70,229,0.25)]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftIcon ? 'pl-10' : 'pl-3.5',
              rightIcon ? 'pr-10' : 'pr-3.5',
              error && 'border-[var(--neo-danger)] ring-2 ring-[var(--neo-danger)]/30',
              className
            )}
            {...props}
          />

          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[var(--neo-text-3)]">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p id={errorId} className="text-xs text-[var(--neo-danger)] flex items-center gap-1 font-medium">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[var(--neo-text-3)]">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
