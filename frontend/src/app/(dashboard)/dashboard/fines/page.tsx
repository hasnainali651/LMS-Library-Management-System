'use client';

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  AlertCircle,
  CheckCircle2,
  Download,
  Search,
  CreditCard,
  Banknote,
  X,
  Check,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useStateDraft } from '@/hooks/useFormDraft';
import { useAuthStore } from '@/store/authStore';
import { Table, Column } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/StatCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FineRecord {
  _id: string;
  member?: { _id?: string; name?: string; email?: string; memberId?: string };
  memberName?: string;
  memberId?: string;
  book?: { _id?: string; title?: string };
  bookTitle?: string;
  type: 'overdue' | 'damage' | 'loss' | string;
  amount: number;
  paidAmount?: number;
  status: 'pending' | 'paid' | 'waived' | 'partial' | string;
  createdAt: string;
  paidAt?: string;
  daysOverdue?: number;
}

type StatusFilter = 'all' | 'pending' | 'paid' | 'waived' | 'partial';
type PaymentMethod = 'cash' | 'online';

// ─── Badges ───────────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: 'amber', label: 'Pending' },
    paid: { color: 'green', label: 'Paid' },
    waived: { color: 'sky', label: 'Waived' },
    partial: { color: 'purple', label: 'Partial' },
  };
  const cfg = map[status] ?? { color: 'gray', label: status };
  return <Badge color={cfg.color as any}>{cfg.label}</Badge>;
};

const TypeBadge: React.FC<{ type: string }> = ({ type }) => {
  const map: Record<string, string> = { overdue: 'rose', damage: 'orange', loss: 'rose' };
  return <Badge color={(map[type] ?? 'gray') as any}>{type.charAt(0).toUpperCase() + type.slice(1)}</Badge>;
};

