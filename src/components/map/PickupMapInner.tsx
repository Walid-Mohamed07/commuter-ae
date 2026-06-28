'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';
import { MAP_STYLE } from '@/lib/googleMapsStyle';
import { useRouteOSRM } from './useRouteOSRM';
import type { PickupPoint } from '@/types/driver';

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

function pickupMarkerUrl(index: number) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">` +
    `<circle cx="16" cy="16" r="15" fill="#0B1E3D" stroke="#00C2A8" stroke-width="2.5"/>` +
    `<text x="16" y="21" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="Inter,sans-serif">${index + 1}</text>` +
    `</svg>`
  )}`;
}

const DEST_URL = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="38" height="50">` +
  `<path d="M19 0C8.5 0 0 8.5 0 19c0 13.7 19 34 19 34S38 32.7 38 19C38 8.5 29.5 0 19 0z" fill="#F5A623"/>` +
  `<circle cx="19" cy="19" r="8" fill="white"/>` +
  `<circle cx="19" cy="19" r="4.5" fill="#0B1E3D"/>` +
  `</svg>`
)}`;

interface PickupMapInnerProps {
  pickupPoints: PickupPoint[];
  destination: { lat: number; lng: number; label: string };
  height?: number;
}

export default function PickupMapInner({
  pickupPoints,
  destination,
  height = 320,
}: PickupMapInnerProps) {
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: API_KEY });
  const mapRef = useRef<google.maps.Map | null>(null);
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);

  const waypoints = [
    ...pickupPoints.map((p) => ({ lat: p.lat, lng: p.lng })),
    { lat: destination.lat, lng: destination.lng },
  ];

  const { route, loading, error } = useRouteOSRM(waypoints);

  const centerLat = waypoints.reduce((s, w) => s + w.lat, 0) / waypoints.length;
  const centerLng = waypoints.reduce((s, w) => s + w.lng, 0) / waypoints.length;

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current || !route) return;
    const bounds = new google.maps.LatLngBounds();
    route.coordinates.forEach(([lat, lng]) => bounds.extend({ lat, lng }));
    mapRef.current.fitBounds(bounds, 40);
  }, [route]);

  if (!isLoaded) {
    return (
      <div style={{ height, background: '#EFF7F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6A7A', fontSize: 14 }}>
        Loading map…
      </div>
    );
  }

  const routePath = route?.coordinates.map(([lat, lng]) => ({ lat, lng }));
  const fallbackPath = error ? waypoints.map(({ lat, lng }) => ({ lat, lng })) : null;

  return (
    <div style={{ height, position: 'relative' }}>
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1000,
          background: 'linear-gradient(90deg, #EFF7F6 25%, #d8f0ed 50%, #EFF7F6 75%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: '#5A6A7A', fontSize: 14 }}>Loading route…</span>
        </div>
      )}

      {error && !loading && (
        <div style={{
          position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1000, background: '#FFF3E0', border: '1px solid #F39C12',
          borderRadius: 6, padding: '4px 12px', fontSize: 12, color: '#7a4d00',
          whiteSpace: 'nowrap',
        }}>
          ⚠️ Road route unavailable — showing straight-line path
        </div>
      )}

      <GoogleMap
        mapContainerStyle={{ height: '100%', width: '100%' }}
        center={{ lat: centerLat, lng: centerLng }}
        zoom={13}
        onLoad={onLoad}
        options={{
          styles: MAP_STYLE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          scrollwheel: false,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_CENTER },
          restriction: {
            latLngBounds: { north: 30.35, south: 29.75, east: 31.90, west: 30.75 },
            strictBounds: false,
          },
          minZoom: 9,
        }}
      >
        {/* Road route from OSRM — glow halo + solid line */}
        {routePath && !error && (
          <>
            <Polyline path={routePath} options={{ strokeColor: '#4361EE', strokeWeight: 14, strokeOpacity: 0.12 }} />
            <Polyline path={routePath} options={{ strokeColor: '#4361EE', strokeWeight: 8, strokeOpacity: 0.2 }} />
            <Polyline path={routePath} options={{ strokeColor: '#4361EE', strokeWeight: 5, strokeOpacity: 0.92 }} />
          </>
        )}

        {/* Dashed straight-line fallback */}
        {fallbackPath && (
          <Polyline
            path={fallbackPath}
            options={{
              strokeColor: '#4361EE',
              strokeWeight: 3,
              strokeOpacity: 0,
              icons: [{
                icon: { path: 'M 0,-1 0,1', strokeOpacity: 0.6, scale: 4, strokeColor: '#4361EE' },
                offset: '0',
                repeat: '20px',
              }],
            }}
          />
        )}

        {/* Pickup markers */}
        {pickupPoints.map((point, i) => (
          <Marker
            key={point.passenger_id}
            position={{ lat: point.lat, lng: point.lng }}
            icon={{
              url: pickupMarkerUrl(i),
              scaledSize: new google.maps.Size(28, 28),
              anchor: new google.maps.Point(14, 14),
            }}
            onClick={() => setOpenInfoId(point.passenger_id)}
          >
            {openInfoId === point.passenger_id && (
              <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
                <div style={{ fontSize: 13 }}>
                  <strong>{point.passenger_name}</strong><br />
                  {point.address}<br />
                  <span style={{ color: '#5A6A7A', fontSize: 12 }}>
                    Pickup: +{point.pickup_time_offset} min from start
                  </span>
                </div>
              </InfoWindow>
            )}
          </Marker>
        ))}

        {/* Destination marker */}
        <Marker
          position={{ lat: destination.lat, lng: destination.lng }}
          icon={{
            url: DEST_URL,
            scaledSize: new google.maps.Size(32, 40),
            anchor: new google.maps.Point(16, 40),
          }}
          onClick={() => setOpenInfoId('dest')}
        >
          {openInfoId === 'dest' && (
            <InfoWindow onCloseClick={() => setOpenInfoId(null)}>
              <div style={{ fontSize: 13 }}>
                <strong>Destination</strong><br />
                {destination.label}
              </div>
            </InfoWindow>
          )}
        </Marker>
      </GoogleMap>
    </div>
  );
}
