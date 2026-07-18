import { MapPin, Users, Clock, Route as RouteIcon } from "lucide-react";
import InfoTooltip from "@/components/shared/InfoTooltip";
import type { GeoPoint, StationSelection } from "@/types/geo";
import type { StationOption } from "@/lib/services/trips";

interface Props {
  pickup: GeoPoint;
  dropoff: GeoPoint;
  pickupTime: string;
  arrivalTime: string;
  extraPassengers: number;
  pickupStation?: StationSelection;
  dropoffStation?: StationSelection;
  pickupStationOptions: StationOption[];
  dropoffStationOptions: StationOption[];
  walkingMinToStation?: number;
  walkingMinFromStation?: number;
  distanceKm: number;
  durationMinutes: number;
  to12h: (hhmm: string) => string;
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

export default function SharedRideDetails({
  pickup,
  dropoff,
  pickupTime,
  arrivalTime,
  extraPassengers,
  pickupStation,
  dropoffStation,
  pickupStationOptions,
  dropoffStationOptions,
  walkingMinToStation,
  walkingMinFromStation,
  distanceKm,
  durationMinutes,
  to12h,
}: Props) {
  // Match the selected station against its option to get the exact walk
  // distance recorded at booking time (real data, not estimated).
  const pickupOpt = pickupStationOptions.find((o) => o.id === pickupStation?.id);
  const dropoffOpt = dropoffStationOptions.find(
    (o) => o.id === dropoffStation?.id,
  );

  const walkToKm = pickupOpt?.distanceKm ?? 0;
  const walkToMin = pickupOpt?.walkingMin ?? walkingMinToStation ?? 0;
  const walkFromKm = dropoffOpt?.distanceKm ?? 0;
  const walkFromMin = dropoffOpt?.walkingMin ?? walkingMinFromStation ?? 0;

  const totalKm = walkToKm + distanceKm + walkFromKm;
  const totalMin = walkToMin + durationMinutes + walkFromMin;

  const segLines = [
    { label: "Walk to station", value: `${walkToKm.toFixed(2)} km · ${walkToMin} min` },
    {
      label: "Ride (station → station)",
      value: `${distanceKm.toFixed(1)} km · ${durationMinutes} min`,
    },
    {
      label: "Walk to destination",
      value: `${walkFromKm.toFixed(2)} km · ${walkFromMin} min`,
    },
  ];

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
        Shared ride
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Origin */}
        <Row
          icon={<MapPin size={15} />}
          color="#00C2A8"
          label={pickup.address}
          sub={`Origin · Pickup time ${to12h(pickupTime)}`}
        />

        {/* Pickup station */}
        {pickupStation && (
          <div
            style={{
              borderLeft: "2px dashed #E2E8F0",
              marginLeft: 7,
              paddingLeft: 16,
            }}
          >
            <Row
              icon={<MapPin size={15} />}
              color="#00C2A8"
              label={pickupStation.name}
              sub={`Pickup station${walkToMin ? ` · ${walkToMin} min walk` : ""}`}
            />
          </div>
        )}

        {/* Total passengers */}
        <Row
          icon={<Users size={15} />}
          color="#0B1E3D"
          label={`${extraPassengers} extra passenger${extraPassengers === 1 ? "" : "s"}`}
          sub="Extra passengers"
        />

        {/* Dropoff station */}
        {dropoffStation && (
          <div
            style={{
              borderLeft: "2px dashed #E2E8F0",
              marginLeft: 7,
              paddingLeft: 16,
            }}
          >
            <Row
              icon={<MapPin size={15} />}
              color="#E74C3C"
              label={dropoffStation.name}
              sub={`Dropoff station${walkFromMin ? ` · ${walkFromMin} min walk` : ""}`}
            />
          </div>
        )}

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
            {totalKm.toFixed(1)} km total
          </span>
          <InfoTooltip lines={segLines} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Clock size={15} color="#0B1E3D" aria-hidden="true" />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0B1E3D" }}>
            {totalMin} min total
          </span>
          <InfoTooltip lines={segLines} />
        </div>
      </div>
    </div>
  );
}
