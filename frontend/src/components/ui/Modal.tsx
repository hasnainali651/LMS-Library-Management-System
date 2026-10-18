'use client';

import React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export { NeoModal } from './Neo';

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const maxWidthMap = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
};

export const Modal: React.FC<ModalProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidth = 'md',
  className,
}) => {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <DialogPrimitive.Content
            className={cn(
              'relative w-full rounded-[var(--neo-r-xl)] bg-[var(--neo-card)] text-[var(--neo-text)] border border-[var(--neo-border-light)] [box-shadow:var(--neo-raised-lg)] p-6 duration-200 data-[state=open]:animate-slide-up data-[state=closed]:animate-out outline-none',
              maxWidthMap[maxWidth],
              className
            )}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[var(--neo-shadow-dark)]/25">
              <div className="space-y-1">
                {title && (
                  <DialogPrimitive.Title className="font-display text-lg font-bold text-[var(--neo-text)]">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="text-sm text-[var(--neo-text-2)]">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close className="neo-btn w-8 h-8 rounded-full flex items-center justify-center text-[var(--neo-text-2)] hover:text-[var(--neo-text)] active:scale-[0.97] transition-all">
                <X className="w-4 h-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            </div>

            <div className="py-4 text-[var(--neo-text)] text-sm">{children}</div>

            {footer && (
              <div className="pt-4 border-t border-[var(--neo-shadow-dark)]/25 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
