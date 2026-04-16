'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, CheckCircle } from 'lucide-react';
import { attendanceApi, classesApi, getErrorMessage } from '@/lib/api';
import { formatDate, getStatusColor, capitalize } from '@/lib/utils';
import { ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

const columns = (onView, onSubmit) => [
  {
    accessorKey: 'classId',
    header: 'Class',
    cell: ({ row }) => {
      const cls = row.original.classId;
      return <span className="font-medium">{typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—'}</span>;
    },
  },
  { accessorKey: 'date', header: 'Date', cell: ({ row }) => <span>{formatDate(row.original.date)}</span> },
  { accessorKey: 'term', header: 'Term', cell: ({ row }) => <span className="text-sm">{row.original.term}</span> },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(row.original.status)}`}>
        {capitalize(row.original.status)}
      </span>
    ),
  },
  {
    id: 'entries',
    header: 'Entries',
    cell: ({ row }) => <span className="text-sm">{row.original.entries?.length ?? 0} students</span>,
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(row.original._id)}>Open register</DropdownMenuItem>
          {row.original.status === 'draft' && (
            <DropdownMenuItem onClick={() => onSubmit(row.original._id)}>
              <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Submit register
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function AttendancePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [classFilter, setClassFilter] = useState('');
  const [newReg, setNewReg] = useState({ classId: '', academicYear: String(new Date().getFullYear()), term: 'Term 1', date: new Date().toISOString().split('T')[0] });

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', page, classFilter],
    queryFn: async () => {
      const res = await attendanceApi.listRegisters({ page, limit: 20, classId: classFilter || undefined });
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

  const { mutate: createRegister, isPending } = useMutation({
    mutationFn: () => attendanceApi.createRegister(newReg),
    onSuccess: (res) => {
      toast.success('Attendance register created');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      setOpen(false);
      router.push(`/attendance/${res.data.data._id}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: submitRegister } = useMutation({
    mutationFn: (id) => attendanceApi.submitRegister(id),
    onSuccess: () => {
      toast.success('Register submitted and locked');
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Attendance" description="Daily attendance registers">
        <Select value={classFilter} onValueChange={(v) => setClassFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All classes</SelectItem>
            {classesData?.data?.map((c) => (
              <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Register
        </Button>
      </PageHeader>

      <DataTable
        columns={columns(
          (id) => router.push(`/attendance/${id}`),
          (id) => { if (confirm('Submit and lock this register?')) submitRegister(id); },
        )}
        data={data?.data}
        loading={isLoading}
        pageCount={data?.pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Create Attendance Register</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select onValueChange={(v) => setNewReg((p) => ({ ...p, classId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classesData?.data?.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <input type="date" value={newReg.date}
                onChange={(e) => setNewReg((p) => ({ ...p, date: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select defaultValue={newReg.academicYear} onValueChange={(v) => setNewReg((p) => ({ ...p, academicYear: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select defaultValue={newReg.term} onValueChange={(v) => setNewReg((p) => ({ ...p, term: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => createRegister()} disabled={isPending || !newReg.classId}>Create Register</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
