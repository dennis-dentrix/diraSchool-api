'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Building2, MoreHorizontal, Plus } from 'lucide-react';
import { schoolsApi, getErrorMessage } from '@/lib/api';
import { formatDate, capitalize } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useForm } from 'react-hook-form';

const planColors = {
  trial: 'bg-yellow-100 text-yellow-800',
  basic: 'bg-blue-100 text-blue-800',
  standard: 'bg-purple-100 text-purple-800',
  premium: 'bg-green-100 text-green-800',
};

const statusColors = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

export default function SuperadminSchoolsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [subOpen, setSubOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [subForm, setSubForm] = useState({ planTier: '', status: '', trialExpiry: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['sa-schools-list', page, search, planFilter],
    queryFn: async () => {
      const res = await schoolsApi.list({
        page, limit: 20,
        search: search || undefined,
        planTier: planFilter || undefined,
      });
      return res.data;
    },
  });

  const { mutate: updateSub, isPending } = useMutation({
    mutationFn: ({ id, data }) => schoolsApi.updateSubscription(id, data),
    onSuccess: () => {
      toast.success('Subscription updated');
      queryClient.invalidateQueries({ queryKey: ['sa-schools-list'] });
      queryClient.invalidateQueries({ queryKey: ['sa-schools'] });
      setSubOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function openSubDialog(school) {
    setSelectedSchool(school);
    setSubForm({
      planTier: school.subscription?.planTier ?? 'trial',
      status: school.subscription?.status ?? 'active',
      trialExpiry: school.subscription?.trialExpiry
        ? new Date(school.subscription.trialExpiry).toISOString().slice(0, 10)
        : '',
    });
    setSubOpen(true);
  }

  const columns = [
    {
      accessorKey: 'name',
      header: 'School',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.email ?? '—'}</p>
        </div>
      ),
    },
    {
      accessorKey: 'subscription.planTier',
      header: 'Plan',
      cell: ({ row }) => (
        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${planColors[row.original.subscription?.planTier] ?? 'bg-gray-100 text-gray-800'}`}>
          {row.original.subscription?.planTier ?? 'trial'}
        </span>
      ),
    },
    {
      accessorKey: 'subscription.status',
      header: 'Status',
      cell: ({ row }) => (
        <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${statusColors[row.original.subscription?.status] ?? 'bg-gray-100 text-gray-800'}`}>
          {row.original.subscription?.status ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'subscription.trialExpiry',
      header: 'Trial Expiry',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.subscription?.trialExpiry ? formatDate(row.original.subscription.trialExpiry) : '—'}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Registered',
      cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => router.push(`/superadmin/schools/${row.original._id}`)}>View Details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSubDialog(row.original)}>Manage Subscription</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Schools" description="All registered schools on the platform" />

      <div className="flex gap-3 mb-4 flex-wrap">
        <Input
          placeholder="Search schools…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-56"
        />
        <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All plans" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All plans</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.data}
        loading={isLoading}
        pageCount={data?.pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />

      {/* Subscription dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Manage Subscription — {selectedSchool?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
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
              <Label>Status</Label>
              <Select value={subForm.status} onValueChange={(v) => setSubForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Trial Expiry</Label>
              <input
                type="date"
                value={subForm.trialExpiry}
                onChange={(e) => setSubForm((p) => ({ ...p, trialExpiry: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubOpen(false)}>Cancel</Button>
            <Button
              disabled={isPending}
              onClick={() => updateSub({ id: selectedSchool._id, data: { planTier: subForm.planTier, status: subForm.status, trialExpiry: subForm.trialExpiry || undefined } })}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
