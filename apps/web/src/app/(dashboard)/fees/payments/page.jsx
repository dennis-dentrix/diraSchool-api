'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { feesApi, studentsApi, classesApi, exportApi, downloadBlob, getErrorMessage } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, capitalize } from '@/lib/utils';
import { PAYMENT_METHODS, ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDebounce } from '@/hooks/use-debounce';

const schema = z.object({
  studentId: z.string().min(1, 'Required'),
  classId: z.string().min(1, 'Required'),
  amount: z.coerce.number().positive('Must be positive'),
  method: z.enum(['cash', 'mpesa', 'bank']),
  reference: z.string().optional(),
  academicYear: z.string().min(1, 'Required'),
  term: z.string().min(1, 'Required'),
});

const columns = (onReverse) => [
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
  { accessorKey: 'amount', header: 'Amount', cell: ({ row }) => <span className="font-semibold">{formatCurrency(row.original.amount)}</span> },
  { accessorKey: 'method', header: 'Method', cell: ({ row }) => <span className="capitalize text-sm">{row.original.method}</span> },
  { accessorKey: 'reference', header: 'Reference', cell: ({ row }) => <span className="text-sm font-mono">{row.original.reference ?? '—'}</span> },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(row.original.status)}`}>
        {row.original.status}
      </span>
    ),
  },
  { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span> },
  {
    id: 'actions',
    cell: ({ row }) => row.original.status === 'completed' ? (
      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
        onClick={() => onReverse(row.original)}>Reverse</Button>
    ) : null,
  },
];

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reverseReason, setReverseReason] = useState('');
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [termFilter, setTermFilter] = useState('');
  const debouncedSearch = useDebounce(search, 400);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: String(new Date().getFullYear()), term: 'Term 1' },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['payments', page, debouncedSearch, methodFilter, statusFilter, yearFilter, termFilter],
    queryFn: async () => {
      const res = await feesApi.listPayments({
        page, limit: 20,
        search: debouncedSearch || undefined,
        method: methodFilter || undefined,
        status: statusFilter || undefined,
        academicYear: yearFilter || undefined,
        term: termFilter || undefined,
      });
      return res.data;
    },
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students', 'all'],
    queryFn: async () => {
      const res = await studentsApi.list({ limit: 200, status: 'active' });
      return res.data;
    },
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 100 });
      return res.data;
    },
  });

  const { mutate: createPayment, isPending } = useMutation({
    mutationFn: (data) => feesApi.createPayment(data),
    onSuccess: () => {
      toast.success('Payment recorded');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: reversePayment } = useMutation({
    mutationFn: ({ id, reason }) => feesApi.reversePayment(id, { reason }),
    onSuccess: () => {
      toast.success('Payment reversed');
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      setReverseTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Payments" description="Record and manage fee payments">
        <Button variant="outline" size="sm"
          onClick={async () => {
            try { downloadBlob(await exportApi.payments(), 'payments.csv'); }
            catch { toast.error('Export failed'); }
          }}
        >
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Record Payment
        </Button>
      </PageHeader>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reference…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9"
          />
        </div>
        <Select value={methodFilter} onValueChange={(v) => { setMethodFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Method" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{capitalize(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={(v) => { setYearFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[120px]"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All years</SelectItem>
            {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={termFilter} onValueChange={(v) => { setTermFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-9 w-[110px]"><SelectValue placeholder="Term" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All terms</SelectItem>
            {TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || methodFilter || statusFilter || yearFilter || termFilter) && (
          <Button variant="ghost" size="sm" className="h-9"
            onClick={() => { setSearch(''); setMethodFilter(''); setStatusFilter(''); setYearFilter(''); setTermFilter(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      <DataTable
        columns={columns((payment) => setReverseTarget(payment))}
        data={data?.data}
        loading={isLoading}
        pageCount={data?.pagination?.totalPages}
        currentPage={page}
        onPageChange={setPage}
      />

      {/* Record payment dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createPayment)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Student</Label>
              <Select onValueChange={(v) => setValue('studentId', v)}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {studentsData?.data?.map((s) => (
                    <SelectItem key={s._id} value={s._id}>
                      {s.firstName} {s.lastName} — {s.admissionNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.studentId && <p className="text-xs text-destructive">{errors.studentId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select onValueChange={(v) => setValue('classId', v)}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classesData?.data?.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (KES)</Label>
                <Input {...register('amount')} type="number" placeholder="5000" />
                {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select onValueChange={(v) => setValue('method', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{capitalize(m)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {errors.method && <p className="text-xs text-destructive">{errors.method.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reference / M-Pesa Code (optional)</Label>
              <Input {...register('reference')} placeholder="QAB1234XY" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select defaultValue={String(new Date().getFullYear())} onValueChange={(v) => setValue('academicYear', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select defaultValue="Term 1" onValueChange={(v) => setValue('term', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Record Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reverse dialog */}
      <Dialog open={!!reverseTarget} onOpenChange={() => setReverseTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reverse Payment</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Reversing {formatCurrency(reverseTarget?.amount ?? 0)} for{' '}
            {reverseTarget?.studentId?.firstName} {reverseTarget?.studentId?.lastName}.
          </p>
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Input value={reverseReason} onChange={(e) => setReverseReason(e.target.value)} placeholder="Entered in error…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!reverseReason}
              onClick={() => reversePayment({ id: reverseTarget._id, reason: reverseReason })}>
              Confirm Reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
