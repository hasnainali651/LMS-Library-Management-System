'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Plus,
  Edit2,
  Trash2,
  Building2,
  Bell,
  Shield,
  CreditCard,
  Check,
  X,
  AlertTriangle,
  GraduationCap,
  Users,
  BookOpen,
  Clock,
  Info,
  Calendar,
  Send,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useStateDraft } from '@/hooks/useFormDraft';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MembershipType {
  _id: string;
  name: string;
  displayName: string;
  maxBooks: number;
  loanDays: number;
  renewalLimit: number;
  finePerDay: number;
  maxFinePerBook: number;
  maxFineBalance: number;
  canBorrowReference: boolean;
  isActive?: boolean;
}

interface PublicLibrarySettings {
  libraryName: string;
  address: string;
  contact: string;
  hours: string;
}

type TabId = 'membership' | 'library' | 'fines' | 'notifications';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'membership', label: 'Membership Types', icon: <GraduationCap className="w-4 h-4" /> },
  { id: 'library', label: 'Library Info', icon: <Building2 className="w-4 h-4" /> },
  { id: 'fines', label: 'Fine Policies', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'notifications', label: 'Notification Schedules', icon: <Bell className="w-4 h-4" /> },
];

const EMPTY_MTYPE: Omit<MembershipType, '_id'> = {
  name: '',
  displayName: '',
  maxBooks: 5,
  loanDays: 14,
  renewalLimit: 2,
  finePerDay: 5,
  maxFinePerBook: 500,
  maxFineBalance: 2000,
  canBorrowReference: false,
};

// ─── Main Settings Page ────────────────────────────────────────────────────────
export default function SettingsPage() {
  const userId = useAuthStore((state) => state.user?._id);
  return <SettingsForms key={userId ?? 'signed-out'} />;
}

