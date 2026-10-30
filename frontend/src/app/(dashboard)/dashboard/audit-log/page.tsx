'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  Search,
  Calendar,
  ChevronDown,
  ExternalLink,
  Filter,
  RefreshCw,
  User,
  Book,
  Lock,
  ArrowLeftRight,
  Settings,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, subDays, startOfDay } from 'date-fns';
import { api } from '@/lib/api';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Pagination } from '@/components/ui/Pagination';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuditEntry {
  _id: string;
  action: string;
  target?: string;
  targetModel?: string;
  performedBy?: {
    _id?: string;
    name?: string;
    email?: string;
  } | string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  changes?: Record<string, unknown>;
  timestamp?: string;
  createdAt?: string;
}

type ActionCategory = 'all' | 'auth' | 'circulation' | 'books' | 'admin' | 'fines';

const ACTION_CATEGORIES: Record<ActionCategory, string[]> = {
  all: [],
  auth: ['USER_LOGIN', 'USER_LOGOUT', 'USER_REGISTER', 'CHANGE_PASSWORD', 'RESET_PASSWORD', 'FORGOT_PASSWORD', 'VERIFY_EMAIL'],
  circulation: ['BOOK_ISSUE', 'BOOK_RETURN', 'LOAN_RENEW', 'CIRCULATION_ISSUE', 'CIRCULATION_RETURN'],
  books: ['CREATE_BOOK', 'UPDATE_BOOK', 'DELETE_BOOK', 'CREATE_COPY', 'UPDATE_COPY'],
  admin: ['UPDATE_PROFILE', 'CREATE_MEMBERSHIP_TYPE', 'UPDATE_MEMBERSHIP_TYPE', 'DELETE_MEMBERSHIP_TYPE', 'POLICY_UPDATE'],
  fines: ['COLLECT_FINE', 'WAIVE_FINE', 'FINE_AUTO'],
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  USER_LOGIN: <User className="w-3 h-3" />,
  USER_LOGOUT: <User className="w-3 h-3" />,
  USER_REGISTER: <User className="w-3 h-3" />,
  CHANGE_PASSWORD: <Lock className="w-3 h-3" />,
  RESET_PASSWORD: <Lock className="w-3 h-3" />,
  FORGOT_PASSWORD: <Lock className="w-3 h-3" />,
  BOOK_ISSUE: <ArrowLeftRight className="w-3 h-3" />,
  BOOK_RETURN: <ArrowLeftRight className="w-3 h-3" />,
  LOAN_RENEW: <ArrowLeftRight className="w-3 h-3" />,
  CREATE_BOOK: <Book className="w-3 h-3" />,
  UPDATE_BOOK: <Book className="w-3 h-3" />,
  DELETE_BOOK: <AlertCircle className="w-3 h-3" />,
  COLLECT_FINE: <ArrowLeftRight className="w-3 h-3" />,
  WAIVE_FINE: <ArrowLeftRight className="w-3 h-3" />,
  POLICY_UPDATE: <Settings className="w-3 h-3" />,
};

const ACTION_COLORS: Record<string, string> = {
  USER_LOGIN: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400',
  USER_LOGOUT: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  USER_REGISTER: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  CHANGE_PASSWORD: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  RESET_PASSWORD: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  BOOK_ISSUE: 'bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-400',
  BOOK_RETURN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  LOAN_RENEW: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-400',
  CREATE_BOOK: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  UPDATE_BOOK: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  DELETE_BOOK: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400',
  COLLECT_FINE: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400',
  WAIVE_FINE: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400',
  POLICY_UPDATE: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400',
};

const DATE_PRESETS = [
  { label: 'Today', value: 'today' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'All time', value: 'all' },
];

