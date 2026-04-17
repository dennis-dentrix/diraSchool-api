'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, BookOpen, Users, MoreHorizontal, ChevronRight, GraduationCap } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { classesApi, usersApi, studentsApi, getErrorMessage } from '@/lib/api';
import { useAuthStore, isAdmin } from '@/store/auth.store';
import { LEVEL_CATEGORIES, ACADEMIC_YEARS } from '@/lib/constants';
import { capitalize } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  stream: z.string().optional(),
  levelCategory: z.string().min(1, 'Required'),
  academicYear: z.string().min(1, 'Required'),
  term: z.string().min(1, 'Required'),
  classTeacherId: z.string().optional(),
});

// ── Confirm dialog state helper ────────────────────────────────────────────────
const CONFIRM_INIT = { open: false, title: '', description: '', onConfirm: null };

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const adminUser = isAdmin(user);

  const [open, setOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(CONFIRM_INIT);
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
    enabled: adminUser,
  });

  // Students for the selected class side panel
  const { data: classStudentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['class-students', selectedClass?._id],
    queryFn: async () => {
      const res = await studentsApi.list({ classId: selectedClass._id, limit: 200 });
      return res.data;
    },
    enabled: !!selectedClass?._id,
  });

  const classStudents = classStudentsData?.students ?? classStudentsData?.data ?? [];

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

  const openConfirm = (title, description, onConfirm) =>
    setConfirmDialog({ open: true, title, description, onConfirm });

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
        {adminUser && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add Class
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : classes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No classes yet"
          description="Create your first class to get started"
          action={adminUser ? { label: 'Add Class', onClick: () => setOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Card
              key={cls._id}
              className="hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => setSelectedClass(cls)}
            >
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                      <h3 className="font-semibold truncate">
                        {cls.name}{cls.stream ? ` — ${cls.stream}` : ''}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">{cls.levelCategory}</p>
                    <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{cls.studentCount ?? 0} students</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{cls.term} · {cls.academicYear}</p>
                  </div>
                  <div className="flex items-center gap-1 -mt-1 -mr-1">
                    {adminUser && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              openConfirm(
                                'Promote all students?',
                                `Students in ${cls.name}${cls.stream ? ` ${cls.stream}` : ''} will be moved to the next class.`,
                                () => promoteClass(cls._id),
                              );
                            }}
                          >
                            Promote students
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              openConfirm(
                                'Delete class?',
                                'This will permanently remove the class and cannot be undone.',
                                () => deleteClass(cls._id),
                              );
                            }}
                          >
                            Delete class
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Class detail side panel ───────────────────────────────────────── */}
      <Sheet open={!!selectedClass} onOpenChange={(open) => !open && setSelectedClass(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedClass && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-lg">
                  {selectedClass.name}{selectedClass.stream ? ` — ${selectedClass.stream}` : ''}
                </SheetTitle>
                <SheetDescription>
                  {selectedClass.levelCategory} · {selectedClass.term} · {selectedClass.academicYear}
                </SheetDescription>
              </SheetHeader>

              {/* Meta info */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Students</p>
                  <p className="text-xl font-bold">{selectedClass.studentCount ?? classStudents.length}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground mb-0.5">Class Teacher</p>
                  <p className="text-sm font-medium">
                    {typeof selectedClass.classTeacherId === 'object' && selectedClass.classTeacherId
                      ? `${selectedClass.classTeacherId.firstName} ${selectedClass.classTeacherId.lastName}`
                      : '—'}
                  </p>
                </div>
              </div>

              {/* Student list */}
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Students
                </h4>
                {studentsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
                  </div>
                ) : classStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No students enrolled in this class</p>
                ) : (
                  <div className="divide-y rounded-md border overflow-hidden">
                    {classStudents.map((s, idx) => (
                      <div key={s._id} className="flex items-center justify-between px-3 py-2.5 bg-background hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                          <div>
                            <p className="text-sm font-medium">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</p>
                          </div>
                        </div>
                        <Badge
                          variant={s.status === 'active' ? 'default' : 'secondary'}
                          className="text-xs capitalize"
                        >
                          {capitalize(s.status ?? 'active')}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Create class dialog ───────────────────────────────────────────── */}
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
                  {(teachers?.users ?? teachers?.data ?? []).map((t) => (
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

      {/* ── Confirm dialog ────────────────────────────────────────────────── */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog(CONFIRM_INIT)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            {confirmDialog.description && (
              <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                confirmDialog.onConfirm?.();
                setConfirmDialog(CONFIRM_INIT);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
