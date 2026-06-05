'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, LogIn, LogOut, MapPin, AlertCircle } from 'lucide-react';
import { checkInsApi } from '@/lib/api';
import { capitalize } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const ROLE_LABELS = {
  teacher:           'Teacher',
  department_head:   'Dept. Head',
  secretary:         'Secretary',
  accountant:        'Accountant',
  headteacher:       'Head Teacher',
  deputy_headteacher:'Deputy Head',
  director:          'Director',
};

function fmtTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function StatusBadge({ status, off_site }) {
  if (!status) return <span className="text-muted-foreground text-xs">—</span>;
  const isLate = status === 'late';
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
      isLate ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
    )}>
      {isLate ? 'Late' : 'On time'}
      {off_site && <MapPin className="h-2.5 w-2.5" />}
    </span>
  );
}

function SummaryCard({ value, label, color }) {
  return (
    <div className="bg-card border rounded-lg py-4 text-center">
      <p className={cn('text-2xl font-bold font-mono tabular-nums', color)}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{label}</p>
    </div>
  );
}

export default function StaffAttendancePage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['staff-roster', dateStr],
    queryFn: async () => {
      const res = await checkInsApi.roster(dateStr);
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: isToday ? 120_000 : false,
  });

  const roster  = data?.roster  ?? [];
  const counts  = data?.counts  ?? {};

  const present  = roster.filter((r) => r.present);
  const absent   = roster.filter((r) => !r.present);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Staff Attendance"
        description="Daily check-in and check-out record for all staff"
      >
        {/* Date navigator */}
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[120px] text-center">
            {isToday ? 'Today' : format(selectedDate, 'dd MMM yyyy')}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8"
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            disabled={isToday}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" className="h-8 text-xs ml-1"
              onClick={() => setSelectedDate(new Date())}>
              Today
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Summary cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard value={counts.present   ?? 0} label="Checked In"   color="text-green-600" />
          <SummaryCard value={counts.checkedOut ?? 0} label="Checked Out"  color="text-blue-600"  />
          <SummaryCard value={counts.late       ?? 0} label="Late"         color="text-amber-600" />
          <SummaryCard value={counts.absent     ?? 0} label="Absent"       color="text-red-600"   />
        </div>
      )}

      {/* Roster table */}
      {isLoading ? (
        <div className="space-y-1">
          {[1,2,3,4,5,6].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
        </div>
      ) : roster.length === 0 ? (
        <div className="rounded-lg border bg-card py-16 text-center text-muted-foreground text-sm">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
          No staff records for this date.
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="text-left py-2.5 px-4 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Staff</th>
                  <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground hidden sm:table-cell">Role</th>
                  <th className="text-center py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><LogIn className="h-3 w-3" /> Check In</span>
                  </th>
                  <th className="text-center py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Status</th>
                  <th className="text-center py-2.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><LogOut className="h-3 w-3" /> Check Out</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Present staff */}
                {present.map((row) => {
                  const { staff, morningIn, eveningOut } = row;
                  return (
                    <tr key={String(staff._id ?? staff)} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-medium">{staff.firstName} {staff.lastName}</p>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {ROLE_LABELS[staff.role] ?? capitalize(staff.role ?? '')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-sm tabular-nums text-foreground">
                          {fmtTime(morningIn?.createdAt) ?? '—'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <StatusBadge status={morningIn?.status} off_site={morningIn?.off_site} />
                        {morningIn?.off_site && morningIn?.off_site_reason && (
                          <p className="text-[9px] text-muted-foreground mt-0.5 max-w-[120px] mx-auto truncate" title={morningIn.off_site_reason}>
                            {morningIn.off_site_reason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {eveningOut ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-mono text-sm tabular-nums text-foreground">
                              {fmtTime(eveningOut.createdAt)}
                            </span>
                            <StatusBadge status={eveningOut.status} off_site={eveningOut.off_site} />
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not yet</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* Absent staff — subtle separator */}
                {absent.length > 0 && present.length > 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-1.5 bg-muted/10">
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3" /> Not checked in ({absent.length})
                      </span>
                    </td>
                  </tr>
                )}

                {absent.map((row) => {
                  const { staff } = row;
                  return (
                    <tr key={String(staff._id ?? staff)} className="hover:bg-muted/20 transition-colors opacity-60">
                      <td className="py-3 px-4">
                        <p className="font-medium">{staff.firstName} {staff.lastName}</p>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground text-xs hidden sm:table-cell">
                        {ROLE_LABELS[staff.role] ?? capitalize(staff.role ?? '')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="text-xs text-red-500 font-medium">Absent</span>
                      </td>
                      <td className="py-3 px-3 text-center">—</td>
                      <td className="py-3 px-3 text-center">—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
