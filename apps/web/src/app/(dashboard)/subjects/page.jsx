'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, MoreHorizontal, Users, BookOpen, UserPlus, UserMinus } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const schema = z.object({
  name:       z.string().min(1, 'Required'),
  code:       z.string().optional(),
  classId:    z.string().min(1, 'Required'),
  department: z.string().optional(),
});

const CONFIRM_INIT = { open: false, title: '', description: '', onConfirm: null };

const columns = (onDelete, onAssign, adminUser) => [
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
          {teachers.length > 2 && (
            <Badge variant="outline" className="text-xs">+{teachers.length - 2}</Badge>
          )}
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
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {adminUser && (
            <DropdownMenuItem onClick={() => onAssign(row.original)}>
              <Users className="h-4 w-4 mr-2" />Assign teachers
            </DropdownMenuItem>
          )}
          {adminUser && (
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(row.original._id)}
            >
              Delete
            </DropdownMenuItem>
          )}
          {!adminUser && (
            <DropdownMenuItem disabled className="text-muted-foreground text-xs">
              No actions available
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function SubjectsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const adminUser = isAdmin(user);

  const [open, setOpen]                         = useState(false);
  const [assignTarget, setAssignTarget]         = useState(null);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState([]);
  const [selectedHodId, setSelectedHodId]       = useState('');
  const [page, setPage]                         = useState(1);
  const [confirmDialog, setConfirmDialog]       = useState(CONFIRM_INIT);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  const { data, isLoading } = useQuery({
    queryKey: ['subjects', page],
    queryFn: async () => { const res = await subjectsApi.list({ page, limit: 20 }); return res.data; },
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

  const teachers = teachersData?.users ?? teachersData?.data ?? [];

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

  const { mutate: assignTeachers, isPending: isAssigning } = useMutation({
    mutationFn: ({ id, teacherIds, hodId }) =>
      subjectsApi.assignTeachers(id, { teacherIds, hodId: hodId || null }),
    onSuccess: () => { toast.success('Teachers updated'); queryClient.invalidateQueries({ queryKey: ['subjects'] }); setAssignTarget(null); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const toggleTeacher = (id) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  const openAssign = (subj) => {
    const existing = (subj.teacherIds ?? []).map((t) => (typeof t === 'object' ? t._id : t));
    const hod = typeof subj.hodId === 'object' ? subj.hodId?._id : subj.hodId ?? '';
    setAssignTarget(subj);
    setSelectedTeacherIds(existing);
    setSelectedHodId(hod);
  };

  const openConfirm = (title, description, onConfirm) =>
    setConfirmDialog({ open: true, title, description, onConfirm });

  const { mutate: selfAssign } = useMutation({
    mutationFn: ({ id, action }) => subjectsApi.selfAssign(id, action),
    onSuccess: (_, { action }) => {
      toast.success(action === 'join' ? 'You have joined this subject' : 'You have left this subject');
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      queryClient.invalidateQueries({ queryKey: ['subjects-all'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: allSubjectsData, isLoading: allLoading } = useQuery({
    queryKey: ['subjects-all'],
    queryFn: async () => { const res = await subjectsApi.list({ limit: 200, all: 'true' }); return res.data; },
    enabled: !adminUser,
  });

  const subjects    = data?.subjects ?? data?.data ?? [];
  const allSubjects = allSubjectsData?.subjects ?? allSubjectsData?.data ?? [];
  const meta        = data?.meta ?? data?.pagination;

  // Group subjects by department for the teacher browse view
  const subjectsByDept = allSubjects.reduce((acc, s) => {
    const dept = s.department || 'General';
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(s);
    return acc;
  }, {});

  const mySubjectIds = new Set(
    subjects.map((s) => (typeof s === 'object' ? s._id : s))
  );

  return (
    <div>
      <PageHeader title="Subjects" description="Manage subjects, departments, and teacher assignments">
        {adminUser && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Subject
          </Button>
        )}
      </PageHeader>

      {/* ── Teacher view: tabs for My Subjects + Browse All ─────────────── */}
      {!adminUser ? (
        <Tabs defaultValue="mine">
          <TabsList className="mb-4">
            <TabsTrigger value="mine">My Subjects</TabsTrigger>
            <TabsTrigger value="browse">Browse All</TabsTrigger>
          </TabsList>

          <TabsContent value="mine">
            <DataTable
              columns={columns(() => {}, () => {}, false)}
              data={subjects}
              loading={isLoading}
              pageCount={meta?.totalPages ?? meta?.pages}
              currentPage={page}
              onPageChange={setPage}
            />
          </TabsContent>

          <TabsContent value="browse">
            {allLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
            ) : (
              <div className="space-y-6">
                {Object.entries(subjectsByDept).sort(([a], [b]) => a.localeCompare(b)).map(([dept, subs]) => (
                  <div key={dept}>
                    <div className="flex items-center gap-2 mb-2">
                      <BookOpen className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{dept}</h3>
                    </div>
                    <div className="space-y-1">
                      {subs.map((s) => {
                        const isMine = mySubjectIds.has(s._id);
                        const cls = s.classId;
                        return (
                          <div key={s._id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-sm font-medium">{s.name}{s.code ? ` (${s.code})` : ''}</p>
                                <p className="text-xs text-muted-foreground">
                                  {typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : ''}
                                  {s.teacherIds?.length ? ` · ${s.teacherIds.length} teacher${s.teacherIds.length !== 1 ? 's' : ''}` : ''}
                                </p>
                              </div>
                              {isMine && <Badge variant="secondary" className="text-xs ml-2">Teaching</Badge>}
                            </div>
                            <Button
                              size="sm"
                              variant={isMine ? 'outline' : 'default'}
                              className={isMine ? 'text-red-600 border-red-200 hover:bg-red-50' : ''}
                              onClick={() => selfAssign({ id: s._id, action: isMine ? 'leave' : 'join' })}
                            >
                              {isMine
                                ? <><UserMinus className="h-3.5 w-3.5 mr-1" /> Leave</>
                                : <><UserPlus className="h-3.5 w-3.5 mr-1" /> Join</>}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <DataTable
          columns={columns(
            (id) => openConfirm('Delete subject?', 'This action cannot be undone.', () => deleteSubject(id)),
            openAssign,
            adminUser,
          )}
          data={subjects}
          loading={isLoading}
          pageCount={meta?.totalPages ?? meta?.pages}
          currentPage={page}
          onPageChange={setPage}
        />
      )}

      {/* ── Create subject dialog (admin only) ───────────────────────────── */}
      {adminUser && (
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
      )}

      {/* ── Assign teachers + HOD dialog (admin only) ────────────────────── */}
      {adminUser && (
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
                <Select value={selectedHodId || '__none__'} onValueChange={(v) => setSelectedHodId(v === '__none__' ? '' : v)}>
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
      )}

      {/* ── Confirm dialog ───────────────────────────────────────────────── */}
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
