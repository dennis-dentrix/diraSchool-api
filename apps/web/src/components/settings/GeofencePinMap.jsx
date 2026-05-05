'use client';

import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

const KENYA_CENTER = [-0.0236, 37.9062];

function MapClickHandler({ canEdit, onChange }) {
  useMapEvents({
    click(event) {
      if (!canEdit) return;
      onChange({
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
      });
    },
  });

  return null;
}

function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.setView(position, Math.max(map.getZoom(), 16), { animate: true });
    }
  }, [map, position?.[0], position?.[1]]);

  return null;
}

export function GeofencePinMap({ latitude, longitude, radius, canEdit, onChange }) {
  const hasPosition = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude));
  const position = hasPosition ? [Number(latitude), Number(longitude)] : null;
  const center = position ?? KENYA_CENTER;
  const zoom = position ? 17 : 6;
  const radiusMeters = Number(radius) || 150;

  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: '',
        html: '<div style="width:22px;height:22px;border-radius:999px;background:#0e7490;border:3px solid white;box-shadow:0 8px 18px rgba(15,23,42,.28);"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
    []
  );

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler canEdit={canEdit} onChange={onChange} />
      {position && (
        <>
          <RecenterMap position={position} />
          <Circle
            center={position}
            radius={radiusMeters}
            pathOptions={{
              color: '#0e7490',
              fillColor: '#06b6d4',
              fillOpacity: 0.16,
              weight: 2,
            }}
          />
          <Marker
            position={position}
            icon={markerIcon}
            draggable={canEdit}
            eventHandlers={{
              dragend(event) {
                const point = event.target.getLatLng();
                onChange({ latitude: point.lat, longitude: point.lng });
              },
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
