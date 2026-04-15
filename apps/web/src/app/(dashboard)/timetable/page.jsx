'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { timetableApi, classesApi } from '@/lib/api';
import { ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Calendar } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

export default function TimetablePage() {
  const [selectedClass, setSelectedClass] = useState('');

  const { data: classesData } = useQuery({ queryKey: ['classes'], queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; } });
  const { data, isLoading } = useQuery({
    queryKey: ['timetable', selectedClass],
    queryFn: async () => {
      const res = await timetableApi.list({ classId: selectedClass, limit: 1 });
      return res.data?.data?.[0] ?? null;
    },
    enabled: !!selectedClass,
  });

  const slotsByDay = {};
  if (data?.slots) {
    data.slots.forEach((slot) => {
      if (!slotsByDay[slot.day]) slotsByDay[slot.day] = [];
      slotsByDay[slot.day].push(slot);
    });
    Object.values(slotsByDay).forEach((slots) => slots.sort((a, b) => a.period - b.period));
  }

  return (
    <div>
      <PageHeader title="Timetable" description="View class schedules">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Select a class" /></SelectTrigger>
          <SelectContent>
            {classesData?.data?.map((c) => <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>)}
          </SelectContent>
        </Select>
      </PageHeader>

      {!selectedClass ? (
        <EmptyState icon={Calendar} title="Select a class" description="Choose a class above to view its timetable" />
      ) : isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !data ? (
        <EmptyState icon={Calendar} title="No timetable configured" description="Contact your admin to set up the timetable for this class" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {DAYS.map((day) => (
            <div key={day}>
              <h3 className="font-semibold text-sm mb-2 text-center py-1 bg-primary text-primary-foreground rounded">{day}</h3>
              <div className="space-y-2">
                {(slotsByDay[day] ?? []).length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-4">—</p>
                ) : (slotsByDay[day] ?? []).map((slot, i) => (
                  <Card key={i} className="text-center">
                    <CardContent className="py-2 px-3">
                      <p className="text-xs text-muted-foreground">{slot.startTime} – {slot.endTime}</p>
                      <p className="text-sm font-medium">{typeof slot.subjectId === 'object' ? slot.subjectId?.name : '—'}</p>
                      {slot.room && <p className="text-xs text-muted-foreground">Room {slot.room}</p>}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
