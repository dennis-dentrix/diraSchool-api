'use client';

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function DataTable({ columns, data, loading, error, pageCount, onPageChange, currentPage }) {
  const [sorting, setSorting] = useState([]);

  const table = useReactTable({
    data: data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
    manualPagination: !!onPageChange,
    pageCount,
  });

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 rounded-xl border border-destructive/20 bg-destructive/5 text-center">
        <AlertCircle className="h-8 w-8 mb-2 text-destructive" />
        <p className="text-sm font-medium text-destructive">Failed to load data</p>
        <p className="text-xs text-muted-foreground mt-1">{error?.message ?? 'Please refresh and try again.'}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b">
          {Array.from({ length: Math.min(columns.length || 5, 6) }).map((_, i) => (
            <Skeleton key={i} className="h-3.5 rounded-full" style={{ width: `${[80, 120, 100, 90, 70, 60][i] || 80}px` }} />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 7 }).map((_, row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-3.5 border-b last:border-0">
            {/* Avatar/icon placeholder */}
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            {/* Name + subtitle */}
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Skeleton className="h-3 rounded-full" style={{ width: `${100 + (row * 13) % 80}px` }} />
              <Skeleton className="h-2.5 rounded-full" style={{ width: `${60 + (row * 17) % 60}px` }} />
            </div>
            {/* Badge placeholder */}
            <Skeleton className="h-5 w-16 rounded-full shrink-0" />
            {/* Value */}
            <Skeleton className="h-3 rounded-full shrink-0" style={{ width: `${50 + (row * 11) % 40}px` }} />
            {/* Action menu */}
            <Skeleton className="h-7 w-7 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-hidden">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[760px]">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="bg-muted/50">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold text-xs uppercase tracking-wide">
                    {header.isPlaceholder ? null : (
                      <div
                        className={header.column.getCanSort() ? 'flex items-center gap-1 cursor-pointer select-none' : ''}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
                      </div>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {(pageCount > 1 || table.getPageCount() > 1) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground">
          <p>
            {onPageChange
              ? `Page ${currentPage ?? 1} of ${pageCount}`
              : `Page ${table.getState().pagination.pageIndex + 1} of ${table.getPageCount()}`}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPageChange ? onPageChange(1) : table.setPageIndex(0)}
              disabled={onPageChange ? currentPage <= 1 : !table.getCanPreviousPage()}>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPageChange ? onPageChange(currentPage - 1) : table.previousPage()}
              disabled={onPageChange ? currentPage <= 1 : !table.getCanPreviousPage()}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPageChange ? onPageChange(currentPage + 1) : table.nextPage()}
              disabled={onPageChange ? currentPage >= pageCount : !table.getCanNextPage()}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8"
              onClick={() => onPageChange ? onPageChange(pageCount) : table.setPageIndex(table.getPageCount() - 1)}
              disabled={onPageChange ? currentPage >= pageCount : !table.getCanNextPage()}>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
