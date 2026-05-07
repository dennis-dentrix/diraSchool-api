'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { auditApi } from '@/lib/api';
import { formatDate, capitalize } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { RefreshButton } from '@/components/shared/refresh-button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const ACTIONS   = ['create','update','delete','publish','reverse','suspend','activate','transfer','withdraw','promote','issue','return'];
const RESOURCES = ['Payment','Student','ReportCard','School','User','Book','BookLoan'];

const ACTION_CLS = {
  create:   'border-ok/30 text-ok',
  update:   'border-primary/30 text-primary',
  delete:   'border-bad/30 text-bad',
  publish:  'border-purple-500/30 text-purple-600',
  reverse:  'border-warn/30 text-warn',
  suspend:  'border-bad/30 text-bad',
  activate: 'border-ok/30 text-ok',
  transfer: 'border-primary/30 text-primary',
  withdraw: 'border-border text-foreground',
  promote:  'border-warn/30 text-warn',
  issue:    'border-primary/30 text-primary',
  return:   'border-border text-muted-foreground',
};

function ActionPill({ action }) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-full border px-2 py-0 text-[10px] font-medium shrink-0',
      ACTION_CLS[action] ?? 'border-border text-foreground',
    )}>
      {capitalize(action ?? '')}
    </span>
  );
}

function exportCsv(rows) {
  const header = ['Date', 'Action', 'Resource', 'Actor', 'Role', 'IP'];
  const lines  = [header, ...rows].map((r) =>
    r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','),
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AuditLogsPage() {
  const [page,           setPage]           = useState(1);
  const [actionFilter,   setActionFilter]   = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [startDate,      setStartDate]      = useState('');
  const [endDate,        setEndDate]        = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, resourceFilter, startDate, endDate],
    queryFn: async () => {
      const res = await auditApi.list({
        page,
        limit: 25,
        action:    actionFilter  || undefined,
        resource:  resourceFilter || undefined,
        startDate: startDate || undefined,
        endDate:   endDate   || undefined,
      });
      return res.data;
    },
  });

  const logs       = data?.data ?? [];
  const pagination = data?.pagination ?? {};

  const handleExport = () => {
    const rows = logs.map((log) => {
      const u = log.userId;
      const actor = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'System';
      return [
        formatDate(log.createdAt, 'dd MMM yyyy HH:mm'),
        log.action,
        log.resource,
        actor,
        u?.role ?? '',
        log.ip ?? '',
      ];
    });
    exportCsv(rows);
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Logs" description="Immutable trail of all system actions">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={logs.length === 0}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <RefreshButton queryKeys={[['audit-logs']]} />
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-8 w-36 text-xs rounded-full border">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All actions</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a} value={a}>{capitalize(a)}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={resourceFilter} onValueChange={(v) => { setResourceFilter(v === '__all__' ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-8 w-36 text-xs rounded-full border">
            <SelectValue placeholder="All resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All resources</SelectItem>
            {RESOURCES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="h-8 w-36 text-xs rounded-full"
          value={startDate}
          onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          placeholder="From"
        />
        <Input
          type="date"
          className="h-8 w-36 text-xs rounded-full"
          value={endDate}
          onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          placeholder="To"
        />
      </div>

      {/* Time-ledger */}
      <div className="rounded-lg border bg-card overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-3 w-28 shrink-0" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-16 shrink-0" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No audit events found.</p>
          </div>
        ) : (
          <div className="divide-y">
            {logs.map((log) => {
              const u     = log.userId;
              const actor = u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'System';
              const role  = u?.role ? u.role.replace(/_/g, ' ') : '';
              return (
                <div key={log._id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors">
                  {/* Timestamp */}
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0 w-32 pt-0.5">
                    {formatDate(log.createdAt, 'dd MMM HH:mm')}
                  </span>

                  {/* Actor */}
                  <div className="shrink-0 w-36 min-w-0">
                    <p className="text-sm font-medium leading-tight truncate">{actor}</p>
                    {role && <p className="text-[11px] text-muted-foreground capitalize truncate">{role}</p>}
                  </div>

                  {/* Action + Resource */}
                  <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                    <ActionPill action={log.action} />
                    <span className="text-sm text-muted-foreground truncate">{log.resource}</span>
                    {log.targetId && (
                      <span className="font-mono text-[10px] text-muted-foreground/60 truncate hidden sm:inline">
                        #{String(log.targetId).slice(-6)}
                      </span>
                    )}
                  </div>

                  {/* IP */}
                  <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0 hidden md:inline">
                    {log.ip ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            Page {pagination.currentPage ?? page} of {pagination.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline" size="sm"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
