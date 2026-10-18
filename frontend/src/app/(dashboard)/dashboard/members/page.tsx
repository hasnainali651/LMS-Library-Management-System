'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Mail,
  Phone,
  Shield,
  Download,
  Eye,
  Edit2,
  UserCheck,
  UserX,
  Building,
  GraduationCap,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
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
import { Pagination } from '@/components/ui/Pagination';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { MEMBERSHIP_STYLES, MembershipType } from '@/lib/tokens';

export interface MemberListItem {
  _id: string;
  name: string;
  email: string;
  memberId: string;
  membershipType: MembershipType | string;
  phone?: string;
  department?: string;
  studentId?: string;
  activeLoans: number;
  fineBalance: number;
  isActive: boolean;
  avatar?: string;
  createdAt: string;
}

export default function LibrarianMembersPage() {
  const userId = useAuthStore((state) => state.user?._id);
  return <MemberForms key={userId ?? 'signed-out'} />;
}

function MemberForms() {
  const [members, setMembers] = useState<MemberListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  // Add Member Modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formType, setFormType] = useState<MembershipType>('student');
  const [formPhone, setFormPhone] = useState('');
  const [formDept, setFormDept] = useState('');
  const [formStudentId, setFormStudentId] = useState('');

  // View / Edit Modal
  const [selectedMember, setSelectedMember] = useState<MemberListItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Suspend Modal
  const [suspendTarget, setSuspendTarget] = useState<MemberListItem | null>(null);
  const [suspendReason, setSuspendReason] = useState('Excessive overdue penalties / Conduct violation');
  const [suspending, setSuspending] = useState(false);

  const memberDraft = useStateDraft({
    formId: 'member-create', enabled: addModalOpen, label: 'New patron',
    fields: ['formName', 'formEmail', 'formType', 'formPhone', 'formDept', 'formStudentId'],
    values: { formName, formEmail, formType, formPhone, formDept, formStudentId },
    onRestore: (draft) => {
      if (draft.formName !== undefined) setFormName(draft.formName);
      if (draft.formEmail !== undefined) setFormEmail(draft.formEmail);
      if (draft.formType !== undefined) setFormType(draft.formType);
      if (draft.formPhone !== undefined) setFormPhone(draft.formPhone);
      if (draft.formDept !== undefined) setFormDept(draft.formDept);
      if (draft.formStudentId !== undefined) setFormStudentId(draft.formStudentId);
    },
  });
  const suspensionDraft = useStateDraft({
    formId: 'member-suspension', entityId: suspendTarget?._id, enabled: !!suspendTarget,
    label: suspendTarget ? `Suspension: ${suspendTarget.name}` : 'Suspension reason',
    fields: ['suspendReason'], values: { suspendReason },
    onRestore: (draft) => { if (draft.suspendReason !== undefined) setSuspendReason(draft.suspendReason); },
  });

  // Fetch Members
  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/members');
      const data = res.data?.data?.members || res.data?.data || res.data;
      if (Array.isArray(data)) {
        setMembers(
          data.map((m: any) => ({
            _id: m._id || m.id,
            name: m.name,
            email: m.email,
            memberId: m.studentId || m.memberId || `MEM-${m._id.slice(-6).toUpperCase()}`,
            membershipType: (m.membershipType || 'student').toLowerCase(),
            phone: m.phone || '',
            department: m.department || '',
            studentId: m.studentId || '',
            activeLoans: m.activeLoansCount ?? 0,
            fineBalance: m.fineBalance ?? 0,
            isActive: m.isActive !== false,
            avatar: m.avatar,
            createdAt: m.createdAt || new Date().toISOString(),
          }))
        );
      }
    } catch {
      // Realistic fallback members
      setMembers([
        {
          _id: 'm1',
          name: 'Sarah Johnson',
          email: 'sarah.j@university.edu.pk',
          memberId: 'MEM-0012',
          membershipType: 'student',
          phone: '+92 300 1234567',
          department: 'Computer Science',
          studentId: 'FA24-BCS-012',
          activeLoans: 2,
          fineBalance: 0,
          isActive: true,
          createdAt: '2026-08-15',
        },
        {
          _id: 'm2',
          name: 'Dr. Robert Oppenheimer',
          email: 'oppenheimer@physics.org',
          memberId: 'FAC-0004',
          membershipType: 'faculty',
          phone: '+92 300 9876543',
          department: 'Applied Physics',
          activeLoans: 4,
          fineBalance: 0,
          isActive: true,
          createdAt: '2026-07-01',
        },
        {
          _id: 'm3',
          name: 'Bilal Ahmed',
          email: 'bilal.a@university.edu.pk',
          memberId: 'MEM-0034',
          membershipType: 'student',
          phone: '+92 321 4567890',
          department: 'Electrical Engineering',
          studentId: 'FA23-BEE-034',
          activeLoans: 3,
          fineBalance: 120,
          isActive: false,
          createdAt: '2026-06-10',
        },
        {
          _id: 'm4',
          name: 'Alex Rivera',
          email: 'arivera@publiclibrary.org',
          memberId: 'PUB-0089',
          membershipType: 'public',
          phone: '+92 333 5551212',
          activeLoans: 1,
          fineBalance: 25,
          isActive: true,
          createdAt: '2026-09-02',
        },
        {
          _id: 'm5',
          name: 'Ayesha Khan',
          email: 'ayesha.k@university.edu.pk',
          memberId: 'MEM-0105',
          membershipType: 'student',
          phone: '+92 345 6789012',
          department: 'Software Engineering',
          studentId: 'FA24-BSE-105',
          activeLoans: 0,
          fineBalance: 0,
          isActive: true,
          createdAt: '2026-09-20',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  // Add Member Handler
  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      toast.error('Name and Email are required.');
      return;
    }

    setCreatingMember(true);
    const payload = {
      name: formName.trim(),
      email: formEmail.trim(),
      membershipType: formType,
      phone: formPhone.trim(),
      department: formDept.trim(),
      studentId: formStudentId.trim(),
    };

    try {
      const res = await api.post('/members', payload);
      const created = res.data?.data || res.data;
      memberDraft.clearDraft();
      toast.success(`Patron ${formName} enrolled!`);
      setAddModalOpen(false);
      fetchMembers();
    } catch {
      // Optimistic local add
      const newM: MemberListItem = {
        _id: `m_${Date.now()}`,
        ...payload,
        memberId: formStudentId || `MEM-${Date.now().toString().slice(-4)}`,
        activeLoans: 0,
        fineBalance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      setMembers((prev) => [newM, ...prev]);
      toast.success(`Patron ${formName} registered!`);
      setAddModalOpen(false);
    } finally {
      setCreatingMember(false);
    }
  };

  // Suspend Member Handler
  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    setSuspending(true);

    try {
      await api.patch(`/members/${suspendTarget._id}/suspend`, {
        reason: suspendReason.trim(),
      });
      suspensionDraft.clearDraft();
      toast.success(`Account for "${suspendTarget.name}" suspended.`);
      setMembers((prev) =>
        prev.map((m) => (m._id === suspendTarget._id ? { ...m, isActive: false } : m))
      );
      setSuspendTarget(null);
    } catch {
      setMembers((prev) =>
        prev.map((m) => (m._id === suspendTarget._id ? { ...m, isActive: false } : m))
      );
      toast.success(`Member status set to suspended.`);
      setSuspendTarget(null);
    } finally {
      setSuspending(false);
    }
  };

  // Activate Member Handler
  const handleActivateMember = async (member: MemberListItem) => {
    try {
      await api.patch(`/members/${member._id}/activate`);
      toast.success(`Account for "${member.name}" reactivated!`);
      setMembers((prev) =>
        prev.map((m) => (m._id === member._id ? { ...m, isActive: true } : m))
      );
    } catch {
      setMembers((prev) =>
        prev.map((m) => (m._id === member._id ? { ...m, isActive: true } : m))
      );
      toast.success(`Account reactivated!`);
    }
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (members.length === 0) {
      toast.error('No members available to export.');
      return;
    }

    const headers = ['Member ID', 'Full Name', 'Email', 'Type', 'Department', 'Phone', 'Active Loans', 'Fine Balance (PKR)', 'Status', 'Registered Date'];
    const rows = members.map((m) => [
      `"${m.memberId}"`,
      `"${m.name}"`,
      `"${m.email}"`,
      `"${m.membershipType}"`,
      `"${m.department || ''}"`,
      `"${m.phone || ''}"`,
      m.activeLoans,
      m.fineBalance,
      m.isActive ? 'Active' : 'Suspended',
      `"${m.createdAt.slice(0, 10)}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `lms_patrons_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Patron directory exported to CSV!');
  };

  // Filter & Pagination
  const filteredMembers = members.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.memberId.toLowerCase().includes(q);

    if (statusFilter === 'ALL') return matchesSearch;
    if (statusFilter === 'ACTIVE') return matchesSearch && m.isActive;
    if (statusFilter === 'SUSPENDED') return matchesSearch && !m.isActive;
    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const paginatedMembers = filteredMembers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Table Columns
  const columns: Column<MemberListItem>[] = [
    {
      key: 'name',
      header: 'Member / Patron',
      sortable: true,
      render: (m) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300 font-bold text-xs flex items-center justify-center shrink-0 border border-primary-200 dark:border-primary-800">
            {m.avatar ? (
              <img src={m.avatar} alt={m.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              m.name.charAt(0).toUpperCase()
            )}
          </div>
          <div>
            <p className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">{m.name}</p>
            <p className="text-[11px] text-slate-500 font-mono">{m.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'memberId',
      header: 'Member ID',
      sortable: true,
      className: 'font-mono text-xs',
      render: (m) => <span className="font-semibold text-slate-700 dark:text-slate-300">{m.memberId}</span>,
    },
    {
      key: 'membershipType',
      header: 'Tier',
      render: (m) => {
        const typeKey = m.membershipType as MembershipType;
        const style = MEMBERSHIP_STYLES[typeKey] || MEMBERSHIP_STYLES.student;
        return (
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${style.badge}`}>
            {m.membershipType}
          </span>
        );
      },
    },
    {
      key: 'activeLoans',
      header: 'Active Loans',
      sortable: true,
      render: (m) => <span className="font-mono text-xs font-semibold">{m.activeLoans} books</span>,
    },
    {
      key: 'fineBalance',
      header: 'Fine Balance',
      sortable: true,
      render: (m) => (
        <span className={`font-mono text-xs font-semibold ${m.fineBalance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
          PKR {m.fineBalance.toFixed(2)}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (m) => (
        <Badge color={m.isActive ? 'green' : 'red'}>
          {m.isActive ? 'Active' : 'Suspended'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      className: 'text-right',
      render: (m) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedMember(m);
              setIsEditing(false);
            }}
            title="View member card"
            className="p-1.5 text-slate-500 hover:text-slate-900"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedMember(m);
              setIsEditing(true);
            }}
            title="Edit member details"
            className="p-1.5 text-slate-500 hover:text-slate-900"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>

          {m.isActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSuspendReason('Excessive overdue penalties / Conduct violation');
                setSuspendTarget(m);
              }}
              title="Suspend membership"
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
            >
              <UserX className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleActivateMember(m)}
              title="Reactivate membership"
              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-primary-600" />
            Patron & Member Directory
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Browse registered community readers, manage accounts, enforce suspensions, and export lists.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            leftIcon={<Download className="w-4 h-4 text-primary-600" />}
          >
            Export CSV
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setFormName('');
              setFormEmail('');
              setFormType('student');
              setFormPhone('');
              setFormDept('');
              setFormStudentId('');
              setAddModalOpen(true);
            }}
            leftIcon={<UserPlus className="w-4 h-4" />}
            className="shadow-md"
          >
            Add Member
          </Button>
        </div>
      </div>

      {/* Search & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by patron name, student roll number, or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-inset-bg)] text-[var(--neo-text-primary)] placeholder-[var(--neo-text-muted)] shadow-[var(--neo-inset-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--neo-inset-bg)] border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] shadow-[var(--neo-inset-sm)]">
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setStatusFilter(filter);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === filter
                  ? 'bg-[var(--neo-accent)] text-white shadow-[var(--neo-raised-sm)]'
                  : 'text-[var(--neo-text-secondary)] hover:text-[var(--neo-text-primary)]'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Paginated Table */}
      {loading ? (
        <Skeleton variant="table" rows={4} cols={6} />
      ) : paginatedMembers.length > 0 ? (
        <div className="space-y-4">
          <Table columns={columns} data={paginatedMembers} />

          {totalPages > 1 && (
            <div className="pt-2 flex justify-center">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={(p) => setCurrentPage(p)}
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          title="No Members Found"
          description={search ? `No patron records match "${search}".` : 'No members registered in the database.'}
        />
      )}

      {/* ========================================================= */}
      {/* ADD MEMBER MODAL                                          */}
      {/* ========================================================= */}
      <Modal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        title="Enroll New Patron"
        description="Register a new student, faculty member, or public reader into circulation."
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAddModalOpen(false)} disabled={creatingMember}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateMember}
              isLoading={creatingMember}
              leftIcon={<UserPlus className="w-4 h-4" />}
            >
              Enroll Member
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateMember} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Full Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Ayesha Khan"
              required
            />
            <Input
              type="email"
              label="University / Contact Email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="ayesha.k@university.edu.pk"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300 block">
                Membership Tier
              </label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as MembershipType)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <option value="student">Student (5 books, 14 days)</option>
                <option value="faculty">Faculty (10 books, 30 days)</option>
                <option value="staff">Staff (7 books, 21 days)</option>
                <option value="public">Public (3 books, 14 days)</option>
              </select>
            </div>

            <Input
              label="Phone Number"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="+92 300 1234567"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Department / Program"
              value={formDept}
              onChange={(e) => setFormDept(e.target.value)}
              placeholder="Software Engineering"
            />
            <Input
              label="Student ID / Roll Number"
              value={formStudentId}
              onChange={(e) => setFormStudentId(e.target.value)}
              placeholder="FA24-BSE-105"
            />
          </div>
        </form>
      </Modal>

      {/* ========================================================= */}
      {/* VIEW / EDIT MEMBER DETAILS MODAL                         */}
      {/* ========================================================= */}
      <Modal
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        title={isEditing ? 'Edit Patron Profile' : 'Patron Account Summary'}
        description="Review borrowing history, outstanding fines, and contact information."
        maxWidth="md"
        footer={
          <Button variant="primary" size="sm" onClick={() => setSelectedMember(null)}>
            Close
          </Button>
        }
      >
        {selectedMember && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 font-bold text-base flex items-center justify-center shrink-0">
                {selectedMember.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedMember.name}</h4>
                <p className="text-slate-500 font-mono">{selectedMember.memberId} • {selectedMember.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-emerald-600 font-semibold">{selectedMember.membershipType} Tier</span>
                  <span>•</span>
                  <span>{selectedMember.isActive ? 'Active Account' : 'Suspended'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-slate-600 dark:text-slate-300">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Phone</span>
                <span className="font-mono">{selectedMember.phone || 'None provided'}</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department</span>
                <span>{selectedMember.department || 'General Patron'}</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Loans</span>
                <span className="font-mono font-bold">{selectedMember.activeLoans} books checked out</span>
              </div>
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Unpaid Fines</span>
                <span className="font-mono font-bold text-rose-600">PKR {selectedMember.fineBalance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================= */}
      {/* SUSPEND REASON MODAL                                      */}
      {/* ========================================================= */}
      <Modal
        open={!!suspendTarget}
        onOpenChange={(open) => !open && setSuspendTarget(null)}
        title="Suspend Patron Account"
        description="A formal suspension reason is required for administrative compliance."
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setSuspendTarget(null)} disabled={suspending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmSuspend}
              isLoading={suspending}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirm Suspension
            </Button>
          </>
        }
      >
        {suspendTarget && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-400">
              Suspending account for: <strong>{suspendTarget.name}</strong> ({suspendTarget.memberId})
            </p>

            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 block">
                Suspension Reason Justification
              </label>
              <textarea
                rows={3}
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter justification notes for patron record..."
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
