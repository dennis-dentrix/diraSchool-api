'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Users, BookOpen, GraduationCap, LogIn, LogOut, FolderOpen } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { subjectsApi, classesApi, usersApi, getErrorMessage } from '@/lib/api';
import { useAuthStore, isAdmin } from '@/store/auth.store';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const schema = z.object({
  name:       z.string().min(1, 'Required'),
  code:       z.string().optional(),
  classId:    z.string().min(1, 'Required'),
  department: z.string().optional(),
});

const CONFIRM_INIT = { open: false, title: '', description: '', onConfirm: null };

// ── Admin table columns ───────────────────────────────────────────────────────
const adminColumns = (onDelete, onAssign) => [
  {
    accessorKey: 'name',
    header: 'Subject',
    cell: ({ row }) => (
      <div>
        <p className="font-medium">{row.original.name}</p>
        {row.original.department && (
          <p className="text-xs text-muted-foreground">{row.original.department}</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: 'code',
    header: 'Code',
    cell: ({ row }) => <span className="text-sm font-mono">{row.original.code ?? '—'}</span>,
  },
  {
    accessorKey: 'classId',
    header: 'Class',
    cell: ({ row }) => {
      const c = row.original.classId;
      return <span className="text-sm">{typeof c === 'object' ? `${c.name}${c.stream ? ` ${c.stream}` : ''}` : '—'}</span>;
    },
  },
  {
    accessorKey: 'teacherIds',
    header: 'Teachers',
    cell: ({ row }) => {
      const teachers = row.original.teacherIds ?? [];
      if (!teachers.length) return <span className="text-xs text-muted-foreground">None</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {teachers.slice(0, 2).map((t) => (
            <Badge key={t._id ?? t} variant="secondary" className="text-xs">
              {typeof t === 'object' ? `${t.firstName} ${t.lastName}` : t}
            </Badge>
          ))}
          {teachers.length > 2 && <Badge variant="outline" className="text-xs">+{teachers.length - 2}</Badge>}
        </div>
      );
    },
  },
  {
    accessorKey: 'hodId',
    header: 'HOD',
    cell: ({ row }) => {
      const h = row.original.hodId;
      return <span className="text-sm">{typeof h === 'object' ? `${h.firstName} ${h.lastName}` : '—'}</span>;
    },
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
          <DropdownMenuItem onClick={() => onAssign(row.original)}>
            <Users className="h-4 w-4 mr-2" /> Assign Teachers
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(row.original._id)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

// ── Department group card ─────────────────────────────────────────────────────
function DepartmentGroup({ department, subjects, onAssign, onDelete }) {
  return (
    <Card>
      <CardHeader className="py-3 px-4 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          {department}
          <Badge variant="secondary" className="ml-1 font-normal">{subjects.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {subjects.map((s) => {
            const cls = typeof s.classId === 'object'
              ? `${s.classId.name}${s.classId.stream ? ` ${s.classId.stream}` : ''}`
              : '—';
            const teacherCount = s.teacherIds?.length ?? 0;
            return (
              <div key={s._id} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {s.name}
                    {s.code && <span className="font-mono text-xs text-muted-foreground ml-1.5">{s.code}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cls} · {teacherCount} teacher{teacherCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onAssign(s)}>
                      <Users className="h-4 w-4 mr-2" /> Assign Teachers
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => onDelete(s._id)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Teacher subject card ──────────────────────────────────────────────────────
function TeacherSubjectCard({ subject, isAssigned, onJoin, onLeave, isPending }) {
  const cls = typeof subject.classId === 'object'
    ? `${subject.classId.name}${subject.classId.stream ? ` ${subject.classId.stream}` : ''}`
    : '—';

  return (
    <Card className={isAssigned ? 'border-blue-200 bg-blue-50/30' : ''}>
      <CardContent className="flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isAssigned ? 'bg-blue-100' : 'bg-muted'}`}>
            <BookOpen className={`h-4 w-4 ${isAssigned ? 'text-blue-600' : 'text-muted-foreground'}`} />
          </div>
          <div>
            <p className="text-sm font-medium">
              {subject.name}
              {subject.code && <span className="font-mono text-xs text-muted-foreground ml-1.5">{subject.code}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {cls}{subject.department ? ` · ${subject.department}` : ''}
            </p>
          </div>
        </div>
        {isAssigned ? (
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 shrink-0"
            disabled={isPending}
            onClick={() => onLeave(subject._id)}
          >
            <LogOut className="h-3.5 w-3.5 mr-1" /> Leave
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0"
            disabled={isPending}
            onClick={() => onJoin(subject._id)}
          >
            <LogIn className="h-3.5 w-3.5 mr-1" /> Join
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const adminUser = isAdmin(user);
  const isTeacher = user?.role === 'teacher';

  const [open, setOpen]                             = useState(false);
  const [assignTarget, setAssignTarget]             = useState(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [selectedHodId, setSelectedHodId]           = useState('');
  const [page, setPage]                             = useState(1);
  const [confirmDialog, setConfirmDialog]           = useState(CONFIRM_INIT);
  const [deptFilter, setDeptFilter]                 = useState('');
  const [viewMode, setViewMode]                     = useState('table'); // 'table' | 'grouped'
  const [teacherTab, setTeacherTab]                 = useState('mine'); // 'mine' | 'browse'

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  // Admin: full list (no teacher filter)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['subjects', page, deptFilter],
    queryFn: async () => {
      const res = await subjectsApi.list({ page, limit: 50, department: deptFilter || undefined });
      return res.data;
    },
    enabled: adminUser,
  });

  // Teacher: my subjects only
  const { data: mySubjectsData, isLoading: myLoading } = useQuery({
    queryKey: ['my-subjects'],
    queryFn: async () => {
      const res = await subjectsApi.list({ limit: 200 });
      return res.data;
    },
    enabled: isTeacher,
  });

  // Teacher: browse all subjects in school
  const { data: allSubjectsData, isLoading: allLoading } = useQuery({
    queryKey: ['subjects-browse'],
    queryFn: async () => {
      const res = await subjectsApi.list({ all: 'true', limit: 200 });
      return res.data;
    },
    enabled: isTeacher && teacherTab === 'browse',
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; },
    enabled: adminUser,
  });

  const { data: teachersData } = useQuery({
    queryKey: ['users', 'teachers'],
    queryFn: async () => { const res = await usersApi.list({ role: 'teacher', limit: 100 }); return res.data; },
    enabled: adminUser,
  });

  const subjects    = data?.subjects ?? data?.data ?? [];
  const mySubjects  = mySubjectsData?.subjects ?? mySubjectsData?.data ?? [];
  const allSubjects = allSubjectsData?.subjects ?? allSubjectsData?.data ?? [];
  const teachers    = teachersData?.users ?? teachersData?.data ?? [];
  const meta        = data?.meta ?? data?.pagination;

  // Unique departments from whichever list is relevant
  const departments = useMemo(() => {
    const src = adminUser ? subjects : allSubjects;
    return [...new Set(src.map((s) => s.department).filter(Boolean))].sort();
  }, [subjects, allSubjects, adminUser]);

  // Subjects grouped by department for the "By Department" view
  const grouped = useMemo(() => {
    const src = deptFilter ? subjects.filter((s) => s.department === deptFilter) : subjects;
    const map = {};
    for (const s of src) {
      const key = s.department || '(No Department)';
      if (!map[key]) map[key] = [];
      map[key].push(s);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [subjects, deptFilter]);

  // Subject IDs the current teacher already belongs to
  const mySubjectIds = useMemo(() => new Set(mySubjects.map((s) => s._id)), [mySubjects]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const { mutate: createSubject, isPending } = useMutation({
    mutationFn: (data) => subjectsApi.create(data),
    onSuccess: () => {
      toast.success('Subject created');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteSubject } = useMutation({
    mutationFn: (id) => subjectsApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['subjects'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: assignTeachers, isPending: isAssigning } = useMutation({
    mutationFn: ({ id, teacherIds, hodId }) =>
      subjectsApi.assignTeachers(id, { teacherIds, hodId: hodId || null }),
    onSuccess: () => {
      toast.success('Teachers updated');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      setAssignTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: selfAssign, isPending: isSelfAssigning } = useMutation({
    mutationFn: ({ id, action }) => subjectsApi.selfAssign(id, action),
    onSuccess: (_, { action }) => {
      toast.success(action === 'join' ? 'Added to subject' : 'Removed from subject');
      queryClient.invalidateQueries({ queryKey: ['my-subjects'] });
      queryClient.invalidateQueries({ queryKey: ['subjects-browse'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleTeacher = (id) =>
    setSelectedTeacherIds((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);

  const openAssign = (subj) => {
    setAssignTarget(subj);
    setSelectedTeacherIds((subj.teacherIds ?? []).map((t) => (typeof t === 'object' ? t._id : t)));
    setSelectedHodId(typeof subj.hodId === 'object' ? (subj.hodId?._id ?? '') : (subj.hodId ?? ''));
  };

  const openConfirm = (title, description, onConfirm) =>
    setConfirmDialog({ open: true, title, description, onConfirm });

  // ── Teacher view ──────────────────────────────────────────────────────────
  if (isTeacher) {
    const browseList = deptFilter
      ? allSubjects.filter((s) => s.department === deptFilter)
      : allSubjects;

    return (
      <div className="space-y-5">
        <PageHeader
          title="My Subjects"
          description="View your assigned subjects or join ones you teach"
        />

        <Tabs value={teacherTab} onValueChange={setTeacherTab}>
          <TabsList>
            <TabsTrigger value="mine" className="gap-2">
              <GraduationCap className="h-4 w-4" /> My Subjects
              {mySubjects.length > 0 && (
                <Badge variant="secondary" className="ml-1">{mySubjects.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="browse" className="gap-2">
              <BookOpen className="h-4 w-4" /> Browse All
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* My subjects */}
        {teacherTab === 'mine' && (
          myLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : mySubjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <GraduationCap className="h-8 w-8 mx-auto opacity-30" />
              <p>You haven&apos;t been assigned to any subjects yet.</p>
              <p>
                Switch to{' '}
                <button className="underline text-blue-600" onClick={() => setTeacherTab('browse')}>
                  Browse All
                </button>{' '}
                to find and join subjects you teach.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {mySubjects.map((s) => (
                <TeacherSubjectCard
                  key={s._id}
                  subject={s}
                  isAssigned
                  onLeave={(id) => selfAssign({ id, action: 'leave' })}
                  isPending={isSelfAssigning}
                />
              ))}
            </div>
          )
        )}

        {/* Browse all */}
        {teacherTab === 'browse' && (
          <div className="space-y-4">
            {departments.length > 0 && (
              <Select value={deptFilter} onValueChange={(v) => setDeptFilter(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="All departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All departments</SelectItem>
                  {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {allLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : browseList.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">No subjects found.</p>
            ) : (
              <div className="space-y-2">
                {browseList.map((s) => (
                  <TeacherSubjectCard
                    key={s._id}
                    subject={s}
                    isAssigned={mySubjectIds.has(s._id)}
                    onJoin={(id) => selfAssign({ id, action: 'join' })}
                    onLeave={(id) => selfAssign({ id, action: 'leave' })}
                    isPending={isSelfAssigning}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Admin view ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <PageHeader title="Subjects" description="Manage subjects, departments, and teacher assignments">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Subject
        </Button>
      </PageHeader>

      {/* Filters + view toggle */}
      <div className="flex flex-wrap gap-3 items-center">
        {departments.length > 0 && (
          <Select value={deptFilter} onValueChange={(v) => { setDeptFilter(v === '__all__' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-44 h-8 text-xs">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All departments</SelectItem>
              {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="flex rounded-md border overflow-hidden">
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'table' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'grouped' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}
          >
            By Department
          </button>
        </div>
      </div>

      {/* Table view */}
      {viewMode === 'table' && (
        <DataTable
          columns={adminColumns(
            (id) => openConfirm('Delete subject?', 'This action cannot be undone.', () => deleteSubject(id)),
            openAssign,
          )}
          data={deptFilter ? subjects.filter((s) => s.department === deptFilter) : subjects}
          loading={isLoading}
          error={isError ? error : null}
          pageCount={meta?.totalPages ?? meta?.pages}
          currentPage={page}
          onPageChange={setPage}
        />
      )}

      {/* Grouped view */}
      {viewMode === 'grouped' && (
        isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-center py-8 text-sm text-muted-foreground">No subjects yet.</p>
        ) : (
          <div className="space-y-4">
            {grouped.map(([dept, items]) => (
              <DepartmentGroup
                key={dept}
                department={dept}
                subjects={items}
                onAssign={openAssign}
                onDelete={(id) => openConfirm('Delete subject?', 'This action cannot be undone.', () => deleteSubject(id))}
              />
            ))}
          </div>
        )
      )}

      {/* ── Create subject dialog ──────────────────────────────────────────── */}
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
              <Label>Department (optional)</Label>
              <Input {...register('department')} placeholder="e.g. Sciences, Languages" />
            </div>
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select onValueChange={(v) => setValue('classId', v)}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {(classesData?.classes ?? classesData?.data ?? []).map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}{c.stream ? ` ${c.stream}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Create Subject</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Assign teachers + HOD dialog ──────────────────────────────────── */}
      <Dialog open={!!assignTarget} onOpenChange={() => setAssignTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Teachers — {assignTarget?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Teachers</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded-md p-2">
                {teachers.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2">No teachers found</p>
                )}
                {teachers.map((t) => (
                  <label key={t._id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-muted rounded">
                    <Checkbox
                      checked={selectedTeacherIds.includes(t._id)}
                      onCheckedChange={() => toggleTeacher(t._id)}
                    />
                    <span className="text-sm">{t.firstName} {t.lastName}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Head of Department (optional)</Label>
              <Select
                value={selectedHodId || '__none__'}
                onValueChange={(v) => setSelectedHodId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select HOD" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.firstName} {t.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)}>Cancel</Button>
            <Button
              disabled={isAssigning}
              onClick={() => assignTeachers({
                id: assignTarget._id,
                teacherIds: selectedTeacherIds,
                hodId: selectedHodId,
              })}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm dialog ─────────────────────────────────────────────────── */}
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
              onClick={() => { confirmDialog.onConfirm?.(); setConfirmDialog(CONFIRM_INIT); }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
