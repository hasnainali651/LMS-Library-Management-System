'use client';

import React from 'react';
import toast, { Toast } from 'react-hot-toast';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  Clock,
  ExternalLink,
  Info,
} from 'lucide-react';
import { LordIcon } from './LordIcon';

export interface ApiErrorInfo {
  statusCode?: number;
  statusText?: string;
  code?: string;
  reason: string;
  fix: string;
  details?: string;
}

/**
 * Maps standard HTTP error statuses, axios errors, or generic exceptions into
 * human-actionable reason + suggested fix pairs.
 */
export function parseApiError(error: unknown): ApiErrorInfo {
  if (typeof error === 'string') {
    return {
      reason: error,
      fix: 'Review your input and attempt the action again.',
    };
  }

  // Axios or HTTP response object
  const anyErr = error as any;
  const status = anyErr?.response?.status || anyErr?.status;
  const serverMsg =
    anyErr?.response?.data?.message ||
    anyErr?.response?.data?.error ||
    anyErr?.message;

  if (!navigator.onLine || anyErr?.code === 'ERR_NETWORK') {
    return {
      statusCode: 0,
      statusText: 'OFFLINE',
      code: 'NETWORK_DISCONNECTED',
      reason: 'No active connection to the library server could be established.',
      fix: 'Check your internet connection or Wi-Fi network and try again.',
      details: serverMsg,
    };
  }

  switch (status) {
    case 400:
      return {
        statusCode: 400,
        statusText: 'BAD REQUEST',
        code: 'INVALID_PARAMETERS',
        reason: serverMsg || 'The submitted data was malformed or failed validation rules.',
        fix: 'Double check the entered fields for formatting errors and resubmit.',
      };
    case 401:
      return {
        statusCode: 401,
        statusText: 'UNAUTHORIZED',
        code: 'SESSION_EXPIRED',
        reason: 'Your login credentials have expired or are missing.',
        fix: 'Log in again to refresh your session credentials and continue.',
      };
    case 403:
      return {
        statusCode: 403,
        statusText: 'FORBIDDEN',
        code: 'ACCESS_DENIED',
        reason: serverMsg || 'Your current account role lacks permission for this action.',
        fix: 'Contact your library administrator if you require elevated privileges.',
      };
    case 404:
      return {
        statusCode: 404,
        statusText: 'NOT FOUND',
        code: 'RESOURCE_MISSING',
        reason: serverMsg || 'The requested catalog item or record could not be found.',
        fix: 'Verify the identifier or search the catalog to find current records.',
      };
    case 409:
      return {
        statusCode: 409,
        statusText: 'CONFLICT',
        code: 'RESOURCE_CONFLICT',
        reason: serverMsg || 'This record has already been modified or already exists.',
        fix: 'Refresh the page to retrieve the latest state before attempting again.',
      };
    case 422:
      return {
        statusCode: 422,
        statusText: 'UNPROCESSABLE',
        code: 'VALIDATION_FAILED',
        reason: serverMsg || 'One or more required fields did not satisfy validation rules.',
        fix: 'Inspect the highlighted form fields and supply valid values.',
      };
    case 429:
      return {
        statusCode: 429,
        statusText: 'RATE LIMITED',
        code: 'TOKEN_BUCKET_EXHAUSTED',
        reason: 'Too many requests were sent in a short window. System protection active.',
        fix: 'Please pause for 5 to 10 seconds while your token bucket replenishes.',
      };
    case 500:
    case 502:
    case 504:
      return {
        statusCode: status,
        statusText: 'SERVER ERROR',
        code: 'SERVICE_UNAVAILABLE',
        reason: 'The library backend encountered an unexpected error processing this request.',
        fix: 'Our engineering logs have captured this event. Please retry in a few moments.',
        details: serverMsg,
      };
    case 503:
      return {
        statusCode: 503,
        statusText: 'MAINTENANCE',
        code: 'TEMPORARILY_UNAVAILABLE',
        reason: 'The library database or rate limiting service is momentarily under load.',
        fix: 'Background retries are paused; please wait 10 seconds before refreshing.',
        details: serverMsg,
      };
    default:
      return {
        statusCode: status,
        statusText: 'ERROR',
        code: 'UNKNOWN_FAILURE',
        reason: serverMsg || 'An unexpected error occurred while completing this operation.',
        fix: 'Verify your connection and retry. Contact support if the problem persists.',
      };
  }
}

