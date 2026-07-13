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
import { reverseGeocode, formatDisplayName } from "@/lib/nominatim";
import type { TripPoint } from "@/lib/store/useTripStore";
import { isSharedVehicle } from "@/lib/geo/stations";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const CAIRO = { lat: 30.0444, lng: 31.2357 };
const ROUTE_COLORS = ["#4361EE", "#F5A623", "#00C2A8"];

// ── Station marker icon ─────────────────────────────────────────────────────────────
const STATION_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">
    <circle cx="11" cy="11" r="10" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/>
    <text x="11" y="15" text-anchor="middle" font-family="Arial,sans-serif" font-size="9" font-weight="700" fill="#0B1E3D">S</text>
  </svg>`,
)}`;

// ── SVG route label badge ─────────────────────────────────────────────────────
function routeLabelSvg(text: string, color: string): string {
  const w = 58;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22">
      <rect width="${w}" height="22" rx="6" fill="${color}"/>
      <text x="${w / 2}" y="15" font-family="Arial,sans-serif" font-size="11" font-weight="700"
        fill="white" text-anchor="middle">${text}</text>
    </svg>`,
  )}`;
}

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

function stopIcon(index: number): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="36">
      <path d="M15 1C7.27 1 1 7.27 1 15c0 10.25 14 20 14 20s14-9.75 14-20C29 7.27 22.73 1 15 1z" fill="#F5A623" stroke="#0B1E3D" stroke-width="1.5"/>
      <text x="15" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="12" font-weight="700" fill="#0B1E3D">${index + 1}</text>
    </svg>`,
  )}`;
}

interface Props {
  trips: TripData[];
  picking?: { tripId: string; field: "pickup" | "dropoff" } | null;
  onMapPick?: (point: TripPoint) => void;
  onCancelPick?: () => void;
}

