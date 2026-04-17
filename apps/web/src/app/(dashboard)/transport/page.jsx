'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Bus, MoreHorizontal } from 'lucide-react';
import { transportApi, getErrorMessage } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { useForm } from 'react-hook-form';

const CONFIRM_INIT = { open: false, routeId: null, routeName: '' };

export default function TransportPage() {
  const queryClient = useQueryClient();
  const [open, setOpen]               = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(CONFIRM_INIT);
  const { register, handleSubmit, reset } = useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['transport-routes'],
    queryFn: async () => { const res = await transportApi.listRoutes({ limit: 50 }); return res.data; },
  });

  const { mutate: createRoute, isPending } = useMutation({
    mutationFn: (data) => transportApi.createRoute(data),
    onSuccess: () => {
      toast.success('Route created');
      queryClient.invalidateQueries({ queryKey: ['transport-routes'] });
      setOpen(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: deleteRoute } = useMutation({
    mutationFn: (id) => transportApi.deleteRoute(id),
    onSuccess: () => { toast.success('Route deleted'); queryClient.invalidateQueries({ queryKey: ['transport-routes'] }); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const routes = data?.data ?? [];

  return (
    <div>
      <PageHeader title="Transport" description="Manage school transport routes">
        <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Route</Button>
      </PageHeader>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : routes.length === 0 ? (
        <EmptyState
          icon={Bus}
          title="No routes configured"
          description="Add transport routes for student pickup and drop-off"
          action={{ label: 'Add Route', onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {routes.map((route) => (
            <Card key={route._id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Bus className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-base">{route.name}</CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setConfirmDialog({ open: true, routeId: route._id, routeName: route.name })}
                      >
                        Delete route
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                {route.vehicleReg && <p>Vehicle: <span className="font-mono text-foreground">{route.vehicleReg}</span></p>}
                {route.driverName && <p>Driver: {route.driverName} {route.driverPhone ? `(${route.driverPhone})` : ''}</p>}
                {route.capacity && <p>Capacity: {route.capacity} students</p>}
                <p>{route.stops?.length ?? 0} stops configured</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Create route dialog ──────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Transport Route</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit(createRoute)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Route Name</Label>
              <Input {...register('name', { required: true })} placeholder="Westlands — School" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Vehicle Reg</Label><Input {...register('vehicleReg')} placeholder="KBZ 123A" /></div>
              <div className="space-y-1.5">
                <Label>Capacity</Label>
                <Input {...register('capacity', { valueAsNumber: true })} type="number" placeholder="40" min="1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Driver Name</Label><Input {...register('driverName')} placeholder="John Mwangi" /></div>
              <div className="space-y-1.5"><Label>Driver Phone</Label><Input {...register('driverPhone')} placeholder="0712 345 678" /></div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending}>Create Route</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Confirm delete dialog ────────────────────────────────────────── */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog(CONFIRM_INIT)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete route?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDialog.routeName}" will be permanently removed. Students assigned to this route will be unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteRoute(confirmDialog.routeId); setConfirmDialog(CONFIRM_INIT); }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
