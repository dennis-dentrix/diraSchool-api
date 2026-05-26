'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { CalendarDays, Save, CheckCircle2 } from 'lucide-react';

const TERMS = ['Term 1', 'Term 2', 'Term 3'];

const emptyTerms = () => TERMS.map((name) => ({ name, startDate: '', endDate: '' }));

function mergeSavedTerms(saved = []) {
  return TERMS.map((name) => {
    const found = saved.find((t) => t.name === name);
    return {
      name,
      startDate: found?.startDate ? found.startDate.slice(0, 10) : '',
      endDate:   found?.endDate   ? found.endDate.slice(0, 10)   : '',
    };
  });
}

export default function PlatformSettingsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: async () => {
      const res = await adminApi.getSystemSettings();
      return res.data.settings ?? {};
    },
  });

  const [academicYear, setAcademicYear] = useState('');
  const [terms, setTerms] = useState(emptyTerms());
  const [initialised, setInitialised] = useState(false);

  if (data && !initialised) {
    setAcademicYear(data.currentAcademicYear ?? '');
    setTerms(mergeSavedTerms(data.terms));
    setInitialised(true);
  }

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: () =>
      adminApi.updateSystemSettings({
        currentAcademicYear: academicYear || undefined,
        terms: terms
          .filter((t) => t.startDate && t.endDate)
          .map((t) => ({ name: t.name, startDate: t.startDate, endDate: t.endDate })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-settings'] });
      toast.success('Platform settings saved.');
    },
    onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to save.'),
  });

  const updateTerm = (idx, field, value) =>
    setTerms((prev) => prev.map((t, i) => (i === idx ? { ...t, [field]: value } : t)));

  const now = new Date();
  const activeTerm = (data?.terms ?? []).find(
    (t) => new Date(t.startDate) <= now && now <= new Date(t.endDate)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Set the global academic year and term dates. All schools inherit these as defaults unless they configure their own."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-600" />
            Academic Calendar
          </CardTitle>
          <CardDescription>
            These dates are used as fallbacks for all schools that haven't configured their own term dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-48" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <>
              {activeTerm && (
                <div className="flex items-center gap-2 rounded-md bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Currently active: <strong>{activeTerm.name}</strong></span>
                </div>
              )}

              <div className="max-w-xs space-y-1">
                <Label>Academic Year</Label>
                <Input
                  placeholder="e.g. 2026"
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  maxLength={4}
                />
              </div>

              <div className="space-y-4">
                {terms.map((term, idx) => (
                  <div key={term.name} className="grid grid-cols-[120px_1fr_1fr] gap-4 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Term</Label>
                      <div className="flex items-center h-9">
                        <Badge variant="outline">{term.name}</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Start Date</Label>
                      <Input
                        type="date"
                        value={term.startDate}
                        onChange={(e) => updateTerm(idx, 'startDate', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">End Date</Label>
                      <Input
                        type="date"
                        value={term.endDate}
                        onChange={(e) => updateTerm(idx, 'endDate', e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={() => save()} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Platform Settings'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
