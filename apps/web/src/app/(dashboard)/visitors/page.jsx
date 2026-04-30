'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, UserCheck, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { visitorsApi, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DataTable } from '@/components/shared/data-table';

const today = new Date().toISOString().split('T')[0];

const schema = z.object({
  visitDate: z.string().min(1, 'Date is required'),
  name: z.string().min(1, 'Name is required'),
  reason: z.string().min(1, 'Reason is required'),
  comment: z.string().optional(),
});

const EMPTY_FORM = { visitDate: today, name: '', reason: '', comment: '' };

function VisitorDialog({ open, onClose, initial }) {
  const qc = useQueryClient();
  const isEdit = !!initial?._id;

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? { visitDate: initial.visitDate?.split('T')[0] ?? today, name: initial.name, reason: initial.reason, comment: initial.comment ?? '' }
      : EMPTY_FORM,
  });

  const { mutate, isPending } = useMutation({
    mutationFn: (data) => isEdit ? visitorsApi.update(initial._id, data) : visitorsApi.create(data),
    onSuccess: () => {
      toast.success(isEdit ? 'Visitor record updated' : 'Visitor logged');
      qc.invalidateQueries({ queryKey: ['visitors'] });
      reset(EMPTY_FORM);
      onClose();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(EMPTY_FORM); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Visitor Record' : 'Log Visitor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(mutate)} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Date of Visit</Label>
            <Input type="date" max={today} {...register('visitDate')} />
            {errors.visitDate && <p className="text-xs text-destructive">{errors.visitDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Visitor Name</Label>
            <Input {...register('name')} placeholder="John Kamau" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Reason for Visit</Label>
            <Input {...register('reason')} placeholder="Parent meeting, Delivery, Inspection…" />
            {errors.reason && <p className="text-xs text-destructive">{errors.reason.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Comment <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Textarea {...register('comment')} placeholder="Additional notes…" rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(EMPTY_FORM); onClose(); }}>Cancel</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Saving…' : isEdit ? 'Update' : 'Log Visitor'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function VisitorsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const debouncedSearch = useDebounce(search, 400);

  const { data, isLoading } = useQuery({
    queryKey: ['visitors', page, debouncedSearch, fromDate, toDate],
    queryFn: async () => {
      const res = await visitorsApi.list({ page, limit: 20, search: debouncedSearch || undefined, from: fromDate || undefined, to: toDate || undefined });
      return res.data;
    },
  });

  const { mutate: deleteVisitor, isPending: deleting } = useMutation({
    mutationFn: (id) => visitorsApi.remove(id),
    onSuccess: () => {
      toast.success('Visitor record deleted');
      qc.invalidateQueries({ queryKey: ['visitors'] });
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const visitors = data?.visitors ?? [];
  const meta = data?.meta ?? {};

  const columns = [
    {
      id: 'date',
      header: 'Date',
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">{formatDate(row.original.visitDate)}</span>
      ),
    },
    {
      id: 'name',
      header: 'Visitor Name',
      cell: ({ row }) => <span className="font-medium text-sm">{row.original.name}</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: ({ row }) => <span className="text-sm">{row.original.reason}</span>,
    },
    {
      id: 'comment',
      header: 'Comment',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.comment || '—'}</span>
      ),
    },
    {
      id: 'recordedBy',
      header: 'Recorded By',
      cell: ({ row }) => {
        const u = row.original.recordedBy;
        return <span className="text-xs text-muted-foreground">{u ? `${u.firstName} ${u.lastName}` : '—'}</span>;
      },
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex gap-1 justify-end">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditTarget(row.original); setDialogOpen(true); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(row.original)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visitors"
        description="Log and track school visitors"
        action={
          <Button onClick={() => { setEditTarget(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1.5" /> Log Visitor
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or reason…"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">From</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={fromDate} onChange={(e) => { setFromDate(e.target.value); setPage(1); }} />
        </div>
        <div className="flex items-center gap-1.5">
          <Label className="text-xs text-muted-foreground">To</Label>
          <Input type="date" className="h-9 w-36 text-sm" value={toDate} onChange={(e) => { setToDate(e.target.value); setPage(1); }} />
        </div>
        {(fromDate || toDate || search) && (
          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setPage(1); }}>
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : visitors.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <UserCheck className="h-10 w-10 opacity-30" />
          <p className="text-sm">No visitor records found.</p>
          <Button size="sm" onClick={() => { setEditTarget(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Log First Visitor
          </Button>
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={visitors}
          page={page}
          totalPages={meta.pages ?? 1}
          onPageChange={setPage}
        />
      )}

      <VisitorDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(null); }}
        initial={editTarget}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete visitor record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the record for <strong>{deleteTarget?.name}</strong> on {deleteTarget && formatDate(deleteTarget.visitDate)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteVisitor(deleteTarget._id)} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