function SettingsForms() {
  const [activeTab, setActiveTab] = useState<TabId>('membership');

  // ── Membership Types ────────────────────────────────────────
  const [mTypes, setMTypes] = useState<MembershipType[]>([]);
  const [mLoading, setMLoading] = useState(true);
  const [mTypeModal, setMTypeModal] = useState(false);
  const [editingMType, setEditingMType] = useState<MembershipType | null>(null);
  const [mTypeForm, setMTypeForm] = useState(EMPTY_MTYPE);
  const [savingMType, setSavingMType] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MembershipType | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Library Info (Read-only Public Settings) ────────────────
  const [libraryInfo, setLibraryInfo] = useState<PublicLibrarySettings>({
    libraryName: '',
    address: '',
    contact: '',
    hours: '',
  });
  const [libraryLoading, setLibraryLoading] = useState(true);

  const membershipDraft = useStateDraft({
    formId: 'settings-membership',
    entityId: editingMType?._id,
    enabled: mTypeModal,
    label: editingMType ? `Membership: ${editingMType.displayName}` : 'New membership type',
    fields: ['name', 'displayName', 'maxBooks', 'loanDays', 'renewalLimit', 'finePerDay', 'maxFinePerBook', 'maxFineBalance', 'canBorrowReference'],
    values: mTypeForm,
    onRestore: (draft) => setMTypeForm((current) => ({ ...current, ...draft })),
  });

  // ── Fetch Membership Types ─────────────────────────────────
  const fetchMTypes = async () => {
    setMLoading(true);
    try {
      const res = await api.get('/membership-types');
      const raw = res.data?.data || res.data;
      setMTypes(Array.isArray(raw) ? raw : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load membership policies');
      setMTypes([]);
    } finally {
      setMLoading(false);
    }
  };

  // ── Fetch Public Library Info ──────────────────────────────
  const fetchLibraryInfo = async () => {
    setLibraryLoading(true);
    try {
      const res = await api.get('/settings/public');
      const data = res.data?.data || res.data;
      if (data) {
        setLibraryInfo({
          libraryName: data.libraryName || 'Library Management System',
          address: data.address || '',
          contact: data.contact || '',
          hours: data.hours || '',
        });
      }
    } catch {
      // Non-blocking
    } finally {
      setLibraryLoading(false);
    }
  };

  useEffect(() => {
    fetchMTypes();
    fetchLibraryInfo();
  }, []);

  // ── Membership CRUD ────────────────────────────────────────
  const openAddModal = () => {
    setEditingMType(null);
    setMTypeForm(EMPTY_MTYPE);
    setMTypeModal(true);
  };

  const openEditModal = (mt: MembershipType) => {
    setEditingMType(mt);
    setMTypeForm({
      name: mt.name,
      displayName: mt.displayName,
      maxBooks: mt.maxBooks,
      loanDays: mt.loanDays,
      renewalLimit: mt.renewalLimit,
      finePerDay: mt.finePerDay,
      maxFinePerBook: mt.maxFinePerBook ?? 500,
      maxFineBalance: mt.maxFineBalance ?? 2000,
      canBorrowReference: mt.canBorrowReference ?? false,
    });
    setMTypeModal(true);
  };

  const handleSaveMType = async () => {
    if (!mTypeForm.displayName.trim() || !mTypeForm.name.trim()) {
      toast.error('Name and display name are required');
      return;
    }
    setSavingMType(true);
    try {
      if (editingMType) {
        await api.put(`/membership-types/${editingMType._id}`, mTypeForm);
        setMTypes((prev) => prev.map((m) => (m._id === editingMType._id ? { ...m, ...mTypeForm } : m)));
        toast.success('Membership policy updated');
      } else {
        const res = await api.post('/membership-types', mTypeForm);
        const created = res.data?.data || res.data;
        setMTypes((prev) => [...prev, created]);
        toast.success('Membership policy created');
      }
      membershipDraft.clearDraft();
      setMTypeModal(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save membership policy');
    } finally {
      setSavingMType(false);
    }
  };

  const handleDeleteMType = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/membership-types/${deleteTarget._id}`);
      setMTypes((prev) => prev.filter((m) => m._id !== deleteTarget._id));
      toast.success('Membership policy deleted');
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete membership policy');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          System Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Review membership borrowing policies, deployment-managed library details, fine caps, and notification jobs.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] shadow-[var(--neo-inset-sm)] flex-wrap max-w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── MEMBERSHIP TYPES TAB ─────────────────────────────── */}
      {activeTab === 'membership' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">
              {mTypes.length} membership polic{mTypes.length !== 1 ? 'ies' : 'y'} configured
            </p>
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />} onClick={openAddModal}>
              Add Policy
            </Button>
          </div>

          {mLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
            </div>
          ) : mTypes.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
              <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">No membership policies found.</p>
              <Button variant="secondary" size="sm" className="mt-3" onClick={openAddModal}>
                Create Initial Policy
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              <AnimatePresence>
                {mTypes.map((mt) => (
                  <motion.div
                    key={mt._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-4"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/60 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-5 h-5 text-primary-700 dark:text-primary-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">{mt.displayName}</p>
                            <span className="font-mono text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded">
                              {mt.name}
                            </span>
                            {mt.isActive === false && (
                              <Badge color="gray" className="text-[10px]">Inactive</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-300">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> {mt.maxBooks} books quota
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> {mt.loanDays} day loan period
                            </span>
                            <span className="flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> {mt.renewalLimit} renewals allowed
                            </span>
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> PKR {mt.finePerDay}/day fine
                            </span>
                            <span>Max cap: PKR {mt.maxFinePerBook ?? 500}</span>
                            <span className={mt.canBorrowReference ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-400'}>
                              {mt.canBorrowReference ? '✓ Reference allowed' : '✗ Standard only'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => openEditModal(mt)}
                          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors"
                          title="Edit policy"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(mt)}
                          className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete policy"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ── LIBRARY INFO TAB ─────────────────────────────────── */}
      {activeTab === 'library' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/40 text-xs text-sky-800 dark:text-sky-300">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Deployment-Managed Configuration</p>
              <p className="text-sky-700 dark:text-sky-400">
                Library metadata, system hours, and contact details are managed via server deployment environment variables (e.g., <code>LIBRARY_NAME</code>, <code>LIBRARY_ADDRESS</code>, <code>LIBRARY_HOURS</code>, <code>LIBRARY_TIMEZONE</code>). To update these parameters, modify the server configuration and restart the container stack.
              </p>
            </div>
          </div>

          {libraryLoading ? (
            <Skeleton className="h-48 w-full rounded-2xl" />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Library Identity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Institution Name</label>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{libraryInfo.libraryName || 'Not configured'}</p>
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Physical Address</label>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{libraryInfo.address || 'Not configured'}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Operating Hours & Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Opening Hours</label>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{libraryInfo.hours || 'Standard Academic Hours'}</p>
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 font-semibold block mb-1">Contact Reference</label>
                    <p className="font-medium text-slate-900 dark:text-slate-100">{libraryInfo.contact || 'Not configured'}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── FINE POLICIES TAB ────────────────────────────────── */}
      {activeTab === 'fines' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-primary-50 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800/40 text-xs text-primary-800 dark:text-primary-300">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Policy-Based Overdue Calculations</p>
              <p className="text-primary-700 dark:text-primary-400">
                In this system, fine rates, maximum caps per book, and balance suspension thresholds are defined on each <strong>Membership Type</strong>. When a transaction is issued, terms are snapshotted permanently to ensure consistent assessment.
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Active Rules Across Membership Policies</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {mTypes.map((mt) => (
                  <div key={mt._id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{mt.displayName}</p>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">Rate: PKR {mt.finePerDay} per overdue day</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-800 dark:text-slate-200">Max PKR {mt.maxFinePerBook ?? 500} / book</p>
                      <p className="text-slate-600 dark:text-slate-400 text-[11px] font-medium">Block at PKR {mt.maxFineBalance ?? 2000}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── NOTIFICATION SCHEDULES TAB ───────────────────────── */}
      {activeTab === 'notifications' && (
        <div className="space-y-5">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-800 dark:text-amber-300">
            <Clock className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold mb-0.5">Scheduled Background Cron Jobs</p>
              <p className="text-amber-700 dark:text-amber-400">
                Notification delivery and automated circulation maintenance run reliably on the server using Node-Cron, Redis distributed locking, and Bull exponential backoff.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Patron Reminders</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Due Date Reminders</span>
                    <Badge color="purple">08:00 Daily</Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Dispatches notices 3 days and 1 day prior to due date.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Overdue Assessments</span>
                    <Badge color="purple">09:00 Daily</Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Computes daily accrued overdue delta and notifies borrower.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Escalation & Suspension</span>
                    <Badge color="purple">10:00 Daily</Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Blocks borrowing when loans exceed 14 elapsed days overdue.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-sm">Lifecycle & Reports</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Hold Expiry Handoff</span>
                    <Badge color="blue">Every 30m</Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Releases expired uncollected holds to the next queue patron.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Membership Expiry</span>
                    <Badge color="purple">23:00 Daily</Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Warns patrons 30 days and 7 days prior to card expiration.</p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-850">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">Weekly Library Report</span>
                    <Badge color="green">Mon 07:00</Badge>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-[11px] font-medium">Compiles loans, payments, and popular titles for administrators.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── MEMBERSHIP TYPE MODAL ─────────────────────────────── */}
      <Modal
        open={mTypeModal}
        onOpenChange={setMTypeModal}
        title={editingMType ? `Edit Policy: ${editingMType.displayName}` : 'Create Membership Policy'}
        description="Define borrowing limits, duration, and penalty terms for this patron policy."
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setMTypeModal(false)} disabled={savingMType}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveMType} isLoading={savingMType} leftIcon={<Check className="w-4 h-4" />}>
              {editingMType ? 'Save Policy' : 'Create Policy'}
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Policy Identifier (e.g. faculty)"
              value={mTypeForm.name}
              onChange={(e) => setMTypeForm((p) => ({ ...p, name: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
              placeholder="faculty"
            />
            <Input
              label="Display Name"
              value={mTypeForm.displayName}
              onChange={(e) => setMTypeForm((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="Faculty Member"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Borrow Quota"
              type="number"
              min={1}
              value={mTypeForm.maxBooks}
              onChange={(e) => setMTypeForm((p) => ({ ...p, maxBooks: +e.target.value }))}
            />
            <Input
              label="Loan Period (Days)"
              type="number"
              min={1}
              value={mTypeForm.loanDays}
              onChange={(e) => setMTypeForm((p) => ({ ...p, loanDays: +e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Renewal Limit"
              type="number"
              min={0}
              value={mTypeForm.renewalLimit}
              onChange={(e) => setMTypeForm((p) => ({ ...p, renewalLimit: +e.target.value }))}
            />
            <Input
              label="Fine Per Day (PKR)"
              type="number"
              min={0}
              step={0.5}
              value={mTypeForm.finePerDay}
              onChange={(e) => setMTypeForm((p) => ({ ...p, finePerDay: +e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Max Fine Cap Per Book (PKR)"
              type="number"
              min={0}
              step={50}
              value={mTypeForm.maxFinePerBook}
              onChange={(e) => setMTypeForm((p) => ({ ...p, maxFinePerBook: +e.target.value }))}
            />
            <Input
              label="Account Fine Threshold (PKR)"
              type="number"
              min={0}
              step={100}
              value={mTypeForm.maxFineBalance}
              onChange={(e) => setMTypeForm((p) => ({ ...p, maxFineBalance: +e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-3 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={mTypeForm.canBorrowReference}
              onChange={(e) => setMTypeForm((p) => ({ ...p, canBorrowReference: e.target.checked }))}
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-600"
            />
            <span className="text-slate-700 dark:text-slate-300">Allow borrowing reference collection titles</span>
          </label>
        </div>
      </Modal>

      {/* ── DELETE CONFIRM MODAL ──────────────────────────────── */}
      <Modal
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Membership Policy"
        description="Are you sure you want to remove this policy? Active loans will preserve their issued terms."
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeleteMType}
              isLoading={deleting}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm Delete
            </Button>
          </>
        }
      >
        {deleteTarget && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-400">
              Delete policy: <strong>{deleteTarget.displayName}</strong> (<code>{deleteTarget.name}</code>)
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
