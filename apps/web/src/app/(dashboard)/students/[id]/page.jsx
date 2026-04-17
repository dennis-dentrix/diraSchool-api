'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Pencil } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { studentsApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { formatDate, getStatusColor, capitalize } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const editSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  gender: z.enum(['male', 'female']),
  dateOfBirth: z.string().optional(),
  admissionNumber: z.string().min(1, 'Required'),
  birthCertificateNumber: z.string().optional(),
  enrollmentDate: z.string().optional(),
});

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2 border-b last:border-0">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm text-right max-w-[60%]">{value ?? '—'}</span>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isTeacher = user?.role === 'teacher';
  const [editOpen, setEditOpen] = useState(false);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(editSchema),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['student', id],
    queryFn: async () => {
      const res = await studentsApi.get(id);
      return res.data?.student ?? res.data?.data ?? res.data;
    },
    enabled: !!id,
  });

  const { mutate: updateStudent, isPending: saving } = useMutation({
    mutationFn: (body) => studentsApi.update(id, body),
    onSuccess: () => {
      toast.success('Student details updated');
      queryClient.invalidateQueries({ queryKey: ['student', id] });
      setEditOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const openEdit = () => {
    if (!student) return;
    reset({
      firstName: student.firstName ?? '',
      lastName: student.lastName ?? '',
      gender: student.gender ?? 'male',
      dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().slice(0, 10) : '',
      admissionNumber: student.admissionNumber ?? '',
      birthCertificateNumber: student.birthCertificateNumber ?? '',
      enrollmentDate: student.enrollmentDate ? new Date(student.enrollmentDate).toISOString().slice(0, 10) : '',
    });
    setEditOpen(true);
  };

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-48 w-full" />
    </div>
  );

  const student = data?.student ?? data;
  const cls = student?.classId;
  const guardians = Array.isArray(student?.guardians) ? student.guardians : [];
  const linkedParents = Array.isArray(student?.parentIds) ? student.parentIds : [];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{student?.firstName} {student?.lastName}</h1>
          <p className="text-muted-foreground text-sm font-mono">{student?.admissionNumber}</p>
        </div>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${getStatusColor(student?.status)}`}>
          {capitalize(student?.status ?? '')}
        </span>
        {!isTeacher && (
          <Button size="sm" variant="outline" onClick={openEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
          </Button>
        )}
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          {!isTeacher && <TabsTrigger value="fees">Fees</TabsTrigger>}
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Full Name" value={`${student?.firstName} ${student?.lastName}`} />
                <InfoRow label="Gender" value={capitalize(student?.gender ?? '')} />
                <InfoRow label="Date of Birth" value={formatDate(student?.dateOfBirth)} />
                <InfoRow label="Birth Certificate" value={student?.birthCertificateNumber} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Academic Information</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Admission No." value={student?.admissionNumber} />
                <InfoRow label="Class" value={typeof cls === 'object' ? `${cls.name}${cls.stream ? ` ${cls.stream}` : ''}` : '—'} />
                <InfoRow label="Level" value={typeof cls === 'object' ? cls.levelCategory : '—'} />
                <InfoRow label="Academic Year" value={typeof cls === 'object' ? cls.academicYear : '—'} />
                <InfoRow label="Enrolled" value={formatDate(student?.enrollmentDate ?? student?.createdAt)} />
              </CardContent>
            </Card>

            <Card className="sm:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">Parent / Guardian Information</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {guardians.length === 0 && linkedParents.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">No parent or guardian information on record.</p>
                )}

                {guardians.length > 0 && (
                  <div className="space-y-2 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Guardians</p>
                    {guardians.map((g, idx) => (
                      <div key={idx} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{g?.firstName} {g?.lastName}</p>
                        <div className="mt-1 grid grid-cols-2 gap-x-4 text-muted-foreground text-xs">
                          <span>Relationship: {capitalize(g?.relationship ?? '')}</span>
                          <span>Phone: {g?.phone ?? '—'}</span>
                          {g?.email && <span className="col-span-2">Email: {g.email}</span>}
                          {g?.occupation && <span>Occupation: {g.occupation}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {linkedParents.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Linked Parent Accounts</p>
                    {linkedParents.map((p, idx) => (
                      <div key={p?._id ?? idx} className="rounded-lg border p-3 text-sm">
                        <p className="font-medium">{p?.firstName} {p?.lastName}</p>
                        <div className="mt-1 text-muted-foreground text-xs space-y-0.5">
                          <p>Phone: {p?.phone ?? '—'}</p>
                          <p>Email: {p?.email ?? '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fees">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Fee details are available in the Fees section.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Attendance summary coming soon.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Edit dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Student Details</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(updateStudent)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input {...register('firstName')} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input {...register('lastName')} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Gender</Label>
                <Select defaultValue={student?.gender} onValueChange={(v) => setValue('gender', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Date of Birth</Label>
                <Input type="date" {...register('dateOfBirth')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Admission Number</Label>
                <Input {...register('admissionNumber')} />
                {errors.admissionNumber && <p className="text-xs text-destructive">{errors.admissionNumber.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Enrollment Date</Label>
                <Input type="date" {...register('enrollmentDate')} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Birth Certificate No. (optional)</Label>
              <Input {...register('birthCertificateNumber')} placeholder="e.g. 12345678" />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
