'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, MoreHorizontal } from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { feesApi, classesApi, getErrorMessage } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ACADEMIC_YEARS, TERMS } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function FeeStructuresPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  const { register, handleSubmit, reset, setValue, control, watch } = useForm({
    defaultValues: {
      academicYear: filterYear,
      term: 'Term 1',
      items: [{ name: '', amount: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const items = watch('items');

  const { data, isLoading } = useQuery({
    queryKey: ['fee-structures', filterYear],
    queryFn: async () => {
      const res = await feesApi.listStructures({ academicYear: filterYear, limit: 100 });
      return res.data;
    },
  });

  const { data: classesData } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const res = await classesApi.list({ limit: 100 });
      return res.data;
    },
  });

  const { mutate: createStructure, isPending } = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, items: data.items.map((i) => ({ ...i, amount: Number(i.amount) })) };
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
      toast.success('Deleted');
      queryClient.invalidateQueries({ queryKey: ['fee-structures'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const total = items?.reduce((s, i) => s + (Number(i.amount) || 0), 0) ?? 0;
  const structures = data?.data ?? [];

  return (
    <div>
      <PageHeader title="Fee Structures" description="Configure fee breakdowns per class and term">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACADEMIC_YEARS.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New Structure
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : structures.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No fee structures for {filterYear}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {structures.map((s) => (
            <Card key={s._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {typeof s.classId === 'object' ? `${s.classId.name}${s.classId.stream ? ` ${s.classId.stream}` : ''}` : '—'}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{s.term} · {s.academicYear}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                    onClick={() => { if (confirm('Delete this structure?')) deleteStructure(s._id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {s.items?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">{formatCurrency(item.amount)}</span>
                  </div>
                ))}
                <Separator />
                <div className="flex items-center justify-between text-sm font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(s.totalAmount)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Create Fee Structure</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createStructure)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Class</Label>
              <Select onValueChange={(v) => setValue('classId', v)}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classesData?.data?.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}{c.stream ? ` ${c.stream}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Fee Items</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => append({ name: '', amount: '' })}>
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>
              {fields.map((field, i) => (
                <div key={field.id} className="flex gap-2">
                  <Input {...register(`items.${i}.name`)} placeholder="Item name" className="flex-1" />
                  <Input {...register(`items.${i}.amount`)} placeholder="Amount" type="number" className="w-28" />
                  {fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-10 w-10" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="text-right text-sm font-semibold text-muted-foreground">
                Total: {formatCurrency(total)}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Create Structure</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
