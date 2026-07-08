"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { MAP_STYLE } from "@/lib/googleMapsStyle";
import { reverseGeocode, formatDisplayName } from "@/lib/nominatim";
import type { TripPoint } from "@/lib/store/useTripStore";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const CAIRO = { lat: 30.0444, lng: 31.2357 };

const START_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/>
    <circle cx="18" cy="18" r="6" fill="#ffffff"/>
  </svg>`,
)}`;

const END_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/>
  </svg>`,
)}`;

interface Props {
  startLocation: TripPoint | null;
  endLocation: TripPoint | null;
  picking: "start" | "end" | null;
  onPick: (field: "start" | "end", point: TripPoint) => void;
  onCancelPick: () => void;
}

export default function AvailabilityMap({
  startLocation,
  endLocation,
  picking,
  onPick,
  onCancelPick,
}: Props) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: API_KEY,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [resolving, setResolving] = useState(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
  }, []);

  // Fit bounds when locations change
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;
    const pts = [startLocation, endLocation].filter(Boolean) as TripPoint[];
    if (!pts.length) return;
    if (pts.length === 1) {
      mapRef.current.panTo({ lat: pts[0].lat, lng: pts[0].lng });
      mapRef.current.setZoom(14);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    pts.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    mapRef.current.fitBounds(bounds, {
      top: 50,
      right: 40,
      bottom: 50,
      left: 40,
    });
  }, [startLocation, endLocation, mapReady]);

  const handleMapClick = useCallback(
    async (e: google.maps.MapMouseEvent) => {
      if (!picking || !e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setResolving(true);
      let address = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      try {
        const addr = await reverseGeocode(lat, lng);
        const f = formatDisplayName(addr);
        if (f) address = f;
      } catch {
        // fall back to coordinates
      }
      setResolving(false);
      onPick(picking, { address, lat, lng });
    },
    [picking, onPick],
  );

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
          borderRadius: 12,
        }}
      >
        Loading map…
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={CAIRO}
        zoom={11}
        onLoad={onLoad}
        onClick={handleMapClick}
        options={{
          styles: MAP_STYLE,
          disableDefaultUI: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          draggableCursor: picking ? "crosshair" : undefined,
        }}
      >
        {startLocation && (
          <Marker
            position={{ lat: startLocation.lat, lng: startLocation.lng }}
            icon={{
              url: START_ICON,
              scaledSize: new google.maps.Size(36, 36),
              anchor: new google.maps.Point(18, 18),
            }}
            title="Start location"
            zIndex={10}
          />
        )}
        {endLocation && (
          <Marker
            position={{ lat: endLocation.lat, lng: endLocation.lng }}
            icon={{
              url: END_ICON,
              scaledSize: new google.maps.Size(36, 48),
              anchor: new google.maps.Point(18, 48),
            }}
            title="End location"
            zIndex={10}
          />
        )}
      </GoogleMap>

      {/* Picking overlay banner */}
      {picking && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              background: "#0B1E3D",
              color: "#ffffff",
              fontSize: 12,
              fontWeight: 700,
              padding: "5px 14px",
              borderRadius: 20,
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {resolving
              ? "Resolving address…"
              : `Tap map to pin ${picking === "start" ? "start" : "end"} location`}
          </span>
        </div>
      )}

      {/* Cancel picking */}
      {picking && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancelPick();
          }}
          style={{
            position: "absolute",
            bottom: 10,
            right: 10,
            background: "#ffffff",
            border: "1px solid #eef0f3",
            borderRadius: 8,
            padding: "6px 14px",
            fontSize: 13,
            fontWeight: 700,
            color: "#e74c3c",
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            fontFamily: "inherit",
          }}
        >
          Cancel
        </button>
      )}

      {/* Legend */}
      {!picking && (startLocation || endLocation) && (
        <div
          style={{
            position: "absolute",
            bottom: 10,
            left: 10,
            background: "rgba(255,255,255,0.92)",
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 11,
            display: "flex",
            flexDirection: "column",
            gap: 3,
            boxShadow: "0 1px 6px rgba(0,0,0,0.1)",
          }}
        >
          {startLocation && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#0B1E3D",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#0B1E3D",
                  border: "2px solid #00C2A8",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              Start
            </span>
          )}
          {endLocation && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                color: "#0B1E3D",
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "#00C2A8",
                  flexShrink: 0,
                  display: "inline-block",
                }}
              />
              End
            </span>
          )}
        </div>
      )}
    </div>
  );
}
