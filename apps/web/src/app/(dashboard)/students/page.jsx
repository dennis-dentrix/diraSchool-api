'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Search, Upload, MoreHorizontal, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { studentsApi, classesApi, exportApi, downloadBlob, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, getStatusColor, capitalize } from '@/lib/utils';
import { STUDENT_STATUSES } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { RefreshButton } from '@/components/shared/refresh-button';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useDebounce } from '@/hooks/use-debounce';
import { useRouter } from 'next/navigation';

const today      = new Date().toISOString().split('T')[0];
const minDobDate = '1990-01-01';

const schema = z.object({
  firstName:              z.string().min(1, 'Required'),
  lastName:               z.string().min(1, 'Required'),
  admissionNumber:        z.string().min(1, 'Required'),
  assessmentNumber:       z.string().optional(),
  gender:                 z.enum(['male', 'female']),
  dateOfBirth:            z.string().optional(),
  birthCertificateNumber: z.string().optional(),
  enrollmentDate:         z.string().optional(),
  classId:                z.string().min(1, 'Required'),
  guardians: z.array(
    z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      relationship: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email('Invalid email').optional().or(z.literal('')),
      occupation: z.string().optional(),
    })
  ).optional(),
});

const RELATIONSHIPS = ['mother', 'father', 'guardian', 'other'];
const CONFIRM_INIT = { open: false, title: '', description: '', onConfirm: null };

