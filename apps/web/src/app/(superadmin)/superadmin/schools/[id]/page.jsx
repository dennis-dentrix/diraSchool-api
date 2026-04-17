'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { adminApi, studentsApi, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const planColors = {
  trial: 'bg-yellow-100 text-yellow-800',
  basic: 'bg-blue-100 text-blue-800',
  standard: 'bg-purple-100 text-purple-800',
  premium: 'bg-green-100 text-green-800',
};

const statusColors = {
  trial: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}

export default function SchoolDetailPage() {
  const params = useParams();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const [subForm, setSubForm] = useState(null);

  // Use the admin endpoint — returns staff breakdown too
  const { data: school, isLoading } = useQuery({
    queryKey: ['sa-school', id],
    queryFn: async () => {
      const res = await adminApi.getSchool(id);
      const s = res.data?.school ?? res.data?.data ?? res.data;
      setSubForm({
        planTier: s?.planTier ?? 'standard',
        subscriptionStatus: s?.subscriptionStatus ?? 'active',
        trialExpiry: s?.trialExpiry ? new Date(s.trialExpiry).toISOString().slice(0, 10) : '',
      });
      return s;
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
    mutationFn: (data) => adminApi.updateSchoolStatus(id, data),
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

  const plan   = school?.planTier ?? 'standard';
  const status = school?.subscriptionStatus ?? 'active';
  const staff  = school?.staff;

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">{school?.name}</h1>
          <p className="text-muted-foreground text-sm">{school?.email}</p>
        </div>
        <div className="flex gap-2">
          <Badge className={`capitalize ${planColors[plan]}`}>{plan}</Badge>
          <Badge className={`capitalize ${statusColors[status]}`}>{status}</Badge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        {/* ── Overview ──────────────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">School Information</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <InfoRow label="Name" value={school?.name} />
                <InfoRow label="Email" value={school?.email} />
                <InfoRow label="Phone" value={school?.phone} />
                <InfoRow label="County" value={school?.county} />
                <InfoRow label="Address" value={school?.address} />
                <InfoRow label="Reg. Number" value={school?.registrationNumber} />
                <InfoRow label="Registered" value={formatDate(school?.createdAt)} />
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Subscription</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  <InfoRow label="Plan" value={<Badge className={`capitalize ${planColors[plan]}`}>{plan}</Badge>} />
                  <InfoRow label="Status" value={<Badge className={`capitalize ${statusColors[status]}`}>{status}</Badge>} />
                  <InfoRow label="Trial Expiry" value={school?.trialExpiry ? formatDate(school.trialExpiry) : '—'} />
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-3xl font-bold">{staff?.total ?? '—'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Staff Members</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-3xl font-bold">{studentsData?.pagination?.total ?? '—'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Students</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Subscription ──────────────────────────────────────────────────── */}
        <TabsContent value="subscription">
          <Card className="max-w-sm">
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
                    <Label>Subscription Status</Label>
                    <Select value={subForm.subscriptionStatus} onValueChange={(v) => setSubForm((p) => ({ ...p, subscriptionStatus: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
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
                    onClick={() => updateSub({ planTier: subForm.planTier, subscriptionStatus: subForm.subscriptionStatus, trialExpiry: subForm.trialExpiry || undefined })}
                    disabled={isPending}
                  >
                    Save Changes
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Staff ─────────────────────────────────────────────────────────── */}
        <TabsContent value="staff">
          <Card>
            <CardContent className="py-5">
              {staff ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <span className="text-sm font-semibold">Total Staff</span>
                    <span className="text-2xl font-bold">{staff.total}</span>
                  </div>
                  {Object.entries(staff.byRole ?? {}).map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between py-1">
                      <span className="text-sm capitalize text-muted-foreground">{role.replace(/_/g, ' ')}</span>
                      <span className="text-sm font-semibold tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No staff data available.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Students ──────────────────────────────────────────────────────── */}
        <TabsContent value="students">
          <Card>
            <CardContent className="py-5">
              <p className="text-sm text-muted-foreground mb-3">
                Total enrolled: <span className="font-semibold text-foreground">{studentsData?.pagination?.total ?? '—'}</span>
              </p>
              {studentsLoading ? (
                <p className="text-sm">Loading…</p>
              ) : (
                <div className="divide-y">
                  {(studentsData?.students ?? studentsData?.data ?? []).map((s) => (
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