export default function CreateMap({
  trips,
  picking,
  onMapPick,
  onCancelPick,
}: Props) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script", // shared with LocationPickerMap
    googleMapsApiKey: API_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const zonesLoadedRef = useRef(false);
  const [zoom, setZoom] = useState(11);

  interface ZoneLabel {
    id: string;
    no: number;
    name: string;
    lat: number;
    lng: number;
  }

  const [zoneLabels, setZoneLabels] = useState<ZoneLabel[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/geo/zone_centroid.geojson")
      .then((r) => r.json())
      .then((fc) => {
        if (cancelled) return;
        const labels: ZoneLabel[] = fc.features.map((f: any) => {
          const idStr = String(f.id); // "ZONE 1"
          const noMatch = idStr.match(/\d+/);
          return {
            id: String(f.id),
            no: f.properties?.NO ?? (noMatch ? parseInt(noMatch[0]) : 0),
            name: f.properties?.NAME ?? "",
            lat: f.geometry.coordinates[1], // GeoJSON = [lng, lat]
            lng: f.geometry.coordinates[0],
          };
        });
        setZoneLabels(labels);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    if (zonesLoadedRef.current) return; // prevents double-add on remount
    zonesLoadedRef.current = true;

    // Zone polygons → built-in Data layer
    map.data.loadGeoJson("/geo/zone_polygon.geojson");
    map.data.setStyle({
      fillColor: "rgb(10, 0, 168)",
      fillOpacity: 0.08,
      strokeColor: "rgba(255, 0, 168, 1)",
      strokeWeight: 1.2,
      strokeOpacity: 0.6,
      clickable: false, // skip hit-testing → better perf
      zIndex: 0, // keep zones beneath your routes/markers
    });
  }, []);

  // Collect all route points across all trips
  const allPoints: { lat: number; lng: number }[] = [];
  for (const t of trips) {
    t.stops.forEach((stop) => {
      if (stop.point) {
        allPoints.push({ lat: stop.point.lat, lng: stop.point.lng });
      }
    });
    if (t.routeCoordinates?.length) {
      t.routeCoordinates.forEach(([lat, lng]) => allPoints.push({ lat, lng }));
      // For shared trips the route is station→station; include actual pickup/dropoff in bounds too
      if (isSharedVehicle(t.vehicleType)) {
        if (t.pickup) allPoints.push({ lat: t.pickup.lat, lng: t.pickup.lng });
        if (t.dropoff)
          allPoints.push({ lat: t.dropoff.lat, lng: t.dropoff.lng });
      }
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

  // Draw routes imperatively — wipe + redraw on every change (no ghost lines)
  useEffect(() => {
    if (!mapRef.current) return;

    // clear previous
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    trips.forEach((t, i) => {
      if (!t.routeCoordinates || t.routeCoordinates.length < 2) return;
      const path = t.routeCoordinates.map(([lat, lng]) => ({ lat, lng }));
      const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
      const glow = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: 0.15,
        strokeWeight: 14,
        zIndex: 1,
        map: mapRef.current!,
      });
      const main = new google.maps.Polyline({
        path,
        strokeColor: color,
        strokeOpacity: 0.9,
        strokeWeight: 5,
        zIndex: 2,
        map: mapRef.current!,
      });
      polylinesRef.current.push(glow, main);
    });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(trips.map((t) => t.routeCoordinates)), mapReady]);

  const handleMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (!picking || !onMapPick || !e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const addr = await reverseGeocode(lat, lng);
        const f = formatDisplayName(addr);
        if (f) address = f;
      } catch {}
      onMapPick({ address, lat, lng });
    },
    [picking, onMapPick],
  );

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
        onClick={handleMapClick}
        options={{
          styles: MAP_STYLE,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          draggableCursor: picking ? "crosshair" : undefined,
        }}
      >
        {zoneLabels.map((z) => (
          <Marker
            key={`zone-${z.id}`}
            position={{ lat: z.lat, lng: z.lng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 0, // invisible marker, label only
            }}
            label={{
              text: z.name ? `${z.no} ${z.name}` : `Zone ${z.no}`,
              color: "#0B1E3D",
              fontSize: "11px",
              fontWeight: "600",
            }}
            clickable={false}
            zIndex={1}
          />
        ))}

        {trips.map((t, i) => {
          // Route midpoint label
          const midLabel = (() => {
            if (!t.routeCoordinates || t.routeCoordinates.length < 2)
              return null;
            const mid =
              t.routeCoordinates[Math.floor(t.routeCoordinates.length / 2)];
            const color = ROUTE_COLORS[i % ROUTE_COLORS.length];
            return (
              <Marker
                key={`label-${t.id}`}
                position={{ lat: mid[0], lng: mid[1] }}
                icon={{
                  url: routeLabelSvg(`Trip ${i + 1}`, color),
                  scaledSize: new google.maps.Size(58, 22),
                  anchor: new google.maps.Point(29, 11),
                }}
                clickable={false}
                zIndex={5}
              />
            );
          })();

          return (
            <span key={t.id}>
              {midLabel}

              {/* Walking polylines for shared trips (dashed amber) */}
              {isSharedVehicle(t.vehicleType) &&
                t.pickup &&
                t.pickupStation && (
                  <Polyline
                    path={[
                      { lat: t.pickup.lat, lng: t.pickup.lng },
                      { lat: t.pickupStation.lat, lng: t.pickupStation.lng },
                    ]}
                    options={{
                      strokeColor: "#F5A623",
                      strokeOpacity: 0,
                      strokeWeight: 3,
                      zIndex: 1,
                      icons: [
                        {
                          icon: {
                            path: "M 0,-1 0,1",
                            strokeOpacity: 0.9,
                            scale: 3,
                            strokeColor: "#F5A623",
                          },
                          offset: "0",
                          repeat: "10px",
                        },
                      ],
                    }}
                  />
                )}
              {isSharedVehicle(t.vehicleType) &&
                t.dropoff &&
                t.dropoffStation && (
                  <Polyline
                    path={[
                      { lat: t.dropoffStation.lat, lng: t.dropoffStation.lng },
                      { lat: t.dropoff.lat, lng: t.dropoff.lng },
                    ]}
                    options={{
                      strokeColor: "#F5A623",
                      strokeOpacity: 0,
                      strokeWeight: 3,
                      zIndex: 1,
                      icons: [
                        {
                          icon: {
                            path: "M 0,-1 0,1",
                            strokeOpacity: 0.9,
                            scale: 3,
                            strokeColor: "#F5A623",
                          },
                          offset: "0",
                          repeat: "10px",
                        },
                      ],
                    }}
                  />
                )}

              {/* Station markers */}
              {isSharedVehicle(t.vehicleType) && t.pickupStation && (
                <Marker
                  position={{
                    lat: t.pickupStation.lat,
                    lng: t.pickupStation.lng,
                  }}
                  icon={{
                    url: STATION_ICON,
                    scaledSize: new google.maps.Size(22, 22),
                    anchor: new google.maps.Point(11, 11),
                  }}
                  title={t.pickupStation.name}
                  clickable={false}
                  zIndex={8 + i}
                />
              )}
              {isSharedVehicle(t.vehicleType) &&
                t.dropoffStation &&
                t.dropoffStation.lat !== t.pickupStation?.lat && (
                  <Marker
                    position={{
                      lat: t.dropoffStation.lat,
                      lng: t.dropoffStation.lng,
                    }}
                    icon={{
                      url: STATION_ICON,
                      scaledSize: new google.maps.Size(22, 22),
                      anchor: new google.maps.Point(11, 11),
                    }}
                    title={t.dropoffStation.name}
                    clickable={false}
                    zIndex={8 + i}
                  />
                )}

              {!isSharedVehicle(t.vehicleType) &&
                t.stops.map(
                  (stop, stopIndex) =>
                    stop.point && (
                      <Marker
                        key={`stop-${t.id}-${stop.id}`}
                        position={{ lat: stop.point.lat, lng: stop.point.lng }}
                        icon={{
                          url: stopIcon(stopIndex),
                          scaledSize: new google.maps.Size(30, 36),
                          anchor: new google.maps.Point(15, 36),
                        }}
                        title={`Trip ${i + 1}, stop ${stopIndex + 1}: ${stop.point.address}`}
                        zIndex={11 + i + stopIndex}
                      />
                    ),
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

      {/* Picking banner */}
      {picking && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(11,30,61,0.9)",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: 20,
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ pointerEvents: "none" }}>
            Click the map to set {picking.field}
          </span>
          <button
            type="button"
            onClick={onCancelPick}
            style={{
              background: "rgba(255,255,255,0.2)",
              border: "none",
              borderRadius: 12,
              color: "#fff",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              padding: "2px 8px",
              fontFamily: "inherit",
              pointerEvents: "auto",
            }}
          >
            Cancel
          </button>
        </div>
      )}

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
