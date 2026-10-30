import axios, { CanceledError, InternalAxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/authStore';
import { showApiErrorToast } from '@/components/ui/AlertNotification';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const DEFAULT_PAUSE_MS = 10_000;
const UNAVAILABLE_TOAST_ID = 'api-temporarily-unavailable';

let pausedUntil = 0;
let rateLimitedUntil = 0;
let pauseTimer: ReturnType<typeof setTimeout> | undefined;
let showUnavailableCountdown = false;
let lastCountdown = -1;
const pausedRequests = new Set<() => void>();

function updateCountdown() {
  if (typeof window === 'undefined' || !showUnavailableCountdown) return;
  const seconds = Math.max(0, Math.ceil((pausedUntil - Date.now()) / 1000));
  if (seconds === lastCountdown) return;
  lastCountdown = seconds;
  toast.error(`Temporarily unavailable. Retry in ${seconds}s. Pending read requests will retry once; changes are not resubmitted.`, {
    id: UNAVAILABLE_TOAST_ID,
    duration: Infinity,
  });
}

function schedulePauseTick() {
  if (pauseTimer !== undefined) return;
  const remaining = pausedUntil - Date.now();
  if (remaining <= 0) {
    pausedUntil = 0;
    if (typeof window !== 'undefined' && showUnavailableCountdown) {
      toast.dismiss(UNAVAILABLE_TOAST_ID);
    }
    showUnavailableCountdown = false;
    lastCountdown = -1;
    const requests = Array.from(pausedRequests);
    pausedRequests.clear();
    requests.forEach((resume) => resume());
    return;
  }
  updateCountdown();
  // One shared clock drives both the dispatch gate and the visible countdown.
  pauseTimer = setTimeout(() => {
    pauseTimer = undefined;
    schedulePauseTick();
  }, Math.min(remaining, 1000));
}

function pauseDispatch(duration: number, unavailable = false) {
  pausedUntil = Math.max(pausedUntil, Date.now() + duration);
  showUnavailableCountdown ||= unavailable;
  updateCountdown();
  schedulePauseTick();
}

function retryAfterMilliseconds(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') return DEFAULT_PAUSE_MS;
  const text = String(value).trim();
  if (!text) return DEFAULT_PAUSE_MS;
  const seconds = Number(text);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 && Number.isFinite(seconds * 1000) ? seconds * 1000 : DEFAULT_PAUSE_MS;
  }
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : DEFAULT_PAUSE_MS;
}

function waitForDispatch(config: InternalAxiosRequestConfig): Promise<void> {
  // Axios 1.6 exposes these methods at runtime but omits them from CancelToken's types.
  const cancelToken = config.cancelToken as (NonNullable<InternalAxiosRequestConfig['cancelToken']> & {
    subscribe: (listener: () => void) => void;
    unsubscribe: (listener: () => void) => void;
  }) | undefined;
  cancelToken?.throwIfRequested();
  if (config.signal?.aborted) return Promise.reject(new CanceledError('Request canceled'));
  if (pausedUntil <= Date.now()) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      pausedRequests.delete(resume);
      config.signal?.removeEventListener?.('abort', cancel);
      cancelToken?.unsubscribe(cancel);
    };
    const resume = () => {
      cleanup();
      resolve();
    };
    const cancel = () => {
      cleanup();
      reject(new CanceledError('Request canceled'));
    };
    pausedRequests.add(resume);
    config.signal?.addEventListener?.('abort', cancel);
    cancelToken?.subscribe(cancel);
    if (config.signal?.aborted || cancelToken?.reason) cancel();
  });
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Read auth only after the shared pause so queued requests use the latest token.
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    do {
      await waitForDispatch(config);
    } while (pausedUntil > Date.now());
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: refresh authentication once and never replay failed mutations for availability errors.
api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isCancel(error) || !axios.isAxiosError(error)) return Promise.reject(error);
    const originalRequest = error.config as (InternalAxiosRequestConfig & {
      _retry?: boolean;
      _availabilityRetry?: boolean;
    }) | undefined;
    const status = error.response?.status;

    if (status === 429) {
      const now = Date.now();
      if (typeof window !== 'undefined' && rateLimitedUntil <= now) {
        showApiErrorToast(error, {
          title: 'Token Bucket Rate Limit Enforced',
          id: 'api-too-many-requests',
          duration: DEFAULT_PAUSE_MS,
        });
      }
      rateLimitedUntil = now + DEFAULT_PAUSE_MS;
      pauseDispatch(DEFAULT_PAUSE_MS);
    }

    if (status === 503) {
      pauseDispatch(retryAfterMilliseconds(error.response?.headers['retry-after']), true);
      const method = originalRequest?.method?.toUpperCase() || 'GET';
      if (originalRequest && !originalRequest._availabilityRetry && (method === 'GET' || method === 'HEAD')) {
        originalRequest._availabilityRetry = true;
        return api(originalRequest);
      }
    }

    if (status === 401 && originalRequest) {
      if (!originalRequest._retry) {
        originalRequest._retry = true;
        try {
          const newToken = await useAuthStore.getState().refreshToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return api(originalRequest);
          }
        } catch (refreshErr) {
          // Refresh failed
        }
      }

      // Second 401 or refresh failure
      await useAuthStore.getState().logout();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.replace('/login');
      }
    }

    return Promise.reject(error);
  }
);

export default api;
