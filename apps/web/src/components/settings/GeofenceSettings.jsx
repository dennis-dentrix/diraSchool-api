'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Save, Info, Clock } from 'lucide-react';
import { geofenceApi, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// Leaflet is loaded dynamically because it requires window/document
let L = null;

function MapComponent({ lat, lng, radius, onCenterChange }) {
  const mapRef  = useRef(null);
  const mapObj  = useRef(null);
  const markerRef  = useRef(null);
  const circleRef  = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    (async () => {
      if (!L) {
        L = (await import('leaflet')).default;
        // Fix default icon paths broken by webpack
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
      }

      if (mapObj.current) return; // already initialised

      const initialLat = lat || -1.286389;
      const initialLng = lng || 36.817223;

      mapObj.current = L.map(mapRef.current, { zoomControl: true }).setView([initialLat, initialLng], 17);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapObj.current);

      markerRef.current = L.marker([initialLat, initialLng], { draggable: true })
        .addTo(mapObj.current)
        .bindPopup('Drag to the school entrance')
        .openPopup();

      circleRef.current = L.circle([initialLat, initialLng], {
        radius,
        color: '#0e7490',
        fillColor: '#0e7490',
        fillOpacity: 0.15,
        weight: 2,
      }).addTo(mapObj.current);

      markerRef.current.on('dragend', () => {
        const pos = markerRef.current.getLatLng();
        circleRef.current.setLatLng(pos);
        onCenterChange(pos.lat, pos.lng);
      });
    })();

    return () => {
      if (mapObj.current) {
        mapObj.current.remove();
        mapObj.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update circle radius when slider changes
  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radius);
  }, [radius]);

  // Re-center map if saved coordinates are loaded
  useEffect(() => {
    if (!mapObj.current || !lat || !lng) return;
    if (!markerRef.current) return;
    const newLatLng = L?.latLng(lat, lng);
    if (!newLatLng) return;
    markerRef.current.setLatLng(newLatLng);
    circleRef.current?.setLatLng(newLatLng);
    mapObj.current.setView([lat, lng], 17);
  }, [lat, lng]);

  return (
    <>
      {/* Leaflet CSS — injected once */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <div ref={mapRef} className="h-72 w-full rounded-lg border border-slate-200 z-0" />
    </>
  );
}

export function GeofenceSettings({ settings, canEdit }) {
  const queryClient = useQueryClient();

  const saved = settings?.geofence ?? {};
  const [lat, setLat]    = useState(saved.latitude  ?? null);
  const [lng, setLng]    = useState(saved.longitude ?? null);
  const [radius, setRadius] = useState(saved.radius_meters ?? 150);
  const [checkInDeadline, setCheckInDeadline] = useState(settings?.checkInDeadline ?? '08:00');
  const [checkOutTime,    setCheckOutTime]    = useState(settings?.checkOutTime    ?? '17:00');

  const handleCenterChange = useCallback((newLat, newLng) => {
    setLat(newLat);
    setLng(newLng);
  }, []);

  const { mutate: saveGeofence, isPending: savingGeofence } = useMutation({
    mutationFn: () => geofenceApi.save({ latitude: lat, longitude: lng, radius_meters: radius }),
    onSuccess: () => {
      toast.success('Geofence saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const { mutate: saveTimings, isPending: savingTimings } = useMutation({
    mutationFn: () => geofenceApi.saveTimings({ checkInDeadline, checkOutTime }),
    onSuccess: () => {
      toast.success('Check-in times saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <div className="space-y-6">
      {/* Map card */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4 text-cyan-700" />
            School Location & Geofence
          </CardTitle>
          <CardDescription>
            Staff must be within this boundary to successfully check in.
            Adjust the radius to account for your campus size.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info note */}
          <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-800">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Drag the pin to your school&apos;s main entrance. The shaded circle shows the
              check-in boundary. Staff outside this area will be blocked from checking in
              (principals can check in off-site with a reason).
            </span>
          </div>

          {/* Leaflet map */}
          <MapComponent
            lat={lat}
            lng={lng}
            radius={radius}
            onCenterChange={handleCenterChange}
          />

          {/* Radius slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Geofence radius</Label>
              <span className="text-sm font-semibold text-cyan-700">{radius} m</span>
            </div>
            <input
              type="range"
              min={50}
              max={500}
              step={10}
              value={radius}
              disabled={!canEdit}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-cyan-700"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50 m (tight)</span>
              <span>500 m (wide campus)</span>
            </div>
          </div>

          {/* Coordinates display */}
          {lat && lng && (
            <div className="text-xs text-muted-foreground font-mono bg-slate-50 rounded p-2">
              Center: {lat.toFixed(6)}, {lng.toFixed(6)} · Radius: {radius} m
            </div>
          )}

          {/* Save button */}
          {canEdit && (
            <Button
              onClick={() => saveGeofence()}
              disabled={!lat || !lng || savingGeofence}
              className="gap-2 bg-cyan-700 hover:bg-cyan-800"
            >
              <Save className="h-4 w-4" />
              {savingGeofence ? 'Saving…' : 'Save Geofence'}
            </Button>
          )}

          {!canEdit && (
            <p className="text-xs text-muted-foreground italic">
              Only school admins can configure the geofence.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Check-in times card */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-cyan-700" />
            Check-In & Check-Out Times
          </CardTitle>
          <CardDescription>
            Staff who check in after the deadline will be marked <strong>Late</strong>.
            Times are in Kenya time (EAT, UTC+3).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="checkin-deadline">Check-in deadline</Label>
              <Input
                id="checkin-deadline"
                type="time"
                value={checkInDeadline}
                disabled={!canEdit}
                onChange={(e) => setCheckInDeadline(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Staff arriving after this time are marked late</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="checkout-time">Check-out time</Label>
              <Input
                id="checkout-time"
                type="time"
                value={checkOutTime}
                disabled={!canEdit}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Expected end-of-day check-out time</p>
            </div>
          </div>
          {canEdit && (
            <Button
              onClick={() => saveTimings()}
              disabled={savingTimings}
              variant="outline"
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {savingTimings ? 'Saving…' : 'Save Times'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
