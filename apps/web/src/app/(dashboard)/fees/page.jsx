'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, TrendingUp, AlertCircle, ArrowRight } from 'lucide-react';
import { feesApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

function PaymentRow({ payment }) {
  const method = payment.method ?? '';
  const isMpesa = method.toLowerCase() === 'mpesa';
  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          {payment.studentId?.firstName ?? '—'} {payment.studentId?.lastName ?? ''}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {payment.studentId?.admissionNumber ?? ''}
          {payment.term ? ` · ${payment.term}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span
          className={`hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium ${
            isMpesa ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {isMpesa ? 'M-Pesa' : method || 'Cash'}
        </span>
        <span className="text-sm font-semibold tabular-nums">{formatCurrency(payment.amount)}</span>
        <span className="text-xs text-muted-foreground w-20 text-right hidden md:block">
          {formatDate(payment.createdAt)}
        </span>
      </div>
    </div>
  );
}

export default function FeesPage() {
  const router = useRouter();

  const { data: paymentsRes, isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () => {
      const res = await feesApi.listPayments({ limit: 10 });
      return res.data;
    },
  });

  const { data: summaryRes, isLoading: summaryLoading } = useQuery({
    queryKey: ['fees-dashboard-summary'],
    queryFn: async () => {
      const res = await feesApi.dashboardSummary();
      return res.data;
    },
  });

  const payments = paymentsRes?.data ?? paymentsRes ?? [];
  const monthCollected = summaryRes?.summary?.monthToDate?.totalAmount ?? 0;
  const followUpCount  = summaryRes?.summary?.students?.followUpCount  ?? 0;

  // Count today's payments from the loaded list for a live subtitle
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = Array.isArray(payments)
    ? payments.filter((p) => String(p.createdAt ?? '').slice(0, 10) === todayStr).length
    : 0;

  return (
    <div className="space-y-5" data-tour="finance-dashboard">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Fees &amp; Payments</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {todayCount > 0
              ? `${todayCount} payment${todayCount !== 1 ? 's' : ''} recorded today`
              : 'No payments recorded today yet'}
          </p>
        </div>
        <Button onClick={() => router.push('/fees/payments')} className="shrink-0 gap-2">
          <CreditCard className="h-4 w-4" />
          <span>Record Payment</span>
        </Button>
      </div>

      {/* ── Two key numbers ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4">

        {/* Collected this month */}
        <Card data-tour="todays-collections">
          <CardContent className="pt-5 pb-4">
            {summaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-24" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Collected this month
                </p>
                <p className="text-3xl font-bold mt-1 tabular-nums">{formatCurrency(monthCollected)}</p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                  <span className="text-xs text-green-700 font-medium">All payment methods</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Students needing follow-up */}
        <Card
          data-tour="fee-balances-widget"
          className={followUpCount > 0 ? 'cursor-pointer hover:shadow-md transition-shadow border-orange-200' : ''}
          onClick={followUpCount > 0 ? () => router.push('/fees/payments') : undefined}
        >
          <CardContent className="pt-5 pb-4">
            {summaryLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-8 w-16" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                  Need follow-up
                </p>
                <p className={`text-3xl font-bold mt-1 ${followUpCount > 0 ? 'text-orange-600' : ''}`}>
                  {followUpCount}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {followUpCount > 0 ? 'Students with unpaid fees — tap to view' : 'All students up to date'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Unallocated payments notice (only shown when relevant) ─────────── */}
      <div className="hidden" data-tour="unallocated-payments">
        {/* Referenced by the tour; shown in the Payments sub-page */}
      </div>

      {/* ── Recent payments ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold">Recent Payments</CardTitle>
          <Link
            href="/fees/payments"
            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {paymentsLoading ? (
            <div className="space-y-3 py-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Skeleton className="h-3.5 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : !Array.isArray(payments) || payments.length === 0 ? (
            <div className="py-10 text-center">
              <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push('/fees/payments')}
              >
                Record the first payment
              </Button>
            </div>
          ) : (
            <div>
              {payments.map((p) => (
                <PaymentRow key={p._id} payment={p} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tour anchor: finance reports ─────────────────────────────────────── */}
      <div data-tour="finance-reports" className="hidden" />
    </div>
  );
}
