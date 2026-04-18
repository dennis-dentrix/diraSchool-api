'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, ClipboardList } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { examsApi, classesApi, subjectsApi, getErrorMessage } from '@/lib/api';
import { capitalize } from '@/lib/utils';
import { EXAM_TYPES, ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  classId: z.string().min(1, 'Required'),
  subjectId: z.string().min(1, 'Required'),
  type: z.string().min(1, 'Required'),
  term: z.string().min(1, 'Required'),
  academicYear: z.string().min(1, 'Required'),
  totalMarks: z.coerce.number().positive(),
});

const columns = (onDelete, onEnterResults) => [
  { accessorKey: 'name', header: 'Exam', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: 'subjectId', header: 'Subject', cell: ({ row }) => { const s = row.original.subjectId; return <span className="text-sm">{typeof s === 'object' ? s.name : '—'}</span>; } },
  { accessorKey: 'classId', header: 'Class', cell: ({ row }) => { const c = row.original.classId; return <span className="text-sm">{typeof c === 'object' ? c.name : '—'}</span>; } },
  { accessorKey: 'type', header: 'Type', cell: ({ row }) => <span className="text-sm capitalize">{row.original.type}</span> },
  { accessorKey: 'totalMarks', header: 'Out of', cell: ({ row }) => <span>{row.original.totalMarks}</span> },
  { accessorKey: 'term', header: 'Term', cell: ({ row }) => <span className="text-sm">{row.original.term}</span> },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEnterResults(row.original._id)}>
            <ClipboardList className="h-4 w-4 mr-2" /> Enter Results
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete exam?')) onDelete(row.original._id); }}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function ExamsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedClass, setSelectedClass] = useState('');
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: String(new Date().getFullYear()), term: 'Term 1', totalMarks: 100 },
  });
  const classId = watch('classId');

  const { data, isLoading } = useQuery({ queryKey: ['exams', page, selectedClass], queryFn: async () => { const res = await examsApi.list({ page, limit: 20, classId: selectedClass || undefined }); return res.data; } });
  const { data: classesData } = useQuery({ queryKey: ['classes'], queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; } });
  const { data: subjectsData } = useQuery({ queryKey: ['subjects', 'class', classId], queryFn: async () => { const res = await subjectsApi.list({ classId, limit: 100 }); return res.data; }, enabled: !!classId });

  const { mutate: createExam, isPending } = useMutation({
    mutationFn: (data) => examsApi.create(data),
    onSuccess: () => { toast.success('Exam created'); queryClient.invalidateQueries({ queryKey: ['exams'] }); setOpen(false); reset(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const { mutate: deleteExam } = useMutation({
    mutationFn: (id) => examsApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['exams'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Exams" description="Manage exam configuration">
        <Select value={selectedClass} onValueChange={(v) => setSelectedClass(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All classes</SelectItem>
            {classesData?.data?.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Create Exam</Button>
      </PageHeader>

      <DataTable columns={columns(deleteExam, (id) => router.push(`/exams/${id}`))} data={data?.data} loading={isLoading} pageCount={data?.pagination?.totalPages} currentPage={page} onPageChange={setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Exam</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createExam)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Exam Name</Label>
              <Input {...register('name')} placeholder="End Term Math" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Select onValueChange={(v) => { setValue('classId', v); setValue('subjectId', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{classesData?.data?.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>)}</SelectContent>
                </Select>
                {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Select onValueChange={(v) => setValue('subjectId', v)} disabled={!classId}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{subjectsData?.data?.map((s) => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                {errors.subjectId && <p className="text-xs text-destructive">{errors.subjectId.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select onValueChange={(v) => setValue('type', v)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{EXAM_TYPES.map((t) => <SelectItem key={t} value={t}>{capitalize(t)}</SelectItem>)}</SelectContent>
                </Select>
                {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Total Marks</Label>
                <Input {...register('totalMarks')} type="number" defaultValue={100} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select defaultValue={String(new Date().getFullYear())} onValueChange={(v) => setValue('academicYear', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select defaultValue="Term 1" onValueChange={(v) => setValue('term', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Create Exam</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
