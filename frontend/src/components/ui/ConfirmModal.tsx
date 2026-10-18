'use client';

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
  onConfirm,
  children,
}) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <DialogPrimitive.Content
            className={cn(
              'relative w-full max-w-md rounded-[var(--neo-r-xl)] bg-[var(--neo-card)] text-[var(--neo-text)] border border-[var(--neo-border-light)] p-6 [box-shadow:var(--neo-raised-lg)] duration-200 data-[state=open]:animate-slide-up data-[state=closed]:animate-out outline-none'
            )}
          >
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'w-11 h-11 rounded-[var(--neo-r-sm)] flex items-center justify-center shrink-0 border border-[var(--neo-border-light)] [box-shadow:var(--neo-flat)]',
                  confirmVariant === 'danger'
                    ? 'bg-[var(--neo-danger-surface)] text-[var(--neo-danger)]'
                    : 'bg-[var(--neo-warning-surface)] text-[var(--neo-warning)]'
                )}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div className="space-y-1 flex-1 min-w-0">
                <DialogPrimitive.Title className="font-display text-lg font-bold text-[var(--neo-text)]">
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm text-[var(--neo-text-2)] leading-relaxed">
                  {description}
                </DialogPrimitive.Description>
              </div>

              <DialogPrimitive.Close
                disabled={isLoading}
                className="neo-btn w-8 h-8 rounded-full flex items-center justify-center text-[var(--neo-text-2)] hover:text-[var(--neo-text)] transition-colors"
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            {children && <div className="mt-4 pt-2">{children}</div>}

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-[var(--neo-shadow-dark)]/25">
              <Button
                variant="ghost"
                size="sm"
                disabled={isLoading}
                onClick={() => onOpenChange(false)}
              >
                {cancelText}
              </Button>
              <Button
                variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
                size="sm"
                disabled={isLoading}
                onClick={onConfirm}
                leftIcon={isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : undefined}
              >
                {isLoading ? 'Processing...' : confirmText}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
