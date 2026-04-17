'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Shield } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const ACTION_COLORS = {
  create:   'bg-green-100 text-green-800',
  update:   'bg-blue-100 text-blue-800',
  delete:   'bg-red-100 text-red-800',
  login:    'bg-purple-100 text-purple-800',
  logout:   'bg-gray-100 text-gray-700',
  activate: 'bg-teal-100 text-teal-800',
  suspend:  'bg-orange-100 text-orange-800',
};

const columns = [
  {
    id: 'when',
    header: 'Time',
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: 'school',
    header: 'School',
    cell: ({ row }) => {
      const s = row.original.schoolId;
      return <span className="text-sm">{typeof s === 'object' ? s.name : (s ?? '—')}</span>;
    },
  },
  {
    id: 'actor',
    header: 'Performed By',
    cell: ({ row }) => {
      const u = row.original.userId;
      if (!u) return <span className="text-sm text-muted-foreground">System</span>;
      return (
        <div>
          <p className="text-sm font-medium">{typeof u === 'object' ? `${u.firstName} ${u.lastName}` : '—'}</p>
          {typeof u === 'object' && <p className="text-xs text-muted-foreground capitalize">{u.role?.replace(/_/g, ' ')}</p>}
        </div>
      );
    },
  },
  {
    id: 'action',
    header: 'Action',
    cell: ({ row }) => (
      <Badge className={`text-xs font-medium capitalize ${ACTION_COLORS[row.original.action] ?? 'bg-gray-100 text-gray-700'}`}>
        {row.original.action ?? '—'}
      </Badge>
    ),
  },
  {
    id: 'resource',
    header: 'Resource',
    cell: ({ row }) => (
      <span className="text-sm capitalize">
        {row.original.resource?.replace(/_/g, ' ') ?? '—'}
      </span>
    ),
  },
  {
    id: 'meta',
    header: 'Details',
    cell: ({ row }) => {
      const meta = row.original.meta;
      if (!meta || Object.keys(meta).length === 0) return <span className="text-muted-foreground text-xs">—</span>;
      return (
        <span className="text-xs text-muted-foreground font-mono truncate max-w-40 block">
          {JSON.stringify(meta)}
        </span>
      );
    },
  },
];

const RESOURCES = ['school', 'user', 'student', 'class', 'attendance', 'exam', 'result', 'fee', 'payment'];
const ACTIONS   = ['create', 'update', 'delete', 'activate', 'suspend', 'login', 'logout'];

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [resource, setResource] = useState('');
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['system-audit-logs', page, resource, action],
    queryFn: async () => {
      const res = await adminApi.auditLogs({
        page, limit: 30,
        resource: resource || undefined,
        action:   action   || undefined,
      });
      return res.data;
    },
  });

  const logs = data?.logs ?? data?.data ?? [];
  const pagination = data?.pagination ?? data?.meta;

  return (
    <div>
      <PageHeader
        title="System Audit Logs"
        description="All administrative actions across every school on the platform"
      >
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-md">
          <Shield className="h-3.5 w-3.5" />
          {pagination?.total ?? '—'} entries
        </div>
      </PageHeader>

      <div className="flex gap-3 mb-4 flex-wrap">
        <Select value={resource} onValueChange={(v) => { setResource(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All resources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All resources</SelectItem>
            {RESOURCES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={(v) => { setAction(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-32"><SelectValue placeholder="All actions" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actions</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a} className="capitalize">{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={logs}
        loading={isLoading}
        pageCount={pagination?.pages}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
  );
}
