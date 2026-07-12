"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  Polyline,
} from "@react-google-maps/api";
import { MAP_STYLE } from "@/lib/googleMapsStyle";
import { MapPin } from "lucide-react";

interface LatLng {
  lat: number;
  lng: number;
}

interface Props {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  height?: number;
  rounded?: number;
  /** Enable zoom/pan/scroll (detail pages). Default false = static preview (list cards). */
  interactive?: boolean;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

// Route colour — matches book-a-trip map (ROUTE_COLORS[0])
const ROUTE_COLOR = "#4361EE";

const PICKUP_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36">
    <circle cx="18" cy="18" r="16" fill="#0B1E3D" stroke="#00C2A8" stroke-width="3"/>
    <circle cx="18" cy="18" r="6" fill="#ffffff"/>
  </svg>`,
)}`;

const DROPOFF_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.05 18 32.4 18 32.4S36 31.05 36 18C36 8.06 27.94 0 18 0z" fill="#00C2A8"/>
    <circle cx="18" cy="18" r="8" fill="white"/>
    <circle cx="18" cy="18" r="4.5" fill="#0B1E3D"/>
  </svg>`,
)}`;

function valid(p?: LatLng | null): p is LatLng {
  return (
    !!p &&
    typeof p.lat === "number" &&
    typeof p.lng === "number" &&
    !Number.isNaN(p.lat) &&
    !Number.isNaN(p.lng)
  );
}

function Placeholder({ height, rounded }: { height: number; rounded: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: rounded,
        background:
          "linear-gradient(135deg, #eef2f6 0%, #dfe7ee 50%, #eef2f6 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: "#9aa7b4",
      }}
    >
      <MapPin size={18} aria-hidden="true" />
      <span style={{ fontSize: 12, fontWeight: 600 }}>Route preview</span>
    </div>
  );
}

export default function RouteMap({
  pickup,
  dropoff,
  height = 150,
  rounded = 0,
  interactive = false,
}: Props) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script", // shared with the app's other maps
    googleMapsApiKey: API_KEY,
  });

  const ok = valid(pickup) && valid(dropoff);

  const [pathCoords, setPathCoords] = useState<LatLng[] | null>(null);

  useEffect(() => {
    if (!ok) {
      setPathCoords(null);
      return;
    }
    let cancelled = false;
    const p = pickup as LatLng;
    const d = dropoff as LatLng;
    const url = `/api/directions?origin=${p.lat},${p.lng}&dest=${d.lat},${d.lng}`;
    fetch(url)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        const coords = data?.[0]?.coordinates as [number, number][] | undefined;
        if (coords && coords.length > 1) {
          setPathCoords(coords.map(([lat, lng]) => ({ lat, lng })));
        } else {
          setPathCoords(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPathCoords(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ok, pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  const mapRef = useRef<google.maps.Map | null>(null);

  const fit = useCallback(
    (map: google.maps.Map) => {
      if (!valid(pickup) || !valid(dropoff)) return;
      const bounds = new google.maps.LatLngBounds();
      if (pathCoords?.length) {
        pathCoords.forEach((c) => bounds.extend(c));
      } else {
        bounds.extend(pickup);
        bounds.extend(dropoff);
      }
      map.fitBounds(bounds, 36);
    },
    [pickup, dropoff, pathCoords],
  );

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;
      fit(map);
    },
    [fit],
  );

  // Refit once the real road path arrives
  useEffect(() => {
    if (mapRef.current) fit(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathCoords]);

  if (!ok || !API_KEY || !isLoaded) {
    return <Placeholder height={height} rounded={rounded} />;
  }

  return (
    <div style={{ height, borderRadius: rounded, overflow: "hidden" }}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={pickup as LatLng}
        zoom={13}
        onLoad={onLoad}
        options={{
          styles: MAP_STYLE,
          disableDefaultUI: !interactive,
          zoomControl: interactive,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: interactive ? "greedy" : "none",
          keyboardShortcuts: interactive,
          clickableIcons: false,
          draggable: interactive,
        }}
      >
        {pathCoords && (
          <>
            <Polyline
              path={pathCoords}
              options={{
                strokeColor: ROUTE_COLOR,
                strokeOpacity: 0.15,
                strokeWeight: 14,
                zIndex: 1,
              }}
            />
            <Polyline
              path={pathCoords}
              options={{
                strokeColor: ROUTE_COLOR,
                strokeOpacity: 0.9,
                strokeWeight: 5,
                zIndex: 2,
              }}
            />
          </>
        )}
        <Marker
          position={pickup as LatLng}
          optimized={false}
          icon={{
            url: PICKUP_ICON,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
          }}
        />
        <Marker
          position={dropoff as LatLng}
          optimized={false}
          icon={{
            url: DROPOFF_ICON,
            scaledSize: new google.maps.Size(36, 48),
            anchor: new google.maps.Point(18, 48),
          }}
        />
      </GoogleMap>
    </div>
  );
}
