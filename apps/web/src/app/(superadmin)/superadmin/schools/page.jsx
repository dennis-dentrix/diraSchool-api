'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Search, MoreHorizontal, GraduationCap, Users } from 'lucide-react';
import { adminApi, getErrorMessage } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const planColors = {
  trial: 'bg-yellow-100 text-yellow-800',
  basic: 'bg-blue-100 text-blue-800',
  standard: 'bg-purple-100 text-purple-800',
  premium: 'bg-green-100 text-green-800',
};

const statusColors = {
  trial: 'bg-yellow-100 text-yellow-800',
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

export default function SuperadminSchoolsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subOpen, setSubOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [subForm, setSubForm] = useState({ planTier: '', subscriptionStatus: '', trialExpiry: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['sa-schools-list', page, search, statusFilter],
    queryFn: async () => {
      const res = await adminApi.listSchools({
        page, limit: 20,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      return res.data;
    },
  });

  const { mutate: updateSub, isPending } = useMutation({
    mutationFn: ({ id, data }) => adminApi.updateSchoolStatus(id, data),
    onSuccess: () => {
      toast.success('Subscription updated');
      queryClient.invalidateQueries({ queryKey: ['sa-schools-list'] });
      setSubOpen(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function openSubDialog(school) {
    setSelectedSchool(school);
    setSubForm({
      planTier: school.planTier ?? 'standard',
      subscriptionStatus: school.subscriptionStatus ?? 'active',
      trialExpiry: school.trialExpiry ? new Date(school.trialExpiry).toISOString().slice(0, 10) : '',
    });
    setSubOpen(true);
  }

  const columns = [
    {
      id: 'school',
      header: 'School',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.county ?? '—'} · {row.original.email ?? '—'}</p>
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Plan / Status',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize w-fit ${planColors[row.original.planTier] ?? 'bg-gray-100 text-gray-800'}`}>
            {row.original.planTier ?? 'standard'}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize w-fit ${statusColors[row.original.subscriptionStatus] ?? 'bg-gray-100 text-gray-800'}`}>
            {row.original.subscriptionStatus ?? 'active'}
          </span>
        </div>
      ),
    },
    {
      id: 'counts',
      header: 'Staff / Students',
      cell: ({ row }) => (
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />{row.original.staffCount ?? '—'}
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />{row.original.studentCount ?? '—'}
          </span>
        </div>
      ),
    },
    {
      id: 'expiry',
      header: 'Trial Expiry',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.trialExpiry ? formatDate(row.original.trialExpiry) : '—'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Registered',
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
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

  const schools = data?.schools ?? data?.data ?? [];
  const pagination = data?.pagination ?? data?.meta;

  return (
    <div>
      <PageHeader
        title={`Schools ${pagination?.total ? `(${pagination.total})` : ''}`}
        description="All registered schools on the platform"
      />

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search schools…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All statuses</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={schools}
        loading={isLoading}
        pageCount={pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />

      {/* ── Subscription quick-edit dialog ────────────────────────────────── */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Subscription — {selectedSchool?.name}</DialogTitle></DialogHeader>
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
              <Label>Subscription Status</Label>
              <Select value={subForm.subscriptionStatus} onValueChange={(v) => setSubForm((p) => ({ ...p, subscriptionStatus: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
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
              onClick={() => updateSub({
                id: selectedSchool._id,
                data: { planTier: subForm.planTier, subscriptionStatus: subForm.subscriptionStatus, trialExpiry: subForm.trialExpiry || undefined },
              })}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
