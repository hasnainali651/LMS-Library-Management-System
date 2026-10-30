import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon | React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
  ...props
}) => {
  const renderIcon = () => {
    if (!Icon) return null;
    if (React.isValidElement(Icon)) {
      return Icon;
    }
    const IconComponent = Icon as React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    return <IconComponent className="w-6 h-6 stroke-[1.8]" aria-hidden={true} />;
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 md:p-12 rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-border-light)] max-w-lg mx-auto',
        className
      )}
      {...props}
    >
      <div className="w-12 h-12 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] text-[var(--neo-accent)] flex items-center justify-center mb-4 [box-shadow:var(--neo-flat)] ">
        {renderIcon()}
      </div>

      <h3 className="font-display text-base md:text-lg font-bold text-[var(--neo-text)] mb-1.5">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-[var(--neo-text-2)] max-w-sm mb-5 leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-1 flex items-center gap-3">{action}</div>}
    </div>
  );
};
