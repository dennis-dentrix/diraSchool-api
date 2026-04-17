'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Zap, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { reportCardsApi, classesApi, studentsApi, getErrorMessage } from '@/lib/api';
import { formatDate, getStatusColor, capitalize } from '@/lib/utils';
import { ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

const columns = (onPublish, onView, onPrint) => [
  {
    id: 'student',
    header: 'Student',
    cell: ({ row }) => {
      const s = row.original.studentId;
      return (
        <p className="font-medium text-sm">{typeof s === 'object' ? `${s.firstName} ${s.lastName}` : '—'}</p>
      );
    },
  },
  {
    id: 'class',
    header: 'Class',
    cell: ({ row }) => {
      const c = row.original.classId;
      return <span className="text-sm">{typeof c === 'object' ? c.name : '—'}</span>;
    },
  },
  { accessorKey: 'term', header: 'Term', cell: ({ row }) => <span className="text-sm">{row.original.term}</span> },
  { accessorKey: 'academicYear', header: 'Year', cell: ({ row }) => <span className="text-sm">{row.original.academicYear}</span> },
  { accessorKey: 'overallGrade', header: 'Grade', cell: ({ row }) => <span className="font-bold">{row.original.overallGrade ?? '—'}</span> },
  { accessorKey: 'averagePoints', header: 'Avg Pts', cell: ({ row }) => <span>{row.original.averagePoints?.toFixed(1) ?? '—'}</span> },
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
          <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onView(row.original._id)}>View / Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onPrint(row.original._id)}>Print</DropdownMenuItem>
          {row.original.status === 'draft' && (
            <DropdownMenuItem onClick={() => onPublish(row.original._id)}>Publish</DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export default function ReportCardsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [genType, setGenType] = useState('student'); // 'student' or 'class'
  const [genData, setGenData] = useState({ academicYear: String(new Date().getFullYear()), term: 'Term 1' });

  const { data: classesData } = useQuery({ queryKey: ['classes'], queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; } });
  const { data: studentsData } = useQuery({ queryKey: ['students', 'all'], queryFn: async () => { const res = await studentsApi.list({ limit: 200, status: 'active' }); return res.data; } });

  const { data, isLoading } = useQuery({
    queryKey: ['report-cards', page],
    queryFn: async () => {
      const res = await reportCardsApi.list({ page, limit: 20 });
      return res.data;
    },
  });

  const { mutate: generate, isPending } = useMutation({
    mutationFn: () => genType === 'class'
      ? reportCardsApi.generateClass(genData)
      : reportCardsApi.generate(genData),
    onSuccess: () => {
      toast.success('Report card(s) generated');
      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
      setOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: publish } = useMutation({
    mutationFn: (id) => reportCardsApi.publish(id),
    onSuccess: () => {
      toast.success('Report card published');
      queryClient.invalidateQueries({ queryKey: ['report-cards'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div>
      <PageHeader title="Report Cards" description="Generate and publish CBC report cards">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Zap className="h-4 w-4" /> Generate
        </Button>
      </PageHeader>

      <DataTable
        columns={columns(
          (id) => { if (confirm('Publish this report card?')) publish(id); },
          (id) => router.push(`/report-cards/${id}`),
          (id) => window.open(`/report-cards/${id}/print`, '_blank'),
        )}
        data={data?.data}
        loading={isLoading}
        pageCount={data?.pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate Report Card</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              {['student', 'class'].map((t) => (
                <Button key={t} size="sm" variant={genType === t ? 'default' : 'outline'}
                  onClick={() => { setGenType(t); setGenData((p) => ({ academicYear: p.academicYear, term: p.term })); }}>
                  {t === 'student' ? 'Single Student' : 'Entire Class'}
                </Button>
              ))}
            </div>

            {genType === 'student' ? (
              <div className="space-y-1.5">
                <Label>Student</Label>
                <Select onValueChange={(v) => setGenData((p) => ({ ...p, studentId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {studentsData?.data?.map((s) => (
                      <SelectItem key={s._id} value={s._id}>{s.firstName} {s.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Class</Label>
                <Select onValueChange={(v) => setGenData((p) => ({ ...p, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classesData?.data?.map((c) => (
                      <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select defaultValue={genData.academicYear} onValueChange={(v) => setGenData((p) => ({ ...p, academicYear: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select defaultValue={genData.term} onValueChange={(v) => setGenData((p) => ({ ...p, term: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => generate()} disabled={isPending}>Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
