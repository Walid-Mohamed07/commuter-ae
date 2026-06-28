"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
} from "@react-google-maps/api";
import { MAP_STYLE } from "@/lib/googleMapsStyle";
import type { TripData } from "./TripCycle";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const CAIRO = { lat: 30.0444, lng: 31.2357 };

// ── SVG marker icons ──────────────────────────────────────────────────────
const ORIGIN_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/>
    <circle cx="18" cy="18" r="6" fill="#ffffff"/>
  </svg>`,
)}`;

const DEST_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/>
  </svg>`,
)}`;

interface Props {
  trips: TripData[];
}

export default function CreateMap({ trips }: Props) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script", // shared with LocationPickerMap
    googleMapsApiKey: API_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [zoom, setZoom] = useState(11);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Collect all route points across all trips
  const allPoints: { lat: number; lng: number }[] = [];
  for (const t of trips) {
    if (t.routeCoordinates?.length) {
      t.routeCoordinates.forEach(([lat, lng]) => allPoints.push({ lat, lng }));
    } else {
      if (t.pickup) allPoints.push({ lat: t.pickup.lat, lng: t.pickup.lng });
      if (t.dropoff) allPoints.push({ lat: t.dropoff.lat, lng: t.dropoff.lng });
    }
  }

  // Fit bounds whenever routes / points change
  useEffect(() => {
    if (!mapRef.current || !allPoints.length) return;
    const bounds = new google.maps.LatLngBounds();
    allPoints.forEach((p) => bounds.extend(p));
    mapRef.current.fitBounds(bounds, {
      top: 60,
      right: 40,
      bottom: 60,
      left: 40,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allPoints)]);

  function handleZoom(delta: number) {
    if (!mapRef.current) return;
    const z = mapRef.current.getZoom() ?? zoom;
    mapRef.current.setZoom(z + delta);
  }

  function handleLocate() {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      mapRef.current!.panTo({ lat: coords.latitude, lng: coords.longitude });
      mapRef.current!.setZoom(15);
    });
  }

  if (!isLoaded) {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#e8f0f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5A6A7A",
          fontSize: 14,
          fontFamily: "inherit",
        }}
        aria-label="Map loading"
      >
        Loading map…
      </div>
    );
  }

  // Palette per trip (cycle through 3 route colours)
  const ROUTE_COLORS = ["#4361EE", "#F5A623", "#00C2A8"];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={CAIRO}
        zoom={11}
        onLoad={onLoad}
        onZoomChanged={() => {
          if (mapRef.current) setZoom(mapRef.current.getZoom() ?? 11);
        }}
        options={{
          styles: MAP_STYLE,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
        }}
      >
        {trips.map((t, i) => {
          const color = ROUTE_COLORS[i % ROUTE_COLORS.length];

          return (
            <span key={t.id}>
              {/* Route polyline */}
              {t.routeCoordinates && t.routeCoordinates.length > 1 && (
                <>
                  {/* Outer glow */}
                  <Polyline
                    path={t.routeCoordinates.map(([lat, lng]) => ({
                      lat,
                      lng,
                    }))}
                    options={{
                      strokeColor: color,
                      strokeOpacity: 0.15,
                      strokeWeight: 14,
                      zIndex: 1,
                    }}
                  />
                  {/* Main line */}
                  <Polyline
                    path={t.routeCoordinates.map(([lat, lng]) => ({
                      lat,
                      lng,
                    }))}
                    options={{
                      strokeColor: color,
                      strokeOpacity: 0.9,
                      strokeWeight: 5,
                      zIndex: 2,
                    }}
                  />
                </>
              )}

              {/* Origin marker */}
              {t.pickup && (
                <Marker
                  position={{ lat: t.pickup.lat, lng: t.pickup.lng }}
                  icon={{
                    url: ORIGIN_ICON,
                    scaledSize: new google.maps.Size(36, 36),
                    anchor: new google.maps.Point(18, 18),
                  }}
                  title={`Trip ${i + 1} pickup`}
                  zIndex={10 + i}
                />
              )}

              {/* Destination marker */}
              {t.dropoff && (
                <Marker
                  position={{ lat: t.dropoff.lat, lng: t.dropoff.lng }}
                  icon={{
                    url: DEST_ICON,
                    scaledSize: new google.maps.Size(36, 48),
                    anchor: new google.maps.Point(18, 48),
                  }}
                  title={`Trip ${i + 1} dropoff`}
                  zIndex={10 + i}
                />
              )}
            </span>
          );
        })}
      </GoogleMap>

      {/* Route badge — show for the first trip that has a route */}
      {(() => {
        const active = trips.find((t) => t.distanceKm && t.durationMinutes);
        if (!active) return null;
        return (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div className="route-badge">
              <span className="route-badge-km">{active.distanceKm} km</span>
              <span className="route-badge-sep">·</span>
              <span>{active.durationMinutes} min</span>
            </div>
          </div>
        );
      })()}

      {/* Custom zoom controls */}
      <div className="map-zoom-controls" aria-label="Map zoom controls">
        <button
          className="map-zoom-btn"
          onClick={() => handleZoom(1)}
          aria-label="Zoom in"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
        <div className="map-zoom-divider" />
        <button
          className="map-zoom-btn"
          onClick={() => handleZoom(-1)}
          aria-label="Zoom out"
          type="button"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Locate-me button */}
      <button
        className="map-locate-btn"
        onClick={handleLocate}
        aria-label="Center map on my location"
        type="button"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
          <circle cx="12" cy="12" r="8" strokeDasharray="2 2" />
        </svg>
      </button>
    </div>
  );
}
