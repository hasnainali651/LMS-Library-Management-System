'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import { Printer, Receipt, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface FineReceiptData {
  receiptNumber?: string;
  id?: string;
  _id?: string;
  fineDate?: string;
  createdAt?: string;
  paidAt?: string;
  bookTitle: string;
  author?: string;
  daysOverdue?: number;
  finePerDay?: number;
  damageCharge?: number;
  type?: 'overdue' | 'damage' | 'loss' | string;
  amount: number;
  paidAmount?: number;
  status: 'paid' | 'pending' | 'waived' | 'partial' | string;
  paymentMethod?: 'cash' | 'online' | string;
  memberName?: string;
  memberId?: string;
}

export interface FineReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fine: FineReceiptData | null;
}

export const FineReceiptModal: React.FC<FineReceiptModalProps> = ({
  open,
  onOpenChange,
  fine,
}) => {
  if (!fine) return null;

  const handlePrint = () => {
    window.print();
  };

  const receiptNumber =
    fine.receiptNumber ||
    `RCP-${fine.id?.slice(-6) || fine._id?.slice(-6) || Date.now().toString().slice(-8)}`;

  const fineDate = fine.paidAt || fine.createdAt || fine.fineDate || new Date().toISOString();
  let formattedDate = 'Recent';
  try {
    formattedDate = format(parseISO(fineDate), 'MMMM d, yyyy h:mm a');
  } catch {
    formattedDate = fineDate;
  }

  const isPaid = fine.status.toLowerCase() === 'paid';
  const isWaived = fine.status.toLowerCase() === 'waived';
  const fineType = fine.type || 'overdue';

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Official Library Receipt"
      description="Record of fee settlement and circulation transaction."
      maxWidth="lg"
      className="fine-receipt-dialog"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handlePrint}
            leftIcon={<Printer className="w-4 h-4" />}
          >
            Print Receipt
          </Button>
        </>
      }
    >
      <div id="fine-printable-area" className="p-5 sm:p-6 rounded-[var(--neo-r-lg)] bg-[var(--neo-card)] border border-[var(--neo-border-light)] [box-shadow:var(--neo-raised-sm)] space-y-6 text-[var(--neo-text)] print:bg-white print:text-black print:border-none print:p-0">
        {/* Header / Brand */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[var(--neo-shadow-dark)]/25">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[var(--neo-r-xs)] bg-[var(--neo-accent)] text-white flex items-center justify-center font-bold text-xs [box-shadow:var(--neo-raised-sm)] print:bg-black">
                NL
              </div>
              <h3 className="font-display font-bold text-base tracking-tight text-[var(--neo-text)] print:text-black">
                NextGen Community Library
              </h3>
            </div>
            <p className="text-[11px] text-[var(--neo-text-3)] mt-1 print:text-gray-600">
              Circulation Desk & Payment Division
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="font-mono text-xs font-bold text-[var(--neo-accent)] px-2.5 py-1 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] border border-[var(--neo-border-light)] inline-block print:border-black">
              {receiptNumber}
            </span>
            <p className="text-[11px] text-[var(--neo-text-3)] mt-1 tabular-nums">{formattedDate}</p>
          </div>
        </div>

        {/* Member and Status Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-[var(--neo-r-sm)] bg-[var(--neo-surface)] border border-[var(--neo-border-light)] text-xs print:bg-transparent">
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--neo-text-3)] tracking-wider">Patron</p>
            <p className="font-semibold text-[var(--neo-text)] mt-0.5 truncate">{fine.memberName || 'Member'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--neo-text-3)] tracking-wider">Account ID</p>
            <p className="font-mono font-medium text-[var(--neo-text)] mt-0.5 truncate">{fine.memberId || 'N/A'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--neo-text-3)] tracking-wider">Status</p>
            <p className="font-bold text-[var(--neo-success)] mt-0.5 capitalize">{fine.status}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-[var(--neo-text-3)] tracking-wider">Method</p>
            <p className="font-semibold text-[var(--neo-text)] mt-0.5 capitalize">{fine.paymentMethod || 'Cash at Counter'}</p>
          </div>
        </div>

        {/* Breakdown Table */}
        <div className="border border-[var(--neo-border-light)] rounded-[var(--neo-r-sm)] overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-[var(--neo-surface)] border-b border-[var(--neo-shadow-dark)]/25 text-[var(--neo-text-2)] font-bold uppercase tracking-wider">
              <tr>
                <th className="p-3">Description</th>
                <th className="p-3 text-center">Type</th>
                <th className="p-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--neo-shadow-dark)]/15">
              <tr>
                <td className="p-3">
                  <p className="font-bold text-[var(--neo-text)]">{fine.bookTitle}</p>
                  {fine.author && <p className="text-[11px] text-[var(--neo-text-3)]">by {fine.author}</p>}
                  {fine.daysOverdue ? (
                    <p className="text-[11px] text-[var(--neo-danger)] mt-0.5 tabular-nums">
                      {fine.daysOverdue} days overdue
                    </p>
                  ) : null}
                </td>
                <td className="p-3 text-center capitalize text-[var(--neo-text-2)] font-medium">
                  {fineType}
                </td>
                <td className="p-3 text-right font-bold text-[var(--neo-text)] tabular-nums">
                  PKR {fine.amount.toFixed(2)}
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-[var(--neo-surface)] font-bold border-t border-[var(--neo-shadow-dark)]/25 text-sm">
              <tr>
                <td colSpan={2} className="p-3 text-right text-[var(--neo-text-2)]">Total Settled:</td>
                <td className="p-3 text-right text-[var(--neo-accent)] tabular-nums">
                  PKR {(fine.paidAmount || fine.amount).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </Modal>
  );
};
