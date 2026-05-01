'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  MapPin, CheckCircle2, Clock, AlertTriangle, WifiOff,
  Loader2, Navigation, XCircle, LogIn, LogOut,
} from 'lucide-react';
import { checkInsApi, getErrorMessage } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const MAX_ACCURACY_METERS = 200;

// Roles that use geofence (school_admin and parents skip check-in entirely)
const CHECK_IN_ROLES = [
  'teacher', 'department_head', 'secretary', 'accountant',
  'headteacher', 'deputy_headteacher', 'director',
];

// Principal-level roles that get soft enforcement (off-site modal)
const SOFT_ENFORCE_ROLES = ['headteacher', 'deputy_headteacher', 'director'];

// ── Offline helpers ────────────────────────────────────────────────────────────

const PENDING_KEY = 'pendingCheckIns';

function saveOfflinePending(payload) {
  try {
    const list = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
    list.push({ ...payload, savedAt: new Date().toISOString() });
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch (_) {}
}

function clearOfflinePending() {
  try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
}

function getOfflinePending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (_) { return []; }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CheckInWidget() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [state, setState]           = useState('idle'); // idle | locating | submitting | success | error
  const [message, setMessage]       = useState('');
  const [result, setResult]         = useState(null);   // { status, distance_from_center, off_site }
  const [checkInType, setCheckInType] = useState('morning_in');
  const [isOffSiteModalOpen, setIsOffSiteModalOpen] = useState(false);
  const [offSiteReason, setOffSiteReason] = useState('');
  const [pendingPayload, setPendingPayload] = useState(null);
  const [isOnline, setIsOnline]     = useState(true);

  // Don't render widget for roles that don't use check-in
  if (!user || !CHECK_IN_ROLES.includes(user.role)) return null;

  // ── Today's check-in status query ─────────────────────────────────────────

  const { data: todayCheckIns } = useQuery({
    queryKey: ['checkins-today'],
    queryFn: async () => {
      const res = await checkInsApi.today();
      return res.data?.checkIns ?? res.data?.data ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const morningCheckIn  = todayCheckIns?.find((c) => c.check_in_type === 'morning_in');
  const eveningCheckOut = todayCheckIns?.find((c) => c.check_in_type === 'evening_out');

  // Auto-pick type based on what's done
  useEffect(() => {
    if (morningCheckIn && !eveningCheckOut) setCheckInType('evening_out');
    else setCheckInType('morning_in');
  }, [morningCheckIn, eveningCheckOut]);

  // ── Online/offline detection ───────────────────────────────────────────────

  useEffect(() => {
    const onOnline  = () => { setIsOnline(true);  syncOfflinePending(); };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    setIsOnline(navigator.onLine);
    // Sync any pending offline check-ins on mount
    if (navigator.onLine) syncOfflinePending();
    return () => {
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Check-in mutation ─────────────────────────────────────────────────────

  const { mutate: submitCheckIn } = useMutation({
    mutationFn: (data) => checkInsApi.checkIn(data),
    onSuccess: (res) => {
      const data = res.data?.checkIn ?? res.data?.data?.checkIn;
      setResult(data);
      setState('success');
      queryClient.invalidateQueries({ queryKey: ['checkins-today'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (err) => {
      const errData = err?.response?.data;
      // OFF_SITE_REASON_REQUIRED — soft-enforce roles outside boundary
      if (errData?.code === 'OFF_SITE_REASON_REQUIRED' && SOFT_ENFORCE_ROLES.includes(user?.role)) {
        setIsOffSiteModalOpen(true);
        setState('idle');
        return;
      }
      setState('error');
      setMessage(errData?.message ?? getErrorMessage(err));
    },
  });

  // ── Sync offline pending ───────────────────────────────────────────────────

  const syncOfflinePending = useCallback(async () => {
    const pending = getOfflinePending();
    if (pending.length === 0) return;
    let synced = 0;
    for (const item of pending) {
      try {
        await checkInsApi.checkIn({ ...item, synced_offline: true });
        synced += 1;
      } catch (_) {}
    }
    if (synced > 0) {
      clearOfflinePending();
      toast.success(`${synced} offline check-in${synced > 1 ? 's' : ''} synced`);
      queryClient.invalidateQueries({ queryKey: ['checkins-today'] });
    }
  }, [queryClient]);

  // ── Geolocation flow ──────────────────────────────────────────────────────

  const handleCheckIn = () => {
    if (state === 'locating' || state === 'submitting') return;
    setMessage('');
    setState('locating');

    if (!navigator.geolocation) {
      setState('error');
      setMessage('Geolocation is not supported by your browser.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        if (accuracy > MAX_ACCURACY_METERS) {
          setState('error');
          setMessage(
            `GPS signal is weak (accuracy: ${Math.round(accuracy)}m). ` +
            'Please move to an open area or outside and try again.'
          );
          return;
        }

        const payload = {
          latitude, longitude, accuracy,
          check_in_type: checkInType,
          client_timestamp: new Date().toISOString(),
        };

        if (!isOnline) {
          saveOfflinePending(payload);
          setState('idle');
          toast.info('You are offline. Check-in saved and will sync when you reconnect.');
          return;
        }

        setState('submitting');
        setPendingPayload(payload);
        submitCheckIn(payload);
      },
      (error) => {
        setState('error');
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setMessage('Location access was denied. Please enable location in your browser settings to check in.');
            break;
          case error.POSITION_UNAVAILABLE:
            setMessage('Your location could not be determined. Please move to an open area and try again.');
            break;
          case error.TIMEOUT:
            setMessage('Location request timed out. Please try again.');
            break;
          default:
            setMessage('Could not get your location. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  };

  const handleOffSiteSubmit = () => {
    if (!offSiteReason.trim()) return;
    setIsOffSiteModalOpen(false);
    setState('submitting');
    submitCheckIn({ ...pendingPayload, off_site_reason: offSiteReason.trim() });
    setOffSiteReason('');
  };

  const reset = () => { setState('idle'); setMessage(''); setResult(null); };

  // ── Render helpers ────────────────────────────────────────────────────────

  const typeLabel = checkInType === 'morning_in' ? 'Check In' : 'Check Out';
  const TypeIcon  = checkInType === 'morning_in' ? LogIn : LogOut;

  // Already checked in for this type today
  const alreadyDone = checkInType === 'morning_in' ? !!morningCheckIn : !!eveningCheckOut;
  const doneRecord  = checkInType === 'morning_in' ? morningCheckIn : eveningCheckOut;

  // ── Success screen ────────────────────────────────────────────────────────

  if (state === 'success' && result) {
    const isLate    = result.status === 'late';
    const isOffSite = result.off_site;
    return (
      <Card className={`border-2 ${isLate ? 'border-amber-300 bg-amber-50/60' : 'border-emerald-300 bg-emerald-50/60'}`}>
        <CardContent className="p-5 space-y-3 text-center">
          <CheckCircle2 className={`h-10 w-10 mx-auto ${isLate ? 'text-amber-600' : 'text-emerald-600'}`} />
          <div>
            <p className="font-semibold text-slate-900">{typeLabel} Recorded</p>
            <p className="text-xs text-slate-500">{new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Badge variant={isLate ? 'warning' : 'success'} className={isLate ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>
              {isLate ? 'Late' : 'On Time'}
            </Badge>
            {isOffSite && <Badge variant="secondary">Off-Site</Badge>}
            {result.distance_from_center > 0 && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Navigation className="h-3 w-3" />{result.distance_from_center}m from entrance
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="text-xs text-slate-500">
            Dismiss
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/70 shadow-sm">
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <MapPin className="h-4 w-4 text-cyan-700" />
              Staff Attendance
            </div>
            {!isOnline && (
              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                <WifiOff className="h-3 w-3" /> Offline
              </span>
            )}
          </div>

          {/* Today's status summary */}
          {(morningCheckIn || eveningCheckOut) && (
            <div className="space-y-1">
              {morningCheckIn && (
                <div className="flex items-center justify-between text-xs rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <LogIn className="h-3.5 w-3.5" /> Checked in
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-700 font-medium">
                      {new Date(morningCheckIn.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <Badge className={`text-[10px] h-4 px-1.5 ${morningCheckIn.status === 'late' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      {morningCheckIn.status === 'late' ? 'Late' : 'On Time'}
                    </Badge>
                  </div>
                </div>
              )}
              {eveningCheckOut && (
                <div className="flex items-center justify-between text-xs rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-slate-600 flex items-center gap-1.5">
                    <LogOut className="h-3.5 w-3.5" /> Checked out
                  </span>
                  <span className="text-slate-700 font-medium">
                    {new Date(eveningCheckOut.createdAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Check-in type toggle if morning is done */}
          {morningCheckIn && !eveningCheckOut && (
            <p className="text-xs text-slate-500">Ready to check out at end of day?</p>
          )}

          {/* Error message */}
          {state === 'error' && message && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{message}</span>
            </div>
          )}

          {/* Check-in button */}
          {!alreadyDone && (
            <Button
              onClick={handleCheckIn}
              disabled={state === 'locating' || state === 'submitting'}
              className={`w-full gap-2 ${checkInType === 'morning_in' ? 'bg-cyan-700 hover:bg-cyan-800' : 'bg-slate-700 hover:bg-slate-800'}`}
            >
              {state === 'locating' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Getting location…</>
              ) : state === 'submitting' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                <><TypeIcon className="h-4 w-4" /> {typeLabel}</>
              )}
            </Button>
          )}

          {alreadyDone && !morningCheckIn && (
            <p className="text-xs text-center text-slate-500">You have already checked in today.</p>
          )}
          {alreadyDone && eveningCheckOut && (
            <p className="text-xs text-center text-slate-500 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> All done for today!
            </p>
          )}

          <p className="text-[10px] text-center text-muted-foreground">
            Location is only used to verify you are on school premises.
          </p>
        </CardContent>
      </Card>

      {/* Off-site modal (principal soft enforcement) */}
      <Dialog open={isOffSiteModalOpen} onOpenChange={setIsOffSiteModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Off-Site Check-In
            </DialogTitle>
            <DialogDescription>
              You appear to be outside the school geofence. Please provide a reason for this off-site check-in.
              It will be visible to the school admin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="off-site-reason">Reason <span className="text-destructive">*</span></Label>
            <Textarea
              id="off-site-reason"
              placeholder="e.g. TSC Meeting, Ministry Event, Bank Run…"
              value={offSiteReason}
              onChange={(e) => setOffSiteReason(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsOffSiteModalOpen(false); setState('idle'); }}>
              Cancel
            </Button>
            <Button
              onClick={handleOffSiteSubmit}
              disabled={!offSiteReason.trim() || state === 'submitting'}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {state === 'submitting' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Off-Site Check-In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
