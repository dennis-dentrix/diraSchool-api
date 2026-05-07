'use client';

import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Printer, X } from 'lucide-react';
import { feesApi, schoolsApi, settingsApi } from '@/lib/api';
import { formatDate, formatCurrency, capitalize } from '@/lib/utils';

export default function PaymentReceiptPrintPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data: payment, isLoading } = useQuery({
    queryKey: ['payment-print', id],
    queryFn: async () => {
      const res = await feesApi.getPayment(id);
      return res.data?.payment ?? res.data?.data ?? res.data;
    },
    enabled: !!id,
  });

  const {
    mutate: issueReceipt,
    data: issuedPayment,
    isPending: issuingReceipt,
    isError: issueFailed,
  } = useMutation({
    mutationFn: async () => {
      const res = await feesApi.issueReceipt(id);
      return res.data?.payment ?? res.data?.data ?? res.data;
    },
    onError: () => toast.error('You do not have permission to issue this receipt'),
  });

  const { data: school } = useQuery({
    queryKey: ['school-me-receipt'],
    queryFn: async () => { const res = await schoolsApi.me(); return res.data?.school ?? res.data?.data ?? res.data; },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings-receipt'],
    queryFn: async () => { const res = await settingsApi.get(); return res.data?.settings ?? res.data?.data ?? res.data; },
  });

  useEffect(() => {
    if (!id || isLoading || !payment || issuingReceipt || issuedPayment || issueFailed) return;
    issueReceipt();
  }, [id, isLoading, payment, issuingReceipt, issuedPayment, issueFailed, issueReceipt]);

  useEffect(() => {
    if (issuedPayment) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [issuedPayment]);

  if (isLoading || !payment || issuingReceipt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-sm">Preparing receipt…</span>
      </div>
    );
  }

  if (issueFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-sm text-destructive">You do not have permission to issue this receipt.</p>
      </div>
    );
  }

  const receipt     = issuedPayment ?? payment;
  const student     = receipt.studentId;
  const receiptDate = receipt.receiptIssuedAt ?? receipt.paymentDate ?? receipt.createdAt;
  const recorder    = receipt.receiptIssuedByUserId
    ? `${receipt.receiptIssuedByUserId.firstName} ${receipt.receiptIssuedByUserId.lastName}`
    : receipt.recordedByUserId
      ? `${receipt.recordedByUserId.firstName} ${receipt.recordedByUserId.lastName}`
      : '—';
  const className   = receipt.classId
    ? `${receipt.classId.name}${receipt.classId.stream ? ` ${receipt.classId.stream}` : ''}`
    : '—';
  const schoolName  = school?.name ?? settings?.schoolName ?? 'School';
  const schoolLogo  = school?.logoUrl ?? settings?.logoUrl ?? null;
  const schoolAddr  = school?.address ?? '';
  const schoolPhone = school?.phone ?? '';

  const rows = [
    ['Date', receiptDate ? formatDate(receiptDate) : '—'],
    ['Student Name', student ? `${student.firstName} ${student.lastName}` : '—'],
    ['Admission No.', student?.admissionNumber ?? '—'],
    ['Class', className],
    ['Academic Year', receipt.academicYear ?? '—'],
    ['Term', receipt.term ?? '—'],
    ['Payment Method', capitalize(receipt.method ?? '')],
    receipt.reference ? ['Ref / Transaction Code', receipt.reference] : null,
    ['Issued By', recorder],
    receipt.notes ? ['Notes', receipt.notes] : null,
  ].filter(Boolean);

  return (
    <>
      <style>{`
        @page { size: A4; margin: 16mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      {/* Screen-only toolbar */}
      <div className="no-print flex items-center justify-between gap-2 px-4 py-3 bg-muted border-b sticky top-0 z-10">
        <p className="text-sm font-medium">Receipt Preview</p>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-sm rounded-md hover:bg-foreground/90 transition-colors"
          >
            <Printer className="h-4 w-4" /> Print / Save PDF
          </button>
          <button
            onClick={() => window.close()}
            className="inline-flex items-center gap-1.5 px-3 py-2 border rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" /> Close
          </button>
        </div>
      </div>

      {/* Paper receipt */}
      <div className="max-w-[520px] mx-auto my-6 px-4 bg-white" id="receipt-print-root">
        {/* School header */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {schoolLogo && (
              <img src={schoolLogo} alt="School logo" className="h-12 w-12 object-contain rounded" />
            )}
            <div>
              <p className="font-bold text-base leading-tight">{schoolName}</p>
              {schoolAddr && <p className="text-xs text-muted-foreground">{schoolAddr}</p>}
              {schoolPhone && <p className="text-xs text-muted-foreground">{schoolPhone}</p>}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Receipt No.</p>
            <p className="font-mono text-lg font-bold tabular-nums">{receipt.receiptNumber ?? '—'}</p>
          </div>
        </div>

        {/* Hairline rule */}
        <div className="border-t mb-5" />

        {/* Title */}
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-4 text-center">
          Fee Payment Receipt
        </p>

        {/* Items table */}
        <table className="w-full text-sm mb-0">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-b last:border-0">
                <td className="py-2 pr-4 text-muted-foreground w-[45%] align-top">{label}</td>
                <td className="py-2 font-medium text-right">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Total */}
        <div className="border-t-2 border-foreground mt-0 pt-3 flex items-center justify-between">
          <span className="text-sm font-bold uppercase tracking-wide">Total Paid</span>
          <span className="font-mono text-2xl font-bold tabular-nums">{formatCurrency(receipt.amount)}</span>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[11px] text-muted-foreground border-t pt-4">
          This is an official receipt. Please retain for your records.
        </p>
      </div>
    </>
  );
}