// ─── CSV ──────────────────────────────────────────────────────────────────────
function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) { toast.error('No data to export'); return; }
  const keys = Object.keys(data[0]);
  const rows = [keys.join(','), ...data.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
  toast.success('CSV exported');
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AdminFinesPage() {
  const userId = useAuthStore((state) => state.user?._id);
  return <AdminFinesContent key={userId} />;
}

function AdminFinesContent() {
  const [fines, setFines] = useState<FineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Collect modal
  const [collectModal, setCollectModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [collecting, setCollecting] = useState(false);

  // Waive modal
  const [waiveTarget, setWaiveTarget] = useState<FineRecord | null>(null);
  const [waiveReason, setWaiveReason] = useState('');
  const [waiving, setWaiving] = useState(false);

  const { clearDraft: clearCollectionDraft } = useStateDraft({
    formId: 'fine-collection', entityId: JSON.stringify(Array.from(selectedIds).sort()),
    enabled: collectModal && selectedIds.size > 0, label: 'Fine collection',
    fields: ['paymentAmount', 'paymentMethod'], values: { paymentAmount, paymentMethod },
    onRestore: (draft) => {
      if (draft.paymentAmount !== undefined) setPaymentAmount(draft.paymentAmount);
      if (draft.paymentMethod !== undefined) setPaymentMethod(draft.paymentMethod);
    },
  });
  const { clearDraft: clearWaiverDraft } = useStateDraft({
    formId: 'fine-waiver', entityId: waiveTarget?._id, enabled: !!waiveTarget, label: 'Fine waiver justification',
    fields: ['waiveReason'], values: { waiveReason },
    onRestore: (draft) => {
      if (draft.waiveReason !== undefined) setWaiveReason(draft.waiveReason);
    },
  });

  // ── Fetch ──────────────────────────────────────────────────
  const fetchFines = async () => {
    setLoading(true);
    try {
      const res = await api.get('/fines');
      const data = res.data?.data;
      const raw = Array.isArray(data) ? data : (data?.docs || []);
      setFines(raw.map((f: any) => ({
        _id: f._id,
        member: f.member ?? f.patron,
        bookTitle: f.transaction?.book?.title ?? f.loan?.book?.title ?? f.book?.title ?? f.bookTitle ?? 'Library Loan',
        type: f.type ?? 'overdue',
        amount: f.amount ?? 0,
        paidAmount: f.paidAmount ?? 0,
        status: f.status ?? 'pending',
        createdAt: f.createdAt,
        paidAt: f.payments?.[f.payments.length - 1]?.paidAt || f.paidAt,
        daysOverdue: f.assessments?.[f.assessments.length - 1]?.overdueDays ?? f.daysOverdue,
      })));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load fine records');
      setFines([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFines(); }, []);

  // ── Filtering ──────────────────────────────────────────────
  const filtered = fines.filter((f) => {
    const name = f.member?.name ?? f.memberName ?? '';
    const mId = f.member?.memberId ?? f.memberId ?? '';
    const book = f.bookTitle ?? f.book?.title ?? '';
    const q = search.toLowerCase();
    const matchSearch = !q || name.toLowerCase().includes(q) || mId.toLowerCase().includes(q) || book.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || f.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Selection ──────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const selectAllPending = () => {
    setSelectedIds(new Set(filtered.filter((f) => f.status === 'pending' || f.status === 'partial').map((f) => f._id)));
  };
  const clearSelection = () => setSelectedIds(new Set());

  const selectedFines = fines.filter((f) => selectedIds.has(f._id));
  const selectedTotal = selectedFines.reduce((sum, f) => sum + (f.amount - (f.paidAmount ?? 0)), 0);

  // ── Collect ────────────────────────────────────────────────
  const handleCollect = async () => {
    if (selectedIds.size === 0) { toast.error('Select at least one fine'); return; }
    const amt = parseFloat(paymentAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    setCollecting(true);
    try {
      const res = await api.post('/fines/collect', { fineIds: Array.from(selectedIds), amount: amt, paymentMethod });
      clearCollectionDraft();
      const receipt = res.data?.data;
      toast.success(res.data?.message || `PKR ${amt.toFixed(0)} collected. Receipt #${receipt?.receiptNumber || 'generated'}`);
      await fetchFines();
      setSelectedIds(new Set());
      setCollectModal(false);
      setPaymentAmount('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Collection failed');
    } finally {
      setCollecting(false);
    }
  };

  // ── Waive ──────────────────────────────────────────────────
  const handleWaive = async () => {
    if (!waiveTarget) return;
    if (waiveReason.trim().length < 20) { toast.error('Justification must be at least 20 characters'); return; }
    setWaiving(true);
    try {
      await api.post('/fines/waive', { fineId: waiveTarget._id, reason: waiveReason });
      clearWaiverDraft();
      setFines((prev) => prev.map((f) => f._id === waiveTarget._id ? { ...f, status: 'waived' } : f));
      toast.success(`Fine waived for ${waiveTarget.member?.name ?? 'patron'}`);
      setWaiveTarget(null);
      setWaiveReason('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Waiver failed');
    } finally {
      setWaiving(false);
    }
  };

  // ── CSV Export ─────────────────────────────────────────────
  const handleExport = () => {
    downloadCSV(filtered.map((f) => ({
      'Patron Name': f.member?.name ?? f.memberName ?? '',
      'Member ID': f.member?.memberId ?? f.memberId ?? '',
      'Book Title': f.bookTitle ?? '',
      'Type': f.type,
      'Amount (PKR)': f.amount,
      'Paid (PKR)': f.paidAmount ?? 0,
      'Outstanding (PKR)': f.amount - (f.paidAmount ?? 0),
      'Status': f.status,
      'Date': f.createdAt ? format(parseISO(f.createdAt), 'yyyy-MM-dd') : '',
      'Paid At': f.paidAt ? format(parseISO(f.paidAt), 'yyyy-MM-dd') : '',
    })), `fines-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  // ── Stats ──────────────────────────────────────────────────
  const totalPending = fines.filter((f) => f.status === 'pending' || f.status === 'partial').reduce((s, f) => s + f.amount - (f.paidAmount ?? 0), 0);
  const totalCollected = fines.filter((f) => f.status === 'paid' || f.status === 'partial').reduce((s, f) => s + (f.paidAmount ?? 0), 0);
  const totalWaived = fines.filter((f) => f.status === 'waived').reduce((s, f) => s + f.amount, 0);

  // ── Table Columns ──────────────────────────────────────────
  const columns: Column<FineRecord>[] = [
    {
      key: 'select' as any,
      header: (
        <button
          onClick={selectedIds.size > 0 ? clearSelection : selectAllPending}
          className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center bg-white dark:bg-slate-900 hover:border-primary-500 transition-colors"
        >
          {selectedIds.size > 0 && <Check className="w-2.5 h-2.5 text-primary-600" />}
        </button>
      ) as any,
      render: (f) => {
        const selectable = f.status === 'pending' || f.status === 'partial';
        return (
          <button
            onClick={() => selectable && toggleSelect(f._id)}
            disabled={!selectable}
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              selectable
                ? selectedIds.has(f._id)
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 hover:border-primary-500'
                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-40 cursor-not-allowed'
            }`}
          >
            {selectedIds.has(f._id) && <Check className="w-2.5 h-2.5" />}
          </button>
        );
      },
    },
    {
      key: 'member',
      header: 'Patron',
      sortable: true,
      render: (f) => (
        <div className="min-w-0">
          <p className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">{f.member?.name ?? f.memberName ?? 'Unknown'}</p>
          <p className="text-[11px] text-slate-600 dark:text-slate-400 font-mono font-medium">{f.member?.memberId ?? f.memberId ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'bookTitle',
      header: 'Book',
      render: (f) => (
        <span className="text-xs text-slate-600 dark:text-slate-300 max-w-[160px] truncate block">
          {f.bookTitle ?? f.book?.title ?? '—'}
        </span>
      ),
    },
    { key: 'type', header: 'Type', render: (f) => <TypeBadge type={f.type} /> },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (f) => (
        <div>
          <p className="font-bold tabular-nums text-xs text-slate-900 dark:text-slate-100">PKR {f.amount}</p>
          {(f.paidAmount ?? 0) > 0 && f.status !== 'paid' && (
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 tabular-nums">Paid: {f.paidAmount}</p>
          )}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (f) => <StatusBadge status={f.status} /> },
    {
      key: 'createdAt',
      header: 'Date',
      sortable: true,
      render: (f) => (
        <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400 font-medium">
          {f.createdAt ? format(parseISO(f.createdAt), 'MMM d, yy') : '—'}
        </span>
      ),
    },
    {
      key: 'actions' as any,
      header: 'Actions',
      className: 'text-right',
      render: (f) => (
        <div className="flex items-center justify-end gap-1">
          {(f.status === 'pending' || f.status === 'partial') && (
            <>
              <button
                onClick={() => {
                  setSelectedIds(new Set([f._id]));
                  setPaymentAmount(String(f.amount - (f.paidAmount ?? 0)));
                  setPaymentMethod('cash');
                  setCollectModal(true);
                }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950 transition-colors"
              >
                Collect
              </button>
              <button
                onClick={() => { setWaiveTarget(f); setWaiveReason(''); }}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-950 transition-colors"
              >
                Waive
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `All (${fines.length})` },
    { key: 'pending', label: `Pending (${fines.filter(f => f.status === 'pending').length})` },
    { key: 'partial', label: `Partial (${fines.filter(f => f.status === 'partial').length})` },
    { key: 'paid', label: `Paid (${fines.filter(f => f.status === 'paid').length})` },
    { key: 'waived', label: `Waived (${fines.filter(f => f.status === 'waived').length})` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Fine Management</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Collect payments, waive fines, and export records across all patrons.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>Export CSV</Button>
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={fetchFines}>Refresh</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard number={`PKR ${totalPending.toLocaleString()}`} label="Outstanding" icon={AlertCircle} color="rose" />
        <StatCard number={`PKR ${totalCollected.toLocaleString()}`} label="Collected" icon={CheckCircle2} color="emerald" />
        <StatCard number={`PKR ${totalWaived.toLocaleString()}`} label="Waived" icon={Receipt} color="sky" />
      </div>

      {/* Bulk bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary-700 text-white shadow-lg shadow-primary-700/20"
          >
            <span className="text-sm font-semibold">{selectedIds.size} selected</span>
            <span className="text-primary-300 text-xs">· PKR {selectedTotal.toFixed(0)} outstanding</span>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-0"
              leftIcon={<CreditCard className="w-3.5 h-3.5" />}
              onClick={() => { setPaymentAmount(String(Math.round(selectedTotal))); setPaymentMethod('cash'); setCollectModal(true); }}
            >
              Collect Payment
            </Button>
            <button onClick={clearSelection} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 sm:max-w-xs">
          <Input placeholder="Search patron, ID, book..." value={search} onChange={(e) => setSearch(e.target.value)} leftIcon={<Search className="w-4 h-4" />} />
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl overflow-x-auto flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                statusFilter === tab.key
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {filtered.some((f) => f.status === 'pending' || f.status === 'partial') && (
          <Button variant="ghost" size="sm" onClick={selectAllPending} className="whitespace-nowrap">Select All Pending</Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="w-10 h-10 text-slate-300" />} title="No fines found" description="Adjust filters to find fine records." />
      ) : (
        <Table columns={columns} data={filtered} />
      )}

      {/* ── COLLECT MODAL ─────────────────────────────────────── */}
      <Modal
        open={collectModal}
        onOpenChange={(open) => !open && setCollectModal(false)}
        title="Collect Fine Payment"
        description={`${selectedIds.size} fine${selectedIds.size !== 1 ? 's' : ''} · PKR ${selectedTotal.toFixed(0)} outstanding`}
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCollectModal(false)} disabled={collecting}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={handleCollect} isLoading={collecting} leftIcon={<Check className="w-4 h-4" />}>
              Confirm Collection
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          {selectedFines.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden max-h-36 overflow-y-auto">
              {selectedFines.map((f) => (
                <div key={f._id} className="flex items-center justify-between px-3 py-2 text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{f.member?.name ?? 'Patron'}</span>
                  <span className="font-bold tabular-nums text-slate-700 dark:text-slate-300">
                    PKR {(f.amount - (f.paidAmount ?? 0)).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Input
            label="Payment Amount (PKR)"
            type="number"
            min={0.01}
            step={0.01}
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="Enter amount"
          />
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300 block">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'online'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border font-medium transition-all ${
                    paymentMethod === m
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-400 dark:border-primary-700'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  {m === 'cash' ? <Banknote className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── WAIVE MODAL ───────────────────────────────────────── */}
      <Modal
        open={!!waiveTarget}
        onOpenChange={(open) => !open && setWaiveTarget(null)}
        title="Waive Fine"
        description="Admin waiver requires a justification of at least 20 characters. This is logged to the Audit Log."
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setWaiveTarget(null)} disabled={waiving}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleWaive}
              isLoading={waiving}
              disabled={waiveReason.trim().length < 20}
            >
              Confirm Waiver
            </Button>
          </>
        }
      >
        {waiveTarget && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1">
              <p className="text-slate-400">Patron: <strong className="text-slate-800 dark:text-slate-200">{waiveTarget.member?.name ?? 'Unknown'}</strong></p>
              <p className="text-slate-400">Book: <strong className="text-slate-800 dark:text-slate-200">{waiveTarget.bookTitle ?? '—'}</strong></p>
              <p className="text-slate-400">Amount: <strong className="text-rose-600 dark:text-rose-400 tabular-nums">PKR {waiveTarget.amount}</strong></p>
            </div>
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Justification
                <span className={`ml-2 text-[10px] font-normal ${waiveReason.trim().length >= 20 ? 'text-emerald-500' : 'text-rose-400'}`}>
                  ({waiveReason.trim().length}/20 min)
                </span>
              </label>
              <textarea
                rows={4}
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="Documented medical emergency, system error causing incorrect fine calculation, etc."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-600 resize-none"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
