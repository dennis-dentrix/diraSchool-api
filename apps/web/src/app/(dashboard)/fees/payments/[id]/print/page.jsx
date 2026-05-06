'use client';

import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
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
      toast.error('You do not have permission to issue this receipt');
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="text-sm">Preparing receipt…</span>
      </div>
    );
  }

  if (issueFailed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-sm text-red-600">
          You do not have permission to issue this receipt.
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
    ['Receipt No.', receipt.receiptNumber ?? '—'],
    ['Date', receiptDate ? formatDate(receiptDate) : '—'],
    ['Student Name', student ? `${student.firstName} ${student.lastName}` : '—'],
    ['Admission No.', student?.admissionNumber ?? '—'],
    ['Class', className],
    ['Academic Year', receipt.academicYear],
    ['Term', receipt.term],
    ['Payment Method', capitalize(receipt.method ?? '')],
    receipt.reference ? ['Ref / Transaction Code', receipt.reference] : null,
    ['Issued By', recorder],
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
        .receipt-box { border: 1px solid #d7deea; border-radius: 8px; overflow: hidden; }
        .receipt-title { background: #f8fafc; border-bottom: 1px solid #e5e7eb; padding: 12px 14px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
        .receipt-total { border-top: 2px solid #111; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; }
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
        <div className="receipt-box">
          <div className="receipt-title">Fee Payment Receipt</div>
          <div className="px-4 py-3">
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
          </div>

          <div className="receipt-total">
            <span className="font-bold text-sm">TOTAL PAID</span>
            <span className="font-bold text-xl">{formatCurrency(receipt.amount)}</span>
          </div>
        </div>

        <div className="p-3 text-center text-xs text-muted-foreground">
          This is an official receipt. Please retain for your records.
          <br />Powered by Diraschool
        </div>
      </div>
    </>
  );
}