export interface ApiErrorAlertProps {
  t?: Toast;
  error: unknown;
  title?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const ApiErrorAlert: React.FC<ApiErrorAlertProps> = ({
  t,
  error,
  title,
  onRetry,
  onDismiss,
  className = '',
}) => {
  const info = parseApiError(error);
  const handleDismiss = () => {
    if (t) toast.dismiss(t.id);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`w-full max-w-md rounded-2xl border border-red-500/40 bg-slate-900/95 p-4 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl transition-all duration-300 pointer-events-auto ${
        t ? (t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95') : ''
      } ${className}`}
    >
      <div className="flex items-start gap-3.5">
        {/* Animated Lordicon Alert / Fallback */}
        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400">
          <LordIcon
            icon="alert"
            size={24}
            trigger="in"
            fallbackIcon={AlertTriangle}
            colors={{ primary: '#f87171', secondary: '#ef4444' }}
          />
        </div>

        {/* Content Section */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {info.statusCode ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-red-500/20 text-red-300 border border-red-500/30 font-mono">
                {info.statusCode} {info.statusText}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-red-500/20 text-red-300 border border-red-500/30">
                Action Error
              </span>
            )}
          </div>

          <h4 className="text-sm font-semibold text-white tracking-tight">
            {title || 'Request Could Not Be Completed'}
          </h4>

          {/* Reason */}
          <div className="mt-2 text-xs leading-relaxed text-slate-300">
            <span className="font-semibold text-slate-200">Reason: </span>
            <span>{info.reason}</span>
          </div>

          {/* Actionable Fix */}
          <div className="mt-1.5 rounded-lg bg-red-950/40 border border-red-900/40 px-2.5 py-1.5 text-xs text-red-200/90 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-red-300">Suggested Fix: </span>
              {info.fix}
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-3 flex items-center gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={() => {
                  if (t) toast.dismiss(t.id);
                  onRetry();
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/40 transition-all duration-300 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Action
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Top Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss alert"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export interface SuccessAlertProps {
  t?: Toast;
  title: string;
  message?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const SuccessAlert: React.FC<SuccessAlertProps> = ({
  t,
  title,
  message,
  actionLabel,
  actionHref,
  onAction,
  onDismiss,
  className = '',
}) => {
  const handleDismiss = () => {
    if (t) toast.dismiss(t.id);
    onDismiss?.();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`w-full max-w-md rounded-2xl border border-emerald-500/40 bg-slate-900/95 p-4 text-slate-100 shadow-2xl shadow-black/60 backdrop-blur-xl transition-all duration-300 pointer-events-auto ${
        t ? (t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95') : ''
      } ${className}`}
    >
      <div className="flex items-start gap-3.5">
        {/* Animated Lordicon Checkmark */}
        <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
          <LordIcon
            icon="check"
            size={24}
            trigger="in"
            fallbackIcon={CheckCircle2}
            colors={{ primary: '#34d399', secondary: '#10b981' }}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Completed
            </span>
          </div>

          <h4 className="text-sm font-semibold text-white tracking-tight">
            {title}
          </h4>

          {message && (
            <p className="mt-1 text-xs text-slate-300 leading-relaxed">
              {message}
            </p>
          )}

          {/* Action Link or Button */}
          {actionLabel && (
            <div className="mt-3">
              {actionHref ? (
                <a
                  href={actionHref}
                  onClick={handleDismiss}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm"
                >
                  <span>{actionLabel}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    handleDismiss();
                    onAction?.();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-colors shadow-sm"
                >
                  <span>{actionLabel}</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ─── Global Helper Functions for Toast Triggers ─── */

export function showApiErrorToast(
  error: unknown,
  options?: {
    title?: string;
    onRetry?: () => void;
    duration?: number;
    id?: string;
  }
) {
  return toast.custom(
    (t) => (
      <ApiErrorAlert
        t={t}
        error={error}
        title={options?.title}
        onRetry={options?.onRetry}
      />
    ),
    {
      id: options?.id,
      duration: options?.duration ?? 6000,
      position: 'top-right',
    }
  );
}

export function showSuccessToast(
  title: string,
  options?: {
    message?: string;
    actionLabel?: string;
    actionHref?: string;
    onAction?: () => void;
    duration?: number;
    id?: string;
  }
) {
  return toast.custom(
    (t) => (
      <SuccessAlert
        t={t}
        title={title}
        message={options?.message}
        actionLabel={options?.actionLabel}
        actionHref={options?.actionHref}
        onAction={options?.onAction}
      />
    ),
    {
      id: options?.id,
      duration: options?.duration ?? 4500,
      position: 'top-right',
    }
  );
}
