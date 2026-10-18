'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import toast from 'react-hot-toast';
import { FieldValues, UseFormGetValues, UseFormReset, UseFormWatch } from 'react-hook-form';
import { useAuthStore } from '@/store/authStore';

interface DraftOptions<T extends object> {
  formId: string;
  entityId?: string;
  fields: readonly (keyof T & string)[];
  enabled?: boolean;
  anonymous?: boolean;
  label?: string;
}

const secretField = /password|passwd|token|secret|cardnumber|card_number|cvv|cvc|file/i;

function pickFields<T extends object>(values: unknown, fields: readonly (keyof T & string)[]): Partial<T> {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return {};
  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (secretField.test(field) || !Object.prototype.hasOwnProperty.call(values, field)) continue;
    const value = (values as Record<string, unknown>)[field];
    if (typeof value === 'string' && !/^(blob:|data:)/i.test(value)) result[field] = value;
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) result[field] = value;
  }
  return result as Partial<T>;
}

function useDraftStorage<T extends object>(options: DraftOptions<T> & {
  getValues: () => T;
  onRestore: (values: Partial<T>) => void;
}) {
  const userId = useAuthStore((state) => state.user?._id);
  const owner = options.anonymous ? 'anonymous' : userId;
  const key = owner && options.enabled !== false
    ? `lms:form-draft:v1:${JSON.stringify([owner, options.formId, options.entityId ?? 'new'])}`
    : null;
  const latest = useRef(options);
  latest.current = options;
  const session = useRef<{
    key: string;
    pending: boolean;
    baseline: string;
    queued: string | null;
    timer?: ReturnType<typeof setTimeout>;
    toastId?: string;
    cleared: boolean;
  } | null>(null);

  const serialize = useCallback((values: unknown) => JSON.stringify(pickFields(values, latest.current.fields)), []);
  const save = useCallback((values: unknown) => {
    const current = session.current;
    if (!current || current.key !== key || current.pending) return;
    const data = serialize(values);
    if (current.cleared && data === current.baseline) return;
    current.cleared = false;
    if (current.timer) clearTimeout(current.timer);
    current.queued = data;
    current.timer = setTimeout(() => {
      try {
        if (data !== current.baseline) sessionStorage.setItem(current.key, data);
        else sessionStorage.removeItem(current.key);
      } catch { /* Storage may be disabled or full. */ }
      current.queued = null;
    }, 400);
  }, [key, serialize]);

  const clearDraft = useCallback(() => {
    if (key) {
      try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    }
    const current = session.current;
    if (!current || current.key !== key) return;
    if (current.timer) clearTimeout(current.timer);
    if (current.toastId) toast.remove(current.toastId);
    current.queued = null;
    current.pending = false;
    current.baseline = serialize(latest.current.getValues());
    current.cleared = true;
  }, [key, serialize]);

  useEffect(() => {
    if (!key) return;
    const current = {
      key,
      pending: false,
      baseline: serialize(latest.current.getValues()),
      queued: null,
      cleared: false,
    } as NonNullable<typeof session.current>;
    session.current = current;
    let stored: Partial<T> | null = null;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        stored = pickFields<T>(JSON.parse(raw), latest.current.fields);
        if (!Object.keys(stored).length) {
          stored = null;
          sessionStorage.removeItem(key);
        }
      }
    } catch {
      try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    }
    if (stored) {
      const draft = stored;
      current.pending = true;
      const choose = (restore: boolean) => {
        if (session.current !== current) return;
        if (restore) latest.current.onRestore(draft);
        else {
          try { sessionStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
        }
        current.pending = false;
        if (current.toastId) toast.remove(current.toastId);
        if (restore) {
          // A still-mounted tab may already display these unsaved values.
          current.baseline = '';
          save({ ...latest.current.getValues(), ...draft });
        } else {
          current.baseline = serialize(latest.current.getValues());
        }
      };
      current.toastId = toast.custom(() => {
        const dialog = document.querySelector('[role="dialog"][data-state="open"]');
        const prompt = (
          <div role="status" className={`${dialog ? 'fixed right-4 top-4 z-[100] ' : ''}pointer-events-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-lg text-sm text-slate-900 dark:text-slate-100`}>
            <p className="font-semibold">Restore your draft?</p>
            {latest.current.label && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{latest.current.label}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => choose(true)} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">Restore</button>
              <button type="button" onClick={() => choose(false)} className="rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500">Discard</button>
            </div>
          </div>
        );
        return dialog ? createPortal(prompt, dialog) : prompt;
      }, { duration: Infinity });
    }
    const flush = () => {
      if (current.timer) clearTimeout(current.timer);
      if (!current.pending && !current.cleared && current.queued) {
        try {
          if (current.queued !== current.baseline) sessionStorage.setItem(key, current.queued);
          else sessionStorage.removeItem(key);
        } catch { /* Storage may be unavailable. */ }
        current.queued = null;
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      flush();
      window.removeEventListener('pagehide', flush);
      if (current.toastId) toast.remove(current.toastId);
      if (session.current === current) session.current = null;
    };
  }, [key, save, serialize]);

  return { clearDraft, save };
}

export function useFormDraft<T extends FieldValues>(options: DraftOptions<T> & {
  watch: UseFormWatch<T>;
  reset: UseFormReset<T>;
  getValues: UseFormGetValues<T>;
}) {
  const { watch, reset, getValues } = options;
  const { clearDraft, save } = useDraftStorage<T>({
    ...options,
    getValues,
    onRestore: (draft) => reset({ ...getValues(), ...draft }),
  });
  useEffect(() => {
    const subscription = watch((values, { name, type }) => {
      if (name || type) save(values);
    });
    return () => subscription.unsubscribe();
  }, [watch, save]);
  return { clearDraft };
}

export function useStateDraft<T extends object>(options: DraftOptions<T> & {
  values: T;
  onRestore: (values: Partial<T>) => void;
}) {
  const { clearDraft, save } = useDraftStorage<T>({ ...options, getValues: () => options.values });
  const previous = useRef('');
  const data = JSON.stringify(pickFields(options.values, options.fields));
  useEffect(() => {
    if (previous.current !== data) save(options.values);
    previous.current = data;
  }, [data, save, options.values]);
  return { clearDraft };
}