const columns = (onView, onWithdraw, canWithdraw) => [
  {
    id: 'name',
    header: 'Student',
    cell: ({ row }) => {
      const s = row.original;
      return (
        <button
          onClick={() => onView(s._id)}
          className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
        >
          {s.photo ? (
            <img
              src={s.photo}
              alt={`${s.firstName} ${s.lastName}`}
              className="w-8 h-8 rounded-full object-cover border shrink-0"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
              {s.firstName?.[0]}{s.lastName?.[0]}
            </div>
          )}
          <div>
            <p className="font-medium text-sm leading-tight">{s.firstName} {s.lastName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.admissionNumber}</p>
          </div>
        </button>
      );
    },
  },
  {
    accessorKey: 'classId',
    header: 'Class',
    cell: ({ row }) => {
      const cls = row.original.classId;
      return (
        <span className="text-sm">
          {typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—'}
        </span>
      );
    },
  },
  {
    id: 'gender',
    header: 'Gender',
    cell: ({ row }) => (
      <span className="text-sm capitalize text-muted-foreground">{row.original.gender}</span>
    ),
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
          {canWithdraw && row.original.status === 'active' && (
            <DropdownMenuItem onClick={() => onWithdraw(row.original)} className="text-destructive">
              Withdraw
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function StudentsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isTeacher = ['teacher', 'department_head'].includes(user?.role);

  const [search, setSearch]               = useState('');
  const [page, setPage]                   = useState(1);
  const [open, setOpen]                   = useState(false);
  const [importOpen, setImportOpen]       = useState(false);
  const [importClassId, setImportClassId] = useState('');
  const [importFile, setImportFile]       = useState(null);
  const [importJobId, setImportJobId]     = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [showGuardian, setShowGuardian]   = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(CONFIRM_INIT);
  const debouncedSearch = useDebounce(search, 400);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      enrollmentDate: today,
      guardians: [{ relationship: 'mother' }],
    },
  });
  const { fields: guardianFields, append: appendGuardian, remove: removeGuardian } = useFieldArray({
    control,
    name: 'guardians',
  });

  // For teachers: fetch their assigned class to use as a filter
  const { data: myClassData } = useQuery({
    queryKey: ['my-class'],
    queryFn: async () => { const res = await classesApi.myClass(); return res.data; },
    enabled: isTeacher,
  });
  const teacherClassId = myClassData?.data?._id ?? myClassData?._id;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['students', page, debouncedSearch, selectedStatus, teacherClassId],
    queryFn: async () => {
      const res = await studentsApi.list({
        page, limit: 20,
        search: debouncedSearch || undefined,
        status: selectedStatus || undefined,
        // Teachers only see their own class's students
        ...(isTeacher && teacherClassId ? { classId: teacherClassId } : {}),
      });
      return res.data;
    },
    // If teacher, wait until we know their classId (or confirmed they have none)
    enabled: !isTeacher || myClassData !== undefined,
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; },
    enabled: !isTeacher,
  });

  const classes = classesData?.classes ?? classesData?.data ?? [];

  const { mutate: createStudent, isPending } = useMutation({
    mutationFn: (formData) => {
      const { guardians = [], ...studentFields } = formData;
      const normalizedGuardians = guardians
        .map((g) => ({
          firstName: g.firstName?.trim(),
          lastName: g.lastName?.trim(),
          relationship: g.relationship || 'guardian',
          phone: g.phone?.trim(),
          email: g.email?.trim() || undefined,
          occupation: g.occupation?.trim() || undefined,
        }))
        .filter((g) => g.firstName || g.lastName || g.phone || g.email);
      const payload = {
        ...studentFields,
        ...(normalizedGuardians.length ? {
          guardians: normalizedGuardians,
        } : {}),
      };
      return studentsApi.create(payload);
    },
    onSuccess: () => {
      toast.success('Student enrolled successfully');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setOpen(false);
      setShowGuardian(false);
      reset({ enrollmentDate: today, guardians: [{ relationship: 'mother' }] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: withdrawStudent } = useMutation({
    mutationFn: ({ id }) => studentsApi.withdraw(id, {}),
    onSuccess: () => { toast.success('Student withdrawn'); queryClient.invalidateQueries({ queryKey: ['students'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: startImport, isPending: importSubmitting } = useMutation({
    mutationFn: async () => {
      if (!importClassId) throw new Error('Select a class for this import.');
      if (!importFile) throw new Error('Select a CSV file to import.');
      const formData = new FormData();
      formData.append('classId', importClassId);
      formData.append('file', importFile);
      return studentsApi.importCsv(formData);
    },
    onSuccess: (res) => {
      const payload = res?.data ?? {};
      const jobId = payload?.jobId ?? payload?.data?.jobId;
      if (!jobId) {
        toast.error(payload?.message ?? 'Import queued, but no job ID was returned.');
        return;
      }
      setImportJobId(jobId);
      setImportOpen(false);
      setImportFile(null);
      setImportClassId('');
      toast.success('Import queued. Processing has started.');
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { data: importStatus } = useQuery({
    queryKey: ['students-import-status', importJobId],
    queryFn: async () => {
      const res = await studentsApi.importStatus(importJobId);
      return res.data;
    },
    enabled: !!importJobId,
    refetchInterval: (query) => {
      const payload = query.state.data;
      const result = payload?.result ?? payload?.data?.result ?? payload?.data ?? payload;
      const isComplete = result?.status === 'complete' || result?.status === 'failed';
      return isComplete ? false : 2000;
    },
  });

  useEffect(() => {
    if (!importJobId) return;
    const result = importStatus?.result ?? importStatus?.data?.result ?? importStatus?.data ?? importStatus;
    if (result?.status !== 'complete' && result?.status !== 'failed') return;

    const succeeded = result?.succeeded ?? 0;
    const failed = result?.failed ?? 0;
    if (result?.status === 'failed') {
      toast.error(result?.error ?? 'Student import failed.');
    } else if (failed > 0) {
      toast.warning(`Import complete: ${succeeded} succeeded, ${failed} failed.`);
    } else {
      toast.success(`Import complete: ${succeeded} students added.`);
    }
    setImportJobId(null);
    queryClient.invalidateQueries({ queryKey: ['students'] });
  }, [importJobId, importStatus, queryClient]);

  const openConfirm = (title, description, onConfirm) =>
    setConfirmDialog({ open: true, title, description, onConfirm });

  const students   = data?.students ?? data?.data ?? [];
  const pagination = data?.meta ?? data?.pagination;
  const totalCount = pagination?.total ?? students.length;

  return (
    <div>
      <PageHeader
        title={`Students ${totalCount ? `(${totalCount})` : ''}`}
        description={isTeacher ? 'Students in your class' : 'Enroll and manage student records'}
      >
        <RefreshButton queryKeys={[['students']]} />
        {!isTeacher && (
          <>
            <Button variant="outline" size="sm"
              onClick={async () => {
                try { downloadBlob(await exportApi.students(), 'students.csv'); }
                catch { toast.error('Export failed'); }
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import CSV
            </Button>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Enroll Student
            </Button>
          </>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or adm. no…"
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={selectedStatus} onValueChange={(v) => { setSelectedStatus(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36 shrink-0">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            {STUDENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{capitalize(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns(
          (id) => router.push(`/students/${id}`),
          (student) => openConfirm(
            `Withdraw ${student.firstName} ${student.lastName}?`,
            'The student will be marked as withdrawn. This can be reversed later.',
            () => withdrawStudent({ id: student._id }),
          ),
          !isTeacher,
        )}
        data={students}
        loading={isLoading}
        error={isError ? error : null}
        pageCount={pagination?.totalPages ?? pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />

      {/* ── Enroll dialog (admin/non-teacher only) ─────────────────────── */}
      {!isTeacher && (
        <Dialog open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) { setImportFile(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Import Students CSV</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Class *</Label>
                <Select value={importClassId} onValueChange={setImportClassId}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.name}{cls.stream ? ` ${cls.stream}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>CSV File *</Label>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  Required columns: <code>admissionNumber, firstName, lastName, gender</code>.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
              <Button
                type="button"
                disabled={importSubmitting || !importClassId || !importFile}
                onClick={() => startImport()}
              >
                {importSubmitting ? 'Uploading…' : 'Start Import'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {!isTeacher && (
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setShowGuardian(false); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Enroll New Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(createStudent)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Name *</Label>
                  <Input {...register('firstName')} placeholder="John" />
                  {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Last Name *</Label>
                  <Input {...register('lastName')} placeholder="Kamau" />
                  {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Admission No. *</Label>
                  <Input {...register('admissionNumber')} placeholder="ADM/2024/001" />
                  {errors.admissionNumber && <p className="text-xs text-destructive">{errors.admissionNumber.message}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Assessment No. <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input {...register('assessmentNumber')} placeholder="e.g. 12345678" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Birth Certificate No.</Label>
                  <Input {...register('birthCertificateNumber')} placeholder="12345678" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Gender *</Label>
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
                  <Input type="date" {...register('dateOfBirth')} min={minDobDate} max={today} />
                </div>
                <div className="space-y-1.5">
                  <Label>Enrollment Date</Label>
                  <Input type="date" {...register('enrollmentDate')} max={today} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Class *</Label>
                <Select onValueChange={(v) => setValue('classId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls._id} value={cls._id}>
                        {cls.name}{cls.stream ? ` ${cls.stream}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
              </div>

              {/* Guardian section */}
              <div className="border rounded-md">
                <button
                  type="button"
                  onClick={() => setShowGuardian((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium hover:bg-muted/50 rounded-md"
                >
                  <span>Parent / Guardian Details <span className="text-muted-foreground font-normal">(optional)</span></span>
                  {showGuardian ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showGuardian && (
                  <div className="px-3 pb-3 space-y-3 border-t pt-3">
                    {guardianFields.map((g, idx) => (
                      <div key={g.id} className="rounded-md border p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Guardian {idx + 1}
                          </p>
                          {guardianFields.length > 1 && (
                            <Button type="button" size="sm" variant="ghost" onClick={() => removeGuardian(idx)}>
                              Remove
                            </Button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>First Name</Label>
                            <Input {...register(`guardians.${idx}.firstName`)} placeholder="Mary" />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Last Name</Label>
                            <Input {...register(`guardians.${idx}.lastName`)} placeholder="Kamau" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Relationship</Label>
                            <Select onValueChange={(v) => setValue(`guardians.${idx}.relationship`, v)} defaultValue={idx === 0 ? 'mother' : 'guardian'}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                {RELATIONSHIPS.map((r) => (
                                  <SelectItem key={r} value={r}>{capitalize(r)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <Label>Occupation</Label>
                            <Input {...register(`guardians.${idx}.occupation`)} placeholder="Farmer" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label>Phone</Label>
                            <Input {...register(`guardians.${idx}.phone`)} placeholder="0712 345 678" />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Email <span className="text-muted-foreground text-xs">(sends portal invite)</span></Label>
                            <Input {...register(`guardians.${idx}.email`)} type="email" placeholder="parent@email.com" />
                            {errors.guardians?.[idx]?.email && <p className="text-xs text-destructive">{errors.guardians[idx].email.message}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendGuardian({ relationship: 'guardian' })}
                    >
                      Add another guardian
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setOpen(false); setShowGuardian(false); }}>Cancel</Button>
                <Button type="submit" disabled={isPending}>Enroll Student</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Confirm dialog ─────────────────────────────────────────────── */}
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
