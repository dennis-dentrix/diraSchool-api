'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Users, GraduationCap } from 'lucide-react';
import { schoolsApi, usersApi, studentsApi, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/shared/data-table';

const planColors = {
  trial: 'bg-yellow-100 text-yellow-800',
  basic: 'bg-blue-100 text-blue-800',
  standard: 'bg-purple-100 text-purple-800',
  premium: 'bg-green-100 text-green-800',
};

const statusColors = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const staffColumns = [
  { accessorKey: 'firstName', header: 'Name', cell: ({ row }) => <span className="font-medium text-sm">{row.original.firstName} {row.original.lastName}</span> },
  { accessorKey: 'email', header: 'Email', cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.email}</span> },
  { accessorKey: 'role', header: 'Role', cell: ({ row }) => <span className="text-xs capitalize">{row.original.role?.replace(/_/g, ' ')}</span> },
  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <span className={`text-xs px-2 py-1 rounded-full capitalize ${row.original.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{row.original.status}</span> },
];

export default function SchoolDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subForm, setSubForm] = useState(null);

  const { data: school, isLoading } = useQuery({
    queryKey: ['sa-school', id],
    queryFn: async () => {
      const res = await schoolsApi.get(id);
      return res.data.data;
    },
    enabled: !!id,
    onSuccess: (d) => {
      if (!subForm) {
        setSubForm({
          planTier: d.subscription?.planTier ?? 'trial',
          status: d.subscription?.status ?? 'active',
          trialExpiry: d.subscription?.trialExpiry ? new Date(d.subscription.trialExpiry).toISOString().slice(0, 10) : '',
        });
      }
    },
  });

  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['sa-school-staff', id],
    queryFn: async () => {
      const res = await usersApi.list({ schoolId: id, limit: 50 });
      return res.data;
    },
    enabled: !!id,
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery({
    queryKey: ['sa-school-students', id],
    queryFn: async () => {
      const res = await studentsApi.list({ schoolId: id, limit: 10 });
      return res.data;
    },
    enabled: !!id,
  });

  const { mutate: updateSub, isPending } = useMutation({
    mutationFn: (data) => schoolsApi.updateSubscription(id, data),
    onSuccess: () => {
      toast.success('Subscription updated');
      queryClient.invalidateQueries({ queryKey: ['sa-school', id] });
      queryClient.invalidateQueries({ queryKey: ['sa-schools-list'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );

  const currentPlan = school?.subscription?.planTier ?? 'trial';
  const currentStatus = school?.subscription?.status ?? 'active';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{school?.name}</h1>
          <p className="text-muted-foreground text-sm">{school?.email}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${planColors[currentPlan]}`}>{currentPlan}</span>
          <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColors[currentStatus]}`}>{currentStatus}</span>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">School Info</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{school?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span>{school?.email ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{school?.phone ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="text-right max-w-48">{school?.physicalAddress ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Principal</span><span>{school?.principalName ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Registered</span><span>{formatDate(school?.createdAt)}</span></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Subscription</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${planColors[currentPlan]}`}>{currentPlan}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColors[currentStatus]}`}>{currentStatus}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Trial Expiry</span><span>{school?.subscription?.trialExpiry ? formatDate(school.subscription.trialExpiry) : '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Staff</span><span className="font-semibold">{staffData?.pagination?.total ?? '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Students</span><span className="font-semibold">{studentsData?.pagination?.total ?? '—'}</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="subscription">
          <Card className="max-w-md">
            <CardHeader><CardTitle className="text-base">Update Subscription</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {subForm && (
                <>
                  <div className="space-y-1.5">
                    <Label>Plan Tier</Label>
                    <Select value={subForm.planTier} onValueChange={(v) => setSubForm((p) => ({ ...p, planTier: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={subForm.status} onValueChange={(v) => setSubForm((p) => ({ ...p, status: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Trial Expiry Date</Label>
                    <input
                      type="date"
                      value={subForm.trialExpiry}
                      onChange={(e) => setSubForm((p) => ({ ...p, trialExpiry: e.target.value }))}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  <Button
                    onClick={() => updateSub({ planTier: subForm.planTier, status: subForm.status, trialExpiry: subForm.trialExpiry || undefined })}
                    disabled={isPending}
                  >
                    Save Changes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="staff">
          <DataTable columns={staffColumns} data={staffData?.data} loading={staffLoading} />
        </TabsContent>

        <TabsContent value="students">
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-muted-foreground">Showing first 10 students. Total: <span className="font-semibold text-foreground">{studentsData?.pagination?.total ?? '—'}</span></p>
              {studentsLoading ? (
                <p className="text-sm mt-2">Loading…</p>
              ) : (
                <div className="divide-y mt-4">
                  {(studentsData?.data ?? []).map((s) => (
                    <div key={s._id} className="flex justify-between py-2 text-sm">
                      <span className="font-medium">{s.firstName} {s.lastName}</span>
                      <span className="text-muted-foreground font-mono">{s.admissionNumber}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
