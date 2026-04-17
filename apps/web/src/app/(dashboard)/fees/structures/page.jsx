'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { feesApi, classesApi, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

// Fee line-item categories (matches Kenyan school fee structures)
const CATEGORIES = [
  'School Fees',
  'One-Time Payment',
  'Boarding / Hostel',
  'Transport',
  'Stationery / Books',
  'Uniform',
  'Activity / Sports',
  'Other',
];

const CONFIRM_INIT = { open: false, id: null };

// Group items by category for display
function groupByCategory(items = []) {
  return items.reduce((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
}

// ── Structure card ────────────────────────────────────────────────────────────
function StructureCard({ structure, onDelete }) {
  const grouped = groupByCategory(structure.items);
  const categories = Object.keys(grouped);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">
              {typeof structure.classId === 'object'
                ? `${structure.classId.name}${structure.classId.stream ? ` ${structure.classId.stream}` : ''}`
                : '—'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{structure.term} · {structure.academicYear}</p>
          </div>
          <Button
            variant="ghost" size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{cat}</p>
            {grouped[cat].map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-0.5">
                <span className="text-muted-foreground">{item.name}</span>
                <span className="font-medium tabular-nums">{formatCurrency(item.amount)}</span>
              </div>
            ))}
          </div>
        ))}

        <Separator />
        <div className="flex items-center justify-between text-sm font-bold">
          <span>Total Per Term</span>
          <span className="text-blue-600">{formatCurrency(structure.totalAmount)}</span>
        </div>

        {structure.notes && (
          <p className="text-xs text-muted-foreground bg-slate-50 rounded-md px-3 py-2 italic border">
            NB: {structure.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FeeStructuresPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  // Default to empty string = fetch all years; settings query will set the right year
  const [filterYear, setFilterYear] = useState('');
  const [confirmDialog, setConfirmDialog] = useState(CONFIRM_INIT);

  const { register, handleSubmit, reset, setValue, control, watch } = useForm({
    defaultValues: {
      classId: '',
      academicYear: filterYear,
      term: 'Term 1',
      notes: '',
      items: [
        { category: 'School Fees', name: 'Tuition Fee', amount: '' },
        { category: 'School Fees', name: 'Admission Fee (One Time)', amount: '' },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const { data, isLoading } = useQuery({
    queryKey: ['fee-structures', filterYear],
    queryFn: async () => {
      const params = { limit: 100 };
      if (filterYear) params.academicYear = filterYear;
      const res = await feesApi.listStructures(params);
      return res.data;
    },
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => { const res = await classesApi.list({ limit: 100 }); return res.data; },
  });

  const { mutate: createStructure, isPending } = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        items: data.items
          .filter((i) => i.name && i.amount)
          .map((i) => ({ ...i, amount: Number(i.amount) })),
      };
      return feesApi.createStructure(payload);
    },
    onSuccess: () => {
      toast.success('Fee structure created');
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteStructure } = useMutation({
    mutationFn: (id) => feesApi.deleteStructure(id),
    onSuccess: () => {
      toast.success('Structure deleted');
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const total = items?.reduce((s, i) => s + (Number(i.amount) || 0), 0) ?? 0;
  const structures = data?.data ?? [];
  const classes = classesData?.data ?? classesData?.classes ?? [];

  // Group structures by class for a cleaner view
  const grouped = structures.reduce((acc, s) => {
    const clsId = typeof s.classId === 'object' ? s.classId._id : s.classId;
    if (!acc[clsId]) acc[clsId] = [];
    acc[clsId].push(s);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader title="Fee Structures" description="Configure term fees per class — printed on student invoices">
        <Select value={filterYear} onValueChange={(v) => setFilterYear(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All years" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All years</SelectItem>
            {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Structure
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-52" />)}
        </div>
      ) : structures.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="font-medium">No fee structures for {filterYear}</p>
          <p className="text-sm mt-1">Create a structure for each class and term.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {structures.map((s) => (
            <StructureCard
              key={s._id}
              structure={s}
              onDelete={() => setConfirmDialog({ open: true, id: s._id })}
            />
          ))}
        </div>
      )}

      {/* ── Create fee structure dialog ──────────────────────────────────── */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Fee Structure</DialogTitle>
            <p className="text-sm text-muted-foreground">Add all fee items for this class and term. Empty rows are ignored.</p>
          </DialogHeader>

          <form onSubmit={handleSubmit(createStructure)} className="space-y-5">
            {/* Class / year / term */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Class <span className="text-destructive">*</span></Label>
                <Select onValueChange={(v) => setValue('classId', v)}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}{c.stream ? ` ${c.stream}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Academic Year</Label>
                <Select defaultValue={filterYear} onValueChange={(v) => setValue('academicYear', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Term</Label>
                <Select defaultValue="Term 1" onValueChange={(v) => setValue('term', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Fee items table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fee Items</Label>
                <Button
                  type="button" size="sm" variant="outline"
                  onClick={() => append({ category: 'School Fees', name: '', amount: '' })}
                >
                  <Plus className="h-3 w-3" /> Add Row
                </Button>
              </div>

              {/* Header row */}
              <div className="grid grid-cols-[1fr_1.5fr_6rem_2rem] gap-2 px-1">
                <p className="text-xs font-medium text-muted-foreground">Category</p>
                <p className="text-xs font-medium text-muted-foreground">Description / Particulars</p>
                <p className="text-xs font-medium text-muted-foreground text-right">Amount (KES)</p>
                <span />
              </div>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {fields.map((field, i) => (
                  <div key={field.id} className="grid grid-cols-[1fr_1.5fr_6rem_2rem] gap-2 items-center">
                    {/* Category select */}
                    <Select
                      defaultValue={field.category || 'School Fees'}
                      onValueChange={(v) => setValue(`items.${i}.category`, v)}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {/* Description */}
                    <Input
                      {...register(`items.${i}.name`)}
                      placeholder="e.g. Tuition Fee"
                      className="h-9 text-sm"
                    />

                    {/* Amount */}
                    <Input
                      {...register(`items.${i}.amount`)}
                      placeholder="0"
                      type="number"
                      min="0"
                      className="h-9 text-sm text-right"
                    />

                    {/* Remove */}
                    {fields.length > 1 ? (
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="h-9 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(i)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : <span />}
                  </div>
                ))}
              </div>

              {/* Running total */}
              <div className="flex justify-end pt-2 border-t">
                <div className="text-sm font-semibold flex gap-4">
                  <span className="text-muted-foreground">Total Per Term:</span>
                  <span className="text-blue-600 tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Notes / NB */}
            <div className="space-y-1.5">
              <Label>Notes / NB <span className="text-muted-foreground text-xs">(optional — appears on invoices)</span></Label>
              <Textarea
                {...register('notes')}
                placeholder="e.g. Tuition fee inclusive of meals and swimming. Transport fee may vary depending on distance."
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpen(false); reset(); }}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Create Structure</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete ───────────────────────────────────────────────── */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog(CONFIRM_INIT)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete fee structure?</AlertDialogTitle>
            <AlertDialogDescription>
              This structure will be permanently removed. Student invoices that reference it will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteStructure(confirmDialog.id); setConfirmDialog(CONFIRM_INIT); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
