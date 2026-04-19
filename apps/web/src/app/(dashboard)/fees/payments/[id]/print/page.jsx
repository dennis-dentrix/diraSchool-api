'use client';

import { useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { toast } from 'sonner';
import { feesApi, schoolsApi } from '@/lib/api';
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
  const schoolName = school?.name ?? 'School';
  const receiptDate = receipt.receiptIssuedAt ?? receipt.paymentDate ?? receipt.createdAt;
  const recorder = receipt.receiptIssuedByUserId
    ? `${receipt.receiptIssuedByUserId.firstName} ${receipt.receiptIssuedByUserId.lastName}`
    : '—';

  const rows = [
    ['Student Name', student ? `${student.firstName} ${student.lastName}` : '—'],
    ['Admission No.', student?.admissionNumber ?? '—'],
    ['Academic Year', receipt.academicYear],
    ['Term', receipt.term],
    ['Payment Method', capitalize(receipt.method ?? '')],
    receipt.reference ? ['Ref / Transaction Code', receipt.reference] : null,
    receipt.notes ? ['Notes', receipt.notes] : null,
  ].filter(Boolean);

  return (
    <>
      <style>{`
        @page { size: A5 portrait; margin: 12mm; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body * { visibility: hidden; }
          #receipt-print-root, #receipt-print-root * { visibility: visible; }
          #receipt-print-root { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
        #receipt-print-root { font-family: Arial, sans-serif; font-size: 11pt; color: #111; }
        #receipt-print-root table { border-collapse: collapse; width: 100%; }
        #receipt-print-root td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 10pt; }
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

      <div className="max-w-[480px] mx-auto p-4 bg-white" id="receipt-print-root">
        {/* School header */}
        <div className="bg-[#1e3a5f] text-white px-5 py-4 text-center rounded-t-md">
          <h1 className="text-lg font-bold leading-tight">{schoolName}</h1>
          {school?.address && <p className="text-xs opacity-75 mt-0.5">{school.address}</p>}
          {school?.phone && <p className="text-xs opacity-75">{school.phone}</p>}
        </div>
        <div className="bg-blue-50 text-center py-2 text-xs font-bold tracking-widest border border-t-0 border-blue-200 uppercase">
          Official Fee Payment Receipt
        </div>

        {/* Tracking number + meta strip */}
        <div className="border border-t-0 border-b-0 px-4 py-3 bg-gray-50 flex items-start justify-between gap-3 text-xs">
          <div>
            <p className="text-gray-500 uppercase tracking-wide text-[10px]">Receipt No.</p>
            <p className="font-bold text-base text-[#1e3a5f] font-mono">
              {receipt.receiptNumber ?? '—'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 uppercase tracking-wide text-[10px]">Date Issued</p>
            <p className="font-semibold">{receiptDate ? formatDate(receiptDate) : '—'}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 uppercase tracking-wide text-[10px]">Issued By</p>
            <p className="font-semibold">{recorder}</p>
          </div>
        </div>

        {/* Payment details */}
        <div className="border border-t-0 px-1">
          <table>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label}>
                  <td className="text-gray-500 w-[45%]">{label}</td>
                  <td className="font-medium">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total highlight */}
          <div className="bg-amber-50 border border-amber-200 rounded mx-2 my-3 px-3 py-2.5 flex justify-between items-center">
            <span className="font-bold text-sm">TOTAL PAID</span>
            <span className="font-bold text-amber-600 text-xl">{formatCurrency(receipt.amount)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border border-t-0 rounded-b-md px-4 py-2.5 text-center text-xs text-gray-400">
          This is an official receipt. Please retain for your records.
          <br />Powered by Diraschool · {schoolName}
        </div>
      </div>
    </>
  );
}
