'use client';

import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { feesApi, schoolsApi, settingsApi } from '@/lib/api';
import { formatDate, formatCurrency, capitalize } from '@/lib/utils';
import { SchoolDocumentHeader } from '@/components/shared/school-document-header';

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
    onError: () => {
      toast.error('Only secretary or accountant can issue receipts');
    },
  });

  const { data: school } = useQuery({
    queryKey: ['school-me-receipt'],
    queryFn: async () => {
      const res = await schoolsApi.me();
      return res.data?.school ?? res.data?.data ?? res.data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['settings-receipt'],
    queryFn: async () => {
      const res = await settingsApi.get();
      return res.data?.settings ?? res.data?.data ?? res.data;
    },
  });

  useEffect(() => {
    if (!id || isLoading || !payment || issuingReceipt || issuedPayment || issueFailed) return;
    issueReceipt();
  }, [id, isLoading, payment, issuingReceipt, issuedPayment, issueFailed, issueReceipt]);

  useEffect(() => {
    if (issuedPayment) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [issuedPayment]);

  if (isLoading || !payment || issuingReceipt) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 text-sm">Preparing receipt…</p>
      </div>
    );
  }

  if (issueFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-sm text-red-600">
          You do not have permission to issue this receipt. Only secretary or accountant can issue receipts.
        </p>
      </div>
    );
  }

  const receipt = issuedPayment ?? payment;
  const student = receipt.studentId;
  const receiptDate = receipt.receiptIssuedAt ?? receipt.paymentDate ?? receipt.createdAt;
  const recorder = receipt.receiptIssuedByUserId
    ? `${receipt.receiptIssuedByUserId.firstName} ${receipt.receiptIssuedByUserId.lastName}`
    : receipt.recordedByUserId
      ? `${receipt.recordedByUserId.firstName} ${receipt.recordedByUserId.lastName}`
    : '—';
  const className = receipt.classId
    ? `${receipt.classId.name}${receipt.classId.stream ? ` ${receipt.classId.stream}` : ''}`
    : '—';

  const rows = [
    ['Student Name', student ? `${student.firstName} ${student.lastName}` : '—'],
    ['Admission No.', student?.admissionNumber ?? '—'],
    ['Class', className],
    ['Academic Year', receipt.academicYear],
    ['Term', receipt.term],
    ['Payment Method', capitalize(receipt.method ?? '')],
    receipt.reference ? ['Ref / Transaction Code', receipt.reference] : null,
    receipt.notes ? ['Notes', receipt.notes] : null,
  ].filter(Boolean);

  return (
    <>
      <style>{`
        @page { margin: 12mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden; }
          #receipt-print-root, #receipt-print-root * { visibility: visible; }
          #receipt-print-root { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        #receipt-print-root { font-family: Arial, sans-serif; color: #111; }
        #receipt-print-root table { border-collapse: collapse; width: 100%; }
        #receipt-print-root td { padding: 8px 10px; border-bottom: 1px solid #eee; font-size: 13px; }
      `}</style>

      <div className="no-print flex justify-end gap-2 p-4 bg-gray-50 border-b">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Print / Save as PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
        >
          Close
        </button>
      </div>

      <div className="max-w-[520px] mx-auto p-4 bg-white" id="receipt-print-root">
        <SchoolDocumentHeader
          school={school}
          settings={settings}
          title="Finance"
          subtitle="Fee Payment Receipt"
          serial={receipt.receiptNumber ?? ''}
          generatedAt={receiptDate ? formatDate(receiptDate) : ''}
        />
        <div className="bg-blue-50 text-center py-2 text-xs font-bold tracking-widest border border-t-0 border-blue-200 uppercase">
          Fee Payment Receipt
        </div>

        <div className="border border-t-0 border-b-0 px-4 py-3 bg-gray-50 flex items-start justify-between gap-3 text-xs">
          <div>
            <p className="text-gray-400 uppercase tracking-wide text-[10px]">Receipt No.</p>
            <p className="font-bold text-sm text-blue-800 font-mono">
              {receipt.receiptNumber ?? '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 uppercase tracking-wide text-[10px]">Date</p>
            <p className="font-semibold">{receiptDate ? formatDate(receiptDate) : '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 uppercase tracking-wide text-[10px]">Issued By</p>
            <p className="font-semibold">{recorder}</p>
          </div>
        </div>

        <div className="border border-t-0 px-4 py-3">
          <table>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="text-muted-foreground w-[45%]">{label}</td>
                  <td className="font-medium text-right max-w-[60%]">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="bg-amber-50 rounded p-3 mt-3 flex justify-between items-center">
            <span className="font-bold text-sm">TOTAL PAID</span>
            <span className="font-bold text-amber-600 text-xl">{formatCurrency(receipt.amount)}</span>
          </div>
        </div>

        <div className="border border-t-0 rounded-b-md p-3 text-center text-xs text-muted-foreground">
          This is an official receipt. Please retain for your records.
          <br />Powered by Diraschool
        </div>
      </div>
    </>
  );
}
