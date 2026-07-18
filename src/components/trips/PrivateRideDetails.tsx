import { MapPin, Users, Clock, Route as RouteIcon, LogIn, LogOut } from "lucide-react";
import InfoTooltip from "@/components/shared/InfoTooltip";
import type { GeoPoint } from "@/types/geo";

interface Stop {
  point: GeoPoint;
  alighting: number;
  boarding: number;
  waitingMinutes: number;
}

interface Props {
  pickup: GeoPoint;
  dropoff: GeoPoint;
  pickupTime: string;
  arrivalTime: string;
  numberOfPassengers: number;
  stops: Stop[];
  distanceKm: number;
  durationMinutes: number;
  to12h: (hhmm: string) => string;
}

// Haversine distance in km — used only to proportionally split the trip's
// total (road) distance/time across segments for the hover breakdown.
function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function Row({
  icon,
  color,
  label,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  sub?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ marginTop: 2, flexShrink: 0, color }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, color: "#0B1E3D", fontWeight: 600 }}>
          {label}
        </p>
        {sub && (
          <p style={{ margin: "2px 0 0", fontSize: 12, color: "#9aa7b4" }}>{sub}</p>
        )}
      </div>
    </div>
  );
}

export default function PrivateRideDetails({
  pickup,
  dropoff,
  pickupTime,
  arrivalTime,
  numberOfPassengers,
  stops,
  distanceKm,
  durationMinutes,
  to12h,
}: Props) {
  // Segment split for the tooltip: pickup → first stop → ... → last stop → dropoff.
  const chain: GeoPoint[] = [pickup, ...stops.map((s) => s.point), dropoff];
  const segKm = chain.slice(1).map((pt, i) => haversineKm(chain[i], pt));
  const segTotal = segKm.reduce((a, b) => a + b, 0) || 1;
  const segLines = segKm.map((km, i) => {
    const from = i === 0 ? "Pickup" : `Stop ${i}`;
    const to = i === segKm.length - 1 ? "Dropoff" : `Stop ${i + 1}`;
    const shareKm = (km / segTotal) * distanceKm;
    const shareMin = (km / segTotal) * durationMinutes;
    return {
      label: `${from} → ${to} (est.)`,
      value: `${shareKm.toFixed(1)} km · ${Math.round(shareMin)} min`,
    };
  });

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #eef0f3",
        padding: "16px 18px",
        marginBottom: 16,
      }}
    >
      <p
        style={{
          margin: "0 0 14px",
          fontSize: 13,
          fontWeight: 700,
          color: "#0B1E3D",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Private ride
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Origin */}
        <Row
          icon={<MapPin size={15} />}
          color="#00C2A8"
          label={pickup.address}
          sub={`Origin · Pickup time ${to12h(pickupTime)}`}
        />

        {/* Total passengers */}
        <Row
          icon={<Users size={15} />}
          color="#0B1E3D"
          label={`${numberOfPassengers} passenger${numberOfPassengers === 1 ? "" : "s"}`}
          sub="Total passengers"
        />

        {/* Stops */}
        {stops.map((s, i) => (
          <div
            key={i}
            style={{
              borderLeft: "2px dashed #E2E8F0",
              marginLeft: 7,
              paddingLeft: 16,
            }}
          >
            <Row
              icon={<MapPin size={15} />}
              color="#F5A623"
              label={s.point.address}
              sub={`Stop ${i + 1}`}
            />
            <div
              style={{
                display: "flex",
                gap: 16,
                flexWrap: "wrap",
                marginTop: 6,
                marginLeft: 25,
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#5A6A7A",
                }}
              >
                <LogOut size={12} aria-hidden="true" />
                Alighting: <strong style={{ color: "#0B1E3D" }}>{s.alighting}</strong>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#5A6A7A",
                }}
              >
                <LogIn size={12} aria-hidden="true" />
                Boarding: <strong style={{ color: "#0B1E3D" }}>{s.boarding}</strong>
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  color: "#5A6A7A",
                }}
              >
                <Clock size={12} aria-hidden="true" />
                Wait: <strong style={{ color: "#0B1E3D" }}>{s.waitingMinutes} min</strong>
              </span>
            </div>
          </div>
        ))}

        {/* Destination */}
        <Row
          icon={<MapPin size={15} />}
          color="#E74C3C"
          label={dropoff.address}
          sub={`Destination · Drop-off ${to12h(arrivalTime)}`}
        />
      </div>

      {/* Totals with hover breakdown */}
      <div
        style={{
          display: "flex",
          gap: 24,
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid #f4f6f8",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RouteIcon size={15} color="#0B1E3D" aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
            {distanceKm.toFixed(1)} km total
          </span>
          <InfoTooltip lines={segLines} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={15} color="#0B1E3D" aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
            {durationMinutes} min total
          </span>
          <InfoTooltip lines={segLines} />
        </div>
      </div>
    </div>
  );
}
