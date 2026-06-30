"use client";

import { useCallback } from "react";
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
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const PICKUP_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">
    <circle cx="11" cy="11" r="8" fill="#00C2A8" stroke="#ffffff" stroke-width="3"/>
  </svg>`,
)}`;

const DROPOFF_ICON = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">
    <rect x="3" y="3" width="16" height="16" rx="4" fill="#E74C3C" stroke="#ffffff" stroke-width="3"/>
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
}: Props) {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script", // shared with the app's other maps
    googleMapsApiKey: API_KEY,
  });

  const ok = valid(pickup) && valid(dropoff);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      if (!valid(pickup) || !valid(dropoff)) return;
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(dropoff);
      map.fitBounds(bounds, 36);
    },
    [pickup, dropoff],
  );

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
          disableDefaultUI: true,
          gestureHandling: "none",
          keyboardShortcuts: false,
          clickableIcons: false,
          draggable: false,
        }}
      >
        <Polyline
          path={[pickup as LatLng, dropoff as LatLng]}
          options={{
            strokeColor: "#0B1E3D",
            strokeOpacity: 0.85,
            strokeWeight: 4,
          }}
        />
        <Marker position={pickup as LatLng} icon={PICKUP_ICON} />
        <Marker position={dropoff as LatLng} icon={DROPOFF_ICON} />
      </GoogleMap>
    </div>
  );
}
