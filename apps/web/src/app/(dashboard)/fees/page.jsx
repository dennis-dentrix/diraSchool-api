'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CreditCard, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { feesApi } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { StatCard } from '@/components/shared/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';

const paymentColumns = [
  {
    id: 'student',
    header: 'Student',
    cell: ({ row }) => (
      <div>
        <p className="font-medium text-sm">
          {row.original.studentId?.firstName ?? '—'} {row.original.studentId?.lastName ?? ''}
        </p>
        <p className="text-xs text-muted-foreground">{row.original.term} · {row.original.academicYear}</p>
      </div>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => <span className="font-semibold">{formatCurrency(row.original.amount)}</span>,
  },
  {
    accessorKey: 'method',
    header: 'Method',
    cell: ({ row }) => <span className="capitalize text-sm">{row.original.method}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(row.original.status)}`}>
        {row.original.status}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Date',
    cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span>,
  },
];

export default function FeesPage() {
  const { data: payments, isLoading, isError, error } = useQuery({
    queryKey: ['payments', 'recent'],
    queryFn: async () => {
      const res = await feesApi.listPayments({ limit: 10 });
      return res.data;
    },
  });

  const { data: financeSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['fees-dashboard-summary'],
    queryFn: async () => {
      const res = await feesApi.dashboardSummary();
      return res.data;
    },
  });

  const { data: structures } = useQuery({
    queryKey: ['fee-structures', 'count'],
    queryFn: async () => {
      const res = await feesApi.listStructures({ limit: 1 });
      return res.data;
    },
  });

  const monthCollected = financeSummary?.summary?.monthToDate?.totalAmount ?? 0;
  const followUpCount = financeSummary?.summary?.students?.followUpCount ?? 0;

  return (
    <div className="space-y-6" data-tour="finance-dashboard">
      <PageHeader title="Fees & Payments" description="Track fee collection and structures">
        <Link href="/fees/structures">
          <Button variant="outline" size="sm"><FileText className="h-4 w-4" /> Fee Structures</Button>
        </Link>
        <Link href="/fees/payments">
          <Button size="sm"><CreditCard className="h-4 w-4" /> Record Payment</Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="This Month Collected" value={formatCurrency(monthCollected)} icon={TrendingUp} color="green" loading={summaryLoading} description="Server-side totals" />
        <StatCard title="Fee Structures" value={structures?.pagination?.total ?? '—'} icon={FileText} color="blue" description="Configured" />
        <StatCard
          data-tour="fee-balances-widget"
          title="Need Follow-up"
          value={followUpCount}
          icon={AlertCircle}
          color="orange"
          loading={summaryLoading}
          description="Active students unpaid this month"
        />
      </div>

      {/* Finance tour target: unallocated payments shortcut */}
      <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm" data-tour="unallocated-payments">
        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-amber-800 flex-1">Payments not matched to a student appear here. <Link href="/fees/payments?filter=unallocated" className="font-semibold underline hover:no-underline">Review unallocated payments →</Link></span>
      </div>

      <Card data-tour="todays-collections">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent Payments</CardTitle>
          <Link href="/fees/payments" className="text-sm text-blue-600 hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          <DataTable columns={paymentColumns} data={payments?.data} loading={isLoading} error={isError ? error : null} />
        </CardContent>
      </Card>

      {/* Finance tour target: reports quick access */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3" data-tour="finance-reports">
        <div>
          <p className="text-sm font-medium">Financial Reports</p>
          <p className="text-xs text-muted-foreground">Export fee collection, defaulter lists, and payment summaries</p>
        </div>
        <Link href="/fees/payments">
          <Button variant="outline" size="sm"><TrendingUp className="h-4 w-4 mr-1.5" /> View Reports</Button>
        </Link>
      </div>
    </div>
  );
}
