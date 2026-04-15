'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, BookOpen, Users, MoreHorizontal } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { classesApi, usersApi, getErrorMessage } from '@/lib/api';
import { LEVEL_CATEGORIES, ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  stream: z.string().optional(),
  levelCategory: z.string().min(1, 'Required'),
  academicYear: z.string().min(1, 'Required'),
  term: z.string().min(1, 'Required'),
  classTeacherId: z.string().optional(),
});

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { academicYear: filterYear, term: 'Term 1' },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['classes', filterYear],
    queryFn: async () => {
      const res = await classesApi.list({ academicYear: filterYear, limit: 100 });
      return res.data;
    },
  });

  const { data: teachers } = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: async () => {
      const res = await usersApi.list({ role: 'teacher', limit: 100 });
      return res.data;
    },
  });

  const { mutate: createClass, isPending } = useMutation({
    mutationFn: (data) => classesApi.create(data),
    onSuccess: () => {
      toast.success('Class created');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteClass } = useMutation({
    mutationFn: (id) => classesApi.delete(id),
    onSuccess: () => {
      toast.success('Class deleted');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: promoteClass } = useMutation({
    mutationFn: (id) => classesApi.promote(id),
    onSuccess: () => toast.success('Students promoted successfully'),
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const classes = data?.data ?? [];

  return (
    <div>
      <PageHeader title="Classes" description="Manage classes and student promotion">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Class
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState icon={BookOpen} title="No classes yet" description="Create your first class to get started" action={{ label: 'Add Class', onClick: () => setOpen(true) }} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card key={cls._id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <h3 className="font-semibold">{cls.name}{cls.stream ? ` — ${cls.stream}` : ''}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{cls.levelCategory}</p>
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{cls.studentCount ?? 0} students</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{cls.term} · {cls.academicYear}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-1">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        if (confirm('Promote all students to next class?')) promoteClass(cls._id);
                      }}>
                        Promote students
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => { if (confirm('Delete this class?')) deleteClass(cls._id); }}
                      >
                        Delete class
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Class</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createClass)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Class Name</Label>
                <Input {...register('name')} placeholder="Grade 5" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Stream (optional)</Label>
                <Input {...register('stream')} placeholder="East" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Level Category</Label>
              <Select onValueChange={(v) => setValue('levelCategory', v)}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {LEVEL_CATEGORIES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              {errors.levelCategory && <p className="text-xs text-destructive">{errors.levelCategory.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select defaultValue={filterYear} onValueChange={(v) => setValue('academicYear', v)}>
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
                    {['Term 1', 'Term 2', 'Term 3'].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Class Teacher (optional)</Label>
              <Select onValueChange={(v) => setValue('classTeacherId', v)}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers?.data?.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.firstName} {t.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Create Class</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
