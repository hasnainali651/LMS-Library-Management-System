'use client';

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/* ─── NeoCard ───────────────────────────────────────────────────────────── */
export interface NeoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  inset?: boolean;
  highlighted?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export function NeoCard({
  children,
  className = '',
  size = 'md',
  inset = false,
  highlighted = false,
  onClick,
  ...props
}: NeoCardProps) {
  const sizeMap = {
    sm: inset ? 'neo-inset-well-sm' : 'neo-card-sm',
    md: inset ? 'neo-inset-well' : 'neo-card',
    lg: inset ? 'neo-inset-well p-8' : 'neo-card-lg',
  };
  const cls = sizeMap[size] || sizeMap.md;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      className={`${cls} text-[var(--neo-text)] ${
        highlighted ? 'border border-[var(--neo-accent)]/30 shadow-[0_0_0_1px_rgba(79,70,229,0.18)]' : ''
      } ${onClick ? 'neo-card-interactive select-none' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── NeoButton ─────────────────────────────────────────────────────────── */
export interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?: 'default' | 'accent' | 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  loading?: boolean;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const NeoButton = forwardRef<HTMLButtonElement, NeoButtonProps>(
  (
    {
      children,
      variant = 'default',
      size = 'md',
      disabled,
      onClick,
      type = 'button',
      className = '',
      loading,
      isLoading,
      leftIcon,
      rightIcon,
      ...props
    },
    ref
  ) => {
    const isSpinning = Boolean(loading || isLoading);

    const sizeClasses = {
      sm: 'text-xs h-8 px-3.5 gap-1.5 rounded-[var(--neo-r-sm)]',
      md: 'text-sm h-10 px-5 gap-2 rounded-[var(--neo-r-sm)]',
      lg: 'text-base h-12 px-6 gap-2.5 rounded-[var(--neo-r-md)]',
    }[size];

    let variantClass = 'neo-btn';
    if (variant === 'accent' || variant === 'primary') {
      variantClass = 'neo-btn-accent';
    } else if (variant === 'danger') {
      variantClass =
        'bg-[var(--neo-danger)] text-white shadow-[0_2px_8px_rgba(220,38,38,0.22)] hover:brightness-105 active:translate-y-[1px] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.25)]';
    } else if (variant === 'ghost') {
      variantClass =
        'bg-transparent text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)] hover:[box-shadow:var(--neo-flat)] active:[box-shadow:var(--neo-inset-sm)]';
    }

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isSpinning}
        onClick={onClick}
        className={`inline-flex items-center justify-center font-semibold select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)] focus-visible:ring-offset-2 transition-[box-shadow,transform,background-color,color] ${variantClass} ${sizeClasses} ${className}`}
        {...props}
      >
        {isSpinning ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
        ) : (
          leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isSpinning && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);
NeoButton.displayName = 'NeoButton';

/* ─── NeoInput ──────────────────────────────────────────────────────────── */
export interface NeoInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const NeoInput = forwardRef<HTMLInputElement, NeoInputProps>(
  ({ label, error, icon, className = '', id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {icon && (
            <span className="absolute left-3.5 text-[var(--neo-text-3)] flex items-center justify-center pointer-events-none" aria-hidden="true">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            className={`neo-input w-full py-2.5 ${icon ? 'pl-10' : 'pl-4'} pr-4 text-sm ${
              error ? 'border-[var(--neo-danger)] ring-2 ring-[var(--neo-danger)]/25' : ''
            } ${className}`}
            {...props}
          />
        </div>
        {error && (
          <span id={errorId} role="alert" className="text-xs text-[var(--neo-danger)] font-medium mt-0.5">
            {error}
          </span>
        )}
      </div>
    );
  }
);
NeoInput.displayName = 'NeoInput';

/* ─── NeoSelect ─────────────────────────────────────────────────────────── */
export interface NeoSelectOption {
  value: string | number;
  label: string;
}

export interface NeoSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options?: NeoSelectOption[];
  className?: string;
}

export function NeoSelect({
  label,
  options = [],
  className = '',
  id,
  ...props
}: NeoSelectProps) {
  const generatedId = React.useId();
  const selectId = id || generatedId;

  return (
    <div className="w-full flex flex-col gap-1.5 text-left">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)]">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <select
          id={selectId}
          className={`neo-input w-full py-2.5 px-4 text-sm cursor-pointer appearance-none bg-[var(--neo-inset-bg)] text-[var(--neo-text)] pr-10 ${className}`}
          {...props}
        >
          {options.map((o) => (
            <option
              key={o.value}
              value={o.value}
              className="bg-[var(--neo-card)] text-[var(--neo-text)]"
            >
              {o.label}
            </option>
          ))}
        </select>
        <span className="absolute right-3.5 pointer-events-none text-[var(--neo-text-3)] text-xs">▼</span>
      </div>
    </div>
  );
}

/* ─── NeoStatCard ───────────────────────────────────────────────────────── */
export interface NeoStatCardProps {
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: React.ReactNode;
  change?: string | number;
  changeType?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function NeoStatCard({
  icon,
  value,
  label,
  change,
  changeType = 'up',
  className = '',
}: NeoStatCardProps) {
  return (
    <div className={`neo-card p-5 md:p-6 flex flex-col gap-3 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--neo-text-2)]">
            {label}
          </p>
          <p className="font-display text-2xl md:text-3xl font-bold tracking-tight text-[var(--neo-text)] tabular-nums leading-none">
            {value}
          </p>
        </div>

        {icon && (
          <div className="w-10 h-10 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] [box-shadow:var(--neo-raised-sm)] flex items-center justify-center shrink-0 text-[var(--neo-accent-sky)]">
            {icon}
          </div>
        )}
      </div>

      {change && (
        <div className="flex items-center gap-1.5 text-xs font-medium pt-2">
          <span
            className={`font-semibold tabular-nums ${
              changeType === 'up'
                ? 'text-[var(--neo-success)]'
                : changeType === 'down'
                ? 'text-[var(--neo-danger)]'
                : 'text-[var(--neo-text-3)]'
            }`}
          >
            {changeType === 'up' ? '↑ ' : changeType === 'down' ? '↓ ' : ''}
            {change}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── NeoBadge ──────────────────────────────────────────────────────────── */
export interface NeoBadgeProps {
  children: React.ReactNode;
  color?: 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
  showDot?: boolean;
  className?: string;
}

export function NeoBadge({
  children,
  color = 'default',
  showDot = true,
  className = '',
}: NeoBadgeProps) {
  const colorStyles: Record<string, { bg: string; text: string; dot: string }> = {
    default: { bg: 'bg-[var(--neo-surface)]', text: 'text-[var(--neo-text-2)]', dot: 'bg-[var(--neo-text-3)]' },
    accent: { bg: 'bg-[var(--neo-surface)]', text: 'text-[var(--neo-accent)]', dot: 'bg-[var(--neo-accent)]' },
    success: { bg: 'bg-[var(--neo-success-surface)]', text: 'text-[var(--neo-success)]', dot: 'bg-[var(--neo-success)]' },
    warning: { bg: 'bg-[var(--neo-warning-surface)]', text: 'text-[var(--neo-warning)]', dot: 'bg-[var(--neo-warning)]' },
    danger: { bg: 'bg-[var(--neo-danger-surface)]', text: 'text-[var(--neo-danger)]', dot: 'bg-[var(--neo-danger)]' },
    info: { bg: 'bg-[var(--neo-info-surface)]', text: 'text-[var(--neo-info)]', dot: 'bg-[var(--neo-info)]' },
  };

  const style = colorStyles[color] || colorStyles.default;

  return (
    <span
      className={`neo-badge inline-flex items-center gap-1.5 ${style.bg} ${style.text} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} aria-hidden="true" />}
      <span>{children}</span>
    </span>
  );
}

/* ─── NeoToggle ─────────────────────────────────────────────────────────── */
export interface NeoToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
}

export function NeoToggle({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  className = '',
}: NeoToggleProps) {
  const generatedId = React.useId();
  const toggleId = id || generatedId;

  return (
    <div className={`neo-toggle-wrapper ${className}`}>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
            e.preventDefault();
            onChange(!checked);
          }
        }}
        aria-label={typeof label === 'string' ? label : undefined}
        className={`neo-toggle ${checked ? 'active' : ''}`}
      />
      {label && (
        <label
          htmlFor={toggleId}
          className={`text-sm font-medium text-[var(--neo-text)] select-none ${
            disabled ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
          }`}
        >
          {label}
        </label>
      )}
    </div>
  );
}

/* ─── NeoModal ──────────────────────────────────────────────────────────── */
export interface NeoModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function NeoModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = 'md',
  className = '',
}: NeoModalProps) {
  if (!open) return null;

  const maxW = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }[maxWidth];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`neo-card w-full ${maxW} p-6 relative flex flex-col gap-4 [box-shadow:var(--neo-raised-lg)] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3">
          <h3 className="font-display text-lg font-bold text-[var(--neo-text)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="neo-btn w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-[var(--neo-text-2)] hover:text-[var(--neo-text)]"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>
        <div className="text-[var(--neo-text)] text-sm">{children}</div>
        {footer && (
          <div className="pt-3 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── NeoTable ──────────────────────────────────────────────────────────── */
export interface NeoTableColumn<T = Record<string, any>> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface NeoTableProps<T = Record<string, any>> {
  columns: NeoTableColumn<T>[];
  data: T[];
  emptyText?: string;
  className?: string;
}

export function NeoTable<T extends Record<string, any> = Record<string, any>>({
  columns = [],
  data = [],
  emptyText = 'No records found',
  className = '',
}: NeoTableProps<T>) {
  return (
    <div className={`neo-card overflow-hidden w-full ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--neo-surface)]">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-[var(--neo-text-2)] select-none"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--neo-shadow-dark)]/10">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-[var(--neo-text-3)] font-medium"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              data.map((row, i) => {
                const record = row as Record<string, any>;
                return (
                  <tr
                    key={record.id || record._id || i}
                    className="hover:bg-[var(--neo-surface)]/50 transition-colors"
                  >
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 text-sm text-[var(--neo-text)] align-middle">
                        {c.render ? c.render(record[c.key], row) : record[c.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─── NeoTabs ───────────────────────────────────────────────────────────── */
export interface NeoTabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface NeoTabsProps {
  tabs: NeoTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export function NeoTabs({ tabs, activeTab, onChange, className = '' }: NeoTabsProps) {
  return (
    <div role="tablist" className={`neo-inset-well-sm p-1.5 flex items-center gap-1.5 overflow-x-auto ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[var(--neo-r-sm)] text-xs font-semibold whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)] focus-visible:ring-offset-2 select-none transition-[background-color,color,box-shadow] ${
              isActive
                ? 'bg-[var(--neo-card)] text-[var(--neo-accent)] [box-shadow:var(--neo-raised-sm)] border border-[var(--neo-accent)]/20'
                : 'text-[var(--neo-text-2)] hover:text-[var(--neo-text)] hover:bg-[var(--neo-surface)]/50'
            }`}
          >
            {tab.icon && <span aria-hidden="true">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
