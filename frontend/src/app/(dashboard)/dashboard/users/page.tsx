'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Shield,
  Edit2,
  UserCheck,
  UserX,
  Mail,
  Check,
  RefreshCw,
  AlertTriangle,
  KeyRound,
} from 'lucide-react';
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
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

interface StaffUser {
  _id: string;
  name: string;
  email: string;
  role: 'librarian' | 'admin';
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

type RoleOption = 'librarian' | 'admin';

interface DeliveryStatus {
  status?: string;
  message?: string;
}

const RoleBadge: React.FC<{ role: StaffUser['role'] }> = ({ role }) =>
  role === 'admin' ? <Badge color="purple">Admin</Badge> : <Badge color="blue">Librarian</Badge>;

const normalizeUser = (value: any): StaffUser => ({
  _id: value._id,
  name: value.name,
  email: value.email,
  role: value.role,
  isActive: value.isActive ?? true,
  createdAt: value.createdAt,
  lastLogin: value.lastLogin,
});

const deliveryToast = (delivery?: DeliveryStatus, fallback = 'Request accepted.') => {
  if (!delivery) {
    toast.success(fallback);
    return;
  }
  if (delivery.status === 'failed') {
    toast.error(delivery.message || 'The request completed, but delivery failed.');
    return;
  }
  if (delivery.status === 'pending' || delivery.status === 'queued') {
    toast.success(delivery.message || 'Email delivery has been queued.');
    return;
  }
  toast.success(fallback);
};

export default function UsersPage() {
  const userId = useAuthStore((state) => state.user?._id);
  return <UsersContent key={userId} />;
}

function UsersContent() {
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'librarian' as RoleOption,
    phone: '',
  });
  const [creating, setCreating] = useState(false);

  const [editTarget, setEditTarget] = useState<StaffUser | null>(null);
  const [editRole, setEditRole] = useState<RoleOption>('librarian');
  const [savingEdit, setSavingEdit] = useState(false);

  const [statusTarget, setStatusTarget] = useState<StaffUser | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [resetting, setResetting] = useState(false);

  const { clearDraft: clearCreateDraft } = useStateDraft({
    formId: 'staff-create',
    enabled: createModal,
    label: 'New staff account',
    fields: ['name', 'email', 'role', 'phone'],
    values: createForm,
    onRestore: (draft) => setCreateForm((current) => ({ ...current, ...draft })),
  });
  const { clearDraft: clearRoleDraft } = useStateDraft({
    formId: 'staff-role',
    entityId: editTarget?._id,
    enabled: !!editTarget,
    label: 'Staff role change',
    fields: ['editRole'],
    values: { editRole },
    onRestore: (draft) => {
      if (draft.editRole === 'admin' || draft.editRole === 'librarian') {
        setEditRole(draft.editRole);
      }
    },
  });

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', { params: { role: 'librarian,admin', limit: 100 } });
      const docs = res.data?.data?.docs ?? [];
      setStaff(Array.isArray(docs) ? docs.map(normalizeUser) : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not load staff accounts.');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return staff;
    return staff.filter((user) =>
      user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle),
    );
  }, [search, staff]);

  const handleCreate = async () => {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      toast.error('Name and email are required.');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post('/users', {
        name: createForm.name.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        ...(createForm.phone.trim() ? { phone: createForm.phone.trim() } : {}),
      });
      const payload = res.data?.data || {};
      const created = payload.user ? normalizeUser(payload.user) : null;
      if (created) {
        setStaff((prev) => [created, ...prev.filter((user) => user._id !== created._id)]);
      }
      clearCreateDraft();
      setCreateModal(false);
      setCreateForm({ name: '', email: '', role: 'librarian', phone: '' });
      deliveryToast(payload.delivery, 'Staff account created.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create staff account.');
    } finally {
      setCreating(false);
    }
  };

  const handleEditRole = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      await api.put(`/users/${editTarget._id}/status`, { role: editRole });
      setStaff((prev) => prev.map((user) => user._id === editTarget._id ? { ...user, role: editRole } : user));
      clearRoleDraft();
      setEditTarget(null);
      toast.success(`Role updated to ${editRole}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update the staff role.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusTarget) return;
    const nextStatus = !statusTarget.isActive;
    setSavingStatus(true);
    try {
      await api.put(`/users/${statusTarget._id}/status`, { isActive: nextStatus });
      setStaff((prev) => prev.map((user) => user._id === statusTarget._id ? { ...user, isActive: nextStatus } : user));
      setStatusTarget(null);
      toast.success(nextStatus ? 'Account reactivated.' : 'Account suspended.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update account status.');
    } finally {
      setSavingStatus(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setResetting(true);
    try {
      const res = await api.post(`/users/${resetTarget._id}/reset-password`, {});
      const payload = res.data?.data || {};
      setResetTarget(null);
      deliveryToast(payload.delivery, `Password reset email accepted for ${resetTarget.email}.`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to queue the password reset email.');
    } finally {
      setResetting(false);
    }
  };

  const columns: Column<StaffUser>[] = [
    {
      key: 'name',
      header: 'Staff Member',
      sortable: true,
      render: (user) => (
        <div className="flex items-center gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
            user.role === 'admin'
              ? 'border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-400'
              : 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-400'
          }`}>
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{user.name}</p>
            <p className="truncate text-[11px] text-slate-400">{user.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', render: (user) => <RoleBadge role={user.role} /> },
    {
      key: 'isActive',
      header: 'Status',
      render: (user) => <Badge color={user.isActive ? 'green' : 'gray'}>{user.isActive ? 'Active' : 'Suspended'}</Badge>,
    },
    {
      key: 'lastLogin',
      header: 'Last Login',
      render: (user) => (
        <span className="font-mono text-xs text-slate-500">
          {user.lastLogin ? format(parseISO(user.lastLogin), 'MMM d, yyyy') : 'Never'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (user) => (
        <span className="font-mono text-xs text-slate-400">
          {user.createdAt ? format(parseISO(user.createdAt), 'MMM d, yyyy') : '—'}
        </span>
      ),
    },
    {
      key: 'actions' as never,
      header: 'Actions',
      className: 'text-right',
      render: (user) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => {
              setEditTarget(user);
              setEditRole(user.role);
            }}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950/40"
            title="Edit role"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setResetTarget(user)}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-sky-50 hover:text-sky-600 dark:hover:bg-sky-950/40"
            title="Send password reset"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setStatusTarget(user)}
            className={`rounded-lg p-1.5 transition-colors ${
              user.isActive
                ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40'
                : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40'
            }`}
            title={user.isActive ? 'Suspend account' : 'Reactivate account'}
          >
            {user.isActive ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Staff Management
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Manage librarian and administrator accounts, access levels, and reset-email delivery.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={fetchStaff}>
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => {
              setCreateForm({ name: '', email: '', role: 'librarian', phone: '' });
              setCreateModal(true);
            }}
          >
            Add Staff
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {[
          { label: 'Total Staff', value: staff.length, color: 'text-slate-900 dark:text-slate-100' },
          { label: 'Admins', value: staff.filter((user) => user.role === 'admin').length, color: 'text-purple-600 dark:text-purple-400' },
          { label: 'Librarians', value: staff.filter((user) => user.role === 'librarian').length, color: 'text-sky-600 dark:text-sky-400' },
          { label: 'Suspended', value: staff.filter((user) => !user.isActive).length, color: 'text-rose-600 dark:text-rose-400' },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-2.5 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] px-4 py-2.5 shadow-[var(--neo-raised-sm)]">
            <span className={`font-display text-xl font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
            <span className="text-xs text-[var(--neo-text-muted)] font-medium">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="w-full sm:w-80">
        <Input
          placeholder="Search staff by name or email..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          leftIcon={<Search className="h-4 w-4" />}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10 text-slate-300" />}
          title="No staff found"
          description={search ? 'Try a different search term.' : 'No librarian or admin accounts are available yet.'}
        />
      ) : (
        <Table columns={columns} data={filtered} />
      )}

      <Modal
        open={createModal}
        onOpenChange={setCreateModal}
        title="Create Staff Account"
        description="Create a librarian or administrator account and queue a password setup email."
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateModal(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreate} isLoading={creating} leftIcon={<UserPlus className="h-4 w-4" />}>
              Create Account
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Full Name" value={createForm.name} onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Dr. Amna Shahid" />
            <Input label="Email Address" type="email" value={createForm.email} onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="amna@library.edu" />
          </div>
          <Input label="Phone Number (Optional)" value={createForm.phone} onChange={(event) => setCreateForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="+92 300 1234567" />
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700 dark:text-slate-300">Role</label>
            <div className="grid grid-cols-2 gap-2">
              {(['librarian', 'admin'] as RoleOption[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setCreateForm((prev) => ({ ...prev, role }))}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-all ${
                    createForm.role === role
                      ? role === 'admin'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                        : 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950/40 dark:text-primary-400'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
                  }`}
                >
                  {role === 'admin' ? <Shield className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-700 dark:border-sky-800/40 dark:bg-sky-950/30 dark:text-sky-400">
            <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>The account is created immediately. A password setup email is then queued, and the delivery status is returned by the backend.</p>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        title="Change Staff Role"
        description={`Update the role for ${editTarget?.name}`}
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditTarget(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleEditRole} isLoading={savingEdit} leftIcon={<Check className="h-4 w-4" />}>
              Save Role
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 py-2">
          {(['librarian', 'admin'] as RoleOption[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setEditRole(role)}
              className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-xs font-medium transition-all ${
                editRole === role
                  ? role === 'admin'
                    ? 'border-purple-500 bg-purple-50 text-purple-700 dark:border-purple-700 dark:bg-purple-950/40 dark:text-purple-400'
                    : 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-700 dark:bg-primary-950/40 dark:text-primary-400'
                  : 'border-slate-200 text-slate-500 hover:border-slate-300 dark:border-slate-800'
              }`}
            >
              {role === 'admin' ? <Shield className="h-5 w-5" /> : <Users className="h-5 w-5" />}
              <span>{role.charAt(0).toUpperCase() + role.slice(1)}</span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        title={statusTarget?.isActive ? 'Suspend Account' : 'Reactivate Account'}
        description={statusTarget?.isActive ? 'This revokes access immediately.' : 'This restores access immediately.'}
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setStatusTarget(null)} disabled={savingStatus}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleToggleStatus}
              isLoading={savingStatus}
              className={statusTarget?.isActive ? 'bg-rose-600 text-white hover:bg-rose-700' : ''}
            >
              {statusTarget?.isActive ? 'Suspend' : 'Reactivate'}
            </Button>
          </>
        }
      >
        {statusTarget && (
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              {statusTarget.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{statusTarget.name}</p>
              <p className="text-xs text-slate-400">{statusTarget.email}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!resetTarget}
        onOpenChange={(open) => !open && setResetTarget(null)}
        title="Send Password Reset"
        description={`Queue a password reset email for ${resetTarget?.name}.`}
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setResetTarget(null)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleResetPassword} isLoading={resetting} leftIcon={<Mail className="h-4 w-4" />}>
              Queue Reset Email
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>This sends the real backend reset flow. No temporary password is generated in the browser.</p>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
            <p className="font-semibold text-slate-900 dark:text-slate-100">{resetTarget?.name}</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">{resetTarget?.email}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
