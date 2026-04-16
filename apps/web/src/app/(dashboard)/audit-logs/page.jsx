'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@/lib/api';
import { formatDate, capitalize } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const ACTIONS = ['create', 'update', 'delete', 'publish', 'reverse', 'suspend', 'activate', 'transfer', 'withdraw', 'promote'];
const RESOURCES = ['Payment', 'Student', 'ReportCard', 'School', 'User', 'Book', 'BookLoan'];

const actionColors = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  publish: 'bg-purple-100 text-purple-800',
  reverse: 'bg-orange-100 text-orange-800',
  suspend: 'bg-red-100 text-red-800',
  activate: 'bg-green-100 text-green-800',
};

const columns = [
  {
    accessorKey: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${actionColors[row.original.action] ?? 'bg-gray-100 text-gray-800'}`}>
        {capitalize(row.original.action)}
      </span>
    ),
  },
  { accessorKey: 'resource', header: 'Resource', cell: ({ row }) => <span className="text-sm font-medium">{row.original.resource}</span> },
  {
    accessorKey: 'userId',
    header: 'By',
    cell: ({ row }) => {
      const u = row.original.userId;
      return <span className="text-sm">{typeof u === 'object' ? `${u.firstName} ${u.lastName}` : '—'}</span>;
    },
  },
  { accessorKey: 'ip', header: 'IP', cell: ({ row }) => <span className="text-xs font-mono text-muted-foreground">{row.original.ip ?? '—'}</span> },
  { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => <span className="text-sm">{formatDate(row.original.createdAt, 'dd MMM yyyy HH:mm')}</span> },
];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, resourceFilter],
    queryFn: async () => {
      const res = await auditApi.list({
        page, limit: 20,
        action: actionFilter || undefined,
        resource: resourceFilter || undefined,
      });
      return res.data;
    },
  });

  return (
    <div>
      <PageHeader title="Audit Logs" description="Immutable trail of all system actions" />

      <div className="flex gap-3 mb-4">
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actions</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{capitalize(a)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={resourceFilter} onValueChange={(v) => setResourceFilter(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All resources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All resources</SelectItem>
            {RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.data} loading={isLoading} pageCount={data?.pagination?.pages} currentPage={page} onPageChange={setPage} />
    </div>
  );
}
