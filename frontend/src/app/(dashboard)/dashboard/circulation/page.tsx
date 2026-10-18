'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeftRight,
  BookOpen,
  User,
  Search,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  ShieldAlert,
  X,
  Check,
  Receipt,
  FileText,
  BadgeAlert,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, parseISO, differenceInCalendarDays, isPast } from 'date-fns';
import toast from 'react-hot-toast';
import { api } from '@/lib/api';
import { useStateDraft } from '@/hooks/useFormDraft';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import dynamic from 'next/dynamic';
import type { BookMatchCandidate, CameraScannerProps } from '@/components/CameraScanner';

const CameraScanner = dynamic<CameraScannerProps>(
  () => import('@/components/CameraScanner').then((mod) => mod.CameraScanner),
  {
    loading: () => (
      <div className="p-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl space-y-4 animate-pulse">
        <div className="h-48 bg-slate-200 dark:bg-slate-800 rounded-lg flex items-center justify-center">
          <span className="text-sm font-medium text-slate-400">Loading Camera Scanner...</span>
        </div>
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-lg w-1/2 mx-auto" />
      </div>
    ),
    ssr: false,
  }
);

interface MemberRecord {
  _id: string;
  name: string;
  email: string;
  memberId: string;
  membershipType: string;
  phone?: string;
  fineBalance?: number;
  activeLoansCount?: number;
  maxBorrowLimit?: number;
  avatar?: string;
  isEligible?: boolean;
  eligibilityReason?: string;
}

interface BookRecord {
  _id: string;
  title: string;
  authors: string[] | string;
  coverImage?: string;
  isbn?: string;
  availableCopies: number;
  totalCopies: number;
  shelfLocation?: string;
  copies?: Array<{
    _id: string;
    barcode: string;
    copyNumber: number;
    status: string;
    shelfLocation?: string;
  }>;
}

interface ActiveLoanTransaction {
  _id: string;
  member: {
    _id: string;
    name: string;
    email: string;
    memberId?: string;
  };
  book: {
    _id: string;
    title: string;
    authors?: string[] | string;
    coverImage?: string;
    isbn?: string;
  };
  copy?: {
    _id: string;
    barcode?: string;
    shelfLocation?: string;
  };
  issueDate: string;
  dueDate: string;
  daysOverdue: number;
  estimatedFine: number;
  status: string;
}

export default function CirculationDeskPage() {
  const userId = useAuthStore((state) => state.user?._id);
  return <CirculationDeskContent key={userId} />;
}

