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
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
    dot: 'bg-emerald-500',
  },
  issued: {
    bg: 'bg-sky-50 dark:bg-sky-950/40',
    text: 'text-sky-800 dark:text-sky-300',
    border: 'border-sky-200 dark:border-sky-800/60',
    badge: 'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60',
    dot: 'bg-sky-500',
  },
  reserved: {
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800/60',
    badge: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60',
    dot: 'bg-amber-500',
  },
  lost: {
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800/60',
    badge: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60',
    dot: 'bg-rose-500',
  },
  damaged: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800/60',
    badge: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',
    dot: 'bg-orange-500',
  },
  retired: {
    bg: 'bg-slate-100 dark:bg-slate-800/60',
    text: 'text-slate-800 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    badge: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
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
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800/60',
    badge: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/60',
  },
  faculty: {
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-800 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800/60',
    badge: 'bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/60',
  },
  staff: {
    bg: 'bg-orange-50 dark:bg-orange-950/40',
    text: 'text-orange-800 dark:text-orange-300',
    border: 'border-orange-200 dark:border-orange-800/60',
    badge: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60',
  },
  public: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-800 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60',
  },
};
