'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Save, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { settingsApi, getErrorMessage } from '@/lib/api';
import { ACADEMIC_YEARS, WORKING_DAYS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [newHoliday, setNewHoliday] = useState({ name: '', date: '', description: '' });
  const [form, setForm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await settingsApi.get();
      const settings = res.data.data;
      setForm(settings);
      return settings;
    },
  });

  const { mutate: saveSettings, isPending } = useMutation({
    mutationFn: () => settingsApi.update(form),
    onSuccess: () => { toast.success('Settings saved'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: addHoliday } = useMutation({
    mutationFn: () => settingsApi.addHoliday(newHoliday),
    onSuccess: () => { toast.success('Holiday added'); queryClient.invalidateQueries({ queryKey: ['settings'] }); setNewHoliday({ name: '', date: '', description: '' }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteHoliday } = useMutation({
    mutationFn: (id) => settingsApi.deleteHoliday(id),
    onSuccess: () => { toast.success('Holiday removed'); queryClient.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <PageHeader title="School Settings" description="Configure academic year, terms and holidays">
        <Button size="sm" onClick={() => saveSettings()} disabled={isPending}>
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </PageHeader>

      {/* General */}
      <Card>
        <CardHeader><CardTitle className="text-base">General</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Principal Name</Label>
              <Input value={form?.principalName ?? ''} onChange={(e) => setForm((p) => ({ ...p, principalName: e.target.value }))} placeholder="Mr. Kamau" />
            </div>
            <div className="space-y-1.5">
              <Label>School Motto</Label>
              <Input value={form?.motto ?? ''} onChange={(e) => setForm((p) => ({ ...p, motto: e.target.value }))} placeholder="Excelling in all" />
            </div>
            <div className="space-y-1.5">
              <Label>Physical Address</Label>
              <Input value={form?.physicalAddress ?? ''} onChange={(e) => setForm((p) => ({ ...p, physicalAddress: e.target.value }))} placeholder="P.O. Box 123, Nairobi" />
            </div>
            <div className="space-y-1.5">
              <Label>Current Academic Year</Label>
              <Select value={form?.currentAcademicYear ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, currentAcademicYear: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Holidays */}
      <Card>
        <CardHeader><CardTitle className="text-base">School Holidays</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {data?.holidays?.length ? data.holidays.map((h) => (
              <div key={h._id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{h.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(h.date)}{h.description ? ` · ${h.description}` : ''}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                  onClick={() => { if (confirm('Remove holiday?')) deleteHoliday(h._id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )) : <p className="text-sm text-muted-foreground">No holidays configured.</p>}
          </div>
          <Separator />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Holiday Name</Label>
              <Input value={newHoliday.name} onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))} placeholder="Madaraka Day" />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <input type="date" value={newHoliday.date} onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <Label>&nbsp;</Label>
              <Button className="w-full" variant="outline" onClick={() => addHoliday()} disabled={!newHoliday.name || !newHoliday.date}>
                <Plus className="h-4 w-4" /> Add Holiday
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
