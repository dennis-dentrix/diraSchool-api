'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Upload, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { studentsApi, classesApi, getErrorMessage } from '@/lib/api';
import { formatDate, getStatusColor, capitalize } from '@/lib/utils';
import { STUDENT_STATUSES, ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDebounce } from '@/hooks/use-debounce';
import { useRouter } from 'next/navigation';

const schema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  admissionNumber: z.string().min(1, 'Required'),
  gender: z.enum(['male', 'female']),
  dateOfBirth: z.string().min(1, 'Required'),
  classId: z.string().min(1, 'Required'),
});

const columns = (onView, onWithdraw) => [
  {
    accessorKey: 'admissionNumber',
    header: 'Adm No.',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.admissionNumber}</span>,
  },
  {
    id: 'name',
    header: 'Student Name',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.firstName} {row.original.lastName}</p>
        <p className="text-xs text-muted-foreground capitalize">{row.original.gender}</p>
      </div>
    ),
  },
  {
    accessorKey: 'classId',
    header: 'Class',
    cell: ({ row }) => {
      const cls = row.original.classId;
      return <span className="text-sm">{typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—'}</span>;
    },
  },
  {
    accessorKey: 'dateOfBirth',
    header: 'Date of Birth',
    cell: ({ row }) => <span className="text-sm">{formatDate(row.original.dateOfBirth)}</span>,
  },
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
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(row.original._id)}>View details</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onWithdraw(row.original)} className="text-destructive">
            Withdraw
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function StudentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('active');
  const debouncedSearch = useDebounce(search, 400);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['students', page, debouncedSearch, selectedStatus],
    queryFn: async () => {
      const res = await studentsApi.list({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        status: selectedStatus || undefined,
      });
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

  const { mutate: createStudent, isPending } = useMutation({
    mutationFn: (data) => studentsApi.create(data),
    onSuccess: () => {
      toast.success('Student enrolled successfully');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: withdrawStudent } = useMutation({
    mutationFn: ({ id, reason }) => studentsApi.withdraw(id, { reason }),
    onSuccess: () => {
      toast.success('Student withdrawn');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Students" description="Manage student enrollment and records">
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Enroll Student
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search students…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
            {STUDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns(
          (id) => router.push(`/students/${id}`),
          (student) => {
            if (confirm(`Withdraw ${student.firstName} ${student.lastName}?`)) {
              withdrawStudent({ id: student._id, reason: 'Withdrawn by admin' });
            }
          },
        )}
        data={data?.data}
        loading={isLoading}
        pageCount={data?.pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />

      {/* Enroll dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll New Student</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(createStudent)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input {...register('firstName')} placeholder="John" />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input {...register('lastName')} placeholder="Kamau" />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Admission Number</Label>
              <Input {...register('admissionNumber')} placeholder="ADM/2024/001" />
              {errors.admissionNumber && <p className="text-xs text-destructive">{errors.admissionNumber.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select onValueChange={(v) => setValue('gender', v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && <p className="text-xs text-destructive">{errors.gender.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input type="date" {...register('dateOfBirth')} />
                {errors.dateOfBirth && <p className="text-xs text-destructive">{errors.dateOfBirth.message}</p>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select onValueChange={(v) => setValue('classId', v)}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classesData?.data?.map((cls) => (
                    <SelectItem key={cls._id} value={cls._id}>
                      {cls.name}{cls.stream ? ` ${cls.stream}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Enroll Student</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
