import React from 'react';
import { cn } from '@/lib/utils';
export { NeoCard } from './Neo';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  header?: React.ReactNode;
  body?: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  inset?: boolean;
  highlighted?: boolean;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  header,
  body,
  footer,
  children,
  className,
  size = 'md',
  inset = false,
  highlighted = false,
  elevated = true,
  ...props
}) => {
  const sizeClasses = {
    sm: inset ? 'neo-inset-well-sm' : elevated ? 'rounded-[var(--neo-r-sm)] [box-shadow:var(--neo-raised-sm)]' : 'rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)]',
    md: inset ? 'neo-inset-well' : elevated ? 'rounded-[var(--neo-r-md)] [box-shadow:var(--neo-raised)]' : 'rounded-[var(--neo-r-md)] bg-[var(--neo-surface)]',
    lg: inset ? 'neo-inset-well p-8' : elevated ? 'rounded-[var(--neo-r-lg)] [box-shadow:var(--neo-raised-lg)]' : 'rounded-[var(--neo-r-lg)] bg-[var(--neo-surface)]',
  }[size];

  return (
    <div
      className={cn(
        'bg-[var(--neo-card)] text-[var(--neo-text)] transition-all duration-200',
        sizeClasses,
        highlighted && 'border border-[var(--neo-accent)]/30 shadow-[0_0_0_1px_rgba(99,102,241,0.2)]',
        className
      )}
      {...props}
    >
      {header && <CardHeader>{header}</CardHeader>}
      {body ? <CardContent>{body}</CardContent> : children}
      {footer && <CardFooter>{footer}</CardFooter>}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn('flex flex-col space-y-1.5 p-5 md:p-6', className)}
    {...props}
  >
    {children}
  </div>
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => (
  <h3
    className={cn('font-display text-lg font-bold tracking-tight text-[var(--neo-text)]', className)}
    {...props}
  >
    {children}
  </h3>
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  children,
  ...props
}) => (
  <p
    className={cn('text-sm text-[var(--neo-text-2)] font-normal leading-relaxed', className)}
    {...props}
  >
    {children}
  </p>
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div className={cn('p-5 md:p-6', className)} {...props}>
    {children}
  </div>
);

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn('flex items-center p-5 md:p-6 pt-0 mt-auto', className)}
    {...props}
  >
    {children}
  </div>
);