const DiffView: React.FC<{ before?: Record<string, unknown>; after?: Record<string, unknown>; changes?: Record<string, unknown> }> = ({ before, after, changes }) => {
  const diffData = changes && Object.keys(changes).length > 0 ? changes : after;
  if (!diffData || Object.keys(diffData).length === 0) {
    return <p className="text-slate-600 dark:text-slate-400 text-xs font-medium">No change metadata recorded for this action.</p>;
  }

  return (
    <div className="space-y-2 text-[11px]">
      {Object.entries(diffData).map(([key, value]) => (
        <div key={key} className="rounded-lg p-2 bg-slate-50 dark:bg-slate-800/40">
          <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{key}:</span>
          <span className="font-mono ml-2 text-slate-800 dark:text-slate-200">
            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<ActionCategory>('all');
  const [datePreset, setDatePreset] = useState('all');
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', page, limit, search, category],
    queryFn: async () => {
      const res = await api.get('/audit-logs', {
        params: {
          page,
          limit,
          search: search || undefined,
        },
      });
      return res.data;
    },
  });

  const rawDocs = data?.data?.docs ?? (Array.isArray(data?.data) ? data?.data : []);
  const totalDocs = data?.data?.totalDocs ?? rawDocs.length;
  const totalPages = data?.data?.totalPages ?? Math.max(1, Math.ceil(totalDocs / limit));

  // Client category & date filtering if needed on current page
  const filtered = rawDocs.filter((l: any) => {
    const catActions = ACTION_CATEGORIES[category];
    const matchCat = category === 'all' || catActions.some((a) => (l.action || '').toUpperCase().includes(a));

    let matchDate = true;
    const tsStr = l.createdAt || l.timestamp;
    if (datePreset !== 'all' && tsStr) {
      const ts = parseISO(tsStr);
      const now = new Date();
      if (datePreset === 'today') matchDate = ts >= startOfDay(now);
      else if (datePreset === '7d') matchDate = ts >= subDays(now, 7);
      else if (datePreset === '30d') matchDate = ts >= subDays(now, 30);
    }
    return matchCat && matchDate;
  });

  const columns: Column<AuditEntry>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      sortable: true,
      render: (l) => {
        const timeStr = l.createdAt || l.timestamp;
        return (
          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
            {timeStr ? format(parseISO(timeStr), 'MMM d HH:mm:ss') : '—'}
          </span>
        );
      },
    },
    {
      key: 'performedBy',
      header: 'Performed By',
      render: (l) => {
        const actor = typeof l.performedBy === 'object' ? l.performedBy : {};
        return (
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
              {(actor as any)?.name ?? 'System'}
            </p>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate font-mono">
              {(actor as any)?.email ?? (typeof l.performedBy === 'string' ? l.performedBy : '')}
            </p>
          </div>
        );
      },
    },
    {
      key: 'action',
      header: 'Action',
      sortable: true,
      render: (l) => {
        const color = ACTION_COLORS[l.action] ?? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
        const icon = ACTION_ICONS[l.action] ?? <Info className="w-3 h-3" />;
        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium ${color}`}>
            {icon}
            {l.action}
          </span>
        );
      },
    },
    {
      key: 'target',
      header: 'Target / Model',
      render: (l) => (
        <span className="text-xs text-slate-700 dark:text-slate-300 max-w-[220px] truncate block font-medium">
          {l.targetModel ? `${l.targetModel} (${l.target || l._id.slice(-6)})` : l.target || '—'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      header: 'IP / Source',
      render: (l) => (
        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 tabular-nums whitespace-nowrap">
          {l.ipAddress || '—'}
        </span>
      ),
    },
    {
      key: 'details' as any,
      header: '',
      className: 'text-right',
      render: (l) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDetailEntry(l)}
          leftIcon={<ExternalLink className="w-3 h-3 text-slate-500 dark:text-slate-400" />}
          className="text-xs text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400"
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            System Audit Log
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
            Immutable, tamper-evident security audit trail tracking staff actions, role changes, and data mutations.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          onClick={() => refetch()}
        >
          Refresh Log
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search action, target, actor, or IP address..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as ActionCategory);
            setPage(1);
          }}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">All Action Categories</option>
          <option value="auth">Auth & Session</option>
          <option value="circulation">Circulation Desk</option>
          <option value="books">Book Catalog</option>
          <option value="fines">Fines & Penalties</option>
          <option value="admin">System Administration</option>
        </select>

        <select
          value={datePreset}
          onChange={(e) => {
            setDatePreset(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {DATE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Count */}
      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
        Showing <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{filtered.length}</span> of <span className="tabular-nums">{totalDocs}</span> events
      </p>

      {/* Table / Loading / Error */}
      {isLoading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-4 shadow-sm">
          <Skeleton variant="table" rows={6} cols={5} />
        </div>
      ) : isError ? (
        <ErrorState
          title="Could not load audit trail"
          message={(error as Error)?.message || 'Failed to fetch audit log entries.'}
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="w-10 h-10 text-slate-300" />}
          title="No audit events found"
          description="No security or mutation events match the current filter criteria."
        />
      ) : (
        <div className="space-y-4">
          <Table columns={columns} data={filtered} />
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-2">
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                Page {page} of {totalPages}
              </p>
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <Modal
        open={!!detailEntry}
        onOpenChange={(open) => !open && setDetailEntry(null)}
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-600" />
            Audit Event Detail
          </span>
        }
        description={detailEntry?.action}
        maxWidth="lg"
      >
        {detailEntry && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Timestamp</p>
                <p className="font-mono text-slate-800 dark:text-slate-200">
                  {detailEntry.createdAt || detailEntry.timestamp
                    ? format(parseISO(detailEntry.createdAt || detailEntry.timestamp!), 'PPpp')
                    : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">IP Address</p>
                <p className="font-mono text-slate-800 dark:text-slate-200">{detailEntry.ipAddress || 'N/A'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Performed By</p>
                <p className="text-slate-800 dark:text-slate-200">
                  {typeof detailEntry.performedBy === 'object'
                    ? `${detailEntry.performedBy?.name || 'User'} (${detailEntry.performedBy?.email || ''})`
                    : detailEntry.performedBy || 'System'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Target Model</p>
                <p className="text-slate-800 dark:text-slate-200">{detailEntry.targetModel || 'System'}</p>
              </div>
            </div>

            <div>
              <p className="text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[10px] mb-2">Recorded Changes / Payload</p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3 max-h-64 overflow-y-auto">
                <DiffView before={detailEntry.before} after={detailEntry.after} changes={detailEntry.changes} />
              </div>
            </div>

            <div className="flex items-start gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px]">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-500 dark:text-slate-400" />
              <p>Audit events are immutable and cannot be modified or deleted from this interface.</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
