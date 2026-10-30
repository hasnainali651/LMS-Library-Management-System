'use client';

import React, { useState } from 'react';
import { Mail, ShieldAlert, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import toast from 'react-hot-toast';

export const VerificationBanner: React.FC = () => {
  const { user } = useAuthStore();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  if (!user) return null;

  const isEmailUnverified = user.isEmailVerified === false;
  const isStaffUnapproved = user.role === 'librarian' && user.isStaffApproved === false;

  if (!isEmailUnverified && !isStaffUnapproved) {
    return null;
  }

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);

    try {
      await api.post('/auth/resend-verification', { email: user.email });
      setResendSuccess(true);
      toast.success('Verification email dispatched to ' + user.email);
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Unable to resend verification email.';
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2 px-4 sm:px-6 md:px-8 pt-3">
      {/* Staff Approval Pending Banner */}
      {isStaffUnapproved && (
        <div className="w-full p-3.5 rounded-[var(--neo-r-md)] bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong className="font-semibold">Staff Credentials Pending Approval:</strong> Your account is registered as a librarian. Circulation desk operations and book catalog edits remain restricted until an administrator verifies your staff profile.
            </span>
          </div>
        </div>
      )}

      {/* Email Verification Required Banner */}
      {isEmailUnverified && (
        <div className="w-full p-3.5 rounded-[var(--neo-r-md)] bg-rose-500/10 border border-rose-500/30 text-xs text-rose-900 dark:text-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
            <span>
              <strong className="font-semibold">Email Verification Required:</strong> Please verify your email (<span className="font-mono">{user.email}</span>). Book borrowing, hold reservations, and loan renewals are restricted until verified.
            </span>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            {resendSuccess ? (
              <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verification Sent</span>
              </span>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleResend}
                isLoading={isResending}
                disabled={cooldown > 0}
                leftIcon={<Send className="w-3 h-3" />}
                className="h-8 text-xs py-1 px-3 whitespace-nowrap"
              >
                {cooldown > 0 ? `Wait ${cooldown}s` : 'Resend Verification'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