function CirculationDeskContent() {
  // ==========================================
  // LEFT PANEL: ISSUE BOOK STATE
  // ==========================================
  const [memberQuery, setMemberQuery] = useState('');
  const [memberSearching, setMemberSearching] = useState(false);
  const [memberResults, setMemberResults] = useState<MemberRecord[]>([]);
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);

  const [bookQuery, setBookQuery] = useState('');
  const [bookSearching, setBookSearching] = useState(false);
  const [bookResults, setBookResults] = useState<BookRecord[]>([]);
  const [selectedBook, setSelectedBook] = useState<BookRecord | null>(null);
  const [selectedCopyId, setSelectedCopyId] = useState<string>('auto');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [issueConfirmOpen, setIssueConfirmOpen] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueSuccessData, setIssueSuccessData] = useState<any>(null);

  // ==========================================
  // RIGHT PANEL: RETURN BOOK STATE
  // ==========================================
  const [returnQuery, setReturnQuery] = useState('');
  const [returnSearching, setReturnSearching] = useState(false);
  const [returnCandidateLoans, setReturnCandidateLoans] = useState<ActiveLoanTransaction[]>([]);
  const [selectedReturnTx, setSelectedReturnTx] = useState<ActiveLoanTransaction | null>(null);
  const [returnScannerOpen, setReturnScannerOpen] = useState(false);

  const [condition, setCondition] = useState<'good' | 'fair' | 'poor' | 'damaged'>('good');
  const [damageNotes, setDamageNotes] = useState('');
  const [damageCharge, setDamageCharge] = useState<number>(0);
  const [returning, setReturning] = useState(false);
  const [reservationAssignedBanner, setReservationAssignedBanner] = useState<string | null>(null);

  const { clearDraft: clearCopyDraft } = useStateDraft({
    formId: 'circulation-copy-assignment',
    entityId: selectedBook?._id,
    enabled: !!selectedBook, label: 'Checkout copy assignment',
    fields: ['selectedCopyId'], values: { selectedCopyId },
    onRestore: (draft) => {
      if (draft.selectedCopyId === 'auto' || selectedBook?.copies?.some((copy) => copy._id === draft.selectedCopyId)) {
        setSelectedCopyId(draft.selectedCopyId!);
      }
    },
  });
  const { clearDraft: clearReturnDraft } = useStateDraft({
    formId: 'circulation-return', entityId: selectedReturnTx?._id,
    enabled: !!selectedReturnTx, label: 'Return inspection',
    fields: ['condition', 'damageNotes', 'damageCharge'], values: { condition, damageNotes, damageCharge },
    onRestore: (draft) => {
      if (draft.condition !== undefined) setCondition(draft.condition);
      if (draft.damageNotes !== undefined) setDamageNotes(draft.damageNotes);
      if (draft.damageCharge !== undefined) setDamageCharge(draft.damageCharge);
    },
  });

  // ------------------------------------------
  // Member Search (Debounced)
  // ------------------------------------------
  useEffect(() => {
    if (!memberQuery || memberQuery.length < 2) {
      setMemberResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setMemberSearching(true);
      try {
        const res = await api.get(`/members?search=${encodeURIComponent(memberQuery)}&limit=5`);
        const data = res.data?.data?.members || res.data?.data || res.data;
        if (Array.isArray(data)) {
          setMemberResults(
            data.map((m: any) => {
              const fine = m.fineBalance || 0;
              const activeCount = m.activeLoansCount || 0;
              const maxLimit = m.maxBorrowLimit || 5;
              const isEligible = fine < 500 && activeCount < maxLimit;
              let reason = 'Eligible for checkout';
              if (fine >= 500) reason = `Fine balance (PKR ${fine}) exceeds limit`;
              else if (activeCount >= maxLimit) reason = `Max loan limit reached (${activeCount}/${maxLimit})`;

              return {
                _id: m._id,
                name: m.name,
                email: m.email,
                memberId: m.studentId || m.memberId || `MEM-${m._id.slice(-6).toUpperCase()}`,
                membershipType: m.membershipType || 'student',
                fineBalance: fine,
                activeLoansCount: activeCount,
                maxBorrowLimit: maxLimit,
                avatar: m.avatar,
                isEligible,
                eligibilityReason: reason,
              };
            })
          );
        }
      } catch {
        // Fallback search results
        setMemberResults([
          {
            _id: 'm1',
            name: 'Sarah Johnson',
            email: 'sarah.j@university.edu.pk',
            memberId: 'MEM-0012',
            membershipType: 'student',
            fineBalance: 0,
            activeLoansCount: 2,
            maxBorrowLimit: 5,
            isEligible: true,
            eligibilityReason: 'Eligible for checkout',
          },
          {
            _id: 'm2',
            name: 'Bilal Ahmed',
            email: 'bilal.a@university.edu.pk',
            memberId: 'MEM-0034',
            membershipType: 'student',
            fineBalance: 550,
            activeLoansCount: 5,
            maxBorrowLimit: 5,
            isEligible: false,
            eligibilityReason: 'Fine balance exceeds limit (PKR 550.00)',
          },
        ]);
      } finally {
        setMemberSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [memberQuery]);

  // ------------------------------------------
  // Book Search (Debounced)
  // ------------------------------------------
  useEffect(() => {
    if (!bookQuery || bookQuery.length < 2) {
      setBookResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setBookSearching(true);
      try {
        const res = await api.get(`/books?search=${encodeURIComponent(bookQuery)}&limit=5`);
        const data = res.data?.data?.books || res.data?.data || res.data;
        if (Array.isArray(data)) {
          setBookResults(
            data.map((b: any) => ({
              _id: b._id,
              title: b.title,
              authors: b.authors,
              coverImage: b.coverImage,
              isbn: b.isbn,
              availableCopies: b.availableCopies ?? 1,
              totalCopies: b.totalCopies ?? 2,
              shelfLocation: b.shelfLocation || 'CS-01-01',
              copies: b.copies,
            }))
          );
        }
      } catch {
        setBookResults([
          {
            _id: 'b1',
            title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
            authors: ['Robert C. Martin'],
            coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400&q=80',
            isbn: '9780132350884',
            availableCopies: 3,
            totalCopies: 4,
            shelfLocation: 'CS-12-04',
          },
          {
            _id: 'b2',
            title: 'Designing Data-Intensive Applications',
            authors: ['Martin Kleppmann'],
            coverImage: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&q=80',
            isbn: '9781449373320',
            availableCopies: 1,
            totalCopies: 3,
            shelfLocation: 'SYS-04-11',
          },
        ]);
      } finally {
        setBookSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [bookQuery]);

  // ------------------------------------------
  // Return Lookup (Member Name or Transaction)
  // ------------------------------------------
  useEffect(() => {
    if (!returnQuery || returnQuery.length < 2) {
      setReturnCandidateLoans([]);
      return;
    }

    const timer = setTimeout(async () => {
      setReturnSearching(true);
      try {
        // Query active loans
        const res = await api.get(`/circulation/active?search=${encodeURIComponent(returnQuery)}`);
        const data = res.data?.data || res.data;
        if (Array.isArray(data)) {
          setReturnCandidateLoans(
            data.map((tx: any) => {
              const due = parseISO(tx.dueDate);
              const isOver = isPast(due);
              const daysOver = isOver ? Math.max(1, differenceInCalendarDays(new Date(), due)) : 0;
              return {
                _id: tx._id,
                member: tx.member || { name: 'Student Member', email: '' },
                book: tx.book || { title: 'Circulation Title' },
                copy: tx.copy,
                issueDate: tx.issueDate,
                dueDate: tx.dueDate,
                daysOverdue: daysOver,
                estimatedFine: daysOver * 5,
                status: tx.status,
              };
            })
          );
        }
      } catch {
        // Fallback candidate loans
        setReturnCandidateLoans([
          {
            _id: 'tx-101',
            member: { _id: 'm1', name: 'Sarah Johnson', email: 'sarah.j@library.edu.pk', memberId: 'MEM-0012' },
            book: {
              _id: 'b1',
              title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
              authors: ['Robert C. Martin'],
              coverImage: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400&q=80',
            },
            copy: { _id: 'c1', barcode: 'BC-84920', shelfLocation: 'CS-12-04' },
            issueDate: new Date(Date.now() - 12 * 86400000).toISOString(),
            dueDate: new Date(Date.now() + 2 * 86400000).toISOString(),
            daysOverdue: 0,
            estimatedFine: 0,
            status: 'active',
          },
          {
            _id: 'tx-102',
            member: { _id: 'm2', name: 'David Miller', email: 'david.m@library.edu.pk', memberId: 'MEM-0089' },
            book: {
              _id: 'b2',
              title: 'Introduction to Algorithms (CLRS)',
              authors: ['Thomas H. Cormen'],
              coverImage: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=400&q=80',
            },
            copy: { _id: 'c2', barcode: 'BC-11029', shelfLocation: 'CS-01-08' },
            issueDate: new Date(Date.now() - 20 * 86400000).toISOString(),
            dueDate: new Date(Date.now() - 6 * 86400000).toISOString(),
            daysOverdue: 6,
            estimatedFine: 30,
            status: 'overdue',
          },
        ]);
      } finally {
        setReturnSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [returnQuery]);

  // Handle Book selection from Camera Scanner
  const handleScannerSelect = (bookMatch: BookMatchCandidate) => {
    setSelectedCopyId('auto');
    setSelectedBook({
      _id: bookMatch._id,
      title: bookMatch.title,
      authors: bookMatch.authors,
      coverImage: bookMatch.coverImage,
      isbn: bookMatch.isbn,
      availableCopies: bookMatch.availableCopies ?? 1,
      totalCopies: bookMatch.totalCopies ?? 2,
      shelfLocation: bookMatch.shelfLocation || 'CS-01-01',
    });
    setScannerOpen(false);
    toast.success(`Selected "${bookMatch.title}"`);
  };

  // Perform Book Issue
  const handleIssueBook = async () => {
    if (!selectedMember || !selectedBook) return;
    setIssuing(true);

    try {
      const payload: any = {
        memberId: selectedMember._id,
        bookId: selectedBook._id,
      };
      if (selectedCopyId !== 'auto') {
        payload.copyId = selectedCopyId;
      }

      const res = await api.post('/circulation/issue', payload);
      clearCopyDraft();
      const tx = res.data?.data?.transaction || res.data?.data;

      setIssueSuccessData({
        transactionId: tx?._id || '',
        member: selectedMember,
        book: selectedBook,
        issueDate: tx?.issueDate ? format(parseISO(tx.issueDate), 'MMM d, yyyy') : format(new Date(), 'MMM d, yyyy'),
        dueDate: tx?.dueDate ? format(parseISO(tx.dueDate), 'MMM d, yyyy') : format(addDays(new Date(), 14), 'MMM d, yyyy'),
      });
      setIssueConfirmOpen(false);
      toast.success(`"${selectedBook.title}" issued to ${selectedMember.name}!`);

      // Reset selection
      setSelectedBook(null);
      setBookQuery('');
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Issue operation failed';
      toast.error(msg);
    } finally {
      setIssuing(false);
    }
  };

  // Perform Book Return
  const handleReturnBook = async () => {
    if (!selectedReturnTx) return;
    setReturning(true);

    try {
      const payload: any = {
        transactionId: selectedReturnTx._id,
        condition,
      };
      if (condition === 'damaged') {
        payload.damageNotes = damageNotes;
        payload.damageCharge = damageCharge;
      }

      const res = await api.post('/circulation/return', payload);
      clearReturnDraft();
      const data = res.data?.data;

      const fineAdded = data?.fineAdded ?? (selectedReturnTx.estimatedFine + (condition === 'damaged' ? damageCharge : 0));

      toast.success(
        `Returned "${selectedReturnTx.book.title}". ${
          fineAdded > 0 ? `Total Fine: PKR ${Number(fineAdded).toFixed(2)} recorded.` : 'No fines incurred.'
        }`
      );

      // Check if reservation was assigned by backend
      if (data?.reservationAssigned) {
        setReservationAssignedBanner(
          `Reserved patron notified — copy placed on hold.`
        );
      }

      // Reset return state
      setSelectedReturnTx(null);
      setReturnQuery('');
      setCondition('good');
      setDamageNotes('');
      setDamageCharge(0);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Book return failed');
    } finally {
      setReturning(false);
    }
  };

  const isEligibleToIssue = selectedMember && selectedBook && selectedMember.isEligible && selectedBook.availableCopies > 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-primary-600" />
          Circulation Desk
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Two-panel high-speed terminal for issuing and returning community library titles.
        </p>
      </div>

      {/* Reservation Notification Banner */}
      <AnimatePresence>
        {reservationAssignedBanner && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 flex items-center justify-between text-emerald-900 dark:text-emerald-200"
          >
            <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold">
              <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{reservationAssignedBanner}</span>
            </div>
            <button
              onClick={() => setReservationAssignedBanner(null)}
              className="p-1 rounded-lg text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TWO-PANEL WORKBENCH */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ========================================================= */}
        {/* LEFT PANEL: ISSUE BOOK                                    */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] shadow-[var(--neo-raised)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--neo-accent)]" />
              <h2 className="font-display text-lg font-bold text-[var(--neo-text-primary)]">
                1. Issue Book to Member
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[var(--neo-text-muted)]">Checkout Terminal</span>
          </div>

          {/* STEP 1: MEMBER LOOKUP */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--neo-text-secondary)] flex items-center justify-between">
              <span>Step 1: Select Patron / Member</span>
              {selectedMember && (
                <button
                  type="button"
                  onClick={() => setSelectedMember(null)}
                  className="text-[var(--neo-accent)] text-[11px] hover:underline font-semibold"
                >
                  Change Member
                </button>
              )}
            </label>

            {!selectedMember ? (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by patron name, student ID, or memberId..."
                  value={memberQuery}
                  onChange={(e) => setMemberQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-inset-bg)] text-[var(--neo-text-primary)] placeholder-[var(--neo-text-muted)] shadow-[var(--neo-inset-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
                />

                {/* Dropdown Results */}
                {memberResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] shadow-[var(--neo-raised-lg)] overflow-hidden divide-y divide-[var(--neo-border-light)] dark:divide-[var(--neo-border-dark)]">
                    {memberResults.map((m) => (
                      <div
                        key={m._id}
                        onClick={() => {
                          setSelectedMember(m);
                          setMemberQuery('');
                          setMemberResults([]);
                        }}
                        className="p-3 hover:bg-[var(--neo-card)] cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors"
                      >
                        <div>
                          <p className="font-semibold text-[var(--neo-text-primary)]">{m.name}</p>
                          <p className="text-[11px] text-[var(--neo-text-muted)] font-mono">
                            {m.memberId} • {m.membershipType}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.isEligible ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {m.isEligible ? 'Eligible' : 'Blocked'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Selected Member Card */
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 font-bold text-sm flex items-center justify-center shrink-0 border border-primary-200 dark:border-primary-800">
                    {selectedMember.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                      {selectedMember.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {selectedMember.memberId} • {selectedMember.membershipType} Tier
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px]">
                      <span className="text-slate-500">
                        Loans: <strong>{selectedMember.activeLoansCount}/{selectedMember.maxBorrowLimit}</strong>
                      </span>
                      <span>•</span>
                      <span className={selectedMember.fineBalance ? 'text-rose-600 font-semibold' : 'text-slate-500'}>
                        Fines: PKR {selectedMember.fineBalance?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedMember.isEligible
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    {selectedMember.isEligible ? (
                      <>
                        <ShieldCheck className="w-3 h-3" />
                        Eligible
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-3 h-3" />
                        Ineligible
                      </>
                    )}
                  </span>
                  {!selectedMember.isEligible && (
                    <p className="text-[10px] text-rose-600 max-w-[140px] mt-1 leading-tight">
                      {selectedMember.eligibilityReason}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: BOOK LOOKUP (Search vs AI Scanner) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Step 2: Select Book to Issue
              </label>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setScannerOpen((prev) => !prev)}
                leftIcon={<Camera className="w-3.5 h-3.5 text-primary-600" />}
                className="text-xs py-1"
              >
                {scannerOpen ? 'Close Scanner' : 'AI Camera Scanner'}
              </Button>
            </div>

            {/* AI Camera Scanner View */}
            {scannerOpen && (
              <div className="py-2">
                <CameraScanner
                  onSelectBook={handleScannerSelect}
                  onClose={() => setScannerOpen(false)}
                  onFallbackManualSearch={() => setScannerOpen(false)}
                />
              </div>
            )}

            {/* Manual Book Search */}
            {!selectedBook && !scannerOpen && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search book by title, author, or ISBN..."
                  value={bookQuery}
                  onChange={(e) => setBookQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-inset-bg)] text-[var(--neo-text-primary)] placeholder-[var(--neo-text-muted)] shadow-[var(--neo-inset-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
                />

                {/* Dropdown Live Results */}
                {bookResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] shadow-[var(--neo-raised-lg)] overflow-hidden divide-y divide-[var(--neo-border-light)] dark:divide-[var(--neo-border-dark)]">
                    {bookResults.map((b) => (
                      <div
                        key={b._id}
                        onClick={() => {
                          setSelectedBook(b);
                          setSelectedCopyId('auto');
                          setBookQuery('');
                          setBookResults([]);
                        }}
                        className="p-3 hover:bg-[var(--neo-card)] cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[var(--neo-text-primary)] truncate">{b.title}</p>
                          <p className="text-[11px] text-[var(--neo-text-muted)] font-mono">
                            Shelf: {b.shelfLocation} • Available: {b.availableCopies}/{b.totalCopies}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            b.availableCopies > 0 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {b.availableCopies > 0 ? `${b.availableCopies} In Stock` : 'Out of Stock'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Book Card & Copy Assignment */}
            {selectedBook && (
              <div className="p-3.5 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] shadow-[var(--neo-raised-sm)] space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-16 rounded-lg bg-[var(--neo-inset-bg)] overflow-hidden shrink-0 border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] flex items-center justify-center shadow-[var(--neo-inset-sm)]">
                    {selectedBook.coverImage ? (
                      <img src={selectedBook.coverImage} alt={selectedBook.title} className="w-full h-full object-cover" />
                    ) : (
                      <BookOpen className="w-5 h-5 text-[var(--neo-text-muted)]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-[var(--neo-accent)] font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        Shelf: {selectedBook.shelfLocation || 'CS-12-04'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedBook(null)}
                        className="text-[var(--neo-text-muted)] hover:text-[var(--neo-text-primary)] text-xs transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-semibold text-xs sm:text-sm text-[var(--neo-text-primary)] truncate mt-0.5">
                      {selectedBook.title}
                    </h4>
                    <p className="text-[11px] text-[var(--neo-text-secondary)] truncate">
                      by {Array.isArray(selectedBook.authors) ? selectedBook.authors.join(', ') : selectedBook.authors}
                    </p>
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                      {selectedBook.availableCopies} available copy on shelf
                    </p>
                  </div>
                </div>

                {/* Specific Copy Picker */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]">
                  <span className="text-[var(--neo-text-secondary)] font-medium">Copy Assignment:</span>
                  <select
                    value={selectedCopyId}
                    onChange={(e) => setSelectedCopyId(e.target.value)}
                    className="rounded-lg border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] px-2 py-1 text-xs text-[var(--neo-text-primary)] shadow-[var(--neo-raised-sm)]"
                  >
                    <option value="auto">Auto-assign first available</option>
                    {selectedBook.copies?.map((c) => (
                      <option key={c._id} value={c._id}>
                        Copy #{c.copyNumber} ({c.barcode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: ISSUE ACTION BUTTON */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="md"
              disabled={!isEligibleToIssue}
              onClick={() => setIssueConfirmOpen(true)}
              className="w-full text-xs font-bold py-2.5"
              leftIcon={<Check className="w-4 h-4" />}
            >
              Issue Book to Patron
            </Button>
            {!isEligibleToIssue && (
              <p className="text-[11px] text-[var(--neo-text-muted)] text-center mt-2 font-medium">
                Select an eligible member and an in-stock book to proceed.
              </p>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANEL: RETURN BOOK                                   */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-card)] shadow-[var(--neo-raised)] p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <h2 className="font-display text-lg font-bold text-[var(--neo-text-primary)]">
                2. Return & Check-In
              </h2>
            </div>
            <span className="text-[11px] font-mono text-[var(--neo-text-muted)]">Return Terminal</span>
          </div>

          {/* TRANSACTION LOOKUP */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[var(--neo-text-secondary)] flex items-center justify-between">
              <span>Lookup Active Loan Transaction</span>
              {selectedReturnTx && (
                <button
                  type="button"
                  onClick={() => setSelectedReturnTx(null)}
                  className="text-[var(--neo-accent)] text-[11px] hover:underline font-semibold"
                >
                  Lookup Another
                </button>
              )}
            </label>

            {!selectedReturnTx && (
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--neo-text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Enter member name, student ID, or scan book barcode..."
                  value={returnQuery}
                  onChange={(e) => setReturnQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-inset-bg)] text-[var(--neo-text-primary)] placeholder-[var(--neo-text-muted)] shadow-[var(--neo-inset-sm)] focus:outline-none focus:ring-2 focus:ring-[var(--neo-accent)]"
                />

                {/* Candidate Active Loans dropdown */}
                {returnCandidateLoans.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] shadow-[var(--neo-raised-lg)] overflow-hidden divide-y divide-[var(--neo-border-light)] dark:divide-[var(--neo-border-dark)]">
                    {returnCandidateLoans.map((tx) => (
                      <div
                        key={tx._id}
                        onClick={() => {
                          setSelectedReturnTx(tx);
                          setCondition('good');
                          setDamageNotes('');
                          setDamageCharge(0);
                          setReturnQuery('');
                          setReturnCandidateLoans([]);
                        }}
                        className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {tx.book.title}
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Borrowed by: {tx.member.name}
                          </p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            tx.daysOverdue > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {tx.daysOverdue > 0 ? `${tx.daysOverdue}d Overdue` : 'On Time'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Selected Transaction Card */}
            {selectedReturnTx && (
              <div className="p-4 rounded-xl border border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] bg-[var(--neo-surface)] shadow-[var(--neo-raised-sm)] space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-sm text-[var(--neo-text-primary)]">
                      {selectedReturnTx.book.title}
                    </h4>
                    <p className="text-xs text-[var(--neo-text-secondary)]">
                      Patron: <strong>{selectedReturnTx.member.name}</strong> ({selectedReturnTx.member.email})
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedReturnTx.daysOverdue > 0
                        ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {selectedReturnTx.daysOverdue > 0 ? 'Overdue Loan' : 'On Schedule'}
                  </span>
                </div>

                {/* Dates & Overdue Fine calculation */}
                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]">
                  <div>
                    <span className="text-[var(--neo-text-muted)] block text-[10px] uppercase font-bold">Due Date</span>
                    <span className="font-mono text-[var(--neo-text-primary)]">
                      {format(parseISO(selectedReturnTx.dueDate), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--neo-text-muted)] block text-[10px] uppercase font-bold">Estimated Fine</span>
                    <span
                      className={`font-mono font-bold ${
                        selectedReturnTx.estimatedFine > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      PKR {selectedReturnTx.estimatedFine.toFixed(2)}
                      {selectedReturnTx.daysOverdue > 0 && ` (${selectedReturnTx.daysOverdue} days)`}
                    </span>
                  </div>
                </div>

                {/* Condition Selector */}
                <div className="space-y-1.5 pt-2 border-t border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)]">
                  <label className="text-xs font-bold text-[var(--neo-text-secondary)] block">
                    Copy Return Condition
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['good', 'fair', 'poor', 'damaged'] as const).map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setCondition(cond)}
                        className={`py-1.5 rounded-xl text-xs font-bold capitalize transition-all border ${
                          condition === cond
                            ? cond === 'damaged'
                              ? 'bg-rose-600 text-white border-rose-600 shadow-[var(--neo-raised-sm)]'
                              : 'bg-[var(--neo-accent)] text-white border-[var(--neo-accent)] shadow-[var(--neo-raised-sm)]'
                            : 'bg-[var(--neo-surface)] text-[var(--neo-text-secondary)] border-[var(--neo-border-light)] dark:border-[var(--neo-border-dark)] shadow-[var(--neo-raised-sm)] hover:bg-[var(--neo-card)]'
                        }`}
                      >
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Damage Notes & Charge (if Damaged) */}
                {condition === 'damaged' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2 text-xs"
                  >
                    <label className="font-bold text-rose-900 dark:text-rose-200 block">
                      Damage Inspection & Charge
                    </label>
                    <textarea
                      value={damageNotes}
                      onChange={(e) => setDamageNotes(e.target.value)}
                      placeholder="Describe copy damage (torn pages, water damage, broken spine)..."
                      rows={2}
                      className="w-full p-2 rounded-lg border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 text-xs"
                    />
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Damage Fee (PKR):</span>
                      <input
                        type="number"
                        min="0"
                        value={damageCharge}
                        onChange={(e) => setDamageCharge(parseFloat(e.target.value) || 0)}
                        className="w-24 p-1.5 rounded border border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900 font-mono text-xs font-bold text-rose-600"
                      />
                    </div>
                  </motion.div>
                )}

                {/* Return Action */}
                <div className="pt-2">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleReturnBook}
                    isLoading={returning}
                    className="w-full text-xs font-bold py-2.5 bg-emerald-600 hover:bg-emerald-500 shadow-md"
                    leftIcon={<RotateCcw className="w-4 h-4" />}
                  >
                    Confirm Return & Check-In
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRM ISSUE MODAL */}
      <Modal
        open={issueConfirmOpen}
        onOpenChange={setIssueConfirmOpen}
        title="Confirm Circulation Checkout"
        description="Verify borrowing dates and loan policy before committing to system records."
        maxWidth="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setIssueConfirmOpen(false)} disabled={issuing}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleIssueBook}
              isLoading={issuing}
              leftIcon={<Check className="w-4 h-4" />}
            >
              Confirm 14-Day Checkout
            </Button>
          </>
        }
      >
        {selectedMember && selectedBook && (
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Patron</span>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedMember.name}</p>
              <p className="text-slate-500 font-mono">{selectedMember.memberId} • {selectedMember.email}</p>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Book Details</span>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{selectedBook.title}</p>
              <p className="text-slate-500 font-mono">ISBN: {selectedBook.isbn || 'N/A'} • Shelf: {selectedBook.shelfLocation}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Issue Date</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {format(new Date(), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="p-3 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Due Date (+14d)</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">
                  {format(addDays(new Date(), 14), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* SUCCESS CONFETTI & RECEIPT MODAL */}
      <Modal
        open={!!issueSuccessData}
        onOpenChange={(open) => !open && setIssueSuccessData(null)}
        title="Checkout Completed Successfully!"
        description="Official borrowing record has been committed to database."
        maxWidth="sm"
        footer={
          <Button variant="primary" size="sm" onClick={() => setIssueSuccessData(null)}>
            Done
          </Button>
        }
      >
        {issueSuccessData && (
          <div className="text-center space-y-4 py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-400 shadow-md">
              <Sparkles className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="font-display font-bold text-base text-slate-900 dark:text-slate-100">
                Book Successfully Issued
              </h3>
              <p className="text-xs text-slate-500 font-mono">Tx ID: {issueSuccessData.transactionId}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Patron:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{issueSuccessData.member.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Book:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">{issueSuccessData.book.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Due Date:</span>
                <span className="font-bold text-emerald-600 font-mono">{issueSuccessData.dueDate}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
