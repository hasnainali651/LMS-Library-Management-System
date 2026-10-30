import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
export { NeoButton } from './Neo';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'default' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'neo-btn-accent text-white [box-shadow:var(--neo-accent-glow)] hover:brightness-105 active:translate-y-[1px] transition-[box-shadow,transform,background-color,color] duration-150',
  accent:
    'neo-btn-accent text-white [box-shadow:var(--neo-accent-glow)] hover:brightness-105 active:translate-y-[1px] transition-[box-shadow,transform,background-color,color] duration-150',
  secondary:
    'neo-btn text-[var(--neo-text)] [box-shadow:var(--neo-raised-sm)] hover:[box-shadow:var(--neo-raised)] active:[box-shadow:var(--neo-inset-sm)] active:translate-y-[1px] transition-[box-shadow,transform,background-color,color] duration-150',
  default:
    'neo-btn text-[var(--neo-text)] [box-shadow:var(--neo-raised-sm)] hover:[box-shadow:var(--neo-raised)] active:[box-shadow:var(--neo-inset-sm)] active:translate-y-[1px] transition-[box-shadow,transform,background-color,color] duration-150',
  ghost:
    'bg-transparent text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)] hover:[box-shadow:var(--neo-flat)] active:[box-shadow:var(--neo-inset-sm)] active:translate-y-[1px] transition-[box-shadow,transform,background-color,color] duration-150',
  danger:
    'bg-[var(--neo-danger)] text-white shadow-[0_2px_8px_rgba(220,38,38,0.22)] hover:brightness-105 active:translate-y-[1px] transition-[box-shadow,transform,background-color,color,filter] duration-150',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'text-xs h-8 px-3.5 gap-1.5 rounded-[var(--neo-r-sm)] font-semibold',
  md: 'text-sm h-10 px-5 gap-2 rounded-[var(--neo-r-sm)] font-semibold',
  lg: 'text-base h-12 px-6 gap-2.5 rounded-[var(--neo-r-md)] font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          'inline-flex items-center justify-center font-medium select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)] focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none transition-[box-shadow,transform,background-color,color] duration-150',
          variantStyles[variant] || variantStyles.secondary,
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
