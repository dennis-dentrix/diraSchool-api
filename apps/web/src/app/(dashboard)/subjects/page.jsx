'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { subjectsApi, classesApi, usersApi, getErrorMessage } from '@/lib/api';
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
  code: z.string().optional(),
  classId: z.string().min(1, 'Required'),
  teacherId: z.string().optional(),
});

const columns = (onDelete, onAssign) => [
  { accessorKey: 'name', header: 'Subject', cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
  { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="text-sm font-mono">{row.original.code ?? '—'}</span> },
  {
    accessorKey: 'classId',
    header: 'Class',
    cell: ({ row }) => {
      const c = row.original.classId;
      return <span className="text-sm">{typeof c === 'object' ? `${c.name}${c.stream ? ` ${c.stream}` : ''}` : '—'}</span>;
    },
  },
  {
    accessorKey: 'teacherId',
    header: 'Teacher',
    cell: ({ row }) => {
      const t = row.original.teacherId;
      return <span className="text-sm">{typeof t === 'object' ? `${t.firstName} ${t.lastName}` : 'Unassigned'}</span>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onAssign(row.original)}>Assign teacher</DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete subject?')) onDelete(row.original._id); }}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignTeacherId, setAssignTeacherId] = useState('');
  const [page, setPage] = useState(1);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const { data, isLoading } = useQuery({
    queryKey: ['subjects', page],
    queryFn: async () => { const res = await subjectsApi.list({ page, limit: 20 }); return res.data; },
  });
  const { data: classesData } = useQuery({ queryKey: ['classes'], queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; } });
  const { data: teachersData } = useQuery({ queryKey: ['users', 'teachers'], queryFn: async () => { const res = await usersApi.list({ role: 'teacher', limit: 100 }); return res.data; } });

  const { mutate: createSubject, isPending } = useMutation({
    mutationFn: (data) => subjectsApi.create(data),
    onSuccess: () => { toast.success('Subject created'); queryClient.invalidateQueries({ queryKey: ['subjects'] }); setOpen(false); reset(); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteSubject } = useMutation({
    mutationFn: (id) => subjectsApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['subjects'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: assignTeacher } = useMutation({
    mutationFn: ({ id, teacherId }) => subjectsApi.assignTeacher(id, { teacherId: teacherId || null }),
    onSuccess: () => { toast.success('Teacher assigned'); queryClient.invalidateQueries({ queryKey: ['subjects'] }); setAssignTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Subjects" description="Manage subjects and teacher assignments">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Subject</Button>
      </PageHeader>

      <DataTable
        columns={columns(deleteSubject, (subj) => { setAssignTarget(subj); setAssignTeacherId(typeof subj.teacherId === 'object' ? subj.teacherId._id : subj.teacherId ?? ''); })}
        data={data?.data} loading={isLoading}
        pageCount={data?.pagination?.pages} currentPage={page} onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Subject</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createSubject)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subject Name</Label>
                <Input {...register('name')} placeholder="Mathematics" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Code (optional)</Label>
                <Input {...register('code')} placeholder="MTH" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select onValueChange={(v) => setValue('classId', v)}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classesData?.data?.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>)}</SelectContent>
              </Select>
              {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Teacher (optional)</Label>
              <Select onValueChange={(v) => setValue('teacherId', v)}>
                <SelectTrigger><SelectValue placeholder="Assign later" /></SelectTrigger>
                <SelectContent>{teachersData?.data?.map((t) => <SelectItem key={t._id} value={t._id}>{t.firstName} {t.lastName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Create Subject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assignTarget} onOpenChange={() => setAssignTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign Teacher — {assignTarget?.name}</DialogTitle></DialogHeader>
          <div className="space-y-1.5">
            <Label>Teacher</Label>
            <Select value={assignTeacherId} onValueChange={setAssignTeacherId}>
              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (unassign)</SelectItem>
                {teachersData?.data?.map((t) => <SelectItem key={t._id} value={t._id}>{t.firstName} {t.lastName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button onClick={() => assignTeacher({ id: assignTarget._id, teacherId: assignTeacherId })}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
