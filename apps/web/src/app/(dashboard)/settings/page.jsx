'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Pencil, X, CalendarDays, School, Info } from 'lucide-react';
import { useState } from 'react';
import { settingsApi, schoolsApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { ACADEMIC_YEARS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

const CONFIRM_INIT = { open: false, holidayId: null };

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b last:border-0 gap-4">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{value || <span className="text-muted-foreground/60 italic">Not set</span>}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuthStore();
  const canEditSchoolDetails = ['school_admin', 'director', 'headteacher'].includes(user?.role);
  const queryClient = useQueryClient();
  const [editing, setEditing]       = useState(false);
  const [form, setForm]             = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(null);
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', description: '' });
  const [confirmDialog, setConfirmDialog] = useState(CONFIRM_INIT);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      const s = res.data?.settings ?? res.data?.data ?? res.data;
      return s;
    },
  });

  const { data: schoolData } = useQuery({
    queryKey: ['school-me'],
    queryFn: async () => {
      const res = await schoolsApi.me();
      return res.data?.school ?? res.data;
    },
  });

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: (data) => schoolsApi.updateMe(data),
    onSuccess: () => {
      toast.success('School profile saved');
      queryClient.invalidateQueries({ queryKey: ['school-me'] });
      setEditingProfile(false);
      setProfileForm(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: () => settingsApi.update(form),
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setEditing(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: addHoliday, isPending: addingHoliday } = useMutation({
    mutationFn: () => settingsApi.addHoliday(newHoliday),
    onSuccess: () => {
      toast.success('Holiday added');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setNewHoliday({ name: '', date: '', description: '' });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteHoliday } = useMutation({
    mutationFn: (id) => settingsApi.deleteHoliday(id),
    onSuccess: () => { toast.success('Holiday removed'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const startEditing = () => {
    setForm({
      principalName:      data?.principalName ?? '',
      motto:              data?.motto ?? '',
      physicalAddress:    data?.physicalAddress ?? '',
      currentAcademicYear: data?.currentAcademicYear ?? String(new Date().getFullYear()),
    });
    setEditing(true);
  };

  const cancelEditing = () => { setEditing(false); setForm(null); };

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="School Settings"
        description="Academic year, school information, and holidays"
      >
        {canEditSchoolDetails && editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={cancelEditing}><X className="h-4 w-4" /> Cancel</Button>
            <Button size="sm" onClick={() => saveSettings()} disabled={isPending}><Save className="h-4 w-4" /> Save Changes</Button>
          </div>
        ) : canEditSchoolDetails ? (
          <Button size="sm" variant="outline" onClick={startEditing}><Pencil className="h-4 w-4" /> Edit Settings</Button>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">View only</Badge>
        )}
      </PageHeader>

      {/* ── School Profile (county, constituency, address) ───────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <School className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">School Profile</CardTitle>
            </div>
            {!editingProfile && canEditSchoolDetails ? (
              <Button size="sm" variant="outline" onClick={() => { setProfileForm({ name: schoolData?.name ?? '', phone: schoolData?.phone ?? '', county: schoolData?.county ?? '', constituency: schoolData?.constituency ?? '', registrationNumber: schoolData?.registrationNumber ?? '', address: schoolData?.address ?? '' }); setEditingProfile(true); }}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            ) : editingProfile && canEditSchoolDetails ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setEditingProfile(false); setProfileForm(null); }}><X className="h-4 w-4" /> Cancel</Button>
                <Button size="sm" onClick={() => saveProfile(Object.fromEntries(Object.entries(profileForm).filter(([, v]) => v !== '')))} disabled={savingProfile}><Save className="h-4 w-4" /> Save</Button>
              </div>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">View only</Badge>
            )}
          </div>
          <CardDescription>Location, contact, and registration details.</CardDescription>
        </CardHeader>
        <CardContent>
          {editingProfile && profileForm ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>School Name</Label>
                <Input value={profileForm.name} onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>County</Label>
                <Input value={profileForm.county} onChange={(e) => setProfileForm((p) => ({ ...p, county: e.target.value }))} placeholder="e.g. Nairobi" />
              </div>
              <div className="space-y-1.5">
                <Label>Constituency</Label>
                <Input value={profileForm.constituency} onChange={(e) => setProfileForm((p) => ({ ...p, constituency: e.target.value }))} placeholder="e.g. Westlands" />
              </div>
              <div className="space-y-1.5">
                <Label>MOE Registration No.</Label>
                <Input value={profileForm.registrationNumber} onChange={(e) => setProfileForm((p) => ({ ...p, registrationNumber: e.target.value }))} placeholder="e.g. NRB/001/2024" />
              </div>
              <div className="space-y-1.5">
                <Label>Physical Address</Label>
                <Input value={profileForm.address} onChange={(e) => setProfileForm((p) => ({ ...p, address: e.target.value }))} placeholder="P.O Box 123, Nairobi" />
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label="Name" value={schoolData?.name} />
              <InfoRow label="Phone" value={schoolData?.phone} />
              <InfoRow label="County" value={schoolData?.county} />
              <InfoRow label="Constituency" value={schoolData?.constituency} />
              <InfoRow label="Reg. Number" value={schoolData?.registrationNumber} />
              <InfoRow label="Address" value={schoolData?.address} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── School Information ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <School className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">School Information</CardTitle>
          </div>
          <CardDescription>Appears on invoices, report cards, and the parent portal.</CardDescription>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Principal Name</Label>
                <Input value={form?.principalName ?? ''} onChange={(e) => setForm((p) => ({ ...p, principalName: e.target.value }))} placeholder="Mr. John Kamau" />
              </div>
              <div className="space-y-1.5">
                <Label>School Motto</Label>
                <Input value={form?.motto ?? ''} onChange={(e) => setForm((p) => ({ ...p, motto: e.target.value }))} placeholder="Faith and Diligence" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Physical Address / P.O. Box</Label>
                <Input value={form?.physicalAddress ?? ''} onChange={(e) => setForm((p) => ({ ...p, physicalAddress: e.target.value }))} placeholder="P.O. Box 4413-00100, Westlands, Nairobi" />
              </div>
              <div className="space-y-1.5">
                <Label>Current Academic Year</Label>
                <Select value={form?.currentAcademicYear ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, currentAcademicYear: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div>
              <InfoRow label="Principal" value={data?.principalName} />
              <InfoRow label="Motto" value={data?.motto} />
              <InfoRow label="Address" value={data?.physicalAddress} />
              <InfoRow
                label="Current Academic Year"
                value={
                  data?.currentAcademicYear
                    ? <Badge variant="secondary" className="font-mono">{data.currentAcademicYear}</Badge>
                    : null
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Term Dates ────────────────────────────────────────────────────────── */}
      {data?.terms?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Term Dates</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {data.terms.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-2.5 border-b last:border-0">
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(t.startDate)} → {formatDate(t.endDate)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Holidays ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">School Holidays</CardTitle>
          </div>
          <CardDescription>Public and school holidays for the academic calendar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* List */}
          <div>
            {data?.holidays?.length ? data.holidays.map((h) => (
              <div key={h._id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(h.date)}{h.description ? ` · ${h.description}` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => setConfirmDialog({ open: true, holidayId: h._id })}
                  disabled={!canEditSchoolDetails}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground py-1">No holidays configured.</p>
            )}
          </div>

          <Separator />

          {/* Add new */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Add Holiday</p>
            {!canEditSchoolDetails && (
              <p className="text-xs text-muted-foreground mb-2">Only school admin, director, or headteacher can edit holidays.</p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={newHoliday.name} onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))} placeholder="Madaraka Day" disabled={!canEditSchoolDetails} />
              </div>
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))} disabled={!canEditSchoolDetails} />
              </div>
              <div className="space-y-1.5">
                <Label>&nbsp;</Label>
                <Button className="w-full" variant="outline" onClick={() => addHoliday()} disabled={!canEditSchoolDetails || !newHoliday.name || !newHoliday.date || addingHoliday}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Confirm delete ────────────────────────────────────────────────────── */}
      <AlertDialog open={confirmDialog.open && canEditSchoolDetails} onOpenChange={(open) => !open && setConfirmDialog(CONFIRM_INIT)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove holiday?</AlertDialogTitle>
            <AlertDialogDescription>This holiday will be permanently removed from the school calendar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirmDialog.holidayId) deleteHoliday(confirmDialog.holidayId); setConfirmDialog(CONFIRM_INIT); }}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
