export type BookStatus = 'available' | 'issued' | 'reserved' | 'lost' | 'damaged' | 'retired';
export type UserRole = 'student' | 'librarian' | 'admin';
export type MembershipType = 'student' | 'faculty' | 'staff' | 'public';

export const STATUS_COLORS: Record<BookStatus, string> = {
  available: 'green',
  issued: 'blue',
  reserved: 'amber',
  lost: 'red',
  damaged: 'orange',
  retired: 'gray',
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Member',
  librarian: 'Librarian',
  admin: 'Administrator',
} as const;

export const MEMBERSHIP_COLORS: Record<MembershipType, string> = {
  student: 'blue',
  faculty: 'purple',
  staff: 'orange',
  public: 'green',
} as const;

export const STATUS_STYLES: Record<
  BookStatus,
  {
    bg: string;
    text: string;
    border: string;
    badge: string;
    dot: string;
  }
> = {
  available: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  issued: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-700 dark:text-sky-400',
    border: 'border-sky-200 dark:border-sky-800/60',
    badge: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/60',
    dot: 'bg-sky-500',
  },
  reserved: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800/60',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },
  lost: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800/60',
    badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },
  damaged: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800/60',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60',
    dot: 'bg-orange-500',
  },
  retired: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-700 dark:text-slate-400',
    border: 'border-slate-300 dark:border-slate-700',
    badge: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
};

export const MEMBERSHIP_STYLES: Record<
  MembershipType,
  {
    bg: string;
    text: string;
    border: string;
    badge: string;
  }
> = {
  student: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800/60',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60',
  },
  faculty: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800/60',
    badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800/60',
  },
  staff: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-700 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800/60',
    badge: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800/60',
  },
  public: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
  },
};
